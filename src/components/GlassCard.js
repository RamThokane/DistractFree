import React from 'react';
import { motion } from 'framer-motion';

const GlassCard = ({
  children,
  className = '',
  hover = false,
  glow = false,
  padding = 'p-6',
  onClick,
  ...props
}) => {
  const baseClasses = `bg-white border border-dash-border rounded-2xl shadow-dash-card ${padding}`;
  const hoverClasses = hover
    ? 'transition-all duration-150 hover:shadow-card-hover hover:border-dash-border-light cursor-pointer'
    : '';

  return (
    <motion.div
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
