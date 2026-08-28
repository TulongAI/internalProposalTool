export default function PublicProposalNotFound() {
  return (
    <div className="public-view-shell">
      <div className="public-view-topbar">
        <div className="brand">
          tulong<span className="dot"></span>
        </div>
      </div>
      <div className="notfound-block">
        <h1>Proposal not found</h1>
        <p>This link isn&apos;t active, or the proposal it pointed to has been removed.</p>
      </div>
    </div>
  );
}
