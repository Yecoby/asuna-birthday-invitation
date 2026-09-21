import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_IDENTIFIER_DOMAIN,
  adminIdentifier,
  hasAdminCredentials,
  usernamesMatch,
} from "./admin-credentials.ts";

// ── Identifier mapping ──────────────────────

test("username maps to a non-routable identifier (never a real mailbox)", () => {
  assert.equal(adminIdentifier("Admin"), `admin@${ADMIN_IDENTIFIER_DOMAIN}`);
  // RFC 2606 reserved TLD — cannot receive mail.
  assert.equal(ADMIN_IDENTIFIER_DOMAIN, "admin.invalid");
  assert.ok(adminIdentifier("host").endsWith(".invalid"));
});

test("the mapping is case-insensitive and whitespace-tolerant", () => {
  assert.equal(adminIdentifier("ADMIN"), adminIdentifier("admin"));
  assert.equal(adminIdentifier("  Admin  "), adminIdentifier("admin"));
});

test("characters unsafe in an address local-part are encoded", () => {
  assert.equal(adminIdentifier("a b@c"), `a%20b%40c@${ADMIN_IDENTIFIER_DOMAIN}`);
  assert.ok(!adminIdentifier("a b").split("@")[0].includes(" "));
});

// ── Credential presence ─────────────────────

test("both username and password must be present and non-blank", () => {
  assert.equal(hasAdminCredentials("admin", "secret"), true);
  assert.equal(hasAdminCredentials("admin", ""), false);
  assert.equal(hasAdminCredentials("", "secret"), false);
  assert.equal(hasAdminCredentials("   ", "secret"), false);
  assert.equal(hasAdminCredentials(null, "secret"), false);
  assert.equal(hasAdminCredentials("admin", null), false);
  assert.equal(hasAdminCredentials(undefined, undefined), false);
});

// ── Username comparison (sign-in) ───────────────────────────

test("usernames match case-insensitively", () => {
  assert.equal(usernamesMatch("Admin", "admin"), true);
  assert.equal(usernamesMatch("ADMIN", "Admin"), true);
  assert.equal(usernamesMatch("  admin  ", "admin"), true);
});

test("usernames do not match partially or with extra characters", () => {
  assert.equal(usernamesMatch("admin", "administrator"), false);
  assert.equal(usernamesMatch("admin", "admin2"), false);
  assert.equal(usernamesMatch("admin", "admi"), false);
  assert.equal(usernamesMatch("", "admin"), false);
});
