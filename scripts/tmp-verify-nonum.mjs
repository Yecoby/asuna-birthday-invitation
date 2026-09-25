// Verify the Program Flow numbering is gone while all 13 items remain, in order,
// with the heading/time intact — and that Gentle Reminders is unaffected.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("screenshots", { recursive: true });

const PROGRAM = [
  "Guest Arrival & Free Play",
  "Opening Prayer",
  "Grand Entrance",
  "Welcome Message",
  "Fun & Games",
  "Birthday Wishes",
  "🎂 Cake Blowing & Pictorial",
  "Dinner",
  "🪄 Magic Show",
  "🫧 Bubble Show",
  "🪅 Piñata & Pabitin",
  "Wrap-Up Games",
  "Thank You & Closing",
];

const REMINDER_TEXT = [
  "Please sanitize your hands before interacting with or holding the birthday girl.",
  "Please avoid kissing the baby, especially on her face and hands.",
  "If you're feeling unwell, have a fever, cough, colds, or other contagious symptoms, please rest at home and celebrate with us from afar.",
  "Please be gentle when holding or playing with her. Always ask Mommy or Daddy first.",
  "Please keep small objects and choking hazards away from the baby.",
  "Photos are welcome! Please be mindful of her comfort and let her enjoy her special day.",
  "Please let the birthday girl enjoy her cake and presents at her own pace.",
  "Most importantly, come ready to celebrate, laugh, and make beautiful memories with us!",
];

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const browser = await chromium.launch();
const out = [];

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const hit = [...document.querySelectorAll("button, [role='button']")].find((el) =>
      /open|enter|tap|begin/i.test(el.textContent || ""),
    );
    if (hit) hit.click();
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.activeElement?.blur());

  const d = await page.evaluate(() => {
    const panel = document.querySelector(".guide-panel--program");
    const labels = [...document.querySelectorAll(".program__label")].map((n) => n.textContent);
    const items = [...document.querySelectorAll(".program__item")];
    return {
      overline: document.querySelector(".guide-panel--program .guide-panel__overline")?.textContent ?? "",
      title: document.querySelector("#programTitle")?.textContent ?? "",
      time: document.querySelector(".program__time")?.textContent ?? "",
      labels,
      itemCount: items.length,
      // Any leftover numeral elements at all?
      indexEls: document.querySelectorAll(".program__index").length,
      // Does any item's rendered text begin with digits (e.g. "01 ...")?
      anyItemStartsWithDigit: items.some((it) => /^\s*\d{2}\b/.test(it.textContent || "")),
      // The list must no longer be an <ol> (which would auto-number).
      listTag: document.querySelector(".program__list")?.tagName ?? "",
      // The panel text, for a whole-block numeral scan.
      panelText: panel?.innerText ?? "",
      // Layout guard: each label must be a single line, not wrapped word-per-word.
      labelLineCounts: labels.map((_, i) => {
        const el = [...document.querySelectorAll(".program__label")][i];
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || 20;
        return Math.round((el.getBoundingClientRect().height / lh) * 10) / 10;
      }),
      labelWidths: [...document.querySelectorAll(".program__label")].map((el) =>
        Math.round(el.getBoundingClientRect().width),
      ),
      // Reminders must be untouched.
      reminderCount: document.querySelectorAll(".reminder").length,
      reminderTexts: [...document.querySelectorAll(".reminder__text")].map((n) => n.textContent),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  const checks = {
    "'The Celebration' present": norm(d.overline) === "The Celebration",
    "'Program Flow' present": norm(d.title) === "Program Flow",
    "'5:00 PM – 9:00 PM' present": norm(d.time) === "5:00 PM – 9:00 PM",
    "13 items still present": d.labels.length === 13,
    "all 13 labels exact + in order": PROGRAM.every((p, i) => norm(p) === norm(d.labels[i])),
    "no .program__index elements": d.indexEls === 0,
    "no item text starts with a number": !d.anyItemStartsWithDigit,
    "list is not an <ol>": d.listTag === "UL",
    "no standalone 01..13 numerals in panel": !/(^|\n)\s*0[1-9]\s*(\n|$)|\b1[0-3]\s*\n/.test(d.panelText),
    // Wrapping guard: no label may be more than 2 lines, and the widest label
    // must occupy most of the panel (i.e. it is not squeezed into a thin track).
    "labels are not word-wrapped": d.labelLineCounts.every((n) => n <= 2),
    "labels use the panel width": Math.max(...d.labelWidths) > 200,
    "no horizontal overflow": d.overflow === 0,
    "8 reminders untouched": d.reminderCount === 8,
    "reminder wording untouched": REMINDER_TEXT.every((t, i) => norm(t) === norm(d.reminderTexts[i])),
  };

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

  await page.locator(".guide-panel--program").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.locator(".guest-guide").screenshot({ path: `screenshots/nonum-${vp.name}.png` });

  out.push({ viewport: vp.name, failed, consoleErrors: errs, sample: d.labels.slice(0, 3) });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));