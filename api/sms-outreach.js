import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendVonageSMS(to, text) {
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

const OUTREACH_MESSAGE =
  "Hi! I'm Gabriel with 559eats.com — a free food directory for Fresno & the Central Valley. " +
  "Want a free listing for your food truck? Just reply YES and I'll ask you a few quick questions by text. Reply STOP to opt out.\n\n" +
  "Hola! Soy Gabriel de 559eats.com — un directorio gratuito de comida en Fresno y el Valle Central. " +
  "¿Quieres un listing gratuito para tu food truck? Responde SÍ y te haré unas preguntas rápidas por texto. Responde STOP para no recibir más mensajes.";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  const limit = parseInt(req.body?.limit || req.query?.limit || '10', 10);

  const { data: prospects, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('status', 'pending')
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  if (!prospects?.length) return res.status(200).json({ sent: 0, message: 'No pending prospects' });

  const results = [];
  for (const prospect of prospects) {
    try {
      const vonageRes = await sendVonageSMS(prospect.phone, OUTREACH_MESSAGE);
      const success = vonageRes?.messages?.[0]?.status === '0';

      const conversation = [
        {
          role: 'outbound',
          text: OUTREACH_MESSAGE,
          ts: new Date().toISOString(),
        },
      ];

      await supabase
        .from('prospects')
        .update({
          status: success ? 'contacted' : 'invalid',
          conversation,
          contacted_at: new Date().toISOString(),
        })
        .eq('id', prospect.id);

      results.push({ id: prospect.id, phone: prospect.phone, success });
    } catch (err) {
      results.push({ id: prospect.id, phone: prospect.phone, success: false, error: err.message });
    }
  }

  return res.status(200).json({ sent: results.filter((r) => r.success).length, results });
}