import React from 'react';

/** Toggle — an accessible switch. Controlled: `checked` + `onChange(next)`. */
export const Toggle = ({ checked, onChange, label, disabled = false, className = '', ...props }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    disabled={disabled}
    onClick={() => onChange && onChange(!checked)}
    className={`df-toggle ${className}`}
    {...props}
  >
    <span className="df-toggle-track" aria-hidden="true"><span className="df-toggle-thumb" /></span>
    {label && <span>{label}</span>}
  </button>
);

/** Checkbox — native input, styled. */
export const Checkbox = ({ label, className = '', ...props }) => (
  <label className={`df-check ${className}`}>
    <input type="checkbox" {...props} />
    <span>{label}</span>
  </label>
);
