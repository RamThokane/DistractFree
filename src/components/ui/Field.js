import React, { useId, useState } from 'react';
import { LuEye, LuEyeOff, LuCircleAlert } from 'react-icons/lu';

/** Label above the control, then an error (if any) or a hint. */
export const Field = ({ id, label, hint, error, children, className = '' }) => (
  <div className={`df-field ${className}`}>
    {label && <label htmlFor={id} className="df-field-label">{label}</label>}
    {children}
    {error ? (
      <p id={`${id}-msg`} className="df-field-error" role="alert">
        <LuCircleAlert size={14} aria-hidden="true" />{error}
      </p>
    ) : hint ? (
      <p id={`${id}-msg`} className="df-field-hint">{hint}</p>
    ) : null}
  </div>
);

/**
 * Input — text-like inputs with a visible label. type="password" gets a
 * show/hide button automatically.
 */
export const Input = React.forwardRef(function Input(
  { id: idProp, label, hint, error, type = 'text', className = '', fieldClassName = '', ...props },
  ref
) {
  const auto = useId();
  const id = idProp || `in-${auto}`;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <Field id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className="df-control">
        <input
          ref={ref}
          id={id}
          type={isPassword && reveal ? 'text' : type}
          className={`df-input ${isPassword ? 'df-input--with-action' : ''} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="df-input-action"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
          >
            {reveal ? <LuEyeOff size={18} /> : <LuEye size={18} />}
          </button>
        )}
      </div>
    </Field>
  );
});

/** Select — native <select>, styled. Pass options as [{ value, label }] or children. */
export const Select = React.forwardRef(function Select(
  { id: idProp, label, hint, error, options, children, className = '', fieldClassName = '', ...props },
  ref
) {
  const auto = useId();
  const id = idProp || `sel-${auto}`;
  return (
    <Field id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <select
        ref={ref}
        id={id}
        className={`df-select ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...props}
      >
        {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
      </select>
    </Field>
  );
});
