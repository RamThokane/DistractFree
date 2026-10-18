import React, { useRef } from 'react';

/**
 * Tabs — tab strip with arrow-key support. Controlled:
 * items=[{ value, label }], value, onChange(value). variant="pill" for a
 * compact segmented look.
 */
const Tabs = ({ items, value, onChange, variant = 'line', label = 'Tabs', className = '' }) => {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  };
  return (
    <div role="tablist" aria-label={label} className={`df-tabs ${variant === 'pill' ? 'df-tabs--pill' : ''} ${className}`}>
      {items.map((it, i) => (
        <button
          key={it.value}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          tabIndex={value === it.value ? 0 : -1}
          className="df-tab"
          onClick={() => onChange(it.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
