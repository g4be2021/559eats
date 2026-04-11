// ============================================
// 559eats · Stripe Subscription Backend
// File location in your project: /api/subscribe.js
// This runs as a Vercel serverless function
// ============================================

const stripe = require('stripe')('sk_test_51TKt5q6fFQWsJALk0hL3HapkOjt7FJhtgVrcXjpzLGEk9TiWaheIDJD7Ji7qdzH1QfEySnj7R61vV1edYp5iHa9Q000fD0qew9');

const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

const PRICE_FEATURED = 'price_1TKt7z6fFQWsJALkCrSm2D7e';
const PRICE_TRUCK    = 'price_1TKt8R6fFQWsJALkb0LQR7tD';

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { paymentMethodId, email, restaurantName, plan } = req.body;

  if (!paymentMethodId || !email || !restaurantName || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const priceId = plan === 'truck' ? PRICE_TRUCK : PRICE_FEATURED;

  try {
    // 1. Create or find Stripe customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    } else {
      customer = await stripe.customers.create({
        email,
        name: restaurantName,
        payment_method: paymentMethodId,
      });
    }

    // 2. Set default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId }
    });

    // 3. Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = subscription.latest_invoice;
    const paymentIntent = invoice.payment_intent;

    if (paymentIntent?.status === 'requires_action') {
      return res.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id
      });
    }

    // 4. Update Supabase — mark restaurant as sponsored/featured
    const field = plan === 'truck' ? 'is_sponsored' : 'is_featured';
    await fetch(
      `${SUPABASE_URL}/rest/v1/restaurants?name=eq.${encodeURIComponent(restaurantName)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: true })
      }
    );

    return res.json({
      success: true,
      subscriptionId: subscription.id,
      customerId: customer.id
    });

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(400).json({ error: err.message });
  }
};
