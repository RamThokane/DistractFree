import React, { useId } from 'react';
import { LuInbox, LuTriangleAlert } from 'react-icons/lu';

/** Tooltip — shows on hover and keyboard focus; the text is linked with aria-describedby. */
export const Tooltip = ({ text, side = 'top', children }) => {
  const id = useId();
  const child = React.Children.only(children);
  return (
    <span className="df-tip-wrap">
      {React.cloneElement(child, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className={`df-tip ${side === 'bottom' ? 'df-tip--bottom' : ''}`}>{text}</span>
    </span>
  );
};

/** EmptyState — say what's missing and give the one action that fixes it. */
export const EmptyState = ({ icon: Icon = LuInbox, title, children, action, center = false, className = '' }) => (
  <div className={`df-empty ${center ? 'df-empty--center' : ''} ${className}`}>
    {Icon && <Icon className="df-empty-icon" size={22} aria-hidden="true" />}
    <p className="df-empty-title">{title}</p>
    {children && <p className="df-empty-text">{children}</p>}
    {action && <div className="df-empty-action">{action}</div>}
  </div>
);

/** ErrorState — same shape as EmptyState, for failed loads. Always offer a retry. */
export const ErrorState = ({ title = 'That didn’t load', children = 'Something went wrong on our side. Try again in a moment.', action, center, className = '' }) => (
  <EmptyState icon={LuTriangleAlert} title={title} action={action} center={center} className={`df-empty--error ${className}`}>
    {children}
  </EmptyState>
);

/** Skeleton — a placeholder block. Size it with width/height or Tailwind classes. */
export const Skeleton = ({ width, height = 16, radius, className = '', style }) => (
  <span
    aria-hidden="true"
    className={`df-skel ${className}`}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/** A few skeleton lines with a ragged right edge, for text blocks. */
export const SkeletonText = ({ lines = 3, className = '' }) => (
  <span className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} height={12} width={i === lines - 1 ? '62%' : i % 2 ? '88%' : '100%'} />
    ))}
  </span>
);
