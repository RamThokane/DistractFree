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

      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          // Token invalid — clean up
          localStorage.removeItem('df_token');
          setToken(null);
        }
      } catch (err) {
        console.error('[Auth] Failed to fetch user:', err.message);
        localStorage.removeItem('df_token');
        setToken(null);
      } finally {
        setLoading(false);
      }
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
    const res = await api.post('/auth/register', { name, email, password });
    if (res.data.success) {
      localStorage.setItem('df_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    }
    throw new Error(res.data.message || 'Registration failed');
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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      googleLogin,
      logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
