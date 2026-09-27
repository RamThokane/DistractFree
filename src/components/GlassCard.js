import React from 'react';
import { motion } from 'framer-motion';

const GlassCard = ({
  children,
  className = '',
  hover = false,
  padding = 'p-6',
  onClick,
  ...props
}) => {
  const baseClasses = `
    relative overflow-hidden
    bg-[rgb(var(--surface)/var(--card-alpha))] backdrop-blur-xl
    border border-[color:var(--card-border)]
    rounded-2xl ${padding}
    shadow-[var(--card-shadow)]
  `;
  const hoverClasses = hover
    ? 'transition-all duration-500 hover:border-[rgba(124,92,252,0.2)] hover:shadow-[0_12px_48px_rgba(124,92,252,0.1)] hover:-translate-y-1 cursor-pointer'
    : '';

  return (
    <motion.div
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : {}}
      {...props}
    >
      {/* Subtle gradient sheen on top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.15)] to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export default GlassCard;
