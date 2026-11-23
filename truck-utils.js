// Shared helpers for the public map, browse and truck pages.
(function () {
  const TZ = 'America/Los_Angeles';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Current day name and minutes since midnight in Fresno time
  function nowLocal() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const h = Number(get('hour')) % 24, m = Number(get('minute'));
    return { day: get('weekday'), minutes: h * 60 + m };
  }
  const toMin = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  function fmtTime(t) {
    const mins = toMin(t); if (mins == null) return '';
    let h = Math.floor(mins / 60) % 24; const m = mins % 60; const ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12; return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
  }
  const future = (ts) => ts && new Date(ts).getTime() > Date.now();

  // Live "here now" location if the owner posted one that hasn't expired
  function liveSpot(r) {
    if (r && r.today_lat && r.today_lng && future(r.today_until)) {
      return { lat: r.today_lat, lng: r.today_lng, note: r.today_spot || '', until: r.today_until };
    }
    return null;
  }
  // Where to put the pin: live spot first, then the usual spot
  function position(r) {
    const live = liveSpot(r);
    if (live) return [live.lat, live.lng];
    if (r.latitude && r.longitude) return [r.latitude, r.longitude];
    return null;
  }

  // Returns { state: 'open'|'closed'|'unknown', label, todayText }
  function status(r, hoursRows) {
    const { day, minutes } = nowLocal();
    const rows = (hoursRows || []).filter((h) => h.restaurant_id === r.id);
    const today = rows.find((h) => h.day_of_week === day);
    let todayText = '';
    if (today) todayText = today.is_closed ? 'Closed today' : `${fmtTime(today.open_time)} – ${fmtTime(today.close_time)}`;

    if (r.open_override === 'closed' && future(r.open_override_until)) return { state: 'closed', label: 'Closed now', todayText };
    if (r.open_override === 'open' && future(r.open_override_until)) {
      const until = new Date(r.open_override_until).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
      return { state: 'open', label: `Open now · until ${until}`, todayText };
    }
    const live = liveSpot(r);
    if (live) {
      const until = new Date(live.until).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
      return { state: 'open', label: `Here now · until ${until}`, todayText };
    }
    if (!rows.length) return { state: 'unknown', label: 'Hours not posted', todayText };
    if (!today || today.is_closed) return { state: 'closed', label: 'Closed today', todayText };
    const o = toMin(today.open_time), c = toMin(today.close_time);
    if (o == null || c == null) return { state: 'unknown', label: 'Hours not posted', todayText };
    const open = c > o ? minutes >= o && minutes < c : minutes >= o || minutes < c; // handles past-midnight
    if (open) return { state: 'open', label: `Open now · until ${fmtTime(today.close_time)}`, todayText };
    if (minutes < o) return { state: 'closed', label: `Opens at ${fmtTime(today.open_time)}`, todayText };
    return { state: 'closed', label: 'Closed for today', todayText };
  }

  function cuisineIcon(c) {
    const s = String(c || '').toLowerCase();
    const map = [
      [/taco|mexic|birria|street/, '🌮'], [/bbq|barbecue|smok|brisket/, '🍖'], [/burger/, '🍔'], [/pizza|italian/, '🍕'],
      [/asian|chinese|thai|viet|pho|ramen|korean|japan|sushi|filip|lao|hmong/, '🍜'], [/seafood|fish|shrimp|marisc/, '🦐'],
      [/dessert|ice cream|sweet|churro|bak|donut|crepe/, '🍦'], [/coffee|espresso|boba|tea|drink|juice|agua/, '🧋'],
      [/vegan|veget|salad|health/, '🥗'], [/mediter|greek|gyro|halal|falafel|middle/, '🥙'], [/hot dog/, '🌭'],
      [/chicken|wing/, '🍗'], [/soul|cajun|southern/, '🍛'], [/fusion/, '🥡'], [/sandwich|deli|sub/, '🥪'],
    ];
    for (const [re, e] of map) if (re.test(s)) return e;
    return '🚚';
  }

  function directionsLinks(lat, lng, label) {
    const q = `${lat},${lng}`;
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
      apple: `https://maps.apple.com/?daddr=${encodeURIComponent(q)}&q=${encodeURIComponent(label || '')}`,
    };
  }

  function distanceMiles(a, b) {
    const R = 3958.8, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Favorites live in the browser (no account needed)
  const FAV = '559eats-favorites';
  const favs = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV) || '[]')); } catch { return new Set(); } };
  function toggleFav(id) {
    const f = favs(); f.has(id) ? f.delete(id) : f.add(id);
    try { localStorage.setItem(FAV, JSON.stringify([...f])); } catch {}
    return f.has(id);
  }

  async function share(title, url) {
    try {
      if (navigator.share) { await navigator.share({ title, url }); return 'shared'; }
      await navigator.clipboard.writeText(url); return 'copied';
    } catch { return 'failed'; }
  }

  function safeUrl(u) {
    if (!u) return '';
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return 'https://' + s;
    return '';
  }
  function instagramUrl(h) {
    if (!h) return '';
    const s = String(h).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://instagram.com/' + s.replace(/^@/, '').replace(/[^\w.]/g, '');
  }

  // Paid sponsor tier: 0 none, 1 Spotlight, 2 Featured, 3 Premium (only while the paid period is active)
  const TIERS = ['', 'Spotlight', 'Featured', 'Premium'];
  const tier = (r) => (r && r.is_featured && (!r.sponsored_until || future(r.sponsored_until))) ? (Number(r.sponsor_tier) || 2) : 0;
  const featured = (r) => tier(r) > 0;
  // Count a visit to a truck (page or map popup), once per truck per browser per day.
  // Skips your own visits on any browser where you've opened the admin page, and automated browsers.
  function trackView(id, src) {
    try {
      if (!id || navigator.webdriver || localStorage.getItem('559eats_staff') === '1') return;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
      const k = '559eats_v_' + (src || 'page') + '_' + id;
      if (localStorage.getItem(k) === day) return;
      localStorage.setItem(k, day);
      const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscHVndGVveWNvdXZ2bmhhbW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY3MjksImV4cCI6MjA5MTQxMjcyOX0.RndK-tL1KG7Yg23JxtMqRlv5rECd6ppJubwNwoM2d5g';
      fetch('https://wlpugteoycouvvnhamnm.supabase.co/rest/v1/rpc/bump_truck_view', {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rid: id, src: src === 'map' ? 'map' : 'page' }),
      }).catch(() => {});
    } catch (e) {}
  }
  window.Truck = { tier, TIERS, featured, DAYS, esc, nowLocal, fmtTime, liveSpot, position, status, cuisineIcon, directionsLinks, distanceMiles, favs, toggleFav, share, safeUrl, instagramUrl, future, trackView };
})();
