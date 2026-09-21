/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * ENABLED for the Host Desk: the single admin account signs in with a username +
 * password instead of Google. Better Auth hashes the password (scrypt) into the
 * `account.password` column and issues its own HttpOnly session cookie, so there
 * is no separate hand-rolled credential/session system to maintain.
 *
 * The admin account is provisioned server-side from ADMIN_USERNAME /
 * ADMIN_PASSWORD on first sign-in — see `@/lib/admin-auth.server`. Sign-up is
 * disabled (`disableSignUp`) so nobody can create an account themselves; the
 * only account that can exist is the seeded admin.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;

/**
 * Self-service sign-up is OFF. The admin account is created only by the server
 * from the ADMIN_* env vars, so a stranger cannot register their way in.
 */
export const disableSignUp = true;
