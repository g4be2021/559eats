// Admin-only Places nearby-search proxy (used by the Discover Local admin tool).
const { isAdmin } = require('./_lib/admin-auth');

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Not signed in' });
  const { lat, lng, radius, type } = req.query;
  const la = Number(lat), ln = Number(lng), rad = Math.min(Number(radius) || 5000, 50000);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return res.status(400).json({ error: 'lat and lng are required' });
  const t = /^[a-z_]+$/.test(type || '') ? type : 'restaurant';
  const key = process.env.GOOGLE_MAPS_API_KEY;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${la},${ln}&radius=${rad}&type=${t}&key=${key}`);
    return res.status(200).json(await r.json());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
