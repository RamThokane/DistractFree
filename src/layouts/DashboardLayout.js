import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import RewardPopup from '../components/RewardPopup';

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-dash-bg dark:bg-land-dark-bg text-dash-text dark:text-land-dark-text antialiased theme-transition">
      <TopNavbar />
      <RewardPopup />

      {/* Main content area — offset for fixed navbar */}
      <main
        className="pt-[80px] pb-12"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      >
        <div className="max-w-[1280px] mx-auto px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
