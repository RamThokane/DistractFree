import React from 'react';
import { HiOutlineBell, HiOutlineFire } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useCoins } from '../context/CoinContext';
import { getGreeting } from '../utils/helpers';

const Navbar = () => {
  const { user } = useAuth();
  const { balance } = useCoins();

  return (
    <header className="sticky top-0 z-30 px-4 py-2">
      <div className="bg-white border-b border-dash-border px-6 py-2.5 flex items-center justify-between shadow-dash-sm rounded-none -mx-4 -mt-2">
        {/* Left — Greeting */}
        <div className="hidden sm:block">
          <p className="text-dash-muted text-xs">{getGreeting()}</p>
          <h2 className="text-dash-text font-semibold text-sm">{user?.name || 'User'}</h2>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Streak */}
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
            <HiOutlineFire className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-orange-600 text-xs font-medium">{user?.streak || 0}</span>
          </div>

          {/* Coins */}
          <div className="flex items-center gap-1.5 bg-dash-hover border border-dash-border rounded-lg px-3 py-1.5">
            <span className="text-sm">🪙</span>
            <span className="text-dash-text text-xs font-medium">{balance}</span>
          </div>

          {/* Notification */}
          <button className="relative p-2 rounded-lg hover:bg-dash-hover transition-colors">
            <HiOutlineBell className="w-4 h-4 text-dash-muted" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-dash-accent rounded-full" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-dash-hover border border-dash-border flex items-center justify-center">
            <span className="text-dash-text text-xs font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
