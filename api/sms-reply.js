// ============================================
// 559eats · SMS Reply Handler
// File: /api/sms-reply.js
// This is the webhook Twilio calls when an
// owner texts back. Set this URL in Twilio:
// https://559eats.com/api/sms-reply
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '82c47f2512d5afa7312796b074b0bd19';
const TWILIO_FROM  = '+15593773665';
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

async function sendSMS(to, message) {
  const creds = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message }).toString()
    }
  );
}

function twimlResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${message}</Message></Response>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/xml');

  // Parse Twilio's form POST
  let body = '';
  await new Promise(resolve => {
    req.on('data', chunk => body += chunk);
    req.on('end', resolve);
  });
  const params = new URLSearchParams(body);
  const fromPhone = params.get('From');
  const incomingMsg = (params.get('Body') || '').trim().toUpperCase();

  if (!fromPhone) {
    res.status(400).end(twimlResponse('Could not process your message.'));
    return;
  }

  // Log the inbound message
  try {
    // Find owner by phone number
    const owners = await supabase(
      `owners?phone=eq.${encodeURIComponent(fromPhone)}&select=*,restaurants(*)`
    );

    if (!owners || owners.length === 0) {
      res.end(twimlResponse(
        `Hi! We don't recognize this number in our 559eats system. ` +
        `If you'd like to list your restaurant, visit 559eats.com/apply`
      ));
      return;
    }

    const owner = owners[0];
    const restaurant = owner.restaurants;

    // Log inbound
    await supabase('sms_log', 'POST', [{
      restaurant_id: restaurant?.id || null,
      direction: 'inbound',
      message: params.get('Body'),
      phone: fromPhone,
      status: 'received'
    }]);

    if (!restaurant) {
      res.end(twimlResponse(`We found your account but no restaurant is linked yet. Contact 559eats for help.`));
      return;
    }

    // --- QUESTION 1: Have your hours changed? ---
    // Check last outbound message to know which question we're on
    const recentLogs = await supabase(
      `sms_log?restaurant_id=eq.${restaurant.id}&direction=eq.outbound&order=sent_at.desc&limit=1`
    );
    const lastOutbound = recentLogs?.[0]?.message || '';
    const awaitingHours = lastOutbound.includes('Have your hours changed') || lastOutbound.includes('hours changed');
    const awaitingAddress = lastOutbound.includes('current address') || lastOutbound.includes('find you today');

    if (awaitingHours) {
      if (incomingMsg === 'YES' || incomingMsg === 'Y') {
        // Ask follow-up for new hours
        const reply =
          `Got it! What are your current hours?\n\n` +
          `Reply in this format:\n` +
          `Mon-Fri 11am-9pm, Sat 12pm-10pm, Sun Closed\n\n` +
          `Or just describe them however is easiest for you.`;
        await sendSMS(fromPhone, reply);

        await supabase('sms_log', 'POST', [{
          restaurant_id: restaurant.id,
          direction: 'outbound',
          message: reply,
          phone: fromPhone,
          status: 'sent'
        }]);

        res.end(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);

      } else if (incomingMsg === 'NO' || incomingMsg === 'N') {
        // Hours unchanged — ask about location
        const reply =
          `Perfect, hours are up to date! 👍\n\n` +
          `2️⃣ Where can people find ${restaurant.name} today?\n\n` +
          `Reply with your current address or location.`;
        await sendSMS(fromPhone, reply);

        await supabase('sms_log', 'POST', [{
          restaurant_id: restaurant.id,
          direction: 'outbound',
          message: reply,
          phone: fromPhone,
          status: 'sent'
        }]);

        res.end(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);

      } else {
        // Unrecognized — re-prompt
        res.end(twimlResponse(`Just reply YES or NO — have your hours changed since last time?`));
      }
      return;
    }

    if (awaitingAddress) {
      // They're answering Question 2 — save the address
      const newAddress = params.get('Body').trim();

      await supabase(
        `restaurants?id=eq.${restaurant.id}`,
        'PATCH',
        { address: newAddress, sms_last_updated: new Date().toISOString() }
      );

      const reply =
        `✅ Got it! We've updated your location to:\n"${newAddress}"\n\n` +
        `Your 559eats listing is up to date. Thanks ${owner.name || 'there'}! 🙌\n\n` +
        `We'll check in again next month.`;

      res.end(twimlResponse(reply));
      return;
    }

    // They replied with hours (after saying YES to Q1)
    const recentInbound = await supabase(
      `sms_log?restaurant_id=eq.${restaurant.id}&direction=eq.inbound&order=sent_at.desc&limit=3`
    );
    const previousReplies = recentInbound || [];
    const justSaidYes = previousReplies.some(l =>
      l.message?.toUpperCase() === 'YES' || l.message?.toUpperCase() === 'Y'
    );

    if (justSaidYes && incomingMsg.length > 3) {
      // Save the hours as description update
      const hoursText = params.get('Body').trim();
      await supabase(
        `restaurants?id=eq.${restaurant.id}`,
        'PATCH',
        {
          description: `Hours: ${hoursText}`,
          sms_last_updated: new Date().toISOString()
        }
      );

      // Now ask Q2
      const reply =
        `✅ Hours updated!\n\n` +
        `2️⃣ Where can people find ${restaurant.name} today?\n\n` +
        `Reply with your current address or location.`;
      await sendSMS(fromPhone, reply);

      await supabase('sms_log', 'POST', [{
        restaurant_id: restaurant.id,
        direction: 'outbound',
        message: reply,
        phone: fromPhone,
        status: 'sent'
      }]);

      res.end(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
      return;
    }

    // Fallback — unrecognized message
    res.end(twimlResponse(
      `Hi from 559eats! 👋 We didn't quite catch that.\n\n` +
      `If you're responding to a check-in, just reply YES or NO to our last message.\n\n` +
      `Questions? Visit 559eats.com`
    ));

  } catch (err) {
    console.error('SMS reply error:', err);
    res.end(twimlResponse(`Something went wrong on our end. Please try again or contact 559eats directly.`));
  }
};
