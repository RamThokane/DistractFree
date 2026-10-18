"""Generate the voiceover, one WAV per line, with Kokoro (Apache-2.0)."""
import sys, json, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

MODELS, OUT, VOICE = sys.argv[1], sys.argv[2], sys.argv[3]
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 0.92
os.makedirs(OUT, exist_ok=True)

LINES = [
    "Every day, distractions compete for your attention. Every interruption makes it harder to get back into the flow.",
    "It's time to take back control of your focus.",
    "Distract Free helps you build better focus habits, reduce digital distractions, and turn consistent effort into meaningful progress.",
    "Start small. Learn from your habits. Make every focused session count.",
    "Distract Free. Make room for what matters.",
]

k = Kokoro(f"{MODELS}/kokoro-v1.0.onnx", f"{MODELS}/voices-v1.0.bin")
meta = []
for i, text in enumerate(LINES, 1):
    samples, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    # trim leading/trailing near-silence
    a = np.abs(samples); idx = np.where(a > 0.01)[0]
    samples = samples[max(0, idx[0] - 800): idx[-1] + 2400]
    path = f"{OUT}/line{i}.wav"
    sf.write(path, samples, sr)
    meta.append({"line": i, "text": text.replace("Distract Free", "DistractFree"), "dur": round(len(samples) / sr, 3)})
json.dump(meta, open(f"{OUT}/lines.json", "w"), indent=1)
print(json.dumps(meta, indent=1))
