import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only. SUPABASE_SERVICE_ROLE_KEY bypasses RLS by design — the
// `proposals` table has RLS enabled with no policies, so this is the only
// key that can read/write it. Never expose this key to the browser.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured: set the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

type ProposalRecord = {
  id: string;
  slug?: string;
  client?: { company?: string };
  updatedAt?: string;
  [key: string]: unknown;
};

export async function getProposals(): Promise<ProposalRecord[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("content")
    .order("updated_at", { ascending: true });
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return (data ?? []).map((row) => row.content as ProposalRecord);
}

// Mirrors the previous "replace the whole list" contract /api/proposals has
// always used (it always sends the full desired array) — diffed against
// what's currently stored so unrelated rows aren't needlessly rewritten,
// with rows for ids no longer present in `proposals` deleted.
export async function setProposals(proposals: ProposalRecord[]): Promise<void> {
  const supabase = getClient();

  const { data: existing, error: selectError } = await supabase.from("proposals").select("id");
  if (selectError) throw new Error(`Supabase read failed: ${selectError.message}`);

  const incomingIds = new Set(proposals.map((p) => p.id));
  const idsToDelete = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !incomingIds.has(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase.from("proposals").delete().in("id", idsToDelete);
    if (deleteError) throw new Error(`Supabase delete failed: ${deleteError.message}`);
  }

  if (proposals.length) {
    const rows = proposals.map((p) => ({
      id: p.id,
      slug: p.slug || "",
      client_name: (p.client && p.client.company) || "",
      content: p,
      updated_at: p.updatedAt || new Date().toISOString(),
    }));
    const { error: upsertError } = await supabase.from("proposals").upsert(rows, { onConflict: "id" });
    if (upsertError) throw new Error(`Supabase write failed: ${upsertError.message}`);
  }
}
