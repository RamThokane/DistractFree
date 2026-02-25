import React from 'react';
import { motion } from 'framer-motion';

const LoadingSkeleton = ({ variant = 'card', count = 1 }) => {
  const variants = {
    card: 'h-40 rounded-[24px]',
    line: 'h-5 rounded-xl',
    circle: 'h-20 w-20 rounded-full',
    stat: 'h-28 rounded-[24px]',
  };

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className={`bg-white/5 backdrop-blur-sm border border-white/5 animate-pulse ${variants[variant]} w-full`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
    </>
  );
};

export default LoadingSkeleton;
