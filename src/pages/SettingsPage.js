import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import {
  HiOutlineGlobeAlt,
  HiOutlineBell,
  HiOutlinePaintBrush,
  HiOutlineUser,
  HiOutlineXMark,
  HiOutlinePlus,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';

const SettingsPage = () => {
  const [blockedSites, setBlockedSites] = useState([
    'twitter.com',
    'instagram.com',
    'reddit.com',
    'youtube.com',
    'tiktok.com',
  ]);
  const [newSite, setNewSite] = useState('');
  const [siteError, setSiteError] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [notifications, setNotifications] = useState({
    focusReminder: true,
    streakAlert: true,
    weeklyReport: true,
    coinEarned: false,
  });
  const [theme, setTheme] = useState('glass');
  const [saved, setSaved] = useState(false);

  const addSite = () => {
    setSiteError('');
    const site = newSite.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    if (!site) return;
    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(site)) {
      setSiteError('Enter a valid domain (e.g. twitter.com)');
      return;
    }
    // Check duplicates
    if (blockedSites.includes(site)) {
      setSiteError('This site is already in your block list');
      return;
    }
    setBlockedSites([...blockedSites, site]);
    setNewSite('');
  };

  const removeSite = (site) => {
    setBlockedSites(blockedSites.filter((s) => s !== site));
  };

  const toggleNotification = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.h1
          className="text-2xl font-semibold text-dash-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Settings
        </motion.h1>

        {/* ── Blocked Sites ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-base mb-1 flex items-center gap-2">
              <HiOutlineGlobeAlt className="w-5 h-5 text-sage" />
              Blocked Sites
            </h2>
            <p className="text-dash-muted text-sm mb-4">These websites are blocked only during active focus sessions.</p>

            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={newSite}
                onChange={(e) => { setNewSite(e.target.value); setSiteError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && addSite()}
                placeholder="e.g. facebook.com"
                className={`dash-input flex-1 ${siteError ? '!border-red-500/50 focus:!ring-red-500/30' : ''}`}
              />
              <Button variant="primary" size="sm" onClick={addSite} icon={<HiOutlinePlus className="w-4 h-4" />}>
                Add
              </Button>
            </div>
            {siteError && (
              <p className="text-red-400 text-xs mt-1.5 mb-3 pl-1">{siteError}</p>
            )}
            {!siteError && <div className="mb-3" />}

            <div className="flex flex-wrap gap-2 mb-5">
              {blockedSites.map((site) => (
                <motion.span
                  key={site}
                  className="inline-flex items-center gap-1.5 bg-dash-hover border border-dash-border rounded-xl px-3 py-1.5 text-sm text-dash-text"
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  {site}
                  <button
                    onClick={() => removeSite(site)}
                    className="text-dash-muted hover:text-red-400 transition-colors ml-0.5"
                  >
                    <HiOutlineXMark className="w-3.5 h-3.5" />
                  </button>
                </motion.span>
              ))}
            </div>

            {/* Strict Mode Toggle */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-dash-hover border border-dash-border">
              <div className="flex items-center gap-3">
                <HiOutlineShieldCheck className="w-5 h-5 text-dash-muted" />
                <div>
                  <p className="text-dash-text text-sm font-medium">Strict Mode</p>
                  <p className="text-dash-muted text-xs">Prevent unlocking blocked sites during sessions</p>
                </div>
              </div>
              <button
                onClick={() => setStrictMode(!strictMode)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  strictMode ? 'bg-sage' : 'bg-dash-border'
                }`}
              >
                <motion.div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: strictMode ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Notifications ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-base mb-1 flex items-center gap-2">
              <HiOutlineBell className="w-5 h-5 text-sage" />
              Notifications
            </h2>
            <p className="text-dash-muted text-sm mb-4">Choose what notifications you receive</p>

            <div className="space-y-3">
              {[
                { key: 'focusReminder', label: 'Focus Reminders', desc: 'Gentle nudges to start a session' },
                { key: 'streakAlert', label: 'Streak Alerts', desc: 'Don\'t lose your streak!' },
                { key: 'weeklyReport', label: 'Weekly Report', desc: 'Summary of your productivity' },
                { key: 'coinEarned', label: 'Coin Notifications', desc: 'Alert when coins are earned' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-dash-hover transition-colors"
                >
                  <div>
                    <p className="text-dash-text text-sm font-medium">{item.label}</p>
                    <p className="text-dash-muted text-xs">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleNotification(item.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      notifications[item.key] ? 'bg-sage' : 'bg-dash-border'
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                      animate={{ left: notifications[item.key] ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Theme ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-base mb-1 flex items-center gap-2">
              <HiOutlinePaintBrush className="w-5 h-5 text-purple-400" />
              Theme
            </h2>
            <p className="text-dash-muted text-sm mb-4">Choose your visual style</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'glass', label: 'Light Mode', desc: 'Clean light surfaces', preview: 'bg-dash-hover border-dash-border' },
                { value: 'dark', label: 'Minimal', desc: 'Subtle neutral tones', preview: 'bg-white border-dash-border' },
              ].map((t) => (
                <motion.button
                  key={t.value}
                  className={`p-4 rounded-xl border text-left transition-colors duration-150 ${
                    theme === t.value
                      ? 'border-sage bg-sage-50'
                      : 'border-dash-border bg-white hover:bg-dash-hover'
                  }`}
                  onClick={() => setTheme(t.value)}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`w-full h-16 rounded-lg ${t.preview} border mb-3`} />
                  <p className="text-dash-text font-medium text-sm">{t.label}</p>
                  <p className="text-dash-muted text-xs">{t.desc}</p>
                </motion.button>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Account ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-base mb-1 flex items-center gap-2">
              <HiOutlineUser className="w-5 h-5 text-blue-400" />
              Account
            </h2>
            <p className="text-dash-muted text-sm mb-4">Manage your account settings</p>

            <div className="space-y-4">
              <div>
                <label className="block text-dash-muted text-sm mb-2">Display Name</label>
                <input
                  type="text"
                  defaultValue="Alex Rivera"
                  className="dash-input"
                />
              </div>
              <div>
                <label className="block text-dash-muted text-sm mb-2">Email</label>
                <input
                  type="email"
                  defaultValue="alex@distractfree.app"
                  className="dash-input"
                />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Save Button ── */}
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button variant={saved ? 'accent' : 'primary'} size="md" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Changes'}
          </Button>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default SettingsPage;
