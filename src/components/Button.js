import React from 'react';
import UIButton from './ui/Button';

/* Legacy variant names → shared Button variants */
const VARIANT = { primary: 'primary', accent: 'secondary', ghost: 'ghost', danger: 'danger-outline', secondary: 'secondary' };

/** Legacy API (variant, size, icon, loading) over the shared Button. */
const Button = ({ variant = 'primary', size = 'md', icon, children, ...props }) => (
  <UIButton
    variant={VARIANT[variant] || 'primary'}
    size={size}
    icon={icon ? <span className="inline-flex text-base" aria-hidden="true">{icon}</span> : null}
    {...props}
  >
    {children}
  </UIButton>
);

export default Button;
