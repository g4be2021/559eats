// 559eats · Featured truck subscriptions (Stripe)
//   POST /api/subscribe?a=checkout  (signed-in owner)  -> { url } Stripe Checkout page
//   POST /api/subscribe?a=confirm   { session_id }     -> turns Featured on after payment
//   POST /api/subscribe?a=cancel    (signed-in owner)  -> cancels at end of the paid month
//   GET  /api/subscribe?a=status    (signed-in owner)  -> current plan
//   GET  /api/subscribe?a=sync      (Vercel cron)      -> renews / expires Featured from Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ownerFromRequest, SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');

const PRICE_FEATURED = 'price_1TKv6u6fFQWsJALk6udajtpi'; // old $29 Featured price, only used to recognize older subscriptions
// Sponsor tiers. Prices are created in Stripe on first use (looked up by lookup_key after that).
const TIERS = {
  1: { name: 'Spotlight', cents: 100, lookup: 'eats_sponsor_spotlight_1usd_monthly' },
  2: { name: 'Featured', cents: 300, lookup: 'eats_sponsor_featured_3usd_monthly' },
  3: { name: 'Premium', cents: 600, lookup: 'eats_sponsor_premium_6usd_monthly' },
};
const priceCache = {};
async function priceFor(tier) {
  const t = TIERS[tier];
  if (!t) throw new Error('bad tier');
  if (t.price) return t.price;
  if (priceCache[tier]) return priceCache[tier];
  const found = await stripe.prices.list({ lookup_keys: [t.lookup], active: true, limit: 1 });
  if (found.data[0]) return (priceCache[tier] = found.data[0].id);
  const product = await stripe.products.create({ name: `559eats ${t.name} sponsor`, metadata: { tier: String(tier) } });
  const p = await stripe.prices.create({ product: product.id, unit_amount: t.cents, currency: 'usd', recurring: { interval: 'month' }, lookup_key: t.lookup });
  return (priceCache[tier] = p.id);
}
function tierOf(sub) {
  const m = Number(sub.metadata && sub.metadata.tier);
  if (m >= 1 && m <= 3) return m;
  const pid = sub.items && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
  if (pid === PRICE_FEATURED) return 2;
  const lk = sub.items && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.lookup_key;
  return lk === TIERS[1].lookup ? 1 : lk === TIERS[3].lookup ? 3 : 2;
}
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

const periodEnd = (sub) => sub.current_period_end || (sub.items && sub.items.data[0] && sub.items.data[0].current_period_end);
const until = (sub) => new Date(periodEnd(sub) * 1000 + GRACE_MS).toISOString();
const live = (sub) => ['active', 'trialing', 'past_due'].includes(sub.status);

async function ownerTruck(req) {
  const owners = await ownerFromRequest(req);
  const o = owners.find((x) => x.restaurant_id);
  if (!o) return null;
  const rows = await db(`restaurants?id=eq.${o.restaurant_id}&select=id,name,is_featured,sponsored_until,sponsor_tier,stripe_customer_id,stripe_subscription_id`);
  return rows[0] ? { owner: o, truck: rows[0] } : null;
}

async function applySub(restaurantId, sub) {
  await db(`restaurants?id=eq.${restaurantId}`, {
    method: 'PATCH',
    body: live(sub)
      ? { is_featured: true, sponsor_tier: tierOf(sub), sponsored_until: until(sub), stripe_customer_id: sub.customer, stripe_subscription_id: sub.id }
      : { is_featured: false, sponsor_tier: 0, stripe_subscription_id: sub.id },
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
          await db(`restaurants?id=eq.${r.id}`, { method: 'PATCH', body: { is_featured: false, sponsor_tier: 0 } });
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
      return res.json({ ok: true, featured: live(s.subscription), tier: tierOf(s.subscription), until: until(s.subscription) });
    }

    const me = await ownerTruck(req);
    if (!me) return res.status(401).json({ error: 'Log in to your owner dashboard first.' });
    const { owner, truck } = me;

    if (a === 'status') {
      let sub = null;
      if (truck.stripe_subscription_id) sub = await stripe.subscriptions.retrieve(truck.stripe_subscription_id).catch(() => null);
      return res.json({
        featured: !!(truck.is_featured && (!truck.sponsored_until || new Date(truck.sponsored_until) > new Date())),
        tier: truck.is_featured ? (truck.sponsor_tier || 2) : 0,
        paid: !!(sub && live(sub)),
        until: truck.sponsored_until,
        tiers: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, { name: v.name, price: v.cents / 100 }])),
        status: sub && sub.status,
        cancels: !!(sub && sub.cancel_at_period_end),
      });
    }

    if (req.method !== 'POST') return res.status(405).end();

    if (a === 'checkout') {
      const tier = Number((req.body && req.body.tier) || 2);
      if (!TIERS[tier]) return res.status(400).json({ error: 'Pick a plan' });
      const price = await priceFor(tier);
      if (truck.stripe_subscription_id) {
        const cur = await stripe.subscriptions.retrieve(truck.stripe_subscription_id).catch(() => null);
        if (cur && live(cur)) {
          // Already paying: switch plan in place (Stripe prorates the difference)
          const item = cur.items.data[0];
          const upd = await stripe.subscriptions.update(cur.id, {
            cancel_at_period_end: false,
            items: [{ id: item.id, price }],
            proration_behavior: 'create_prorations',
            metadata: { ...(cur.metadata || {}), tier: String(tier) },
          });
          await applySub(truck.id, upd);
          return res.json({ already: true, tier });
        }
      }
      const s = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        customer: truck.stripe_customer_id || undefined,
        customer_email: truck.stripe_customer_id ? undefined : owner.email || undefined,
        client_reference_id: truck.id,
        metadata: { restaurant_id: truck.id, tier: String(tier) },
        subscription_data: { metadata: { restaurant_id: truck.id, truck: truck.name, tier: String(tier) } },
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
