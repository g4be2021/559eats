/**
 * 559eats email assistant for gabe@559eats.com (Google Apps Script)
 *
 * Every 5 minutes it reads new emails in the inbox, writes a reply with Claude,
 * and saves it as a DRAFT in the same thread for you to review and send.
 * It labels each thread so you can see what it touched:
 *   559eats-bot/drafted    a reply draft is waiting for you
 *   559eats-bot/lead       catering or truck-owner lead (also starred)
 *   559eats-bot/skipped    newsletters, receipts, no-reply senders
 *
 * Setup (one time):
 *  1. Signed in as gabe@559eats.com, go to script.google.com > New project. Paste this file.
 *  2. Project Settings (gear) > Script Properties > Add: ANTHROPIC_API_KEY = your key.
 *  3. Run setup() once from the toolbar and allow the permissions.
 * To turn it off: Triggers (clock icon) > delete the trigger.
 */

const MODEL = 'claude-sonnet-5-5';
const AUTO_SEND = false;            // keep false: drafts only, you press Send
const MAX_PER_RUN = 10;
const SIGNATURE = '\n\nGabriel\n559eats | Fresno food truck map\nhttps://www.559eats.com';

const FACTS = `
- 559eats.com is a free map of food trucks in Fresno, Clovis and the Central Valley, run by Gabriel (TRANSGLOBAL CONNECT LLC, Clovis CA).
- Customers: find trucks, hours, today's spot and menus at https://www.559eats.com. Truck nights: https://www.559eats.com/events.html
- Catering: people request trucks at https://www.559eats.com/catering.html with date, headcount, budget and location. We match them with trucks. No fee to the customer; the truck pays 559eats 15% on jobs it confirms.
- Truck owners: listing is free forever, no cut of everyday sales. Apply at https://www.559eats.com/apply.html or text JOIN to (757) 970-3964 (texting may still be pending approval; the form always works). Already listed: log in at https://www.559eats.com/login.html to post hours, today's spot, specials, menu and photos.
- Featured plan: $29/month, gold star pin, top of list and search, badge on page, cancel anytime: https://www.559eats.com/pricing.html
- Phone for the business: 559-458-2276.
`;

const SYSTEM = `You draft email replies for Gabriel, who runs 559eats. Write as Gabriel, first person.
Style: simple, natural, professional, short (under 150 words). No em dashes. No fancy words. Friendly but businesslike.
Use only the FACTS. Never invent prices, availability, dates or promises. If something needs Gabriel's decision (a quote, a date, a partnership, a complaint, anything legal or about money beyond the listed prices), write a short holding reply that says he will follow up, and set needs_gabriel true.
For catering requests, thank them and ask for anything missing: date, start and end time, headcount, budget, address, food preference. Point them to the catering form if they haven't used it.
Reply in the sender's language.
Always answer by calling the triage tool. Never reply with plain text.

FACTS:${FACTS}`;

const TOOL = {
  name: 'triage',
  description: 'Classify the email and draft the reply.',
  input_schema: {
    type: 'object',
    required: ['category', 'should_reply', 'reply', 'needs_gabriel'],
    properties: {
      category: { type: 'string', enum: ['catering', 'truck_owner', 'customer', 'partnership', 'press', 'vendor_or_sales_pitch', 'newsletter_or_receipt', 'spam', 'personal', 'other'] },
      should_reply: { type: 'boolean', description: 'False for newsletters, receipts, spam, automated mail, or personal mail.' },
      reply: { type: 'string', description: 'Reply body without greeting signature block. Empty if should_reply is false.' },
      needs_gabriel: { type: 'boolean' },
      summary: { type: 'string', description: 'One line for Gabriel.' },
    },
  },
};

function setup() {
  ['559eats-bot/drafted', '559eats-bot/lead', '559eats-bot/skipped'].forEach(getLabel_);
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(5).create();
  run();
}

function run() {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Add ANTHROPIC_API_KEY in Project Settings > Script Properties');
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const query = 'in:inbox is:unread newer_than:2d -label:559eats-bot-drafted -label:559eats-bot-skipped -label:559eats-bot-lead -category:promotions -category:social';
  const threads = GmailApp.search(query, 0, MAX_PER_RUN);

  threads.forEach((thread) => {
    const msgs = thread.getMessages();
    const last = msgs[msgs.length - 1];
    const from = last.getFrom();
    if (from.toLowerCase().indexOf(me) !== -1) return; // last message is mine
    if (/no-?reply|donotreply|mailer-daemon|notifications?@|billing@|receipts?@/i.test(from)) {
      thread.addLabel(getLabel_('559eats-bot/skipped'));
      return;
    }

    const history = msgs.slice(-4).map((m) =>
      `From: ${m.getFrom()}\nDate: ${m.getDate()}\nSubject: ${m.getSubject()}\n\n${m.getPlainBody().slice(0, 4000)}`
    ).join('\n\n-----\n\n');

    let out;
    try {
      out = callClaude_(key, `Email thread (latest last):\n\n${history}\n\nDraft the reply to the latest message.`);
    } catch (e) {
      console.error(e);
      return; // try again next run
    }

    if (!out.should_reply || !out.reply) {
      thread.addLabel(getLabel_('559eats-bot/skipped'));
      return;
    }

    const name = (from.match(/^"?([^"<]+?)"?\s*</) || [])[1];
    const first = name ? name.trim().split(/\s+/)[0] : '';
    const body = `${first ? 'Hi ' + first + ',' : 'Hi,'}\n\n${out.reply.replace(/—|–/g, ',').trim()}${SIGNATURE}`;

    if (AUTO_SEND && !out.needs_gabriel && ['customer', 'truck_owner'].indexOf(out.category) !== -1) {
      last.reply(body);
    } else {
      last.createDraftReply(body);
    }
    thread.addLabel(getLabel_('559eats-bot/drafted'));
    if (['catering', 'truck_owner', 'partnership', 'press'].indexOf(out.category) !== -1 || out.needs_gabriel) {
      thread.addLabel(getLabel_('559eats-bot/lead'));
      last.star();
    }
  });
}

function callClaude_(key, user) {
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: MODEL, max_tokens: 900, system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      tools: [TOOL], tool_choice: { type: 'auto' },
    }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Claude ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  const j = JSON.parse(res.getContentText());
  const t = j.content.filter((c) => c.type === 'tool_use')[0];
  if (!t) throw new Error('Claude did not call triage: ' + JSON.stringify(j.content).slice(0, 200));
  return t.input;
}

function getLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
