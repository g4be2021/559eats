// Admin-only geocoding proxy (used by admin tools). Not open to the public, so nobody can run up the Maps bill.
const { isAdmin } = require('./_lib/admin-auth');

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Not signed in' });
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address is required' });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`);
    return res.status(200).json(await r.json());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
