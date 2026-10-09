"""Trilha ambiente do vídeo (gerada, sem direitos autorais): pad de acordes + arpejo suave.
   python3 docs/video/trilha.py saida.wav [duracao_s]"""
import sys, wave
import numpy as np

SR = 44100
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 126.2
n = int(SR * dur)
t = np.arange(n) / SR
f = lambda midi: 440.0 * 2 ** ((midi - 69) / 12)

# progressão (C maior): Cmaj9, Am7, Fmaj7, G6 — 4 s cada
chords = [[48, 55, 64, 67, 71, 74], [45, 52, 60, 64, 67, 72], [41, 48, 57, 60, 64, 69], [43, 50, 59, 62, 64, 71]]
CH = 4.0
pad = np.zeros(n)
for i in range(int(np.ceil(dur / CH)) + 1):
    notes = chords[i % 4]
    s0 = i * CH - 0.6
    seg = (t >= s0) & (t < s0 + CH + 1.2)
    tt = t[seg] - s0
    env = np.minimum(1, tt / 1.0) * np.minimum(1, np.maximum(0, (CH + 1.2 - tt) / 1.0))
    for k, m in enumerate(notes):
        fr = f(m)
        amp = 0.16 if k == 0 else 0.07
        voice = sum(np.sin(2 * np.pi * fr * d * tt + k) for d in (1.0, 1.0035, 0.9965)) / 3
        voice += 0.25 * np.sin(2 * np.pi * 2 * fr * tt)  # 2º harmônico suave
        pad[seg] += amp * env * voice

# arpejo: colcheias a 100 bpm, notas do acorde, decaimento exponencial
arp = np.zeros(n)
step = 60 / 100 / 2
for j in range(int(dur / step)):
    s0 = j * step
    notes = chords[int(s0 // CH) % 4]
    m = notes[2 + (j % 4)] + 12
    seg = (t >= s0) & (t < s0 + 1.2)
    tt = t[seg] - s0
    arp[seg] += 0.05 * np.exp(-tt * 5) * (np.sin(2 * np.pi * f(m) * tt) + 0.3 * np.sin(2 * np.pi * 2 * f(m) * tt))
arp *= np.clip((t - 7) / 3, 0, 1) * np.clip((dur - 6 - t) / 3, 0, 1)  # arpejo só no miolo

mix = pad + arp
# eco simples (ambiência)
d = int(0.33 * SR)
mix[d:] += 0.28 * mix[:-d]
mix *= np.clip(t / 2.5, 0, 1) * np.clip((dur - t) / 4.0, 0, 1)
mix = mix / np.max(np.abs(mix)) * 0.32
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print("ok", sys.argv[1], f"{dur:.1f}s")
