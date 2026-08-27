# Tulong Proposal Desk

An internal tool for drafting scoped, priced Tulong cultural intelligence proposals
from a client brief. Originally built as a self-contained Claude Artifact; this is
that same UI and logic running as a small Next.js app so it can have real,
shared, server-side persistence.

## Stack

- **Next.js** (App Router) — UI + serverless API routes
- **Vercel KV** — stores the proposal list (falls back to an in-memory store for
  local dev if KV isn't configured, so `npm run dev` works out of the box)
- A `/api/claude` serverless function that proxies to the Anthropic Messages API,
  used by the "✨ Draft with AI" buttons on the greeting / "why Tulong" fields.
  The Anthropic API key stays server-side and is never sent to the browser.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000.

### Environment variables

Set these in `.env.local` for local development, and in your Vercel project's
Environment Variables for deployment:

- `tulong-proposal-tool-prod` — your Anthropic API key. Read only by
  `app/api/claude/route.ts`; required for the "Draft with AI" buttons to work.
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — provided automatically once you add
  the **Vercel KV** (Storage tab) integration to the project and link it. Without
  these, proposal data is kept in memory only and is lost on restart/redeploy.

## Deploying

Push this repo to Vercel, add a Vercel KV store under the project's Storage tab
(this wires up `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically), and set
`tulong-proposal-tool-prod` under Environment Variables.

## Notes

- The theme toggle (Light/Dark/Auto) still uses `localStorage` — that's a
  per-browser UI preference, not shared app data, so it doesn't need the
  database.
- Proposal data is stored as a single JSON array under one KV key
  (`tulong:proposals`), matching the original artifact's data model. This is an
  internal tool for a small team; if usage grows, consider per-proposal KV keys
  or a proper database instead of one shared blob.
