import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUERIES = [
  'food truck Fresno CA',
  'taco truck Fresno CA',
  'food truck Clovis CA',
  'food truck Madera CA',
  'food truck Visalia CA',
  'food truck Tulare CA',
  'Mexican food truck Fresno',
  'BBQ food truck Fresno',
  'burger truck Fresno CA',
  'lonchera Fresno CA',
];

async function textSearch(query) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', '36.7378,-119.7871');
  url.searchParams.set('radius', '80000');
  url.searchParams.set('key', GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.results || [];
}

async function getDetails(placeId) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'international_phone_number,formatted_phone_number,name,formatted_address');
  url.searchParams.set('key', GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.status === 'OK' ? data.result : null;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return raw;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const seen = new Set();
  let upserted = 0;

  for (const query of QUERIES) {
    console.log(`\nSearching: ${query}`);
    const results = await textSearch(query);
    console.log(`  Found ${results.length} results`);

    for (const place of results) {
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);

      await sleep(200); // rate limit

      const details = await getDetails(place.place_id);
      if (!details) continue;

      const phone = normalizePhone(
        details.international_phone_number || details.formatted_phone_number
      );
      if (!phone) {
        console.log(`  Skipping ${details.name} — no phone`);
        continue;
      }

      const { error } = await supabase.from('prospects').upsert(
        {
          phone,
          name: details.name,
          address: details.formatted_address,
          place_id: place.place_id,
          source: 'google_places',
          status: 'pending',
        },
        { onConflict: 'place_id' }
      );

      if (error) {
        console.error(`  Error upserting ${details.name}:`, error.message);
      } else {
        upserted++;
        console.log(`  + ${details.name} (${phone})`);
      }
    }

    await sleep(500); // pause between queries
  }

  console.log(`\nDone! Upserted ${upserted} prospects.`);
})();
