import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { LuCircleCheck, LuCircleAlert, LuInfo, LuCoins, LuX } from 'react-icons/lu';

const ToastContext = createContext(null);

const ICONS = { success: LuCircleCheck, error: LuCircleAlert, info: LuInfo, reward: LuCoins };

/**
 * <ToastProvider> once near the root, then:
 *   const toast = useToast();
 *   toast.success('Saved');  toast.error('Couldn’t save', 'Check your connection');
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback((tone, title, text, { duration = 4500 } = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, title, text }]);
    if (duration) window.setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    show,
    dismiss,
    success: (title, text, o) => show('success', title, text, o),
    error: (title, text, o) => show('error', title, text, o),
    info: (title, text, o) => show('info', title, text, o),
    reward: (title, text, o) => show('reward', title, text, o),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="df-toasts" role="region" aria-label="Notifications">
        {toasts.map(({ id, tone, title, text }) => {
          const Icon = ICONS[tone] || LuInfo;
          return (
            <div key={id} className={`df-toast df-toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
              <Icon className="df-toast-icon" size={18} aria-hidden="true" />
              <div className="df-toast-body">
                <p className="df-toast-title">{title}</p>
                {text && <p className="df-toast-text">{text}</p>}
              </div>
              <button type="button" className="df-toast-close" onClick={() => dismiss(id)} aria-label="Dismiss notification">
                <LuX size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/** Falls back to a no-op so components still render outside the provider (e.g. in tests). */
export const useToast = () => {
  const ctx = useContext(ToastContext);
  return ctx || { show() {}, dismiss() {}, success() {}, error() {}, info() {}, reward() {} };
};
