/**
 * Replay — displays the episode step log with reward chart using Recharts.
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function Replay({ replayData }) {
  const steps = replayData?.steps || [];

  const chartData = steps.map((s) => ({
    step:   `#${s.step}`,
    reward: parseFloat(s.total_reward?.toFixed(4) ?? 0),
    delta:  parseFloat(s.reward?.toFixed(4) ?? 0),
  }));

  return (
    <div className="space-y-4">
      {/* ── Episode info ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Episode</p>
            <p className="text-sm font-semibold text-gray-200">{replayData?.task_name || "No active episode"}</p>
          </div>
          <div className="flex gap-6">
            <Stat label="Steps" value={replayData?.total_steps ?? 0} />
            <Stat label="Status" value={replayData?.in_progress ? "In Progress" : "Completed"} highlight={replayData?.in_progress} />
          </div>
        </div>
      </div>

      {/* ── Reward chart ── */}
      {chartData.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">📈 Reward Progression</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="step" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1.05]} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1c2128", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
                itemStyle={{ color: "#63b3ed" }}
                formatter={(v) => [v.toFixed(4), "Cumulative"]}
              />
              <ReferenceLine y={1} stroke="rgba(86,211,100,0.3)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="reward" stroke="#63b3ed" strokeWidth={2.5} dot={{ fill: "#63b3ed", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState text="No steps yet — reset and run an episode." />
      )}

      {/* ── Step-by-step timeline ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">⏱️ Action Timeline</p>
        {steps.length === 0 ? (
          <EmptyState text="No actions recorded." />
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {[...steps].reverse().map((s) => (
              <StepRow key={s.step} step={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepRow({ step }) {
  const positive = step.reward >= 0;
  return (
    <div className={`rounded-lg border px-3 py-2 grid grid-cols-[28px_1fr_auto_auto] gap-2 items-center text-sm ${step.action_valid ? "border-white/[0.08] bg-white/[0.02]" : "border-red-500/20 bg-red-500/[0.04]"}`}>
      <span className="font-mono text-[11px] text-gray-600 text-right">#{step.step}</span>
      <span className="font-mono text-[12px] text-gray-300 truncate">{step.action}</span>
      <span className={`font-mono text-[12px] font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? "+" : ""}{step.reward?.toFixed(3)}
      </span>
      <span className="font-mono text-[12px] text-blue-400">Σ {step.total_reward?.toFixed(3)}</span>
      {step.reason && (
        <span className="col-span-4 text-[11px] text-gray-500 pl-9 truncate">{step.reason}</span>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="text-right">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-green-400" : "text-gray-200"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-center text-gray-600 text-sm py-8">{text}</p>;
}
