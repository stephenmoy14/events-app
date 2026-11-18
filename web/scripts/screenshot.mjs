// Screenshots of the running site for review in CI: node scripts/screenshot.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });

const desktop = { width: 1280, height: 1000 };
const phone = { width: 390, height: 844 };
// [name, viewport, path, fullPage, before-screenshot action]
const openSheet = async (p) => { await p.click(".sheet-toggle"); await p.waitForTimeout(150); };
const shots = [
  ["desktop-week", desktop, "/?when=week", false],
  ["desktop-filtered", desktop, "/?when=week&cat=music&cat=comedy&price=20&time=evening&time=night&wkend=1", false],
  ["mobile-week", phone, "/?when=week", false],
  ["mobile-scrolled", phone, "/?when=week", false, async (p) => p.evaluate(() => window.scrollTo(0, 700))],
  ["mobile-filtered", phone, "/?when=week&cat=music&price=20&time=evening&wkend=1", false],
  ["mobile-sheet", phone, "/?when=week&cat=music", false, openSheet],
  ["mobile-sheet-lower", phone, "/?when=week&cat=music", false, async (p) => { await openSheet(p); await p.evaluate(() => document.querySelector(".sheet-body").scrollTo(0, 700)); }],
  ["mobile-custom-sheet", phone, "/?when=custom&from=__DAY2__&to=__DAY6__", false, openSheet],
  ["mobile-login", phone, "/login", false],
  ["mobile-menu", phone, "/?when=week", false, async (p) => { await p.click(".event .ev-menu > summary"); await p.waitForTimeout(150); }],
  ["mobile-saved-nudge", phone, "/?when=week", false, async (p) => { await p.click(".event .save"); await p.waitForTimeout(300); }],
  ["mobile-event-page", phone, "/e/__FIRST__", false],
  ["mobile-calendar-open", phone, "/?when=custom", false, async (p) => { await openSheet(p); }],
  ["mobile-calendar-picking", phone, "/?when=custom&from=__DAY2__&to=__DAY2__&pick=1", false, async (p) => { await openSheet(p); }],
  ["mobile-calendar-picked", phone, "/?when=custom&from=__DAY2__&to=__DAY6__", false, async (p) => { await openSheet(p); }],
  ["mobile-where", phone, "/?when=week&hood=Lower%20West%20Side", false, async (p) => { await openSheet(p); await p.evaluate(() => document.querySelector(".hood-field").scrollIntoView()); }],
  ["mobile-suggest", phone, "/?when=week", false, async (p) => { await p.fill("#q", "pil"); await p.waitForTimeout(800); }],
  ["mobile-search", phone, "/?when=week&q=jazz", false],
  ["mobile-pilsen", phone, "/?when=week&q=pilsen", false],
];

const dayN = (n) => new Date(Date.now() + n * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const browser = await chromium.launch();
for (const [name, viewport, path, fullPage, action] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  let url = path.replace("__DAY2__", dayN(2)).replace("__DAY4__", dayN(4)).replace("__DAY6__", dayN(6));
  if (url.includes("__FIRST__")) {
    const j = await (await fetch(base + "/api/events?when=week")).json();
    url = url.replace("__FIRST__", j.events?.[0]?.id ?? "none");
  }
  await page.goto(base + url, { waitUntil: "networkidle" });
  if (action) await action(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70, fullPage });
  await page.close();
}
await browser.close();
console.log("saved", shots.length, "screenshots to", out);
