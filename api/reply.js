// Save-the-date reply endpoint (Vercel serverless function).
// Receives { name, email, leaning, note, website } from the reply form on index.html
// and stores it in the Supabase table `save_the_date_replies`.
//
// Needs these Vercel environment variables (never commit their values):
//   SUPABASE_URL         e.g. https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY  the project's secret key, sb_secret_... (server-only).
//                        A legacy service_role key in SUPABASE_SERVICE_ROLE_KEY also works.
// Optional, for an email alert on every reply (sent from the wedding Gmail):
//   GMAIL_USER           brooke.tj.wedding@gmail.com
//   GMAIL_APP_PASSWORD   a Google "app password" for that account (16 letters)
//   NOTIFY_TO            comma-separated addresses to alert (defaults to GMAIL_USER)

const nodemailer = require('nodemailer');

const LEANINGS = ['yes', 'maybe', 'no'];
const LABEL = { yes: "Yes, wouldn't miss it", maybe: 'Maybe, hoping to make it', no: "No, sadly can't" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Email alert to the couple. Never throws, and gives up after a few seconds so a
// slow mail server can't hold up a guest's confirmation.
async function notifyCouple({ name, email, leaning, note, updated, totals }) {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const to = (process.env.NOTIFY_TO || user).trim();
  if (!user || !pass || !to) return 'not configured';
  const verb = updated ? 'Updated reply' : 'New reply';
  const subject = `${verb}: ${name} · ${leaning === 'yes' ? 'Yes' : leaning === 'maybe' ? 'Maybe' : 'No'}`;
  const tally = totals ? `Yes ${totals.yes} · Maybe ${totals.maybe} · No ${totals.no}` : '';
  const lines = [
    `${name} ${updated ? 'changed their reply to' : 'replied'}: ${LABEL[leaning]}`,
    email ? `Email: ${email}` : 'Email: (not given)',
    note ? `Note: ${note}` : '',
    tally ? `\nAll replies so far: ${tally}` : '',
    '\nbrookeandtj.wedding',
  ].filter(Boolean);
  const html = `<div style="font-family:Georgia,serif;font-size:16px;color:#1A1A18;line-height:1.5">
<p style="margin:0 0 12px"><b style="font-weight:400;font-size:20px">${esc(name)}</b> ${updated ? 'changed their reply to' : 'replied'}: <i>${esc(LABEL[leaning])}</i></p>
<p style="margin:0 0 4px;color:#4A4A45">Email: ${email ? esc(email) : '(not given)'}</p>
${note ? `<p style="margin:0 0 4px;color:#4A4A45">Note: ${esc(note)}</p>` : ''}
${tally ? `<p style="margin:16px 0 0;color:#6B6E4A">All replies so far: ${esc(tally)}</p>` : ''}
<p style="margin:20px 0 0;font-size:13px;color:#7D705C">brookeandtj.wedding</p></div>`;
  try {
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    const send = transport.sendMail({
      from: `"Brooke & TJ website" <${user}>`,
      to,
      subject,
      text: lines.join('\n'),
      html,
    });
    await Promise.race([send, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
    return 'sent';
  } catch (err) {
    console.error('Reply alert email failed:', err && err.message);
    return 'failed';
  }
}

// Current yes / maybe / no counts (one row per person), for the alert email.
async function getTotals(base, headers) {
  try {
    const r = await fetch(`${base}/rest/v1/save_the_date_replies?select=leaning`, { headers });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows.reduce((t, x) => { if (t[x.leaning] !== undefined) t[x.leaning]++; return t; }, { yes: 0, maybe: 0, no: 0 });
  } catch (e) { return null; }
}
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const authHeaders = (key) => ({
  apikey: key,
  // New sb_secret_ keys go in apikey only; legacy JWT keys also need Authorization.
  ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
});

module.exports = async function handler(req, res) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const KEY = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  // GET = safe connection check (yes/no answers only, never the key or any data).
  if (req.method === 'GET') {
    const status = {
      urlSet: Boolean(SUPABASE_URL),
      urlLooksRight: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL),
      keySet: Boolean(KEY),
      keyType: !KEY ? 'none' : KEY.startsWith('sb_secret_') ? 'secret' : KEY.startsWith('sb_publishable_') ? 'publishable (wrong key)' : KEY.startsWith('eyJ') ? 'legacy' : 'unrecognised',
      supabase: 'not checked',
      emailAlerts: process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'configured' : 'not configured',
    };
    if (status.urlSet && status.keySet) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/save_the_date_replies?select=id&limit=0`, { headers: authHeaders(KEY) });
        status.supabase = r.ok ? 'connected' : `error ${r.status}`;
      } catch (e) {
        status.supabase = 'unreachable';
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(status);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !KEY) {
    console.error('Reply not saved: SUPABASE_URL or SUPABASE_SECRET_KEY is missing in this deployment');
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
    // One reply per person: the same email (or the same name, if no email) updates
    // their earlier reply instead of adding a row. reply_key is a generated column
    // with a unique index (see supabase/save-the-date.sql).
    const r = await fetch(`${SUPABASE_URL}/rest/v1/save_the_date_replies?on_conflict=reply_key`, {
      method: 'POST',
      headers: {
        ...authHeaders(KEY),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({ name, email: email || null, leaning, note: note || null, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      console.error('Supabase insert failed', r.status, await r.text());
      return res.status(502).json({ error: 'Could not save reply' });
    }

    // Was this a brand-new reply or an update to an earlier one?
    let updated = false;
    try {
      const [row] = await r.json();
      if (row && row.created_at && row.updated_at) {
        updated = new Date(row.updated_at) - new Date(row.created_at) > 60 * 1000;
      }
    } catch (e) { /* not important */ }
    const totals = await getTotals(SUPABASE_URL, authHeaders(KEY));
    await notifyCouple({ name, email, leaning, note, updated, totals });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Supabase request error', err);
    return res.status(502).json({ error: 'Could not save reply' });
  }
};
