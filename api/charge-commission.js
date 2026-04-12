// ============================================
// 559eats · Charge Commission API
// File: /api/charge-commission.js
// Charges 15% commission on confirmed catering
// ============================================

const STRIPE_SK = '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';
const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const COMMISSION_RATE = 0.15;

// Budget string → estimated dollar midpoint for commission calculation
const BUDGET_MAP = {
  'Under $500': 350,
  '$500 – $1,000': 750,
  '$1,000 – $2,500': 1750,
  '$2,500 – $5,000': 3750,
  '$5,000+': 6000
};

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

async function stripeRequest(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SK}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (body) opts.body = new URLSearchParams(body).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}`, opts);
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { catering_booking_id } = req.body;
  if (!catering_booking_id) return res.status(400).json({ error: 'Missing catering_booking_id' });

  try {
    // 1. Get catering booking
    const bookings = await supabase(`catering_bookings?id=eq.${catering_booking_id}`);
    const booking = bookings?.[0];
    if (!booking) return res.status(404).json({ error: 'Catering booking not found' });
    if (booking.commission_paid) return res.json({ success: true, message: 'Commission already collected' });

    // 2. Get restaurant + owner
    const restaurants = await supabase(`restaurants?id=eq.${booking.restaurant_id}`);
    const restaurant = restaurants?.[0];

    const owners = await supabase(`owners?restaurant_id=eq.${booking.restaurant_id}`);
    const owner = owners?.[0];

    if (!owner?.stripe_customer_id) {
      // Mark as unpaid — no card on file
      await supabase(`catering_bookings?id=eq.${catering_booking_id}`, 'PATCH', {
        commission_rate: COMMISSION_RATE,
        commission_paid: false
      });
      return res.json({
        success: false,
        no_card: true,
        message: 'No payment method on file for this owner.'
      });
    }

    // 3. Calculate commission from budget estimate
    const budgetEstimate = BUDGET_MAP[booking.budget] || 1000;
    const commissionAmount = Math.round(budgetEstimate * COMMISSION_RATE * 100); // in cents

    // 4. Get default payment method
    const customer = await stripeRequest(`customers/${owner.stripe_customer_id}`);
    const paymentMethodId = customer?.invoice_settings?.default_payment_method;

    if (!paymentMethodId) {
      await supabase(`catering_bookings?id=eq.${catering_booking_id}`, 'PATCH', {
        commission_rate: COMMISSION_RATE,
        commission_paid: false
      });
      return res.json({ success: false, no_card: true, message: 'No default payment method found.' });
    }

    // 5. Create Stripe PaymentIntent and confirm
    const dateStr = booking.event_date
      ? new Date(booking.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'event';

    const paymentIntent = await stripeRequest('payment_intents', 'POST', {
      amount: commissionAmount,
      currency: 'usd',
      customer: owner.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: 'true',
      off_session: 'true',
      description: `559eats 15% catering commission — ${restaurant?.name || 'Restaurant'} — ${dateStr}`,
      metadata: {
        catering_booking_id,
        restaurant_id: booking.restaurant_id,
        restaurant_name: restaurant?.name || ''
      }
    });

    if (paymentIntent.error || paymentIntent.status === 'requires_action') {
      await supabase(`catering_bookings?id=eq.${catering_booking_id}`, 'PATCH', {
        commission_rate: COMMISSION_RATE,
        commission_amount: commissionAmount / 100,
        commission_paid: false
      });
      return res.json({
        success: false,
        message: paymentIntent.error?.message || 'Payment requires additional authentication.'
      });
    }

    // 6. Mark as paid in Supabase
    await supabase(`catering_bookings?id=eq.${catering_booking_id}`, 'PATCH', {
      commission_rate: COMMISSION_RATE,
      commission_amount: commissionAmount / 100,
      commission_paid: true,
      stripe_charge_id: paymentIntent.id
    });

    return res.json({
      success: true,
      amount_charged: commissionAmount / 100,
      stripe_id: paymentIntent.id
    });

  } catch (err) {
    console.error('Commission charge error:', err);
    return res.status(500).json({ error: err.message });
  }
};
