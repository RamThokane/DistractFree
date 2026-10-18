import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import '../styles/brandFilm.css';

/* ═══════════════════════════════════════════════════════════
   BrandFilm — the cinematic brand film on the landing page.
   A real <video> on its own timeline: scrolling only reveals the
   section and pauses it off-screen, it never scrubs the film.
   Sound is always opt-in (browser autoplay policy): the film may
   start muted, and a clear "Enable sound" control turns audio on.
   If the media files are not deployed yet, the section renders a
   static brand panel instead of a broken player.
   ═══════════════════════════════════════════════════════════ */

const BASE = '/videos/distractfree-brand-film';
const FILM = {
  mp4: `${BASE}.mp4`,
  webm: `${BASE}.webm`,
  mobileMp4: `${BASE}-mobile.mp4`,
  poster: `${BASE}-poster.webp`,
  captions: `${BASE}-captions.vtt`,
};
// Brand-ending scene start (seconds) — the clickable CTA appears from here on.
const CTA_FROM = 45;
const SOUND_PREF_KEY = 'df-film-sound';

const readSoundPref = () => {
  try { return sessionStorage.getItem(SOUND_PREF_KEY) === 'on'; } catch { return false; }
};
const writeSoundPref = (on) => {
  try { sessionStorage.setItem(SOUND_PREF_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
};

/* A missing static file falls through to index.html (SPA rewrite) with a 200,
   so a file only counts as present when its content type matches. */
const probe = async (url, typePrefix) => {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return res.ok && (res.headers.get('content-type') || '').startsWith(typePrefix);
  } catch {
    return false;
  }
};

const formatClock = (s) => {
  const v = Number.isFinite(s) ? Math.max(0, s) : 0;
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
};

/* ── Icons ── */
const Icon = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const PlayIcon = ({ size }) => <Icon size={size}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></Icon>;
const PauseIcon = () => <Icon><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></Icon>;
const SoundOnIcon = () => <Icon><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></Icon>;
const SoundOffIcon = () => <Icon><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></Icon>;
const CaptionsIcon = () => <Icon><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M10 10.5a2 2 0 1 0 0 3M16.5 10.5a2 2 0 1 0 0 3" /></Icon>;
const FullscreenIcon = () => <Icon><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>;
const ReplayIcon = () => <Icon><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></Icon>;

const SectionHeading = () => (
  <div className="text-center mb-10 md:mb-12">
    <p className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade" style={{ letterSpacing: '2px' }}>
      The DistractFree film
    </p>
    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-hi section-headline-upgrade" style={{ lineHeight: 1.15 }}>
      From distraction to deliberate focus
    </h2>
  </div>
);

/* Shown when the film has not been deployed: honest, static, no play button. */
const BrandPanel = () => (
  <div className="film-stage film-stage--static">
    <div className="film-endcard">
      <img src="/favicon.svg" alt="" className="film-endcard-logo" />
      <p className="film-endcard-title">Make room for what matters.</p>
      <p className="film-endcard-sub">Build better focus habits with DistractFree.</p>
      <Link to="/register" className="film-cta">Start Focusing</Link>
    </div>
  </div>
);

const BrandFilm = () => {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const reduced = useReducedMotion();

  // 'idle' → not probed yet, 'missing' → assets absent, 'ready' → render the player
  const [status, setStatus] = useState('idle');
  const [sources, setSources] = useState({ webm: false, mobile: false, poster: false });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [cueText, setCueText] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const userPausedRef = useRef(false);
  const heardWithSoundRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Lazy: only probe for (and then load) the film once the section approaches the viewport. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || status !== 'idle') return undefined;
    let cancelled = false;
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const [mp4, webm, mobile, poster, vtt] = await Promise.all([
        probe(FILM.mp4, 'video/'),
        probe(FILM.webm, 'video/'),
        probe(FILM.mobileMp4, 'video/'),
        probe(FILM.poster, 'image/'),
        probe(FILM.captions, 'text/vtt'),
      ]);
      if (cancelled) return;
      if (!mp4) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.info(`[BrandFilm] ${FILM.mp4} not found — showing the static brand panel. See docs/brand-film/PRODUCTION.md.`);
        }
        setStatus('missing');
        return;
      }
      setSources({ webm, mobile, poster, captions: vtt });
      setStatus('ready');
    }, { rootMargin: '400px 0px' });
    obs.observe(el);
    return () => { cancelled = true; obs.disconnect(); };
  }, [status]);

  /* Start playback (muted unless the visitor already turned sound on this session). */
  const autoStart = useCallback(async () => {
    const v = videoRef.current;
    if (!v || userPausedRef.current || v.ended) return;
    if (readSoundPref()) {
      v.muted = false;
      try { await v.play(); setAutoplayFailed(false); return; } catch { /* sound needs a gesture — fall back to muted */ }
    }
    v.muted = true;
    try { await v.play(); setAutoplayFailed(false); } catch { setAutoplayFailed(true); }
  }, []);

  /* Visibility only plays/pauses the film; it never changes its position. */
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const el = stageRef.current;
    const obs = new IntersectionObserver(([entry]) => {
      const v = videoRef.current;
      if (!v) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!reduced) autoStart();
      } else if (!v.paused) {
        v.pause();
      }
    }, { threshold: [0, 0.5] });
    obs.observe(el);
    const onHidden = () => { if (document.hidden && videoRef.current) videoRef.current.pause(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => { obs.disconnect(); document.removeEventListener('visibilitychange', onHidden); };
  }, [status, reduced, autoStart]);

  /* Captions are drawn by the page (above the control bar) rather than natively,
     so the track stays 'hidden' — it still fires cuechange. */
  const useMobileCut = isMobile && sources.mobile;
  useEffect(() => {
    const track = trackRef.current?.track;
    if (!track) return undefined;
    track.mode = 'hidden';
    const onCue = () => {
      const cues = Array.from(track.activeCues || []);
      setCueText(cues.map((c) => c.text).join('\n'));
    };
    track.addEventListener('cuechange', onCue);
    return () => track.removeEventListener('cuechange', onCue);
  }, [status, sources.captions, useMobileCut]);

  const play = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    userPausedRef.current = false;
    if (v.ended) v.currentTime = 0;
    try { await v.play(); setAutoplayFailed(false); } catch { setAutoplayFailed(true); }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) play();
    else { userPausedRef.current = true; v.pause(); }
  }, [play]);

  /* The explicit "Enable sound" gesture. The first time, restart so the narration is heard in full. */
  const enableSound = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    writeSoundPref(true);
    if (!heardWithSoundRef.current) {
      heardWithSoundRef.current = true;
      v.currentTime = 0;
    }
    userPausedRef.current = false;
    try { await v.play(); setAutoplayFailed(false); } catch { setAutoplayFailed(true); }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) enableSound();
    else { v.muted = true; writeSoundPref(false); }
  }, [enableSound]);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    const v = videoRef.current;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (stage?.requestFullscreen) stage.requestFullscreen().catch(() => {});
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS Safari
  }, []);

  const seekTo = (s) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.min(Math.max(0, s), v.duration);
  };

  const onKeyDown = (e) => {
    if (e.target.closest('a, input')) return;
    const key = e.key.toLowerCase();
    const v = videoRef.current;
    if (key === ' ' || key === 'k') { if (e.target.closest('button')) return; e.preventDefault(); togglePlay(); }
    else if (key === 'm') toggleMute();
    else if (key === 'c') setCaptionsOn((c) => !c);
    else if (key === 'f') toggleFullscreen();
    else if (key === 'arrowright' && v) { e.preventDefault(); seekTo(v.currentTime + 5); }
    else if (key === 'arrowleft' && v) { e.preventDefault(); seekTo(v.currentTime - 5); }
  };

  const showBigPlay = !playing && !ended && (autoplayFailed || reduced || userPausedRef.current || time === 0);
  const showCta = ended || time >= CTA_FROM;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <section id="how-it-works" ref={sectionRef} className="relative how-it-works-section brand-film-section py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative z-10 max-w-[1120px] mx-auto">
        <SectionHeading />

        {status === 'missing' && <BrandPanel />}

        {status === 'idle' && <div className="film-stage" aria-hidden="true" />}

        {status === 'ready' && (
          <div
            ref={stageRef}
            className={`film-stage ${useMobileCut ? 'film-stage--portrait' : ''} ${playing ? 'is-playing' : ''}`}
            role="region"
            aria-label="DistractFree brand film. Space to play or pause, M to toggle sound, C for captions, F for full screen."
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            <video
              key={useMobileCut ? 'mobile' : 'desktop'}
              ref={videoRef}
              className="film-video"
              poster={sources.poster ? FILM.poster : undefined}
              muted
              playsInline
              preload="metadata"
              onClick={togglePlay}
              onPlay={() => { setPlaying(true); setEnded(false); }}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setEnded(true); }}
              onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            >
              {useMobileCut ? (
                <source src={FILM.mobileMp4} type="video/mp4" />
              ) : (
                <>
                  {sources.webm && <source src={FILM.webm} type="video/webm" />}
                  <source src={FILM.mp4} type="video/mp4" />
                </>
              )}
              {sources.captions && <track ref={trackRef} kind="captions" src={FILM.captions} srcLang="en" label="English" default />}
            </video>

            {captionsOn && cueText && !ended && (
              <div className="film-caption" aria-hidden="true">
                <span>{cueText}</span>
              </div>
            )}

            {/* Sound is off: make turning it on the obvious next step */}
            {muted && playing && (
              <button type="button" className="film-sound-pill" onClick={enableSound} aria-label="Enable sound and play the film with narration">
                <SoundOnIcon />
                Enable sound
              </button>
            )}

            {showBigPlay && (
              <button type="button" className="film-bigplay" onClick={muted ? enableSound : play} aria-label="Play the DistractFree film with sound">
                <span className="film-bigplay-ring"><PlayIcon size={28} /></span>
                <span className="film-bigplay-label">Watch the film · {formatClock(duration || 50)}</span>
              </button>
            )}

            {showCta && (
              <div className={`film-cta-layer ${ended ? 'is-ended' : ''}`}>
                {ended && (
                  <>
                    <img src="/favicon.svg" alt="" className="film-endcard-logo" />
                    <p className="film-endcard-title">Make room for what matters.</p>
                    <p className="film-endcard-sub">Build better focus habits with DistractFree.</p>
                  </>
                )}
                <div className="film-cta-row">
                  <Link to="/register" className="film-cta">Start Focusing</Link>
                  {ended && (
                    <button type="button" className="film-ghost-btn" onClick={play}>
                      <ReplayIcon /> Watch again
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="film-controls">
              <button type="button" className="film-ctrl" onClick={togglePlay} aria-label={playing ? 'Pause film' : 'Play film'}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <input
                type="range"
                className="film-progress"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={(e) => seekTo(Number(e.target.value))}
                aria-label="Seek"
                aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
                style={{ '--progress': `${progress}%` }}
              />
              <span className="film-time" aria-hidden="true">{formatClock(time)} / {formatClock(duration)}</span>
              {sources.captions && (
                <button type="button" className={`film-ctrl ${captionsOn ? 'is-on' : ''}`} onClick={() => setCaptionsOn((c) => !c)} aria-label={captionsOn ? 'Hide captions' : 'Show captions'} aria-pressed={captionsOn}>
                  <CaptionsIcon />
                </button>
              )}
              <button type="button" className="film-ctrl" onClick={toggleMute} aria-label={muted ? 'Unmute film' : 'Mute film'} aria-pressed={!muted}>
                {muted ? <SoundOffIcon /> : <SoundOnIcon />}
              </button>
              <button type="button" className="film-ctrl" onClick={toggleFullscreen} aria-label="Full screen">
                <FullscreenIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrandFilm;
