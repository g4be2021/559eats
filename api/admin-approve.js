import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { prospectId } = req.body;
  if (!prospectId) return res.status(400).json({ error: 'prospectId required' });

  const { data: prospect } = await supabase.from('prospects').select('*').eq('id', prospectId).single();
  if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

  // Create a restaurant record from the collected data
  const conv = prospect.conversation || [];
  const { error } = await supabase.from('prospects').update({ status: 'approved' }).eq('id', prospectId);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ message: 'Listing approved' });
}