// Runs weekly. Flags listings nobody has confirmed in 90 days and texts you a summary.
const { authorized, db, sendSms, daysAgo } = require('../lib/agents');

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const stale = await db(
    `restaurants?is_active=is.true&is_stale=is.false&last_confirmed_at=lt.${daysAgo(90)}&select=id,name&limit=500`
  );
  for (const r of stale) {
    await db(`restaurants?id=eq.${r.id}`, { method: 'PATCH', body: { is_stale: true } });
  }

  if (stale.length && process.env.ADMIN_PHONE) {
    const names = stale.slice(0, 5).map((r) => r.name).join(', ');
    const more = stale.length > 5 ? ` and ${stale.length - 5} more` : '';
    await sendSms({
      to: process.env.ADMIN_PHONE,
      body: `559eats: ${stale.length} listings went stale (90+ days unconfirmed): ${names}${more}.`,
      kind: 'stale_admin_alert',
    });
  }
  res.status(200).json({ flagged: stale.length });
};
