"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Som ambiente gerado no navegador (sem baixar áudio): ruído branco, rosa ou marrom em loop. */
export type Noise = "branco" | "rosa" | "marrom";

function buffer(ctx: AudioContext, kind: Noise) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "branco") d[i] = w * 0.5;
    else if (kind === "rosa") {
      // filtro de Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

export function useNoise(kind: Noise, volume: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    try { srcRef.current?.stop(); } catch {}
    srcRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    // o navegador só libera áudio a partir de um toque/clique do usuário: por isso nunca toca sozinho
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume();
    try { srcRef.current?.stop(); } catch {}
    const gain = gainRef.current ?? ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, kind);
    src.loop = true;
    src.connect(gain);
    src.start();
    srcRef.current = src;
    setPlaying(true);
  }, [kind, volume]);

  // volume ao vivo
  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = volume; }, [volume]);
  // trocou o tipo tocando: troca o som
  const kindRef = useRef(kind);
  useEffect(() => {
    if (kindRef.current !== kind && srcRef.current) play();
    kindRef.current = kind;
  }, [kind, play]);
  useEffect(() => () => { try { srcRef.current?.stop(); } catch {} void ctxRef.current?.close(); }, []);

  return { playing, play, stop };
}

/** "Plim" curto ao terminar uma etapa do pomodoro. */
export function chime() {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.65);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {}
}
