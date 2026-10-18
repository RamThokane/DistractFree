import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const GoogleAuthButton = ({ onSuccess, onError }) => {
  const { googleLogin } = useAuth();
  const { isDark } = useTheme();
  const boxRef = useRef(null);
  // Google renders a fixed-width iframe; match it to our column (max 400px, Google's limit)
  const [width, setWidth] = useState(400);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.min(400, Math.floor(entry.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleCredentialResponse = async (credentialResponse) => {
    try {
      // credentialResponse.credential is the ID token JWT from Google
      await googleLogin(credentialResponse.credential);
      if (onSuccess) onSuccess(credentialResponse);
    } catch (err) {
      console.error('[GoogleAuth] Error:', err);
      if (onError) onError(err);
    }
  };

  return (
    <div ref={boxRef} className="w-full flex justify-center overflow-hidden min-h-[44px]">
      <GoogleLogin
        key={`${isDark ? 'dark' : 'light'}-${width}`}
        onSuccess={handleCredentialResponse}
        onError={() => {
          console.error('[GoogleAuth] Login failed');
          if (onError) onError(new Error('Google login failed'));
        }}
        theme={isDark ? 'filled_black' : 'outline'}
        size="large"
        width={String(width)}
        text="continue_with"
        shape="rectangular"
        logo_alignment="center"
      />
    </div>
  );
};

export default GoogleAuthButton;
