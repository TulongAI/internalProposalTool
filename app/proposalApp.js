/* Tulong Proposal Desk — client-side app logic.
 *
 * Ported from the original single-file artifact. Persistence now goes
 * through /api/proposals (backed by Vercel KV) instead of the artifact
 * platform's self-publish capability, and the greeting / "why Tulong"
 * copy can optionally be drafted by Claude via /api/claude.
 */

/* ---------------- shared data + rendering (also used by the public view) ---------------- */
import {
  SERVICES, SERVICE_ORDER,
  TIERS, TIER_ORDER,
  PROJECT_RATES, PROJECT_ORDER,
  DEFAULT_TIMELINE, DEFAULT_WHY,
  fmtMoney, fmtDate, esc, linesToBullets, defaultGreeting, waveSvg,
  assignSlug, clientLinkForProposal,
  renderProposalArticleHTML
} from "../lib/proposalShared.js";

function uid() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

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

  /* ---------------- status + persistence (Supabase via /api/proposals) ---------------- */
  function setStatus(text, detail, off) {
    var textEl = document.getElementById("status-text");
    var detailEl = document.getElementById("status-detail");
    var dotEl = document.getElementById("status-dot");
    if (textEl) textEl.textContent = text;
    if (detailEl) detailEl.textContent = detail || "";
    if (dotEl) dotEl.classList.toggle("is-off", !!off);
  }
  setStatus("Loading proposals…", "");

  // Extracts the API's `{ error }` body on a failed response, falling back
  // to a generic message if the body isn't JSON or doesn't have one — so a
  // real misconfiguration (e.g. Supabase env vars missing) surfaces its
  // actual cause instead of just "Request failed (500)".
  function errorFromResponse(res, fallback) {
    return res.json().then(
      function (data) { return (data && data.error) || fallback; },
      function () { return fallback; }
    );
  }

  function loadInitial() {
    fetch("/api/proposals")
      .then(function (res) {
        if (!res.ok) return errorFromResponse(res, "Request failed (" + res.status + ")").then(function (msg) { throw new Error(msg); });
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
        if (!res.ok) return errorFromResponse(res, "Save failed (" + res.status + ")").then(function (msg) { throw new Error(msg); });
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

  function renderDoc(id) {
    var p = state.proposals.find(function (pr) { return pr.id === id; });
    if (!p) { view.mode = "list"; return renderList(); }

    return '' +
      '<div class="doc-topbar"><button class="btn" type="button" data-nav="list">‹ All proposals</button>' +
      '<div class="doc-actions">' +
      '<button class="btn" type="button" data-print="1">Print / Save as PDF</button>' +
      '<button class="btn" type="button" data-copy-link="' + esc(clientLinkForProposal(p)) + '">Copy Client Link</button>' +
      '<button class="btn" type="button" data-edit="' + esc(p.id) + '">Edit</button>' +
      deleteControlHTML(p.id) +
      '</div></div>' +
      renderProposalArticleHTML(p);
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

    document.querySelectorAll("[data-copy-link]").forEach(function (el) {
      el.addEventListener("click", function () {
        var url = el.getAttribute("data-copy-link");
        var originalLabel = el.textContent;
        function flash(label) {
          el.textContent = label;
          setTimeout(function () { el.textContent = originalLabel; }, 1600);
        }
        var copyPromise = (navigator.clipboard && navigator.clipboard.writeText)
          ? navigator.clipboard.writeText(url)
          : Promise.reject(new Error("Clipboard API unavailable"));
        copyPromise.then(function () {
          flash("Copied!");
        }).catch(function () {
          window.prompt("Copy this link:", url);
        });
      });
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
    var recordId = existingId || uid();
    var companyName = val("f-client-company");
    var record = {
      id: recordId,
      createdAt: val("f-created") || now,
      updatedAt: now,
      // Regenerated on every save so the public client link always exists
      // and always resolves to this client's most recent proposal — see
      // assignSlug() for how same-client saves reuse one slug while
      // different clients that would otherwise collide get disambiguated.
      slug: assignSlug(companyName, recordId, state.proposals),
      rep: { name: val("f-rep-name"), title: val("f-rep-title"), email: val("f-rep-email") },
      client: { company: companyName, industry: val("f-client-industry"), sponsor: val("f-client-sponsor"), contact: val("f-client-contact"), email: val("f-client-email") },
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
