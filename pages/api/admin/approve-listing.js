/**
 * pages/api/admin/approve-listing.js
 * POST /api/admin/approve-listing
 * Body: { restaurantId: "uuid" }
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { restaurantId } = req.body;
  if (!restaurantId) return res.status(400).json({ error: 'restaurantId required' });

  const { error } = await supabase
    .from('restaurants')
    .update({ is_active: true, status: 'active' })
    .eq('id', restaurantId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
