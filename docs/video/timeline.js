// Roteiro do vídeo de apresentação (≈126 s). Coordenadas das telas medidas no app real (viewport 1440×900).
(() => {
  const { tw, type, count, scene, hook } = window.MD;

  // ---------- utilitários de posição
  // moldura de navegador: left, top, width → converte coordenada CSS da tela (1440 de largura) para o palco
  const frame = (L, T, W) => (x, y, pan = 0) => [L + x * (W / 1440), T + 46 + (y - pan) * (W / 1440)];
  const ring = (sel, t0, t1, [x, y], w, h, s, pad = 10) => {
    const el = document.querySelector(sel);
    el.style.left = `${x - pad}px`; el.style.top = `${y - pad}px`;
    el.style.width = `${w * s + pad * 2}px`; el.style.height = `${h * s + pad * 2}px`;
    tw(el, t0, 0.5, { from: { opacity: 0, scale: 1.12 }, to: { opacity: 1, scale: 1 } }, "back");
    tw(el, t1 - 0.3, 0.3, { to: { opacity: 0 } }, "in");
  };
  // cursor: lista de [t, x, y, clique?]
  const cur = document.getElementById("cur"), rip = document.getElementById("rip");
  const path = [];
  const move = (t, x, y, click = false) => path.push({ t, x, y, click });
  hook((t) => {
    if (!path.length) return;
    let a = path[0], b = path[0];
    for (let i = 0; i < path.length; i++) { if (path[i].t <= t) { a = path[i]; b = path[i + 1] ?? path[i]; } }
    if (t < path[0].t) { cur.style.opacity = 0; rip.style.opacity = 0; return; }
    const p = b === a ? 1 : Math.min(1, (t - a.t) / Math.max(0.001, b.t - a.t));
    const e = MD.E.inOut(p);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    const vis = a.hide ? 0 : 1;
    cur.style.transform = `translate(${x}px, ${y}px)`; cur.style.opacity = vis;
    // clique: anel que cresce por 0,5 s
    const c = path.filter((k) => k.click && t >= k.t && t < k.t + 0.55).pop();
    if (c) { const q = (t - c.t) / 0.55; rip.style.transform = `translate(${c.x + 6}px, ${c.y + 6}px) scale(${0.4 + q * 1.2})`; rip.style.opacity = 1 - q; }
    else rip.style.opacity = 0;
  });
  const hideCursor = (t) => path.push({ t, x: path.at(-1)?.x ?? 960, y: path.at(-1)?.y ?? 540, hide: true });

  // ---------- capítulos
  const CH = [[0, 7.5], [7, 16], [15.5, 24.5], [24, 32.5], [32, 42], [41.5, 52.5], [52, 63], [62.5, 70.5], [70, 80.5], [80, 90.5], [90, 98.5], [98, 110], [109.5, 120], [119.5, 126]];
  const bar = document.getElementById("chapters");
  CH.forEach(() => { const s = document.createElement("span"); s.appendChild(document.createElement("i")); bar.appendChild(s); });
  hook((t) => {
    [...bar.children].forEach((s, i) => { const [a, b] = CH[i]; s.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, (t - a) / (b - a)))})`; });
    bar.style.opacity = t < 6.5 || t > 120 ? 0 : 1;
  });

  // ---------- 1. abertura (0–7,5)
  scene("#s1", 0, 7.5, { inDur: 0.01 });
  tw("#s1b1", 0, 7.5, { from: { x: -40, y: -20, scale: 0.9 }, to: { x: 80, y: 60, scale: 1.1 } }, "linear");
  tw("#s1b2", 0, 7.5, { from: { x: 40, y: 30 }, to: { x: -90, y: -50 } }, "linear");
  tw("#s1logo", 0.3, 1.1, { from: { opacity: 0, scale: 0.3, rot: -18 }, to: { opacity: 1, scale: 1, rot: 0 } }, "back");
  tw("#s1t", 1.0, 0.9, { from: { opacity: 0, y: 50, blur: 12 }, to: { opacity: 1, y: 0, blur: 0 } });
  tw("#s1s", 1.7, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });
  tw("#s1c", 2.4, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });
  tw("#s1logo", 6.6, 0.8, { to: { scale: 0.85, y: -20, opacity: 0 } }, "in");

  // ---------- 2. números (7–16)
  scene("#s2", 7, 16);
  tw("#s2k", 7.3, 0.6, { from: { opacity: 0, x: -30 }, to: { opacity: 1, x: 0 } });
  tw("#s2h", 7.5, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });
  ["#s2a", "#s2b", "#s2c", "#s2d"].forEach((s, i) => tw(s, 8.4 + i * 0.25, 0.9, { from: { opacity: 0, y: 80, scale: 0.92 }, to: { opacity: 1, y: 0, scale: 1 } }, "back"));
  count("#s2n1", 8.6, 2.2, 0, 1088);
  ["#s2a", "#s2b", "#s2c", "#s2d"].forEach((s, i) => tw(s, 11.5 + i * 0.6, 0.5, { to: { y: -14 } }, "out"));
  ["#s2a", "#s2b", "#s2c", "#s2d"].forEach((s, i) => tw(s, 12.0 + i * 0.6, 0.5, { to: { y: 0 } }, "out"));

  // ---------- 3. entrar / convite (15,5–24,5)
  scene("#s3", 15.5, 24.5);
  tw("#s3w", 15.6, 1, { from: { opacity: 0, x: 120, scale: 0.94 }, to: { opacity: 1, x: 0, scale: 1 } });
  tw("#s3cap", 16.2, 0.8, { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 } });
  tw("#s3p", 18.6, 1.0, { from: { opacity: 0, y: 160, rot: 6 }, to: { opacity: 1, y: 0, rot: -3 } }, "back");
  tw("#s3w", 18.6, 1.0, { to: { x: -120, scale: 0.92, opacity: 0.85 } });

  // ---------- 4. início (24–32,5)
  scene("#s4", 24, 32.5);
  tw("#s4w", 24.1, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s4cap", 24.6, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  { const f = frame(700, 90, 1140), s = 1140 / 1440;
    ring("#s4 .r1", 26, 28.4, f(368, 112), 472, 224, s);
    ring("#s4 .r2", 27.2, 29.6, f(856, 112), 472, 224, s);
    ring("#s4 .r3", 28.6, 31.6, f(368, 578), 960, 90, s); }

  // ---------- 5. estudar (32–42)
  scene("#s5", 32, 42);
  tw("#s5w", 32.1, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s5cap", 32.6, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  { const f = frame(700, 90, 1140);
    tw("#s5img2", 32, 0.01, { from: { opacity: 0 }, to: { opacity: 0 } });
    move(33.6, 1500, 950); move(35.4, ...f(600, 615)); move(36.0, ...f(600, 615), true);
    tw("#s5img2", 36.3, 0.6, { from: { opacity: 0, x: 80 }, to: { opacity: 1, x: 0 } });
    tw("#s5img1", 36.3, 0.6, { to: { opacity: 0, x: -80 } });
    move(37.4, ...f(465, 311)); move(38.1, ...f(465, 311), true); hideCursor(38.9); }

  // ---------- 6. prova (41,5–52,5)
  scene("#s6", 41.5, 52.5);
  tw("#s6w", 41.6, 1.1, { from: { opacity: 0, scale: 0.9 }, to: { opacity: 1, scale: 1 } });
  { const f = frame(160, 70, 1600), s = 1600 / 1440;
    ring("#s6r1", 43.2, 46.2, f(1040, 14), 80, 32, s, 12);
    move(46.4, ...f(500, 640)); move(47.3, ...f(400, 676)); move(47.8, ...f(400, 676), true);
    ring("#s6r2", 48.4, 51.6, f(968, 77), 304, 760, s, 8); hideCursor(49.5); }
  tw("#s6cap", 44.4, 0.8, { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 } });
  tw("#s6cap", 48.0, 0.5, { to: { opacity: 0, y: 30 } }, "in");

  // ---------- 7. treino no celular (52–63)
  scene("#s7", 52, 63);
  tw("#s7cap", 52.4, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  tw("#s7p1", 52.2, 1.0, { from: { opacity: 0, y: 120, rot: -4 }, to: { opacity: 1, y: 0, rot: -3 } }, "back");
  tw("#s7p2", 53.0, 1.0, { from: { opacity: 0, y: 120, rot: 4 }, to: { opacity: 1, y: 0, rot: 2 } }, "back");
  // a imagem do feedback tem 7020 px a 3x (390 css) → na tela do celular (368 px) altura ≈ 2208 px; janela ≈ 814 px
  tw("#s7img", 54.5, 2.6, { from: { y: 0 }, to: { y: -560 } }, "inOut");
  tw("#s7img", 57.8, 3.6, { to: { y: -1395 } }, "inOut");
  tw("#s7p1", 56.5, 1, { to: { opacity: 0.35, scale: 0.94 } });

  // ---------- 8. caderno de erros (62,5–70,5)
  scene("#s8", 62.5, 70.5);
  tw("#s8w", 62.6, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s8cap", 63.0, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  [...document.querySelectorAll("#s8days .chip")].forEach((c, i) => tw(c, 64.2 + i * 0.3, 0.6, { from: { opacity: 0, y: 30, scale: 0.6 }, to: { opacity: 1, y: 0, scale: 1 } }, "back"));
  { const f = frame(700, 90, 1140); move(66.2, 1500, 980); move(67.6, ...f(1210, 217)); move(68.2, ...f(1210, 217), true); hideCursor(69.0); }

  // ---------- 9. redação (70–80,5)
  scene("#s9", 70, 80.5);
  tw("#s9w", 70.1, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s9cap", 70.6, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  // rola a correção (página com 1995 px de altura → até ≈ 1100 px)
  tw("#s9img", 72.5, 5.5, { from: { y: 0 }, to: { y: -(window.REDACAO_PAN ?? 900) } }, "inOut");
  tw("#s9p", 74.2, 1.1, { from: { opacity: 0, y: 140, rot: 8 }, to: { opacity: 1, y: 0, rot: 4 } }, "back");

  // ---------- 10. desempenho (80–90,5)
  scene("#s10", 80, 90.5);
  tw("#s10w", 80.1, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s10cap", 80.6, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  tw("#s10img2", 80, 0.01, { from: { opacity: 0 }, to: { opacity: 0 } });
  { const f = frame(700, 90, 1140), s = 1140 / 1440;
    ring("#s10 .r1", 82.2, 84.6, f(935, 232), 393, 338, s);
    ring("#s10 .r2", 84.8, 87.0, f(368, 594), 472, 300, s);
    tw("#s10img2", 87.0, 0.7, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
    tw("#s10img1", 87.0, 0.7, { to: { opacity: 0, y: -60 } }); }

  // ---------- 11. celular / PWA (90–98,5)
  scene("#s11", 90, 98.5);
  tw("#s11k", 90.4, 0.6, { from: { opacity: 0, x: -30 }, to: { opacity: 1, x: 0 } });
  tw("#s11h", 90.6, 0.8, { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 } });
  tw("#s11l", 91.1, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });
  tw("#s11p1", 90.6, 1.2, { from: { opacity: 0, y: 200, rot: -10 }, to: { opacity: 1, y: 0, rot: -4 } }, "back");
  tw("#s11p2", 91.2, 1.2, { from: { opacity: 0, y: 220, rot: 10 }, to: { opacity: 1, y: 0, rot: 5 } }, "back");
  tw("#s11p1", 92.5, 6, { to: { y: -18 } }, "inOut");
  tw("#s11p2", 92.5, 6, { to: { y: 16 } }, "inOut");

  // ---------- 12. admin (98–110)
  scene("#s12", 98, 110);
  tw("#s12w", 98.1, 1, { from: { opacity: 0, y: 60 }, to: { opacity: 1, y: 0 } });
  tw("#s12cap", 98.6, 0.8, { from: { opacity: 0, x: -40 }, to: { opacity: 1, x: 0 } });
  tw("#s12img2", 98, 0.01, { from: { opacity: 0 }, to: { opacity: 0 } });
  tw("#s12img3", 98, 0.01, { from: { opacity: 0 }, to: { opacity: 0 } });
  { const f = frame(700, 90, 1140), s = 1140 / 1440;
    move(99.6, 1500, 980); move(101.2, ...f(1268, 294)); move(101.8, ...f(1268, 294), true);
    tw("#s12img2", 102.1, 0.5, { from: { opacity: 0, scale: 0.98 }, to: { opacity: 1, scale: 1 } });
    move(103.2, ...f(720, 480)); move(103.8, ...f(720, 480), true); hideCursor(104.6);
    tw("#s12img3", 105.6, 0.6, { from: { opacity: 0, x: 80 }, to: { opacity: 1, x: 0 } });
    tw("#s12img2", 105.6, 0.6, { to: { opacity: 0 } });
    ring("#s12 .r1", 106.6, 109.6, f(368, 92), 960, 98, s); }

  // ---------- 13. passo a passo (109,5–120)
  scene("#s13", 109.5, 120);
  tw("#s13k", 109.8, 0.6, { from: { opacity: 0, x: -30 }, to: { opacity: 1, x: 0 } });
  tw("#s13h", 110.0, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });
  ["#st1", "#st2", "#st3", "#st4", "#st5"].forEach((s, i) => {
    tw(s, 110.9 + i * 1.3, 0.8, { from: { opacity: 0, x: -140 }, to: { opacity: 1, x: 0 } }, "back");
    tw(s + " .k", 110.9 + i * 1.3 + 0.3, 0.6, { from: { scale: 0.4, rot: -20 }, to: { scale: 1, rot: 0 } }, "back");
  });

  // ---------- 14. encerramento (119,5–126)
  scene("#s14", 119.5, 126.2, { outDur: 0.8 });
  tw("#s14b", 119.5, 6.5, { from: { scale: 0.8, opacity: 0.3 }, to: { scale: 1.15, opacity: 0.6 } }, "linear");
  tw("#s14logo", 119.9, 1.1, { from: { opacity: 0, scale: 0.3, rot: 18 }, to: { opacity: 1, scale: 1, rot: 0 } }, "back");
  tw("#s14t", 120.6, 0.9, { from: { opacity: 0, y: 50, blur: 12 }, to: { opacity: 1, y: 0, blur: 0 } });
  tw("#s14s", 121.3, 0.8, { from: { opacity: 0, y: 30 }, to: { opacity: 1, y: 0 } });

  window.DURATION = 126.2;
  window.seek(0);
})();
