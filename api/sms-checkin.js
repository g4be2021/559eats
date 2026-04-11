const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '525516f7020ffe6c2d30269212ebf7b7';
const TWILIO_FROM  = '+15593773665';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

async function supabase(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  return data;
}

async function supabasePost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
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
  console.log('Twilio response:', JSON.stringify(data));

  try {
    await supabasePost('sms_log', [{
      restaurant_id: restaurantId,
      direction: 'outbound',
      message,
      phone: to,
      status: data.status || 'sent'
    }]);
  } catch(e) {
    console.log('SMS log error:', e.message);
  }

  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const debug = {};

  try {
    // Step 1: get all owners
    const owners = await supabase('owners?select=*');
    debug.total_owners = owners?.length || 0;
    debug.owners_raw = owners;

    if (!owners || owners.length === 0) {
      return res.json({ sent: 0, message: 'No owners in database at all', debug });
    }

    // Step 2: filter SMS owners with phone
    const smsOwners = owners.filter(o => o.auth_method === 'sms' && o.phone);
    debug.sms_owners = smsOwners.length;
    debug.sms_owners_data = smsOwners;

    if (smsOwners.length === 0) {
      return res.json({ sent: 0, message: 'No owners with auth_method=sms and phone set', debug });
    }

    // Step 3: check their restaurants
    const eligible = [];
    for (const owner of smsOwners) {
      if (!owner.restaurant_id) {
        debug['owner_' + owner.id] = 'no restaurant_id';
        continue;
      }
      const restaurants = await supabase(`restaurants?id=eq.${owner.restaurant_id}`);
      const r = restaurants?.[0];
      debug['restaurant_' + owner.restaurant_id] = r ? { name: r.name, status: r.status, is_active: r.is_active } : 'not found';

      if (r) {
        owner.restaurant = r;
        eligible.push(owner);
      }
    }

    debug.eligible = eligible.length;

    if (eligible.length === 0) {
      return res.json({ sent: 0, message: 'No eligible owners found', debug });
    }

    // Step 4: send SMS
    let sent = 0;
    const results = [];

    for (const owner of eligible) {
      const r = owner.restaurant;
      const message =
        `Hi! This is 559eats 🍽️\n\n` +
        `Quick 2-question check-in for ${r.name}:\n\n` +
        `1️⃣ Have your hours changed?\n` +
        `Reply YES or NO\n\n` +
        `(We'll ask about your location next if needed)`;

      try {
        const twilioResult = await sendSMS(owner.phone, message, r.id);
        if (twilioResult.sid) {
          sent++;
          results.push({ name: r.name, phone: owner.phone, status: 'sent', sid: twilioResult.sid });
        } else {
          results.push({ name: r.name, phone: owner.phone, status: 'failed', error: twilioResult.message || JSON.stringify(twilioResult) });
        }
      } catch (e) {
        results.push({ name: r.name, phone: owner.phone, status: 'error', error: e.message });
      }
    }

    return res.json({ sent, total: eligible.length, results, debug });

  } catch (err) {
    console.error('SMS check-in error:', err);
    return res.status(500).json({ error: err.message, debug });
  }
};
