'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════
   TYPES
   ═══════════════════════════════════════ */

export interface CursorWaypoint {
  /** Progress within the scene (0–1) at which cursor should reach this position */
  atProgress: number;
  /** X position as % of content area width (0–100) */
  x: number;
  /** Y position as % of content area height (0–100) */
  y: number;
  /** Trigger a click animation when cursor reaches this waypoint */
  click?: boolean;
  /** Hide cursor at this point and beyond (within this scene) */
  hidden?: boolean;
}

interface AnimatedCursorProps {
  waypoints: CursorWaypoint[];
  progress: number;
  isPlaying: boolean;
  sceneKey: number;
}

/* ═══════════════════════════════════════
   INTERPOLATION
   ═══════════════════════════════════════ */

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function interpolatePosition(
  waypoints: CursorWaypoint[],
  progress: number
): { x: number; y: number } {
  if (waypoints.length === 0) return { x: 50, y: 50 };
  if (waypoints.length === 1) return { x: waypoints[0].x, y: waypoints[0].y };

  // Clamp progress
  const p = Math.max(0, Math.min(1, progress));

  // If before first waypoint
  if (p <= waypoints[0].atProgress) {
    return { x: waypoints[0].x, y: waypoints[0].y };
  }

  // If after last waypoint
  if (p >= waypoints[waypoints.length - 1].atProgress) {
    const last = waypoints[waypoints.length - 1];
    return { x: last.x, y: last.y };
  }

  // Find surrounding waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    const curr = waypoints[i];
    const next = waypoints[i + 1];
    if (p >= curr.atProgress && p < next.atProgress) {
      const segLen = next.atProgress - curr.atProgress;
      const segProgress = segLen > 0 ? (p - curr.atProgress) / segLen : 0;
      const eased = easeInOutCubic(segProgress);
      return {
        x: curr.x + (next.x - curr.x) * eased,
        y: curr.y + (next.y - curr.y) * eased,
      };
    }
  }

  const last = waypoints[waypoints.length - 1];
  return { x: last.x, y: last.y };
}

/* ═══════════════════════════════════════
   CURSOR COMPONENT
   ═══════════════════════════════════════ */

export default function AnimatedCursor({
  waypoints,
  progress,
  isPlaying,
  sceneKey,
}: AnimatedCursorProps) {
  const [showRipple, setShowRipple] = useState(false);
  const triggeredClicks = useRef(new Set<number>());

  // Reset triggered clicks when scene changes
  useEffect(() => {
    triggeredClicks.current.clear();
  }, [sceneKey]);

  // Detect click waypoints
  useEffect(() => {
    if (!isPlaying) return;
    for (const wp of waypoints) {
      if (
        wp.click &&
        !triggeredClicks.current.has(wp.atProgress) &&
        Math.abs(progress - wp.atProgress) < 0.025
      ) {
        triggeredClicks.current.add(wp.atProgress);
        setShowRipple(true);
        const timer = setTimeout(() => setShowRipple(false), 350);
        return () => clearTimeout(timer);
      }
    }
  }, [progress, waypoints, isPlaying]);

  // Check for hidden flag
  const isHidden = waypoints.some(
    (wp) => wp.hidden && progress >= wp.atProgress
  );

  // Respect prefers-reduced-motion
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  if (!isPlaying || isHidden || prefersReduced) return null;

  const pos = interpolatePosition(waypoints, progress);

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-1px, -1px)',
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="18"
        height="22"
        viewBox="0 0 18 22"
        fill="none"
        className={`drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform duration-100 ${
          showRipple ? 'scale-[0.82]' : 'scale-100'
        }`}
      >
        <path
          d="M1 1L1 17.5L5.5 13L10 20L13 18.5L8.5 11.5L14.5 11.5L1 1Z"
          fill="white"
          stroke="#222"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Click ripple */}
      <AnimatePresence>
        {showRipple && (
          <motion.div
            className="absolute left-1 top-1 w-5 h-5 rounded-full border-[1.5px] border-brand-purple/50"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
