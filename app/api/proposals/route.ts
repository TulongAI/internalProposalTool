import { NextResponse } from "next/server";
import { getProposals, setProposals } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const proposals = await getProposals();
    return NextResponse.json({ proposals });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.proposals)) {
    return NextResponse.json({ error: "Expected a JSON body shaped like { proposals: [] }" }, { status: 400 });
  }
  try {
    await setProposals(body.proposals);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
