"""Verify the exported film: streams, motion, audio presence/levels, loudness, and spoken narration."""
import sys, re, subprocess, io, os, difflib
import numpy as np, soundfile as sf
import imageio_ffmpeg
from PIL import Image

FF = imageio_ffmpeg.get_ffmpeg_exe()
MP4 = sys.argv[1]
SCRIPT = ("Every day, distractions compete for your attention. Every interruption makes it harder to get back "
          "into the flow. It's time to take back control of your focus. DistractFree helps you build better focus "
          "habits, reduce digital distractions, and turn consistent effort into meaningful progress. Start small. "
          "Learn from your habits. Make every focused session count. DistractFree. Make room for what matters.")

def ff(*a):
    return subprocess.run([FF, "-hide_banner", *a], capture_output=True)

print("== Container / streams")
info = ff("-i", MP4).stderr.decode(errors="replace")
for line in info.splitlines():
    if re.search(r"Duration|Stream #", line): print("  " + line.strip())
print(f"  File size: {os.path.getsize(MP4) / 1e6:.2f} MB")

print("== Motion (1 frame/s, mean abs difference between consecutive frames)")
raw = ff("-i", MP4, "-vf", "fps=1,scale=160:90,format=gray", "-f", "rawvideo", "-").stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(float)
diffs = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
print(f"  sampled frames: {len(frames)}, distinct (diff > 1.0): {(diffs > 1.0).sum() + 1}, "
      f"median diff {np.median(diffs):.1f}, max {diffs.max():.1f}")
# also check motion within a single shot (consecutive frames 0.2s apart at 3s)
raw2 = ff("-ss", "12.0", "-i", MP4, "-t", "1", "-vf", "fps=5,scale=160:90,format=gray", "-f", "rawvideo", "-").stdout
f2 = np.frombuffer(raw2, np.uint8).reshape(-1, 90, 160).astype(float)
print(f"  within-shot motion @12s (5 fps): mean diff {np.abs(np.diff(f2, axis=0)).mean():.2f}")

print("== Audio stream")
wav = ff("-i", MP4, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", "-").stdout
a, sr = sf.read(io.BytesIO(wav))
rms = np.sqrt(np.mean(a ** 2))
win = int(0.5 * sr); blocks = np.sqrt(np.mean(a[: len(a) // win * win].reshape(-1, win) ** 2, axis=1))
print(f"  decoded {len(a) / sr:.1f}s @ {sr} Hz, RMS {20 * np.log10(rms):.1f} dBFS, "
      f"silent 0.5s blocks (< -60 dBFS): {(blocks < 1e-3).sum()} of {len(blocks)}")
sf.write("_verify16k.wav", a, sr)

print("== Loudness (EBU R128)")
e = ff("-i", MP4, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-").stderr.decode(errors="replace")
summ = e[e.rfind("Summary:"):]
for k in ("I:", "LRA:", "Peak:"):
    mm = re.search(rf"{k}\s+(-?[\d.]+)\s+(\S+)", summ)
    if mm: print(f"  {k:5} {mm[1]} {mm[2]}")

print("== Narration (faster-whisper transcription of the final audio)")
from faster_whisper import WhisperModel
model = WhisperModel("base.en", device="cpu", compute_type="int8")
segs, _ = model.transcribe(a.astype(np.float32), beam_size=5, vad_filter=False)
got = []
for s in segs:
    print(f"  [{s.start:5.1f}–{s.end:5.1f}] {s.text.strip()}")
    got.append(s.text)
norm = lambda t: re.sub(r"[^a-z' ]", " ", t.lower().replace("distract free", "distractfree")).split()
ref, hyp = norm(SCRIPT), norm(" ".join(got))
sm = difflib.SequenceMatcher(a=ref, b=hyp)
matched = sum(b.size for b in sm.get_matching_blocks())
print(f"  script words recognised in order: {matched}/{len(ref)} ({100 * matched / len(ref):.0f}%)")
