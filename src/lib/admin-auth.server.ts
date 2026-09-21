/**
 * Admin account provisioning — **server-only**.
 *
 * The Host Desk has exactly ONE account, created from environment variables:
 *
 *   ADMIN_USERNAME = the admin's login name
 *   ADMIN_PASSWORD = the admin's password (you set this yourself)
 *
 * WHY THIS SHAPE
 * --------------
 * The password is never compared in application code and never stored in
 * plaintext. On the first sign-in attempt we seed the account using Better
 * Auth's own password hasher, which writes a scrypt hash into the
 * `account.password` column. Every sign-in then goes through Better Auth's
 * `signInEmail`, which verifies that hash with its constant-time comparison.
 *
 * So there is no second credential store, no hand-rolled crypto, and no
 * plaintext secret anywhere — `ADMIN_PASSWORD` is read once, used to seed the
 * account or verify against an already-seeded one, and never leaves the server.
 *
 * Better Auth's email/password mode requires an email-shaped `identifier`, but
 * this app deliberately does NOT ask for (or use) a real email address: the
 * username is mapped to an internal, non-routable identifier under the
 * `.invalid` reserved TLD (RFC 2606), which can never receive mail.
 */
import { auth } from "@/lib/auth/server";
import { adminIdentifier, hasAdminCredentials } from "@/lib/admin-credentials";

/** The single admin's credentials, or null when unconfigured. */
export type AdminCredentials = { username: string; password: string };

/**
 * Read `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Both must be set; a half-configured
 * pair is treated as unconfigured so the login simply cannot be used rather than
 * silently accepting a blank credential.
 */
export function adminCredentials(): AdminCredentials | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!hasAdminCredentials(username, password)) return null;
  return { username: (username as string).trim(), password: password as string };
}

/** True when both admin env vars are present. */
export function adminConfigured(): boolean {
  return adminCredentials() !== null;
}

/**
 * Look up an existing account by username, server-side.
 *
 * Uses `auth.$context.internalAdapter.findUserByEmail`, which is the documented
 * internal lookup Better Auth itself uses. Returns null when the account has not
 * been seeded yet (first ever sign-in).
 */
async function findAdminUser(identifier: string) {
  const ctx = await auth.$context;
  return ctx.internalAdapter.findUserByEmail(identifier);
}

/**
 * Ensure the admin account exists, creating it from the env vars on first use.
 *
 * Returns the credentials to verify against:
 *   - account missing  -> seed it (Better Auth's own hasher writes the scrypt
 *                         hash), then return credentials for a normal sign-in so
 *                         the session cookie is issued identically.
 *   - account present  -> return the CURRENT env credentials to verify against.
 *
 * Returns null when the admin is not configured server-side.
 *
 * NOTE: if `ADMIN_PASSWORD` is changed after the account was seeded, the stored
 * hash no longer matches. We detect that and re-seed the stored hash so rotating
 * the env var actually rotates the password (a stale hash must not lock the
 * owner out, and the env var stays the single source of truth).
 */
export async function ensureAdminAccount(): Promise<AdminCredentials | null> {
  const credentials = adminCredentials();
  if (!credentials) return null;

  const identifier = adminIdentifier(credentials.username);
  const existing = await findAdminUser(identifier);

  if (!existing) {
    // First run: create the account server-side.
    //
    // Deliberately NOT `auth.api.signUpEmail` — that is the PUBLIC endpoint and
    // is blocked by `disableSignUp` (which is what keeps strangers out). The
    // internal adapter is the same primitive Better Auth uses to create a user,
    // and we hash with its own password hasher, so the stored format is
    // identical to every other credential Better Auth would manage.
    try {
      const ctx = await auth.$context;
      const hash = await ctx.password.hash(credentials.password);
      const created = await ctx.internalAdapter.createUser({
        email: identifier,
        name: credentials.username,
        // No real mailbox exists for the admin; the identifier is the account key.
        emailVerified: false,
      });
      await ctx.internalAdapter.createAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: hash,
      });
    } catch (err) {
      // A racing request may have created it first — that's fine, it exists now.
      console.error("[admin-auth] seeding the admin account failed:", err);
      const retry = await findAdminUser(identifier);
      if (!retry) return null;
    }
    return credentials;
  }

  return credentials;
}

/**
 * Re-seed the stored password hash from the current `ADMIN_PASSWORD`.
 *
 * Called only after a credential change is detected (the stored hash no longer
 * matches the env password), so the env var remains authoritative. Uses Better
 * Auth's own hashing so the stored format stays consistent.
 */
export async function reseedAdminPassword(
  credentials: AdminCredentials,
): Promise<boolean> {
  const identifier = adminIdentifier(credentials.username);
  const user = await findAdminUser(identifier);
  if (!user?.user) return false;
  try {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(credentials.password);
    await ctx.internalAdapter.updatePassword(user.user.id, hash);
    return true;
  } catch (err) {
    console.error("[admin-auth] re-seeding the admin password failed:", err);
    return false;
  }
}