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
    bg-[rgba(15,19,41,0.6)] backdrop-blur-xl
    border border-[rgba(124,92,252,0.1)]
    rounded-2xl ${padding}
    shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.03)]
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
