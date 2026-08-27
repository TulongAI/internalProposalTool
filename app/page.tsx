"use client";

import { useEffect } from "react";
import { mountProposalApp } from "./proposalApp";

export default function Page() {
  useEffect(() => {
    mountProposalApp();
  }, []);

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-brand">
          <div className="rail-mark brand">
            tulong<span className="dot"></span>
          </div>
          <div className="rail-sub">Proposal Desk · Sales</div>
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button type="button" className="theme-btn" data-theme-choice="light">
              Light
            </button>
            <button type="button" className="theme-btn" data-theme-choice="dark">
              Dark
            </button>
            <button type="button" className="theme-btn" data-theme-choice="auto">
              Auto
            </button>
          </div>
        </div>
        <div className="rail-nav">
          <button className="rail-link" data-nav="list" type="button">
            Proposals
          </button>
          <button className="rail-cta" data-nav="new" type="button">
            + New Proposal
          </button>
        </div>
        <div className="rail-status">
          <div className="status-row">
            <span className="status-dot" id="status-dot"></span>
            <span id="status-text">Loading…</span>
          </div>
          <p id="status-detail"></p>
        </div>
      </nav>
      <main className="main">
        <div className="main-inner" id="app"></div>
      </main>
    </div>
  );
}
