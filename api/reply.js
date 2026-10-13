// Save-the-date reply endpoint (Vercel serverless function).
// Receives { name, email, leaning, note, website } from the reply form on index.html
// and stores it in the Supabase table `save_the_date_replies`.
//
// Needs two Vercel environment variables (never commit their values):
//   SUPABASE_URL         e.g. https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY  the project's secret key, sb_secret_... (server-only).
//                        A legacy service_role key in SUPABASE_SERVICE_ROLE_KEY also works.

const LEANINGS = ['yes', 'maybe', 'no'];
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !KEY) {
    return res.status(503).json({ error: 'Replies are not connected yet' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real guests never fill the hidden "website" field.
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const leaning = clean(body.leaning, 10);
  const note = clean(body.note, 1000);

  if (!name || !LEANINGS.includes(leaning)) {
    return res.status(400).json({ error: 'Name and a valid answer are required' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/save_the_date_replies`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        // New sb_secret_ keys go in apikey only; legacy JWT keys also need Authorization.
        ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name, email: email || null, leaning, note: note || null }),
    });
    if (!r.ok) {
      console.error('Supabase insert failed', r.status, await r.text());
      return res.status(502).json({ error: 'Could not save reply' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Supabase request error', err);
    return res.status(502).json({ error: 'Could not save reply' });
  }
};
