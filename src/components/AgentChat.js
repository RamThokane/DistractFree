import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuSparkles, LuSend, LuRotateCcw, LuCalendarPlus, LuCheck, LuX, LuShieldCheck } from 'react-icons/lu';
import api from '../services/api';
import { agentService, scheduleService } from '../services/endpoints';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, useToast } from './ui';
import { apiErrorMessage, formatWhen, repeatLabel } from '../utils/schedule';

const STORAGE_KEY = 'df_agent_chat_v1';
const HISTORY_SENT = 12;
const MAX_CHARS = 2000;

const STARTERS = [
  'When do I focus best?',
  'Why did my last sessions fail?',
  'Plan 2 sessions for tomorrow',
  'How is my week going?',
];

/** Other components can open the chat with a question: window.dispatchEvent(new CustomEvent('DF_AGENT_ASK', { detail: { text } })) */
export const askAgent = (text) => window.dispatchEvent(new CustomEvent('DF_AGENT_ASK', { detail: { text } }));

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function loadSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function save(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    // storage unavailable — the chat just won't survive a reload
  }
}

/** Plain text with "- " bullets; never rendered as HTML. */
function MessageText({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const bullet = /^[-•*]\s+(.*)/.exec(line);
    if (bullet) {
      if (!list) { list = []; blocks.push({ type: 'ul', items: list, key: `ul${i}` }); }
      list.push(bullet[1].replace(/\*\*/g, ''));
    } else {
      list = null;
      if (line) blocks.push({ type: 'p', text: line.replace(/\*\*/g, ''), key: `p${i}` });
    }
  });
  return blocks.map((b) => (b.type === 'ul'
    ? <ul key={b.key} className="agent-list">{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
    : <p key={b.key}>{b.text}</p>));
}

const forecastTone = (p) => (p >= 65 ? 'accent' : p >= 40 ? 'amber' : 'danger');

/** One proposed session: details, forecast, Confirm / Dismiss. */
function ScheduleItem({ item, onConfirm, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };
  const done = item.state === 'added' || item.state === 'dismissed';
  return (
    <li className={`agent-proposal-item ${done ? 'is-done' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="pg-row-title truncate">{item.title}</p>
        <p className="pg-row-meta">
          {item.startAt ? formatWhen(item.startAt) : 'No time'} · {item.plannedDuration} min
          {item.repeat && item.repeat !== 'none' && ` · ${repeatLabel(item)}`}
        </p>
        {item.problem && item.state !== 'added' && <p className="text-xs text-danger mt-1">{item.problem}</p>}
        {item.error && <p role="alert" className="text-xs text-danger mt-1">{item.error}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.forecast && item.state !== 'dismissed' && (
          <Badge tone={forecastTone(item.forecast.successPercent)} mono title="Chance this session goes to plan">
            {item.forecast.successPercent}%
          </Badge>
        )}
        {item.state === 'added' ? (
          <Badge tone="accent"><LuCheck size={12} aria-hidden="true" /> Added</Badge>
        ) : item.state === 'dismissed' ? (
          <span className="text-xs text-muted">Dismissed</span>
        ) : item.valid ? (
          <>
            <Button size="sm" onClick={confirm} loading={busy} aria-label={`Confirm ${item.title}`}>Confirm</Button>
            <Button size="sm" variant="ghost" iconOnly onClick={onDismiss} disabled={busy} aria-label={`Dismiss ${item.title}`}>
              <LuX size={16} aria-hidden="true" />
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" iconOnly onClick={onDismiss} aria-label={`Dismiss ${item.title}`}>
            <LuX size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

const ACTION_LABELS = {
  add: 'Block',
  enable: 'Turn blocking on for',
  disable: 'Turn blocking off for',
  remove: 'Remove from your list:',
};

/**
 * Proposed blocklist / strict mode changes: tick the ones you want, Apply.
 * Removing a site or turning strict mode off asks a second time. Applied with
 * the same endpoints Settings uses, then the extension is told to re-sync.
 */
function BlocklistProposal({ proposal, onUpdate }) {
  const toast = useToast();
  const { updateUser } = useAuth();
  const { changes, strictMode } = proposal;
  const [selected, setSelected] = useState(() => new Set(changes.map((c, i) => (c.valid ? i : null)).filter((i) => i !== null)));
  const [strictSelected, setStrictSelected] = useState(Boolean(strictMode?.valid));
  const [stage, setStage] = useState(proposal.applied ? 'done' : 'review'); // review | confirm | applying | done
  const results = proposal.applied?.results || {};

  const toggle = (i) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const chosen = changes.map((c, i) => ({ ...c, i })).filter((c) => selected.has(c.i));
  const risky = [
    ...chosen.filter((c) => c.action === 'remove').map((c) => `remove ${c.site}`),
    ...(strictSelected && strictMode?.to === false ? ['turn strict mode off'] : []),
  ];
  const nothing = chosen.length === 0 && !strictSelected;

  const apply = async () => {
    if (risky.length && stage !== 'confirm') {
      setStage('confirm');
      return;
    }
    setStage('applying');
    const out = {};
    let current = [];
    try {
      current = (await api.get('/websites/list')).data.websites || [];
    } catch {
      // add still works; the rest report their own errors
    }
    for (const c of chosen) {
      try {
        const site = current.find((w) => w.websiteUrl === c.site);
        if (c.action === 'add') {
          await api.post('/websites/add', { websiteUrl: c.site, category: c.category });
        } else if (!site) {
          throw new Error('It’s no longer on your list.');
        } else if (c.action === 'remove') {
          await api.delete('/websites/remove', { data: { websiteId: site._id } });
        } else if (site.isActive !== (c.action === 'enable')) {
          await api.patch(`/websites/toggle/${site._id}`);
        }
        out[c.i] = { ok: true };
      } catch (err) {
        out[c.i] = { ok: false, error: apiErrorMessage(err) };
      }
    }
    if (strictSelected && strictMode) {
      try {
        const res = await api.put('/auth/profile', { strictMode: strictMode.to });
        if (res.data?.user) updateUser(res.data.user);
        out.strict = { ok: true };
      } catch (err) {
        out.strict = { ok: false, error: apiErrorMessage(err) };
      }
    }
    // Same signal Settings sends: the extension re-syncs straight away
    window.dispatchEvent(new CustomEvent('DF_SETTINGS_CHANGED'));
    const failed = Object.values(out).filter((r) => !r.ok).length;
    if (failed) toast.error('Some changes didn’t apply', 'See the details in the chat.');
    else toast.success('Blocklist updated', 'The extension picks this up right away.');
    onUpdate({ applied: { results: out, skipped: changes.map((c, i) => i).filter((i) => !(i in out)), strictSkipped: !('strict' in out) } });
    setStage('done');
  };

  const status = (i) => {
    if (stage !== 'done') return null;
    const r = results[i];
    if (!r) return <span className="text-xs text-muted">Skipped</span>;
    return r.ok ? <Badge tone="accent"><LuCheck size={12} aria-hidden="true" /> Done</Badge> : <span className="text-xs text-danger">{r.error}</span>;
  };

  return (
    <div className="agent-proposal">
      <p className="df-label flex items-center gap-1.5">
        <LuShieldCheck size={13} aria-hidden="true" />
        {stage === 'done' ? 'Blocklist changes' : 'Proposed blocklist changes · not applied yet'}
      </p>
      <ul>
        {changes.map((c, i) => (
          <li key={`${c.site}-${i}`} className="agent-proposal-item">
            <label className="df-check min-w-0 flex-1">
              {stage !== 'done' && (
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  disabled={!c.valid || stage !== 'review'}
                />
              )}
              <span className="min-w-0">
                <span className="pg-row-title block">{ACTION_LABELS[c.action] || c.action} <span className="df-mono">{c.site}</span></span>
                {c.reason && <span className="pg-note block text-xs mt-0.5">{c.reason}</span>}
                {!c.valid && <span className="text-xs text-danger block mt-0.5">{c.problem}</span>}
              </span>
            </label>
            {status(i)}
          </li>
        ))}
        {strictMode && (
          <li className="agent-proposal-item">
            <label className="df-check min-w-0 flex-1">
              {stage !== 'done' && (
                <input
                  type="checkbox"
                  checked={strictSelected}
                  onChange={() => setStrictSelected((v) => !v)}
                  disabled={!strictMode.valid || stage !== 'review'}
                />
              )}
              <span className="min-w-0">
                <span className="pg-row-title block">Turn strict mode {strictMode.to ? 'on' : 'off'}</span>
                <span className="pg-note block text-xs mt-0.5">
                  {strictMode.to ? 'Blocked sites can’t be unlocked with coins.' : 'Blocked sites can be unlocked with coins again.'}
                </span>
                {!strictMode.valid && <span className="text-xs text-danger block mt-0.5">{strictMode.problem}</span>}
              </span>
            </label>
            {stage === 'done' && (proposal.applied?.strictSkipped
              ? <span className="text-xs text-muted">Skipped</span>
              : results.strict?.ok ? <Badge tone="accent"><LuCheck size={12} aria-hidden="true" /> Done</Badge> : <span className="text-xs text-danger">{results.strict?.error}</span>)}
          </li>
        )}
      </ul>
      {stage !== 'done' && (
        <div className="py-3 border-t border-line">
          {stage === 'confirm' && (
            <p role="alert" className="text-sm text-danger mb-2">
              This will {risky.join(' and ')}. Are you sure?
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={stage === 'confirm' ? 'danger' : 'primary'} onClick={apply} loading={stage === 'applying'} disabled={nothing}>
              {stage === 'confirm' ? 'Yes, apply' : `Apply ${chosen.length + (strictSelected ? 1 : 0)} selected`}
            </Button>
            {stage === 'confirm' && <Button size="sm" variant="ghost" onClick={() => setStage('review')}>Go back</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dashboard chat with the focus coach (Gemini via POST /api/agent/chat).
 * The coach reads your stats and can propose sessions; nothing is saved until
 * you press Confirm, which calls the normal schedule API.
 */
const AgentChat = () => {
  const toast = useToast();
  const [status, setStatus] = useState(null); // { enabled, remainingToday, dailyLimit }
  const [messages, setMessages] = useState(loadSaved);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null); // { text, retry }
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => { save(messages); }, [messages]);

  useEffect(() => {
    agentService.status()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ enabled: true, remainingToday: null }));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const send = useCallback(async (raw, base) => {
    const text = raw.trim().slice(0, MAX_CHARS);
    if (!text || pending) return;
    const userMsg = { id: newId(), role: 'user', text };
    const next = [...(base || messages), userMsg];
    setMessages(next);
    setInput('');
    setError(null);
    setPending(true);
    try {
      const history = next.filter((m) => m.role === 'user' || m.role === 'model').slice(-HISTORY_SENT).map(({ role, text: t }) => ({ role, text: t }));
      const res = await agentService.chat(history);
      setMessages((prev) => [...prev, { id: newId(), role: 'model', text: res.data.reply, proposals: res.data.proposals || [] }]);
      if (res.data.usage) setStatus((s) => ({ ...s, remainingToday: res.data.usage.remainingToday }));
    } catch (err) {
      const code = err?.response?.status;
      if (code === 503) setStatus({ enabled: false });
      if (code === 429 && err.response.data?.remainingToday === 0) setStatus((s) => ({ ...s, remainingToday: 0 }));
      // Take the unanswered message back out so a retry doesn't send it twice
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
      setError({ text: apiErrorMessage(err, 'The coach could not answer. Please try again.'), retry: code !== 503 && code !== 400 });
    } finally {
      setPending(false);
    }
  }, [messages, pending]);

  // Questions from elsewhere on the dashboard (e.g. the weekly report)
  useEffect(() => {
    const onAsk = (e) => {
      const text = e.detail?.text;
      if (!text) return;
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      send(text);
    };
    window.addEventListener('DF_AGENT_ASK', onAsk);
    return () => window.removeEventListener('DF_AGENT_ASK', onAsk);
  }, [send]);

  const updateItem = (messageId, proposalId, index, patch) => {
    setMessages((prev) => prev.map((m) => (m.id !== messageId ? m : {
      ...m,
      proposals: m.proposals.map((p) => (p.id !== proposalId ? p : {
        ...p,
        items: p.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
      })),
    })));
  };

  const updateProposal = (messageId, proposalId, patch) => {
    setMessages((prev) => prev.map((m) => (m.id !== messageId ? m : {
      ...m,
      proposals: m.proposals.map((p) => (p.id !== proposalId ? p : { ...p, ...patch })),
    })));
  };

  const confirmItem = async (message, proposal, index) => {
    const item = proposal.items[index];
    try {
      await scheduleService.create({
        title: item.title,
        subject: item.subject || '',
        startAt: item.startAt,
        plannedDuration: item.plannedDuration,
        repeat: item.repeat || 'none',
        repeatDays: item.repeatDays || [],
        timezone: item.timezone,
      });
      updateItem(message.id, proposal.id, index, { state: 'added', error: null });
      window.dispatchEvent(new CustomEvent('DF_SCHEDULE_CHANGED'));
      toast.success('Session scheduled', `${item.title}, ${formatWhen(item.startAt)}. It starts automatically.`);
    } catch (err) {
      updateItem(message.id, proposal.id, index, { error: apiErrorMessage(err, "Couldn't schedule this session.") });
    }
  };

  const reset = () => {
    setMessages([]);
    setError(null);
    setInput('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const disabled = status && status.enabled === false;
  const outOfMessages = status?.remainingToday === 0;

  return (
    <section ref={sectionRef} aria-labelledby="agent-title" className="agent scroll-mt-24">
      <Card padding="p-0" className="agent-card">
        <div className="agent-head">
          <div className="min-w-0">
            <h3 id="agent-title" className="pg-h2 flex items-center gap-2">
              <LuSparkles className="text-accent flex-shrink-0" size={20} aria-hidden="true" />
              Focus coach
            </h3>
            <p className="pg-note">
              Ask about your focus, or have it plan sessions for you. Powered by Google Gemini: your messages and focus
              stats are sent to Google to answer.
            </p>
          </div>
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" icon={<LuRotateCcw size={14} aria-hidden="true" />} onClick={reset} disabled={pending}>
              New chat
            </Button>
          )}
        </div>

        <div ref={listRef} className="agent-log" aria-live="polite" aria-relevant="additions" aria-busy={pending}>
          {disabled ? (
            <p className="pg-note">The focus coach isn't switched on yet. Check back soon.</p>
          ) : messages.length === 0 ? (
            <div className="agent-empty">
              <p className="pg-note">Try one of these:</p>
              <div className="agent-chips">
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="agent-chip" onClick={() => send(s)} disabled={pending || outOfMessages}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`agent-msg agent-msg--${m.role}`}>
                <div className="agent-bubble">
                  <span className="sr-only">{m.role === 'user' ? 'You said:' : 'Coach:'}</span>
                  <MessageText text={m.text} />
                </div>
                {(m.proposals || []).filter((p) => p.kind === 'blocklist').map((p) => (
                  <BlocklistProposal key={p.id} proposal={p} onUpdate={(patch) => updateProposal(m.id, p.id, patch)} />
                ))}
                {(m.proposals || []).map((p) => p.kind === 'schedule' && (
                  <div key={p.id} className="agent-proposal">
                    <p className="df-label flex items-center gap-1.5">
                      <LuCalendarPlus size={13} aria-hidden="true" />
                      {p.items.every((it) => it.state === 'added' || it.state === 'dismissed')
                        ? `${p.items.filter((it) => it.state === 'added').length} added to your calendar`
                        : 'Proposed sessions · not saved yet'}
                    </p>
                    <ul>
                      {p.items.map((item, i) => (
                        <ScheduleItem
                          key={`${p.id}-${i}`}
                          item={item}
                          onConfirm={() => confirmItem(m, p, i)}
                          onDismiss={() => updateItem(m.id, p.id, i, { state: 'dismissed' })}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
          {pending && (
            <div className="agent-msg agent-msg--model">
              <div className="agent-bubble agent-typing" aria-label="The coach is thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        {!disabled && (
          <form className="agent-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            {error && (
              <p role="alert" className="text-sm text-danger mb-2">
                {error.text}{' '}
                {error.retry && <button type="button" className="df-link" onClick={() => send(input)}>Try again</button>}
              </p>
            )}
            <div className="agent-input-row">
              <label htmlFor="agent-input" className="sr-only">Message the focus coach</label>
              <textarea
                id="agent-input"
                ref={inputRef}
                className="df-input agent-input"
                rows={1}
                maxLength={MAX_CHARS}
                placeholder={outOfMessages ? 'No messages left today' : 'Ask about your focus, or "plan my evening"…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={pending || outOfMessages}
              />
              <Button type="submit" iconOnly disabled={!input.trim() || pending || outOfMessages} aria-label="Send">
                <LuSend size={16} aria-hidden="true" />
              </Button>
            </div>
            <p className="agent-meta">
              Enter to send · Shift+Enter for a new line
              {typeof status?.remainingToday === 'number' && ` · ${status.remainingToday} message${status.remainingToday === 1 ? '' : 's'} left today`}
            </p>
          </form>
        )}
      </Card>
    </section>
  );
};

export default AgentChat;
