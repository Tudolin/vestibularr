// Gera capturas de tela do design system (dev server em :3100). Uso: node scripts/shots.mjs
import { chromium } from "@playwright/test";

const out = "docs/screenshots/fase-1";
const exe = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe });
const targets = [
  ["design", "/design"],
  ["login", "/login"],
];
const viewports = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
for (const [name, path] of targets) {
  for (const [vp, size] of Object.entries(viewports)) {
    for (const scheme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: size, colorScheme: scheme, deviceScaleFactor: vp === "mobile" ? 2 : 1 });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${out}/${name}-${vp}-${scheme}.png`, fullPage: name === "design" && vp === "desktop" ? false : false });
      await ctx.close();
    }
  }
}
await browser.close();
