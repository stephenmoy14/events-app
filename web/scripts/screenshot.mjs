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
  ["mobile-week-lower", phone, "/?when=week", false, async (p) => p.evaluate(() => window.scrollTo(0, 560))],
  ["mobile-month-day", phone, "/?when=month&day=__DAY4__", false, async (p) => p.evaluate(() => window.scrollTo(0, 560))],
  ["mobile-calendar", phone, "/?when=week", false, async (p) => { await p.click(".calendar > summary"); await p.evaluate(() => document.querySelector(".calendar").scrollIntoView()); }],
  ["mobile-empty", phone, "/?when=today&cat=food&free=1", false],
];

const day4 = new Date(Date.now() + 4 * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const browser = await chromium.launch();
for (const [name, viewport, path, fullPage, action] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(base + path.replace("__DAY4__", day4), { waitUntil: "networkidle" });
  if (action) await action(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });
  await page.close();
}
await browser.close();
console.log("saved", shots.length, "screenshots to", out);
