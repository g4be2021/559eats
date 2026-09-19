// ============================================
// 559eats · Inbound SMS router
// Point your provider's inbound webhook at:
//   https://559eats.com/api/sms-inbound?key=YOUR_SMS_WEBHOOK_KEY
// CONFIRM/DECLINE texts go to booking-confirm, everything else to sms-reply.
// ============================================
const { parseInbound, webhookAllowed } = require('./lib/sms');
const smsReply = require('./sms-reply');
const bookingConfirm = require('./booking-confirm');

module.exports = async (req, res) => {
  if (!webhookAllowed(req)) return res.status(401).json({ error: 'unauthorized' });
  const inbound = await parseInbound(req);
  if (inbound.ignore || !inbound.from || !inbound.text) return res.status(200).json({ ok: true, ignored: true });
  req.inbound = inbound;
  const t = inbound.text.trim().toUpperCase();
  const isBooking = t.startsWith('CONFIRM ') || t.startsWith('DECLINE ');
  return (isBooking ? bookingConfirm : smsReply)(req, res);
};
