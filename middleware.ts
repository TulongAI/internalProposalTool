import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Requests to this host get rewritten to the read-only public proposal
// view (app/public-view/...). Every other host — proposal.tulongtech.ai,
// the raw *.vercel.app deployment URL, localhost — is left completely
// untouched and keeps serving the internal tool at "/" exactly as before.
const PUBLIC_VIEW_HOST = "view.tulongtech.ai";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0];
  if (host !== PUBLIC_VIEW_HOST) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/public-view")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/public-view${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
