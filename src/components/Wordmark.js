import React from 'react';

/**
 * The brand name as it appears in the landing navigation: serif, with
 * "Free" in italic green. Use it wherever "DistractFree" is shown as text.
 * Plain strings (toasts, errors, aria-labels, page titles) stay plain.
 */
const Wordmark = ({ className = '' }) => (
  <span className={`df-wordmark ${className}`}>
    Distract<em>Free</em>
  </span>
);

export default Wordmark;
