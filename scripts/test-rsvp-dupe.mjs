/**
 * Dev/QA helper: verify RSVP duplicate prevention + post-submit behaviour.
 * Local only. Submits one test reply to the local dev DB.
 * Usage: node scripts/test-rsvp-dupe.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:8080/";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160));
});

const openInvite = async () => {
  await page.waitForSelector("button.envelope", { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector("button.envelope")?.click());
  await page.waitForSelector("#rsvp", { state: "attached", timeout: 30000 });
  await page.waitForTimeout(2500);
};

const successText = async () =>
  ((await page.evaluate(() => document.querySelector(".rsvp-success")?.innerText || "")) || "")
    .replace(/\s+/g, " ")
    .trim();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await openInvite();

const out = {};
out.formOnFreshVisit = await page.locator("#rsvpForm").count();

await page.locator("#rsvp").scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
await page.fill("#guestName", "AUDIT-Dupe-Test");
await page.locator("input[name=attendance]").first().check();
await page.fill("#attendees", "2");
await page.fill("#contact", "09171234567");
await page.locator("#rsvpForm button[type=submit]").click();
await page.waitForTimeout(4000);

out.formGoneAfterSubmit = !(await page.evaluate(() => Boolean(document.querySelector("#rsvpForm"))));
out.repliedFlag = await page.evaluate(() => localStorage.getItem("iria-asuna-rsvp-replied"));
out.thanksText = (await successText()).slice(0, 120);

// Reload: the guest must still get into the invitation, but NOT be offered the form.
await page.reload({ waitUntil: "domcontentloaded" });
await openInvite();
await page.locator("#rsvp").scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);

out.invitationStillAccessible = await page.evaluate(() => Boolean(document.querySelector("#details")));
out.formAfterReload = await page.locator("#rsvpForm").count();
out.messageAfterReload = (await successText()).slice(0, 140);

// Independent guest in a NEW browser context (fresh storage) must still see the form.
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await p2.waitForSelector("button.envelope", { timeout: 30000 });
await p2.waitForTimeout(2500);
await p2.evaluate(() => document.querySelector("button.envelope")?.click());
await p2.waitForSelector("#rsvp", { state: "attached", timeout: 30000 });
await p2.waitForTimeout(2500);
out.otherGuestSeesForm = await p2.locator("#rsvpForm").count();

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));

await browser.close();
