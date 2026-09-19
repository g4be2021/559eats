// Runs daily. Texts owners whose sponsored spot ends within 7 days, once per term.
// Requires whatever sets is_sponsored (api/subscribe.js or a Stripe webhook) to also set sponsored_until.
const { SITE, authorized, db, sendSms, daysAhead } = require('../_lib/agents');

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const now = new Date().toISOString();
  const rows = await db(
    'restaurants?is_sponsored=is.true&is_active=is.true' +
      `&sponsored_until=gt.${now}&sponsored_until=lt.${daysAhead(7)}` +
      '&select=id,name,sponsored_until,sponsored_reminder_for,owners(id,phone,sms_opt_out)&limit=100'
  );

  let sent = 0;
  for (const r of rows) {
    const already =
      r.sponsored_reminder_for &&
      new Date(r.sponsored_reminder_for).getTime() === new Date(r.sponsored_until).getTime();
    if (already) continue;

    const ends = new Date(r.sponsored_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    let any = false;
    for (const o of r.owners || []) {
      if (o.sms_opt_out || !o.phone) continue;
      const body =
        `Hey, it's 559eats. Your sponsored spot for ${r.name} ends ${ends}. ` +
        `Renew here to keep the top placement: ${SITE}/pricing.html Reply STOP to opt out.`;
      const out = await sendSms({ to: o.phone, body, kind: 'sponsored_reminder', restaurantId: r.id, ownerId: o.id });
      if (out.ok) { any = true; sent++; }
    }
    if (any) await db(`restaurants?id=eq.${r.id}`, { method: 'PATCH', body: { sponsored_reminder_for: r.sponsored_until } });
  }
  res.status(200).json({ checked: rows.length, sent });
};
