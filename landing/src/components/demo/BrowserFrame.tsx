'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowserFrameProps {
  url: string;
  children: React.ReactNode;
  showExtensionGlow?: boolean;
  typingText?: string;
  typingProgress?: number; // 0-1
}

export default function BrowserFrame({
  url,
  children,
  showExtensionGlow = false,
  typingText,
  typingProgress = 0,
}: BrowserFrameProps) {
  const isTyping = typingText && typingProgress > 0 && typingProgress < 1;
  const typedChars = typingText
    ? Math.floor(typingProgress * typingText.length)
    : 0;
  const displayUrl = isTyping ? typingText.slice(0, typedChars) : url;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_8px_60px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)] bg-[#0c0e14]">
      {/* ═══ Title Bar ═══ */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1d28] border-b border-white/[0.06]">
        {/* Traffic lights */}
        <div className="flex gap-[7px] mr-4 shrink-0">
          <div className="w-[11px] h-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
          <div className="w-[11px] h-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
          <div className="w-[11px] h-[11px] rounded-full bg-[#28c840] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
        </div>

        {/* Tab */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0c0e14] rounded-t-lg border border-white/[0.06] border-b-0 text-xs min-w-0 max-w-[180px]">
          <div className="w-4 h-4 rounded-[4px] bg-brand-purple/20 flex items-center justify-center shrink-0">
            <span className="text-[7px] font-bold text-brand-purple">DF</span>
          </div>
          <span className="text-text-primary/60 font-medium truncate text-[11px]">
            DistractFree
          </span>
          <span className="text-text-muted/30 text-[10px] ml-auto shrink-0">×</span>
        </div>

        <div className="flex-1" />
      </div>

      {/* ═══ Address Bar ═══ */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#141720] border-b border-white/[0.06]">
        {/* Nav buttons */}
        <div className="flex gap-2 shrink-0">
          <span className="text-[10px] text-text-muted/30 select-none">◀</span>
          <span className="text-[10px] text-text-muted/30 select-none">▶</span>
          <span className="text-[10px] text-text-muted/30 select-none">↻</span>
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-[5px] bg-[#0c0e14] rounded-lg border border-white/[0.06] min-w-0">
          <span className="text-[10px] text-green-400/60 shrink-0">🔒</span>
          <div className="flex-1 min-w-0 relative">
            <AnimatePresence mode="wait">
              <motion.span
                key={displayUrl}
                className="text-[11px] text-text-muted font-mono truncate block"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15 }}
              >
                {displayUrl}
              </motion.span>
            </AnimatePresence>
            {/* Typing cursor */}
            {isTyping && (
              <motion.span
                className="inline-block w-[1px] h-3 bg-brand-purple ml-[1px] absolute top-1/2 -translate-y-1/2"
                style={{ left: `${typedChars * 6.6}px` }}
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
          </div>
        </div>

        {/* Extension icon */}
        <div
          className={`w-6 h-6 rounded-[5px] flex items-center justify-center text-[11px] shrink-0 transition-all duration-500 ${
            showExtensionGlow
              ? 'bg-brand-purple/20 text-brand-purple shadow-[0_0_12px_rgba(124,111,239,0.35)]'
              : 'text-text-muted/30 bg-white/[0.02]'
          }`}
        >
          🧩
        </div>
      </div>

      {/* ═══ Content Area ═══ */}
      <div
        className="relative overflow-hidden bg-[#0a0c12]"
        style={{ height: 'clamp(320px, 42vw, 460px)' }}
      >
        {children}
      </div>
    </div>
  );
}
