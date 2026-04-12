// ============================================
// 559eats · Catering Booking API
// File: /api/catering-booking.js
// Handles new requests + auto commission on confirm
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '525516f7020ffe6c2d30269212ebf7b7';
const TWILIO_FROM  = '+15593773665';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const COMMISSION_RATE = 0.15;

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

async function sendSMS(to, message) {
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
  return res.json();
}

async function triggerCommission(bookingId) {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    await fetch(`${baseUrl}/api/charge-commission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catering_booking_id: bookingId })
    });
  } catch (e) {
    console.error('Commission trigger error:', e);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    restaurant_id,
    customer_name,
    customer_phone,
    customer_email,
    event_date,
    event_location,
    guest_count,
    budget,
    notes,
    action,
    booking_id
  } = req.body;

  // ── STATUS UPDATE (confirm/decline from dashboard) ──
  if (action && booking_id) {
    try {
      if (!['confirmed', 'declined'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      await supabase(`catering_bookings?id=eq.${booking_id}`, 'PATCH', { status: action });
      if (action === 'confirmed') {
        await triggerCommission(booking_id);
      }
      return res.json({ success: true, status: action });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── NEW BOOKING REQUEST ──
  if (!restaurant_id || !customer_name || !customer_phone || !event_date || !event_location || !guest_count) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const restaurants = await supabase(`restaurants?id=eq.${restaurant_id}`);
    const restaurant = restaurants?.[0];
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const owners = await supabase(`owners?restaurant_id=eq.${restaurant_id}`);
    const owner = owners?.[0];

    const bookingData = await supabase('catering_bookings', 'POST', [{
      restaurant_id,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      event_date,
      event_location,
      guest_count: parseInt(guest_count),
      budget: budget || null,
      notes: notes || null,
      status: 'pending',
      commission_rate: COMMISSION_RATE
    }]);

    const booking = bookingData?.[0];
    if (!booking) throw new Error('Failed to create catering booking');

    const dateStr = new Date(event_date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    if (owner?.phone) {
      const ownerMsg =
        `🍽️ New catering request!\n\n` +
        `Truck: ${restaurant.name}\n` +
        `Contact: ${customer_name}\n` +
        `Phone: ${customer_phone}\n` +
        `${customer_email ? 'Email: ' + customer_email + '\n' : ''}` +
        `Date: ${dateStr}\n` +
        `Location: ${event_location}\n` +
        `Guests: ${guest_count}\n` +
        `${budget ? 'Budget: ' + budget + '\n' : ''}` +
        `${notes ? 'Notes: ' + notes + '\n' : ''}` +
        `\nLog in to confirm or decline:\n559eats.com/dashboard.html`;

      await sendSMS(owner.phone, ownerMsg);
      await supabase('sms_log', 'POST', [{
        restaurant_id,
        direction: 'outbound',
        message: ownerMsg,
        phone: owner.phone,
        status: 'sent'
      }]);
    }

    const customerMsg =
      `Hi ${customer_name}! Your catering request for ${restaurant.name} has been received. 🎉\n\n` +
      `📅 ${dateStr}\n` +
      `📍 ${event_location}\n` +
      `👥 ${guest_count} guests\n\n` +
      `The owner will confirm shortly.\n\nQuestions? Visit 559eats.com`;

    await sendSMS(customer_phone, customerMsg);

    return res.json({ success: true, booking_id: booking.id, status: 'pending' });

  } catch (err) {
    console.error('Catering booking error:', err);
    return res.status(500).json({ error: err.message });
  }
};
