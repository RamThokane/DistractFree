# DistractFree brand film: production brief

The landing page's "How it works" section (`src/components/BrandFilm.js`) plays a real video file. Until that file is deployed, the section shows a static brand panel with the "Start Focusing" CTA. It never shows a play button that points at nothing.

## Deliverables (drop into `public/videos/`)

| File | Required | Spec |
|---|---|---|
| `distractfree-brand-film.mp4` | **yes** (this file switches the player on) | 1920×1080, H.264 High, yuv420p, 24 fps, CRF ~23, `+faststart`, AAC 160 kbps stereo 48 kHz. Target ≤ 12 MB for ~55 s |
| `distractfree-brand-film.webm` | optional | VP9 + Opus 128 kbps, same picture. Served first to browsers that support it |
| `distractfree-brand-film-mobile.mp4` | optional | 4:5 (1080×1350) re-framed cut, same audio. Used at ≤ 640 px viewport width |
| `distractfree-brand-film-poster.webp` | recommended | 1920×1080 still from Scene 1 or 4, quality ~80, ≤ 150 KB |
| `distractfree-brand-film-captions.vtt` | present | Already written from the script. Re-time it to the final voiceover |

The component checks for each file with a HEAD request and only uses the ones that are actually served, so optional files can be added later without code changes.

Keep on-screen text inside the centre 4:5 safe area if you won't produce a separate mobile cut. Keep the bottom ~12% of the frame free of text, because the player controls and captions sit there. From **44 s** the page overlays a clickable "Start Focusing" button bottom-centre, so leave that area clear in Scene 5. If the edit's timing changes, update `CTA_FROM` in `BrandFilm.js`.

## Storyboard (≈ 55 s)

Look: natural light, shallow depth of field, slow handheld/slider moves. Cool and slightly desaturated in Scenes 1–2, warming through 3 to a golden, calm grade in 4–5. Typography: Inter, semibold, white, small and restrained, fading in and out over the footage. No laptop/browser mockups. A real laptop may appear naturally in shot.

| Time | Scene | Shots | On-screen text |
|---|---|---|---|
| 0–8 s | **The problem** | ECU phone on desk lighting up; pen stops mid-sentence; eyes drift to phone; half-written notes; quick tasteful cuts between buzzes | "Your attention is constantly being pulled away." |
| 8–16 s | **Turning point** | Hand turns phone face-down and slides it away; breath; desk light clicks on; frame calms (longer takes, slower cuts) | "Take back control of your focus." |
| 16–30 s | **DistractFree in action** | Person starts a focus session (a brief, clean full-frame graphic of the real 25/50-minute timer, not inside a device frame); reaches for a distracting site, sees it blocked and returns to work; steady writing; subtle coin chime as a session completes; glance at a simple weekly-focus chart overlay | "Build your focus." → "Break distracting habits." → "Turn consistency into progress." (one at a time) |
| 30–44 s | **The result** | Same person, warmer light: ticks off a task, flips through finished notes, small satisfied exhale | "Progress starts with one focused session." |
| 44–55 s | **Brand ending** | Slow fade to dark, DistractFree logo (`public/favicon.svg`) builds in, brand indigo `#5C6BC0 → #7E8CF6` with cyan accent `#20D7D7` | "Make room for what matters." / "Build better focus habits with DistractFree." |

Only show features that exist today: focus sessions, website blocking via the browser extension, Focus Coins and unlocks, and productivity insights and predictions. Don't show phone-app blocking or anything the product doesn't do.

## Voiceover script

Calm, warm, confident, unhurried (~140 wpm). Natural, not announcer-style.

1. (0.5 s) "Every day, distractions compete for your attention. And every interruption makes it harder to get back into the flow."
2. (9 s) "What if you could understand your habits, build better routines, and make every focused minute count?"
3. (17 s) "DistractFree helps you build focused work habits, reduce digital distractions, and turn consistent effort into meaningful progress."
4. (31 s) "Start small. Learn from your habits. Make better use of your time, one focused session at a time."
5. (46 s) "DistractFree. Make room for what matters."

## Audio mix

- Music: sparse piano/ambient bed, licensed for web advertising use. It builds gently from Scene 2 and resolves in Scene 5.
- SFX: phone buzzes (Scene 1, slightly too loud on purpose), phone set down, desk-lamp click, pen on paper, a soft coin chime (Scene 3).
- Levels: master at **−16 LUFS integrated**, true peak ≤ −1 dBTP. Voiceover sits about 10–12 dB above the music (duck the music under the voice). Crossfade between scenes, with no hard audio cuts.

## Encoding (ffmpeg)

```sh
# MP4 (required)
ffmpeg -i master.mov -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 23 -preset slow \
  -r 24 -vf scale=1920:1080 -c:a aac -b:a 160k -ar 48000 -movflags +faststart \
  public/videos/distractfree-brand-film.mp4

# WebM (optional)
ffmpeg -i master.mov -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -vf scale=1920:1080 \
  -c:a libopus -b:a 128k public/videos/distractfree-brand-film.webm

# Mobile 4:5 cut (optional, from a re-framed master or a centre crop)
ffmpeg -i master.mov -vf "crop=ih*4/5:ih,scale=1080:1350" -c:v libx264 -pix_fmt yuv420p \
  -crf 24 -preset slow -c:a aac -b:a 128k -movflags +faststart \
  public/videos/distractfree-brand-film-mobile.mp4

# Poster
ffmpeg -ss 00:00:33 -i master.mov -frames:v 1 -vf scale=1920:1080 -quality 80 \
  public/videos/distractfree-brand-film-poster.webp
```

## Player behaviour (for QA)

- The film loads only when the section nears the viewport. It autoplays **muted** once at least half of it is visible, and pauses when scrolled away or when the tab is hidden. Scrolling never seeks.
- An "Enable sound" pill appears whenever the film plays muted. Clicking it unmutes and restarts from 0:00 the first time, so the full narration is heard.
- The sound choice is remembered in `sessionStorage` for the session. On a later visit in the same session the film tries to start with sound, and falls back to muted if the browser refuses.
- If autoplay is blocked, or the visitor prefers reduced motion, a large "Watch the film" play button is shown instead and nothing plays on its own.
- Controls: play/pause, seek, time, captions (on by default), mute, full screen. Keyboard on the focused player: Space/K play-pause, M sound, C captions, F full screen, ←/→ seek 5 s.
