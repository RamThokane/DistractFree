"""Build the soundtrack: original synthesized score + SFX + Kokoro voiceover, ducked and mixed.

Writes mix.wav (48 kHz stereo) plus vo_stem.wav / bed_stem.wav for verification.
"""
import sys, json, subprocess, os
import numpy as np, soundfile as sf
import imageio_ffmpeg
from timeline import VO, TOTAL

FF = imageio_ffmpeg.get_ffmpeg_exe()
VODIR, OUT = sys.argv[1], sys.argv[2]
SR = 48000
N = int(TOTAL * SR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
def m(name):  # "D3", "A#2"
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]

def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    # vectorised enough for our lengths via lfilter-like loop in chunks
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y

def lp_fft(x, fc, order=2):
    """Zero-phase Butterworth-shaped low-pass in the frequency domain."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** (2 * order)), len(x))

def hp_fft(x, fc, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    f[0] = 1e-6
    return np.fft.irfft(X / np.sqrt(1 + (fc / f) ** (2 * order)), len(x))

def env_adsr(n, a, r, sustain_len):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na) ** 2
    rel_start = min(n, na + int(sustain_len * SR))
    tail = n - rel_start
    if tail > 0:
        e[rel_start:] *= np.exp(-np.linspace(0, 5, tail)) if nr else 0
    return e

L = np.zeros(N); R = np.zeros(N)
def add(sig, t0, gain=1.0, pan=0.0, buf=None):
    i0 = int(t0 * SR)
    if i0 >= N: return
    sig = sig[: N - i0]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    (buf or (L, R))[0][i0:i0 + len(sig)] += sig * gain * gl * 1.4142
    (buf or (L, R))[1][i0:i0 + len(sig)] += sig * gain * gr * 1.4142

# ── Instruments ───────────────────────────────────────
def pad(notes, t0, dur, cutoff=1200, gain=0.06, attack=1.6, release=2.2):
    n = int((dur + release) * SR); tt = np.arange(n) / SR
    for side, pan in ((-1, -0.6), (1, 0.6)):
        sig = np.zeros(n)
        for nn in notes:
            f0 = hz(m(nn))
            for det in (-7, 0, 7):
                f = f0 * 2 ** ((det + side * 2) / 1200)
                ph = rng.uniform(0, 2 * np.pi)
                for h in range(1, 7):
                    if f * h > 6000: break
                    sig += np.sin(2 * np.pi * f * h * tt + ph * h) / (h ** 1.15)
        sig = lp_fft(sig, cutoff)
        e = np.ones(n); na = int(attack * SR); e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
        nr = int(release * SR); e[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
        add(sig * e / (len(notes) * 3), t0, gain, pan)

def piano(note, t0, vel=1.0, pan=0.0, length=3.5):
    n = int(length * SR); tt = np.arange(n) / SR
    f0 = hz(m(note)); sig = np.zeros(n)
    for h in range(1, 8):
        f = f0 * h * (1 + 0.0004 * h * h)  # slight inharmonicity
        if f > 9000: break
        sig += np.sin(2 * np.pi * f * tt) * np.exp(-tt * (0.9 + 0.55 * h ** 1.1)) / h ** 1.25
    att = int(0.004 * SR); sig[:att] *= np.linspace(0, 1, att)
    sig[-int(0.2 * SR):] *= np.linspace(1, 0, int(0.2 * SR))
    sig = lp_fft(sig, 2600 + 2400 * vel)
    add(sig, t0, 0.16 * vel, pan)

def bell(note, t0, gain=0.08, pan=0.0, length=2.5):
    n = int(length * SR); tt = np.arange(n) / SR; f0 = hz(m(note)); sig = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.6), (2.76, 0.4, 3.2), (5.4, 0.18, 5.0), (8.93, 0.08, 7.0)):
        sig += amp * np.sin(2 * np.pi * f0 * ratio * tt) * np.exp(-tt * dec)
    sig[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    add(sig, t0, gain, pan)

# ── Score ─────────────────────────────────────────────
SCORE = 0  # marker
# 1 · Problem (0–10.4): dark, filtered D minor add9 bed
pad(["D2", "A2", "D3", "F3", "E4"], 0.0, 9.6, cutoff=650, gain=0.07, attack=2.2, release=1.6)
for t0, nn in ((2.4, "A4"), (6.0, "G#4")):          # sparse, slightly uneasy piano
    piano(nn, t0, 0.45, pan=0.3)
# 2 · Turning point (10.4–19.6): opens up
pad(["A#1", "A#2", "D3", "F3", "A3"], 10.2, 4.8, cutoff=1100, gain=0.075, attack=1.4, release=1.8)
pad(["C2", "C3", "E3", "G3", "D4"], 15.0, 4.4, cutoff=1500, gain=0.08, attack=1.2, release=1.6)
for t0, nn, v in ((13.4, "F4", 0.5), (14.9, "A4", 0.55), (16.4, "C5", 0.6), (17.9, "D5", 0.6)):
    piano(nn, t0, v, pan=0.2)
# 3 · In action (19.6–31.8): gentle eighth-note arpeggios, F – C – Dm – Bb
EIGHTH = 60 / 84 / 2
ARP = [("F", ["F3", "C4", "A4", "C5"]), ("C", ["C3", "G3", "E4", "G4"]),
       ("Dm", ["D3", "A3", "F4", "A4"]), ("Bb", ["A#2", "F3", "D4", "F4"])]
t = 19.6
for bar in range(4):
    name, notes = ARP[bar]
    root = notes[0]
    pad([root[:-1] + str(int(root[-1]) - 1), *notes[:3]], t, 3.05, cutoff=1700, gain=0.055, attack=0.8, release=1.4)
    for k in range(int(3.05 / EIGHTH)):
        nn = notes[[1, 2, 3, 2][k % 4]]
        piano(nn, t + k * EIGHTH, 0.33 + 0.08 * (k % 4 == 0), pan=(-0.25 if k % 2 else 0.25), length=2.0)
    t += 3.05
# 4 · Result (31.8–44.6): warmer, fuller — Bb – F – Gm7 – C
PROG = [(["A#1", "A#2", "D3", "F3", "A3"], ["D5", "F5"]), (["F1", "F2", "C3", "A3", "C4"], ["C5", "A4"]),
        (["G1", "G2", "D3", "F3", "A#3"], ["A#4", "D5"]), (["C2", "C3", "G3", "E4", "G4"], ["E5", "G5"])]
t = 31.8
for chord, mel in PROG:
    pad(chord, t, 3.2, cutoff=2100, gain=0.07, attack=0.9, release=1.6)
    piano(chord[2], t, 0.42, pan=-0.3, length=3.0)
    piano(mel[0], t + 0.8, 0.5, pan=0.25); piano(mel[1], t + 2.0, 0.45, pan=0.25)
    t += 3.2
# 5 · Brand ending (44.6–50.5): resolve to F major add9, bell on the logo
pad(["F1", "F2", "C3", "A3", "G4"], 44.6, 4.2, cutoff=1800, gain=0.085, attack=0.6, release=1.7)
piano("F3", 44.9, 0.55, -0.2, 5.0); piano("C4", 45.0, 0.5, 0.0, 5.0); piano("A4", 45.1, 0.5, 0.2, 5.0)
bell("C6", 45.2, 0.05, 0.15); bell("F6", 45.35, 0.035, -0.15)

music_L, music_R = L.copy(), R.copy()

# ── Reverb on the score (synthetic stereo IR) ─────────
def reverb(x, seed):
    r = np.random.default_rng(seed)
    n = int(2.8 * SR); tt = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-tt / 0.55)
    ir = lp_fft(ir, 5000); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
music_L = music_L * 0.75 + reverb(music_L, 1) * 0.5
music_R = music_R * 0.75 + reverb(music_R, 2) * 0.5

# ── SFX (dry) ─────────────────────────────────────────
L[:] = 0; R[:] = 0
def buzz(t0, gain=0.22):
    n = int(0.62 * SR); tt = np.arange(n) / SR
    motor = np.sign(np.sin(2 * np.pi * 172 * tt)) * 0.6 + np.sin(2 * np.pi * 344 * tt) * 0.3
    rattle = hp_fft(rng.standard_normal(n), 900) * 0.25
    sig = lp_fft(motor + rattle, 2200)
    gate = ((tt < 0.24) | ((tt > 0.36) & (tt < 0.6))).astype(float)
    gate = np.convolve(gate, np.ones(240) / 240, mode="same")
    add(sig * gate, t0, gain, pan=-0.15)

def tick(t0, gain, pitch):
    n = int(0.03 * SR); tt = np.arange(n) / SR
    sig = hp_fft(rng.standard_normal(n), pitch) * np.exp(-tt * 220)
    add(sig, t0, gain, pan=0.35)

def whoosh(t0, dur=1.1, gain=0.06):
    n = int(dur * SR); x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    x = np.fft.irfft(X * np.exp(-((np.log(f + 1) - np.log(1800)) ** 2) / 0.8), n)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    add(x * e / np.max(np.abs(x)), t0, gain)

def blip(t0, gain=0.05):
    for k, nn in enumerate(("A5", "E6")):
        n = int(0.25 * SR); tt = np.arange(n) / SR
        add(np.sin(2 * np.pi * hz(m(nn)) * tt) * np.exp(-tt * 18), t0 + k * 0.07, gain, pan=-0.4)

def thump(t0, gain=0.25):
    n = int(1.4 * SR); tt = np.arange(n) / SR
    f = 62 * np.exp(-tt * 1.2) + 40
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2), t0, gain)

buzz(1.6); buzz(3.25, 0.2); buzz(6.3, 0.14)
for k in range(int(10.0 / 0.5)):                      # clock ticking under the distraction
    tick(0.25 + k * 0.5, 0.05 if k % 2 == 0 else 0.035, 3800 if k % 2 == 0 else 3000)
whoosh(9.7)
blip(19.9); blip(23.2, 0.04)
bell("C6", 28.6, 0.06, -0.3); bell("E6", 28.67, 0.05, -0.3); bell("G6", 28.74, 0.045, -0.3)
thump(44.95, 0.18)
sfx_L, sfx_R = L.copy(), R.copy()

# ── Voiceover ─────────────────────────────────────────
vo = np.zeros(N)
speech = np.zeros(N, dtype=bool)
lines = json.load(open(f"{VODIR}/lines.json"))
for ln in lines:
    i = ln["line"]
    wav48 = f"{OUT}/_vo{i}_48k.wav"
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", f"{VODIR}/line{i}.wav", "-ar", str(SR), "-ac", "1", wav48], check=True)
    x, _ = sf.read(wav48)
    x = hp_fft(x, 75)
    i0 = int(VO[i] * SR)
    vo[i0:i0 + len(x)] += x[: N - i0]
    speech[max(0, i0 - int(0.25 * SR)): min(N, i0 + len(x) + int(0.35 * SR))] = True
vo *= 10 ** (-3 / 20) / np.max(np.abs(vo))

# ── Ducking envelope for the score ────────────────────
duck = np.where(speech, 0.36, 1.0)
k = int(0.35 * SR); duck = np.convolve(duck, np.ones(k) / k, mode="same")

def rms(x, mask=None):
    x = x if mask is None else x[mask]
    return np.sqrt(np.mean(x ** 2) + 1e-12)

vo_rms = rms(vo, speech)
music_mono = (music_L + music_R) / 2
music_gain = vo_rms * 10 ** (-13.0 / 20) / rms(music_mono, music_mono != 0)
sfx_gain = music_gain * 1.2

bed_L = music_L * music_gain * duck + sfx_L * sfx_gain * np.sqrt(duck)
bed_R = music_R * music_gain * duck + sfx_R * sfx_gain * np.sqrt(duck)
# final fade-out of the bed
fade = np.ones(N); nf = int(1.6 * SR); fade[-nf:] = np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
bed_L *= fade; bed_R *= fade

mix = np.stack([vo + bed_L, vo + bed_R], axis=1)
peak = np.max(np.abs(mix))
if peak > 0.97: mix *= 0.97 / peak; vo *= 0.97 / peak; bed_L *= 0.97 / peak; bed_R *= 0.97 / peak
sf.write(f"{OUT}/mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{OUT}/vo_stem.wav", vo.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{OUT}/bed_stem.wav", np.stack([bed_L, bed_R], 1).astype(np.float32), SR, subtype="FLOAT")

db = lambda v: 20 * np.log10(v + 1e-12)
bed_mono = (bed_L + bed_R) / 2
print(f"VO RMS during speech      {db(rms(vo, speech)):6.1f} dBFS")
print(f"Bed RMS during speech     {db(rms(bed_mono, speech)):6.1f} dBFS")
print(f"Bed RMS between lines     {db(rms(bed_mono, ~speech)):6.1f} dBFS")
print(f"Speech-over-bed margin    {db(rms(vo, speech)) - db(rms(bed_mono, speech)):6.1f} dB")
