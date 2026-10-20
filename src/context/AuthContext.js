import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('df_token'));
  const [loading, setLoading] = useState(true);

  // Fetch current user from backend when token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      // Only a rejected token signs the user out. A slow or unreachable server
      // (cold start, network blip) is retried and the saved sign-in is kept.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await api.get('/auth/me', { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
          if (res.data.success) {
            // Renewed token: stays valid as long as the user keeps visiting.
            // Saved without setToken so this effect doesn't run again.
            if (res.data.token) localStorage.setItem('df_token', res.data.token);
            setUser(res.data.user);
          }
          break;
        } catch (err) {
          if (err.response?.status === 401) {
            localStorage.removeItem('df_token');
            setToken(null);
            break;
          }
          console.error('[Auth] Failed to fetch user:', err.message);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      localStorage.setItem('df_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    }
    throw new Error(res.data.message || 'Login failed');
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      if (res.data.success) {
        localStorage.setItem('df_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      throw new Error(res.data.message || 'Registration failed');
    } catch (err) {
      // Re-throw so the calling component can read err.response.data
      throw err;
    }
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const res = await api.post('/auth/google', { credential });
    if (res.data.success) {
      localStorage.setItem('df_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    }
    throw new Error(res.data.message || 'Google login failed');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('df_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      googleLogin,
      logout,
      updateUser,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
