import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuSparkles, LuSend, LuRotateCcw, LuCalendarPlus, LuCheck, LuX } from 'react-icons/lu';
import { agentService, scheduleService } from '../services/endpoints';
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
