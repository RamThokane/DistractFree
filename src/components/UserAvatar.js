import React, { useEffect, useState } from 'react';

/** The user's profile photo from their Google account, else the first letter of their name. */
const UserAvatar = ({ user, size = 32, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [user?.avatar]);

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.44) };

  if (user?.avatar && !failed) {
    return (
      <img
        src={user.avatar}
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
