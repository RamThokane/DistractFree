import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import RewardPopup from '../components/RewardPopup';

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-dash-bg text-dash-text antialiased">
      <Sidebar />
      <RewardPopup />

      {/* Main content area offset for sidebar */}
      <div className="lg:ml-60 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 px-4 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
