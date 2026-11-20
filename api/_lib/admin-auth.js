// Shared helpers: admin tokens (issued by /api/admin) and owner sessions (Supabase magic link).
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wlpugteoycouvvnhamnm.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

function signAdmin(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyAdminToken(token) {
  const secret = process.env.ADMIN_SECRET;
  if (!token || !secret) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
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

function bearer(req) {
  return String((req.headers && req.headers.authorization) || '').replace(/^Bearer\s+/i, '');
}

// Admin token from /api/admin, or the legacy x-admin-secret header (server-to-server use only)
function isAdmin(req) {
  if (verifyAdminToken(bearer(req))) return true;
  const legacy = req.headers && req.headers['x-admin-secret'];
  return !!(legacy && process.env.ADMIN_SECRET && legacy === process.env.ADMIN_SECRET);
}

// Signed-in owner (Supabase magic-link session). Returns their owner rows, or [] if not an owner.
async function ownerFromRequest(req) {
  const token = bearer(req);
  if (!token || !SERVICE_KEY) return [];
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!u.ok) return [];
  const user = await u.json();
  if (!user || !user.email) return [];
  const e = String(user.email);
  const or = encodeURIComponent(`(email.eq."${e}",email.eq."${e.toLowerCase()}")`);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/owners?or=${or}&select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

module.exports = { signAdmin, verifyAdminToken, isAdmin, ownerFromRequest, bearer, SUPABASE_URL, SERVICE_KEY };
