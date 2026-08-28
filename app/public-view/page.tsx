import { notFound } from "next/navigation";

// view.tulongtech.ai/ (no slug) — nothing to show publicly at the bare
// root, so it's the same branded not-found as an unknown slug.
export const dynamic = "force-dynamic";

export default function PublicViewRoot() {
  notFound();
}
