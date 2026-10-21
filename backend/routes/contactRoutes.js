const express = require('express');
const { sendEmail } = require('../utils/mailer');
const { validateContact } = require('../middleware/validateRequest');

const router = express.Router();

// Where contact-form messages are delivered
const CONTACT_TO = process.env.CONTACT_EMAIL || 'thokaneram@gmail.com';

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// POST /api/contact — public; emails the query to the owner, reply goes to the sender
router.post('/', validateContact, async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await sendEmail({
      to: CONTACT_TO,
      replyTo: email,
      subject: `DistractFree query from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>`
        + `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    console.error('[Contact] send failed:', err.message);
    res.status(503).json({ success: false, message: 'We couldn’t send your message right now. Please try again later.' });
  }
});

module.exports = router;
