// Owner dashboard: save a card on file with Stripe (no charge is made here).
const { ownerFromRequest, SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Payments are not set up yet.' });

  const owners = await ownerFromRequest(req);
  const owner = owners[0];
  if (!owner) return res.status(401).json({ error: 'Please sign in again.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  const pm = b && b.payment_method_id;
  if (!pm || !/^pm_[A-Za-z0-9]+$/.test(pm)) return res.status(400).json({ error: 'Card details missing.' });

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  try {
    let customerId = owner.stripe_customer_id;
    if (!customerId) {
      const c = await stripe.customers.create({
        email: owner.email || undefined,
        name: owner.name || undefined,
        metadata: { owner_id: owner.id, restaurant_id: owner.restaurant_id || '' },
      });
      customerId = c.id;
    }
    await stripe.paymentMethods.attach(pm, { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm } });

    if (customerId !== owner.stripe_customer_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/owners?id=eq.${owner.id}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_customer_id: customerId }),
      });
    }
    return res.status(200).json({ success: true, customer_id: customerId });
  } catch (e) {
    console.error('save-payment-method', e);
    return res.status(400).json({ error: e.message || 'Could not save card.' });
  }
};
