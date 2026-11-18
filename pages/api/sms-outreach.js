/**
 * pages/api/sms-outreach.js
 *
 * Outbound SMS sender — reads pending prospects and texts each one.
 * Hit this endpoint manually (or via cron) to kick off a batch.
 *
 * POST /api/sms-outreach
 *   Body: { limit: 10 }   (optional, default 10)
 *
 * Required env vars:
 *   VONAGE_API_KEY
 *   VONAGE_API_SECRET
 *   VONAGE_FROM          - your Vonage virtual number, e.g. "15594001234"
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   NEXT_PUBLIC_SITE_URL - e.g. https://559eats.com (used for opt-out link)
 */

import { createClient } from '@supabase/supabase-js';
import Vonage from '@vonage/server-sdk';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const FROM = process.env.VONAGE_FROM;

function buildIntroMessage(name) {
  const greeting = name ? `Hi, is this ${name}?` : 'Hi there!';
  return (
    `${greeting} This is 559eats - a free local food directory for Fresno & the Central Valley. ` +
    `We'd love to list your business so more locals can find you!\n\n` +
    `Can we grab a few quick details? Just reply YES to get started, or STOP to opt out.`
  );
}

function sendSms(to, text) {
  return new Promise((resolve, reject) => {
    vonage.message.sendSms(FROM, to, text, {}, (err, res) => {
      if (err) return reject(err);
      const msg = res.messages?.[0];
      if (msg?.status !== '0') {
        return reject(new Error(`Vonage error: ${msg?.['error-text'] || msg?.status}`));
      }
      resolve(msg);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-admin-secret'];
  if (authHeader !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limit = Math.min(parseInt(req.body?.limit) || 10, 50);

  const { data: prospects, error: fetchError } = await supabase
    .from('prospects')
    .select('id, phone, name')
    .eq('status', 'pending')
    .is('contacted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message });
  }

  if (!prospects || prospects.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No pending prospects' });
  }

  const results = [];

  for (const prospect of prospects) {
    try {
      const text = buildIntroMessage(prospect.name);
      await sendSms(prospect.phone, text);

      const firstMessage = { role: 'outbound', text, at: new Date().toISOString() };

      await supabase
        .from('prospects')
        .update({
          status: 'contacted',
          contacted_at: new Date().toISOString(),
          conversation: [firstMessage],
        })
        .eq('id', prospect.id);

      results.push({ phone: prospect.phone, status: 'sent' });
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      results.push({ phone: prospect.phone, status: 'error', error: err.message });
      await supabase.from('prospects').update({ status: 'invalid' }).eq('id', prospect.id);
    }
  }

  return res.status(200).json({
    sent: results.filter((r) => r.status === 'sent').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  });
}
