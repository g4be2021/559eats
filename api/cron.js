// ============================================
// 559eats · Scheduled jobs (one function, four jobs)
// Vercel Cron calls /api/cron?job=<name> with Authorization: Bearer CRON_SECRET.
// Jobs live in api/_jobs (folders starting with _ are not counted as functions).
// ============================================
const jobs = {
  'monthly-checkin': require('./_jobs/monthly-checkin'),
  'new-listing-followup': require('./_jobs/new-listing-followup'),
  'sponsored-reminder': require('./_jobs/sponsored-reminder'),
  'stale-listings': require('./_jobs/stale-listings'),
};

module.exports = async (req, res) => {
  const job = (req.query && req.query.job) || new URL(req.url, 'http://x').searchParams.get('job');
  if (!jobs[job]) return res.status(404).json({ error: 'unknown job' });
  return jobs[job](req, res);
};
