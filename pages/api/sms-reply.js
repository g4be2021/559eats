/**
 * pages/api/sms-reply.js
 *
 * Vonage inbound webhook — handles replies from food truck owners.
 *
 * Set this as your Vonage inbound SMS webhook URL:
 *   https://559eats.com/api/sms-reply
 * (Vonage → Your Numbers → Manage → SMS → HTTP method: POST)
 *
 * Conversation flow:
 *   1. We send intro message → they reply YES
 *   2. We ask: "What's the name of your business?"  → they reply with name
 *   3. We ask: "What do you serve? (e.g. tacos, burritos, aguas frescas)"  → they reply with items
 *   4. We ask: "What intersection or address do you usually operate at?"  → they reply with location
 *   5. We say: "Got it! We'll get you listed — check 559eats.com soon 🎉"
 *      → create a pending restaurant record, mark prospect done
 *
 * Any time they text STOP / UNSUBSCRIBE / QUIT → opt out immediately.
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

// Conversation steps — what we're waiting for at each stage
const STEPS = {
  intro_sent: 'waiting_yes',       // waiting for YES
  waiting_yes: 'waiting_name',     // waiting for business name
  waiting_name: 'waiting_items',   // waiting for menu items
  waiting_items: 'waiting_location', // waiting for address/intersection
  waiting_location: 'done',        // done — save restaurant
};

const PROMPTS = {
  waiting_yes: "What's the name of your business?",
  waiting_name: "What do you serve? (e.g. tacos, birria, aguas frescas, burgers)",
  waiting_items: "What intersection or address do you usually operate at? (e.g. Shaw & Blackstone, or a street address)",
  waiting_location: null, // handled inline — saves record + sends thanks
};

const OPT_OUT_WORDS = ['stop', 'unsubscribe', 'quit', 'cancel', 'optout', 'opt out', 'no'];
const YES_WORDS = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'si', 'sí', 'sounds good'];

function sendSms(to, text) {
  return new Promise((resolve, reject) => {
    vonage.message.sendSms(FROM, to, text, {}, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return raw;
}

export default async function handler(req, res) {
  // Vonage sends POST or GET — handle both
  const body = req.method === 'GET' ? req.query : req.body;
  const rawFrom = body.msisdn || body.from;
  const rawText = (body.text || '').trim();

  if (!rawFrom || !rawText) {
    return res.status(200).send('OK'); // ACK to Vonage
  }

  const phone = normalizePhone(rawFrom);
  const textLower = rawText.toLowerCase();

  // Look up prospect
  const { data: prospect, error: fetchError } = await supabase
    .from('prospects')
    .select('*')
    .eq('phone', phone)
    .single();

  if (fetchError || !prospect) {
    // Unknown number — ignore or log
    console.log(`Unknown inbound from ${phone}: "${rawText}"`);
    return res.status(200).send('OK');
  }

  // Handle opt-out
  if (OPT_OUT_WORDS.some((w) => textLower === w)) {
    await supabase
      .from('prospects')
      .update({ status: 'opted_out' })
      .eq('id', prospect.id);
    await sendSms(phone, "You've been removed from our list. Have a great day! 👋");
    return res.status(200).send('OK');
  }

  const conversation = Array.isArray(prospect.conversation) ? prospect.conversation : [];
  const inboundMessage = {
    role: 'inbound',
    text: rawText,
    at: new Date().toISOString(),
  };

  conversation.push(inboundMessage);

  const currentStep = prospect.status;
  const nextStep = STEPS[currentStep];

  if (!nextStep) {
    // Already done or unknown step
    return res.status(200).send('OK');
  }

  // ── Step: waiting for YES ────────────────────────────────────────────────
  if (currentStep === 'contacted' || currentStep === 'waiting_yes') {
    const isYes = YES_WORDS.some((w) => textLower.startsWith(w));

    if (!isYes) {
      const reply = "Just reply YES to get listed for free, or STOP to opt out 🙂";
      await sendSms(phone, reply);
      conversation.push({ role: 'outbound', text: reply, at: new Date().toISOString() });
      await supabase.from('prospects').update({ conversation, status: 'waiting_yes' }).eq('id', prospect.id);
      return res.status(200).send('OK');
    }

    const reply = PROMPTS['waiting_yes'];
    conversation.push({ role: 'outbound', text: reply, at: new Date().toISOString() });
    await supabase.from('prospects').update({
      conversation,
      status: 'waiting_name',
      responded_at: new Date().toISOString(),
    }).eq('id', prospect.id);
    await sendSms(phone, reply);
    return res.status(200).send('OK');
  }

  // ── Step: waiting for business name ─────────────────────────────────────
  if (currentStep === 'waiting_name') {
    const reply = PROMPTS['waiting_name'];
    conversation.push({ role: 'outbound', text: reply, at: new Date().toISOString() });
    await supabase.from('prospects').update({
      conversation,
      status: 'waiting_items',
      name: rawText, // save what they told us
    }).eq('id', prospect.id);
    await sendSms(phone, reply);
    return res.status(200).send('OK');
  }

  // ── Step: waiting for menu items ─────────────────────────────────────────
  if (currentStep === 'waiting_items') {
    const reply = PROMPTS['waiting_items'];
    conversation.push({ role: 'outbound', text: reply, at: new Date().toISOString() });

    // Store items temporarily in conversation; we'll use it when we save the restaurant
    await supabase.from('prospects').update({
      conversation,
      status: 'waiting_location',
    }).eq('id', prospect.id);
    await sendSms(phone, reply);
    return res.status(200).send('OK');
  }

  // ── Step: waiting for location → save everything ─────────────────────────
  if (currentStep === 'waiting_location') {
    const reply =
      "Got it! We'll get your listing up on 559eats.com soon 🎉 " +
      "You'll be able to claim and edit it at any time. Thanks for being part of the community!";

    conversation.push({ role: 'outbound', text: reply, at: new Date().toISOString() });

    // Extract previously saved name + items from conversation
    const businessName = prospect.name || extractFromConversation(conversation, 'waiting_name');
    const menuItems = extractFromConversation(conversation, 'waiting_items');
    const location = rawText;

    // Create a pending restaurant record
    let restaurantId = null;
    try {
      const { data: restaurant, error: insertError } = await supabase
        .from('restaurants')
        .insert({
          name: businessName || 'Unknown Business',
          phone,
          address: location,
          description: menuItems ? `Serves: ${menuItems}` : null,
          is_food_truck: true,
          is_active: false, // pending review
          status: 'pending',
          admin_notes: [
            {
              note: `Added via SMS outreach. Menu items: ${menuItems || 'not provided'}. Location: ${location}`,
              at: new Date().toISOString(),
            },
          ],
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating restaurant:', insertError.message);
      } else {
        restaurantId = restaurant.id;
      }
    } catch (err) {
      console.error('Restaurant insert failed:', err.message);
    }

    await supabase.from('prospects').update({
      conversation,
      status: 'done',
      restaurant_id: restaurantId,
    }).eq('id', prospect.id);

    await sendSms(phone, reply);
    return res.status(200).send('OK');
  }

  return res.status(200).send('OK');
}

/**
 * Walk backwards through conversation to find the inbound message
 * that came right after the outbound prompt for a given step.
 */
function extractFromConversation(conversation, afterStep) {
  // Find the outbound message that was the prompt for this step
  const stepPrompt = {
    waiting_name: "What's the name of your business?",
    waiting_items: "What do you serve?",
    waiting_location: "What intersection or address",
  };

  const keyword = stepPrompt[afterStep];
  if (!keyword) return null;

  for (let i = 0; i < conversation.length - 1; i++) {
    const msg = conversation[i];
    if (msg.role === 'outbound' && msg.text.includes(keyword.substring(0, 20))) {
      // The next inbound message is the answer
      for (let j = i + 1; j < conversation.length; j++) {
        if (conversation[j].role === 'inbound') {
          return conversation[j].text;
        }
      }
    }
  }
  return null;
}
