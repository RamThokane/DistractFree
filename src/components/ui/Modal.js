import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LuX } from 'react-icons/lu';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: focuses its first control, keeps Tab inside, closes on
 * Escape or a backdrop click, and gives focus back to what opened it.
 * `footer` renders a right-aligned action row.
 */
const Modal = ({ title, onClose, children, footer, labelledBy = 'df-modal-title', maxWidth = 'max-w-lg' }) => {
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
      className="df-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`df-modal ${maxWidth}`}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="df-modal-head">
          <h2 id={labelledBy} className="df-modal-title">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="df-btn df-btn--ghost df-btn--sm df-btn--icon -mr-2 -mt-1">
            <LuX size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="df-modal-foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
};

export default Modal;
