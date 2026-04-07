/**
 * OpenEnv AI Workspace Assistant — Next.js Dashboard
 *
 * Connects to the FastAPI backend via NEXT_PUBLIC_API_URL.
 * Features: live state, manual/auto step, demo mode,
 *           episode replay, metrics, leaderboard.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import Dashboard  from "../components/Dashboard";
import Controls   from "../components/Controls";
import Replay     from "../components/Replay";
import Metrics    from "../components/Metrics";
import Leaderboard from "../components/Leaderboard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

// ── Demo action playbook for Task 2 (Meeting Scheduling) ──────────────────────
const DEMO_STEPS = [
  { action: "open_email_inbox",        params: {} },
  { action: "search_email",            params: { sender: "Alex" } },
  { action: "read_email",              params: { email_id: "email_001" } },
  { action: "extract_meeting_details", params: {} },
  { action: "create_calendar_event",   params: {} },
];
const DEMO_DELAY_MS = 1800;

const TABS = ["Live State", "Replay", "Metrics", "Leaderboard"];

export default function Home() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [obs,         setObs]         = useState(null);
  const [step,        setStep]        = useState(0);
  const [reward,      setReward]      = useState(0.0);
  const [sessionMeta, setMeta]        = useState({});
  const [replayData,  setReplay]      = useState(null);
  const [metricsData, setMetrics]     = useState(null);
  const [lbData,      setLb]          = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [demoRunning, setDemo]        = useState(false);
  const [error,       setError]       = useState("");
  const [toast,       setToast]       = useState(null);
  const [activeTab,   setTab]         = useState("Live State");
  const [stepLog,     setStepLog]     = useState([]);
  const demoAbort = useRef(false);

  // ── Helper ───────────────────────────────────────────────────────────────────
  function updateState(data) {
    if (data.observation) {
      setObs(data.observation);
    }
    if (data.step !== undefined || data.observation?.step_count !== undefined) {
      setStep(data.step ?? data.observation?.step_count ?? 0);
    }
    if (data.reward !== undefined || data.observation?.total_reward !== undefined) {
      setReward(data.reward ?? data.observation?.total_reward ?? 0.0);
    }
  }

  // ── Polling ──────────────────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const r = await api("GET", "/state");
      updateState(r);
      setMeta({ session_id: r.session_id, is_active: r.is_active, difficulty: r.difficulty, mode: r.mode });
      setError((prev) => prev === "Unable to connect to environment API." ? "" : prev);
    } catch (e) { 
      setError("Unable to connect to environment API.");
    }
  }, []);

  const fetchReplay = useCallback(async () => {
    try { const r = await api("GET", "/episode_replay"); setReplay(r); } catch { /* silent */ }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try { const r = await api("GET", "/metrics"); setMetrics(r); } catch { /* silent */ }
  }, []);

  const fetchLb = useCallback(async () => {
    try { const r = await api("GET", "/leaderboard"); setLb(r); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchState(); fetchReplay(); fetchMetrics(); fetchLb();
    const id = setInterval(() => { fetchState(); fetchReplay(); }, 2500);
    const id2 = setInterval(() => { fetchMetrics(); fetchLb(); }, 8000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, [fetchState, fetchReplay, fetchMetrics, fetchLb]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function handleReset(body = {}) {
    setLoading(true); setError(""); setStepLog([]);
    try {
      const res = await fetch(`${API}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      console.log("API response:", data);
      console.log("Reset response:", data);
      
      updateState(data);
      showToast("Episode reset", "green");
      await fetchReplay(); await fetchState();
    } catch (error) {
      console.error("API error:", error);
      setError(error.message || "Failed to reset"); showToast("Reset failed", "red");
    } finally { setLoading(false); }
  }

  async function handleStep(action, params = {}) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params })
      });
      const data = await res.json();
      console.log("API response:", data);
      console.log("Step response:", data);
      
      updateState(data);
      
      const entry = {
        step:   data.observation?.step_count ?? data.step ?? "?",
        action,
        reward: data.reward,
        done:   data.done,
        reason: data.info?.reason || "",
        valid:  data.info?.action_valid !== false,
      };
      setStepLog(prev => [...prev, entry]);
      await fetchReplay();
      if (data.done) {
        const grade = data.info?.grade;
        showToast(grade?.passed ? `✅ Task complete! Score: ${grade?.score?.toFixed(2)}` : "Episode ended", grade?.passed ? "green" : "yellow");
        await fetchMetrics(); await fetchLb();
        setTab("Replay");
      }
      return data;
    } catch (error) {
      console.error("API error:", error);
      setError(error.message || "Failed to step"); showToast(error.message || "Step failed", "red");
    } finally { setLoading(false); }
  }

  // ── Demo mode ─────────────────────────────────────────────────────────────────
  async function handleDemo() {
    setDemo(true); demoAbort.current = false;
    setError(""); setStepLog([]);

    try {
      // 1. Reset with Task 2
      await handleReset({ task_id: "ws_task_2", difficulty: "medium", mode: "training", agent_name: "demo-agent" });
      showToast("Demo started — Task 2: Meeting Scheduling", "blue");

      // 2. Run each demo step
      for (const { action, params } of DEMO_STEPS) {
        if (demoAbort.current) break;
        await sleep(DEMO_DELAY_MS);
        if (demoAbort.current) break;
        const r = await handleStep(action, params);
        if (r?.done) break;
      }
      showToast("Demo complete!", "green");
      setTab("Replay");
    } catch (e) {
      setError(e.message);
    } finally {
      setDemo(false);
    }
  }

  function showToast(msg, color = "blue") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalReward  = reward;
  const stepCount    = step;
  const isActive     = sessionMeta.is_active ?? false;
  const rewardPct    = Math.round(totalReward * 100);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>OpenEnv — AI Workspace Dashboard</title>
        <meta name="description" content="OpenEnv AI Workspace Assistant RL Environment Dashboard" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🗂️</text></svg>" />
      </Head>

      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 h-14 bg-[#161b22] border-b border-white/[0.08] flex items-center px-5 gap-3">
        <span className="text-xl">🗂️</span>
        <span className="font-bold text-gray-200 text-[15px]">OpenEnv Workspace</span>
        <span className="text-gray-700 text-sm hidden sm:inline">/ AI Workspace Assistant</span>
        <div className="flex-1" />
        <StatusPill active={isActive} />
        {sessionMeta.mode && <ModePill mode={sessionMeta.mode} />}
        {sessionMeta.difficulty && <DiffPill diff={sessionMeta.difficulty} />}
        <a href={`${API}/docs`} target="_blank" rel="noreferrer"
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors hidden md:inline">
          API Docs ↗
        </a>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-16 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium transition-all ${toastStyle(toast.color)}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-5 mt-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Current App"   value={appLabel(obs?.current_app)} />
          <StatCard label="Step"          value={stepCount} sub={obs?.task_id ? `/ ${obs.task_id}` : ""} />
          <StatCard label="Total Reward"  value={totalReward.toFixed(3)} color="green" />
          <StatCard label="Progress">
            <div className="mt-1">
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Reward</span><span>{rewardPct}%</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 bar-grow" style={{ width: `${rewardPct}%` }} />
              </div>
            </div>
          </StatCard>
        </div>

        {/* ── Main layout: sidebar + content ── */}
        <div className="flex gap-4 items-start">

          {/* ── Left sidebar: Controls ── */}
          <aside className="w-72 shrink-0 hidden lg:block">
            <Controls
              onReset={handleReset}
              onStep={handleStep}
              onDemo={handleDemo}
              loading={loading}
              demoRunning={demoRunning}
              availableActions={obs?.available_actions}
              isActive={isActive}
            />
          </aside>

          {/* ── Main content area ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile controls toggle */}
            <div className="lg:hidden mb-4">
              <Controls
                onReset={handleReset}
                onStep={handleStep}
                onDemo={handleDemo}
                loading={loading}
                demoRunning={demoRunning}
                availableActions={obs?.available_actions}
                isActive={isActive}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1 w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTab(tab)}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                    activeTab === tab
                      ? "bg-white/10 text-gray-200"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tabIcon(tab)} {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === "Live State"  && <Dashboard obs={obs} mode={sessionMeta.mode} difficulty={sessionMeta.difficulty} isActive={isActive} />}
              {activeTab === "Replay"      && <Replay replayData={replayData} />}
              {activeTab === "Metrics"     && <Metrics data={metricsData} />}
              {activeTab === "Leaderboard" && <Leaderboard data={lbData} />}
            </div>

            {/* Inline step log (always visible below tabs) */}
            {stepLog.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Session Step Log</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {stepLog.map((s, i) => (
                    <div key={i} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-1.5 ${s.valid ? "bg-white/[0.02]" : "bg-red-500/[0.04]"}`}>
                      <span className="text-gray-600 font-mono w-5 text-right">#{s.step}</span>
                      <span className="font-mono text-gray-300 flex-1 truncate">{s.action}</span>
                      <span className={`font-mono font-bold ${(s.reward ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {(s.reward ?? 0) >= 0 ? "+" : ""}{(s.reward ?? 0).toFixed(3)}
                      </span>
                      {s.done && <span className="text-purple-400 font-semibold">DONE</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 py-6 border-t border-white/[0.06] text-center text-xs text-gray-700">
        OpenEnv AI Workspace Assistant &nbsp;·&nbsp;
        <a href={API} target="_blank" rel="noreferrer" className="hover:text-gray-500 transition-colors">{API}</a>
        &nbsp;·&nbsp; v2.0
      </footer>
    </>
  );
}

// ── Small UI components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, children }) {
  const c = { green: "text-green-400" }[color] || "text-gray-200";
  return (
    <div className="rounded-xl border border-white/10 bg-[#161b22] p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      {children ?? (
        <p className={`text-xl font-bold truncate ${c}`}>
          {value ?? "—"} {sub && <span className="text-xs font-normal text-gray-600">{sub}</span>}
        </p>
      )}
    </div>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${active ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-white/5 text-gray-500 border-white/10"}`}>
      {active ? "Running ✓" : "Idle"}
    </span>
  );
}

function ModePill({ mode }) {
  const s = mode === "evaluation"
    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
    : "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s}`}>{mode}</span>;
}

function DiffPill({ diff }) {
  const s = { easy: "bg-green-500/15 text-green-400 border-green-500/30", medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", hard: "bg-red-500/15 text-red-400 border-red-500/30" }[diff] || "";
  return <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s}`}>{diff}</span>;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 120)}` : ""}`);
  }
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function appLabel(app) {
  return { email_inbox: "📧 Inbox", email_detail: "📨 Email", calendar: "📅 Calendar", documents: "📁 Docs", task_manager: "✅ Tasks" }[app] || app || "—";
}

function tabIcon(tab) {
  return { "Live State": "🖥", Replay: "⏱", Metrics: "📊", Leaderboard: "🏆" }[tab] || "";
}

function toastStyle(color) {
  return {
    green:  "bg-green-900/90  border-green-500/40  text-green-200",
    red:    "bg-red-900/90    border-red-500/40    text-red-200",
    yellow: "bg-yellow-900/90 border-yellow-500/40 text-yellow-200",
    blue:   "bg-blue-900/90   border-blue-500/40   text-blue-200",
  }[color] || "bg-gray-900/90 border-white/10 text-gray-200";
}
