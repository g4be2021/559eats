// Provider-agnostic SMS for 559eats. Set SMS_PROVIDER to "telnyx" (default) or "plivo".
// Env vars (set in Vercel, never in code):
//   SMS_FROM_NUMBER            your texting number in +1XXXXXXXXXX format
//   TELNYX_API_KEY             (telnyx) API v2 key
//   TELNYX_MESSAGING_PROFILE_ID (telnyx, optional but recommended)
//   PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN (plivo)
//   SMS_WEBHOOK_KEY            (optional) random string; add ?key=... to your inbound webhook URL

function toE164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

// Twilio-shaped fields (sid, status, message) are kept so older call sites keep working.
function result(ok, id, error) {
  return { ok, id: id || null, sid: id || null, status: ok ? 'sent' : 'failed', error: error || null, message: error || null };
}

async function sendSms(to, text) {
  const dst = toE164(to);
  if (!dst) return result(false, null, 'bad phone number');
  const from = process.env.SMS_FROM_NUMBER;
  if (!from) return result(false, null, 'SMS_FROM_NUMBER is not set');
  const provider = (process.env.SMS_PROVIDER || 'telnyx').toLowerCase();

  try {
    if (provider === 'plivo') {
      const authId = process.env.PLIVO_AUTH_ID;
      const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Message/`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${authId}:${process.env.PLIVO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ src: from, dst, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return result(false, null, data.error || data.message || `Plivo error ${res.status}`);
      return result(true, Array.isArray(data.message_uuid) ? data.message_uuid[0] : null);
    }

    const body = { from, to: dst, text };
    if (process.env.TELNYX_MESSAGING_PROFILE_ID) body.messaging_profile_id = process.env.TELNYX_MESSAGING_PROFILE_ID;
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data.errors && data.errors[0];
      return result(false, null, (e && (e.detail || e.title)) || `Telnyx error ${res.status}`);
    }
    return result(true, data.data && data.data.id);
  } catch (e) {
    return result(false, null, e.message);
  }
}

function parseString(s) {
  try { return JSON.parse(s); } catch (e) { return Object.fromEntries(new URLSearchParams(s)); }
}

async function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b) && Object.keys(b).length) return b;
  if (typeof b === 'string' && b.length) return parseString(b);
  if (Buffer.isBuffer(b) && b.length) return parseString(b.toString('utf8'));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return parseString(Buffer.concat(chunks).toString('utf8'));
}

// Normalizes an inbound text webhook from Telnyx (JSON) or Plivo (form) into { from, text, ignore }.
async function parseInbound(req) {
  const b = (await readBody(req)) || {};
  if (b.data && b.data.payload) {
    const p = b.data.payload;
    const inbound = b.data.event_type === 'message.received' && (!p.direction || p.direction === 'inbound');
    return { from: toE164(p.from && p.from.phone_number), text: p.text || '', ignore: !inbound };
  }
  return { from: toE164(b.From || b.from_number), text: b.Text || b.Body || '', ignore: false };
}

// If SMS_WEBHOOK_KEY is set, inbound webhooks must include ?key=<that value>.
function webhookAllowed(req) {
  const want = process.env.SMS_WEBHOOK_KEY;
  if (!want) return true;
  const got = (req.query && req.query.key) || new URL(req.url, 'http://x').searchParams.get('key');
  return got === want;
}

module.exports = { sendSms, parseInbound, webhookAllowed, toE164 };
