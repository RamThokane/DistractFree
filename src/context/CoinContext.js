import React, { createContext, useContext, useState, useCallback } from 'react';
import { mockUser } from '../utils/mockData';

const CoinContext = createContext(null);

export const useCoins = () => {
  const ctx = useContext(CoinContext);
  if (!ctx) throw new Error('useCoins must be used within CoinProvider');
  return ctx;
};

export const CoinProvider = ({ children }) => {
  const [balance, setBalance] = useState(mockUser.focusCoins);
  const [pendingReward, setPendingReward] = useState(null);

  const addCoins = useCallback((amount, description = 'Focus session') => {
    setBalance((prev) => prev + amount);
    setPendingReward({ amount, description });
    // Auto-clear reward popup after 3s
    setTimeout(() => setPendingReward(null), 3500);
  }, []);

  const spendCoins = useCallback((amount) => {
    if (amount > balance) return false;
    setBalance((prev) => prev - amount);
    return true;
  }, [balance]);

  const clearReward = useCallback(() => setPendingReward(null), []);

  return (
    <CoinContext.Provider value={{ balance, addCoins, spendCoins, pendingReward, clearReward }}>
      {children}
    </CoinContext.Provider>
  );
};
