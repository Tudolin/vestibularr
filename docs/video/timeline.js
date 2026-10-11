// Roteiro do vídeo de apresentação (≈112 s): a mensagem da marca + todas as funcionalidades, com o tom pirata.
(() => {
  const { tw, count, scene, hook } = window.MD;
  const $$ = (s) => [...document.querySelectorAll(s)];
  const pop = (sel, t, from = {}) => tw(sel, t, 0.7, { from: { opacity: 0, scale: 0.6, y: 30, ...from }, to: { opacity: 1, scale: 1, y: 0 } }, "back");
  const out = (sel, t) => tw(sel, t, 0.4, { to: { opacity: 0, scale: 0.92 } }, "in");
  const rise = (sel, t, d = 0.8) => tw(sel, t, d, { from: { opacity: 0, y: 50 }, to: { opacity: 1, y: 0 } });
  const float = (sel, t0, t1, amp = 10) => hook((t) => { if (t < t0 || t > t1) return; const el = document.querySelector(sel); el.style.translate = `0 ${Math.sin((t - t0) * 2.2) * amp}px`; });

  // ondas do mar sempre em movimento
  hook((t) => $$(".mar").forEach((el, i) => { el.style.backgroundPositionX = `${(t * (i % 2 ? -38 : 26)) % 160}px`; }));

  // ---------- capítulos
  const CH = [[0, 6.5], [6, 13.5], [13, 20.5], [20, 28.5], [28, 37.5], [37, 46], [45.5, 55], [54.5, 63], [62.5, 71], [70.5, 79.5], [79, 88.5], [88, 97.5], [97, 104.5], [104, 112]];
  const DARK = [1, 6, 10, 12];
  const bar = document.getElementById("chapters");
  CH.forEach(() => { const s = document.createElement("span"); s.appendChild(document.createElement("i")); bar.appendChild(s); });
  hook((t) => {
    [...bar.children].forEach((s, i) => { const [a, b] = CH[i]; s.firstChild.style.transform = `scaleX(${Math.max(0, Math.min(1, (t - a) / (b - a)))})`; });
    bar.style.opacity = t < 5.8 || t > 110.5 ? 0 : 1;
    const cur = CH.findIndex(([a, b]) => t >= a && t < b);
    bar.classList.toggle("dark", DARK.includes(cur));
  });

  // ---------- 1. abertura (0–6,5)
  scene("#s1", 0, 6.5, { inDur: 0.01 });
  tw("#s1masc", 0.2, 1.0, { from: { opacity: 0, scale: 0.2, rot: -25, y: 120 }, to: { opacity: 1, scale: 1, rot: 0, y: 0 } }, "back");
  tw("#s1masc", 1.2, 0.5, { to: { rot: -6 } }, "out"); tw("#s1masc", 1.7, 0.6, { to: { rot: 0 } }, "back");
  tw("#s1word", 0.9, 0.9, { from: { opacity: 0, y: 90, scale: 0.8 }, to: { opacity: 1, y: 0, scale: 1 } }, "back");
  pop("#s1bub", 1.9, { rot: 8 });
  ["#s1chips"].forEach((s) => rise(s, 2.6));
  tw("#s1masc", 5.7, 0.7, { to: { y: -40, opacity: 0, scale: 0.9 } }, "in");
  tw("#s1word", 5.8, 0.6, { to: { y: -30, opacity: 0 } }, "in");

  // ---------- 2. manifesto (6–13,5)
  scene("#s2", 6, 13.5);
  $$("#s2 .word").forEach((w, i) => tw(w, 6.4 + i * 0.16, 0.6, { from: { opacity: 0, y: 70, blur: 10 }, to: { opacity: 1, y: 0, blur: 0 } }, "back"));
  rise("#s2d", 9.2);
  tw("#s2masc", 9.6, 0.9, { from: { opacity: 0, x: 200, rot: 20 }, to: { opacity: 1, x: 0, rot: -4 } }, "back");
  tw("#s2c", 10.6, 0.5, { to: { scale: 1.04 } }, "out"); tw("#s2c", 11.1, 0.6, { to: { scale: 1 } }, "back");

  // ---------- 3. a bordo (13–20,5)
  scene("#s3", 13, 20.5);
  rise("#s3k", 13.2, 0.6); rise("#s3h", 13.35);
  ["#s3a", "#s3b", "#s3c", "#s3d"].forEach((s, i) => tw(s, 14.1 + i * 0.22, 0.9, { from: { opacity: 0, y: 120, scale: 0.85, rot: i % 2 ? 4 : -4 }, to: { opacity: 1, y: 0, scale: 1, rot: 0 } }, "back"));
  count("#s3n", 14.4, 2.0, 0, 1088);
  ["#s3a", "#s3b", "#s3c", "#s3d"].forEach((s, i) => { tw(s, 17 + i * 0.35, 0.4, { to: { y: -18 } }, "out"); tw(s, 17.4 + i * 0.35, 0.5, { to: { y: 0 } }, "back"); });

  // ---------- 4. triagem (20–28,5)
  scene("#s4", 20, 28.5);
  tw("#s4p", 20.2, 1.0, { from: { opacity: 0, y: 220, rot: 8 }, to: { opacity: 1, y: 0, rot: -2 } }, "back");
  tw("#s4cap", 20.5, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s4img", 23, 3.6, { from: { y: 0 }, to: { y: -900 } }, "inOut");
  pop("#s4b1", 21.8, { rot: -10 }); pop("#s4b2", 22.6, { rot: 10 });
  tw("#s4masc", 23.6, 0.8, { from: { opacity: 0, y: 120 }, to: { opacity: 1, y: 0 } }, "back");
  float("#s4b1", 22.5, 28.5); float("#s4b2", 23.3, 28.5, 8);

  // ---------- 5. desafio do dia (28–37,5)
  scene("#s5", 28, 37.5);
  tw("#s5p1", 28.2, 1.0, { from: { opacity: 0, y: 220 }, to: { opacity: 1, y: 0, rot: -3 } }, "back");
  tw("#s5p2", 28.6, 1.0, { from: { opacity: 0, y: 260 }, to: { opacity: 1, y: 0, rot: 3 } }, "back");
  tw("#s5cap", 28.5, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s5img1", 31.5, 2.4, { from: { y: 0 }, to: { y: -360 } }, "inOut");
  pop("#s5b", 30.2, { rot: -12 }); float("#s5b", 31, 37.5, 8);
  tw("#s5p2", 34.2, 0.5, { to: { scale: 1.06 } }, "out"); tw("#s5p2", 34.7, 0.6, { to: { scale: 1 } }, "back");

  // ---------- 6. Arr / Err (37–46)
  scene("#s6", 37, 46);
  tw("#s6p1", 37.2, 1.0, { from: { opacity: 0, y: 220 }, to: { opacity: 1, y: 0, rot: -3 } }, "back");
  tw("#s6cap", 37.5, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s6b", 38.8, 0.4, { from: { opacity: 0 }, to: { opacity: 1 } }, "out");
  pop("#s6arr", 39.1, { rot: -8 });
  tw("#s6p2", 40.4, 1.0, { from: { opacity: 0, y: 260 }, to: { opacity: 1, y: 0, rot: 3 } }, "back");
  pop("#s6err", 41.2, { rot: 8 });
  tw("#s6c", 42.6, 0.5, { from: { opacity: 0, y: 40 }, to: { opacity: 1, y: 0 } }, "out");
  out("#s6arr", 42.4);

  // ---------- 7. mapa do tesouro (45,5–55)
  scene("#s7", 45.5, 55);
  (window.MAPAS || []).forEach((svg, k) => { const el = document.getElementById(`m${k}`); if (el) el.innerHTML = svg; });
  rise("#s7k", 45.7, 0.6); rise("#s7h", 45.85);
  tw("#s7map", 46.1, 1.0, { from: { opacity: 0, y: 120, scale: 0.9 }, to: { opacity: 1, y: 0, scale: 1 } }, "back");
  rise("#s7coins", 46.6); rise("#s7t", 46.9);
  for (let k = 0; k <= 5; k++) {
    const t = 47.4 + k * 1.15;
    if (k === 0) tw("#m0", 46.1, 0.01, { from: { opacity: 1 }, to: { opacity: 1 } });
    // corte rápido (sem "fantasma" de dois navios): o novo estado entra em 0,1 s e o anterior sai junto
    else { tw(`#m${k}`, t, 0.1, { from: { opacity: 0 }, to: { opacity: 1 } }, "out"); tw(`#m${k - 1}`, t + 0.1, 0.01, { to: { opacity: 0 } }, "linear"); tw("#s7map", t, 0.12, { to: { scale: 1.012 } }, "out"); tw("#s7map", t + 0.12, 0.3, { to: { scale: 1 } }, "out"); }
    if (k >= 1) tw(`#c${k - 1}`, t, 0.6, { from: { opacity: 0, scale: 0.2, y: -60 }, to: { opacity: 1, scale: 1, y: 0 } }, "back");
    if (k < 1) for (let c = 0; c < 5; c++) tw(`#c${c}`, 46, 0.01, { from: { opacity: 0 }, to: { opacity: 0 } });
  }
  tw("#s7map", 53.2, 0.35, { to: { scale: 1.03 } }, "out"); tw("#s7map", 53.55, 0.5, { to: { scale: 1 } }, "back");
  pop("#s7prize", 53.3, { rot: 10 }); float("#s7prize", 54, 55, 6);

  // ---------- 8. simulados (54,5–63)
  scene("#s8", 54.5, 63);
  tw("#s8w", 54.7, 1.0, { from: { opacity: 0, x: 200, scale: 0.94 }, to: { opacity: 1, x: 0, scale: 1 } });
  tw("#s8cap", 55, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  pop("#s8b", 56.4, { rot: -8 }); float("#s8b", 57, 63, 7);
  tw("#s8w", 58, 4.5, { to: { scale: 1.04 } }, "inOut");

  // ---------- 9. desempenho (62,5–71)
  scene("#s9", 62.5, 71);
  tw("#s9w", 62.7, 1.0, { from: { opacity: 0, x: 200, scale: 0.94 }, to: { opacity: 1, x: 0, scale: 1 } });
  tw("#s9cap", 63, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s9img", 64.6, 5.2, { from: { y: 0 }, to: { y: -1500 } }, "inOut");
  pop("#s9b", 65.4, { rot: 8 }); float("#s9b", 66, 71, 7);

  // ---------- 10. redação (70,5–79,5)
  scene("#s10", 70.5, 79.5);
  tw("#s10p", 70.7, 1.0, { from: { opacity: 0, y: 220, rot: -8 }, to: { opacity: 1, y: 0, rot: 2 } }, "back");
  tw("#s10cap", 71, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s10img", 72.6, 5.6, { from: { y: 0 }, to: { y: -2400 } }, "inOut");
  pop("#s10b1", 72.2, { rot: -10 }); pop("#s10b2", 73.0, { rot: 10 }); pop("#s10b3", 73.8, { rot: -6 });
  float("#s10b1", 73, 79.5, 8); float("#s10b2", 73.8, 79.5, 7); float("#s10b3", 74.6, 79.5, 9);

  // ---------- 11. tripulação (79–88,5)
  scene("#s11", 79, 88.5);
  tw("#s11p1", 79.2, 1.0, { from: { opacity: 0, y: 220 }, to: { opacity: 1, y: 0, rot: -3 } }, "back");
  tw("#s11p2", 79.6, 1.0, { from: { opacity: 0, y: 260 }, to: { opacity: 1, y: 0, rot: 3 } }, "back");
  tw("#s11cap", 79.5, 0.9, { from: { opacity: 0, x: -80 }, to: { opacity: 1, x: 0 } });
  tw("#s11img2", 82, 4.5, { from: { y: 0 }, to: { y: -1400 } }, "inOut");
  pop("#s11vento", 81.2, { rot: -8 }); float("#s11vento", 82, 88.5, 8);
  $$("#s11tiers .chip").forEach((c, i) => tw(c, 82.6 + i * 0.3, 0.6, { from: { opacity: 0, y: 40, scale: 0.7 }, to: { opacity: 1, y: 0, scale: 1 } }, "back"));

  // ---------- 12. do seu jeito (88–97,5)
  scene("#s12", 88, 97.5);
  rise("#s12k", 88.2, 0.6); rise("#s12h", 88.35);
  ["#s12a", "#s12b", "#s12c", "#s12d"].forEach((s, i) => tw(s, 89 + i * 0.3, 0.9, { from: { opacity: 0, y: 160, rot: i % 2 ? 5 : -5 }, to: { opacity: 1, y: 0, rot: 0 } }, "back"));
  ["#s12a", "#s12b", "#s12c", "#s12d"].forEach((s, i) => { tw(s, 92.5 + i * 0.6, 0.4, { to: { y: -22, scale: 1.03 } }, "out"); tw(s, 92.9 + i * 0.6, 0.5, { to: { y: 0, scale: 1 } }, "back"); });

  // ---------- 13. preço (97–104,5)
  scene("#s13", 97, 104.5);
  tw("#s13a", 97.3, 0.9, { from: { opacity: 0, y: 70, scale: 0.9 }, to: { opacity: 1, y: 0, scale: 1 } }, "back");
  pop("#s13b", 98.4, { rot: -6 });
  rise("#s13c", 99.2); rise("#s13d", 100.6);

  // ---------- 14. agora é a sua vez (104–112)
  scene("#s14", 104, 112.2, { outDur: 0.9 });
  tw("#s14masc", 104.2, 1.0, { from: { opacity: 0, scale: 0.3, y: 160, rot: 20 }, to: { opacity: 1, scale: 1, y: 0, rot: 0 } }, "back");
  rise("#s14a", 104.9); tw("#s14b", 105.6, 1.0, { from: { opacity: 0, y: 80, scale: 0.85 }, to: { opacity: 1, y: 0, scale: 1 } }, "back");
  pop("#s14c", 106.8);
  hook((t) => { if (t < 107.5) return; const el = document.querySelector("#s14masc"); el.style.translate = `0 ${Math.abs(Math.sin((t - 107.5) * 3)) * -18}px`; });

  window.DURATION = 112.2;
})();
