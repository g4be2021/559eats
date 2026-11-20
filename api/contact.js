// Contact form -> contact_messages table (shown in the admin Inbox tab).
const { SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (b.website_url) return res.status(200).json({ ok: true }); // honeypot

  const message = clip(b.message, 4000);
  const email = clip(b.email, 200);
  if (!message) return res.status(400).json({ error: 'Please add a message.' });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please check your email address.' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ name: clip(b.name, 120) || null, email: email || null, topic: clip(b.topic, 80) || null, message }),
  });
  if (!r.ok) {
    console.error('contact save failed', r.status, await r.text());
    return res.status(500).json({ error: 'Could not send your message. Please try again.' });
  }
  return res.status(200).json({ ok: true });
};
