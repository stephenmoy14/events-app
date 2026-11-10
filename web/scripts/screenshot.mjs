// Screenshots of the running site for review in CI: node scripts/screenshot.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });

const desktop = { width: 1280, height: 1000 };
const phone = { width: 390, height: 844 };
// [name, viewport, path, fullPage, before-screenshot action]
const shots = [
  ["desktop-week", desktop, "/?when=week", false],
  ["mobile-week", phone, "/?when=week", false],
  ["mobile-custom-start", phone, "/?when=custom", false, async (p) => p.evaluate(() => window.scrollTo(0, 230))],
  ["mobile-custom-range", phone, "/?when=custom&from=__DAY2__&to=__DAY6__&day=__DAY4__", false, async (p) => p.evaluate(() => window.scrollTo(0, 230))],
  ["mobile-more-filters", phone, "/?when=week&time=evening&time=night&wkend=1&price=20", false, async (p) => p.evaluate(() => document.querySelector(".more-filters").scrollIntoView())],
  ["desktop-custom", desktop, "/?when=custom&from=__DAY2__&to=__DAY6__&time=evening&wkend=1", false],
];

const dayN = (n) => new Date(Date.now() + n * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const browser = await chromium.launch();
for (const [name, viewport, path, fullPage, action] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const url = path.replace("__DAY2__", dayN(2)).replace("__DAY4__", dayN(4)).replace("__DAY6__", dayN(6));
  await page.goto(base + url, { waitUntil: "networkidle" });
  if (action) await action(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });
  await page.close();
}
await browser.close();
console.log("saved", shots.length, "screenshots to", out);
