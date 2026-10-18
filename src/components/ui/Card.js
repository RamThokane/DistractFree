import React from 'react';

/**
 * Card — variant: "outlined" (default), "band" (tinted, no border) or
 * "plain" (no box, just a top rule). Vary them; don't make every box the same.
 */
const Card = React.forwardRef(function Card(
  { as: Comp = 'div', variant = 'outlined', padding = 'p-6', interactive = false, title, action, className = '', children, ...props },
  ref
) {
  const cls = [
    'df-card',
    variant !== 'outlined' && `df-card--${variant}`,
    interactive && 'df-card--interactive',
    variant === 'plain' ? padding.replace(/\bp-(\d+)/, 'py-$1') : padding,
    className,
  ].filter(Boolean).join(' ');
  return (
    <Comp ref={ref} className={cls} {...props}>
      {(title || action) && (
        <div className="df-card-head">
          {title && <h3 className="df-card-title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </Comp>
  );
});

export default Card;
