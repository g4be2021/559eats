// Shared helpers for the 559eats agents. Secrets come from Vercel env vars only.
// Needed: SUPABASE_URL, SUPABASE_SERVICE_KEY, CRON_SECRET, ADMIN_PHONE, SITE_URL,
// SMS_FROM_NUMBER, SMS_PROVIDER, plus the provider keys listed in lib/sms.js

const SITE = process.env.SITE_URL || 'https://559eats.com';

// Vercel sends "Authorization: Bearer <CRON_SECRET>" on cron calls.
function authorized(req) {
  return (
    !!process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  );
}

async function db(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      Authorization: `Bearer ${(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`);
  return method === 'GET' ? res.json() : null;
}

async function logSms(row) {
  try { await db('sms_log', { method: 'POST', body: { direction: 'outbound', ...row } }); } catch (e) { console.error('sms_log failed', e.message); }
}

const sms = require('./sms');

// Sends through lib/sms.js (Telnyx or Plivo) and records the result in sms_log.
// (The sms_log column is still named twilio_sid; it now holds the provider message id.)
async function sendSms({ to, body, kind, restaurantId, ownerId }) {
  const out = await sms.sendSms(to, body);
  await logSms({
    restaurant_id: restaurantId,
    kind,
    phone: sms.toE164(to) || String(to),
    message: body,
    status: out.ok ? 'sent' : 'failed',
    twilio_sid: out.id,
    error: out.error,
  });
  return { ok: out.ok, error: out.error };
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();

module.exports = { SITE, authorized, db, sendSms, toE164: sms.toE164, daysAgo, daysAhead };
