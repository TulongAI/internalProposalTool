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
  these, proposal data is kept in memory only, **scoped to a single serverless
  instance** — in production this means a save can appear to work (the internal
  tool updates optimistically) while being invisible to the next request, a
  different route, or a client's public link, because Vercel may route those to
  a different instance entirely. This isn't just "lost on restart" like local
  dev — it's silently inconsistent per-request. The app surfaces this: if
  `/api/proposals` reports `storage: "memory"`, the internal tool's sidebar
  status shows an amber dot with a warning instead of "Connected". If you see
  that in production, the KV store isn't actually linked to the project yet.

## Deploying

Push this repo to Vercel, add a Vercel KV store under the project's Storage tab
(this wires up `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically), and set
`tulong-proposal-tool-prod` under Environment Variables.

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
- Proposal data is stored as a single JSON array under one KV key
  (`tulong:proposals`), matching the original artifact's data model. This is an
  internal tool for a small team; if usage grows, consider per-proposal KV keys
  or a proper database instead of one shared blob.
