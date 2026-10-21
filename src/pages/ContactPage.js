import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCircleAlert, LuMailCheck } from 'react-icons/lu';
import api from '../services/api';
import AuthLayout, { friendlyAuthError, isEmail } from '../components/AuthLayout';
import { Button, Field, Input } from '../components/ui';

const ContactPage = () => {
  const messageId = useId();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Enter your name.';
    if (!form.email) errs.email = 'Enter your email so we can reply.';
    else if (!isEmail(form.email)) errs.email = 'That doesn’t look like an email address.';
    if (form.message.trim().length < 10) errs.message = 'Write a little more — at least 10 characters.';
    if (Object.keys(errs).length) return setFieldErrors(errs);

    setLoading(true);
    setError('');
    try {
      await api.post('/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err, 'We couldn’t send your message. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Message sent' : 'Contact us'}
      subtitle={sent ? undefined : 'Have a question, idea or problem? Write to us and we’ll reply by email.'}
      footer={<>Back to <Link to="/" className="df-link">DistractFree home</Link></>}
    >
      {sent ? (
        <div className="mt-6" role="status">
          <div className="flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-4">
            <LuMailCheck className="mt-0.5 text-accent flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-text leading-relaxed">
              Thanks, {form.name.trim()}. We’ll reply to <span className="font-semibold">{form.email.trim()}</span> as soon as we can.
            </p>
          </div>
          <p className="text-sm text-muted mt-5 leading-relaxed">
            Something else to ask?{' '}
            <button
              type="button"
              className="df-link"
              onClick={() => { setForm((f) => ({ ...f, message: '' })); setSent(false); }}
            >
              Send another message
            </button>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="Name"
            value={form.name}
            onChange={update('name')}
            placeholder="Your name"
            autoComplete="name"
            maxLength={100}
            autoFocus
            error={fieldErrors.name || undefined}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@example.com"
            autoComplete="email"
            error={fieldErrors.email || undefined}
          />
          <Field id={messageId} label="Your query" error={fieldErrors.message || undefined}>
            <textarea
              id={messageId}
              className="df-input df-textarea"
              value={form.message}
              onChange={update('message')}
              placeholder="How can we help?"
              rows={6}
              maxLength={5000}
              aria-invalid={fieldErrors.message ? 'true' : undefined}
              aria-describedby={fieldErrors.message ? `${messageId}-msg` : undefined}
            />
          </Field>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-danger bg-danger-soft rounded-md px-3 py-2.5">
              <LuCircleAlert className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={loading}>
            Send message
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ContactPage;
