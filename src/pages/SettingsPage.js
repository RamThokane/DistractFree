import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
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
  const { user, updateUser } = useAuth();

  const [blockedSites, setBlockedSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [newSite, setNewSite] = useState('');
  const [siteError, setSiteError] = useState('');
  const [addingState, setAddingState] = useState(''); // '' | 'adding' | 'removing-ID'
  const [strictMode, setStrictMode] = useState(false);
  const [notifications, setNotifications] = useState({
    focusReminder: true,
    streakAlert: true,
    weeklyReport: true,
    coinEarned: false,
  });
  const [displayName, setDisplayName] = useState('');
  const [displayEmail, setDisplayEmail] = useState('');
  const [saved, setSaved] = useState(false);

  // Populate user data when available
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setDisplayEmail(user.email || '');
      if (user.settings) {
        if (user.settings.strictMode !== undefined) setStrictMode(user.settings.strictMode);
        if (user.settings.notifications) {
          setNotifications({
            focusReminder: user.settings.notifications.focusReminder ?? true,
            streakAlert: user.settings.notifications.streakAlert ?? true,
            weeklyReport: user.settings.notifications.weeklyReport ?? true,
            coinEarned: user.settings.notifications.coinEarned ?? false,
          });
        }
      }
    }
  }, [user]);

  // ── Fetch blocked sites from backend ──
  const fetchBlockedSites = useCallback(async () => {
    try {
      setLoadingSites(true);
      const res = await api.get('/websites/list');
      if (res.data.success) {
        setBlockedSites(
          res.data.websites.map((w) => ({
            id: w._id,
            url: w.websiteUrl,
            displayName: w.displayName,
            isActive: w.isActive,
          }))
        );
      }
    } catch (err) {
      console.error('[Settings] Failed to fetch blocked sites:', err);
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockedSites();
  }, [fetchBlockedSites]);

  // ── Add site to backend ──
  const addSite = async (siteToAdd = null) => {
    setSiteError('');
    const rawSite = typeof siteToAdd === 'string' ? siteToAdd : newSite;
    const site = rawSite
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*$/, '');
    if (!site) return;

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(site)) {
      setSiteError('Enter a valid domain (e.g. twitter.com)');
      return;
    }

    // Check duplicates locally
    if (blockedSites.some((s) => s.url === site)) {
      setSiteError('This site is already in your block list');
      return;
    }

    try {
      setAddingState('adding');
      const res = await api.post('/websites/add', {
        websiteUrl: site,
        displayName: site,
        category: 'other',
      });

      if (res.data.success) {
        const newW = res.data.website;
        setBlockedSites((prev) => [
          ...prev,
          { id: newW._id, url: newW.websiteUrl, displayName: newW.displayName, isActive: true },
        ]);
        if (typeof siteToAdd !== 'string') {
          setNewSite('');
        }
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || 'Failed to add website';
      setSiteError(msg);
    } finally {
      setAddingState('');
    }
  };

  // ── Remove site from backend ──
  const removeSite = async (siteId) => {
    try {
      setAddingState(`removing-${siteId}`);
      await api.delete('/websites/remove', { data: { websiteId: siteId } });
      setBlockedSites((prev) => prev.filter((s) => s.id !== siteId));
    } catch (err) {
      console.error('[Settings] Failed to remove site:', err);
      setSiteError('Failed to remove website');
    } finally {
      setAddingState('');
    }
  };

  const toggleNotification = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      const res = await api.put('/auth/profile', {
        name: displayName,
        strictMode,
        notifications
      });
      if (res.data.success) {
        updateUser(res.data.user);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const toggleStrictMode = async () => {
    const newVal = !strictMode;
    setStrictMode(newVal);
    try {
      const res = await api.put('/auth/profile', {
        name: displayName,
        strictMode: newVal,
        notifications
      });
      if (res.data.success) {
        updateUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to auto-save strict mode:', err);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const res = await api.get('/insights/weekly-report', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Weekly_Productivity_Report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download report', err);
    }
  };

  const themes = [
    {
      value: 'light',
      label: 'Light Mode',
      desc: 'Clean light surfaces',
      colors: ['#ffffff', '#f0f2f5', '#3FAE6A', '#1a1a2e'],
    },
    {
      value: 'minimal',
      label: 'Minimal',
      desc: 'Subtle neutral tones',
      colors: ['#fafaf9', '#e7e5e4', '#78716c', '#292524'],
    },
    {
      value: 'dark',
      label: 'Dark Mode',
      desc: 'Easy on the eyes',
      colors: ['#1a1a2e', '#16213e', '#3FAE6A', '#e2e8f0'],
    },
  ];

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
            <p className="text-dash-muted text-sm mb-4">These websites are always blocked while the extension is active.</p>

            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={newSite}
                onChange={(e) => { setNewSite(e.target.value); setSiteError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && addSite()}
                placeholder="e.g. facebook.com"
                className={`dash-input flex-1 ${siteError ? '!border-red-500/50 focus:!ring-red-500/30' : ''}`}
                disabled={addingState === 'adding'}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={addSite}
                icon={<HiOutlinePlus className="w-4 h-4" />}
                disabled={addingState === 'adding'}
              >
                {addingState === 'adding' ? 'Adding…' : 'Add'}
              </Button>
            </div>
            {siteError && (
              <p className="text-red-400 text-xs mt-1.5 mb-3 pl-1">{siteError}</p>
            )}
            {!siteError && <div className="mb-3" />}

            {loadingSites ? (
              <div className="flex items-center gap-2 py-4 justify-center text-dash-muted text-sm">
                <div className="w-4 h-4 border-2 border-sage border-t-transparent rounded-full animate-spin" />
                Loading blocked sites…
              </div>
            ) : blockedSites.length === 0 ? (
              <p className="text-dash-muted text-sm text-center py-4">
                No blocked sites yet. Add websites above to start blocking.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-5">
                {blockedSites.map((site) => (
                  <motion.span
                    key={site.id}
                    className="inline-flex items-center gap-1.5 bg-dash-hover border border-dash-border rounded-xl px-3 py-1.5 text-sm text-dash-text"
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {site.url}
                    <button
                      onClick={() => removeSite(site.id)}
                      disabled={addingState === `removing-${site.id}`}
                      className="text-dash-muted hover:text-red-400 transition-colors ml-0.5 disabled:opacity-50"
                    >
                      <HiOutlineXMark className="w-3.5 h-3.5" />
                    </button>
                  </motion.span>
                ))}
              </div>
            )}

            {/* Suggested Sites */}
            <div className="mt-6 border-t border-dash-border pt-4">
              <p className="text-dash-muted text-xs mb-3 font-medium uppercase tracking-wider">Suggested to block</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {['youtube.com', 'instagram.com', 'facebook.com', 'netflix.com', 'chatgpt.com', 'reddit.com', 'x.com', 'pinterest.com', 'tiktok.com', 'amazon.com']
                  .filter(site => !blockedSites.some(s => s.url === site))
                  .map(site => (
                  <button
                    key={site}
                    onClick={() => addSite(site)}
                    disabled={addingState === 'adding'}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dash-border bg-white/[0.02] hover:bg-white/[0.06] text-dash-muted hover:text-white transition-colors text-xs font-medium"
                  >
                    <HiOutlinePlus className="w-3 h-3" />
                    {site}
                  </button>
                ))}
              </div>
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
                onClick={toggleStrictMode}
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
                { key: 'streakAlert', label: 'Streak Alerts', desc: "Don't lose your streak!" },
                { key: 'weeklyReport', label: 'Weekly Report', desc: 'Summary of your productivity', action: (
                  <button onClick={handleDownloadReport} className="ml-4 text-xs text-sage hover:underline whitespace-nowrap bg-sage/10 px-2 py-1 rounded-md">
                    Download Info
                  </button>
                ) },
                { key: 'coinEarned', label: 'Coin Notifications', desc: 'Alert when coins are earned' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-dash-hover transition-colors"
                >
                  <div className="flex-1 flex items-center">
                    <div>
                      <p className="text-dash-text text-sm font-medium">{item.label}</p>
                      <p className="text-dash-muted text-xs">{item.desc}</p>
                    </div>
                    {item.action && item.action}
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
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="dash-input"
                />
              </div>
              <div>
                <label className="block text-dash-muted text-sm mb-2">Email</label>
                <input
                  type="email"
                  value={displayEmail}
                  onChange={(e) => setDisplayEmail(e.target.value)}
                  className="dash-input"
                  disabled
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
