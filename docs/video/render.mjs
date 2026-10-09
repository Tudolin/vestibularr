// Renderiza docs/video/apresentacao.html quadro a quadro e codifica em MP4 (H.264 + trilha).
//   node docs/video/render.mjs <saida.mp4> [fps] [trilha.wav]
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const [out = "vestibularr-apresentacao.mp4", fpsArg = "30", audio] = process.argv.slice(2);
const fps = Number(fpsArg);
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(new URL("./apresentacao.html", import.meta.url).href);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.ceil(duration * fps);

const args = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
if (audio) args.push("-i", audio, "-c:a", "aac", "-b:a", "160k", "-shortest");
args.push("-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });

for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 10) === 0) console.log(`${(i / fps).toFixed(0)} s / ${duration.toFixed(0)} s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("pronto:", out);
