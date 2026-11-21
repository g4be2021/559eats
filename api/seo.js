// Search engines and link previews
//   /sitemap.xml        -> list of every page and every live truck page
//   /truck/<id>         -> the truck page with its real title, description, share image and
//                          structured data already in the HTML (Google, Facebook, iMessage
//                          and text-message previews don't run the page's JavaScript)
const SUPA = process.env.SUPABASE_URL || 'https://wlpugteoycouvvnhamnm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const SITE = 'https://559eats.com';
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = async (path) => { const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };

async function sitemap(req, res) {
  const trucks = await get('restaurants?select=id,updated_at,created_at&is_active=eq.true&status=eq.approved&limit=5000');
  const pages = ['/', '/browse.html', '/events.html', '/catering.html', '/apply.html', '/pricing.html', '/about.html', '/contact.html'];
  const urls = [
    ...pages.map((p) => `<url><loc>${SITE}${p}</loc><changefreq>daily</changefreq><priority>${p === '/' ? '1.0' : '0.6'}</priority></url>`),
    ...trucks.map((t) => {
      const d = t.updated_at || t.created_at;
      return `<url><loc>${SITE}/truck/${t.id}</loc>${d ? `<lastmod>${new Date(d).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>daily</changefreq><priority>0.8</priority></url>`;
    }),
  ];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}

function hhmm(t) { return t ? String(t).slice(0, 5) : null; }

async function truckPage(req, res) {
  const id = String(req.query.id || '');
  const host = /^[a-z0-9.-]+$/i.test(req.headers.host || '') ? req.headers.host : '559eats.com';
  const tpl = await fetch(`https://${host}/restaurant.html`, { headers: { cookie: req.headers.cookie || '' } }).then((r) => r.text());
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(404).setHeader('Content-Type', 'text/html').send(tpl);
  const [rows, photos, hours] = await Promise.all([
    get(`restaurants?id=eq.${id}&is_active=eq.true&select=id,name,cuisine_type,neighborhood,address,latitude,longitude,phone,description,website,instagram,facebook,menu&limit=1`),
    get(`photos?restaurant_id=eq.${id}&select=url&order=is_primary.desc,sort_order.asc&limit=1`),
    get(`hours?restaurant_id=eq.${id}&select=day_of_week,open_time,close_time,is_closed`),
  ]);
  const d = rows[0];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!d) { res.setHeader('X-Robots-Tag', 'noindex'); return res.status(404).send(tpl); }

  const area = d.neighborhood || 'Fresno';
  const food = d.cuisine_type || 'Food truck';
  const title = `${d.name} · ${food} food truck in ${area} · 559eats`;
  const desc = (d.description && d.description.trim().slice(0, 155)) ||
    `${d.name} is a ${food.toLowerCase()} food truck in ${area}, CA. See today's location, hours, menu, photos and directions on 559eats.`;
  const url = `${SITE}/truck/${d.id}`;
  const img = photos[0] && /^https:\/\//.test(photos[0].url) ? photos[0].url : `${SITE}/og-default.png`;

  const ld = {
    '@context': 'https://schema.org', '@type': 'FoodEstablishment', additionalType: 'https://schema.org/FoodTruck',
    name: d.name, url, servesCuisine: d.cuisine_type || undefined, telephone: d.phone || undefined,
    image: photos[0] ? photos[0].url : undefined, description: desc,
    address: d.address ? { '@type': 'PostalAddress', streetAddress: d.address, addressRegion: 'CA', addressCountry: 'US' } : undefined,
    geo: d.latitude ? { '@type': 'GeoCoordinates', latitude: d.latitude, longitude: d.longitude } : undefined,
    sameAs: [d.website, d.instagram && (d.instagram.startsWith('http') ? d.instagram : `https://instagram.com/${d.instagram.replace(/^@/, '')}`), d.facebook].filter((u) => u && /^https?:\/\//.test(u)),
    openingHoursSpecification: (hours || []).filter((h) => !h.is_closed && h.open_time && h.close_time).map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DAYS.find((x) => x.toLowerCase() === String(h.day_of_week).toLowerCase()) || h.day_of_week}`,
      opens: hhmm(h.open_time), closes: hhmm(h.close_time),
    })),
  };
  const head = `<title>${esc(title)}</title>
<meta name="description" id="metaDesc" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="restaurant"><meta property="og:site_name" content="559eats">
<meta property="og:title" content="${esc(d.name)} · ${esc(food)} in ${esc(area)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<script>window.TRUCK_ID=${JSON.stringify(d.id)};</script>`;

  const html = tpl
    .replace(/<title[^>]*>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `${head}\n</head>`);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
}

module.exports = async (req, res) => {
  try {
    if (req.query.type === 'sitemap') return await sitemap(req, res);
    if (req.query.type === 'truck') return await truckPage(req, res);
    return res.status(404).end();
  } catch (e) {
    console.error('seo', e);
    return res.redirect(302, req.query.id ? `/restaurant.html?id=${encodeURIComponent(req.query.id)}` : '/');
  }
};
