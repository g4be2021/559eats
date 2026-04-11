// ============================================
// 559eats · SMS Check-in System
// File: /api/sms-checkin.js
// This runs as a Vercel serverless function
// Call this via a cron job or manually from
// your admin panel to trigger check-ins
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '82c47f2512d5afa7312796b074b0bd19';
const TWILIO_FROM  = '+15593773665';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

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

async function sendSMS(to, message, restaurantId) {
  const creds = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message }).toString()
    }
  );
  const data = await res.json();

  // Log the outbound SMS
  await supabase('sms_log', 'POST', [{
    restaurant_id: restaurantId,
    direction: 'outbound',
    message,
    phone: to,
    status: data.status || 'sent'
  }]);

  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // Get all SMS-managed owners with active approved restaurants
    // Get all SMS owners
    const owners = await supabase(
      'owners?auth_method=eq.sms&phone=not.is.null'
    );

    if (!owners || owners.length === 0) {
      return res.json({ sent: 0, message: 'No SMS owners found' });
    }

    // Get their restaurants separately
    const eligible = [];
    for (const owner of owners) {
      if (!owner.restaurant_id) continue;
      const restaurants = await supabase(
        `restaurants?id=eq.${owner.restaurant_id}&status=eq.approved&is_active=eq.true`
      );
      if (restaurants && restaurants.length > 0) {
        owner.restaurants = restaurants[0];
        eligible.push(owner);
      }
    }

    if (eligible.length === 0) {
      return res.json({ sent: 0, message: 'No eligible SMS owners found — check restaurant status' });
    }

    let sent = 0;
    const results = [];

    for (const owner of eligible) {
      const r = owner.restaurants;
      const name = r.name;
      const phone = owner.phone;

      const message =
        `Hi! This is 559eats 🍽️\n\n` +
        `Quick 2-question check-in for ${name}:\n\n` +
        `1️⃣ Have your hours changed?\n` +
        `Reply YES or NO\n\n` +
        `(We'll ask about your location next if needed)`;

      try {
        await sendSMS(phone, message, r.id);
        sent++;
        results.push({ name, phone, status: 'sent' });
      } catch (e) {
        results.push({ name, phone, status: 'failed', error: e.message });
      }
    }

    return res.json({ sent, total: eligible.length, results });

  } catch (err) {
    console.error('SMS check-in error:', err);
    return res.status(500).json({ error: err.message });
  }
};
