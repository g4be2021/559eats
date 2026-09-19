// Runs the 1st of each month. Texts owners (from the owners table) to confirm their listing is current.
// Same message as the admin check-in button, so api/sms-reply.js handles the YES/NO flow.
const { authorized, db, sendSms, daysAgo } = require('../lib/agents');

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const rows = await db(
    'owners?sms_opt_out=is.false&auth_method=eq.sms&phone=not.is.null' +
      `&or=(last_checkin_sent_at.is.null,last_checkin_sent_at.lt.${daysAgo(25)})` +
      '&select=id,phone,restaurants!inner(id,name,is_active)&restaurants.is_active=is.true&limit=200'
  );

  let sent = 0, failed = 0;
  for (const o of rows) {
    const r = o.restaurants;
    const body =
      `Hi! This is 559eats 🍽️\n\n` +
      `Quick 2-question check-in for ${r.name}:\n\n` +
      `1️⃣ Have your hours changed?\n` +
      `Reply YES or NO\n\n` +
      `(We'll ask about your location next if needed)\n` +
      `Reply STOP to opt out.`;
    const out = await sendSms({ to: o.phone, body, kind: 'monthly_checkin', restaurantId: r.id, ownerId: o.id });
    if (out.ok) {
      sent++;
      await db(`owners?id=eq.${o.id}`, { method: 'PATCH', body: { last_checkin_sent_at: new Date().toISOString() } });
    } else failed++;
  }
  res.status(200).json({ checked: rows.length, sent, failed });
};
