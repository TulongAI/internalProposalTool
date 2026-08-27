/* Tulong Proposal Desk — client-side app logic.
 *
 * Ported from the original single-file artifact. Persistence now goes
 * through /api/proposals (backed by Vercel KV) instead of the artifact
 * platform's self-publish capability, and the greeting / "why Tulong"
 * copy can optionally be drafted by Claude via /api/claude.
 */

/* ---------------- static reference data ---------------- */
var SERVICES = {
  audit: { label: "Cultural Audit Services", blurb: "A gap analysis of existing campaigns and messaging, a cultural risk scorecard, and a prioritized action roadmap.", meta: "Timeline: 4–6 weeks", core: true },
  sentiment: { label: "Cultural Sentiment & Analytics", blurb: "Real-time multilingual sentiment tracking across 20+ language groups, with monthly intelligence reports and emerging-shift alerts.", meta: "Cadence: ongoing monthly", core: true },
  strategy: { label: "Multicultural Business Strategy", blurb: "Go-to-market strategy, workshop facilitation, and executive advisory grounded in The Multicultural Mindset framework.", meta: "Format: workshop series, retainer, or project", core: true },
  insights: { label: "Cultural Insights & Analytics", blurb: "Tulong's cultural intelligence layer applied to a client's own CRM and first-party data to surface the multicultural opportunity already inside their customer base.", meta: "Engagement: 6–10 weeks", core: true },
  industry: { label: "Cross-Cultural Industry Intelligence", blurb: "Sector-specific market sizing, regulatory considerations, and competitive benchmarking for regulated, high-stakes industries.", meta: "", core: true },
  workshops: { label: "Workshops and Technical Training", blurb: "Hands-on team workshops and technical enablement sessions for marketing and leadership teams.", meta: "", core: false },
  monitoring: { label: "Ongoing Monitoring and Reporting", blurb: "Continuous tracking and scheduled reporting layered on top of any active engagement.", meta: "", core: false },
  unsure: { label: "Not sure, advise me", blurb: "Client isn't sure yet which services fit — flagged for a Tulong advisory recommendation.", meta: "", core: false }
};
var SERVICE_ORDER = ["audit", "sentiment", "strategy", "insights", "industry", "workshops", "monitoring", "unsure"];

var TIERS = {
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
var TIER_ORDER = ["essentials", "growth", "enterprise"];

var PROJECT_RATES = {
  audit_single: { label: "Cultural Audit — single market", price: 12500 },
  audit_multi: { label: "Cultural Audit — multi-market (up to 5)", price: 28500 },
  insights_study: { label: "Cultural Insights Research Study", price: 45000 },
  workshop_half: { label: "Strategy Workshop — half-day", price: 7500 },
  workshop_full: { label: "Strategy Workshop — full-day", price: 14000 },
  speaking: { label: "Executive Speaking Engagement", price: 25000 },
  keynote_bundle: { label: "Keynote + Workshop Bundle", price: 18500 },
  custom_research: { label: "Custom Research (per segment)", price: 20000 }
};
var PROJECT_ORDER = ["audit_single", "audit_multi", "insights_study", "workshop_half", "workshop_full", "speaking", "keynote_bundle", "custom_research"];

var DEFAULT_TIMELINE = [
  { phase: "Discovery & Brief Review", duration: "Weeks 1–2" },
  { phase: "Cultural Intelligence Audit / Baseline", duration: "Weeks 3–6" },
  { phase: "Strategy & Roadmap Delivery", duration: "Weeks 7–8" },
  { phase: "Ongoing Managed Services Begins", duration: "Month 3 onward" }
];

var DEFAULT_WHY = "Tulong is a Toronto-based cultural intelligence AI company founded by Joycelyn David — a 20+ year multicultural marketing veteran, bestselling author of The Multicultural Mindset, and three-time Globe and Mail Canada's Top Growing Companies honouree. Our models are built on two decades of real-world multicultural campaign data, not scraped from the internet — backed by a FedDev Ontario–funded regional AI initiative and a ventureLAB portfolio company. We encode practitioner knowledge into AI. We don't sell theory.";

function fmtMoney(n) { n = Number(n) || 0; return "$" + n.toLocaleString("en-US"); }
function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return ""; } }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function linesToBullets(text) { return String(text || "").split("\n").map(function (l) { return l.replace(/^[-–*\s]+/, "").trim(); }).filter(Boolean); }
function uid() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function firstName(full) { return String(full || "").trim().split(/\s+/)[0] || ""; }

function defaultGreeting(repName, contact, company) {
  var contactFirst = firstName(contact) || "there";
  var co = company || "your team";
  return "Hi " + contactFirst + ",\n\nThanks for the chance to put together a plan for " + co + ". Based on what you've shared, we've outlined a cultural intelligence approach below — the scope, the team, and the investment — so you can see exactly what working with Tulong would look like.\n\n— " + (repName || "The Tulong Team");
}

export function mountProposalApp() {
  if (typeof window === "undefined" || window.__tulongProposalAppMounted) return;
  window.__tulongProposalAppMounted = true;

  /* ---------------- state ---------------- */
  var state = { proposals: [] };
  var view = { mode: "list", id: null };
  var draftTimeline = [];
  var greetingDirty = false;
  var pendingDeleteId = null;
  var loaded = false;

  /* ---------------- theme ---------------- */
  var THEME_KEY = "tulong-proposal-theme";
  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function setStoredTheme(choice) {
    try {
      if (choice === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, choice);
    } catch (e) { /* storage unavailable — theme still applies for this view */ }
  }
  function applyTheme(choice) {
    if (choice === "light" || choice === "dark") document.documentElement.setAttribute("data-theme", choice);
    else document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll(".theme-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-theme-choice") === choice);
    });
  }
  function initTheme() {
    applyTheme(getStoredTheme() || "auto");
    document.querySelectorAll(".theme-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-theme-choice");
        applyTheme(choice);
        setStoredTheme(choice);
      });
    });
  }
  initTheme();

  /* ---------------- status + persistence (Vercel KV via /api/proposals) ---------------- */
  function setStatus(text, detail, off) {
    var textEl = document.getElementById("status-text");
    var detailEl = document.getElementById("status-detail");
    var dotEl = document.getElementById("status-dot");
    if (textEl) textEl.textContent = text;
    if (detailEl) detailEl.textContent = detail || "";
    if (dotEl) dotEl.classList.toggle("is-off", !!off);
  }
  setStatus("Loading proposals…", "");

  function loadInitial() {
    fetch("/api/proposals")
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed (" + res.status + ")");
        return res.json();
      })
      .then(function (data) {
        state = { proposals: Array.isArray(data && data.proposals) ? data.proposals : [] };
        loaded = true;
        setStatus("Connected", "Changes save to the shared database.");
        render();
      })
      .catch(function (err) {
        loaded = true;
        setStatus("Load failed", (err && err.message) || "Could not reach the server — try refreshing.", true);
        render();
      });
  }

  // `state` is updated optimistically by the caller before persist() is
  // invoked, so the UI never has to wait on this round-trip to reflect a
  // change — persist() only reports whether the save actually landed.
  function persist(nextState) {
    setStatus("Saving…", "");
    fetch("/api/proposals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextState)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Save failed (" + res.status + ")");
        setStatus("Connected", "Changes save to the shared database.");
      })
      .catch(function (err) {
        setStatus("Save failed", (err && err.message) || "Something went wrong — your change may not be saved.", true);
      });
  }

  /* ---------------- AI draft assist (via /api/claude) ---------------- */
  function collectBriefForAI() {
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
    var services = Array.prototype.map.call(document.querySelectorAll('input[name="service"]:checked'), function (cb) { return cb.value; });
    return {
      repName: val("f-rep-name"),
      company: val("f-client-company"),
      industry: val("f-client-industry"),
      contact: val("f-client-contact"),
      services: services.map(function (k) { return SERVICES[k] ? SERVICES[k].label : k; }),
      markets: val("f-markets"),
      communities: val("f-communities"),
      trigger: val("f-trigger"),
      problem: val("f-problem")
    };
  }

  function draftWithAI(kind) {
    var btnId = kind === "why" ? "ai-draft-why" : "ai-draft-greeting";
    var fieldId = kind === "why" ? "f-why" : "f-greeting";
    var btn = document.getElementById(btnId);
    var field = document.getElementById(fieldId);
    if (!btn || !field) return;
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Drafting…";
    fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: kind, brief: collectBriefForAI() })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error((result.data && result.data.error) || "Draft failed");
        if (result.data.text) {
          field.value = result.data.text;
          if (kind === "greeting") greetingDirty = true;
        }
      })
      .catch(function (err) {
        window.alert("Couldn't generate a draft: " + ((err && err.message) || "unknown error"));
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = originalLabel;
      });
  }

  /* ---------------- rendering ---------------- */
  var app = document.getElementById("app");

  function render() {
    if (!app) return;
    if (!loaded) { app.innerHTML = '<p style="color:var(--ink-soft)">Loading proposals…</p>'; return; }
    if (view.mode === "form") app.innerHTML = renderForm(view.id);
    else if (view.mode === "doc") app.innerHTML = renderDoc(view.id);
    else app.innerHTML = renderList();
    bind();
    updateNav();
  }

  function updateNav() {
    var listBtn = document.querySelector('[data-nav="list"]');
    if (listBtn) listBtn.classList.toggle("is-active", view.mode === "list");
  }

  function renderList() {
    var items = state.proposals.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });
    var body;
    if (!items.length) {
      body = '<div class="empty"><h2>No proposals yet</h2><p>Turn a client brief into a scoped, priced Tulong cultural intelligence proposal in a few minutes.</p>' +
        '<button class="btn is-primary" data-nav="new" type="button">+ New Proposal</button></div>';
    } else {
      body = '<div class="card-grid">' + items.map(function (p) {
        var tier = TIERS[p.tier] || TIERS.essentials;
        return '<button class="p-card" data-open="' + esc(p.id) + '" type="button">' +
          '<div class="p-card-top"><span class="p-card-client">' + esc(p.client.company || "Untitled client") + '</span>' +
          '<span class="tier-chip ' + esc(p.tier) + '">' + esc(tier.name) + '</span></div>' +
          '<div class="p-card-meta">For <strong>' + esc(p.client.contact || "—") + '</strong> · Prepared by <strong>' + esc(p.rep.name || "—") + '</strong></div>' +
          '<div class="p-card-foot">' + esc(fmtDate(p.updatedAt || p.createdAt)) + '</div>' +
          '</button>';
      }).join("") + '</div>';
    }
    return '<div class="list-head"><div><span class="eyebrow">' + items.length + ' proposal' + (items.length === 1 ? "" : "s") + '</span><h1>Proposals</h1></div>' +
      '<button class="btn is-cta" data-nav="new" type="button">+ New Proposal</button></div>' + body;
  }

  function fieldsForDraft(existing) {
    if (existing) {
      draftTimeline = (existing.timeline && existing.timeline.length ? existing.timeline : DEFAULT_TIMELINE).map(function (t) { return { phase: t.phase, duration: t.duration }; });
      greetingDirty = !!existing.greeting;
      return existing;
    }
    greetingDirty = false;
    draftTimeline = DEFAULT_TIMELINE.map(function (t) { return { phase: t.phase, duration: t.duration }; });
    return {
      id: null, rep: { name: "", title: "Account Executive", email: "" },
      client: { company: "", industry: "", sponsor: "", contact: "", email: "" },
      services: [], serviceNotes: "",
      markets: "", communities: "",
      trigger: "", problem: "",
      idealStart: "", statedDuration: "", statedBudget: "",
      tier: "growth", project: null, customRetainer: "", pricingNotes: "",
      greeting: "", whyTulong: DEFAULT_WHY
    };
  }

  function renderForm(id) {
    var existing = id ? state.proposals.find(function (p) { return p.id === id; }) : null;
    var d = fieldsForDraft(existing);
    var greeting = d.greeting || defaultGreeting(d.rep.name, d.client.contact, d.client.company);

    var checks = SERVICE_ORDER.map(function (key) {
      var s = SERVICES[key];
      var checked = d.services.indexOf(key) > -1 ? " checked" : "";
      return '<label class="check-item"><input type="checkbox" name="service" value="' + key + '"' + checked + '>' +
        '<span><span class="clabel">' + esc(s.label) + '</span><span class="cblurb">' + esc(s.blurb) + '</span></span></label>';
    }).join("");

    var tierCards = TIER_ORDER.map(function (key) {
      var t = TIERS[key];
      var checked = d.tier === key ? " checked" : "";
      return '<label class="tier-pick">' + (t.badge ? '<span class="tp-badge">' + esc(t.badge) + '</span>' : '') +
        '<input type="radio" name="tier" value="' + key + '"' + checked + '>' +
        '<span class="tp-name">' + esc(t.name) + '</span><span class="tp-price">' + fmtMoney(t.price) + '/mo starting</span>' +
        '<span class="tp-tag">' + esc(t.tagline) + '</span></label>';
    }).join("");

    var projectOptions = '<option value="none">No project phase — retainer only</option>' +
      PROJECT_ORDER.map(function (key) {
        var r = PROJECT_RATES[key];
        var sel = (d.project && d.project.key === key) ? " selected" : "";
        return '<option value="' + key + '"' + sel + '>' + esc(r.label) + ' (' + fmtMoney(r.price) + ')</option>';
      }).join("") +
      '<option value="custom"' + (d.project && d.project.key === "custom" ? " selected" : "") + '>Custom project fee</option>';
    var projSelectedKey = d.project ? d.project.key : "none";
    var projLabel = d.project ? d.project.label : "";
    var projAmount = d.project ? d.project.amount : "";

    return '' +
      '<div class="form-shell">' +
      '<div class="form-head"><span class="eyebrow">' + (existing ? "Editing proposal" : "New proposal") + '</span>' +
      '<h1>Build the proposal</h1><p>Mirrors the client brief — Who, What, Where, Why, When — so nothing gets lost between the conversation and the proposal.</p></div>' +

      '<form id="proposal-form">' +

      '<details class="fsection" open><summary><span class="fkey">Prepared by</span>Your details<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="row2">' +
      '<div class="field"><label for="f-rep-name">Your name</label><input id="f-rep-name" type="text" value="' + esc(d.rep.name) + '" required></div>' +
      '<div class="field"><label for="f-rep-title">Title</label><input id="f-rep-title" type="text" value="' + esc(d.rep.title) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="f-rep-email">Your email</label><input id="f-rep-email" type="email" value="' + esc(d.rep.email) + '"></div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">Who</span>The client<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="row2">' +
      '<div class="field"><label for="f-client-company">Organization name</label><input id="f-client-company" type="text" value="' + esc(d.client.company) + '" required></div>' +
      '<div class="field"><label for="f-client-industry">Industry / sector</label><input id="f-client-industry" type="text" value="' + esc(d.client.industry) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="f-client-sponsor">Executive sponsor <span class="hint">optional</span></label><input id="f-client-sponsor" type="text" value="' + esc(d.client.sponsor) + '" placeholder="e.g. Director of Marketing"></div>' +
      '<div class="row2">' +
      '<div class="field"><label for="f-client-contact">Primary contact</label><input id="f-client-contact" type="text" value="' + esc(d.client.contact) + '" required></div>' +
      '<div class="field"><label for="f-client-email">Contact email</label><input id="f-client-email" type="email" value="' + esc(d.client.email) + '"></div>' +
      '</div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">What</span>Services needed<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<fieldset><legend class="visually-hidden">Services needed</legend><div class="check-grid">' + checks + '</div></fieldset>' +
      '<div class="field"><label for="f-service-notes">Notes on scope <span class="hint">optional</span></label><textarea id="f-service-notes" rows="3">' + esc(d.serviceNotes) + '</textarea></div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">Where</span>Markets &amp; communities<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="field"><label for="f-markets">Geographic markets in scope</label><textarea id="f-markets" rows="2">' + esc(d.markets) + '</textarea></div>' +
      '<div class="field"><label for="f-communities">Cultural / language communities to focus on</label><textarea id="f-communities" rows="2">' + esc(d.communities) + '</textarea></div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">Why</span>The trigger<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="field"><label for="f-trigger">What triggered this engagement?</label><textarea id="f-trigger" rows="2">' + esc(d.trigger) + '</textarea></div>' +
      '<div class="field"><label for="f-problem">What problem are they trying to solve?</label><textarea id="f-problem" rows="3">' + esc(d.problem) + '</textarea></div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">When</span>Timing &amp; stated budget<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="row2">' +
      '<div class="field"><label for="f-ideal-start">Ideal start date</label><input id="f-ideal-start" type="text" value="' + esc(d.idealStart) + '" placeholder="e.g. Immediate"></div>' +
      '<div class="field"><label for="f-stated-duration">Engagement duration <span class="hint">as the client stated it</span></label><input id="f-stated-duration" type="text" value="' + esc(d.statedDuration) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="f-stated-budget">Budget range <span class="hint">as the client stated it</span></label><input id="f-stated-budget" type="text" value="' + esc(d.statedBudget) + '"></div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">Recommend</span>Package &amp; pricing<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="tier-cards">' + tierCards + '</div>' +
      '<div class="field"><label for="f-project-phase">Add a project-based phase <span class="hint">optional — e.g. a fixed-fee audit before the retainer starts</span></label>' +
      '<select id="f-project-phase">' + projectOptions + '</select></div>' +
      '<div class="row2">' +
      '<div class="field"><label for="f-project-label">Project phase name</label><input id="f-project-label" type="text" value="' + esc(projLabel) + '" ' + (projSelectedKey === "none" ? "disabled" : "") + '></div>' +
      '<div class="field"><label for="f-project-amount">Project phase fee</label><input id="f-project-amount" type="number" min="0" step="100" value="' + esc(projAmount) + '" ' + (projSelectedKey === "none" ? "disabled" : "") + '></div>' +
      '</div>' +
      '<div class="row2">' +
      '<div class="field"><label for="f-custom-retainer">Custom monthly quote <span class="hint">optional override</span></label><input id="f-custom-retainer" type="number" min="0" step="50" value="' + esc(d.customRetainer) + '" placeholder="e.g. 9500"></div>' +
      '<div class="field"><label for="f-pricing-notes">Pricing notes <span class="hint">optional</span></label><input id="f-pricing-notes" type="text" value="' + esc(d.pricingNotes) + '" placeholder="e.g. 6-month minimum term"></div>' +
      '</div>' +
      '</div></details>' +

      '<details class="fsection" open><summary><span class="fkey">Timeline</span>Phased plan<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body"><div class="tl-rows" id="tl-rows">' + renderTimelineRows() + '</div>' +
      '<button class="btn is-ghost" type="button" id="tl-add">+ Add phase</button></div></details>' +

      '<details class="fsection"><summary><span class="fkey">Personalize</span>Greeting &amp; why Tulong<span class="fcaret">›</span></summary>' +
      '<div class="fsection-body">' +
      '<div class="field"><div class="field-actions"><button class="btn is-ghost" type="button" id="ai-draft-greeting">✨ Draft with AI</button></div><label for="f-greeting">Greeting <span class="hint">shown at the top of the proposal</span></label><textarea id="f-greeting" rows="5">' + esc(greeting) + '</textarea></div>' +
      '<div class="field"><div class="field-actions"><button class="btn is-ghost" type="button" id="ai-draft-why">✨ Draft with AI</button></div><label for="f-why">Why Tulong <span class="hint">credibility section</span></label><textarea id="f-why" rows="5">' + esc(d.whyTulong) + '</textarea></div>' +
      '</div></details>' +

      '<div class="form-actions">' +
      '<button class="btn is-primary" type="submit">' + (existing ? "Save changes" : "Generate proposal") + '</button>' +
      '<button class="btn" type="button" data-nav="list">Cancel</button>' +
      '</div>' +
      '<input type="hidden" id="f-id" value="' + esc(existing ? existing.id : "") + '">' +
      '<input type="hidden" id="f-created" value="' + esc(existing ? existing.createdAt : "") + '">' +
      '</form></div>';
  }

  function renderTimelineRows() {
    return draftTimeline.map(function (row, i) {
      return '<div class="tl-row" data-idx="' + i + '">' +
        '<input type="text" class="tl-phase-input" value="' + esc(row.phase) + '" placeholder="Phase name">' +
        '<input type="text" class="tl-duration-input" value="' + esc(row.duration) + '" placeholder="e.g. Weeks 1–2">' +
        '<button class="btn is-ghost" type="button" data-tl-remove="' + i + '" title="Remove phase">✕</button>' +
        '</div>';
    }).join("");
  }

  function waveSvg() {
    return '<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<path d="M -20 220 C 160 260, 300 190, 420 140 S 640 90, 820 120" fill="none" stroke="#EC1845" stroke-width="1.2" opacity="0.55"/>' +
      '<path d="M -20 250 C 160 290, 300 220, 420 170 S 640 120, 820 150" fill="none" stroke="#EC1845" stroke-width="1" opacity="0.4"/>' +
      '<path d="M -20 190 C 160 230, 300 160, 420 110 S 640 60, 820 90" fill="none" stroke="#EC1845" stroke-width="1" opacity="0.35"/>' +
      '</svg>';
  }

  function renderDoc(id) {
    var p = state.proposals.find(function (pr) { return pr.id === id; });
    if (!p) { view.mode = "list"; return renderList(); }
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
      '<div class="doc-topbar"><button class="btn" type="button" data-nav="list">‹ All proposals</button>' +
      '<div class="doc-actions">' +
      '<button class="btn" type="button" data-print="1">Print / Save as PDF</button>' +
      '<button class="btn" type="button" data-edit="' + esc(p.id) + '">Edit</button>' +
      deleteControlHTML(p.id) +
      '</div></div>' +
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

  function deleteControlHTML(id) {
    if (pendingDeleteId === id) {
      return '<span class="del-confirm">Delete this proposal? <button class="btn is-danger" type="button" data-confirm-delete="' + esc(id) + '">Confirm</button><button class="btn is-ghost" type="button" data-cancel-delete="1">Cancel</button></span>';
    }
    return '<button class="btn is-danger" type="button" data-delete="' + esc(id) + '">Delete</button>';
  }

  /* ---------------- events ---------------- */
  function bind() {
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      el.addEventListener("click", function () {
        var target = el.getAttribute("data-nav");
        if (target === "new") { view = { mode: "form", id: null }; }
        else { view = { mode: "list", id: null }; }
        pendingDeleteId = null;
        render();
      });
    });

    document.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function () { view = { mode: "doc", id: el.getAttribute("data-open") }; render(); window.scrollTo(0, 0); });
    });

    document.querySelectorAll("[data-edit]").forEach(function (el) {
      el.addEventListener("click", function () { view = { mode: "form", id: el.getAttribute("data-edit") }; render(); window.scrollTo(0, 0); });
    });

    document.querySelectorAll("[data-print]").forEach(function (el) {
      el.addEventListener("click", function () { window.print(); });
    });

    document.querySelectorAll("[data-delete]").forEach(function (el) {
      el.addEventListener("click", function () { pendingDeleteId = el.getAttribute("data-delete"); render(); });
    });
    document.querySelectorAll("[data-cancel-delete]").forEach(function (el) {
      el.addEventListener("click", function () { pendingDeleteId = null; render(); });
    });
    document.querySelectorAll("[data-confirm-delete]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-confirm-delete");
        var next = { proposals: state.proposals.filter(function (p) { return p.id !== id; }) };
        state = next;
        pendingDeleteId = null;
        view = { mode: "list", id: null };
        render();
        persist(next);
      });
    });

    var addBtn = document.getElementById("tl-add");
    if (addBtn) addBtn.addEventListener("click", function () {
      syncTimelineFromDOM();
      draftTimeline.push({ phase: "", duration: "" });
      document.getElementById("tl-rows").innerHTML = renderTimelineRows();
      bindTimelineRows();
    });
    bindTimelineRows();

    var projSelect = document.getElementById("f-project-phase");
    if (projSelect) {
      projSelect.addEventListener("change", function () {
        var key = projSelect.value;
        var labelEl = document.getElementById("f-project-label");
        var amountEl = document.getElementById("f-project-amount");
        if (key === "none") {
          labelEl.value = ""; amountEl.value = "";
          labelEl.disabled = true; amountEl.disabled = true;
        } else if (key === "custom") {
          labelEl.disabled = false; amountEl.disabled = false;
          labelEl.value = ""; amountEl.value = "";
          labelEl.focus();
        } else {
          var r = PROJECT_RATES[key];
          labelEl.disabled = false; amountEl.disabled = false;
          labelEl.value = r.label; amountEl.value = r.price;
        }
      });
    }

    var greetingEl = document.getElementById("f-greeting");
    if (greetingEl) {
      greetingEl.addEventListener("input", function () { greetingDirty = true; });
      ["f-rep-name", "f-client-contact", "f-client-company"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", function () {
          if (greetingDirty) return;
          var repName = document.getElementById("f-rep-name").value;
          var contact = document.getElementById("f-client-contact").value;
          var company = document.getElementById("f-client-company").value;
          greetingEl.value = defaultGreeting(repName, contact, company);
        });
      });
    }

    var aiGreetingBtn = document.getElementById("ai-draft-greeting");
    if (aiGreetingBtn) aiGreetingBtn.addEventListener("click", function () { draftWithAI("greeting"); });
    var aiWhyBtn = document.getElementById("ai-draft-why");
    if (aiWhyBtn) aiWhyBtn.addEventListener("click", function () { draftWithAI("why"); });

    var form = document.getElementById("proposal-form");
    if (form) form.addEventListener("submit", onSubmit);
  }

  function bindTimelineRows() {
    document.querySelectorAll("[data-tl-remove]").forEach(function (el) {
      el.addEventListener("click", function () {
        syncTimelineFromDOM();
        var idx = Number(el.getAttribute("data-tl-remove"));
        draftTimeline.splice(idx, 1);
        document.getElementById("tl-rows").innerHTML = renderTimelineRows();
        bindTimelineRows();
      });
    });
  }

  function syncTimelineFromDOM() {
    var rows = document.querySelectorAll("#tl-rows .tl-row");
    draftTimeline = Array.prototype.map.call(rows, function (row) {
      return { phase: row.querySelector(".tl-phase-input").value, duration: row.querySelector(".tl-duration-input").value };
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    syncTimelineFromDOM();
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
    var services = Array.prototype.map.call(document.querySelectorAll('input[name="service"]:checked'), function (cb) { return cb.value; });

    if (!val("f-rep-name") || !val("f-client-company") || !val("f-client-contact")) {
      window.alert("Please fill in your name, the client's organization, and the primary contact.");
      return;
    }

    var projKey = val("f-project-phase") || "none";
    var project = null;
    if (projKey !== "none" && val("f-project-label")) {
      project = { key: projKey, label: val("f-project-label"), amount: Number(val("f-project-amount")) || 0 };
    }

    var existingId = val("f-id");
    var now = new Date().toISOString();
    var record = {
      id: existingId || uid(),
      createdAt: val("f-created") || now,
      updatedAt: now,
      rep: { name: val("f-rep-name"), title: val("f-rep-title"), email: val("f-rep-email") },
      client: { company: val("f-client-company"), industry: val("f-client-industry"), sponsor: val("f-client-sponsor"), contact: val("f-client-contact"), email: val("f-client-email") },
      services: services,
      serviceNotes: val("f-service-notes"),
      markets: val("f-markets"),
      communities: val("f-communities"),
      trigger: val("f-trigger"),
      problem: val("f-problem"),
      idealStart: val("f-ideal-start"),
      statedDuration: val("f-stated-duration"),
      statedBudget: val("f-stated-budget"),
      tier: (document.querySelector('input[name="tier"]:checked') || {}).value || "growth",
      project: project,
      customRetainer: val("f-custom-retainer"),
      pricingNotes: val("f-pricing-notes"),
      timeline: draftTimeline.filter(function (t) { return t.phase || t.duration; }),
      greeting: val("f-greeting"),
      whyTulong: val("f-why")
    };

    var proposals = state.proposals.filter(function (p) { return p.id !== record.id; });
    proposals.push(record);
    var next = { proposals: proposals };
    state = next;
    view = { mode: "doc", id: record.id };
    render();
    persist(next);
  }

  loadInitial();
}
