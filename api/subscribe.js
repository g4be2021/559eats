// 559eats · Featured truck subscriptions (Stripe)
//   POST /api/subscribe?a=checkout  (signed-in owner)  -> { url } Stripe Checkout page
//   POST /api/subscribe?a=confirm   { session_id }     -> turns Featured on after payment
//   POST /api/subscribe?a=cancel    (signed-in owner)  -> cancels at end of the paid month
//   GET  /api/subscribe?a=status    (signed-in owner)  -> current plan
//   GET  /api/subscribe?a=sync      (Vercel cron)      -> renews / expires Featured from Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ownerFromRequest, SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');

const PRICE_FEATURED = 'price_1TKv6u6fFQWsJALk6udajtpi'; // $29 / month
const SITE = process.env.SITE_URL || 'https://559eats.com';
const GRACE_MS = 2 * 24 * 3600 * 1000; // keeps the badge through Stripe retry days

async function db(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) throw new Error(`db ${r.status} ${await r.text()}`);
  return opts.method && opts.method !== 'GET' ? null : r.json();
}

const until = (sub) => new Date(sub.current_period_end * 1000 + GRACE_MS).toISOString();
const live = (sub) => ['active', 'trialing', 'past_due'].includes(sub.status);

async function ownerTruck(req) {
  const owners = await ownerFromRequest(req);
  const o = owners.find((x) => x.restaurant_id);
  if (!o) return null;
  const rows = await db(`restaurants?id=eq.${o.restaurant_id}&select=id,name,is_featured,sponsored_until,stripe_customer_id,stripe_subscription_id`);
  return rows[0] ? { owner: o, truck: rows[0] } : null;
}

async function applySub(restaurantId, sub) {
  await db(`restaurants?id=eq.${restaurantId}`, {
    method: 'PATCH',
    body: live(sub)
      ? { is_featured: true, sponsored_until: until(sub), stripe_customer_id: sub.customer, stripe_subscription_id: sub.id }
      : { is_featured: false, stripe_subscription_id: sub.id },
  });
}

module.exports = async (req, res) => {
  const a = (req.query && req.query.a) || '';
  try {
    if (a === 'sync') {
      const ok = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
      if (!ok) return res.status(401).json({ error: 'unauthorized' });
      const rows = await db('restaurants?or=(is_featured.is.true,stripe_subscription_id.not.is.null)&select=id,is_featured,sponsored_until,stripe_subscription_id');
      let renewed = 0, ended = 0;
      for (const r of rows) {
        if (r.stripe_subscription_id) {
          const sub = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
          await applySub(r.id, sub);
          live(sub) ? renewed++ : r.is_featured && ended++;
        } else if (r.is_featured && r.sponsored_until && new Date(r.sponsored_until) < new Date()) {
          // Featured set by hand in admin with an end date that has passed
          await db(`restaurants?id=eq.${r.id}`, { method: 'PATCH', body: { is_featured: false } });
          ended++;
        }
      }
      return res.json({ ok: true, renewed, ended });
    }

    if (a === 'confirm') {
      if (req.method !== 'POST') return res.status(405).end();
      const id = String((req.body && req.body.session_id) || '');
      if (!/^cs_/.test(id)) return res.status(400).json({ error: 'Bad session' });
      const s = await stripe.checkout.sessions.retrieve(id, { expand: ['subscription'] });
      const rid = s.metadata && s.metadata.restaurant_id;
      if (!rid || s.status !== 'complete' || !s.subscription) return res.status(400).json({ error: 'Payment not finished' });
      await applySub(rid, s.subscription);
      return res.json({ ok: true, featured: live(s.subscription), until: until(s.subscription) });
    }

    const me = await ownerTruck(req);
    if (!me) return res.status(401).json({ error: 'Log in to your owner dashboard first.' });
    const { owner, truck } = me;

    if (a === 'status') {
      let sub = null;
      if (truck.stripe_subscription_id) sub = await stripe.subscriptions.retrieve(truck.stripe_subscription_id).catch(() => null);
      return res.json({
        featured: !!(truck.is_featured && (!truck.sponsored_until || new Date(truck.sponsored_until) > new Date())),
        until: truck.sponsored_until,
        status: sub && sub.status,
        cancels: !!(sub && sub.cancel_at_period_end),
      });
    }

    if (req.method !== 'POST') return res.status(405).end();

    if (a === 'checkout') {
      if (truck.stripe_subscription_id) {
        const cur = await stripe.subscriptions.retrieve(truck.stripe_subscription_id).catch(() => null);
        if (cur && live(cur)) {
          if (cur.cancel_at_period_end) await stripe.subscriptions.update(cur.id, { cancel_at_period_end: false });
          await applySub(truck.id, cur);
          return res.json({ already: true });
        }
      }
      const s = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: PRICE_FEATURED, quantity: 1 }],
        customer: truck.stripe_customer_id || undefined,
        customer_email: truck.stripe_customer_id ? undefined : owner.email || undefined,
        client_reference_id: truck.id,
        metadata: { restaurant_id: truck.id },
        subscription_data: { metadata: { restaurant_id: truck.id, truck: truck.name } },
        allow_promotion_codes: true,
        success_url: `${SITE}/dashboard.html?featured=done&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE}/dashboard.html?featured=cancel`,
      });
      return res.json({ url: s.url });
    }

    if (a === 'cancel') {
      if (!truck.stripe_subscription_id) return res.status(400).json({ error: 'No active plan' });
      const sub = await stripe.subscriptions.update(truck.stripe_subscription_id, { cancel_at_period_end: true });
      await applySub(truck.id, sub);
      return res.json({ ok: true, until: until(sub) });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('subscribe', e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
