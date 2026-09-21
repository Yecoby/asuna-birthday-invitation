import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPlainHttpLoopback,
  sessionTokenCookieName,
  shouldUseSecureCookies,
} from "./cookie-policy.ts";

// ── The relaxation applies ONLY to plain-http loopback ──────────────────────

test("plain http on a loopback host relaxes Secure (dev server contract)", () => {
  assert.equal(isPlainHttpLoopback("http://localhost:8080"), true);
  assert.equal(isPlainHttpLoopback("http://127.0.0.1:8080"), true);
  assert.equal(isPlainHttpLoopback("http://[::1]:8080"), true);
  assert.equal(shouldUseSecureCookies("http://localhost:8080"), false);
});

test("production HTTPS keeps Secure and the __Host- prefix", () => {
  assert.equal(shouldUseSecureCookies("https://iria.vercel.app"), true);
  assert.equal(shouldUseSecureCookies("https://invite.example.com"), true);
  assert.equal(
    sessionTokenCookieName("https://iria.vercel.app"),
    "__Host-grok-auth.session_token",
  );
});

test("the https live preview keeps Secure and the __Host- prefix", () => {
  assert.equal(shouldUseSecureCookies("https://abc.grok-sandbox.com"), true);
  assert.equal(
    sessionTokenCookieName("https://abc.grok-sandbox.com"),
    "__Host-grok-auth.session_token",
  );
});

// ── Fail-safe: anything non-loopback or non-http keeps Secure ───────────────

test("a LAN IP over http is NOT treated as local", () => {
  assert.equal(isPlainHttpLoopback("http://192.168.0.106:8080"), false);
  assert.equal(shouldUseSecureCookies("http://192.168.0.106:8080"), true);
});

test("https on localhost is NOT relaxed (tunnel / hosted dev)", () => {
  assert.equal(isPlainHttpLoopback("https://localhost:8080"), false);
  assert.equal(shouldUseSecureCookies("https://localhost:8080"), true);
});

test("a hostname merely CONTAINING localhost is not loopback", () => {
  assert.equal(isPlainHttpLoopback("http://localhost.evil.test"), false);
  assert.equal(isPlainHttpLoopback("http://notlocalhost"), false);
  assert.equal(isPlainHttpLoopback("http://127.0.0.1.evil.test"), false);
});

test("missing or malformed origins fail safe (Secure stays on)", () => {
  assert.equal(isPlainHttpLoopback(null), false);
  assert.equal(isPlainHttpLoopback(undefined), false);
  assert.equal(isPlainHttpLoopback(""), false);
  assert.equal(isPlainHttpLoopback("not a url"), false);
  assert.equal(shouldUseSecureCookies(null), true);
});

test("the dev cookie name drops the prefix so the browser will store it", () => {
  // A `__Host-` name REQUIRES Secure; keeping the prefix without Secure makes the
  // browser reject the cookie outright, which is the bug this policy fixes.
  assert.equal(sessionTokenCookieName("http://localhost:8080"), "grok-auth.session_token");
  assert.equal(
    sessionTokenCookieName("http://localhost:8080").startsWith("__Host-"),
    false,
  );
});
