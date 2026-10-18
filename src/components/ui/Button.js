import React from 'react';

/**
 * Button — primary | secondary | ghost | danger | danger-outline.
 * Pass `as={Link}` (plus `to`) or `as="a"` (plus `href`) to render a link
 * that looks like a button. `loading` keeps the width and shows a spinner.
 */
const Button = React.forwardRef(function Button(
  { as: Comp = 'button', variant = 'primary', size = 'md', block = false, iconOnly = false,
    loading = false, disabled = false, icon = null, iconRight = null, className = '', children, type, ...props },
  ref
) {
  const isButton = Comp === 'button';
  const classes = [
    'df-btn', `df-btn--${variant}`,
    size !== 'md' && `df-btn--${size}`,
    block && 'df-btn--block',
    iconOnly && 'df-btn--icon',
    loading && 'is-loading',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Comp
      ref={ref}
      className={classes}
      {...(isButton ? { type: type || 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || undefined })}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="df-btn-spinner" aria-hidden="true" />}
      {icon}
      {children}
      {iconRight}
    </Comp>
  );
});

export default Button;
