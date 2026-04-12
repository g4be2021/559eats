// ============================================
// 559eats · Claim Request API
// File: /api/claim-request.js
// Saves claim, SMS's admin for review
// ============================================

const TWILIO_SID   = 'AC0311f54c34a54414ddd04c4e6b387b59';
const TWILIO_TOKEN = '525516f7020ffe6c2d30269212ebf7b7';
const TWILIO_FROM  = '+15593773665';
const ADMIN_PHONE  = '+13232168201'; // ← change to YOUR personal cell
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
  const res = await fetch(
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
  return res.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const {
    restaurant_id,
    owner_name,
    owner_email,
    owner_phone,
    business_proof,
    years_operating
  } = req.body;

  if (!restaurant_id || !owner_name || !owner_email || !owner_phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Check restaurant exists and has no owner
    const restaurants = await supabase(`restaurants?id=eq.${restaurant_id}`);
    const restaurant = restaurants?.[0];
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const existingOwners = await supabase(`owners?restaurant_id=eq.${restaurant_id}`);
    if (existingOwners && existingOwners.length > 0) {
      return res.status(409).json({ error: 'This listing already has an owner.' });
    }

    // 2. Check for duplicate pending claim
    const existingClaims = await supabase(
      `claim_requests?restaurant_id=eq.${restaurant_id}&status=eq.pending`
    );
    if (existingClaims && existingClaims.length > 0) {
      return res.json({
        success: true,
        message: 'A claim request for this listing is already under review. We\'ll be in touch soon.'
      });
    }

    // 3. Save claim request
    const claimData = await supabase('claim_requests', 'POST', [{
      restaurant_id,
      owner_name,
      owner_email,
      owner_phone,
      business_proof: business_proof || null,
      years_operating: years_operating || null,
      status: 'pending'
    }]);

    const claim = claimData?.[0];
    if (!claim) throw new Error('Failed to save claim request');

    // 4. SMS admin
    const adminMsg =
      `🏷️ New listing claim!\n\n` +
      `Truck: ${restaurant.name}\n` +
      `Claimant: ${owner_name}\n` +
      `Email: ${owner_email}\n` +
      `Phone: ${owner_phone}\n` +
      `${years_operating ? 'Years operating: ' + years_operating + '\n' : ''}` +
      `${business_proof ? 'Proof: ' + business_proof + '\n' : ''}` +
      `\nReview at: 559eats.com/admin.html`;

    await sendSMS(ADMIN_PHONE, adminMsg);

    // 5. SMS claimant confirmation
    const claimantMsg =
      `Hi ${owner_name}! We received your claim request for ${restaurant.name} on 559eats.\n\n` +
      `Our team will review your info and get back to you within 24–48 hours.\n\n` +
      `Questions? Reply to this message or visit 559eats.com`;

    await sendSMS(owner_phone, claimantMsg);

    return res.json({
      success: true,
      claim_id: claim.id,
      message: 'Claim submitted! We\'ll review and get back to you within 24–48 hours.'
    });

  } catch (err) {
    console.error('Claim request error:', err);
    return res.status(500).json({ error: err.message });
  }
};
