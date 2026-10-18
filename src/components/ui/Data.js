import React from 'react';

/**
 * Stat — a mono number with a small label above and an optional delta.
 * deltaTone: up | down | coin | neutral.
 */
export const Stat = ({ label, value, delta, deltaTone = 'neutral', size = 'md', className = '', children }) => (
  <div className={`df-stat ${size !== 'md' ? `df-stat--${size}` : ''} ${className}`}>
    {label && <span className="df-label">{label}</span>}
    <span className="df-stat-value">{children ?? value}</span>
    {delta && <span className={`df-stat-delta ${deltaTone !== 'neutral' ? `df-stat-delta--${deltaTone}` : ''}`}>{delta}</span>}
  </div>
);

/** ProgressRing — circular progress with a mono label in the middle. */
export const ProgressRing = ({ value = 0, max = 100, size = 120, stroke = 6, color, label, sublabel, labelSize, className = '', title }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div
      className={`df-ring ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={title}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle className="df-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="df-ring-bar"
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={color ? { stroke: color } : undefined}
        />
      </svg>
      {(label || sublabel) && (
        <div className="df-ring-center">
          {label && <span className="df-ring-label" style={{ fontSize: labelSize || Math.round(size * 0.18) }}>{label}</span>}
          {sublabel && <span className="df-ring-sub">{sublabel}</span>}
        </div>
      )}
    </div>
  );
};

/** ProgressBar — thin horizontal bar; tone: accent | amber | danger | muted. */
export const ProgressBar = ({ value = 0, max = 100, label, valueLabel, tone = 'accent', className = '' }) => {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) * 100 : 0;
  return (
    <div className={`df-bar ${tone !== 'accent' ? `df-bar--${tone}` : ''} ${className}`}>
      {(label || valueLabel) && (
        <div className="df-bar-head"><span>{label}</span>{valueLabel && <strong>{valueLabel}</strong>}</div>
      )}
      <div className="df-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={typeof label === 'string' ? label : undefined}>
        <div className="df-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
