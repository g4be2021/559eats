// Server-side admin login + data access for 559eats admin pages.
// Passwords live hashed (scrypt) in the admin_users table, never in page code.
// The browser gets a signed token after login; every data call is checked here
// and run with the service key, so the public anon key no longer needs write access.
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wlpugteoycouvvnhamnm.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.ADMIN_SECRET;
const TOKEN_HOURS = 12;

// Tables the admin pages are allowed to touch through this proxy
const TABLES = new Set([
  'restaurants', 'hours', 'photos', 'owners', 'claim_requests', 'catering_bookings',
  'bookings', 'sms_log', 'prospects', 'reviews', 'contact_messages',
]);

// Best-effort brute-force guard (per warm instance)
const fails = new Map();
const FAIL_LIMIT = 8;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !SECRET) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

function passwordMatches(password, stored) {
  if (typeof password !== 'string' || !stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function tooManyFails(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > FAIL_WINDOW_MS) { fails.delete(ip); return false; }
  return f.count >= FAIL_LIMIT;
}

function recordFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > FAIL_WINDOW_MS) fails.set(ip, { first: Date.now(), count: 1 });
  else f.count += 1;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY || !SECRET) return res.status(500).json({ error: 'Admin API is not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch { body = {}; } }
  body = body || {};
  const { action } = body;

  // Public: names and colors for the login screen (no secrets)
  if (action === 'admins') {
    const r = await sb('admin_users?select=name,initials,color&active=eq.true&order=created_at.asc');
    return res.status(200).json(r.ok ? await r.json() : []);
  }

  if (action === 'login') {
    const ip = clientIp(req);
    if (tooManyFails(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

    let q = 'admin_users?select=name,initials,color,pw_hash&active=eq.true';
    if (body.name) q += `&name=eq.${encodeURIComponent(body.name)}`;
    const r = await sb(q);
    const users = r.ok ? await r.json() : [];
    const user = users.find((u) => passwordMatches(body.password, u.pw_hash));
    if (!user) {
      recordFail(ip);
      await new Promise((ok) => setTimeout(ok, 400));
      return res.status(401).json({ error: 'Incorrect password' });
    }
    fails.delete(ip);
    const admin = { name: user.name, initials: user.initials, color: user.color };
    const token = sign({ ...admin, exp: Date.now() + TOKEN_HOURS * 3600 * 1000 });
    return res.status(200).json({ token, admin });
  }

  // Everything below needs a valid token
  const admin = verify(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!admin) return res.status(401).json({ error: 'Not signed in' });

  if (action === 'whoami') return res.status(200).json({ admin });

  if (action === 'db') {
    const { path, method = 'GET', data } = body;
    if (typeof path !== 'string' || !/^[a-z_]+(\?[^#\s]*)?$/.test(path)) {
      return res.status(400).json({ error: 'Bad path' });
    }
    const table = path.split('?')[0];
    if (!TABLES.has(table)) return res.status(403).json({ error: 'Table not allowed' });
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return res.status(400).json({ error: 'Bad method' });
    if ((method === 'PATCH' || method === 'DELETE') && !/[?&][a-z_]+=/.test(path)) {
      return res.status(400).json({ error: 'Updates and deletes need a filter' });
    }
    const r = await sb(path, { method, body: data != null ? JSON.stringify(data) : undefined });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(r.status === 204 ? 200 : r.status).send(text || 'null');
  }

  return res.status(400).json({ error: 'Unknown action' });
}

module.exports = handler;
module.exports._test = { sign, verify, passwordMatches };
