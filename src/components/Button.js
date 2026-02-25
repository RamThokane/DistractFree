import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const variants = {
    primary:
      'bg-gray-900 hover:bg-gray-800 text-white',
    accent:
      'bg-dash-accent hover:bg-dash-accent/90 text-white',
    ghost:
      'bg-transparent border border-dash-border text-dash-text hover:bg-dash-hover hover:border-dash-border-light',
    danger:
      'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100',
  };

  const sizes = {
    sm: 'py-2 px-5 text-sm',
    md: 'py-3 px-8 text-base',
    lg: 'py-4 px-10 text-lg',
  };

  return (
    <motion.button
      className={`
        font-medium rounded-xl transition-colors duration-150 active:scale-95
        flex items-center justify-center gap-2
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="text-lg">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
};

export default Button;
