import React from 'react';

const CircularProgress = ({ value = 0, max = 100, size = 160, strokeWidth = 10, color = '#7C5CFC', label, sublabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full animate-pulse-slow"
        style={{
          boxShadow: `0 0 ${size * 0.15}px ${color}22, 0 0 ${size * 0.3}px ${color}11`,
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(124, 92, 252, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc with glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out',
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-2xl font-bold text-[#F0EEFF]">{label}</span>}
        {sublabel && <span className="text-xs text-[#8B8AA8] mt-1">{sublabel}</span>}
      </div>
    </div>
  );
};

export default CircularProgress;
