// Search engines and link previews
//   /sitemap.xml        -> list of every page and every live truck page
//   /truck/<id>         -> the truck page with its real title, description, share image and
//                          structured data already in the HTML (Google, Facebook, iMessage
//                          and text-message previews don't run the page's JavaScript)
const SUPA = process.env.SUPABASE_URL || 'https://wlpugteoycouvvnhamnm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
const SITE = 'https://www.559eats.com';
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = async (path) => { const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };


// Search landing pages: "food trucks in Fresno", "taco trucks Fresno", etc.
const LANDINGS = {
  'fresno': { h1: 'Food trucks in Fresno', title: 'Food Trucks in Fresno, CA: Hours, Locations & Menus', intro: 'Every food truck we know of in Fresno, with where they park, hours when posted, phone numbers and directions. Updated daily.', match: (r) => /fresno/i.test(r.address || '') },
  'clovis': { h1: 'Food trucks in Clovis', title: 'Food Trucks in Clovis, CA: Hours, Locations & Menus', intro: 'Food trucks parking in Clovis, with locations, hours when posted, phone numbers and directions.', match: (r) => /clovis/i.test(r.address || '') || /clovis/i.test(r.neighborhood || '') },
  'taco-trucks-fresno': { h1: 'Taco trucks in Fresno', title: 'Taco Trucks in Fresno, CA: Best Spots, Hours & Locations', intro: 'Taco trucks across Fresno and Clovis: where they park, hours when posted, and how to reach them.', match: (r) => /taco|taquer/i.test(r.name || '') },
  'birria-fresno': { h1: 'Birria trucks in Fresno & the Central Valley', title: 'Birria in Fresno: Food Trucks Serving Birria & Quesabirria', intro: 'Food trucks serving birria in Fresno and around the Central Valley.', match: (r) => /birri/i.test(r.name || '') || /birri/i.test(r.description || '') },
  'mariscos-fresno': { h1: 'Mariscos & seafood trucks in Fresno', title: 'Mariscos Trucks in Fresno: Seafood Food Trucks', intro: 'Seafood and mariscos trucks in Fresno.', match: (r) => /marisco|seafood|ceviche/i.test((r.name || '') + ' ' + (r.cuisine_type || '') + ' ' + (r.description || '')) },
};

async function landingPage(req, res) {
  const key = String(req.query.page || '');
  const L = LANDINGS[key];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!L) return res.status(404).send('Not found');
  const all = await get('restaurants?select=id,name,cuisine_type,neighborhood,address,phone,description,is_featured,sponsored_until,sponsor_tier&is_active=eq.true&status=eq.approved&order=name.asc&limit=1000');
  const hrs = await get('hours?select=restaurant_id&limit=10000');
  const withHours = new Set(hrs.map((h) => h.restaurant_id));
  const tierOf = (r) => (r.is_featured && (!r.sponsored_until || new Date(r.sponsored_until) > new Date())) ? (r.sponsor_tier || 2) : 0;
  const list = all.filter(L.match).sort((a, b) => tierOf(b) - tierOf(a) || a.name.localeCompare(b.name));
  const url = `${SITE}/food-trucks/${key}`;
  const items = list.map((r) => `<li class="t">
      <a class="tn" href="/truck/${r.id}">${esc(r.name)}</a>${tierOf(r) ? ' <span class="b">★</span>' : ''}
      <div class="tm">${esc([r.cuisine_type, r.neighborhood].filter(Boolean).join(' · '))}</div>
      ${r.address ? `<div class="ta">📍 ${esc(r.address)}</div>` : ''}
      <div class="tl">${withHours.has(r.id) ? '<a href="/truck/' + r.id + '">Hours &amp; menu</a>' : '<span>Hours not posted yet</span>'}${r.phone ? ` · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''} · <a href="/?truck=${r.id}">See on map</a></div>
    </li>`).join('');
  const others = Object.entries(LANDINGS).filter(([k]) => k !== key).map(([k, v]) => `<a href="/food-trucks/${k}">${esc(v.h1)}</a>`).join(' · ');
  const city = key.includes('clovis') ? 'Clovis' : 'Fresno';
  const what = L.h1.replace(/ in .*/, '').toLowerCase();
  const faq = [
    [`Where can I find ${what} in ${city} today?`, `The live map at 559eats.com shows which of the ${list.length} ${what} listed here are open right now and where each one is parked today. Owners update their own hours and location, so check the truck's status before you head out.`],
    [`How do I book a food truck for an event in ${city}?`, `Fill out the catering form at 559eats.com/catering with your date, guest count and budget. 559eats connects you with available local trucks within 24 hours, and you book directly with the truck you choose.`],
    [`Is 559eats free?`, `Yes. Finding trucks is free for everyone, and food trucks can list themselves for free.`],
  ];
  const faqHtml = `<div class="faq"><h2>Common questions</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'ItemList', name: L.h1, itemListElement: list.slice(0, 50).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/truck/${r.id}`, name: r.name })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(L.title)} · 559eats</title><meta name="description" content="${esc(L.intro)}"><link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(L.h1)} · 559eats"><meta property="og:description" content="${esc(L.intro)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og-default.png"><meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@800&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,sans-serif;background:#faf7f4;color:#2d2420;line-height:1.5}
@media(max-width:760px){nav>div{display:none}nav{padding:0 14px!important}}nav{display:flex;justify-content:space-between;align-items:center;padding:0 24px;height:64px;background:#fff;border-bottom:1px solid #e8e0da}nav a{color:#7a6e6a;text-decoration:none;margin-left:16px;font-size:.9rem}.logo{font-family:'Playfair Display',serif;font-weight:800;font-size:1.4rem;color:#E8512A!important;margin:0!important}
.hero{background:linear-gradient(160deg,#2d1a14,#4a2218 60%,#E8512A);color:#fff;padding:48px 24px;text-align:center}.hero h1{font-family:'Playfair Display',serif;font-size:clamp(1.9rem,4vw,2.8rem)}.hero p{opacity:.85;max-width:620px;margin:10px auto 0}
.wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px}.count{color:#7a6e6a;font-size:.9rem;margin-bottom:12px}.cta{display:inline-block;background:#E8512A;color:#fff;font-weight:700;padding:11px 22px;border-radius:999px;text-decoration:none;margin:4px 0 20px}
ul{list-style:none}.t{background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:10px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.tn{font-weight:700;font-size:1.05rem;color:#2d2420;text-decoration:none}.b{color:#f5b301}.tm{color:#7a6e6a;font-size:.85rem}.ta{font-size:.88rem;margin-top:4px}.tl{font-size:.85rem;margin-top:6px;color:#7a6e6a}.tl a{color:#c73e18;font-weight:600;text-decoration:none}
.own{background:#f9ede8;border-radius:14px;padding:18px;margin-top:24px;font-size:.92rem}.own a{color:#c73e18;font-weight:700}.faq{margin-top:32px}.faq h2{font-size:1.3rem;margin-bottom:10px}.faq h3{font-size:1rem;margin:16px 0 4px}.faq p{color:#5a4f4a;font-size:.93rem}.more{margin-top:28px;font-size:.88rem;color:#7a6e6a}.more a{color:#c73e18;text-decoration:none}
footer{background:#1a1310;color:rgba(255,255,255,.6);text-align:center;padding:28px;font-size:.85rem}footer a{color:rgba(255,255,255,.8);margin:0 8px;text-decoration:none}</style>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script><script defer src="/_vercel/insights/script.js"></script><link rel="stylesheet" href="/brand.css"><script src="/mobile-nav.js" defer></script><script src="/lang.js" defer></script></head><body>
<nav><a class="logo" href="/">559eats</a><div><a href="/">Map</a><a href="/browse.html">Browse</a><a href="/events.html">Events</a><a href="/catering.html">Catering</a></div></nav>
<div class="hero"><h1>${esc(L.h1)}</h1><p>${esc(L.intro)}</p></div>
<div class="wrap"><a class="cta" href="/">Open the live map</a>
<div class="count">${list.length} truck${list.length === 1 ? '' : 's'} listed</div><ul>${items || '<li class="t">No trucks listed here yet.</li>'}</ul>
<div class="own">Own a food truck${key.includes('clovis') ? ' in Clovis' : ' in Fresno'}? <a href="/apply.html">List it free</a> and post your hours, menu and today's spot.</div>
${faqHtml}
<div class="more">More: ${others}</div></div>
<footer><a href="/apply.html">List your truck</a><a href="/catering.html">Book a truck</a><a href="/contact.html">Contact</a><a href="/terms.html">Terms &amp; Privacy</a></footer>
<script src="/chat-widget.js" defer></script></body></html>`;
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}

async function sitemap(req, res) {
  const trucks = await get('restaurants?select=id,updated_at,created_at&is_active=eq.true&status=eq.approved&limit=5000');
  const pages = ['/', '/browse', '/events', '/catering', '/apply', '/pricing', '/about', '/contact', ...Object.keys(LANDINGS).map((k) => `/food-trucks/${k}`)];
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
  const host = /^[a-z0-9.-]+$/i.test(req.headers.host || '') ? req.headers.host : 'www.559eats.com';
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
    if (req.query.type === 'landing') return await landingPage(req, res);
    return res.status(404).end();
  } catch (e) {
    console.error('seo', e);
    return res.redirect(302, req.query.id ? `/restaurant.html?id=${encodeURIComponent(req.query.id)}` : '/');
  }
};
