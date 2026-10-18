"""Single source of truth for the edit: shots, grades, voiceover placement."""
FPS = 25
XF = 0.4          # crossfade length between shots (s)
END_IN = 44.6     # end card starts fading in (matches overlay.html)
TOTAL = 50.5

# (pexels id, in-point s, visible duration s incl. crossfade overlap, grade)
SHOTS = [
    # 1 · The problem
    ("6281213", 0.3, 3.4, "cool"),   # phone lights up beside his work
    ("6281209", 1.5, 3.0, "cool"),   # reaches for the glowing phone
    ("6281208", 4.0, 3.0, "cool"),   # frustration, fingers on temples
    ("6281223", 1.0, 2.6, "cool"),   # crumpled drafts by the bin
    # 2 · The turning point
    ("6281216", 7.0, 5.0, "cool"),   # lets go, deep breath
    ("6281074", 7.6, 5.0, "neutral"),  # puts on his glasses
    # 3 · DistractFree in action
    ("6281075", 2.0, 3.4, "neutral"),  # settles into the work
    ("6281082", 10.0, 3.6, "neutral"), # deep focus under the lamp
    ("6281215", 3.0, 3.4, "neutral"),  # writing
    ("6281083", 5.0, 3.4, "neutral"),  # working through the plans
    # 4 · The result
    ("6281069", 33.0, 4.0, "warm"),  # smiling as it comes together
    ("6281076", 9.0, 3.6, "warm"),   # calm, confident
    ("6281068", 3.0, 3.6, "warm"),   # wide: alone, at ease, in the library
    # 5 · Brand ending
    ("6281070", 3.0, 8.7, "warm"),   # the desk, lamp on — runs on under the end card to the final frame
]

def shot_starts():
    t, out = 0.0, []
    for _, _, d, _ in SHOTS:
        out.append(round(t, 3))
        t += d - XF
    return out

# Voiceover line -> start time (s)
VO = {1: 0.9, 2: 11.6, 3: 20.2, 4: 32.6, 5: 46.0}

# Caption splits: line -> list of chunks (shown sequentially, timed by word count)
CAPTIONS = {
    1: ["Every day, distractions compete for your attention.",
        "Every interruption makes it harder to get back into the flow."],
    2: ["It's time to take back control of your focus."],
    3: ["DistractFree helps you build better focus habits,",
        "reduce digital distractions, and turn consistent effort",
        "into meaningful progress."],
    4: ["Start small. Learn from your habits.", "Make every focused session count."],
    5: ["DistractFree. Make room for what matters."],
}
