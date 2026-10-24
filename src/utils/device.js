/**
 * DistractFree runs on a Chrome extension, which phones can't install.
 * Helpers to spot a phone or tablet (also in "Desktop site" mode) and the extension.
 */

export const EXTENSION_ZIP = '/distractfree-extension.zip';

/** True on phones and tablets, including when the browser asks for the desktop site. */
export function isMobileDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (navigator.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent)) return true;
  // iPadOS asks for desktop pages and reports itself as a Mac
  if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return true;
  // "Desktop site" on a phone: desktop user agent, but a touch-only, phone-sized screen
  const touchOnly = window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(any-pointer: fine)').matches;
  return Boolean(touchOnly && Math.min(window.screen.width, window.screen.height) < 820);
}

/** The extension marks our pages as soon as it loads (see extension/content.js). */
export const hasExtension = () =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-distractfree-extension') === '1';

/** Start downloading the extension zip. */
export function downloadExtension() {
  const a = document.createElement('a');
  a.href = EXTENSION_ZIP;
  a.download = 'distractfree-extension.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
