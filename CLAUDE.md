# Brooke & TJ wedding site

Live at https://brookeandtj.wedding. Wedding: Friday, September 10, 2027 at Villa Torre Bianca, Polignano a Mare, Puglia, Italy. Welcome party Thu Sep 9, farewell day Sat Sep 11.

## How it works
- Single static page: `index.html` (inline CSS + JS, no build step). Every push to `main` auto-deploys on Vercel.
- Domain is registered on Cloudflare (DNS only, grey cloud: A `@` → 76.76.21.21, CNAME `www` → cname.vercel-dns.com). Don't turn on the Cloudflare proxy.
- Brooke and TJ both edit this repo.
- Supabase free projects pause after 7 days without activity, which breaks `/api/reply`. `vercel.json` runs a daily Vercel cron that calls `GET /api/reply` (a harmless connection check that queries the table) to keep the project awake. Don't remove it.

## Phases
- `var SITE = { phase: 1 };` near the bottom of `index.html`.
  - Phase 1 = save-the-date edition (current).
  - Phase 2 = full site: renders each `<template data-phase2="name">` into its `<div data-slot="name">`, shows `[data-phase="2"]`, hides `[data-phase="1"]`.
- New Phase 2 content goes inside a `<template data-phase2="…">` so it stays hidden until launch.
- The RSVP form (`#rsvpForm`) is a design prototype that saves nothing. The plan is to wire it to Supabase with guest lookup by household before switching to phase 2.

## Design
- Brand guidelines live in `brand/` (palette, typography, `tokens.css`). Accent colors: olive `#50563E`, oxblood `#391613`, taupe `#B2A691`, plus ivory `#F1EDE4` and black `#171716`.
- The page currently uses Google Fonts (Bellefair, Cormorant Garamond, Jost). Ms Claudy and Adobe Garamond Pro need web licenses before they can be used on the site.
- Photos are Unsplash placeholders, to be replaced with the couple's own over time.
- `drafts/` holds earlier versions for reference only.

## Rules
- **This repo is public.** Never commit guest names, emails, addresses, RSVP responses, API secrets or keys. Guest data belongs in the database; secrets belong in Vercel environment variables.
- `drafts/`, `brand/` and `README.md` are excluded from deploys via `.vercelignore`.
- Keep the page fast and mobile-friendly; most guests will open it on a phone.
