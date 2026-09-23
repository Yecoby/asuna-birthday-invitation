import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:8080/';
const mp3Name = '02. What If There Was Pink - The Pirate Fairy Soundtrack - (320 Kbps) (1).mp3';
async function runViewportTest(viewport) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport });
  const requests = [];
  const consoleErrors = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(800);

  // Click envelope
  let envelopeClicked = false;
  try {
    await page.waitForSelector('button.envelope', { timeout: 10000 });
    await page.click('button.envelope', { force: true });
    envelopeClicked = true;
  } catch (err) {
    envelopeClicked = false;
  }
  // Wait long enough for the envelope opening animation (2.5s) and audio start
  await page.waitForTimeout(4000);

  // Check for MP3 requests
  const mp3Requests = requests.filter(r => r.url.includes(mp3Name));
  // Also probe the performance resource list in case the request happened as a resource
  const perfResources = await page.evaluate(() =>
    (window.performance.getEntriesByType('resource') || []).map((e) => e.name),
  ).catch(() => []);
  const perfMp3 = (perfResources || []).filter((n) => n.includes(mp3Name));

  // Try play/pause via music toggle
  const toggle = await page.$('button.music-toggle');
  let toggleExists = !!toggle;
  let toggled = false;
  if (toggle) {
    await toggle.click();
    await page.waitForTimeout(600);
    await toggle.click();
    toggled = true;
  }

  await page.screenshot({ path: `/workspace/screenshots/playwright-${viewport.width}x${viewport.height}.png` }).catch(() => {});
  await browser.close();
  return { status, envelopeClicked, mp3Requests, perfMp3, toggleExists, toggled, consoleErrors };
}

(async () => {
  const desktop = await runViewportTest({ width: 1280, height: 800 });
  const mobile = await runViewportTest({ width: 390, height: 844 });
  const out = { url, desktop, mobile };
  writeFileSync('/workspace/playwright-audio-test.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})();
