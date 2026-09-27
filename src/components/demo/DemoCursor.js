import React from 'react';
import { motion, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { CURSOR_MOVES, CURSOR_CLICKS, CURSOR_HIDDEN, seg } from './demoTimeline';

/* Minimum-jerk profile — the velocity curve of a human reaching movement */
const minJerk = (p) => p * p * p * (10 - 15 * p + 6 * p * p);

function cursorAt(v, resolve) {
  let pos = resolve(CURSOR_MOVES[0].to);
  let kind;
  for (const move of CURSOR_MOVES) {
    if (v < move.start) break;
    const to = resolve(move.to);
    if (v >= move.end) {
      pos = to;
      kind = move.kind;
      continue;
    }
    // Mid-move: ease along a slight arc, like a wrist pivoting
    const p = minJerk(seg(v, move.start, move.end));
    const dx = to.x - pos.x;
    const dy = to.y - pos.y;
    const arc = Math.sin(Math.PI * p) * 0.08;
    pos = { x: pos.x + dx * p - dy * arc, y: pos.y + dy * p + dx * arc };
    kind = p > 0.85 ? move.kind : undefined;
    break;
  }
  return { pos, kind };
}

function visibilityAt(v) {
  let opacity = 1;
  for (const [a, b] of CURSOR_HIDDEN) {
    if (v >= a && v < b) return 0;
    const dist = v < a ? a - v : v - b;
    opacity = Math.min(opacity, Math.min(1, dist / 0.2));
  }
  return opacity;
}

function clickAt(v) {
  let press = 0;
  let ripple = null;
  for (const c of CURSOR_CLICKS) {
    press = Math.max(press, 1 - Math.abs(v - c) / 0.12);
    if (v >= c && v - c < 0.55) ripple = (v - c) / 0.55;
  }
  return { press: Math.max(0, press), ripple };
}

const Arrow = () => (
  <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
    <path d="M2 1.5v19.2l4.9-4.6 3.2 7.4 3.4-1.5-3.2-7.2h6.9L2 1.5z" fill="#0b0b0f" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const Hand = () => (
  <svg width="24" height="26" viewBox="0 0 24 26" fill="none" style={{ marginLeft: -6 }}>
    <path
      d="M9 2.6c-1 0-1.8.8-1.8 1.8v9.1l-1.4-1.5c-.8-.8-2-.8-2.7 0-.7.7-.7 1.8-.1 2.6l4.8 6.3c1.2 1.6 3 2.5 5 2.5h2.3c3.3 0 6-2.7 6-6v-5.7c0-1-.8-1.7-1.7-1.7-.5 0-1 .2-1.3.6v-.6c0-1-.8-1.7-1.8-1.7-.6 0-1.1.3-1.4.7-.2-.8-.9-1.3-1.7-1.3-.6 0-1.1.3-1.4.7V4.4C10.8 3.4 10 2.6 9 2.6z"
      fill="#fff" stroke="#0b0b0f" strokeWidth="1.3" strokeLinejoin="round"
    />
  </svg>
);

const IBeam = () => (
  <svg width="12" height="22" viewBox="0 0 12 22" fill="none" style={{ marginLeft: -6, marginTop: -10 }}>
    <path d="M2 1.5h2.5c.8 0 1.5.7 1.5 1.5 0-.8.7-1.5 1.5-1.5H10M2 20.5h2.5c.8 0 1.5-.7 1.5-1.5 0 .8.7 1.5 1.5 1.5H10M6 3v16" stroke="#0b0b0f" strokeWidth="3" strokeLinecap="round" />
    <path d="M2 1.5h2.5c.8 0 1.5.7 1.5 1.5 0-.8.7-1.5 1.5-1.5H10M2 20.5h2.5c.8 0 1.5-.7 1.5-1.5 0 .8.7 1.5 1.5 1.5H10M6 3v16" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/**
 * Pointer that follows the demo script. Positions are recomputed every frame
 * from the clock MotionValue, so movement is smooth without re-rendering React.
 * `resolve(to)` turns a script target into virtual-pixel coordinates.
 */
export default function DemoCursor({ time, resolve, kindHint }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const press = useMotionValue(1);
  const rippleScale = useMotionValue(0.4);
  const rippleOpacity = useMotionValue(0);
  const [kind, setKind] = React.useState(undefined);

  const update = React.useCallback(
    (v) => {
      const { pos, kind: k } = cursorAt(v, resolve);
      x.set(pos.x);
      y.set(pos.y);
      opacity.set(visibilityAt(v));
      const click = clickAt(v);
      press.set(1 - 0.16 * click.press);
      rippleScale.set(click.ripple === null ? 0.4 : 0.4 + click.ripple * 1.9);
      rippleOpacity.set(click.ripple === null ? 0 : 0.55 * (1 - click.ripple));
      setKind((prev) => (prev === k ? prev : k));
    },
    [resolve, x, y, opacity, press, rippleScale, rippleOpacity]
  );

  useMotionValueEvent(time, 'change', update);
  // Re-place when paused and the layout changes (resize, remount)
  React.useEffect(() => update(time.get()), [kindHint, update, time]);

  return (
    <motion.div className="pd-cursor" style={{ x, y, opacity }} aria-hidden="true">
      <motion.span className="pd-cursor-ripple" style={{ scale: rippleScale, opacity: rippleOpacity }} />
      <motion.div style={{ scale: press, originX: 0, originY: 0 }}>
        {kind === 'hand' ? <Hand /> : kind === 'text' ? <IBeam /> : <Arrow />}
      </motion.div>
    </motion.div>
  );
}
