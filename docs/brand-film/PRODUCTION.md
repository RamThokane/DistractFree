# DistractFree brand film

The landing page's "How it works" section (`src/components/BrandFilm.js`) plays `public/videos/distractfree-brand-film.mp4`. It's a ~50 s edited film with real footage, a spoken voiceover, an original score and captions. If that file is ever missing, the section falls back to a static brand panel rather than showing a broken player.

## Files (`public/videos/`)

| File | What it is |
|---|---|
| `distractfree-brand-film.mp4` | 1920×1080, H.264 High, 25 fps, AAC 160 kbps stereo 48 kHz, `+faststart`. Loudness normalised to −16 LUFS / −1.5 dBTP |
| `distractfree-brand-film-poster.webp` | Loading thumbnail (a frame from the result scene) |
| `distractfree-brand-film-captions.vtt` | English captions, timed to the actual voiceover |

There's no WebM or 4:5 mobile cut yet. The player picks those up automatically if they're added as `distractfree-brand-film.webm` / `distractfree-brand-film-mobile.mp4`.

## How it was made

| Layer | Source | License |
|---|---|---|
| Footage | 12 clips from one Pexels shoot of a man working at his laptop at night (IDs 35331898, 35331899, 35331902, 35331903, 35331905, 35331906, 35331907, 35331909, 35331910, 35331911, 35331912, 35331913), plus two real Chrome screen close-ups of a social feed (38929040, 38929041) | [Pexels License](https://www.pexels.com/license/): free for commercial use, modification allowed, no attribution required |
| Voiceover | Generated with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (voice `af_heart`, speed 0.92) via `kokoro-onnx` | Apache-2.0 |
| Music + sound effects | Synthesised from scratch in `pipeline/audio.py` (pads, piano-like voice, reverb, notification pings, clock ticks, whoosh, coin chime) | Original, no third-party samples |
| Typography / end card | `pipeline/overlay.html`, rendered frame by frame with Inter (Google Fonts, OFL) and the DistractFree logo | Project assets |

The film is built around the browser, where DistractFree works (it's a Chrome extension plus web dashboard). The product overlays only show things the app really does: a 25-minute focus session countdown, a blocked site (the site seen in the distraction scene), and "+10 Focus Coins" (the reward for a 25-minute session in `src/utils/coinRules.js`).

## Edit

| Time | Scene | Narration |
|---|---|---|
| 0–10 s | Night, alone at his laptop; a social site typed into Chrome's address bar; scrolling the feed; stuck, staring away. Cool grade, clock ticking, notification pings | "Every day, distractions compete for your attention. Every interruption makes it harder to get back into the flow." |
| 10–19 s | He stretches it out and resets; close-up as he gets back into the work | "It's time to take back control of your focus." |
| 19–32 s | Deep focus at the laptop, several angles. Focus-session, blocked-site and Focus Coins overlays | "DistractFree helps you build better focus habits, reduce digital distractions, and turn consistent effort into meaningful progress." |
| 32–44 s | A relaxed sip, calm and in the flow; the dog wanders past. Warm grade | "Start small. Learn from your habits. Make every focused session count." |
| 44.6–50.5 s | End card: logo draws on, "Make room for what matters." | "DistractFree. Make room for what matters." |

The player overlays a clickable "Start Focusing" button from 45 s (`CTA_FROM` in `BrandFilm.js`).

## Rebuilding

The scripts in `pipeline/` reproduce the film. They need Python 3.11+ with `kokoro-onnx soundfile imageio-ffmpeg playwright pillow faster-whisper`, Microsoft Edge (for Playwright), and the Kokoro model files `kokoro-v1.0.onnx` + `voices-v1.0.bin`.

1. `python vo.py <models> vo_af_heart af_heart 0.92`: voiceover, one WAV per line
2. `python audio.py vo_af_heart .`: score, SFX and VO mixed with ducking → `mix.wav`
3. `python render_overlay.py overlay.html overlay_frames 50.5`: titles and end card as transparent PNGs
4. `python build_video.py <clips> overlay_frames mix.wav distractfree-brand-film.mp4`: cut, grade, crossfade, overlay, loudness-normalise and mux
5. `python captions.py vo_af_heart/lines.json captions.vtt`
6. `python verify.py distractfree-brand-film.mp4`: probes the streams, checks for motion, measures loudness and transcribes the narration

The shot list, voiceover placement and caption splits all live in `pipeline/timeline.py`. `pipeline/find_pexels.py` resolves a Pexels video ID to its CDN file URL.
