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

// Top of each budget range on the catering form. The fee base is the lower of
// the agreed price and this cap (Terms section 5). "$5,000+" has no cap.
const BUDGET_CAPS = { 'Under $500': 500, '$500 to $1,000': 1000, '$1,000 to $2,500': 2500, '$2,500 to $5,000': 5000 };

function feeFor(total, budget) {
  const cap = BUDGET_CAPS[String(budget || '').trim()];
  const base = cap ? Math.min(total, cap) : total;
  return Math.round(base * COMMISSION_RATE * 100) / 100;
}

function newRequestText(b, truckName) {
  const dateStr = new Date(b.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return `559eats: New catering request for ${truckName}\n` +
    `Contact: ${b.customer_name}, ${b.customer_phone}\n` +
    `Date: ${dateStr}\nLocation: ${b.event_location}\nGuests: ${b.guest_count || '?'}\n` +
    `${b.budget ? 'Budget: ' + b.budget + '\n' : ''}` +
    `Confirm or decline at 559eats.com/dashboard.html`;
}

async function alertAdmin(text) {
  if (!process.env.ADMIN_PHONE) return;
  try { await sendSMS(process.env.ADMIN_PHONE, text); } catch (e) { /* best effort */ }
}

// Charge the 15% fee to the owner's saved card. Never throws; records the result on the booking.
async function chargeFee(bk) {
  const fail = async (msg) => {
    await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', { commission_error: msg.slice(0, 300), updated_at: new Date().toISOString() });
    await alertAdmin(`559eats: catering fee $${Number(bk.commission_amount).toFixed(2)} NOT charged (booking ${String(bk.id).slice(0, 8)}). Reason: ${msg}`);
    return { ok: false, error: msg };
  };
  if (!process.env.STRIPE_SECRET_KEY) return fail('Payments are not set up.');
  const cents = Math.round(Number(bk.commission_amount) * 100);
  if (!(cents >= 50)) {
    // Stripe can't charge under $0.50; waive tiny fees.
    await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', { commission_paid: true, commission_error: 'Under $0.50, waived', charged_at: new Date().toISOString() });
    return { ok: true };
  }
  const owners = await supabase(`owners?restaurant_id=eq.${bk.restaurant_id}&stripe_customer_id=not.is.null&select=id,stripe_customer_id`);
  const customer = owners && owners[0] && owners[0].stripe_customer_id;
  if (!customer) return fail('No card on file.');

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  try {
    const c = await stripe.customers.retrieve(customer);
    let pm = c && c.invoice_settings && c.invoice_settings.default_payment_method;
    if (pm && typeof pm === 'object') pm = pm.id;
    if (!pm) {
      const list = await stripe.paymentMethods.list({ customer, type: 'card', limit: 1 });
      pm = list.data[0] && list.data[0].id;
    }
    if (!pm) return fail('No card on file.');
    const pi = await stripe.paymentIntents.create({
      amount: cents, currency: 'usd', customer, payment_method: pm,
      off_session: true, confirm: true,
      description: `559eats catering booking fee (15%) for ${bk.event_date}`,
      statement_descriptor_suffix: 'CATERING FEE',
      metadata: { booking_id: bk.id, restaurant_id: bk.restaurant_id, job_total: String(bk.job_total || '') },
    }, { idempotencyKey: `cfee-${bk.id}-${pm}` });
    if (pi.status !== 'succeeded') return fail(`Payment status: ${pi.status}`);
    await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', {
      commission_paid: true, stripe_charge_id: pi.id, charged_at: new Date().toISOString(), commission_error: null,
    });
    return { ok: true, id: pi.id };
  } catch (e) {
    const msg = (e && e.code === 'authentication_required') ? 'Card needs the owner to approve the payment.'
      : (e && e.message) || 'Card was declined.';
    return fail(msg);
  }
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

  // ── OWNER / ADMIN ACTIONS ──
  if (action && booking_id) {
    try {
      if (!['confirmed', 'declined', 'charge', 'assign'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      const rows = await supabase(`catering_bookings?id=eq.${encodeURIComponent(booking_id)}&select=*`);
      const bk = rows && rows[0];
      if (!bk) return res.status(404).json({ error: 'Booking not found' });
      const admin = isAdmin(req);

      // Admin sends a general request to a truck
      if (action === 'assign') {
        if (!admin) return res.status(401).json({ error: 'Admins only.' });
        if (bk.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be assigned.' });
        const rid = req.body.restaurant_id;
        if (!rid || !/^[0-9a-f-]{36}$/.test(rid)) return res.status(400).json({ error: 'Pick a truck.' });
        const trucks = await supabase(`restaurants?id=eq.${rid}&select=id,name`);
        if (!trucks || !trucks[0]) return res.status(404).json({ error: 'Truck not found' });
        await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', { restaurant_id: rid, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        const owners = await supabase(`owners?restaurant_id=eq.${rid}&select=phone,email`);
        const owner = (owners || []).find((o) => o.phone) || null;
        let texted = false;
        if (owner) {
          const r = await sendSMS(owner.phone, newRequestText({ ...bk, restaurant_id: rid }, trucks[0].name)).catch(() => null);
          texted = !!(r && r.ok);
        }
        return res.json({ success: true, truck: trucks[0].name, has_owner: !!(owners && owners.length), texted });
      }

      // Everything else: the truck's owner or an admin
      if (!bk.restaurant_id) return res.status(400).json({ error: 'Assign this request to a truck first.' });
      if (!admin) {
        const owners = await ownerFromRequest(req);
        if (!owners.some((o) => o.restaurant_id && o.restaurant_id === bk.restaurant_id)) {
          return res.status(401).json({ error: 'Please sign in again.' });
        }
      }

      if (action === 'declined') {
        if (bk.status !== 'pending') return res.status(400).json({ error: 'This request was already handled.' });
        await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', { status: 'declined', updated_at: new Date().toISOString() });
        return res.json({ success: true, status: 'declined' });
      }

      if (action === 'confirmed') {
        if (bk.status !== 'pending') return res.status(400).json({ error: 'This request was already handled.' });
        const total = Math.round(parseFloat(String(req.body.job_total || '').replace(/[^0-9.]/g, '')) * 100) / 100;
        if (!(total >= 1) || total > 100000) return res.status(400).json({ error: 'Enter the price you agreed on with the customer.' });
        const fee = feeFor(total, bk.budget);
        await supabase(`catering_bookings?id=eq.${bk.id}`, 'PATCH', {
          status: 'confirmed', job_total: total, commission_amount: fee, commission_paid: false,
          commission_error: null, updated_at: new Date().toISOString(),
        });
        const charge = await chargeFee({ ...bk, job_total: total, commission_amount: fee });
        return res.json({ success: true, status: 'confirmed', fee, charged: charge.ok, charge_error: charge.ok ? null : charge.error });
      }

      if (action === 'charge') {
        if (bk.status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed bookings have a fee.' });
        if (bk.commission_paid) return res.json({ success: true, charged: true, fee: Number(bk.commission_amount) });
        if (!bk.commission_amount) return res.status(400).json({ error: 'No fee amount on this booking.' });
        const charge = await chargeFee(bk);
        return res.json({ success: charge.ok, charged: charge.ok, fee: Number(bk.commission_amount), error: charge.ok ? null : charge.error, charge_error: charge.ok ? null : charge.error });
      }
    } catch (err) {
      console.error('catering action', err);
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


    if (owner?.phone) {
      const ownerMsg = newRequestText(booking, restaurant.name);

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
