import { createClient } from '@supabase/supabase-js';

const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;
const FROM = process.env.VONAGE_FROM || '17579703964';

async function sendSMS(to, text) {
  const r = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: VONAGE_API_KEY, api_secret: VONAGE_API_SECRET, from: FROM, to: to.replace('+',''), text })
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const limit = req.body?.limit || 10;
  const { data: prospects } = await supabase
    .from('prospects')
    .select('*')
    .eq('status', 'pending')
    .limit(limit);

  if (!prospects?.length) return res.status(200).json({ sent: 0, message: 'No pending prospects' });

  let sent = 0;
  for (const p of prospects) {
    const msg = `Hi! I'm Gabriel from 559eats.com - the go-to food directory for the Fresno area. We'd love to feature your food truck for free! Reply YES to get listed and reach more customers. Reply STOP to opt out.`;
    try {
      await sendSMS(p.phone, msg);
      await supabase.from('prospects').update({
        status: 'contacted',
        contacted_at: new Date().toISOString(),
        conversation: [{ direction: 'outbound', text: msg, ts: new Date().toISOString() }]
      }).eq('id', p.id);
      sent++;
    } catch(e) {
      await supabase.from('prospects').update({ status: 'invalid' }).eq('id', p.id);
    }
  }
  return res.status(200).json({ sent, message: `Sent ${sent} messages` });
}