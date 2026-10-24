import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { EXTENSION_ZIP, downloadExtension, hasExtension, isMobileDevice } from '../utils/device';
import '../styles/landing.css';

/*
 * How to install the extension by hand (until it is on the Chrome Web Store):
 * download the zip, extract it, and load it unpacked in Developer mode.
 */

const STEPS = [
  {
    title: 'Download the extension',
    body: <>Your download of <code>distractfree-extension.zip</code> should start on its own. If it didn't, use the button above.</>,
  },
  {
    title: 'Extract the zip',
    body: (
      <>
        <strong>Windows:</strong> right-click the zip in Downloads → <em>Extract All…</em> → <em>Extract</em>.{' '}
        <strong>Mac:</strong> double-click the zip.{' '}
        Move the extracted <code>distractfree-extension</code> folder somewhere it can stay, such as Documents.
        Chrome runs the extension from this folder, so don't delete it.
      </>
    ),
  },
  {
    title: 'Open Chrome’s extensions page',
    body: <>Type <code>chrome://extensions</code> in the address bar and press Enter. (Edge: <code>edge://extensions</code>, Brave: <code>brave://extensions</code>.)</>,
  },
  {
    title: 'Turn on Developer mode',
    body: <>Flip the <em>Developer mode</em> switch in the top-right corner of that page.</>,
  },
  {
    title: 'Click “Load unpacked”',
    body: <>Pick the extracted folder, the one that contains <code>manifest.json</code>, and click <em>Select Folder</em>. DistractFree appears in your list of extensions.</>,
  },
  {
    title: 'Pin it and sign in',
    body: <>Click the puzzle-piece icon next to the address bar and pin DistractFree. Then <Link to="/login" className="lp-legal-link">log in on this website</Link>. The extension picks up your sign-in, and you can start your first focus session.</>,
  },
];

const InstallPage = () => {
  const location = useLocation();
  const [mobile] = useState(isMobileDevice);
  const [installed, setInstalled] = useState(hasExtension);
  const started = useRef(false);

  // "Add to Chrome" sends people here; start the download once (not on phones)
  useEffect(() => {
    if (started.current || mobile) return;
    started.current = true;
    if (location.state?.download || new URLSearchParams(location.search).get('download') === '1') downloadExtension();
  }, [location, mobile]);

  // The extension marks the page when it loads; check again in case it was just installed
  useEffect(() => {
    const id = setInterval(() => setInstalled(hasExtension()), 2000);
    return () => clearInterval(id);
  }, []);

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
        <h1 className="lp-display lp-legal-title">Install the extension</h1>
        <p className="lp-legal-intro">
          DistractFree blocks sites and runs focus sessions through a Chrome extension. It isn't on the Chrome Web
          Store yet, so for now you add it by hand. It takes about a minute.
        </p>

        {mobile ? (
          <section>
            <h2>You're on a phone or tablet</h2>
            <p>
              Mobile browsers can't install extensions, so focus sessions can't run here. Open{' '}
              <strong>distractfree.site/install</strong> in Chrome on a laptop or desktop computer to set it up. You
              can still sign in on your phone to check your stats.
            </p>
          </section>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8">
            <a href={EXTENSION_ZIP} download="distractfree-extension.zip" className="lp-btn">
              Download extension (.zip)
            </a>
            {installed && <span className="text-sm" role="status">✓ The extension is installed in this browser.</span>}
          </div>
        )}

        <section>
          <h2>Steps</h2>
          <ol className="list-decimal pl-5 space-y-4">
            {STEPS.map((s) => (
              <li key={s.title}>
                <strong>{s.title}.</strong> {s.body}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2>Good to know</h2>
          <ul>
            <li>Chrome may show a notice about extensions in Developer mode when it starts. That's expected for extensions added this way; close it and DistractFree keeps working.</li>
            <li>To update, download the zip again, replace the files in your folder, and click the reload icon on DistractFree's card in <code>chrome://extensions</code>.</li>
            <li>Already on this page with the extension just added? Reload the page so the website can see it.</li>
          </ul>
        </section>
      </main>
    </div>
  );
};

export default InstallPage;
