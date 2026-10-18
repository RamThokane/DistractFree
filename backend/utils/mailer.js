/**
 * Transactional email through Resend (https://resend.com), installed from the
 * Vercel Marketplace, which sets RESEND_API_KEY. Uses Resend's HTTP API
 * directly — no SDK needed.
 *
 * Sender: MAIL_FROM if set, else no-reply@ the domain the integration set up
 * (RESEND_EMAIL_DOMAIN, which must be verified in Resend), else Resend's
 * shared test sender (only delivers to the Resend account owner's address).
 *
 * Without RESEND_API_KEY: in development the message is printed to the
 * console (so the reset flow can be tested locally); in production sending
 * fails loudly in the server log.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const fromAddress = () => process.env.MAIL_FROM
  || (process.env.RESEND_EMAIL_DOMAIN ? `DistractFree <no-reply@${process.env.RESEND_EMAIL_DOMAIN}>` : 'DistractFree <onboarding@resend.dev>');

const isConfigured = () => Boolean(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, text, html }) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[Mail] (dev, not sent) To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return { delivered: false, dev: true };
    }
    throw new Error('Email is not configured: set RESEND_API_KEY (install Resend from the Vercel Marketplace)');
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend responded ${res.status}: ${body.slice(0, 300)}`);
  }
  return { delivered: true };
}

module.exports = { sendEmail, isConfigured };
