import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

const AnimatedCounter = ({ value, duration = 1.5, prefix = '', suffix = '', className = '' }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const displayRef = useRef(null);

  useEffect(() => {
    // Show the starting number right away — a value of 0 never fires a 'change' event
    if (displayRef.current && !displayRef.current.textContent) {
      displayRef.current.textContent = `${prefix}${Math.round(count.get()).toLocaleString()}${suffix}`;
    }
    const controls = animate(count, value, { duration });
    return controls.stop;
  }, [value, count, duration, prefix, suffix]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = `${prefix}${v.toLocaleString()}${suffix}`;
      }
    });
    return unsubscribe;
  }, [rounded, prefix, suffix]);

  return <motion.span ref={displayRef} className={className} />;
};

export default AnimatedCounter;
