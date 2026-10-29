# Brooke & TJ wedding site

Live at https://brookeandtj.wedding. Wedding: Friday, September 10, 2027 at Villa Torre Bianca, Polignano a Mare, Puglia, Italy. Welcome party Thu Sep 9, farewell day Sat Sep 11.

## How it works
- Single static page: `index.html` (inline CSS + JS, no build step). Every push to `main` auto-deploys on Vercel.
- Domain is registered on Cloudflare (DNS only, grey cloud: A `@` → 76.76.21.21, CNAME `www` → cname.vercel-dns.com). Don't turn on the Cloudflare proxy.
- Brooke and TJ both edit this repo.
- Link previews use `images/og-image.jpg` (1200×630). Add-to-calendar uses `brooke-tj-wedding.ics` (Sep 9–11, 2027) plus a Google Calendar link; `vercel.json` sets its content type.
- Supabase free projects pause without "a few user requests to the database each day", which breaks `/api/reply`. Two keep-alives: a pg_cron job inside Supabase (`keepalive-api-read`, every 4 hours, reads the `keepalive` view through the REST API; see `supabase/save-the-date.sql`) and a daily Vercel cron in `vercel.json` that calls `GET /api/reply`. Don't remove either.

## Phases
- `var SITE = { phase: 1 };` near the bottom of `index.html`.
  - Phase 1 = save-the-date edition (current).
  - Phase 2 = full site: renders each `<template data-phase2="name">` into its `<div data-slot="name">`, shows `[data-phase="2"]`, hides `[data-phase="1"]`.
- New Phase 2 content goes inside a `<template data-phase2="…">` so it stays hidden until launch.
- The save-the-date reply form (`#replyForm`, Phase 1) posts to `/api/reply`, which upserts on `reply_key` (same email, or same name if no email) so a person has one row. The confirmation scrolls into view, repeats their answer and is remembered on their device (localStorage `btj-reply-v1`).
- Every save-the-date reply emails the couple via the wedding Gmail (nodemailer, `package.json`). Needs Vercel env vars `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO`; without them replies still save, just no email.
- The RSVP form (`#rsvpForm`) is a design prototype that saves nothing. The plan is to wire it to Supabase with guest lookup by household before switching to phase 2.

## Design
- Brand guidelines live in `brand/` (palette, typography, `tokens.css`). Palette (final stationery): Limestone `#F2EEE4` background, Ink `#1A1A18` text, Shutter Green `#2E3B30` as the only accent (used sparingly: hover/focus states and the signature), Olive `#6B6E4A`, Stone `#BBAE9B`. No red/oxblood.
- Fonts come from the Adobe Fonts web project (`https://use.typekit.net/noc6yvf.css`): `orpheuspro` for the hero, headings and all small caps (labels, nav, dates, buttons, footer) at one size (`--caps-size`); `adobe-garamond-pro` Regular for body and Italic for italic phrases. No bold anywhere. The ampersand in "Brooke & TJ" is wrapped in `<span class="amp">` and set in Adobe Garamond Pro Italic (default glyph, option A; `--amp-features` controls OpenType features). Ms Claudy stays off the site.
- Photos are Unsplash placeholders, to be replaced with the couple's own over time.
- `drafts/` holds earlier versions for reference only.
- Never recommend or mention Grotta Palazzese (the hotel/restaurant) anywhere on the site.

## Rules
- **This repo is public.** Never commit guest names, emails, addresses, RSVP responses, API secrets or keys. Guest data belongs in the database; secrets belong in Vercel environment variables.
- `drafts/`, `brand/` and `README.md` are excluded from deploys via `.vercelignore`.
- Keep the page fast and mobile-friendly; most guests will open it on a phone.
