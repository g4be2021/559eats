// "List your spot" form -> saves the application as a prospect for review.
const { SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');
const { toE164 } = require('./_lib/sms');

const clip = (v, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  if (b.website_url) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields

  const name = clip(b.name, 120);
  const phone = toE164(b.phone);
  if (!name) return res.status(400).json({ error: 'Please enter your business name.' });
  if (!phone) return res.status(400).json({ error: 'Please enter a valid 10-digit US phone number.' });

  const details = {
    type: clip(b.type, 40),
    owner_name: clip(b.owner_name, 120),
    email: clip(b.email, 200),
    food_type: clip(b.cuisine, 120),
    neighborhood: clip(b.neighborhood, 120),
    instagram: clip(b.instagram, 200),
    notes: clip(b.notes, 1500),
    submitted_at: new Date().toISOString(),
  };

  // Same phone already on file? Add the new details instead of failing.
  const existing = await sb(`prospects?phone=eq.${encodeURIComponent(phone)}&select=id,collected_data`);
  const rows = existing.ok ? await existing.json() : [];
  let r;
  if (rows.length) {
    r = await sb(`prospects?id=eq.${rows[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, address: clip(b.address, 300) || null, collected_data: { ...(rows[0].collected_data || {}), website_application: details }, updated_at: new Date().toISOString() }),
    });
  } else {
    r = await sb('prospects', {
      method: 'POST',
      body: JSON.stringify({ name, phone, address: clip(b.address, 300) || null, source: 'website_apply', status: 'pending', collected_data: { website_application: details } }),
    });
  }
  if (!r.ok) {
    console.error('apply save failed', r.status, await r.text());
    return res.status(500).json({ error: 'Could not save your application. Please try again or text JOIN to (757) 970-3964.' });
  }
  return res.status(200).json({ ok: true });
};
