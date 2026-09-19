// ============================================
// 559eats · SMS check-in (admin button)
// Texts owners who chose SMS. Skips opted-out owners and anyone already
// checked in within the last 20 days, so repeated or unauthorized calls
// cannot spam owners. No owner data is returned.
// ============================================
const { sendSms } = require('./lib/sms');

const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const COOLDOWN_DAYS = 20;

async function supabase(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (res.status === 204) return null;
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const owners = await supabase('owners?select=id,phone,auth_method,restaurant_id,sms_opt_out');
    const eligible = (owners || []).filter(o =>
      o.auth_method === 'sms' && o.phone && o.restaurant_id && !o.sms_opt_out);

    if (eligible.length === 0) return res.json({ sent: 0, total: 0, skipped: 0 });

    const cutoff = encodeURIComponent(new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString());
    const pattern = encodeURIComponent('*hours changed*');
    let sent = 0, skipped = 0, failed = 0;

    for (const owner of eligible) {
      const rows = await supabase(`restaurants?id=eq.${owner.restaurant_id}&select=id,name`);
      const r = rows?.[0];
      if (!r) continue;

      const recent = await supabase(
        `sms_log?restaurant_id=eq.${r.id}&direction=eq.outbound&message=like.${pattern}&sent_at=gte.${cutoff}&limit=1&select=id`
      );
      if (recent && recent.length) { skipped++; continue; }

      const message =
        `Hi! This is 559eats 🍽️\n\n` +
        `Quick 2-question check-in for ${r.name}:\n\n` +
        `1️⃣ Have your hours changed?\n` +
        `Reply YES or NO\n\n` +
        `(We'll ask about your location next if needed)\n` +
        `Reply STOP to opt out.`;

      const out = await sendSms(owner.phone, message);
      await supabase('sms_log', 'POST', [{
        restaurant_id: r.id, direction: 'outbound', message, phone: owner.phone,
        status: out.ok ? 'sent' : 'failed'
      }]);
      if (out.ok) sent++; else failed++;
    }

    return res.json({ sent, total: eligible.length, skipped, failed });
  } catch (err) {
    console.error('SMS check-in error:', err);
    return res.status(500).json({ error: 'check-in failed' });
  }
};
