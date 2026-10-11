// Gera o SVG do mapa do tesouro (o mesmo componente do app) em 6 estados para o vídeo.
//   npx tsx docs/video/mapa.tsx
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { TreasureMap, type TreasureWeek } from "../../src/components/daily/treasure-map";

const out: string[] = [];
for (let k = 0; k <= 5; k++) {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: `2026-10-${12 + i}`, done: i < k, today: i === Math.min(k, 5) && k < 5, past: i < k }));
  const w: TreasureWeek = { week: "2026-10-12", goal: 5, done: k, opened: k === 5, days };
  const html = renderToStaticMarkup(<TreasureMap w={w} />);
  const svg = html.match(/<svg[\s\S]*<\/svg>/)![0];
  out.push(svg);
}
writeFileSync(new URL("./mapa/estados.js", import.meta.url), `window.MAPAS = ${JSON.stringify(out)};\n`);
console.log("ok");
