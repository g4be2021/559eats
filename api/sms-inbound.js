import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendSMS(to, text) {
  const params = new URLSearchParams({
    api_key: process.env.VONAGE_API_KEY,
    api_secret: process.env.VONAGE_API_SECRET,
    to,
    from: process.env.VONAGE_FROM || '17579703964',
    text,
  });
  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.json();
}

const QUESTIONS = [
  { key: 'truck_name', ask: "Great! What's the name of your food truck?" },
  { key: 'cuisine', ask: 'What type of food do you serve? (e.g. Mexican, BBQ, Filipino, etc.)' },
  { key: 'location', ask: 'What area or neighborhood do you usually serve in Fresno / Central Valley?' },
  { key: 'instagram', ask: "Do you have an Instagram or website? If not, just reply NONE." },
  { key: 'hours', ask: 'What are your usual hours or days? (e.g. Fri-Sun 11am-8pm)' },
];

const DONE_MESSAGE =
  "You're all set! I'll review your info and get your truck listed on 559eats.com within 24 hours. " +
  "We'll text you once you're live. Thanks for being part of the Fresno food scene!\n\n" +
  "¡Listo! Revisaré tu información y publicaré tu truck en 559eats.com en 24 horas. " +
  "Te avisaremos por texto cuando estés en línea. ¡Gracias!";

const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];
const YES_KEYWORDS = ['yes', 'si', 'sí', 'yeah', 'yep', 'ok', 'okay', 'sure', 'claro', 'dale'];

function normalizeText(text) {
  return (text || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
}

function getNextQuestion(collectedData) {
  for (const q of QUESTIONS) {
    if (!collectedData[q.key]) return q;
  }
  return null;
}

export default async function handler(req, res) {
  const body = req.method === 'POST' ? req.body : req.query;
  const from = body?.msisdn || body?.from;
  const text = (body?.text || '').trim();

  if (!from) return res.status(400).json({ error: 'Missing from number' });

  const phone = from.startsWith('+') ? from : `+${from}`;
  const normalized = normalizeText(text);

  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .eq('phone', phone)
    .limit(1);

  const prospect = prospects?.[0];

  if (OPT_OUT_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(kw + ' '))) {
    if (prospect) {
      await supabase.from('prospects').update({ status: 'opted_out' }).eq('id', prospect.id);
    }
    return res.status(200).end();
  }

  if (!prospect) {
    console.log(`Inbound from unknown number ${phone}: ${text}`);
    return res.status(200).end();
  }

  const conversation = Array.isArray(prospect.conversation) ? [...prospect.conversation] : [];
  conversation.push({ role: 'inbound', text, ts: new Date().toISOString() });

  if (prospect.status === 'contacted') {
    if (YES_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(kw))) {
      const firstQ = QUESTIONS[0];
      conversation.push({ role: 'outbound', text: firstQ.ask, ts: new Date().toISOString() });
      await supabase.from('prospects').update({
        status: 'waiting_name',
        conversation,
        collected_data: {},
      }).eq('id', prospect.id);
      await sendSMS(phone, firstQ.ask);
    } else {
      await supabase.from('prospects').update({ conversation }).eq('id', prospect.id);
    }
    return res.status(200).end();
  }

  if (prospect.status?.startsWith('waiting_')) {
    const collectedData = prospect.collected_data || {};
    const currentKey = prospect.status.replace('waiting_', '');
    collectedData[currentKey] = text;

    const nextQ = getNextQuestion(collectedData);

    if (nextQ) {
      conversation.push({ role: 'outbound', text: nextQ.ask, ts: new Date().toISOString() });
      await supabase.from('prospects').update({
        status: `waiting_${nextQ.key}`,
        conversation,
        collected_data: collectedData,
      }).eq('id', prospect.id);
      await sendSMS(phone, nextQ.ask);
    } else {
      let listingDraft = null;
      try { listingDraft = await generateListingDraft(collectedData, prospect); } catch (e) {}

      conversation.push({ role: 'outbound', text: DONE_MESSAGE, ts: new Date().toISOString() });
      await supabase.from('prospects').update({
        status: 'waiting_review',
        conversation,
        collected_data: collectedData,
        listing_draft: listingDraft,
      }).eq('id', prospect.id);
      await sendSMS(phone, DONE_MESSAGE);
    }
    return res.status(200).end();
  }

  await supabase.from('prospects').update({ conversation }).eq('id', prospect.id);
  return res.status(200).end();
}

async function generateListingDraft(data, prospect) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const prompt = `Write a 2-3 sentence food truck directory listing description for 559eats.com (Fresno/Central Valley).
Truck: ${data.truck_name || prospect.name}
Cuisine: ${data.cuisine || 'Not specified'}
Location: ${data.location || 'Fresno area'}
Hours: ${data.hours || 'Not specified'}
Write only the description, no preamble. Make it appealing to hungry locals.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  return json?.content?.[0]?.text || null;
}