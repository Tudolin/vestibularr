// Motor de motion design determinístico: tudo é função do tempo t (segundos).
// window.seek(t) posiciona a cena exatamente naquele instante (renderização quadro a quadro).
(() => {
  const tweens = []; // {el, prop, t0, t1, from, to, ease}
  const hooks = [];  // funções (t) => void (texto digitado, contadores…)
  const E = {
    linear: (x) => x,
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    spring: (x) => 1 - Math.cos(x * Math.PI * 4.5) * Math.exp(-x * 6),
  };
  const $ = (s) => (typeof s === "string" ? document.querySelector(s) : s);
  const DEF = { x: 0, y: 0, scale: 1, rot: 0, opacity: 1, blur: 0, clipR: 0, clipB: 0, clipL: 0, clipT: 0 };

  /** tw(el, t0, dur, {from:{...}, to:{...}}, ease) */
  function tw(sel, t0, dur, { from = {}, to = {} }, ease = "out") {
    const el = $(sel);
    if (!el) throw new Error("sem elemento: " + sel);
    const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const k of keys) {
      tweens.push({ el, prop: k, t0, t1: t0 + dur, from: k in from ? from[k] : null, to: k in to ? to[k] : null, ease: E[ease] || E.out });
    }
  }
  const hook = (fn) => hooks.push(fn);

  function valueAt(list, t) {
    // list: tweens do mesmo el+prop ordenados por t0
    let v = list[0].from ?? DEF[list[0].prop];
    for (const w of list) {
      const from = w.from ?? v;
      const to = w.to ?? from;
      if (t < w.t0) break;
      if (t >= w.t1) { v = to; continue; }
      const p = w.ease((t - w.t0) / (w.t1 - w.t0));
      return from + (to - from) * p;
    }
    return v;
  }

  let groups = null;
  function build() {
    groups = new Map();
    for (const w of tweens) {
      if (!groups.has(w.el)) groups.set(w.el, new Map());
      const m = groups.get(w.el);
      if (!m.has(w.prop)) m.set(w.prop, []);
      m.get(w.prop).push(w);
    }
    for (const m of groups.values()) for (const l of m.values()) l.sort((a, b) => a.t0 - b.t0);
  }

  window.seek = (t) => {
    if (!groups) build();
    for (const [el, m] of groups) {
      const v = { ...DEF };
      for (const [k, l] of m) v[k] = valueAt(l, t);
      el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale}) rotate(${v.rot}deg)`;
      el.style.opacity = v.opacity;
      el.style.filter = v.blur ? `blur(${v.blur}px)` : "";
      if (m.has("clipR") || m.has("clipB") || m.has("clipL") || m.has("clipT"))
        el.style.clipPath = `inset(${v.clipT}% ${v.clipR}% ${v.clipB}% ${v.clipL}% round 0px)`;
      el.style.visibility = v.opacity <= 0.001 ? "hidden" : "visible";
    }
    for (const h of hooks) h(t);
  };

  /** texto digitado */
  function type(sel, t0, dur, text) {
    const el = $(sel);
    hook((t) => {
      const n = Math.max(0, Math.min(text.length, Math.floor(((t - t0) / dur) * text.length)));
      el.textContent = text.slice(0, n);
      el.dataset.typing = t > t0 && t < t0 + dur + 0.6 ? "1" : "";
    });
  }
  /** contador numérico */
  function count(sel, t0, dur, a, b, fmt = (n) => Math.round(n).toLocaleString("pt-BR")) {
    const el = $(sel);
    hook((t) => {
      const p = E.out(Math.max(0, Math.min(1, (t - t0) / dur)));
      el.textContent = fmt(a + (b - a) * p);
    });
  }
  /** cena: entra com fade/slide, sai com fade */
  function scene(sel, t0, t1, { inDur = 0.6, outDur = 0.5 } = {}) {
    tw(sel, t0, inDur, { from: { opacity: 0 }, to: { opacity: 1 } }, "out");
    tw(sel, t1 - outDur, outDur, { to: { opacity: 0 } }, "in");
  }
  window.MD = { tw, hook, type, count, scene, E };
})();
