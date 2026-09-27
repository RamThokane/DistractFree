import { useEffect, useState, useCallback } from 'react';
import { useMotionValue } from 'framer-motion';

const TICK = 1 / 20; // React re-renders at 20 Hz; the cursor reads `time` every frame

/**
 * The demo's own playback clock. `time` is a MotionValue (seconds) that loops
 * over `total`; `t` is a quantised copy for rendering. The clock only advances
 * while `playing` is true — the caller decides that from viewport visibility.
 */
export default function useDemoClock(total, playing) {
  const time = useMotionValue(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let last = performance.now();
    const loop = (now) => {
      // Cap the step so a backgrounded tab doesn't jump scenes when it returns
      const delta = Math.min(now - last, 100) / 1000;
      last = now;
      let next = time.get() + delta;
      if (next >= total) next = 0;
      time.set(next);
      const q = Math.floor(next / TICK) * TICK;
      setT((prev) => (Math.abs(prev - q) < 1e-6 ? prev : q));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, time]);

  const restart = useCallback(() => {
    time.set(0);
    setT(0);
  }, [time]);

  return { time, t, restart };
}

/** Width of an element, tracked with ResizeObserver. */
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** True while the document tab is visible. */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
