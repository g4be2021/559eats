const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Questions in English
const QUESTIONS_EN = [
  { key: 'truck_name', ask: "Great! What's the name of your food truck?" },
  { key: 'cuisine', ask: 'What type of food do you serve? (e.g. Mexican, BBQ, Filipino, etc.)' },
  { key: 'location', ask: 'What area or neighborhood do you usually serve in Fresno / Central Valley?' },
  { key: 'instagram', ask: "Do you have an Instagram or website? If not, just reply NONE." },
  { key: 'hours', ask: 'What are your usual hours or days? (e.g. Fri-Sun 11am-8pm)' },
];

// Questions in Spanish
const QUESTIONS_ES = [
  { key: 'truck_name', ask: '\u00a1Genial! \u00bfCu\u00e1l es el nombre de tu food truck?' },
  { key: 'cuisine', ask: '\u00bfQu\u00e9 tipo de comida sirves? (ej. Mexicana, BBQ, Filipina, etc.)' },
  { key: 'location', ask: '\u00bfEn qu\u00e9 \u00e1rea o vecindario del Valle Central / Fresno sueles atender?' },
  { key: 'instagram', ask: '\u00bfTienes Instagram o p\u00e1gina web? Si no, solo responde NINGUNO.' },
  { key: 'hours', ask: '\u00bfCu\u00e1les son tus horarios o d\u00edas? (ej. Vie-Dom 11am-8pm)' },
];

const YES_KEYWORDS = ['yes', 'si', 'si\u0301', 'yeah', 'yep', 'ok', 'okay', 'sure', 'claro', 'dale', '\u00e1ndale', 'andale', 'bueno', 'simon', 'sim\u00f3n'];
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'alto', 'parar', 'detener', 'baja'];

// Spanish-coded trigger words
const SPANISH_TRIGGERS = ['si', 'si\u0301', 'claro', 'dale', '\u00e1ndale', 'andale', 'bueno', 'simon', 'sim\u00f3n', 'hola', 'gracias', 'buenos', 'orale', '\u00f3rale'];

function isSpanishReply(text) {
  const lower = text.toLowerCase().trim();
  return SPANISH_TRIGGERS.some(w => lower === w || lower.startsWith(w + ' ') || lower.endsWith(' ' + w));
}

const STATUS_QUESTION_MAP = {
  'waiting_name':      0,
  'waiting_cuisine':   1,
  'waiting_location':  2,
  'waiting_instagram': 3,
  'waiting_hours':     4,
};

const NEXT_STATUS = [
  'waiting_cuisine',
  'waiting_location',
  'waiting_instagram',
  'waiting_hours',
  'waiting_review',
];

const DONE_MESSAGE_EN =
  "Thanks! I'm putting together your listing now. Gabriel will review it and reach out if anything looks off. You should be live on 559eats.com soon! \ud83c\udf89";
const DONE_MESSAGE_ES =
  "\u00a1Gracias! Ya estoy preparando tu listing. Gabriel lo revisar\u00e1 y te contactar\u00e1 si algo no est\u00e1 bien. \u00a1Pronto estar\u00e1s en 559eats.com! \ud83c\udf89";

async function sendVonageSMS(to, text) {
  const params = new URLSearchParams({
    api_key: VONAGE_API_KEY,
    api_secret: VONAGE_API_SECRET,
    to,
    from: process.env.VONAGE_FROM_NUMBER || '15592983338',
    text,
  });
  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return res.json();
}

async function generateListingDraft(data) {
  const prompt = `You are helping create a food truck listing for a local directory called 559eats.com (Fresno & Central Valley, CA).

Based on the following info provided by the food truck owner, write a friendly, engaging 2-3 sentence description for their listing. Keep it casual and local. Do not make up details not provided.

Truck name: ${data.truck_name || 'N/A'}
Cuisine: ${data.cuisine || 'N/A'}
Area: ${data.location || 'N/A'}
Instagram/Website: ${data.instagram || 'N/A'}
Hours/Days: ${data.hours || 'N/A'}

Write just the description, nothing else.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const result = await res.json();
  return result.content?.[0]?.text || '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const msisdn = body.msisdn || req.query.msisdn;
  const text = (body.text || req.query.text || '').trim();

  if (!msisdn || !text) return res.status(200).json({ ok: true });

  const lower = text.toLowerCase();

  if (OPT_OUT_KEYWORDS.some(w => lower.includes(w))) {
    await supabase.from('prospects').update({ status: 'opted_out' }).eq('phone', msisdn);
    return res.status(200).json({ ok: true });
  }

  const { data: prospect } = await supabase
    .from('prospects').select('*').eq('phone', msisdn).single();

  if (!prospect) return res.status(200).json({ ok: true });

  const currentStatus = prospect.status;
  const collected = prospect.collected_data || {};

  let usesSpanish = prospect.uses_spanish || false;
  if (isSpanishReply(text) && !usesSpanish) {
    usesSpanish = true;
    await supabase.from('prospects').update({ uses_spanish: true }).eq('phone', msisdn);
  }

  const QUESTIONS = usesSpanish ? QUESTIONS_ES : QUESTIONS_EN;
  const DONE_MESSAGE = usesSpanish ? DONE_MESSAGE_ES : DONE_MESSAGE_EN;

  if (currentStatus === 'contacted' && YES_KEYWORDS.some(w => lower === w || lower.startsWith(w + ' '))) {
    await supabase.from('prospects').update({ status: 'waiting_name', uses_spanish: usesSpanish }).eq('phone', msisdn);
    await sendVonageSMS(msisdn, QUESTIONS[0].ask);
    return res.status(200).json({ ok: true });
  }

  const qIndex = STATUS_QUESTION_MAP[currentStatus];
  if (qIndex === undefined) return res.status(200).json({ ok: true });

  const questionKey = QUESTIONS[qIndex].key;
  const updatedData = { ...collected, [questionKey]: text };
  const nextStatus = NEXT_STATUS[qIndex];

  await supabase.from('prospects').update({ collected_data: updatedData, status: nextStatus }).eq('phone', msisdn);

  if (nextStatus === 'waiting_review') {
    const draft = await generateListingDraft(updatedData);
    await supabase.from('prospects').update({ listing_draft: draft }).eq('phone', msisdn);
    await sendVonageSMS(msisdn, DONE_MESSAGE);
  } else {
    const nextQIndex = STATUS_QUESTION_MAP[nextStatus];
    await sendVonageSMS(msisdn, QUESTIONS[nextQIndex].ask);
  }

  return res.status(200).json({ ok: true });
};
