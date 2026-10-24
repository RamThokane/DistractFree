import React, { useState } from 'react';
import { LuMonitor } from 'react-icons/lu';
import { isMobileDevice } from '../utils/device';

/**
 * Shown on phones and tablets only, on every page load: DistractFree needs
 * its Chrome extension, so focus sessions and blocking only work on a laptop
 * or desktop. A solid card over a dimmed page, so it reads clearly on any background.
 */
const MobileNotice = () => {
  const [show, setShow] = useState(isMobileDevice);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mobile-notice-title"
        aria-describedby="mobile-notice-text"
        className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
        style={{
          background: 'rgb(var(--c-surface, 255 255 255))',
          color: 'rgb(var(--c-ink, 28 27 25))',
          border: '1px solid rgb(var(--c-line, 0 0 0) / 0.18)',
        }}
      >
        <LuMonitor className="text-accent" size={28} aria-hidden="true" />
        <h2 id="mobile-notice-title" className="text-lg font-semibold mt-3">Use DistractFree on a laptop or PC</h2>
        <div id="mobile-notice-text" className="text-sm leading-relaxed mt-2 space-y-2">
          <p>DistractFree works through a Chrome extension, and phones can't install extensions.</p>
          <p>You can sign in and check your stats on your phone, but you can't start focus sessions or block sites here. For the full experience, open distractfree.site in Chrome on a laptop or desktop computer.</p>
        </div>
        <button type="button" onClick={() => setShow(false)} className="df-btn df-btn--primary w-full mt-5">
          I understand
        </button>
      </div>
    </div>
  );
};

export default MobileNotice;
