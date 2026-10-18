import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
          <img src="/favicon.svg" alt="" className="w-10 h-10 rounded-lg" />
          <span className="df-skel" style={{ width: 120, height: 3 }} />
          <span className="text-muted text-sm">Loading your dashboard…</span>
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
