/**
 * Cookie policy for plain-HTTP local development.
 *
 * The app's session cookie is named `__Host-grok-auth.session_token`, and the
 * browser REFUSES any `__Host-` cookie that lacks `Secure` (and any cookie with
 * `Secure` that is not on a secure origin). Browsers do NOT apply their
 * "localhost is a secure context" exemption to the cookie rule, so on
 * `http://localhost:8080` a `Secure` cookie is silently DISCARDED.
 *
 * That broke local sign-in: Better Auth's `oauth2` state cookie never survived
 * the round-trip to Google, so the callback failed with `state_mismatch`, and the
 * session cookie written after a successful exchange was dropped too.
 *
 * So `Secure` (and with it the `__Host-` prefix, which REQUIRES `Secure`) is
 * relaxed ONLY for a loopback host over plain http. Everything else — production
 * HTTPS, a LAN IP, a tunnel, the https live preview — keeps the hardened
 * `__Host-` + `Secure` posture unchanged.
 *
 * Dependency-free on purpose: the server config, the gate plugin and the unit
 * tests all import this one predicate, so the policy cannot drift between them.
 */

/** True only for `http://` on a loopback host. */
export function isPlainHttpLoopback(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:") return false;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Whether cookies should carry `Secure` (and therefore the `__Host-` name
 * prefix) for the given app origin. Fail-safe: anything unrecognised keeps
 * `Secure` on.
 */
export function shouldUseSecureCookies(origin: string | null | undefined): boolean {
  return !isPlainHttpLoopback(origin);
}

/** The session token cookie name for the given origin. */
export function sessionTokenCookieName(origin: string | null | undefined): string {
  return shouldUseSecureCookies(origin)
    ? "__Host-grok-auth.session_token"
    : "grok-auth.session_token";
}

/** The `session_data` cookie name for the given origin. */
export function sessionDataCookieName(origin: string | null | undefined): string {
  return shouldUseSecureCookies(origin)
    ? "__Host-grok-auth.session_data"
    : "grok-auth.session_data";
}

/** The `account_data` cookie name for the given origin. */
export function accountDataCookieName(origin: string | null | undefined): string {
  return shouldUseSecureCookies(origin)
    ? "__Host-grok-auth.account_data"
    : "grok-auth.account_data";
}

/** The `dont_remember` cookie name for the given origin. */
export function dontRememberCookieName(origin: string | null | undefined): string {
  return shouldUseSecureCookies(origin)
    ? "__Host-grok-auth.dont_remember"
    : "grok-auth.dont_remember";
}
