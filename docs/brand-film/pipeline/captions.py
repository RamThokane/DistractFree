"""Write WebVTT captions timed to the actual voiceover clips (chunks split by word count)."""
import sys, json
from timeline import VO, CAPTIONS

lines = {l["line"]: l["dur"] for l in json.load(open(sys.argv[1]))}
out = sys.argv[2]

def ts(s):
    h, rem = divmod(s, 3600); mnt, sec = divmod(rem, 60)
    return f"{int(h):02d}:{int(mnt):02d}:{sec:06.3f}"

cues = []
for i, chunks in CAPTIONS.items():
    start, dur = VO[i], lines[i]
    words = [len(c.split()) for c in chunks]
    t = start
    for n, (c, w) in enumerate(zip(chunks, words)):
        d = dur * w / sum(words)
        cues.append((t, t + d + (0.4 if n == len(chunks) - 1 else 0), c))
        t += d
with open(out, "w", encoding="utf-8", newline="\n") as f:
    f.write("WEBVTT\nKind: captions\nLanguage: en\n\n")
    for n, (a, b, text) in enumerate(cues, 1):
        f.write(f"{n}\n{ts(a)} --> {ts(b)}\n{text}\n\n")
print(open(out, encoding="utf-8").read())
