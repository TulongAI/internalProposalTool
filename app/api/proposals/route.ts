import { NextResponse } from "next/server";
import { getProposals, setProposals, isUsingKv } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const proposals = await getProposals();
  return NextResponse.json({ proposals, storage: isUsingKv() ? "kv" : "memory" });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.proposals)) {
    return NextResponse.json({ error: "Expected a JSON body shaped like { proposals: [] }" }, { status: 400 });
  }
  await setProposals(body.proposals);
  return NextResponse.json({ ok: true, storage: isUsingKv() ? "kv" : "memory" });
}
