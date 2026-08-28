import { kv } from "@vercel/kv";

const KEY = "tulong:proposals";

// @vercel/kv throws at call time (not import time) if KV_REST_API_URL /
// KV_REST_API_TOKEN aren't set. Fall back to an in-memory store so local
// development works before the Vercel KV integration is linked. In-memory
// data does not persist across server restarts or across serverless
// invocations in production — set up real KV for that.
const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Exposed so API routes can tell callers which backend is actually in use.
// The in-memory fallback is scoped to a single serverless function
// instance — fine for `npm run dev`, but on Vercel each route (and each
// cold start) can be a different instance, so without real KV, writes
// from one request are invisible to reads from another. That's silent
// and easy to miss, so the client surfaces a warning when this is false
// in production instead of just quietly losing data.
export function isUsingKv(): boolean {
  return hasKv;
}

let memoryStore: unknown[] = [];

export async function getProposals(): Promise<unknown[]> {
  if (hasKv) {
    const value = await kv.get<unknown[]>(KEY);
    return Array.isArray(value) ? value : [];
  }
  return memoryStore;
}

export async function setProposals(proposals: unknown[]): Promise<void> {
  if (hasKv) {
    await kv.set(KEY, proposals);
    return;
  }
  memoryStore = proposals;
}
