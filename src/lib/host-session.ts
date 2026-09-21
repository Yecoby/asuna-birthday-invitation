/**
 * Host Desk session — server functions for the admin username/password login.
 *
 * All three run on the server. The browser never sees the admin password, never
 * holds a "logged in" flag, and never decides who is an admin:
 *
 *   signInHost()      verifies the credentials server-side and issues Better
 *                     Auth's HttpOnly session cookie via the API route handler.
 *   getHostSession()  asks the server "is this caller authenticated?" — the
 *                     source of truth for what /host may draw.
 *   signOutHost()     invalidates the session server-side and clears the cookie.
 *
 * The credential check itself lives in `@/lib/admin-auth.server`; this file only
 * orchestrates it and enforces the attempt limit.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  GENERIC_LOGIN_ERROR,
  adminIdentifier,
  usernamesMatch,
} from "@/lib/admin-credentials";

/**
 * IMPORTANT: this module is imported by CLIENT components (`/login`, `/host`), so
 * it must NOT have a top-level import of any `*.server` module — TanStack Start's
 * import-protection plugin rejects that and the whole module fails to load.
 *
 * Every server-only dependency is therefore imported lazily INSIDE the handlers,
 * which only ever execute on the server. `getRequest` comes from the same place
 * for the same reason.
 */
async function serverDeps() {
  const [{ getRequest }, { getSessionUser }, { assertSameSiteRequest }] =
    await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/lib/auth/verify.server"),
      import("@/lib/auth/isolation.server"),
    ]);
  return { getRequest, getSessionUser, assertSameSiteRequest };
}

/** Server-only admin helpers, loaded on demand (see the note above). */
async function adminDeps() {
  return import("@/lib/admin-auth.server");
}

// ── Attempt limiting (in-memory, per-process) ───────────────────────────────
//
// A lightweight guard against online password guessing: after
// MAX_ATTEMPTS failures from one key, further attempts are refused for
// LOCKOUT_MS. Deliberately NOT a distributed rate limiter — state is per
// process and resets on restart. That is an honest limitation: it stops casual
// brute force on a single long-lived server (and in local dev), but on a
// serverless platform with many instances each has its own counter. For one
// admin account behind a strong password that is an acceptable trade for not
// adding a Redis/DB-backed limiter to a birthday invitation.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

type AttemptState = { failures: number[]; lockedUntil: number };
const attempts = new Map<string, AttemptState>();

/**
 * Best-effort client key. Behind a proxy the platform sets
 * `x-forwarded-for`; we take the first hop. Not spoof-proof on its own, which is
 * another reason this is a mitigation rather than a guarantee — the real
 * defence is a strong password plus the constant-time hash comparison.
 */
function clientKey(request: Request | undefined): string {
  if (!request) return "unknown";
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "unknown";
}

function isLockedOut(key: string): boolean {
  const state = attempts.get(key);
  if (!state) return false;
  if (Date.now() < state.lockedUntil) return true;
  const cutoff = Date.now() - WINDOW_MS;
  state.failures = state.failures.filter((t) => t > cutoff);
  if (state.failures.length < MAX_ATTEMPTS) state.lockedUntil = 0;
  return Date.now() < state.lockedUntil;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const state = attempts.get(key) ?? { failures: [], lockedUntil: 0 };
  state.failures = state.failures.filter((t) => t > now - WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= MAX_ATTEMPTS) state.lockedUntil = now + LOCKOUT_MS;
  attempts.set(key, state);
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

// ── Server functions ───────────────────────

/** Is this caller an authenticated admin? Server-verified, never cached in the page. */
export const getHostSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ authenticated: boolean; configured: boolean }> => {
    const { adminConfigured } = await adminDeps();
    if (!adminConfigured()) return { authenticated: false, configured: false };
    const { getSessionUser } = await serverDeps();
    const user = await getSessionUser();
    return { authenticated: Boolean(user), configured: true };
  },
);

/**
 * Verify the submitted username + password and, on success, establish a session.
 *
 * The session cookie is set by returning Better Auth's response headers through
 * TanStack Start's cookie store — see below.
 */
export const signInHost = createServerFn({ method: "POST" })
  .validator((input: unknown): { username: string; password: string } => {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
      username: typeof raw.username === "string" ? raw.username.trim() : "",
      password: typeof raw.password === "string" ? raw.password : "",
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true } | { ok: false; message: string }> => {
      const { getRequest, assertSameSiteRequest } = await serverDeps();
      const request = getRequest();

      // Reject scripted cross-site attempts before touching credentials.
      assertSameSiteRequest();

      const key = clientKey(request);
      if (isLockedOut(key)) {
        return {
          ok: false,
          message: "Too many attempts. Please try again in a few minutes.",
        };
      }

      const { adminConfigured, ensureAdminAccount, reseedAdminPassword } =
        await adminDeps();

      if (!adminConfigured()) {
        return {
          ok: false,
          message: "The Host Desk is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
        };
      }

      const credentials = await ensureAdminAccount();
      if (!credentials) return { ok: false, message: GENERIC_LOGIN_ERROR };

      // Reject on the username before doing any password work, but always answer
      // with the SAME message so neither field is distinguishable.
      if (!usernamesMatch(data.username, credentials.username)) {
        recordFailure(key);
        return { ok: false, message: GENERIC_LOGIN_ERROR };
      }

      if (!request) return { ok: false, message: GENERIC_LOGIN_ERROR };

      const { auth } = await import("@/lib/auth/server");

      // Verify + issue the session using Better Auth's own API, which hashes
      // nothing here but does the constant-time hash comparison for us.
      const response = await auth.api
        .signInEmail({
          body: { email: adminIdentifier(data.username), password: data.password },
          headers: request.headers,
          asResponse: true,
        })
        .catch(() => null);

      if (!response || !response.ok) {
        // Before reporting failure, handle an ADMIN_PASSWORD rotation: the stored
        // hash may simply be stale. Re-seed from the env var and try once more.
        const rotated = await reseedAdminPassword(credentials);
        if (rotated) {
          const retry = await auth.api
            .signInEmail({
              body: {
                email: adminIdentifier(data.username),
                password: data.password,
              },
              headers: request.headers,
              asResponse: true,
            })
            .catch(() => null);
          if (retry?.ok) {
            clearFailures(key);
            await forwardSessionCookies(retry);
            return { ok: true };
          }
        }
        recordFailure(key);
        return { ok: false, message: GENERIC_LOGIN_ERROR };
      }

      clearFailures(key);
      await forwardSessionCookies(response);
      return { ok: true };
    },
  );

/** Sign out server-side (invalidate the session row) and clear the cookie. */
export const signOutHost = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const { getRequest, assertSameSiteRequest } = await serverDeps();
    assertSameSiteRequest();
    const request = getRequest();
    if (request) {
      const { auth } = await import("@/lib/auth/server");
      await auth.api
        .signOut({ headers: request.headers, asResponse: true })
        .catch(() => null);
    }
    const { deleteCookie } = await import("@tanstack/react-start/server");
    for (const name of SESSION_COOKIE_NAMES) {
      try {
        deleteCookie(name, { path: "/" });
      } catch {
        /* cookie may not be present — nothing to clear */
      }
    }
    return { ok: true };
  },
);

// ── Internals ──────────────────────────────

/**
 * Every cookie name Better Auth might use for the session / its cache, under
 * both the hardened (`__Host-`) and the plain-http-localhost policy. Sign-out
 * clears all of them so no stale cookie can keep the caller "signed in".
 */
const SESSION_COOKIE_NAMES = [
  "__Host-grok-auth.session_token",
  "grok-auth.session_token",
  "__Host-grok-auth.session_data",
  "grok-auth.session_data",
];

/**
 * Copy Better Auth's `Set-Cookie` headers from its own response onto the
 * TanStack Start response, so the browser stores the session cookie.
 *
 * The API route (`/api/auth/$`) returns Better Auth's response directly, which
 * is why its cookies work there. A server function has no such passthrough, so
 * we relay the cookies explicitly through `setCookie`.
 */
async function forwardSessionCookies(response: Response): Promise<void> {
  const { setCookie } = await import("@tanstack/react-start/server");
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const cookie of raw) {
    const [pair, ...attrs] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    // Better Auth's `Set-Cookie` value is ALREADY percent-encoded (the signed
    // token contains `/`, `+`, `=`). `setCookie` encodes again on the way out, so
    // passing the raw value through produced a DOUBLE-encoded cookie
    // (`%252F` instead of `%2F`). The browser then sent a value the session
    // verifier could not match, and `get-session` returned null — the session
    // looked "signed in" in the UI but was unverifiable on every later request.
    // Decode once here so the re-encoded output matches what Better Auth wrote.
    const rawValue = pair.slice(eq + 1).trim();
    let value = rawValue;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      /* not encoded — keep the raw value */
    }
    const options: Record<string, unknown> = { path: "/" };
    for (const attr of attrs) {
      const [k, v] = attr.split("=").map((s) => s.trim());
      switch (k.toLowerCase()) {
        case "path":
          options.path = v || "/";
          break;
        case "max-age":
          options.maxAge = Number(v) || undefined;
          break;
        case "httponly":
          options.httpOnly = true;
          break;
        case "secure":
          options.secure = true;
          break;
        case "samesite":
          options.sameSite = (v || "lax").toLowerCase();
          break;
        default:
          break;
      }
    }
    try {
      setCookie(name, value, options);
    } catch {
      /* a malformed attribute must not fail the whole sign-in */
    }
  }
}
