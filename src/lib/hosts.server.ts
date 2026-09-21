/**
 * Server-side Host Desk authorization — **server-only** (`.server.ts` suffix).
 *
 * Authorization happens HERE, before any private row is read. The Host Desk UI
 * never receives data it is not allowed to show: an unauthorized visitor gets a
 * thrown error, not a rendered-then-hidden desk (there is no client-side hiding
 * anywhere in this flow).
 *
 * Order of checks (all fail closed):
 *   1. Fetch-Metadata sibling isolation (`assertSameSiteRequest`) — a scripted
 *      cross-site request can't ride the session cookie.
 *   2. A valid Better Auth session, resolved from the request cookie server-side.
 *
 * There is no longer an email allowlist: the Host Desk has a single admin
 * account, and holding a valid session means the credentials were verified by
 * `signInHost` (`@/lib/host-session`). A browser flag, localStorage entry, or
 * edited React state cannot produce a session — only the server can.
 */
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSessionUser } from "@/lib/auth/verify.server";

export type Host = { userId: string };

/** Thrown when the caller has no valid session. Client matches on `.status`. */
export class HostUnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "HostUnauthorizedError";
  }
}

/**
 * Resolve the current caller to the authenticated admin, or throw 401.
 *
 * Every server function that touches RSVP replies or host settings must call
 * this FIRST, inside its handler.
 */
export async function requireHost(): Promise<Host> {
  assertSameSiteRequest();

  const user = await getSessionUser();
  if (!user) throw new HostUnauthorizedError();

  return { userId: user.id };
}
