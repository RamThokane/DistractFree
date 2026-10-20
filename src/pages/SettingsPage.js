import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import PDFReportGenerator from '../components/PDFReportGenerator';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { LuPlus, LuGlobe, LuShieldCheck, LuTrash2, LuCheck, LuLogOut } from 'react-icons/lu';
import { Button, Input, Select, Toggle, Badge, Skeleton, EmptyState, useToast } from '../components/ui';
import { UNLOCK_COST } from '../utils/coinRules';

/* Module scope: defining these inside the component would remount the
   section (and drop input focus) on every keystroke. */
const THEMES = [
  { value: 'light', label: 'Light', desc: 'Warm paper, dark ink', swatch: ['#FAF8F5', '#FFFFFF', '#1F5E4A', '#1C1B19'] },
  { value: 'dark', label: 'Dark', desc: 'Warm charcoal, easy at night', swatch: ['#151412', '#201F1C', '#7FC2A3', '#EDE9E1'] },
];

const CATEGORY_OPTIONS = [
  { value: 'social_media', label: 'Social' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'news', label: 'News' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'other', label: 'Other' },
];
const categoryLabel = (c) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label || 'Other';

const Section = ({ id, title, desc, children }) => (
  <section aria-labelledby={id} className="grid md:grid-cols-[15rem_1fr] gap-x-10 gap-y-5 py-10 border-t border-line first:border-t-0 first:pt-2">
    <div>
      <h2 id={id} className="pg-h2">{title}</h2>
      {desc && <p className="pg-note mt-2 max-w-xs">{desc}</p>}
    </div>
    <div className="min-w-0">{children}</div>
  </section>
);

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [newCategory, setNewCategory] = useState('other');
  const [saving, setSaving] = useState(false);

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
    weeklyReportEmail: false,
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
            weeklyReportEmail: user.settings.notifications.weeklyReportEmail ?? false,
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
            category: w.category,
          }))
        );
      }
    } catch (err) {
      console.error('[Settings] Failed to fetch blocked sites:', err);
      toast.error('Couldn’t load your blocked sites', 'Refresh the page to try again.');
    } finally {
      setLoadingSites(false);
    }
  }, [toast]);

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
        category: typeof siteToAdd === 'string' ? 'other' : newCategory,
      });

      if (res.data.success) {
        const newW = res.data.website;
        setBlockedSites((prev) => [
          ...prev,
          { id: newW._id, url: newW.websiteUrl, displayName: newW.displayName, isActive: true, category: newW.category },
        ]);
        toast.success(`${newW.websiteUrl} added`, 'It will be paused during focus sessions.');
        if (typeof siteToAdd !== 'string') {
          setNewSite('');
        }
        notifyExtension();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || 'Failed to add website';
      setSiteError(msg);
    } finally {
      setAddingState('');
    }
  };

  // Tell the browser extension to re-sync right away (content script listens for this)
  const notifyExtension = () => window.dispatchEvent(new CustomEvent('DF_SETTINGS_CHANGED'));

  // ── Remove site from backend ──
  const removeSite = async (siteId) => {
    try {
      setAddingState(`removing-${siteId}`);
      await api.delete('/websites/remove', { data: { websiteId: siteId } });
      setBlockedSites((prev) => prev.filter((s) => s.id !== siteId));
      notifyExtension();
    } catch (err) {
      console.error('[Settings] Failed to remove site:', err);
      toast.error('Couldn’t remove that site', 'Try again in a moment.');
    } finally {
      setAddingState('');
    }
  };

  // ── Turn blocking on/off for one site (keeps it on the list) ──
  const toggleSite = async (siteId) => {
    try {
      setAddingState(`toggling-${siteId}`);
      const res = await api.patch(`/websites/toggle/${siteId}`);
      if (res.data.success) {
        setBlockedSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, isActive: res.data.website.isActive } : s)));
        notifyExtension();
      }
    } catch (err) {
      console.error('[Settings] Failed to toggle site:', err);
      toast.error('Couldn’t update that site', 'Try again in a moment.');
    } finally {
      setAddingState('');
    }
  };

  // Each switch saves as soon as it's flipped (like strict mode)
  const toggleNotification = async (key) => {
    const value = !notifications[key];
    setNotifications((prev) => ({ ...prev, [key]: value }));
    try {
      const res = await api.put('/auth/profile', { notifications: { [key]: value } });
      if (res.data.success) updateUser(res.data.user);
    } catch (err) {
      console.error('Failed to save notification setting:', err);
      setNotifications((prev) => ({ ...prev, [key]: !value }));
      toast.error('Couldn’t save that setting', 'Check your connection and try again.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
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
      toast.error('Couldn’t save your changes', 'Check your connection and try again.');
    } finally {
      setSaving(false);
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
        notifyExtension();
      }
    } catch (err) {
      console.error('Failed to auto-save strict mode:', err);
    }
  };



  return (
    <PageTransition>
      <div className="max-w-5xl">
        <div className="pg-head">
          <div>
            <p className="pg-kicker">Preferences</p>
            <h2 className="pg-title">Settings</h2>
          </div>
        </div>

        {/* ── Blocked Sites ── */}
        <Section id="blocked-title" title="Blocked sites" desc="These websites are always blocked while the extension is active. Switch one off to keep it on the list without blocking it.">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
            <Input
              label="Add a website"
              fieldClassName="flex-1"
              value={newSite}
              onChange={(e) => { setNewSite(e.target.value); setSiteError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && addSite()}
              placeholder="e.g. facebook.com"
              error={siteError || undefined}
              disabled={addingState === 'adding'}
              autoComplete="off"
              spellCheck={false}
            />
            <Select
              label="Category"
              fieldClassName="sm:w-44"
              options={CATEGORY_OPTIONS}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button
              className="sm:mt-[30px]"
              onClick={addSite}
              icon={<LuPlus size={16} aria-hidden="true" />}
              loading={addingState === 'adding'}
            >
              Add site
            </Button>
          </div>

          <div className="mt-6">
            {loadingSites ? (
              <div aria-busy="true" aria-label="Loading blocked sites">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="pg-row"><Skeleton width="40%" height={14} /><Skeleton width={36} height={20} radius={10} /></div>
                ))}
              </div>
            ) : blockedSites.length === 0 ? (
              <EmptyState icon={LuGlobe} title="No blocked sites yet">
                Add the sites that pull you away most, or pick from the suggestions below. They’re only paused while a focus session runs.
              </EmptyState>
            ) : (
              <ul className="pg-rows" aria-label="Blocked sites">
                {blockedSites.map((site) => (
                  <li key={site.id} className={`flex items-center gap-4 py-3 border-b border-line ${site.isActive === false ? 'opacity-60' : ''}`}>
                    <span className="w-8 h-8 rounded-md bg-paper-2 border border-line flex items-center justify-center df-mono text-xs text-muted uppercase flex-shrink-0" aria-hidden="true">
                      {site.url.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text truncate">{site.url}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="df-mono">{UNLOCK_COST}</span> coins to unlock during a session
                      </p>
                    </div>
                    <Badge className="hidden sm:inline-flex">{categoryLabel(site.category)}</Badge>
                    <Toggle
                      checked={site.isActive !== false}
                      onChange={() => toggleSite(site.id)}
                      disabled={addingState === `toggling-${site.id}`}
                      aria-label={`Block ${site.url}`}
                    />
                    <button
                      onClick={() => removeSite(site.id)}
                      disabled={addingState === `removing-${site.id}`}
                      className="app-icon-btn hover:!text-danger disabled:opacity-50"
                      aria-label={`Remove ${site.url}`}
                      title="Remove"
                    >
                      <LuTrash2 />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggested Sites */}
          {(() => {
            const suggestions = ['youtube.com', 'instagram.com', 'facebook.com', 'netflix.com', 'chatgpt.com', 'reddit.com', 'x.com', 'pinterest.com', 'tiktok.com', 'amazon.com']
              .filter((site) => !blockedSites.some((s) => s.url === site));
            if (!suggestions.length) return null;
            return (
              <div className="mt-6">
                <p className="df-label mb-3">Suggested to block</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((site) => (
                    <button
                      key={site}
                      onClick={() => addSite(site)}
                      disabled={addingState === 'adding'}
                      className="df-btn df-btn--secondary df-btn--sm font-medium"
                    >
                      <LuPlus size={14} aria-hidden="true" />
                      {site}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Strict Mode */}
          <div className="mt-8 flex items-start justify-between gap-6 rounded-lg bg-paper-2 px-5 py-4">
            <div className="flex items-start gap-3">
              <LuShieldCheck className="w-5 h-5 mt-0.5 text-muted flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-text">Strict mode</p>
                <p className="text-sm text-muted">Blocked sites can't be unlocked with coins — at any time.</p>
              </div>
            </div>
            <Toggle checked={strictMode} onChange={toggleStrictMode} aria-label="Strict mode" />
          </div>
        </Section>

        {/* ── Appearance ── */}
        <Section id="appearance-title" title="Appearance" desc="Applies across the website, dashboard and extension pages.">
          <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const selected = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(t.value)}
                  className={`text-left rounded-lg border p-4 transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                    selected ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex gap-1 mb-3" aria-hidden="true">
                    {t.swatch.map((c) => (
                      <span key={c} className="w-6 h-6 rounded border border-line" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-text flex items-center gap-2">
                    {t.label}
                    {selected && <Badge tone="accent">Active</Badge>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section id="notif-title" title="Notifications" desc="Choose what notifications you receive.">
          <ul className="pg-rows">
            {[
              { key: 'focusReminder', label: 'Focus reminders', desc: 'Gentle nudges to start a session' },
              { key: 'streakAlert', label: 'Streak alerts', desc: "A heads-up before you'd lose your streak" },
              { key: 'weeklyReport', label: 'Weekly report', desc: 'Summary of your productivity', action: <PDFReportGenerator user={user} /> },
              { key: 'weeklyReportEmail', label: 'Email my weekly report', desc: 'The AI weekly report in your inbox on Mondays' },
              { key: 'coinEarned', label: 'Coin notifications', desc: 'Alert when coins are earned' },
            ].map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-4 py-4 border-b border-line">
                <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div>
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    <p className="text-xs text-muted">{item.desc}</p>
                  </div>
                  {item.action}
                </div>
                <Toggle checked={notifications[item.key]} onChange={() => toggleNotification(item.key)} aria-label={item.label} />
              </li>
            ))}
          </ul>
        </Section>

        {/* ── Account ── */}
        <Section id="account-title" title="Account" desc="Your name appears on the dashboard and leaderboard.">
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
            <Input label="Email" type="email" value={displayEmail} onChange={(e) => setDisplayEmail(e.target.value)} disabled hint="Email can't be changed here." />
          </div>
          <div className="flex items-center gap-4 mt-6">
            <Button onClick={handleSave} loading={saving}>
              Save changes
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-accent" role="status">
                <LuCheck aria-hidden="true" /> Saved
              </span>
            )}
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <Section id="danger-title" title="Danger zone" desc="Signing out removes your session from this browser. Your data stays in your account.">
          <div className="rounded-lg border border-danger/40 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-text">Log out of this device</p>
              <p className="text-sm text-muted">You'll need to sign in again to see your dashboard.</p>
            </div>
            <Button variant="danger-outline" onClick={() => { logout(); navigate('/'); }} icon={<LuLogOut size={16} aria-hidden="true" />}>
              Log out
            </Button>
          </div>
        </Section>
      </div>
    </PageTransition>
  );
};

export default SettingsPage;
