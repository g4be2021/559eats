// ============================================
// 559eats · Booking API
// File: /api/booking.js
// Handles new booking requests + owner SMS
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '82c47f2512d5afa7312796b074b0bd19';
const TWILIO_FROM  = '+15593773665';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const COMMISSION_RATE = 0.10; // 10% per confirmed booking

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
    party_size,
    booking_date,
    booking_time,
    notes
  } = req.body;

  if (!restaurant_id || !customer_name || !customer_phone || !booking_date || !booking_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Get restaurant + owner info
    const restaurants = await supabase(`restaurants?id=eq.${restaurant_id}`);
    const restaurant = restaurants?.[0];
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const owners = await supabase(`owners?restaurant_id=eq.${restaurant_id}`);
    const owner = owners?.[0];

    // 2. Create the booking
    const bookingData = await supabase('bookings', 'POST', [{
      restaurant_id,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      party_size: parseInt(party_size) || 2,
      booking_date,
      booking_time,
      notes: notes || null,
      status: 'pending',
      commission_rate: COMMISSION_RATE
    }]);

    const booking = bookingData?.[0];
    if (!booking) throw new Error('Failed to create booking');

    // 3. SMS owner if they have a phone
    if (owner?.phone) {
      const dateStr = new Date(booking_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });
      const ownerMsg =
        `📅 New booking request!\n\n` +
        `Restaurant: ${restaurant.name}\n` +
        `Guest: ${customer_name}\n` +
        `Party of: ${party_size}\n` +
        `Date: ${dateStr} at ${booking_time}\n` +
        `Phone: ${customer_phone}\n` +
        `${notes ? 'Notes: ' + notes + '\n' : ''}` +
        `\nReply CONFIRM ${booking.id.slice(0,8)} to accept\n` +
        `Reply DECLINE ${booking.id.slice(0,8)} to decline`;

      await sendSMS(owner.phone, ownerMsg);

      // Log it
      await supabase('sms_log', 'POST', [{
        restaurant_id,
        direction: 'outbound',
        message: ownerMsg,
        phone: owner.phone,
        status: 'sent'
      }]);
    }

    // 4. SMS customer confirmation
    const dateStr = new Date(booking_date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    const customerMsg =
      `Hi ${customer_name}! Your booking request at ${restaurant.name} has been received.\n\n` +
      `📅 ${dateStr} at ${booking_time}\n` +
      `👥 Party of ${party_size}\n\n` +
      `The restaurant will confirm shortly. You'll get a text when it's confirmed.\n\n` +
      `Questions? Visit 559eats.com`;

    await sendSMS(customer_phone, customerMsg);

    return res.json({
      success: true,
      booking_id: booking.id,
      status: 'pending',
      message: 'Booking request sent. The restaurant will confirm shortly.'
    });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: err.message });
  }
};
