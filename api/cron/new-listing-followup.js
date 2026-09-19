// Runs daily. Follows up with an owner 3 days after their owner record is created, once.
const { SITE, authorized, db, sendSms, daysAgo } = require('../lib/agents');

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const rows = await db(
    'owners?sms_opt_out=is.false&auth_method=eq.sms&phone=not.is.null&followup_sent_at=is.null' +
      `&created_at=lt.${daysAgo(3)}&created_at=gt.${daysAgo(30)}` +
      '&select=id,phone,restaurants!inner(id,name,is_active)&restaurants.is_active=is.true&limit=100'
  );

  let sent = 0;
  for (const o of rows) {
    const r = o.restaurants;
    const body =
      `Hey, it's 559eats. ${r.name} is live on the map. ` +
      `Adding photos and your hours gets more people to your page: ${SITE}/dashboard.html ` +
      `Reply STOP to opt out.`;
    const out = await sendSms({ to: o.phone, body, kind: 'new_listing_followup', restaurantId: r.id, ownerId: o.id });
    if (out.ok) {
      sent++;
      await db(`owners?id=eq.${o.id}`, { method: 'PATCH', body: { followup_sent_at: new Date().toISOString() } });
    }
  }
  res.status(200).json({ checked: rows.length, sent });
};
