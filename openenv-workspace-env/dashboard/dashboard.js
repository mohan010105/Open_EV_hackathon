/* OpenEnv Workspace Dashboard — dashboard.js
   Polls the server every 2 s and updates all panels live.
   Requires Chart.js loaded in the HTML page. */

const API = "";          // same origin
const POLL_MS = 2000;
let rewardChart = null;
let rewardLabels = [];
let rewardData   = [];

// ── Bootstrap ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initChart();
  poll();
  setInterval(poll, POLL_MS);
  setupResetButton();
});

// ── Polling ────────────────────────────────────────────────────────────────────
async function poll() {
  try {
    const [stateRes, replayRes] = await Promise.all([
      fetch(`${API}/state`).then(r => r.json()),
      fetch(`${API}/episode_replay`).then(r => r.json()),
    ]);
    renderState(stateRes);
    renderReplay(replayRes);
  } catch (err) {
    console.warn("Poll error:", err);
  }
}

// ── State panel ────────────────────────────────────────────────────────────────
function renderState(data) {
  const obs = data.observation || {};

  // Status bar
  setText("val-app",    appLabel(obs.current_app));
  setText("val-task",   obs.current_task || "—");
  setText("val-step",   obs.step_count ?? "—");
  setText("val-reward", (obs.total_reward ?? 0).toFixed(3));
  setText("val-active", data.is_active ? "Running ✓" : "Idle");
  setClass("val-active", data.is_active ? "badge badge-active" : "badge badge-idle");

  // Emails
  const emailEl = document.getElementById("email-list");
  if (emailEl) {
    const emails = obs.email_list || [];
    emailEl.innerHTML = emails.length
      ? emails.map(e => `
          <div class="list-item ${e.read ? "" : "unread"}">
            <span class="dot ${e.read ? "dot-read" : "dot-unread"}"></span>
            <div class="list-item-body">
              <strong>${esc(e.sender)}</strong>
              <span class="subject">${esc(e.subject)}</span>
            </div>
            <span class="ts">${fmtTime(e.timestamp)}</span>
            ${e.has_meeting_details ? '<span class="badge badge-mtg">📅</span>' : ""}
          </div>`).join("")
      : '<p class="empty">No emails in view</p>';
  }

  // Selected email
  const selEl = document.getElementById("selected-email");
  if (selEl) {
    const se = obs.selected_email;
    selEl.innerHTML = se
      ? `<div class="email-detail">
           <div class="email-meta"><b>From:</b> ${esc(se.sender)} &lt;${esc(se.sender_email)}&gt;</div>
           <div class="email-meta"><b>Subject:</b> ${esc(se.subject)}</div>
           <pre class="email-body">${esc(se.body || "")}</pre>
         </div>`
      : '<p class="empty">No email open</p>';
  }

  // Calendar
  const calEl = document.getElementById("calendar-list");
  if (calEl) {
    const events = obs.calendar_events || [];
    calEl.innerHTML = events.length
      ? events.map(ev => `
          <div class="list-item ${ev.created_from_email ? "highlight" : ""}">
            <div class="cal-date">${esc(ev.date)}</div>
            <div class="list-item-body">
              <strong>${esc(ev.title)}</strong>
              <span class="subject">${esc(ev.time)} · ${esc(ev.location || "")}</span>
            </div>
            ${ev.created_from_email ? '<span class="badge badge-new">New</span>' : ""}
          </div>`).join("")
      : '<p class="empty">No events</p>';
  }

  // Documents
  const docEl = document.getElementById("doc-list");
  if (docEl) {
    const docs = obs.documents || [];
    docEl.innerHTML = docs.length
      ? docs.map(d => `
          <div class="list-item">
            <span class="doc-icon">${fileIcon(d.type)}</span>
            <div class="list-item-body">
              <strong>${esc(d.name)}</strong>
              <span class="subject">${esc(d.folder)} · ${esc(d.size || "")}</span>
            </div>
          </div>`).join("")
      : '<p class="empty">No documents</p>';
  }

  // Available actions
  const actEl = document.getElementById("actions-list");
  if (actEl) {
    const acts = obs.available_actions || [];
    actEl.innerHTML = acts.map(a =>
      `<span class="action-chip">${esc(a)}</span>`
    ).join(" ");
  }

  // Task progress bar
  const prog = obs.total_reward ?? 0;
  const bar = document.getElementById("progress-bar");
  if (bar) bar.style.width = (prog * 100).toFixed(1) + "%";
  const pct = document.getElementById("progress-pct");
  if (pct) pct.textContent = (prog * 100).toFixed(1) + "%";
}

// ── Replay / Timeline panel ────────────────────────────────────────────────────
function renderReplay(data) {
  const steps = data.steps || [];

  // Timeline
  const tlEl = document.getElementById("timeline");
  if (tlEl) {
    if (steps.length === 0) {
      tlEl.innerHTML = '<p class="empty">No steps yet — reset the environment to start.</p>';
    } else {
      tlEl.innerHTML = steps.slice().reverse().map(s => `
        <div class="timeline-step ${s.action_valid ? "" : "step-invalid"}">
          <span class="step-num">#${s.step}</span>
          <span class="step-action">${esc(s.action)}</span>
          <span class="step-reward ${s.reward >= 0 ? "pos" : "neg"}">${s.reward >= 0 ? "+" : ""}${s.reward.toFixed(3)}</span>
          <span class="step-total">Σ ${s.total_reward.toFixed(3)}</span>
          <span class="step-reason">${esc(s.reason || "")}</span>
        </div>`).join("");
    }
  }

  // Reward chart
  const newLabels = steps.map(s => `#${s.step}`);
  const newData   = steps.map(s => s.total_reward);

  if (JSON.stringify(newLabels) !== JSON.stringify(rewardLabels)) {
    rewardLabels = newLabels;
    rewardData   = newData;
    rewardChart.data.labels         = rewardLabels;
    rewardChart.data.datasets[0].data = rewardData;
    rewardChart.update("none");
  }

  // Episode info
  setText("val-episode-steps",  data.total_steps ?? "—");
  setText("val-episode-task",   data.task_name   ?? "—");
  setText("val-episode-status", data.in_progress ? "In Progress" : "Completed");
}

// ── Chart setup ────────────────────────────────────────────────────────────────
function initChart() {
  const ctx = document.getElementById("reward-chart");
  if (!ctx) return;
  rewardChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Cumulative Reward",
        data: [],
        borderColor:     "rgba(99, 179, 237, 1)",
        backgroundColor: "rgba(99, 179, 237, 0.12)",
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: "rgba(99, 179, 237, 1)",
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { labels: { color: "#cbd5e0" } },
        tooltip: {
          callbacks: {
            label: ctx => `Reward: ${ctx.parsed.y.toFixed(4)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#718096" },
          grid:  { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          min: 0, max: 1.05,
          ticks: { color: "#718096" },
          grid:  { color: "rgba(255,255,255,0.07)" },
        },
      },
    },
  });
}

// ── Reset button ───────────────────────────────────────────────────────────────
function setupResetButton() {
  const btn = document.getElementById("btn-reset");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const taskSel = document.getElementById("task-select");
    const task_id = taskSel ? taskSel.value : "";
    btn.disabled = true;
    btn.textContent = "Resetting…";
    try {
      await fetch(`${API}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task_id ? { task_id } : {}),
      });
      rewardLabels = [];
      rewardData   = [];
      rewardChart.data.labels = [];
      rewardChart.data.datasets[0].data = [];
      rewardChart.update();
    } finally {
      btn.disabled = false;
      btn.textContent = "Reset Environment";
      poll();
    }
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setClass(id, cls) {
  const el = document.getElementById(id);
  if (el) el.className = cls;
}
function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function appLabel(app) {
  const map = {
    email_inbox:   "📧 Email Inbox",
    email_detail:  "📨 Email Detail",
    calendar:      "📅 Calendar",
    documents:     "📁 Documents",
    task_manager:  "✅ Task Manager",
  };
  return map[app] || app || "—";
}
function fileIcon(type) {
  const map = { PDF: "📄", Spreadsheet: "📊", Document: "📝", Image: "🖼️" };
  return map[type] || "📎";
}
