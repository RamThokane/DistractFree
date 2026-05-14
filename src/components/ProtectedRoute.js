import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-[rgba(124,92,252,0.2)] border-t-[#7C5CFC] rounded-full animate-spin" />
            <div className="absolute inset-0 rounded-full animate-pulse-slow" style={{ boxShadow: '0 0 20px rgba(124,92,252,0.2)' }} />
          </div>
          <span className="text-[#8B8AA8] text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
