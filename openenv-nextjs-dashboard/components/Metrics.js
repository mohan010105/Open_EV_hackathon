/**
 * Metrics — displays aggregated performance stats and per-task breakdown.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Metrics({ data }) {
  if (!data || data.episode_count === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="text-gray-600 text-sm">No episodes recorded yet.</p>
        <p className="text-gray-700 text-xs mt-1">Run at least one complete episode to see metrics.</p>
      </div>
    );
  }

  const barData = [
    { name: "Success Rate",  value: data.success_rate  ?? 0, color: "#56d364" },
    { name: "Avg Reward",    value: data.avg_reward    ?? 0, color: "#63b3ed" },
    { name: "Avg Score",     value: data.avg_score     ?? 0, color: "#9f7aea" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Aggregate stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Episodes"    value={data.episode_count} />
        <StatCard label="Success Rate" value={pct(data.success_rate)} color="green" />
        <StatCard label="Avg Reward"  value={data.avg_reward?.toFixed(3)} color="blue" />
        <StatCard label="Avg Steps"   value={data.avg_steps?.toFixed(1)} />
      </div>

      {/* ── Bar chart ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">📊 Performance Overview</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 1]} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1c2128", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [v.toFixed(4)]}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {barData.map((entry) => <Cell key={entry.name} fill={entry.color} fillOpacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── By-task breakdown ── */}
      {data.by_task && Object.keys(data.by_task).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">By Task</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/[0.08]">
                <th className="text-left pb-2">Task</th>
                <th className="text-right pb-2">Episodes</th>
                <th className="text-right pb-2">Success</th>
                <th className="text-right pb-2">Avg Reward</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.by_task).map(([id, t]) => (
                <tr key={id} className="border-b border-white/[0.05] last:border-none">
                  <td className="py-2 text-gray-300">{t.name || id}</td>
                  <td className="py-2 text-right text-gray-400">{t.episodes}</td>
                  <td className={`py-2 text-right font-semibold ${(t.success_rate ?? 0) >= 0.7 ? "text-green-400" : "text-red-400"}`}>{pct(t.success_rate)}</td>
                  <td className="py-2 text-right text-blue-400">{(t.avg_reward ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── By-difficulty breakdown ── */}
      {data.by_difficulty && Object.keys(data.by_difficulty).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">By Difficulty</p>
          <div className="space-y-2">
            {["easy", "medium", "hard"].filter(l => data.by_difficulty[l]).map((lvl) => {
              const d = data.by_difficulty[lvl];
              return (
                <div key={lvl} className="flex items-center gap-3">
                  <span className={`w-14 text-[11px] font-semibold ${diffColor(lvl)}`}>{lvl}</span>
                  <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400/70 rounded-full bar-grow" style={{ width: `${(d.success_rate ?? 0) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500 w-12 text-right">{pct(d.success_rate)}</span>
                  <span className="text-[11px] text-gray-600 w-10 text-right">{d.episodes} ep</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const c = { green: "text-green-400", blue: "text-blue-400" }[color] || "text-gray-200";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c}`}>{value ?? "—"}</p>
    </div>
  );
}

function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : "—"; }
function diffColor(d) { return { easy: "text-green-400", medium: "text-yellow-400", hard: "text-red-400" }[d] || "text-gray-400"; }
