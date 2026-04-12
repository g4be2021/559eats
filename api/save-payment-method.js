// ============================================
// 559eats · Save Payment Method API
// File: /api/save-payment-method.js
// Saves owner card to Stripe & Supabase
// ============================================

const STRIPE_SK = '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';
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

  const { payment_method_id, owner_id, email, name } = req.body;

  if (!payment_method_id || !owner_id || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if owner already has a Stripe customer
    const owners = await supabase(`owners?id=eq.${owner_id}`);
    const owner = owners?.[0];
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    let customerId = owner.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripeRequest('customers', 'POST', {
        email,
        name: name || email,
        metadata: { owner_id, supabase_url: SUPABASE_URL }
      });
      if (customer.error) throw new Error(customer.error.message);
      customerId = customer.id;

      // Save customer ID to Supabase
      await supabase(`owners?id=eq.${owner_id}`, 'PATCH', {
        stripe_customer_id: customerId
      });
    }

    // Attach payment method to customer
    await stripeRequest(`payment_methods/${payment_method_id}/attach`, 'POST', {
      customer: customerId
    });

    // Set as default payment method
    await stripeRequest(`customers/${customerId}`, 'POST', {
      'invoice_settings[default_payment_method]': payment_method_id
    });

    return res.json({ success: true, customer_id: customerId });

  } catch (err) {
    console.error('Save payment method error:', err);
    return res.status(500).json({ error: err.message });
  }
};
