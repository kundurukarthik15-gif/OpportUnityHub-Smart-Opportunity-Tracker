// ============================================
// DASHBOARD JS — OpportUnity Hub
// ============================================

const API_BASE = "http://localhost:8000";

let opportunities     = JSON.parse(JSON.stringify(MOCK_OPPORTUNITIES));
let liveOpportunities = [];   // holds results from the API
let usingLiveData     = false;
let activeTypeFilter  = "all";
let searchQuery       = "";
let sourceFilter      = "";
let deadlineFilter    = "";
let domainFilter      = "general";
let locationFilter    = "all";

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  initGreeting();
  updateStats();
  renderDeadlineTimeline();
  renderCards();
  initSearch();
  loadUserInfo();
  animateCounters();
});

function loadUserInfo() {
  const user = JSON.parse(localStorage.getItem("ohub_user") || "{}");
  const name = user.name || "Student";
  const email = user.email || "student@university.edu";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  document.getElementById("sidebarName").textContent = name;
  document.getElementById("sidebarEmail").textContent = email;
  document.getElementById("sidebarAvatar").textContent = initials;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("greetingText").textContent = `${greeting}, ${name.split(" ")[0]} 👋`;
}

function initGreeting() {}  // handled in loadUserInfo

// ============================================================
// LIVE FETCH — calls the FastAPI backend
// ============================================================

async function fetchLiveOpportunities() {
  const btn   = document.getElementById("liveFetchBtn");
  const icon  = document.getElementById("liveFetchIcon");
  const label = document.getElementById("liveFetchLabel");
  const overlay = document.getElementById("scrapeOverlay");
  const sub   = document.getElementById("scrapeOverlaySub");
  const fill  = document.getElementById("scrapeProgressFill");

  // Disable button
  btn.disabled = true;
  icon.textContent = "⏳";
  label.textContent = "Fetching…";

  // Show overlay
  overlay.style.display = "flex";
  fill.style.width = "0%";
  sub.textContent = "Connecting to scraper engine…";

  // Animate progress bar
  let progress = 0;
  const progressSteps = [
    [15, "🎓 Scraping Internshala…"],
    [35, "💻 Scraping Devpost hackathons…"],
    [55, "🚀 Scraping Unstop…"],
    [75, "🌍 Fetching Remotive jobs…"],
    [90, "🧹 Cleaning & deduplicating…"],
  ];
  let stepIdx = 0;
  const progressInterval = setInterval(() => {
    if (stepIdx < progressSteps.length) {
      const [pct, msg] = progressSteps[stepIdx];
      fill.style.width = pct + "%";
      sub.textContent = msg;
      stepIdx++;
    }
  }, 1200);

  try {
    const filters = {
      type:     document.getElementById("typeFilter").value     || "all",
      domain:   document.getElementById("domainFilter").value   || "general",
      location: document.getElementById("locationFilter").value || "all",
    };

    const resp = await fetch(`${API_BASE}/api/scrape`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(filters),
      signal:  AbortSignal.timeout(60000),  // 60s timeout
    });

    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    const data = await resp.json();

    clearInterval(progressInterval);
    fill.style.width = "100%";
    sub.textContent = `✅ Done! ${data.count} opportunities found.`;

    await new Promise(r => setTimeout(r, 800));

    // Merge live results with mock, preferring live
    const live = (data.opportunities || []).map(o => ({
      ...o,
      saved:   false,
      applied: false,
      logo:    o.organization ? o.organization.charAt(0).toUpperCase() : "?",
    }));

    liveOpportunities = live;
    usingLiveData = true;
    opportunities = [...live, ...MOCK_OPPORTUNITIES].reduce((acc, o) => {
      if (!acc.find(x => x.id === o.id)) acc.push(o);
      return acc;
    }, []);

    updateStats();
    renderDeadlineTimeline();
    renderCards();
    setDataStatusBanner("live", data.count, data.source);
    showToast(`✅ ${data.count} live opportunities loaded!`, "success");

  } catch (err) {
    clearInterval(progressInterval);
    console.error("[fetchLive] Error:", err);

    // Graceful fallback
    const isOffline = err.name === "TypeError" || err.message.includes("fetch");
    sub.textContent = isOffline
      ? "⚠️ Backend offline — using local data"
      : `⚠️ ${err.message}`;
    await new Promise(r => setTimeout(r, 1200));
    setDataStatusBanner("offline");
    showToast("⚠️ Could not reach backend. Using local mock data.", "");
  }

  // Hide overlay & reset button
  overlay.style.display = "none";
  btn.disabled = false;
  icon.textContent = usingLiveData ? "✅" : "🌐";
  label.textContent = usingLiveData ? "Refresh Live" : "Fetch Live Opportunities";
}

function setDataStatusBanner(mode, count = 0, source = "") {
  const dot  = document.getElementById("dsbDot");
  const text = document.getElementById("dsbText");
  const banner = document.getElementById("dataStatusBanner");

  if (mode === "live") {
    dot.style.background = "#22c55e";
    dot.style.boxShadow  = "0 0 6px #22c55e";
    text.innerHTML = source === "cache"
      ? `🟡 Cached live data — <strong>${count}</strong> opportunities (< 5 min old)`
      : `🟢 Live data loaded — <strong>${count}</strong> real opportunities from Internshala, Devpost, Unstop & Remotive`;
    banner.style.borderColor = "rgba(34,197,94,.3)";
  } else if (mode === "offline") {
    dot.style.background = "#f59e0b";
    dot.style.boxShadow  = "0 0 6px #f59e0b";
    text.innerHTML = "🟡 Backend offline — showing <strong>local mock data</strong>. Start <code>start.bat</code> to enable live scraping.";
    banner.style.borderColor = "rgba(245,158,11,.3)";
  }
}

// ============================================================
// STATS + COUNTERS
// ============================================================

function updateStats() {
  const internships = opportunities.filter(o => o.type === "internship");
  const hackathons  = opportunities.filter(o => o.type === "hackathon" || o.type === "job");
  const saved       = opportunities.filter(o => o.saved);
  const applied     = opportunities.filter(o => o.applied);

  document.getElementById("totalCount").textContent      = opportunities.length;
  document.getElementById("internshipCount").textContent = internships.length;
  document.getElementById("hackathonCount").textContent  = hackathons.length;
  document.getElementById("savedCount").textContent      = saved.length;
  document.getElementById("appliedCountSub").textContent = `applied: ${applied.length}`;
}

function animateCounters() {
  const counters = document.querySelectorAll(".stat-card-value");
  counters.forEach(el => {
    const target = parseInt(el.textContent);
    if (isNaN(target)) return;
    let start = 0;
    const step = Math.ceil(target / 20);
    const interval = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = start;
      if (start >= target) clearInterval(interval);
    }, 40);
  });
}

// ============================================================
// DEADLINE TIMELINE
// ============================================================

function renderDeadlineTimeline() {
  const timeline = document.getElementById("deadlineTimeline");
  const groups = [
    { key: "today",    title: "Today",       filter: d => d === 0,           countClass: "today"     },
    { key: "week",     title: "This Week",   filter: d => d > 0 && d <= 7,   countClass: "week"      },
    { key: "twoweeks", title: "Next 2 Weeks",filter: d => d > 7 && d <= 14,  countClass: "two-weeks" },
    { key: "future",   title: "Future",      filter: d => d > 14,            countClass: "future"    },
  ];

  timeline.innerHTML = groups.map(group => {
    const items = opportunities.filter(o => {
      const days = getDaysLeft(o.deadline);
      return group.filter(days);
    });

    const itemsHTML = items.length === 0
      ? `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px 0">Nothing here 🎉</div>`
      : items.slice(0, 3).map(o => {
          const days = getDaysLeft(o.deadline);
          const urgency = getUrgencyBadge(days);
          const org = o.organization || o.company || "Unknown";
          const role = o.role || o.title || "";
          return `
            <div class="dg-item">
              <div class="dg-item-company">${org}</div>
              <div class="dg-item-role">${role}</div>
              <div class="dg-item-badge">${urgency.emoji} ${urgency.label}</div>
            </div>`;
        }).join("");

    return `
      <div class="deadline-group">
        <div class="dg-header">
          <div class="dg-title">${group.title}</div>
          <div class="dg-count ${group.countClass}">${items.length}</div>
        </div>
        <div class="dg-items">${itemsHTML}</div>
      </div>`;
  }).join("");
}

// ============================================================
// FILTERING
// ============================================================

function getFilteredOpportunities() {
  return opportunities.filter(o => {
    const org   = o.organization || o.company || "";
    const role  = o.role || o.title || "";
    const elig  = o.eligibility || o.description || "";
    const loc   = (o.location || "").toLowerCase();

    const matchType = activeTypeFilter === "all" || o.type === activeTypeFilter;
    const matchSearch = !searchQuery ||
      org.toLowerCase().includes(searchQuery) ||
      role.toLowerCase().includes(searchQuery) ||
      elig.toLowerCase().includes(searchQuery);
    const matchSource = !sourceFilter || o.source === sourceFilter;
    const matchDeadline = (() => {
      if (!deadlineFilter) return true;
      const days = getDaysLeft(o.deadline);
      if (deadlineFilter === "today")    return days === 0;
      if (deadlineFilter === "week")     return days >= 0 && days <= 7;
      if (deadlineFilter === "twoweeks") return days >= 0 && days <= 14;
      return true;
    })();
    const matchLocation = (() => {
      if (!locationFilter || locationFilter === "all") return true;
      if (locationFilter === "remote") return loc.includes("remote") || loc.includes("work from home") || loc.includes("wfh");
      if (locationFilter === "onsite") return !loc.includes("remote") && !loc.includes("work from home");
      return true;
    })();

    return matchType && matchSearch && matchSource && matchDeadline && matchLocation;
  });
}

// ============================================================
// CARD RENDERING
// ============================================================

function renderCards() {
  const grid  = document.getElementById("cardsGrid");
  const empty = document.getElementById("emptyState");
  const filtered = getFilteredOpportunities();

  document.getElementById("resultCount").textContent =
    filtered.length === opportunities.length
      ? `${filtered.length} total`
      : `${filtered.length} of ${opportunities.length}`;

  if (filtered.length === 0) {
    grid.style.display  = "none";
    empty.style.display = "block";
    return;
  }

  grid.style.display  = "grid";
  empty.style.display = "none";

  grid.innerHTML = filtered.map((o, i) => buildCard(o, i)).join("");

  grid.querySelectorAll(".opp-card").forEach((card, i) => {
    card.style.opacity   = "0";
    card.style.transform = "translateY(16px)";
    setTimeout(() => {
      card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      card.style.opacity    = "1";
      card.style.transform  = "translateY(0)";
    }, i * 60);
  });
}

function buildCard(o, idx) {
  const days   = getDaysLeft(o.deadline);
  const urgency = getUrgencyBadge(days);
  const type = o.type || "internship";
  const isInternship = type === "internship";
  const isJob = type === "job";
  const accentStart = isInternship ? "var(--accent)" : isJob ? "var(--accent3)" : "var(--accent2)";
  const accentEnd   = isInternship ? "var(--accent2)" : isJob ? "var(--accent)" : "var(--accent3)";

  const org  = o.organization || o.company || "Unknown";
  const role = o.role || o.title || "Opportunity";
  const logo = o.logo || (org ? org.charAt(0).toUpperCase() : "?");
  const link = o.apply_link || o.applyLink || "#";
  const typeLabel = isInternship ? "Internship" : isJob ? "Job" : "Hackathon";
  const source = o.source || "unknown";
  const isLive = liveOpportunities.some(l => l.id === o.id);

  return `
    <div class="opp-card${isLive ? ' live-card' : ''}" style="--card-accent-start:${accentStart};--card-accent-end:${accentEnd}" data-id="${o.id}">
      <div class="opp-card-header">
        <div class="opp-card-badges">
          <span class="badge badge-${type}">${typeLabel}</span>
          ${o.verified ? `<span class="badge badge-verified">✓ Verified</span>` : ""}
          ${isLive ? `<span class="badge badge-live">🌐 Live</span>` : ""}
        </div>
        <div class="opp-card-actions">
          <button class="card-action-btn ${o.saved ? 'bookmarked' : ''}" onclick="toggleSave('${o.id}')" title="${o.saved ? 'Remove bookmark' : 'Bookmark'}">
            ${o.saved ? "🔖" : "○"}
          </button>
          <button class="card-action-btn ${o.applied ? 'applied' : ''}" onclick="toggleApplied('${o.id}')" title="${o.applied ? 'Mark unapplied' : 'Mark applied'}">
            ${o.applied ? "✓" : "✗"}
          </button>
        </div>
      </div>

      <div class="opp-company">
        <div class="company-logo">${logo}</div>
        <div class="company-info">
          <div class="company-name">${org}</div>
          <div class="role-title">${role}</div>
        </div>
      </div>

      <div class="opp-details">
        <div class="opp-detail">
          <span class="detail-label">Stipend / Prize</span>
          <span class="detail-value">${o.stipend || "N/A"}</span>
        </div>
        <div class="opp-detail">
          <span class="detail-label">Deadline</span>
          <span class="detail-value">${o.deadline !== "N/A" ? formatDeadline(o.deadline) : "N/A"}</span>
        </div>
        ${o.location ? `
        <div class="opp-detail" style="grid-column:span 2">
          <span class="detail-label">📍 Location</span>
          <span class="detail-value">${o.location}</span>
        </div>` : ""}
        ${o.eligibility || o.description ? `
        <div class="opp-detail" style="grid-column:span 2">
          <span class="detail-label">Eligibility / About</span>
          <span class="detail-value">${(o.eligibility || o.description || "").slice(0, 120)}${(o.eligibility || o.description || "").length > 120 ? "…" : ""}</span>
        </div>` : ""}
      </div>

      <div class="opp-footer">
        <div class="source-tag">
          ${SOURCE_ICONS[source] || "🌐"} ${SOURCE_LABELS[source] || source}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${days <= 14 && days >= 0 ? `<span class="badge ${urgency.class}" style="font-size:10px">${urgency.emoji} ${urgency.label}</span>` : ""}
          <a href="${link}" target="_blank" class="apply-btn">Apply →</a>
        </div>
      </div>
    </div>`;
}

// ============================================================
// TOGGLE SAVE / APPLIED
// ============================================================

function toggleSave(id) {
  const opp = opportunities.find(o => o.id === id);
  if (!opp) return;
  opp.saved = !opp.saved;
  updateStats();
  renderCards();
  showToast(opp.saved ? "🔖 Bookmarked!" : "Bookmark removed", opp.saved ? "success" : "");
}

function toggleApplied(id) {
  const opp = opportunities.find(o => o.id === id);
  if (!opp) return;
  opp.applied = !opp.applied;
  updateStats();
  renderCards();
  showToast(opp.applied ? "✅ Marked as Applied!" : "Marked as not applied", opp.applied ? "success" : "");
}

// ============================================================
// FILTER CONTROLS
// ============================================================

function setFilter(type, btn) {
  activeTypeFilter = type;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderCards();
}

function initSearch() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderCards();
  });
  document.getElementById("typeFilter").addEventListener("change", e => {
    activeTypeFilter = e.target.value || "all";
    renderCards();
  });
  document.getElementById("sourceFilter").addEventListener("change", e => {
    sourceFilter = e.target.value;
    renderCards();
  });
  document.getElementById("deadlineFilter").addEventListener("change", e => {
    deadlineFilter = e.target.value;
    renderCards();
  });
  document.getElementById("domainFilter").addEventListener("change", e => {
    domainFilter = e.target.value || "general";
    renderCards();
  });
  document.getElementById("locationFilter").addEventListener("change", e => {
    locationFilter = e.target.value || "all";
    renderCards();
  });
}

// ============================================================
// QUICK REFRESH (mock simulation — kept for compat)
// ============================================================

function triggerScrape() {
  if (usingLiveData) {
    fetchLiveOpportunities();
    return;
  }
  showToast("💡 Click 'Fetch Live Opportunities' to load real data.", "");
}

// ============================================================
// TOAST
// ============================================================

function showToast(message, type = "") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity    = "0";
    toast.style.transform  = "translateX(20px)";
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}
