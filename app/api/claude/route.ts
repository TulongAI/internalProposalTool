import { NextResponse } from "next/server";

// Name of the env var holding the Anthropic API key. Read server-side only —
// never sent to the browser. Configure it in Vercel's Environment Variables
// (or .env.local for development) with your Anthropic API key as the value.
const ANTHROPIC_API_KEY_ENV = "tulong-proposal-tool-prod";
const MODEL = "claude-sonnet-5";

type Brief = Record<string, string | string[] | undefined>;

function buildPrompt(kind: "greeting" | "why", brief: Brief): string {
  const lines = Object.entries(brief)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");

  if (kind === "greeting") {
    return (
      "You are a sales rep at Tulong, a cultural intelligence AI company, drafting a proposal for a prospective client. " +
      "Write a short, warm 3-4 sentence opening greeting based on the client brief below. Sign off with the rep's name if given, " +
      "otherwise sign off as \"The Tulong Team\". Do not use markdown formatting.\n\nClient brief:\n" + lines
    );
  }

  return (
    "You are writing the \"Why Tulong\" credibility section of a sales proposal for Tulong, a cultural intelligence AI company. " +
    "In 3-5 sentences, explain why Tulong is the right partner for this specific client, referencing relevant details from " +
    "their brief where it helps. Do not use markdown formatting.\n\nClient brief:\n" + lines
  );
}

export async function POST(request: Request) {
  const apiKey = process.env[ANTHROPIC_API_KEY_ENV];
  if (!apiKey) {
    return NextResponse.json(
      { error: `Server is missing the "${ANTHROPIC_API_KEY_ENV}" environment variable.` },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const kind: "greeting" | "why" = body?.kind === "why" ? "why" : "greeting";
  const brief: Brief = body?.brief && typeof body.brief === "object" ? body.brief : {};

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: buildPrompt(kind, brief) }],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the Claude API" }, { status: 502 });
  }

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Claude API request failed", detail }, { status: 502 });
  }

  const data = await response.json();
  const content = Array.isArray(data?.content) ? data.content : [];
  const text = content
    .map((block: { type?: string; text?: string }) => (block.type === "text" ? block.text ?? "" : ""))
    .join("")
    .trim();

  return NextResponse.json({ text });
}
