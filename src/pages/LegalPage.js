import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import Wordmark from '../components/Wordmark';
import '../styles/landing.css';

/* ═══════════════════════════════════════════════════════════════
   DistractFree — Privacy Policy and Terms of Service
   One page component, two documents. Shares the landing styles.
   ═══════════════════════════════════════════════════════════════ */

export const CONTACT_EMAIL = 'thokaneram@gmail.com';
const UPDATED = '21 October 2026';

const Mail = () => (
  <a href={`mailto:${CONTACT_EMAIL}?subject=DistractFree%20Query`} className="lp-legal-link">
    {CONTACT_EMAIL}
  </a>
);

const PRIVACY = {
  title: 'Privacy Policy',
  intro: 'This policy explains what DistractFree collects, why, and the choices you have. We collect only what the product needs to work.',
  sections: [
    {
      heading: 'What we collect',
      items: [
        'Account details: your name, email address and password (stored only as a secure hash). If you sign in with Google, we receive your name, email and profile picture from Google.',
        'Browsing activity from the extension: the websites you visit, the page address, when you visited and for how long, and whether a site was blocked or unlocked.',
        'Focus data: your focus sessions, scheduled sessions, blocked-site list, daily goal, coins, notifications and settings.',
      ],
    },
    {
      heading: 'How we use it',
      items: [
        'To block distracting sites, run focus sessions and award coins.',
        'To show your dashboard, insights, heatmap, weekly report and leaderboard.',
        'To power the AI focus coach and weekly reports. Summaries of your focus and browsing data are sent to Google Gemini to generate this advice.',
        'We do not sell your data, and we do not use it for advertising.',
      ],
    },
    {
      heading: 'Sharing',
      items: [
        'Your data is shared only with the services that run DistractFree: our hosting provider (Vercel), our database, Google Sign-In and Google Gemini.',
        'The leaderboard shows your display name and focus score to other users.',
        'We may disclose data if the law requires it.',
      ],
    },
    {
      heading: 'Storage and security',
      items: [
        'Data is sent over encrypted connections (HTTPS) and passwords are hashed.',
        'The extension keeps your sign-in token and settings in your browser’s local storage.',
        'No system is perfectly secure, but we take reasonable steps to protect your information.',
      ],
    },
    {
      heading: 'Your choices',
      items: [
        'You can remove sites from your block list, turn notifications off, or uninstall the extension at any time to stop activity tracking.',
        <>To get a copy of your data or have your account and data deleted, email <Mail />. We will respond within 30 days.</>,
      ],
    },
    {
      heading: 'Children',
      items: ['DistractFree is not intended for children under 13, and we do not knowingly collect their data.'],
    },
    {
      heading: 'Changes',
      items: ['If we change this policy, we will update the date at the top of this page. Continuing to use DistractFree means you accept the updated policy.'],
    },
  ],
};

const TERMS = {
  title: 'Terms of Service',
  intro: 'By creating an account or using the DistractFree website or browser extension, you agree to these terms.',
  sections: [
    {
      heading: 'Using DistractFree',
      items: [
        'You must be at least 13 years old to use DistractFree.',
        'Keep your login details private. You are responsible for activity on your account.',
        'Give accurate information when you sign up.',
      ],
    },
    {
      heading: 'Acceptable use',
      items: [
        'Do not try to hack, overload or disrupt the service, or access other people’s accounts or data.',
        'Do not cheat the coin system or the leaderboard, for example with scripts or fake sessions.',
        'Do not use DistractFree for anything illegal.',
      ],
    },
    {
      heading: 'Coins and rewards',
      items: ['Coins are a motivation tool inside the app only. They have no cash value and cannot be sold, transferred or exchanged for money.'],
    },
    {
      heading: 'AI features',
      items: ['The focus coach, insights and weekly reports are generated automatically and may be inaccurate. They are suggestions, not professional, medical or psychological advice.'],
    },
    {
      heading: 'The service',
      items: [
        'DistractFree is provided “as is”, without warranties. Blocking may not catch every site, and the service may sometimes be unavailable.',
        'We may change, pause or stop features at any time.',
        'To the extent the law allows, we are not liable for indirect losses, lost data or lost productivity from using the service.',
      ],
    },
    {
      heading: 'Ending your account',
      items: [
        <>You can stop using DistractFree at any time. To delete your account, email <Mail />.</>,
        'We may suspend or close accounts that break these terms.',
      ],
    },
    {
      heading: 'Your data',
      items: [<>How we handle your information is described in our <Link to="/privacy" className="lp-legal-link">Privacy Policy</Link>.</>],
    },
    {
      heading: 'Changes',
      items: ['We may update these terms. The date at the top shows the latest version, and continuing to use DistractFree means you accept it.'],
    },
  ],
};

const LegalPage = ({ kind }) => {
  const doc = kind === 'terms' ? TERMS : PRIVACY;

  return (
    <div className="lp min-h-screen antialiased relative overflow-clip">
      <header className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-5 sm:px-6 h-[72px]">
        <Link to="/" className="lp-wordmark shrink-0" aria-label="DistractFree home">
          <img src="/favicon.svg" alt="DistractFree Logo" className="w-8 h-8 rounded-md" />
          <span>Distract<em>Free</em></span>
        </Link>
        <ThemeToggle className="lp-nav-icon" />
      </header>

      <main className="lp-legal max-w-3xl mx-auto px-5 sm:px-6 pt-10 pb-16">
        <h1 className="lp-display lp-legal-title">{doc.title}</h1>
        <p className="lp-legal-date">Last updated {UPDATED}</p>
        <p className="lp-legal-intro">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            <ul>
              {s.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        ))}

        <section>
          <h2>Contact</h2>
          <p>Questions about this {kind === 'terms' ? 'agreement' : 'policy'}? Send us a message on the <Link to="/contact" className="lp-legal-link">contact page</Link>.</p>
        </section>
      </main>

      <footer className="lp-footer px-5 sm:px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 py-8 text-sm text-fg-2">
          <span>&copy; 2026 <Wordmark /></span>
          <div className="flex gap-6">
            <Link to="/privacy" className="lp-footer-link">Privacy</Link>
            <Link to="/terms" className="lp-footer-link">Terms</Link>
            <Link to="/contact" className="lp-footer-link">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LegalPage;
