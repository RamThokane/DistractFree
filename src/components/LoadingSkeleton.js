import React from 'react';
import { motion } from 'framer-motion';

const LoadingSkeleton = ({ variant = 'card', count = 1 }) => {
  const variants = {
    card: 'h-40 rounded-2xl',
    line: 'h-5 rounded-xl',
    circle: 'h-20 w-20 rounded-full',
    stat: 'h-28 rounded-2xl',
  };

  return (
    <>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className={`skeleton w-full ${variants[variant]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
    </>
  );
};

export default LoadingSkeleton;
