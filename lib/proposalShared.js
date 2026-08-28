/* Shared, environment-agnostic proposal data + rendering logic.
 *
 * Pure JS (no `window`/`document`/`fs`), so it can be imported both by the
 * client-side internal app (app/proposalApp.js) and by server components
 * (the public client-facing view under app/public-view/). Keeping this in
 * one place means the public view renders the exact same proposal markup
 * as the internal tool, just wrapped in different chrome around it.
 */

/* ---------------- static reference data ---------------- */
export var SERVICES = {
  audit: { label: "Cultural Audit Services", blurb: "A gap analysis of existing campaigns and messaging, a cultural risk scorecard, and a prioritized action roadmap.", meta: "Timeline: 4–6 weeks", core: true },
  sentiment: { label: "Cultural Sentiment & Analytics", blurb: "Real-time multilingual sentiment tracking across 20+ language groups, with monthly intelligence reports and emerging-shift alerts.", meta: "Cadence: ongoing monthly", core: true },
  strategy: { label: "Multicultural Business Strategy", blurb: "Go-to-market strategy, workshop facilitation, and executive advisory grounded in The Multicultural Mindset framework.", meta: "Format: workshop series, retainer, or project", core: true },
  insights: { label: "Cultural Insights & Analytics", blurb: "Tulong's cultural intelligence layer applied to a client's own CRM and first-party data to surface the multicultural opportunity already inside their customer base.", meta: "Engagement: 6–10 weeks", core: true },
  industry: { label: "Cross-Cultural Industry Intelligence", blurb: "Sector-specific market sizing, regulatory considerations, and competitive benchmarking for regulated, high-stakes industries.", meta: "", core: true },
  workshops: { label: "Workshops and Technical Training", blurb: "Hands-on team workshops and technical enablement sessions for marketing and leadership teams.", meta: "", core: false },
  monitoring: { label: "Ongoing Monitoring and Reporting", blurb: "Continuous tracking and scheduled reporting layered on top of any active engagement.", meta: "", core: false },
  unsure: { label: "Not sure, advise me", blurb: "Client isn't sure yet which services fit — flagged for a Tulong advisory recommendation.", meta: "", core: false }
};
export var SERVICE_ORDER = ["audit", "sentiment", "strategy", "insights", "industry", "workshops", "monitoring", "unsure"];

export var TIERS = {
  essentials: { name: "Essentials", tagline: "For teams beginning their cultural intelligence journey.", price: 3500,
    highlights: ["Access to one core service area", "Monthly reporting and strategic recommendations", "Quarterly strategy session (1 hour)", "Up to 3 cultural segments monitored", "Email support"],
    bestFor: "SMBs, single-market campaigns, pilot engagements" },
  growth: { name: "Growth", badge: "Most Popular", tagline: "For clients with dual cross-functional needs — marketing, sales, communications, HR and leadership.", price: 8500,
    highlights: ["Access to three core service areas", "Bi-weekly reporting and real-time sentiment alerts", "Monthly strategy sessions with the Tulong team", "Up to 10 cultural segments monitored", "Integration guidance for existing marketing platforms", "Dedicated account contact"],
    bestFor: "Mid-market brands, agencies managing diverse audience portfolios" },
  enterprise: { name: "Enterprise", tagline: "For organizations requiring comprehensive cultural intelligence capability.", price: 15000,
    highlights: ["Full access to all five service areas", "Dedicated Tulong account team", "Custom AI tooling and platform integration", "Executive advisory access, including Joycelyn David", "Unlimited cultural segment coverage", "White-label options available for agency partners", "Priority SLA and quarterly executive business reviews"],
    bestFor: "Large enterprises, regulated industry clients, agency white-label partners" }
};
export var TIER_ORDER = ["essentials", "growth", "enterprise"];

export var PROJECT_RATES = {
  audit_single: { label: "Cultural Audit — single market", price: 12500 },
  audit_multi: { label: "Cultural Audit — multi-market (up to 5)", price: 28500 },
  insights_study: { label: "Cultural Insights Research Study", price: 45000 },
  workshop_half: { label: "Strategy Workshop — half-day", price: 7500 },
  workshop_full: { label: "Strategy Workshop — full-day", price: 14000 },
  speaking: { label: "Executive Speaking Engagement", price: 25000 },
  keynote_bundle: { label: "Keynote + Workshop Bundle", price: 18500 },
  custom_research: { label: "Custom Research (per segment)", price: 20000 }
};
export var PROJECT_ORDER = ["audit_single", "audit_multi", "insights_study", "workshop_half", "workshop_full", "speaking", "keynote_bundle", "custom_research"];

export var DEFAULT_TIMELINE = [
  { phase: "Discovery & Brief Review", duration: "Weeks 1–2" },
  { phase: "Cultural Intelligence Audit / Baseline", duration: "Weeks 3–6" },
  { phase: "Strategy & Roadmap Delivery", duration: "Weeks 7–8" },
  { phase: "Ongoing Managed Services Begins", duration: "Month 3 onward" }
];

export var DEFAULT_WHY = "Tulong is a Toronto-based cultural intelligence AI company founded by Joycelyn David — a 20+ year multicultural marketing veteran, bestselling author of The Multicultural Mindset, and three-time Globe and Mail Canada's Top Growing Companies honouree. Our models are built on two decades of real-world multicultural campaign data, not scraped from the internet — backed by a FedDev Ontario–funded regional AI initiative and a ventureLAB portfolio company. We encode practitioner knowledge into AI. We don't sell theory.";

export var PUBLIC_VIEW_BASE = "https://view.tulongtech.ai";

/* ---------------- formatting helpers ---------------- */
export function fmtMoney(n) { n = Number(n) || 0; return "$" + n.toLocaleString("en-US"); }
export function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return ""; } }
export function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
export function linesToBullets(text) { return String(text || "").split("\n").map(function (l) { return l.replace(/^[-–*\s]+/, "").trim(); }).filter(Boolean); }
export function firstName(full) { return String(full || "").trim().split(/\s+/)[0] || ""; }

export function defaultGreeting(repName, contact, company) {
  var contactFirst = firstName(contact) || "there";
  var co = company || "your team";
  return "Hi " + contactFirst + ",\n\nThanks for the chance to put together a plan for " + co + ". Based on what you've shared, we've outlined a cultural intelligence approach below — the scope, the team, and the investment — so you can see exactly what working with Tulong would look like.\n\n— " + (repName || "The Tulong Team");
}

export function waveSvg() {
  return '<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<path d="M -20 220 C 160 260, 300 190, 420 140 S 640 90, 820 120" fill="none" stroke="#EC1845" stroke-width="1.2" opacity="0.55"/>' +
    '<path d="M -20 250 C 160 290, 300 220, 420 170 S 640 120, 820 150" fill="none" stroke="#EC1845" stroke-width="1" opacity="0.4"/>' +
    '<path d="M -20 190 C 160 230, 300 160, 420 110 S 640 60, 820 90" fill="none" stroke="#EC1845" stroke-width="1" opacity="0.35"/>' +
    '</svg>';
}

/* ---------------- slugs ---------------- */
// "FarSight Homes" -> "farsighthomes". Strips accents, then anything that
// isn't a lowercase letter or digit (spaces, punctuation, emoji, etc).
export function slugBase(name) {
  var s = String(name || "");
  try { s = s.normalize("NFKD").replace(/[̀-ͯ]/g, ""); } catch (e) { /* normalize unavailable — best effort */ }
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return s || "client";
}

function normCompany(name) {
  return String(name || "").trim().toLowerCase();
}

// Assigns a slug for `companyName` that is unique among `allProposals`
// (excluding `currentId`, i.e. the proposal being saved). Proposals that
// share the same (normalized) company name are treated as the same
// client and intentionally reuse the same slug — the public link is
// meant to always resolve to that client's most recent proposal, decided
// at lookup time by `updatedAt`. Proposals for a *different* company that
// would otherwise collide on the same base slug get a numeric suffix.
export function assignSlug(companyName, currentId, allProposals) {
  var base = slugBase(companyName);
  var wanted = normCompany(companyName);
  var others = (allProposals || []).filter(function (p) { return p && p.id !== currentId; });

  function isTakenByOther(slug) {
    return others.some(function (p) {
      var pSlug = p.slug || slugBase(p.client && p.client.company);
      return pSlug === slug && normCompany(p.client && p.client.company) !== wanted;
    });
  }

  if (!isTakenByOther(base)) return base;
  var n = 2;
  while (isTakenByOther(base + "-" + n)) n++;
  return base + "-" + n;
}

// Given the full proposals array and a slug from the URL, returns the
// most recently updated proposal matching that slug, or null. Falls back
// to computing a slug on the fly for older records saved before `slug`
// existed on the schema.
export function resolveProposalForSlug(allProposals, slug) {
  var wanted = String(slug || "");
  var matches = (allProposals || []).filter(function (p) {
    var pSlug = p && (p.slug || slugBase(p.client && p.client.company));
    return pSlug === wanted;
  });
  if (!matches.length) return null;
  matches.sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });
  return matches[0];
}

export function clientLinkForProposal(p) {
  var slug = (p && p.slug) || slugBase(p && p.client && p.client.company);
  return PUBLIC_VIEW_BASE + "/" + slug;
}

/* ---------------- proposal document markup ---------------- */
// Renders the `<article class="doc">...</article>` for a proposal record.
// This is the actual proposal document — identical whether shown inside
// the internal tool's doc view or the public client-facing view. Chrome
// around it (topbar, nav, edit/delete) is the caller's responsibility.
export function renderProposalArticleHTML(p) {
  var tier = TIERS[p.tier] || TIERS.essentials;
  var retainer = p.customRetainer ? Number(p.customRetainer) : tier.price;
  var challenges = linesToBullets(p.problem);

  var svcChecklist = SERVICE_ORDER.map(function (key) {
    var s = SERVICES[key];
    var isChecked = (p.services || []).indexOf(key) > -1;
    return '<li class="' + (isChecked ? "checked" : "unchecked") + '"><span class="box">' + (isChecked ? "✓" : "") + '</span>' + esc(s.label) + '</li>';
  }).join("");

  var scopeServices = (p.services || []).filter(function (k) { return SERVICES[k] && k !== "unsure"; });
  var scopeHTML = scopeServices.map(function (k, i) {
    var s = SERVICES[k];
    return '<div class="service-line"><div><div class="sl-name">' + esc(s.label) + '</div><div class="sl-blurb">' + esc(s.blurb) + '</div>' +
      (s.meta ? '<div class="sl-meta">' + esc(s.meta) + '</div>' : '') + '</div>' +
      '<div class="sl-num">' + String(i + 1).padStart(2, "0") + '</div></div>';
  }).join("");
  if (!scopeHTML) {
    scopeHTML = '<p style="color:var(--ink-soft)">Scope to be finalized with the client.</p>';
  }
  if ((p.services || []).indexOf("unsure") > -1) {
    scopeHTML += '<p style="margin-top:1rem;color:var(--ink-soft);font-style:italic;">The client flagged they aren\'t sure which services fit best — this proposal includes Tulong\'s recommended starting point.</p>';
  }

  var compareRows = ["Starting price"].map(function (label) {
    return '<tr><th>' + label + '</th>' + TIER_ORDER.map(function (key) {
      var t = TIERS[key];
      return '<td class="' + (key === p.tier ? "is-current" : "") + '">' + esc(fmtMoney(t.price) + "/mo") + '</td>';
    }).join("") + '</tr>';
  }).join("") + '<tr><th>Best for</th>' + TIER_ORDER.map(function (key) {
    return '<td class="' + (key === p.tier ? "is-current" : "") + '">' + esc(TIERS[key].bestFor) + '</td>';
  }).join("") + '</tr>';
  var compareHead = '<tr><th></th>' + TIER_ORDER.map(function (key) { return '<th class="' + (key === p.tier ? "is-current" : "") + '">' + esc(TIERS[key].name) + '</th>'; }).join("") + '</tr>';

  var timeline = (p.timeline && p.timeline.length ? p.timeline : DEFAULT_TIMELINE);
  var tlHTML = timeline.map(function (t) {
    return '<div class="tl-item"><div class="tl-marker"><div class="tl-dot"></div><div class="tl-bar"></div></div>' +
      '<div class="tl-content"><div class="tl-phase">' + esc(t.phase) + '</div><div class="tl-duration">' + esc(t.duration) + '</div></div></div>';
  }).join("");

  var projectHTML = "";
  if (p.project && p.project.label) {
    projectHTML = '<div class="phase-box"><div class="pb-top"><div><div class="pb-label">Phase 1 · Project-based</div><div class="pb-name">' + esc(p.project.label) + '</div></div>' +
      '<div class="pb-price">' + fmtMoney(p.project.amount) + ' fixed</div></div></div>';
  }

  return '' +
    '<article class="doc">' +
    '<div class="doc-hero">' + waveSvg() +
    '<div class="doc-hero-content">' +
    '<div class="brand">tulong<span class="dot"></span></div>' +
    '<span class="doc-eyebrow">Cultural Intelligence Managed Services Proposal</span>' +
    '<h1>' + esc(p.client.company || "Managed Services Proposal") + '</h1>' +
    '<div class="doc-hero-meta">' +
    '<div><div class="k">Prepared for</div><div class="v">' + esc(p.client.contact || "—") + (p.client.sponsor ? ('<br>' + esc(p.client.sponsor)) : '') + '</div></div>' +
    '<div><div class="k">Prepared by</div><div class="v">' + esc(p.rep.name || "Tulong Team") + '</div></div>' +
    '<div><div class="k">Date</div><div class="v">' + esc(fmtDate(p.createdAt)) + '</div></div>' +
    '</div></div></div>' +
    '<div class="doc-inner">' +

    '<div class="doc-section"><p class="doc-greeting">' + esc(p.greeting || defaultGreeting(p.rep.name, p.client.contact, p.client.company)) + '</p></div>' +

    '<div class="doc-section"><span class="doc-eyebrow">01 — Who</span><h2>The client</h2>' +
    '<div class="brief-card"><span class="brief-tag">From the client brief</span>' +
    '<div class="brief-row"><span class="q">Organization</span><span class="a">' + esc(p.client.company || "—") + '</span></div>' +
    (p.client.industry ? '<div class="brief-row"><span class="q">Industry / sector</span><span class="a">' + esc(p.client.industry) + '</span></div>' : '') +
    (p.client.sponsor ? '<div class="brief-row"><span class="q">Executive sponsor</span><span class="a">' + esc(p.client.sponsor) + '</span></div>' : '') +
    '<div class="brief-row"><span class="q">Primary contact</span><span class="a">' + esc(p.client.contact || "—") + (p.client.email ? (' · ' + esc(p.client.email)) : '') + '</span></div>' +
    '</div></div>' +

    '<div class="doc-section"><span class="doc-eyebrow">02 — What</span><h2>Services requested</h2>' +
    '<div class="brief-card"><span class="brief-tag">From the client brief</span><ul class="brief-checklist">' + svcChecklist + '</ul>' +
    (p.serviceNotes ? '<div class="scope-note">' + esc(p.serviceNotes) + '</div>' : '') +
    '</div>' +
    '<h3 style="font-size:1.05rem;margin:1.3rem 0 .5rem;">Recommended scope of work</h3>' + scopeHTML +
    '</div>' +

    (p.markets || p.communities ? '<div class="doc-section"><span class="doc-eyebrow">03 — Where</span><h2>Markets &amp; communities</h2>' +
      '<div class="brief-card"><span class="brief-tag">From the client brief</span>' +
      (p.markets ? '<div class="brief-row"><span class="q">Geographic markets in scope</span><span class="a">' + esc(p.markets) + '</span></div>' : '') +
      (p.communities ? '<div class="brief-row"><span class="q">Cultural / language communities</span><span class="a">' + esc(p.communities) + '</span></div>' : '') +
      '</div></div>' : '') +

    (p.trigger || challenges.length ? '<div class="doc-section"><span class="doc-eyebrow">04 — Why</span><h2>Why now</h2>' +
      '<div class="brief-card"><span class="brief-tag">From the client brief</span>' +
      (p.trigger ? '<div class="brief-row"><span class="q">What triggered this engagement?</span><span class="a">' + esc(p.trigger) + '</span></div>' : '') +
      (p.problem ? '<div class="brief-row"><span class="q">Problem to solve</span><span class="a">' + esc(p.problem) + '</span></div>' : '') +
      '</div></div>' : '') +

    '<div class="doc-section"><span class="doc-eyebrow">05 — When</span><h2>Timing &amp; investment</h2>' +
    (p.idealStart || p.statedDuration || p.statedBudget ? '<div class="brief-card" style="margin-bottom:1.3rem;"><span class="brief-tag">From the client brief</span>' +
      (p.idealStart ? '<div class="brief-row"><span class="q">Ideal start date</span><span class="a">' + esc(p.idealStart) + '</span></div>' : '') +
      (p.statedDuration ? '<div class="brief-row"><span class="q">Engagement duration</span><span class="a">' + esc(p.statedDuration) + '</span></div>' : '') +
      (p.statedBudget ? '<div class="brief-row"><span class="q">Budget range</span><span class="a">' + esc(p.statedBudget) + '</span></div>' : '') +
      '</div>' : '') +
    '<h3 style="font-size:1.05rem;margin-bottom:.8rem;">Our recommendation</h3>' +
    projectHTML +
    '<div class="pricing-hero"><div class="ph-top"><span class="ph-name">' + esc(tier.name) + '</span><span class="ph-price">' + fmtMoney(retainer) + '<small> /mo</small></span></div>' +
    '<p class="ph-tag">' + esc(tier.tagline) + '</p>' +
    '<ul class="bullet-list">' + tier.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join("") + '</ul>' +
    '<div class="ph-best">Best for: ' + esc(tier.bestFor) + '</div></div>' +
    '<div class="compare-wrap"><table class="compare-table"><thead>' + compareHead + '</thead><tbody>' + compareRows + '</tbody></table></div>' +
    (p.pricingNotes ? '<div class="pricing-notes">' + esc(p.pricingNotes) + '</div>' : '') +
    '<h3 style="font-size:1.05rem;margin:1.5rem 0 .8rem;">Timeline</h3><div class="tl-wrap">' + tlHTML + '</div>' +
    '</div>' +

    '<div class="doc-section"><span class="doc-eyebrow">Why Tulong</span><h2>Built by practitioners, powered by AI</h2>' +
    '<p class="why-copy">' + esc(p.whyTulong || DEFAULT_WHY) + '</p>' +
    '<div class="stat-row"><div class="stat"><b>$40M+</b><span>Campaign spend optimized</span></div>' +
    '<div class="stat"><b>20+ Years</b><span>Practitioner expertise</span></div>' +
    '<div class="stat"><b>2,000+</b><span>Publishers onboarded</span></div></div>' +
    '<p class="trust-strip"><b>Trusted by teams like</b> Enbridge, Meridian Credit Union, Subaru, and BDC.</p>' +
    '</div>' +

    '<div class="doc-signoff"><div class="rep">' + esc(p.rep.name || "Tulong Team") + '<small>' + esc(p.rep.title || "") + (p.rep.email ? (" · " + esc(p.rep.email)) : "") + '</small></div>' +
    '<div class="stamp">Tulong<br>Cultural Intelligence AI</div></div>' +
    '</div>' +
    '</article>';
}
