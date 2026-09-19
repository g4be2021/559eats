// ============================================
// 559eats · Booking Confirm/Decline via SMS
// Owner texts CONFIRM xxx or DECLINE xxx. Called through /api/sms-inbound.
// Only a phone number saved for that restaurant's owner can confirm or decline.
// ============================================
const { sendSms, parseInbound } = require('../_lib/sms');

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

const last10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

async function respond(res, to, message) {
  if (message) await sendSms(to, message);
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  const inbound = req.inbound || await parseInbound(req);
  const fromPhone = inbound.from;
  const msgBody = (inbound.text || '').trim().toUpperCase();

  if (inbound.ignore) return res.status(200).json({ ok: true, ignored: true });
  if (!fromPhone || !msgBody) return res.status(400).json({ error: 'Could not process message' });

  const isConfirm = msgBody.startsWith('CONFIRM ');
  const isDecline = msgBody.startsWith('DECLINE ');
  if (!isConfirm && !isDecline) return res.status(200).json({ ok: true, ignored: true });

  const shortId = msgBody.split(' ')[1];
  if (!shortId || shortId.length < 6) {
    return respond(res, fromPhone, 'Invalid booking ID. Reply CONFIRM or DECLINE followed by the booking ID from your notification.');
  }

  try {
    const allBookings = await supabase(`bookings?status=eq.pending&order=created_at.desc&limit=50`);
    const booking = (allBookings || []).find(b => b.id.startsWith(shortId.toLowerCase()));

    if (!booking) {
      return respond(res, fromPhone, `Booking not found. Make sure you're using the ID from the notification text.`);
    }

    // The sender must be an owner of this restaurant.
    const owners = await supabase(`owners?restaurant_id=eq.${booking.restaurant_id}&select=phone`);
    const allowed = (owners || []).some(o => last10(o.phone) && last10(o.phone) === last10(fromPhone));
    if (!allowed) {
      return respond(res, fromPhone, `This number isn't set up to manage that booking. Contact 559eats for help.`);
    }

    const restaurant = await supabase(`restaurants?id=eq.${booking.restaurant_id}`);
    const r = restaurant?.[0];

    if (isConfirm) {
      const estimatedCheck = booking.party_size * ASSUMED_CHECK_AVG;
      const commission = parseFloat((estimatedCheck * booking.commission_rate).toFixed(2));

      await supabase(`bookings?id=eq.${booking.id}`, 'PATCH', {
        status: 'confirmed',
        commission_amount: commission,
        updated_at: new Date().toISOString()
      });

      const dateStr = new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
      await sendSms(booking.customer_phone,
        `✅ Your booking at ${r?.name || 'the restaurant'} is CONFIRMED!\n\n` +
        `📅 ${dateStr} at ${booking.booking_time}\n` +
        `👥 Party of ${booking.party_size}\n\n` +
        `See you there! Questions? Reply to this message.`
      );

      return respond(res, fromPhone,
        `✅ Booking confirmed for ${booking.customer_name} (party of ${booking.party_size}) ` +
        `on ${booking.booking_date} at ${booking.booking_time}.\n\n` +
        `559eats commission: $${commission} will be invoiced monthly.`
      );
    }

    await supabase(`bookings?id=eq.${booking.id}`, 'PATCH', {
      status: 'declined',
      updated_at: new Date().toISOString()
    });
    await sendSms(booking.customer_phone,
      `We're sorry, ${booking.customer_name}. ${r?.name || 'The restaurant'} is unable to accommodate ` +
      `your booking for ${booking.booking_date} at ${booking.booking_time}.\n\n` +
      `Please try a different time or browse other spots at 559eats.com`
    );
    return respond(res, fromPhone, `Booking declined. The customer has been notified.`);
  } catch (err) {
    console.error('Booking confirm error:', err);
    return respond(res, fromPhone, 'Something went wrong. Please try again.');
  }
};
