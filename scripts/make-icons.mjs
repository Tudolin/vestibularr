// Gera os ícones do PWA a partir de um SVG (capelo sobre fundo índigo). Uso: node scripts/make-icons.mjs
import sharp from "sharp";
const svg = (pad) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#4f46e5"/>
  <g transform="translate(256 262) scale(${pad ? 0.62 : 0.78}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M56 208 256 120l200 88-200 88z"/>
    <path d="M136 244v84c0 30 54 60 120 60s120-30 120-60v-84"/>
    <path d="M456 208v104"/>
  </g></svg>`);
for (const [name, size, pad] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, false]]) {
  await sharp(svg(pad)).resize(size, size).png().toFile(`public/icons/${name}`);
}
await sharp(svg(false)).resize(32, 32).png().toFile("public/icons/favicon-32.png");
console.log("ícones gerados");
