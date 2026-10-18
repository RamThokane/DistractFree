import React from 'react';
import { ProgressRing } from './ui';

/* Old brand purples/indigos map to the accent; meaningful colours pass through. */
const LEGACY_BRAND = ['#7c5cfc', '#7e8cf6', '#6366f1', '#5c6bc0', '#9b7fff', '#00d4c8', '#00d4aa'];

/** Legacy API over the shared ProgressRing. */
const CircularProgress = ({ value = 0, max = 100, size = 160, strokeWidth = 10, color, label, sublabel }) => {
  const c = color && !LEGACY_BRAND.includes(String(color).toLowerCase()) ? color : undefined;
  return (
    <ProgressRing
      value={value}
      max={max}
      size={size}
      stroke={Math.max(4, Math.round(strokeWidth * 0.7))}
      color={c}
      label={label}
      sublabel={sublabel}
      labelSize={Math.round(size * 0.16)}
    />
  );
};

export default CircularProgress;
