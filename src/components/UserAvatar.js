import React, { useEffect, useState } from 'react';

// Gravatar is keyed by a SHA-256 of the trimmed, lowercased email.
// d=404 makes it fail when the address has no picture, so we fall back to the initial.
const gravatarUrl = async (email, size) => {
  if (!email || !window.crypto?.subtle) return '';
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `https://gravatar.com/avatar/${hex}?s=${size * 2}&d=404`;
};

/**
 * The user's picture: their stored avatar (Google sign-in), else the Gravatar
 * for their email, else the first letter of their name.
 */
const UserAvatar = ({ user, size = 32, className = '' }) => {
  const [src, setSrc] = useState(user?.avatar || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (user?.avatar) {
      setSrc(user.avatar);
    } else {
      setSrc('');
      gravatarUrl(user?.email, size).then((url) => { if (alive) setSrc(url); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [user?.avatar, user?.email, size]);

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.44) };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`app-avatar object-cover ${className}`}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className={`app-avatar ${className}`} style={style} aria-hidden="true">{initial}</span>;
};

export default UserAvatar;
