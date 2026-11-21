// 559eats website chat assistant.
// POST /api/chat  { messages: [{ role: 'user'|'assistant', content: string }], page?: string }
// Answers customers and truck owners from live truck data. Can leave a message for Gabriel
// (saved to contact_messages, shown in the admin Inbox) when someone needs a person.
const { SUPABASE_URL, SERVICE_KEY } = require('./_lib/admin-auth');
global.window = global.window || {};
require('../truck-utils.js');
const Truck = global.window.Truck;

const MODEL = 'claude-haiku-5-5';
const SITE = 'https://www.559eats.com';

// Best-effort abuse guard per warm instance
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  h.push(now);
  hits.set(ip, h);
  return h.length > 30; // 30 messages per 10 minutes per IP
}

let cache = { at: 0, text: '' };
async function truckFacts() {
  if (Date.now() - cache.at < 60 * 1000 && cache.text) return cache.text;
  const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const cols = 'id,name,cuisine_type,neighborhood,address,phone,today_spot,today_lat,today_lng,today_until,open_override,open_override_until,special,special_until,is_featured,sponsored_until,sponsor_tier';
  const [t, h, e] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/restaurants?select=${cols}&is_active=eq.true&status=eq.approved&order=name.asc&limit=500`, { headers: H }).then((r) => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/hours?select=restaurant_id,day_of_week,open_time,close_time,is_closed&limit=10000`, { headers: H }).then((r) => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/events?select=title,starts_at,venue,address&is_published=is.true&starts_at=gte.${new Date(Date.now() - 6 * 3600e3).toISOString()}&order=starts_at.asc&limit=10`, { headers: H }).then((r) => r.json()).catch(() => []),
  ]);
  const trucks = Array.isArray(t) ? t : [];
  const hours = Array.isArray(h) ? h : [];
  const lines = trucks.map((r) => {
    const s = Truck.status(r, hours);
    const live = Truck.liveSpot(r);
    const parts = [
      r.name,
      r.cuisine_type || 'food truck',
      live ? `TODAY at ${live.note || 'posted spot'}` : `usual spot ${r.address || r.neighborhood || 'not listed'}`,
      `status now: ${s.label}${s.todayText ? ` (today ${s.todayText})` : ''}`,
      r.phone ? `phone ${r.phone}` : '',
      r.special && Truck.future(r.special_until) ? `special today: ${r.special}` : '',
      Truck.tier(r) ? 'sponsored: ' + Truck.TIERS[Truck.tier(r)] : '',
      `page ${SITE}/truck/${r.id}`,
    ].filter(Boolean);
    return '- ' + parts.join(' | ');
  });
  const ev = (Array.isArray(e) ? e : []).map((x) => `- ${x.title}, ${new Date(x.starts_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}, ${x.venue || x.address || ''}`);
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  cache = {
    at: Date.now(),
    text: `Current time in Fresno: ${now}\n\nTRUCKS (${trucks.length}):\n${lines.join('\n')}\n\nUPCOMING EVENTS:\n${ev.join('\n') || '- none posted'}`,
  };
  return cache.text;
}

const SYSTEM = (facts, page) => `You are the 559eats assistant, a chat helper on 559eats.com, a free map of food trucks in Fresno, Clovis and the Central Valley. You help two kinds of people:

CUSTOMERS: find trucks by food, area, or who's open now; give hours, today's spot, phone, and the truck's page link. Only use the TRUCK DATA below. If a truck says "Hours not posted", say so honestly and suggest calling the truck. Never invent hours, locations, menus or prices. For booking a truck for an event, send them to ${SITE}/catering.html. For upcoming truck nights, ${SITE}/events.html.

TRUCK OWNERS: listing is free forever; no cut of everyday sales. Ways to get listed: the form at ${SITE}/apply.html, or text JOIN to (757) 970-3964 (texting may still be being set up; if so, use the form). Already listed? Claim it from the truck's page, or log in at ${SITE}/login.html to post hours, today's spot, specials, menu and photos. Sponsored plans make the truck glow on the map and list it higher: Spotlight $1/month (orange glow), Featured $3/month (gold glow and star), Premium $6/month (biggest pulsing glow, name always showing, top of the list). Cancel anytime (${SITE}/pricing.html). Catering bookings that come through 559eats carry a 15% fee to the truck, only on jobs they confirm.

RULES:
- Short replies: 1 to 4 sentences, plain words, friendly, no em dashes. Use the visitor's language (reply in Spanish if they write in Spanish).
- Put links as plain URLs.
- If someone wants a person, has a complaint, a partnership or press question, or anything you can't answer, offer to pass a message to Gabriel. Ask for their name and an email or phone, then call leave_message. Never claim a message was sent unless you called the tool.
- Don't collect payment info, passwords or ID numbers. Don't give legal, tax or health advice.
- Stay on 559eats and food trucks. Politely decline anything else.

The visitor is on page: ${page || 'unknown'}

TRUCK DATA:
${facts}`;

const TOOLS = [{
  name: 'leave_message',
  description: 'Save a message for the 559eats team (Gabriel). Use only after the visitor gives a way to reach them.',
  input_schema: {
    type: 'object',
    required: ['message'],
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      topic: { type: 'string', description: 'e.g. catering, truck owner, press, problem' },
      message: { type: 'string', description: 'What they need, in their words' },
    },
  },
}];

async function saveMessage(m) {
  const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const contact = [clip(m.phone, 40) && `Phone: ${clip(m.phone, 40)}`].filter(Boolean).join('\n');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      name: clip(m.name, 120) || null,
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clip(m.email, 200)) ? clip(m.email, 200) : null,
      topic: ('Chat: ' + (clip(m.topic, 60) || 'general')).slice(0, 80),
      message: [clip(m.message, 3500), contact].filter(Boolean).join('\n\n'),
    }),
  });
  return r.ok;
}

async function claude(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, system, messages, tools: TOOLS }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ reply: "You're sending messages fast. Give it a few minutes and try again." });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  const raw = Array.isArray(b && b.messages) ? b.messages.slice(-16) : [];
  const messages = raw
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'No message' });

  try {
    const system = SYSTEM(await truckFacts(), String((b && b.page) || '').slice(0, 100));
    let convo = messages;
    let out = await claude(system, convo);
    // One round of tool use (leave_message)
    if (out.stop_reason === 'tool_use') {
      const results = [];
      for (const c of out.content.filter((x) => x.type === 'tool_use')) {
        const ok = c.name === 'leave_message' ? await saveMessage(c.input || {}) : false;
        results.push({ type: 'tool_result', tool_use_id: c.id, content: ok ? 'Saved. Gabriel will follow up.' : 'Saving failed. Ask them to use the contact page.' });
      }
      convo = [...convo, { role: 'assistant', content: out.content }, { role: 'user', content: results }];
      out = await claude(system, convo);
    }
    const reply = (out.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n').replace(/—|–/g, ', ').trim();
    return res.status(200).json({ reply: reply || 'Sorry, I missed that. Can you say it another way?' });
  } catch (e) {
    console.error('chat', e);
    return res.status(200).json({ reply: `Sorry, I'm having trouble right now. You can reach the team at ${SITE}/contact.html.` });
  }
};
