// ============================================
// 559eats · SMS Reply Handler (check-in flow)
// Called through /api/sms-inbound. Works with any provider in lib/sms.js.
// ============================================
const { sendSms, parseInbound } = require('../_lib/sms');

const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
const START_WORDS = ['START', 'UNSTOP'];

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

// Owners may have their phone saved in different formats, so match a few.
function phoneFilter(e164) {
  const d = String(e164).replace(/\D/g, '');
  const ten = d.slice(-10);
  const variants = [e164, `1${ten}`, ten, `+1${ten}`];
  return 'or=(' + [...new Set(variants)].map(v => `phone.eq.${encodeURIComponent(v)}`).join(',') + ')';
}

// Providers have no inline reply like TwiML, so replies go out as a normal text.
async function respond(res, to, message, logRestaurantId) {
  if (message) {
    const out = await sendSms(to, message);
    if (logRestaurantId) {
      await supabase('sms_log', 'POST', [{
        restaurant_id: logRestaurantId, direction: 'outbound', message, phone: to,
        status: out.ok ? 'sent' : 'failed'
      }]);
    }
  }
  res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  const inbound = req.inbound || await parseInbound(req);
  const fromPhone = inbound.from;
  const rawText = (inbound.text || '').trim();
  const incomingMsg = rawText.toUpperCase();

  if (inbound.ignore) return res.status(200).json({ ok: true, ignored: true });
  if (!fromPhone) return res.status(400).json({ error: 'Could not process message' });

  try {
    // Opt out / opt in. The provider sends the required auto-reply itself.
    if (STOP_WORDS.includes(incomingMsg) || START_WORDS.includes(incomingMsg)) {
      await supabase(`owners?${phoneFilter(fromPhone)}`, 'PATCH', { sms_opt_out: STOP_WORDS.includes(incomingMsg) });
      return res.status(200).json({ ok: true });
    }

    const owners = await supabase(`owners?${phoneFilter(fromPhone)}&select=*,restaurants(*)`);

    if (!owners || owners.length === 0) {
      return respond(res, fromPhone,
        `Hi! We don't recognize this number in our 559eats system. ` +
        `If you'd like to list your restaurant, visit 559eats.com/apply`);
    }

    const owner = owners[0];
    const restaurant = owner.restaurants;

    await supabase('sms_log', 'POST', [{
      restaurant_id: restaurant?.id || null,
      direction: 'inbound',
      message: rawText,
      phone: fromPhone,
      status: 'received'
    }]);

    if (!restaurant) {
      return respond(res, fromPhone, `We found your account but no restaurant is linked yet. Contact 559eats for help.`);
    }

    const recentLogs = await supabase(
      `sms_log?restaurant_id=eq.${restaurant.id}&direction=eq.outbound&order=sent_at.desc&limit=1`
    );
    const lastOutbound = recentLogs?.[0]?.message || '';
    const awaitingHours = lastOutbound.includes('Have your hours changed') || lastOutbound.includes('hours changed');
    const awaitingAddress = lastOutbound.includes('current address') || lastOutbound.includes('find you today');

    if (awaitingHours) {
      if (incomingMsg === 'YES' || incomingMsg === 'Y') {
        return respond(res, fromPhone,
          `Got it! What are your current hours?\n\n` +
          `Reply in this format:\n` +
          `Mon-Fri 11am-9pm, Sat 12pm-10pm, Sun Closed\n\n` +
          `Or just describe them however is easiest for you.`, restaurant.id);
      } else if (incomingMsg === 'NO' || incomingMsg === 'N') {
        return respond(res, fromPhone,
          `Perfect, hours are up to date! 👍\n\n` +
          `2️⃣ Where can people find ${restaurant.name} today?\n\n` +
          `Reply with your current address or location.`, restaurant.id);
      }
      return respond(res, fromPhone, `Just reply YES or NO. Have your hours changed since last time?`);
    }

    if (awaitingAddress) {
      await supabase(`restaurants?id=eq.${restaurant.id}`, 'PATCH',
        { address: rawText, sms_last_updated: new Date().toISOString(), last_confirmed_at: new Date().toISOString(), is_stale: false });
      return respond(res, fromPhone,
        `✅ Got it! We've updated your location to:\n"${rawText}"\n\n` +
        `Your 559eats listing is up to date. Thanks ${owner.name || 'there'}! 🙌\n\n` +
        `We'll check in again next month.`);
    }

    const recentInbound = await supabase(
      `sms_log?restaurant_id=eq.${restaurant.id}&direction=eq.inbound&order=sent_at.desc&limit=3`
    );
    const justSaidYes = (recentInbound || []).some(l =>
      l.message?.toUpperCase() === 'YES' || l.message?.toUpperCase() === 'Y'
    );

    if (justSaidYes && incomingMsg.length > 3) {
      await supabase(`restaurants?id=eq.${restaurant.id}`, 'PATCH',
        { description: `Hours: ${rawText}`, sms_last_updated: new Date().toISOString() });
      return respond(res, fromPhone,
        `✅ Hours updated!\n\n` +
        `2️⃣ Where can people find ${restaurant.name} today?\n\n` +
        `Reply with your current address or location.`, restaurant.id);
    }

    return respond(res, fromPhone,
      `Hi from 559eats! 👋 We didn't quite catch that.\n\n` +
      `If you're responding to a check-in, just reply YES or NO to our last message.\n\n` +
      `Questions? Visit 559eats.com`);
  } catch (err) {
    console.error('SMS reply error:', err);
    return respond(res, fromPhone, `Something went wrong on our end. Please try again or contact 559eats directly.`);
  }
};
