import React from 'react';

/** Badge / Tag — tone: neutral | accent | amber (coins) | danger. */
const Badge = ({ tone = 'neutral', mono = false, dot = false, className = '', children, ...props }) => (
  <span
    className={['df-badge', tone !== 'neutral' && `df-badge--${tone}`, mono && 'df-badge--mono', className].filter(Boolean).join(' ')}
    {...props}
  >
    {dot && <span className="df-badge-dot" aria-hidden="true" />}
    {children}
  </span>
);

export default Badge;
