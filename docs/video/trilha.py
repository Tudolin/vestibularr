"""Trilha do vídeo (gerada, sem direitos autorais): clima de canção de marinheiro, moderna e animada.
   Ré dórico a 112 bpm: baixo pulsante, acordes em "stab", melodia de assobio, palmas e bumbo leve.
   python3 docs/video/trilha.py saida.wav [duracao_s]"""
import sys, wave
import numpy as np

SR = 44100
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 112.2
n = int(SR * dur)
t = np.arange(n) / SR
f = lambda midi: 440.0 * 2 ** ((midi - 69) / 12)
BPM = 112
beat = 60 / BPM
bar = 4 * beat

# Dm – C – Bb – C (1 compasso cada); acordes em tríade
chords = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]]
bass_root = [38, 36, 34, 36]

def env(tt, a, d):
    return np.minimum(1, tt / a) * np.exp(-tt / d)

def add(buf, s0, length, fn):
    i0 = int(s0 * SR); i1 = min(n, int((s0 + length) * SR))
    if i0 >= n or i1 <= i0: return
    tt = (np.arange(i0, i1) - i0) / SR
    buf[i0:i1] += fn(tt)

mix = np.zeros(n)
bars = int(np.ceil(dur / bar)) + 1
intro = 2 * bar          # só acordes no começo
outro_start = dur - 3 * bar

for b in range(bars):
    s = b * bar
    ch = chords[b % 4]; root = bass_root[b % 4]
    # acordes "stab" nos contratempos (estilo shanty moderno)
    for k in range(4):
        st = s + k * beat + beat / 2
        for m in ch:
            add(mix, st, 0.35, lambda tt, m=m: 0.045 * env(tt, 0.005, 0.12) * (np.sign(np.sin(2 * np.pi * f(m + 12) * tt)) * 0.35 + np.sin(2 * np.pi * f(m + 12) * tt)))
    # pad suave
    for m in ch:
        add(mix, s, bar + 0.3, lambda tt, m=m: 0.035 * np.minimum(1, tt / 0.4) * np.minimum(1, np.maximum(0, (bar + 0.3 - tt) / 0.4)) * np.sin(2 * np.pi * f(m) * tt))
    if s < intro - 0.01: continue
    # baixo: semínimas com oitava
    for k in range(4):
        m = root + (12 if k % 2 else 0)
        add(mix, s + k * beat, beat * 0.9, lambda tt, m=m: 0.16 * env(tt, 0.004, 0.22) * (np.sin(2 * np.pi * f(m) * tt) + 0.3 * np.sin(4 * np.pi * f(m) * tt)))
    if s >= outro_start: continue
    # bumbo nos tempos 1 e 3, palmas no 2 e 4
    for k in (0, 2):
        add(mix, s + k * beat, 0.25, lambda tt: 0.35 * np.exp(-tt * 18) * np.sin(2 * np.pi * (55 + 90 * np.exp(-tt * 30)) * tt))
    rng = np.random.default_rng(b)
    for k in (1, 3):
        noise = rng.standard_normal(int(0.2 * SR) + 16)
        add(mix, s + k * beat, 0.2, lambda tt, noise=noise: 0.09 * np.exp(-tt * 28) * noise[: len(tt)])
    # chimbal leve nas colcheias
    for k in range(8):
        noise = rng.standard_normal(int(0.06 * SR) + 16)
        add(mix, s + k * beat / 2, 0.06, lambda tt, noise=noise: 0.025 * np.exp(-tt * 70) * np.diff(np.concatenate([[0], noise[: len(tt)]])))

# melodia de assobio (motivo de 2 compassos, repetido com variação a partir do 3º ciclo)
motif = [(0, 62, 1), (1, 65, 0.5), (1.5, 67, 0.5), (2, 69, 1.5), (3.5, 67, 0.5), (4, 65, 1), (5, 64, 1), (6, 62, 2)]
motif2 = [(0, 69, 1), (1, 72, 0.5), (1.5, 71, 0.5), (2, 69, 1), (3, 67, 1), (4, 65, 1), (5, 67, 0.5), (5.5, 69, 0.5), (6, 62, 2)]
cyc = 0
s = intro + 2 * bar
while s + 2 * bar < outro_start:
    mot = motif if cyc % 2 == 0 else motif2
    for (bt, m, ln) in mot:
        st = s + bt * beat
        add(mix, st, ln * beat, lambda tt, m=m, ln=ln: 0.07 * np.minimum(1, tt / 0.03) * np.minimum(1, np.maximum(0, (ln * beat - tt) / 0.08))
            * np.sin(2 * np.pi * f(m + 12) * tt + 0.004 * f(m + 12) * np.sin(2 * np.pi * 5.5 * tt)))
    s += 4 * bar  # toca 2 compassos, descansa 2
    cyc += 1

# eco curto e mixagem
d = int(beat * 0.75 * SR)
mix[d:] += 0.22 * mix[:-d]
mix *= np.clip(t / 1.5, 0, 1) * np.clip((dur - t) / 3.0, 0, 1)
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.4) * 0.42
stereo = np.stack([mix, np.roll(mix, int(0.011 * SR))], axis=1)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print("ok", dur)
