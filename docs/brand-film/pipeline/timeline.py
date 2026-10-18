"""Single source of truth for the edit: shots, grades, voiceover placement."""
FPS = 25
XF = 0.4          # crossfade length between shots (s)
END_IN = 44.6     # end card starts fading in (matches overlay.html)
TOTAL = 50.5

# (pexels id, in-point s, visible duration s incl. crossfade overlap, grade)
SHOTS = [
    # 1 · The problem: the browser keeps pulling him away
    ("35331905", 0.3, 3.4, "cool"),    # night, alone at his laptop
    ("38929040", 0.4, 3.0, "cool"),    # types a social site into Chrome's address bar
    ("38929041", 6.0, 3.0, "cool"),    # scrolling the feed instead of working
    ("35331907", 0.6, 2.6, "cool"),    # stuck, staring away from the screen
    # 2 · The turning point
    ("35331903", 1.0, 5.0, "cool"),    # stretches it out, resets
    ("35331911", 0.3, 5.0, "neutral"), # close-up: back in, eyes on the work
    # 3 · DistractFree in action
    ("35331910", 0.0, 3.4, "neutral"), # typing
    ("35331906", 1.0, 3.6, "neutral"), # deep focus, profile
    ("35331909", 1.0, 3.4, "neutral"), # over the shoulder, work on screen
    ("35331902", 1.0, 3.4, "neutral"), # side view, steady typing
    # 4 · The result
    ("35331912", 2.5, 4.0, "warm"),    # a relaxed sip, back to it
    ("35331913", 0.5, 3.6, "warm"),    # calm, in the flow
    ("35331899", 0.0, 3.6, "warm"),    # wide: the dog wanders past, all is well
    # 5 · Brand ending
    ("35331898", 0.0, 8.7, "warm"),    # the room at night — runs on under the end card
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
