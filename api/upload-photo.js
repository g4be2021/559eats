export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = 'https://wlpugteoycouvvnhamnm.supabase.co';
  // Use service role key — bypasses RLS for storage uploads
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';

  const { restaurantId, filename, contentType } = req.query;
  if (!restaurantId || !filename) return res.status(400).json({ error: 'Missing restaurantId or filename' });

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const authKey = SERVICE_KEY || ANON_KEY;
  const storagePath = `${restaurantId}/${filename}`;

  try {
    // Upload to Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/restaurant-photos/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'apikey': authKey,
          'Authorization': `Bearer ${authKey}`,
          'Content-Type': contentType || 'image/jpeg',
          'x-upsert': 'true',
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(uploadRes.status).json({ error: err });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/restaurant-photos/${storagePath}`;

    // Insert into photos table
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/photos`, {
      method: 'POST',
      headers: {
        'apikey': authKey,
        'Authorization': `Bearer ${authKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        url: publicUrl,
        sort_order: parseInt(req.query.sortOrder || '0'),
      }),
    });

    if (!dbRes.ok) {
      const err = await dbRes.text();
      return res.status(dbRes.status).json({ error: err });
    }

    const photo = await dbRes.json();
    return res.status(200).json({ url: publicUrl, photo: photo[0] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
