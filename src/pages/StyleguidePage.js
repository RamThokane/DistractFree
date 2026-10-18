import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuPlus, LuTimer, LuGlobe } from 'react-icons/lu';
import ThemeToggle from '../components/ThemeToggle';
import Wordmark from '../components/Wordmark';
import {
  Button, Input, Select, Toggle, Checkbox, Tabs, Card, Badge, Modal, useToast,
  Tooltip, EmptyState, ErrorState, Skeleton, SkeletonText, Stat, ProgressRing, ProgressBar,
} from '../components/ui';

/* Internal reference page for the design system (not linked from the site). */

const Section = ({ n, title, children }) => (
  <section className="py-10 border-t border-line">
    <p className="df-label mb-2">{n} — {title}</p>
    <div className="mt-6">{children}</div>
  </section>
);

const Swatch = ({ name, varName }) => (
  <div className="flex items-center gap-3">
    <span className="w-10 h-10 rounded-md border border-line" style={{ background: `var(${varName})` }} />
    <span className="text-sm">
      <span className="block font-medium text-text">{name}</span>
      <span className="df-mono text-xs text-muted">{varName}</span>
    </span>
  </div>
);

const StyleguidePage = () => {
  const toast = useToast();
  const [tab, setTab] = useState('day');
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="df-grain min-h-screen bg-paper text-text">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <header className="flex items-center justify-between gap-4 mb-6">
          <Link to="/"><Wordmark className="df-wordmark--logo" /></Link>
          <ThemeToggle />
        </header>

        <h1 className="df-display text-t-64 md:text-t-88">Design system</h1>
        <p className="mt-4 mb-10 max-w-xl text-muted leading-relaxed">
          Tokens live in <span className="df-mono text-sm">src/styles/tokens.css</span>, components in{' '}
          <span className="df-mono text-sm">src/components/ui</span>. The extension uses a copy of the same tokens.
        </p>

        <Section n="01" title="Colour">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            <Swatch name="Paper" varName="--paper" />
            <Swatch name="Paper 2" varName="--paper-2" />
            <Swatch name="Card" varName="--card" />
            <Swatch name="Text" varName="--text" />
            <Swatch name="Muted" varName="--muted" />
            <Swatch name="Accent" varName="--accent" />
            <Swatch name="Amber (coins)" varName="--amber" />
            <Swatch name="Danger (errors)" varName="--danger" />
          </div>
        </Section>

        <Section n="02" title="Type">
          <p className="df-display text-t-88">Focus, kept.</p>
          <p className="df-display text-t-64 mt-2">Display 64</p>
          <p className="df-display text-t-40 mt-2">Display 40 <em>italic</em></p>
          <p className="text-t-28 font-semibold mt-4">Title 28</p>
          <p className="text-xl mt-2">Lead 20 — Inter for interface and body copy.</p>
          <p className="mt-2 max-w-prose text-text-2 leading-relaxed">
            Body 16. Plain sentences, generous line height. You earned 35 coins this morning and spent 10 to check the news at lunch.
          </p>
          <p className="text-sm text-muted mt-2">Small 14 — secondary text.</p>
          <p className="df-mono text-t-40 mt-4">02:14:37</p>
          <p className="df-label mt-2">Mono label 12</p>
        </Section>

        <Section n="03" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Start focus session</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Delete account</Button>
            <Button variant="danger-outline">Remove</Button>
            <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>Save changes</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm" icon={<LuPlus size={16} />}>Add site</Button>
            <Button size="lg">Start free</Button>
            <Tooltip text="Start a 25-minute session">
              <Button variant="secondary" iconOnly aria-label="Start a session"><LuTimer size={18} /></Button>
            </Tooltip>
            <a href="#top" className="df-link df-link--arrow">See how it works</a>
          </div>
        </Section>

        <Section n="04" title="Forms">
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            <Input label="Email" type="email" placeholder="you@example.com" />
            <Input label="Password" type="password" hint="At least 8 characters." defaultValue="hunter2" />
            <Input label="Website" defaultValue="youtube" error="That doesn’t look like a domain. Try youtube.com" />
            <Select label="Category" options={[{ value: 'social', label: 'Social' }, { value: 'video', label: 'Video' }, { value: 'news', label: 'News' }]} />
            <Toggle checked={on} onChange={setOn} label="Block sites during focus sessions" />
            <Checkbox label="Remember me on this device" defaultChecked />
          </div>
        </Section>

        <Section n="05" title="Tabs, badges">
          <Tabs items={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'Month' }]} value={tab} onChange={setTab} label="Range" />
          <div className="mt-5">
            <Tabs variant="pill" items={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} value={tab === 'day' ? 'day' : 'week'} onChange={setTab} label="Range compact" />
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            <Badge>Social</Badge>
            <Badge tone="accent" dot>Focusing</Badge>
            <Badge tone="amber" mono>+35 coins</Badge>
            <Badge tone="danger">Failed</Badge>
            <Badge mono>v1.2.0</Badge>
          </div>
        </Section>

        <Section n="06" title="Cards, stats, progress">
          <div className="grid md:grid-cols-3 gap-6">
            <Card title="Today">
              <Stat label="Focused" value="2h 14m" delta="+18 min vs yesterday" deltaTone="up" size="lg" />
            </Card>
            <Card variant="band">
              <Stat label="Coin balance" value="340" delta="+35 today" deltaTone="coin" />
              <ProgressBar className="mt-5" label="Daily goal" valueLabel="134 / 180 min" value={134} max={180} />
            </Card>
            <Card variant="plain">
              <div className="flex items-center gap-5">
                <ProgressRing value={18 * 60 + 32} max={25 * 60} size={104} label="18:32" sublabel="left" title="Session progress" />
                <div className="text-sm text-muted">Deep work<br />3 sites paused</div>
              </div>
            </Card>
          </div>
        </Section>

        <Section n="07" title="Feedback">
          <div className="flex flex-wrap gap-3 mb-6">
            <Button variant="secondary" onClick={() => toast.success('Site added', 'youtube.com is paused during sessions.')}>Success toast</Button>
            <Button variant="secondary" onClick={() => toast.reward('+20 coins', 'For a 25-minute session.')}>Reward toast</Button>
            <Button variant="secondary" onClick={() => toast.error('Couldn’t save', 'Check your connection and try again.')}>Error toast</Button>
            <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <EmptyState icon={LuGlobe} title="No blocked sites yet" action={<Button size="sm" icon={<LuPlus size={16} />}>Add your first site</Button>}>
              Add the sites that pull you away most. They’ll only be paused while a session is running.
            </EmptyState>
            <ErrorState action={<Button size="sm" variant="secondary">Try again</Button>} />
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <Card><Skeleton width="40%" height={12} /><Skeleton className="mt-3" width="55%" height={32} /><SkeletonText className="mt-5" lines={3} /></Card>
          </div>
        </Section>
      </div>

      {open && (
        <Modal
          title="Unlock youtube.com?"
          onClose={() => setOpen(false)}
          footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Stay focused</Button><Button onClick={() => setOpen(false)}>Unlock for 5 coins</Button></>}
        >
          <p className="text-text-2 leading-relaxed">You’ll get 2 minutes. Your balance goes from <span className="df-mono">340</span> to <span className="df-mono">335</span>.</p>
        </Modal>
      )}
    </div>
  );
};

export default StyleguidePage;
