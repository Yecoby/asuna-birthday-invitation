/**
 * Admin credential mapping — dependency-free so it can be unit-tested and
 * imported by both the client-safe and server-only layers.
 *
 * The Host Desk has ONE admin account, configured from environment variables.
 * Better Auth's email/password mode requires an email-shaped identifier, but this
 * app deliberately never asks for or uses a real email address. Instead the
 * username is mapped to an internal, non-routable identifier under the reserved
 * `.invalid` TLD (RFC 2606), which can never receive mail.
 *
 * Keeping the mapping here (rather than duplicating it) guarantees that the
 * sign-in path and the account-provisioning path can never disagree about which
 * account a username refers to.
 */

/** Reserved, non-routable TLD — the identifier is never a real mailbox. */
export const ADMIN_IDENTIFIER_DOMAIN = "admin.invalid";

/** Map a username to its internal identifier (case-insensitive). */
export function adminIdentifier(username: string): string {
  return `${encodeURIComponent(username.trim().toLowerCase())}@${ADMIN_IDENTIFIER_DOMAIN}`;
}

/** True when both required credentials are present and non-blank. */
export function hasAdminCredentials(
  username: string | undefined | null,
  password: string | undefined | null,
): boolean {
  return Boolean(username && username.trim() && password);
}

/** The single user-facing login failure — never reveals which field was wrong. */
export const GENERIC_LOGIN_ERROR = "Invalid username or password.";

/**
 * Compare two usernames for sign-in. Case-insensitive and whitespace-tolerant,
 * so the admin is not locked out by a stray capital or trailing space.
 */
export function usernamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
