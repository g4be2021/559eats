// ============================================
// 559eats · Booking Confirm/Decline via SMS
// File: /api/booking-confirm.js
// Owner texts CONFIRM xxx or DECLINE xxx
// Add this as a second Twilio webhook or
// merge into sms-reply.js if preferred
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '525516f7020ffe6c2d30269212ebf7b7';
const TWILIO_FROM  = '+15593773665';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const ASSUMED_CHECK_AVG = 35;

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
  await fetch(
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
}

function twiml(msg) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/xml');

  let body = '';
  await new Promise(resolve => {
    req.on('data', chunk => body += chunk);
    req.on('end', resolve);
  });

  const params = new URLSearchParams(body);
  const fromPhone = params.get('From');
  const msgBody = (params.get('Body') || '').trim().toUpperCase();

  if (!fromPhone || !msgBody) {
    res.end(twiml('Could not process your message.'));
    return;
  }

  // Check if it's a booking confirmation
  const isConfirm = msgBody.startsWith('CONFIRM ');
  const isDecline = msgBody.startsWith('DECLINE ');

  if (!isConfirm && !isDecline) {
    // Pass to sms-reply handler for check-in flow
    res.end(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    return;
  }

  const shortId = msgBody.split(' ')[1];
  if (!shortId || shortId.length < 6) {
    res.end(twiml('Invalid booking ID. Reply CONFIRM or DECLINE followed by the booking ID from your notification.'));
    return;
  }

  try {
    // Find booking by short ID prefix
    const allBookings = await supabase(
      `bookings?status=eq.pending&order=created_at.desc&limit=50`
    );
    const booking = (allBookings || []).find(b => b.id.startsWith(shortId.toLowerCase()));

    if (!booking) {
      res.end(twiml(`Booking not found. Make sure you're using the ID from the notification text.`));
      return;
    }

    const restaurant = await supabase(`restaurants?id=eq.${booking.restaurant_id}`);
    const r = restaurant?.[0];

    if (isConfirm) {
      // Calculate commission (10% of estimated check)
      const estimatedCheck = booking.party_size * ASSUMED_CHECK_AVG;
      const commission = parseFloat((estimatedCheck * booking.commission_rate).toFixed(2));

      await supabase(`bookings?id=eq.${booking.id}`, 'PATCH', {
        status: 'confirmed',
        commission_amount: commission,
        updated_at: new Date().toISOString()
      });

      // Notify customer
      const dateStr = new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
      await sendSMS(booking.customer_phone,
        `✅ Your booking at ${r?.name || 'the restaurant'} is CONFIRMED!\n\n` +
        `📅 ${dateStr} at ${booking.booking_time}\n` +
        `👥 Party of ${booking.party_size}\n\n` +
        `See you there! Questions? Reply to this message.`
      );

      res.end(twiml(
        `✅ Booking confirmed for ${booking.customer_name} (party of ${booking.party_size}) ` +
        `on ${booking.booking_date} at ${booking.booking_time}.\n\n` +
        `559eats commission: $${commission} will be invoiced monthly.`
      ));

    } else {
      // Decline
      await supabase(`bookings?id=eq.${booking.id}`, 'PATCH', {
        status: 'declined',
        updated_at: new Date().toISOString()
      });

      await sendSMS(booking.customer_phone,
        `We're sorry, ${booking.customer_name} — ${r?.name || 'the restaurant'} is unable to accommodate ` +
        `your booking for ${booking.booking_date} at ${booking.booking_time}.\n\n` +
        `Please try a different time or browse other spots at 559eats.com`
      );

      res.end(twiml(`Booking declined. The customer has been notified.`));
    }

  } catch (err) {
    console.error('Booking confirm error:', err);
    res.end(twiml('Something went wrong. Please try again.'));
  }
};
