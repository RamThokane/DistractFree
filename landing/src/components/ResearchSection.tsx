'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ResearchSection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] },
    viewport: { once: true, margin: '-80px' },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const tagVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
  };

  return (
    <section
      id="research"
      className="relative w-full py-[100px] px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #080a18 50%, #050508 100%)',
      }}
    >
      <div className="max-w-[800px] mx-auto text-center">
        {/* Header */}
        <motion.div {...scrollAnimation} className="mb-10">
          <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-4">
            Research-Backed
          </p>
          <h2 className="text-[clamp(36px,4vw,52px)] font-bold tracking-[-2px] leading-tight text-text-primary">
            Grounded in behavioral science.
          </h2>
        </motion.div>

        {/* Body Paragraphs */}
        <motion.div {...scrollAnimation} className="space-y-6 text-left max-w-2xl mx-auto mb-12">
          <p className="text-[15px] leading-relaxed text-text-muted">
            DistractFree is built on decades of research in behavioral psychology, habit formation,
            and motivation theory. Our approach leverages variable-ratio reinforcement schedules —
            the same mechanism that makes games engaging — but applied to productivity.
          </p>
          <p className="text-[15px] leading-relaxed text-text-muted">
            Every feature is designed around three core principles: intrinsic motivation over external
            punishment, gradual habit formation over cold-turkey restrictions, and transparent AI
            that users can trust.
          </p>
        </motion.div>

        {/* Tag pills (flex-wrap) */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="flex flex-wrap justify-center gap-3 max-w-xl mx-auto"
        >
          {[
            'Self-Determination Theory',
            'Variable Reinforcement',
            'Habit Loop Research',
            'Flow State Psychology',
            'Behavioral Economics',
          ].map((tag, i) => (
            <motion.div
              key={i}
              variants={tagVariants}
              whileHover={{ y: -3, borderColor: 'rgba(124, 111, 239, 0.5)' }}
              className="px-4.5 py-2.5 rounded-full border border-white/5 bg-white/2 text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-brand-purple/5 spring-hover cursor-default"
            >
              {tag}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
