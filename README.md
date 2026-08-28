# Tulong Proposal Desk

An internal tool for drafting scoped, priced Tulong cultural intelligence proposals
from a client brief. Originally built as a self-contained Claude Artifact; this is
that same UI and logic running as a small Next.js app so it can have real,
shared, server-side persistence.

## Stack

- **Next.js** (App Router) — UI + serverless API routes
- **Supabase** (Postgres) — stores the proposal list in a `proposals` table
  (see `lib/store.ts`); read/written only from server-side code using the
  `service_role` key, which bypasses the table's Row Level Security
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
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase project's
  Project Settings > API page. Required — unlike the old Vercel KV setup,
  there is no in-memory fallback: if these are missing or wrong,
  `/api/proposals` returns a clear 500 error (`Supabase is not configured: ...`)
  instead of silently degrading. That's deliberate — a KV-era version of this
  app had a fallback that looked like it worked locally but silently lost
  writes in production because it wasn't actually shared across serverless
  instances. Better to fail loudly than repeat that.

## Deploying

Push this repo to Vercel and set `tulong-proposal-tool-prod`, `SUPABASE_URL`,
and `SUPABASE_SERVICE_ROLE_KEY` under Environment Variables. The Supabase
project itself (and its `proposals` table) is provisioned separately — see
`lib/store.ts` for the schema this code expects if you need to recreate it.

### Two domains, one deployment

The app serves two different experiences depending on which hostname a request
comes in on — both point at this same Vercel project/deployment, split by
`middleware.ts`:

- **`proposal.tulongtech.ai`** (and any other host, including the raw
  `*.vercel.app` deployment URL and `localhost`) — the internal tool: proposal
  list, create/edit/delete, everything at `/` exactly as before.
- **`view.tulongtech.ai/<slug>`** — a public, read-only, branded view of one
  client's current proposal (see `app/public-view/`). No sidebar, no list, no
  Edit/Delete — just the proposal document and a Print/Save as PDF button. An
  unknown or missing slug renders a simple branded 404
  (`app/public-view/not-found.tsx`).

To wire this up in Vercel: add both `proposal.tulongtech.ai` and
`view.tulongtech.ai` as domains on the project (Vercel dashboard → Settings →
Domains), and point each at Vercel per its instructions (typically a CNAME at
your DNS provider). No separate deployment or project is needed — the
middleware does the routing based on the `Host` header.

### Client links

Every proposal gets a `slug` (derived from the client's organization name,
e.g. "FarSight Homes" → `farsighthomes`) assigned on save — see
`assignSlug()` in `lib/proposalShared.js`. Saving a proposal for the same
client again reuses the same slug, so `view.tulongtech.ai/<slug>` always
resolves to that client's most recent proposal; a different client whose name
would produce the same slug gets a `-2`, `-3`, ... suffix instead. The
internal doc view has a "Copy Client Link" button that copies the full
`https://view.tulongtech.ai/<slug>` URL.

## Notes

- The theme toggle (Light/Dark/Auto) still uses `localStorage` — that's a
  per-browser UI preference, not shared app data, so it doesn't need the
  database.
- Each proposal is one row in Supabase's `proposals` table: `id` (primary key),
  `slug` and `client_name` (denormalized from `content`, indexed together so
  the public view's slug lookup doesn't need to scan/parse every row), and
  `content` (the full proposal record as JSON — the source of truth). The
  `/api/proposals` PUT endpoint still takes the whole desired list at once
  (matching the original artifact's data model) and diffs it against what's
  stored, rather than exposing granular create/update/delete endpoints.
