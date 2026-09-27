import React, { useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { Monitor, CompactFrame, BrowserWindow, DESKTOP, COMPACT } from './DeviceFrame';
import { FocusScreen, SocialScreen, BlockScreen, VideoScreen, InsightsScreen, ExtensionPopup } from './DemoScreens';
import DemoCursor from './DemoCursor';
import { useElementWidth } from './useDemoClock';
import { T, TOTAL_DURATION, browserAt, screenAt, seg } from './demoTimeline';
import './productDemo.css';

const COMPACT_BELOW = 560;

function Screen({ name, t, compact }) {
  switch (name) {
    case 'social':
      return <SocialScreen t={t} compact={compact} />;
    case 'block-instagram':
      return <BlockScreen t={t} compact={compact} site="instagram.com" />;
    case 'block-youtube':
      return <BlockScreen t={t} compact={compact} site="youtube.com" />;
    case 'video':
      return <VideoScreen t={t} compact={compact} />;
    case 'insights':
      return <InsightsScreen t={t} compact={compact} />;
    default:
      return <FocusScreen t={t} compact={compact} />;
  }
}

/* Earned coins arc from the reward popup into the navbar balance */
function FlyingCoin({ time, resolve, delay }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(1);

  useMotionValueEvent(time, 'change', (v) => {
    const start = T.coinFly[0] + delay;
    const p = seg(v, start, start + 0.62);
    opacity.set(v >= start && p < 1 ? 1 : 0);
    if (!opacity.get()) return;
    const from = resolve('reward-coins');
    const to = resolve('coin-pill');
    const e = 1 - Math.pow(1 - p, 2);
    x.set(from.x + (to.x - from.x) * e);
    y.set(from.y + (to.y - from.y) * e - Math.sin(Math.PI * p) * 60);
    scale.set(1 - p * 0.45);
  });

  return (
    <motion.span className="pd-flying-coin" style={{ x, y, opacity, scale }}>
      🪙
    </motion.span>
  );
}

const CoinFlight = ({ time, resolve }) =>
  [0, 0.09, 0.18].map((delay) => <FlyingCoin key={delay} time={time} resolve={resolve} delay={delay} />);

/**
 * The computer demo. Everything shown is derived from `t` (seconds);
 * `time` is the same clock as a MotionValue for per-frame cursor motion.
 */
export default function ProductDemo({ t, time, reduced }) {
  const containerRef = useRef(null);
  const rootRef = useRef(null);
  const targets = useRef({});
  const width = useElementWidth(containerRef);
  const compact = width > 0 && width < COMPACT_BELOW;
  const size = compact ? COMPACT : DESKTOP;

  const browser = browserAt(t, reduced);
  const screen = screenAt(t);

  useEffect(() => {
    targets.current = {};
  }, [compact]);

  // Measure cursor targets in window (virtual-pixel) coordinates after every render
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const s = r.width / size.winW;
    if (!s) return;
    root.querySelectorAll('[data-demo-target]').forEach((el) => {
      const b = el.getBoundingClientRect();
      targets.current[el.dataset.demoTarget] = {
        x: (b.left + b.width / 2 - r.left) / s,
        y: (b.top + b.height / 2 - r.top) / s,
      };
    });
  });

  const resolve = useCallback(
    (to) => {
      if (typeof to === 'string') return targets.current[to] || { x: size.winW / 2, y: size.winH / 2 };
      const viewportH = size.winH - size.chrome;
      return { x: (to.x / 100) * size.winW, y: size.chrome + (to.y / 100) * viewportH };
    },
    [size]
  );

  const fade = Math.max(seg(t, T.outro, TOTAL_DURATION - 0.15), t > 0 ? 1 - seg(t, 0, 0.5) : 0);

  const browserWindow = (
    <BrowserWindow
      compact={compact}
      browser={browser}
      rootRef={rootRef}
      overlay={
        <>
          <AnimatePresence>{browser.popupOpen && <ExtensionPopup t={t} compact={compact} />}</AnimatePresence>
          {!reduced && <CoinFlight time={time} resolve={resolve} />}
          {!reduced && <DemoCursor time={time} resolve={resolve} kindHint={`${width}-${screen}`} />}
          <div className="pd-fade" style={{ opacity: fade }} />
        </>
      }
    >
      <Screen name={screen} t={t} compact={compact} />
    </BrowserWindow>
  );

  return (
    <div ref={containerRef} className={`pd-stage ${width ? '' : 'is-measuring'}`} aria-hidden="true" inert>
      {width > 0 &&
        (compact ? <CompactFrame width={width}>{browserWindow}</CompactFrame> : <Monitor width={width}>{browserWindow}</Monitor>)}
    </div>
  );
}
