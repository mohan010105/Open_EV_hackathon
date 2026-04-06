/**
 * Controls — Reset, manual step input, and Demo mode button.
 * Demo mode auto-runs a curated action sequence with animated steps.
 */
import { useState } from "react";

const ACTIONS = [
  "open_email_inbox",
  "search_email",
  "read_email",
  "extract_meeting_details",
  "create_calendar_event",
  "view_calendar",
  "view_documents",
  "move_document",
  "noop",
];

export default function Controls({ onReset, onStep, onDemo, loading, demoRunning, availableActions, isActive }) {
  const [action, setAction]     = useState("open_email_inbox");
  const [params, setParams]     = useState("");
  const [taskId, setTaskId]     = useState("");
  const [difficulty, setDiff]   = useState("medium");
  const [mode, setMode]         = useState("training");
  const [agentName, setAgent]   = useState("agent");
  const [paramsError, setErr]   = useState("");

  function handleStep() {
    let parsedParams = {};
    if (params.trim()) {
      try { parsedParams = JSON.parse(params); }
      catch { setErr("Invalid JSON params"); return; }
    }
    setErr("");
    onStep(action, parsedParams);
  }

  function handleReset() {
    onReset({ task_id: taskId || undefined, difficulty, mode, agent_name: agentName });
  }

  const displayActions = availableActions?.length ? availableActions : ACTIONS;

  return (
    <div className="space-y-4">
      {/* ── Reset controls ── */}
      <Card title="🔄 Reset Episode">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Task</label>
            <select value={taskId} onChange={e => setTaskId(e.target.value)} className={selectCls}>
              <option value="">Random</option>
              <option value="ws_task_1">Task 1 — Email Retrieval</option>
              <option value="ws_task_2">Task 2 — Meeting Scheduling</option>
              <option value="ws_task_3">Task 3 — Document Organization</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Difficulty</label>
            <select value={difficulty} onChange={e => setDiff(e.target.value)} className={selectCls}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className={selectCls}>
              <option value="training">Training</option>
              <option value="evaluation">Evaluation</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Agent Name</label>
            <input value={agentName} onChange={e => setAgent(e.target.value)} className={inputCls} placeholder="agent" />
          </div>
        </div>
        <button onClick={handleReset} disabled={loading} className={`${btnBase} bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30 w-full`}>
          {loading ? <Spinner /> : "Reset Environment"}
        </button>
      </Card>

      {/* ── Manual step ── */}
      <Card title="⚡ Manual Step">
        <div className="mb-3">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Action</label>
          <select value={action} onChange={e => setAction(e.target.value)} className={selectCls}>
            {displayActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">
            Params <span className="normal-case text-gray-600">(JSON)</span>
          </label>
          <input
            value={params}
            onChange={e => { setParams(e.target.value); setErr(""); }}
            className={`${inputCls} font-mono`}
            placeholder='{"sender": "Alex"}'
          />
          {paramsError && <p className="text-red-400 text-xs mt-1">{paramsError}</p>}
        </div>
        <div className="text-[11px] text-gray-600 mb-3 font-mono space-y-0.5">
          <p>search_email → {'{'}sender: "name"{'}'}</p>
          <p>read_email → {'{'}email_id: "email_001"{'}'}</p>
          <p>move_document → {'{'}document_id: "doc_001", folder: "Projects"{'}'}</p>
        </div>
        <button onClick={handleStep} disabled={loading || !isActive} className={`${btnBase} bg-green-600/20 border-green-500/40 text-green-300 hover:bg-green-600/30 w-full`}>
          {loading ? <Spinner /> : "Execute Step"}
        </button>
        {!isActive && <p className="text-[11px] text-gray-600 mt-2 text-center">Reset to start an episode first</p>}
      </Card>

      {/* ── Demo mode ── */}
      <Card title="🤖 Auto Demo">
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Automatically runs a full Task 2 episode: open inbox → search Alex → read email → extract details → schedule meeting.
        </p>
        <button
          onClick={onDemo}
          disabled={loading || demoRunning}
          className={`${btnBase} w-full ${
            demoRunning
              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
              : "bg-purple-600/20 border-purple-500/40 text-purple-300 hover:bg-purple-600/30"
          }`}
        >
          {demoRunning ? (
            <span className="flex items-center gap-2">
              <Spinner color="yellow" /> Running Demo…
            </span>
          ) : "▶ Run Demo"}
        </button>
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</p>
      {children}
    </div>
  );
}

function Spinner({ color = "white" }) {
  const c = color === "yellow" ? "border-yellow-400" : "border-blue-400";
  return <span className={`inline-block w-3.5 h-3.5 rounded-full border-2 ${c} border-t-transparent animate-spin`} />;
}

const btnBase = "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed";
const selectCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50";
const inputCls  = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50";
