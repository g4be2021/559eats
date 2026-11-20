// ============================================
// 559eats · Catering Booking API
// File: /api/catering-booking.js
// Handles new requests + auto commission on confirm
// ============================================

const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
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

const { sendSms: sendViaProvider } = require('./_lib/sms');
const { isAdmin, ownerFromRequest } = require('./_lib/admin-auth');

async function sendSMS(to, message) {
  return sendViaProvider(to, message);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      // Only the truck's owner (or an admin) can confirm or decline
      const rows = await supabase(`catering_bookings?id=eq.${encodeURIComponent(booking_id)}&select=id,restaurant_id`);
      const bk = rows && rows[0];
      if (!bk) return res.status(404).json({ error: 'Booking not found' });
      if (!isAdmin(req)) {
        const owners = await ownerFromRequest(req);
        if (!owners.some((o) => o.restaurant_id && o.restaurant_id === bk.restaurant_id)) {
          return res.status(401).json({ error: 'Please sign in again.' });
        }
      }
      await supabase(`catering_bookings?id=eq.${encodeURIComponent(booking_id)}`, 'PATCH', { status: action, updated_at: new Date().toISOString() });
      return res.json({ success: true, status: action });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.body.website_url) return res.json({ success: true }); // honeypot

  // ── GENERAL QUOTE (catering page, no truck picked yet) ──
  if (!restaurant_id) {
    if (!customer_name || !customer_phone || !event_date) {
      return res.status(400).json({ error: 'Please fill in your name, phone and event date.' });
    }
    const saved = await supabase('catering_bookings', 'POST', [{
      restaurant_id: null,
      customer_name: String(customer_name).slice(0, 120),
      customer_phone: String(customer_phone).slice(0, 30),
      customer_email: customer_email ? String(customer_email).slice(0, 200) : null,
      event_date,
      event_location: event_location ? String(event_location).slice(0, 300) : 'Not given yet',
      guest_count: parseInt(guest_count) || 0,
      budget: budget || null,
      notes: notes ? String(notes).slice(0, 2000) : null,
      status: 'pending',
      commission_rate: COMMISSION_RATE
    }]);
    if (!Array.isArray(saved) || !saved[0]) return res.status(500).json({ error: 'Could not save your request. Please try again.' });
    return res.json({ success: true, booking_id: saved[0].id, status: 'pending' });
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

    // Customers are not texted: the registered SMS campaign only covers truck owners.

    return res.json({ success: true, booking_id: booking.id, status: 'pending' });

  } catch (err) {
    console.error('Catering booking error:', err);
    return res.status(500).json({ error: err.message });
  }
};
