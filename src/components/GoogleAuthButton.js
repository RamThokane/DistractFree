import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const GoogleAuthButton = ({ onSuccess, onError }) => {
  const { googleLogin } = useAuth();
  const { isDark } = useTheme();

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
    <div className="w-full [&>div]:w-full [&>div>div]:w-full [&_iframe]:w-full">
      <GoogleLogin
        key={isDark ? 'dark' : 'light'}
        onSuccess={handleCredentialResponse}
        onError={() => {
          console.error('[GoogleAuth] Login failed');
          if (onError) onError(new Error('Google login failed'));
        }}
        theme={isDark ? 'filled_black' : 'outline'}
        size="large"
        width="400"
        text="continue_with"
        shape="rectangular"
        logo_alignment="center"
      />
    </div>
  );
};

export default GoogleAuthButton;
