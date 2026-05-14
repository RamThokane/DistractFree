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
      'bg-gradient-to-r from-[#7C5CFC] to-[#4FACFE] text-white shadow-[0_0_20px_rgba(124,92,252,0.25)] hover:shadow-[0_0_35px_rgba(124,92,252,0.4)]',
    accent:
      'bg-[rgba(124,92,252,0.1)] text-[#9B7FFF] border border-[rgba(124,92,252,0.2)] hover:bg-[rgba(124,92,252,0.18)] hover:shadow-[0_0_20px_rgba(124,92,252,0.15)]',
    ghost:
      'bg-transparent border border-[rgba(124,92,252,0.15)] text-[#C0B8FF] hover:bg-[rgba(124,92,252,0.06)] hover:border-[rgba(124,92,252,0.3)]',
    danger:
      'bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.2)] text-[#FF6B6B] hover:bg-[rgba(255,107,107,0.18)] hover:shadow-[0_0_15px_rgba(255,107,107,0.15)]',
  };

  const sizes = {
    sm: 'py-2 px-5 text-sm',
    md: 'py-3 px-8 text-base',
    lg: 'py-4 px-10 text-lg',
  };

  return (
    <motion.button
      className={`
        font-medium rounded-full transition-all duration-300 active:scale-95
        flex items-center justify-center gap-2
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      whileHover={!disabled ? { scale: 1.04 } : {}}
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
