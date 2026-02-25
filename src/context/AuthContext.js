import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockUser } from '../utils/mockData';

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

  useEffect(() => {
    // Simulate checking token validity
    if (token) {
      // In production, validate token with backend
      setTimeout(() => {
        setUser(mockUser);
        setLoading(false);
      }, 500);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    // Mock login — replace with real API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const fakeToken = 'mock_jwt_' + Date.now();
        localStorage.setItem('df_token', fakeToken);
        setToken(fakeToken);
        setUser(mockUser);
        resolve({ success: true });
      }, 800);
    });
  }, []);

  const register = useCallback(async (name, email, password) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const fakeToken = 'mock_jwt_' + Date.now();
        localStorage.setItem('df_token', fakeToken);
        setToken(fakeToken);
        setUser({ ...mockUser, name, email });
        resolve({ success: true });
      }, 800);
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('df_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
