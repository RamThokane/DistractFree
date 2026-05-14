import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const CoinContext = createContext(null);

export const useCoins = () => {
  const ctx = useContext(CoinContext);
  if (!ctx) throw new Error('useCoins must be used within CoinProvider');
  return ctx;
};

export const CoinProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [balance, setBalance] = useState(0);
  const [pendingReward, setPendingReward] = useState(null);

  // Sync balance from user object whenever it updates
  useEffect(() => {
    if (user?.focusCoins !== undefined) {
      setBalance(user.focusCoins);
    }
  }, [user]);

  // Fetch fresh balance from backend
  const refreshBalance = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/coins/balance');
      if (res.data.success) {
        setBalance(res.data.focusCoins);
      }
    } catch (err) {
      console.error('[Coins] Failed to refresh balance:', err.message);
    }
  }, [isAuthenticated]);

  const addCoins = useCallback((amount, description = 'Focus session') => {
    setBalance((prev) => prev + amount);
    setPendingReward({ amount, description });
    setTimeout(() => setPendingReward(null), 3500);
  }, []);

  const spendCoins = useCallback((amount) => {
    if (amount > balance) return false;
    setBalance((prev) => prev - amount);
    return true;
  }, [balance]);

  const clearReward = useCallback(() => setPendingReward(null), []);

  return (
    <CoinContext.Provider value={{ balance, addCoins, spendCoins, pendingReward, clearReward, refreshBalance }}>
      {children}
    </CoinContext.Provider>
  );
};
