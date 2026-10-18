"""Cut, grade, crossfade and title the picture, then mux it with the loudness-normalised mix.

Built in stages (graded shots -> crossfaded base -> titled picture -> mux) so each ffmpeg graph is small.
"""
import sys, json, re, subprocess
import imageio_ffmpeg
from timeline import SHOTS, XF, FPS, TOTAL, shot_starts

FF = imageio_ffmpeg.get_ffmpeg_exe()
CLIPS, OVERLAY, MIX, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

GRADE = {
    "cool": "eq=contrast=1.07:brightness=0.005:saturation=0.80:gamma=1.03,"
            "colorbalance=rs=-0.03:rm=-0.02:bs=0.05:bm=0.03",
    "neutral": "eq=contrast=1.08:brightness=0.015:saturation=0.95:gamma=1.04",
    "warm": "eq=contrast=1.08:brightness=0.025:saturation=1.04:gamma=1.05,"
            "colorbalance=rs=0.05:rm=0.04:rh=0.02:bs=-0.04:bm=-0.04",
}

def run(args):
    print("ffmpeg ->", args[-1], flush=True)
    p = subprocess.run([FF, "-hide_banner", "-nostdin", *args], capture_output=True, text=True, timeout=1500)
    if p.returncode:
        print(p.stderr[-3000:]); sys.exit(p.returncode)
    return p.stderr

# 1. Loudness-normalise the mix (two-pass loudnorm: -16 LUFS, -1.5 dBTP)
err = run(["-i", MIX, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S).group(0))
run(["-y", "-i", MIX, "-af",
     f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
     f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true",
     "-ar", "48000", "mix_norm.wav"])

# 2a. Each shot -> graded intermediate with an exact frame count
starts = shot_starts()
seg_frames = []
for k, (vid, tin, dur, grade) in enumerate(SHOTS):
    nf = round(dur * FPS)
    seg_frames.append(nf)
    run(["-y", "-ss", f"{tin}", "-i", f"{CLIPS}/{vid}.mp4", "-an",
         "-vf", f"scale=1920:1080:flags=lanczos,setsar=1,{GRADE[grade]},fps={FPS},format=yuv420p",
         "-frames:v", str(nf), "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", f"seg{k:02d}.mp4"])

# 2b. Crossfade the shots
inputs, chains = [], []
for k in range(len(SHOTS)):
    inputs += ["-i", f"seg{k:02d}.mp4"]
    chains.append(f"[{k}:v]null[s{k}]")
prev = "s0"
for k in range(1, len(SHOTS)):
    chains.append(f"[{prev}][s{k}]xfade=transition=fade:duration={XF}:offset={starts[k]}[x{k}]")
    prev = f"x{k}"
base_frames = sum(seg_frames) - round(XF * FPS) * (len(SHOTS) - 1)
run(["-y", *inputs, "-filter_complex", ";".join(chains), "-map", f"[{prev}]", "-frames:v", str(base_frames),
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "base.mp4"])

# 2c. Vignette + titles, final encode (the last shot already runs to TOTAL)
NFRAMES = int(TOTAL * FPS)
run(["-y", "-i", "base.mp4", "-framerate", str(FPS), "-i", f"{OVERLAY}/f%05d.png", "-filter_complex",
     "[0:v]vignette=angle=PI/5,format=yuv420p[b];"
     "[1:v]format=rgba[o];[b][o]overlay=0:0:format=auto:eof_action=repeat,format=yuv420p[v]",
     "-map", "[v]", "-frames:v", str(NFRAMES),
     "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-profile:v", "high", "-pix_fmt", "yuv420p",
     "-g", "50", "-r", str(FPS), "-an", "picture.mp4"])

# 3. Mux with the normalised mix
run(["-y", "-i", "picture.mp4", "-i", "mix_norm.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
     "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", OUT])
print("wrote", OUT, "| shot starts:", starts, "| base frames:", base_frames)
