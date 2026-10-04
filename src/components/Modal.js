import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HiOutlineXMark } from 'react-icons/hi2';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focuses its first control, keeps Tab inside, closes on
 * Escape or a backdrop click, and gives focus back to what opened it.
 */
const Modal = ({ title, onClose, children, labelledBy = 'df-modal-title', maxWidth = 'max-w-lg' }) => {
  const panelRef = useRef(null);
  // Latest onClose without re-running the focus setup on every parent render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const [start, end] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === start) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        start.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`df-card-bg w-full ${maxWidth} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 shadow-2xl border border-ink/[0.06] focus:outline-none`}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 id={labelledBy} className="text-lg font-bold text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1.5 rounded-lg text-fg-2 hover:text-fg hover:bg-ink/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};

export default Modal;
