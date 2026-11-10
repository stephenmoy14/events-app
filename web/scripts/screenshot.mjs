// Screenshots of the running site for review in CI: node scripts/screenshot.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });

const shots = [
  ["desktop-week", { width: 1280, height: 900 }, "/?when=week", false],
  ["mobile-week", { width: 390, height: 844 }, "/?when=week", false],
  ["mobile-week-full", { width: 390, height: 844 }, "/?when=week", true],
  ["mobile-filtered", { width: 390, height: 844 }, "/?when=month&cat=music&cat=theater", false],
  ["mobile-empty", { width: 390, height: 844 }, "/?when=today&cat=food&free=1", false],
];

const browser = await chromium.launch();
for (const [name, viewport, path, fullPage] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });
  await page.close();
}
await browser.close();
console.log("saved", shots.length, "screenshots to", out);
