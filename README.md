# GPR Proposal Builder

Roofing proposal tool for **Good People Roofing** — reps build a tiered
proposal on-site, the customer reviews and signs it from a phone link, and the
accepted deal syncs into GoHighLevel.

## Stack

- **Next.js 14** (Pages Router) + **React 18**
- **Supabase** — Postgres data layer (`proposals`, `settings`, `inspections`, `customer_tokens`)
- **OpenAI** — proposal copy generation, roof-photo analysis, EN→ES translation
- **@react-pdf/renderer** — server-rendered PDF export
- **GoHighLevel** — outbound SMS/email + CRM contact/opportunity sync
- Hosted on **Vercel** (auto-deploys from `main`)

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev                        # http://localhost:3000
```

`npm run build` runs the production build locally — do this before pushing.

## Environment variables

All keys are documented in [.env.local.example](.env.local.example). Real
values live in Vercel project settings (Production / Preview / Development) —
never commit them. Required: `OPENAI_API_KEY`, the three `SUPABASE_*` keys,
`ADMIN_PASSWORD`, `AUTH_SECRET`. Optional: `GHL_*` (CRM sync), `CRON_SECRET`.

## Routes

| Path | Audience | Purpose |
|------|----------|---------|
| `/` | Admin/rep | Builder, proposals, customers, inspections, settings (password-gated) |
| `/login` | Admin/rep | Single-password gate |
| `/p/[id]` | Customer | Public, signable proposal |
| `/c/[token]` | Customer | Private project-timeline page |
| `/present/[id]` | Rep | Full-screen in-home presentation deck |
| `/field/[id]` | Rep | Mobile on-site photo upload |
| `/api/*` | — | Serverless endpoints; auth gating is enforced in [middleware.js](middleware.js) |

## Deployment

Pushing to `main` triggers an automatic Vercel production build — there is no
manual deploy step. Use a branch + preview deployment to verify before merging.

## Layout

- `lib/` — service modules (Supabase, OpenAI, GHL, pricing, auth, vision)
- `pages/api/` — serverless API routes
- `pages/` — UI pages
- `middleware.js` — auth gate; public paths are whitelisted here
