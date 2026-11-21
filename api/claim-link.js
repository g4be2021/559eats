// One-click claim links for truck owners.
//   POST {a:'make', restaurant_id, email?}  (admin)  -> { url }
//   GET  ?t=TOKEN                                     -> { name, claimed }
//   POST {a:'use', t}  (signed-in owner session)      -> links the signed-in email to the truck
// Tokens are HMAC-signed with a key derived from ADMIN_SECRET, so they can never pass as admin tokens.
const crypto = require('crypto');
const { isAdmin, bearer, SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');
const { sendSms } = require('./_lib/sms');

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const SITE = 'https://www.559eats.com';
const DAYS = 30;

const key = () => crypto.createHmac('sha256', String(process.env.ADMIN_SECRET || '')).update('559eats-claim-link-v1').digest();

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !process.env.ADMIN_SECRET) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.k === 'claim' && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

async function db(path, method = 'GET', body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || `Database error ${r.status}`);
  return j;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }

  try {
    // Look up what a link is for (claim page)
    if (req.method === 'GET') {
      const p = verify(req.query.t);
      if (!p) return res.status(400).json({ error: 'This claim link is invalid or expired. Ask us for a new one at gabe@559eats.com.' });
      const [truck] = (await db(`restaurants?id=eq.${p.r}&select=id,name,neighborhood`)) || [];
      if (!truck) return res.status(404).json({ error: 'Truck not found.' });
      const owners = (await db(`owners?restaurant_id=eq.${p.r}&select=id`)) || [];
      return res.json({ name: truck.name, area: truck.neighborhood || '', claimed: owners.length > 0 });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Admin makes a link
    if (b.a === 'make') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'Admins only.' });
      if (!/^[0-9a-f-]{36}$/.test(String(b.restaurant_id || ''))) return res.status(400).json({ error: 'Missing truck.' });
      const [truck] = (await db(`restaurants?id=eq.${b.restaurant_id}&select=id,name`)) || [];
      if (!truck) return res.status(404).json({ error: 'Truck not found.' });
      const t = sign({ k: 'claim', r: truck.id, n: crypto.randomBytes(4).toString('hex'), exp: Date.now() + DAYS * 864e5 });
      return res.json({ url: `${SITE}/claim?t=${t}`, name: truck.name, days: DAYS });
    }

    // Owner uses a link after signing in (Google or email link)
    if (b.a === 'use') {
      const p = verify(b.t);
      if (!p) return res.status(400).json({ error: 'This claim link is invalid or expired. Ask us for a new one at gabe@559eats.com.' });
      const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${bearer(req)}` } });
      const user = u.ok ? await u.json() : null;
      if (!user || !user.email) return res.status(401).json({ error: 'Please sign in again.' });
      const email = String(user.email).toLowerCase();

      const [truck] = (await db(`restaurants?id=eq.${p.r}&select=id,name`)) || [];
      if (!truck) return res.status(404).json({ error: 'Truck not found.' });
      const owners = (await db(`owners?restaurant_id=eq.${p.r}&select=id,email`)) || [];
      if (owners.some((o) => String(o.email || '').toLowerCase() === email)) return res.json({ success: true, name: truck.name, already: true });
      if (owners.length) return res.status(409).json({ error: `${truck.name} is already claimed. If that's a mistake, email gabe@559eats.com.` });
      const mine = (await db(`owners?email=eq.${encodeURIComponent(email)}&select=id,restaurant_id`)) || [];
      if (mine.length) return res.status(409).json({ error: `${email} already manages another truck. Sign in with a different account, or email gabe@559eats.com.` });

      const meta = user.user_metadata || {};
      await db('owners', 'POST', [{ restaurant_id: truck.id, email, name: meta.full_name || meta.name || null, auth_method: 'claim_link' }]);
      if (process.env.ADMIN_PHONE) {
        await sendSms(process.env.ADMIN_PHONE, `559eats: ${truck.name} was just claimed by ${email}.`).catch(() => {});
      }
      return res.json({ success: true, name: truck.name });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('claim-link', e);
    return res.status(500).json({ error: e.message || 'Something went wrong.' });
  }
};
