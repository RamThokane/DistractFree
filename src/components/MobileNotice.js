import React, { useState } from 'react';
import { LuMonitor, LuX } from 'react-icons/lu';
import { isMobileDevice } from '../utils/device';

const DISMISS_KEY = 'df_mobile_notice_dismissed';

const wasDismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

/**
 * Shown on phones and tablets only: DistractFree needs its Chrome extension,
 * so focus sessions and blocking only work on a laptop or desktop.
 */
const MobileNotice = () => {
  const [show, setShow] = useState(() => isMobileDevice() && !wasDismissed());
  if (!show) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
    setShow(false);
  };

  return (
    <div
      role="note"
      aria-label="Best on a computer"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl border border-line bg-surface text-text shadow-lg p-4 flex gap-3"
    >
      <LuMonitor className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">Use DistractFree on a laptop or PC</p>
        <p className="text-muted mt-1">
          DistractFree works through a Chrome extension, which phones can't install. You can sign in and see your
          stats here, but focus sessions and site blocking need Chrome on a laptop or desktop computer.
        </p>
      </div>
      <button type="button" onClick={dismiss} className="self-start p-1 -m-1 text-muted hover:text-text" aria-label="Dismiss">
        <LuX size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default MobileNotice;
