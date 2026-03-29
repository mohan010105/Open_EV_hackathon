/* OpenEnv Workspace Dashboard v2 — dashboard.js
   Polls /state, /episode_replay, /metrics, /leaderboard every 2s. */

const API    = "";
const POLL   = 2000;

let rewardChart  = null;
let metricsChart = null;
let rewardLabels = [], rewardData = [];

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initRewardChart();
  initMetricsChart();
  poll();
  setInterval(poll, POLL);
  setupResetButton();
});

// ── Main poll ─────────────────────────────────────────────────────────────────
async function poll() {
  const [stateRes, replayRes, metricsRes, lbRes] = await Promise.allSettled([
    fetch(`${API}/state`).then(r => r.json()),
    fetch(`${API}/episode_replay`).then(r => r.json()),
    fetch(`${API}/metrics`).then(r => r.json()),
    fetch(`${API}/leaderboard`).then(r => r.json()),
  ]);
  if (stateRes.status  === "fulfilled") renderState(stateRes.value);
  if (replayRes.status === "fulfilled") renderReplay(replayRes.value);
  if (metricsRes.status=== "fulfilled") renderMetrics(metricsRes.value);
  if (lbRes.status     === "fulfilled") renderLeaderboard(lbRes.value);
}

// ── State ─────────────────────────────────────────────────────────────────────
function renderState(data) {
  const obs  = data.observation || {};
  const mode = obs.mode       || "training";
  const diff = obs.difficulty || "medium";

  setText("val-app",    appLabel(obs.current_app));
  setText("val-task",   obs.task_description || obs.current_task || "—");
  setText("val-step",   obs.step_count ?? "—");
  setText("val-reward", (obs.total_reward ?? 0).toFixed(3));

  // Active badge
  const activeBadge = document.getElementById("val-active");
  if (activeBadge) {
    activeBadge.textContent = data.is_active ? "Running ✓" : "Idle";
    activeBadge.className   = data.is_active ? "badge badge-active" : "badge badge-idle";
  }

  // Mode badge (topbar + inline)
  ["val-mode-badge","val-mode-inline"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = mode === "evaluation" ? "Evaluation" : "Training";
    el.className   = mode === "evaluation" ? "badge badge-eval" : "badge badge-train";
  });

  // Difficulty badge
  const diffBadge = document.getElementById("val-diff-badge");
  if (diffBadge) {
    diffBadge.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
    diffBadge.className   = `badge badge-${diff}`;
  }

  // Progress bar
  const prog = obs.total_reward ?? 0;
  const bar  = document.getElementById("progress-bar");
  const pct  = document.getElementById("progress-pct");
  if (bar) bar.style.width = (prog * 100).toFixed(1) + "%";
  if (pct) pct.textContent = (prog * 100).toFixed(1) + "%";

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
            ${e.has_meeting_details ? '<span class="badge badge-mtg" style="margin-left:4px">📅</span>' : ""}
          </div>`).join("")
      : '<p class="empty">No emails in view</p>';
  }

  // Selected email
  const selEl = document.getElementById("selected-email");
  if (selEl) {
    const se = obs.selected_email;
    selEl.innerHTML = se
      ? `<div class="email-detail">
           <div class="email-meta"><b>From:</b> ${esc(se.sender)}</div>
           <div class="email-meta"><b>Subject:</b> ${esc(se.subject)}</div>
           <pre class="email-body">${esc((se.body || "").slice(0, 500))}</pre>
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
    actEl.innerHTML = acts.map(a => `<span class="action-chip">${esc(a)}</span>`).join(" ");
  }
}

// ── Replay ────────────────────────────────────────────────────────────────────
function renderReplay(data) {
  const steps = data.steps || [];

  setText("val-episode-task",   data.task_name    || "—");
  setText("val-episode-steps",  data.total_steps  ?? 0);
  setText("val-episode-status", data.in_progress  ? "In Progress" : "Completed");

  // Timeline
  const tlEl = document.getElementById("timeline");
  if (tlEl) {
    tlEl.innerHTML = steps.length
      ? steps.slice().reverse().map(s => `
          <div class="tl-step ${s.action_valid ? "" : "step-invalid"}">
            <span class="step-num">#${s.step}</span>
            <span class="step-action">${esc(s.action)}</span>
            <span class="step-rew ${s.reward >= 0 ? "pos" : "neg"}">${s.reward >= 0 ? "+" : ""}${s.reward.toFixed(3)}</span>
            <span class="step-total">Σ ${s.total_reward.toFixed(3)}</span>
            <span class="step-reason">${esc(s.reason || "")}</span>
          </div>`).join("")
      : '<p class="empty">No steps yet — reset to start.</p>';
  }

  // Reward chart
  const newLabels = steps.map(s => `#${s.step}`);
  const newData   = steps.map(s => s.total_reward);
  if (JSON.stringify(newLabels) !== JSON.stringify(rewardLabels)) {
    rewardLabels = newLabels;
    rewardData   = newData;
    rewardChart.data.labels              = rewardLabels;
    rewardChart.data.datasets[0].data    = rewardData;
    rewardChart.update("none");
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────
function renderMetrics(data) {
  const n = data.episode_count || 0;
  setText("m-episodes", n);
  setText("m-success",  n ? pct(data.success_rate)  : "—");
  setText("m-reward",   n ? data.avg_reward.toFixed(3) : "—");
  setText("m-steps",    n ? data.avg_steps.toFixed(1)  : "—");

  // Task breakdown table
  const taskBody = document.getElementById("task-metrics-body");
  if (taskBody) {
    const byTask = data.by_task || {};
    const rows   = Object.entries(byTask);
    taskBody.innerHTML = rows.length
      ? rows.map(([id, t]) => `
          <tr>
            <td style="font-size:11px;color:var(--muted)">${esc(t.name || id)}</td>
            <td>${t.episodes}</td>
            <td><span style="color:${t.success_rate >= 0.7 ? "var(--green)" : "var(--red)"}">${pct(t.success_rate)}</span></td>
            <td>${t.avg_reward.toFixed(3)}</td>
          </tr>`).join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px">No data yet</td></tr>';
  }

  // Difficulty breakdown table
  const diffBody = document.getElementById("diff-metrics-body");
  if (diffBody) {
    const byDiff = data.by_difficulty || {};
    const rows   = Object.entries(byDiff);
    const diffOrder = { easy: 0, medium: 1, hard: 2 };
    rows.sort((a, b) => (diffOrder[a[0]] ?? 9) - (diffOrder[b[0]] ?? 9));
    diffBody.innerHTML = rows.length
      ? rows.map(([lvl, d]) => `
          <tr>
            <td><span class="badge badge-${lvl}" style="font-size:10px">${lvl}</span></td>
            <td>${d.episodes}</td>
            <td><span style="color:${d.success_rate >= 0.7 ? "var(--green)" : "var(--red)"}">${pct(d.success_rate)}</span></td>
            <td>${d.avg_reward.toFixed(3)}</td>
          </tr>`).join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:14px">No data yet</td></tr>';
  }

  // Metrics bar chart (success_rate, avg_reward, avg_score)
  if (metricsChart && n > 0) {
    metricsChart.data.datasets[0].data = [
      (data.success_rate  || 0),
      (data.avg_reward    || 0),
      (data.avg_score     || 0),
    ];
    metricsChart.update("none");
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function renderLeaderboard(data) {
  const entries = data.leaderboard || [];
  const body    = document.getElementById("leaderboard-body");
  if (!body) return;

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">No agents recorded yet</td></tr>';
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  body.innerHTML = entries.map(e => {
    const medal   = medals[e.rank - 1] || `#${e.rank}`;
    const barW    = Math.round((e.average_score || 0) * 100);
    const winBadge = e.win_rate >= 0.8
      ? `<span class="win-badge">★ ${pct(e.win_rate)} wins</span>` : "";
    const ts = e.last_active ? new Date(e.last_active).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
    return `
      <tr>
        <td class="rank-cell">${medal}</td>
        <td><strong>${esc(e.agent)}</strong> ${winBadge}</td>
        <td>
          <span class="score-bar-wrap"><span class="score-bar-fill" style="width:${barW}%"></span></span>
          <strong>${e.average_score.toFixed(3)}</strong>
        </td>
        <td>${e.average_reward.toFixed(3)}</td>
        <td>${e.episodes_run}</td>
        <td>${pct(e.win_rate)}</td>
        <td style="color:var(--muted);font-size:11px">${ts}</td>
      </tr>`;
  }).join("");
}

// ── Chart setup ───────────────────────────────────────────────────────────────
function initRewardChart() {
  const ctx = document.getElementById("reward-chart");
  if (!ctx) return;
  rewardChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Cumulative Reward",
        data: [],
        borderColor: "rgba(99,179,237,1)",
        backgroundColor: "rgba(99,179,237,0.10)",
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: "rgba(99,179,237,1)",
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 200 },
      plugins: { legend: { labels: { color: "#cbd5e0" } } },
      scales: {
        x: { ticks: { color: "#718096" }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { min: 0, max: 1.05, ticks: { color: "#718096" }, grid: { color: "rgba(255,255,255,0.06)" } },
      },
    },
  });
}

function initMetricsChart() {
  const ctx = document.getElementById("metrics-chart");
  if (!ctx) return;
  metricsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Success Rate", "Avg Reward", "Avg Score"],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [
          "rgba(86,211,100,0.65)",
          "rgba(99,179,237,0.65)",
          "rgba(159,122,234,0.65)",
        ],
        borderColor: [
          "rgba(86,211,100,1)",
          "rgba(99,179,237,1)",
          "rgba(159,122,234,1)",
        ],
        borderWidth: 1.5,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#718096" }, grid: { display: false } },
        y: { min: 0, max: 1, ticks: { color: "#718096" }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

// ── Reset button ──────────────────────────────────────────────────────────────
function setupResetButton() {
  const btn = document.getElementById("btn-reset");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const task_id    = document.getElementById("task-select")?.value   || null;
    const difficulty = document.getElementById("diff-select")?.value   || "medium";
    const mode       = document.getElementById("mode-select")?.value   || "training";
    const agent_name = document.getElementById("agent-name")?.value?.trim() || "agent";
    btn.disabled = true; btn.textContent = "Resetting…";
    try {
      await fetch(`${API}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task_id || undefined, difficulty, mode, agent_name }),
      });
      rewardLabels = []; rewardData = [];
      rewardChart.data.labels = []; rewardChart.data.datasets[0].data = [];
      rewardChart.update();
    } finally {
      btn.disabled = false; btn.textContent = "Reset Environment";
      poll();
    }
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function pct(v) { return v != null ? (v * 100).toFixed(1) + "%" : "—"; }
function appLabel(app) {
  return { email_inbox:"📧 Email Inbox", email_detail:"📨 Email Detail", calendar:"📅 Calendar", documents:"📁 Documents", task_manager:"✅ Task Manager" }[app] || app || "—";
}
function fileIcon(type) {
  return { PDF:"📄", Spreadsheet:"📊", Document:"📝", Image:"🖼️" }[type] || "📎";
}
