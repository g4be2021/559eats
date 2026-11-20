// Admin-only bridge from the outreach dashboard to the Supabase "vendor-sms" function
// (Vonage texting + AI intake + AI approval). Keeps that function's secret on the server.
const { isAdmin } = require('./_lib/admin-auth');

const FN = 'https://wlpugteoycouvvnhamnm.supabase.co/functions/v1/vendor-sms';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Not signed in' });
  const secret = process.env.VENDOR_SMS_ADMIN_SECRET;
  if (!secret) return res.status(500).json({ error: 'VENDOR_SMS_ADMIN_SECRET is not set in Vercel' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  let route, payload;
  if (b.action === 'outreach' && Array.isArray(b.prospect_ids) && b.prospect_ids.length) {
    route = 'outreach';
    payload = { prospect_ids: b.prospect_ids.slice(0, 25) };
  } else if (b.action === 'review' && b.prospect_id) {
    route = 'review';
    payload = { prospect_id: b.prospect_id };
  } else if (b.action === 'test' && b.to) {
    route = 'outreach';
    payload = { test_to: b.to };
  } else {
    return res.status(400).json({ error: 'Unknown action' });
  }

  const r = await fetch(`${FN}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  res.setHeader('Content-Type', 'application/json');
  return res.status(r.status).send(text || '{}');
};
