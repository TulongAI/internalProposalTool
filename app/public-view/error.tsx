"use client";

// Catches errors thrown while resolving a proposal (e.g. Supabase not
// configured) so a server misconfiguration still renders on-brand instead
// of Next's generic error page. Distinct from not-found.tsx, which handles
// "no proposal matches this slug" rather than "couldn't even check."
export default function PublicViewError() {
  return (
    <div className="public-view-shell">
      <div className="public-view-topbar">
        <div className="brand">
          tulong<span className="dot"></span>
        </div>
      </div>
      <div className="notfound-block">
        <h1>Something went wrong</h1>
        <p>This proposal can&apos;t be loaded right now. Please try again shortly.</p>
      </div>
    </div>
  );
}
