/**
 * Leaderboard — ranked agent score table with per-task breakdown.
 */

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ data }) {
  const entries = data?.leaderboard || [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">🏆 Agent Rankings</p>
        <p className="text-[11px] text-gray-600">sorted by avg grader score</p>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-600 text-sm">No agents recorded yet.</p>
          <p className="text-gray-700 text-xs mt-1">Complete an episode to appear on the leaderboard.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/[0.08]">
                <th className="text-left px-4 py-3 w-10">Rank</th>
                <th className="text-left px-4 py-3">Agent</th>
                <th className="text-right px-4 py-3">Avg Score</th>
                <th className="text-right px-4 py-3">Avg Reward</th>
                <th className="text-right px-4 py-3">Episodes</th>
                <th className="text-right px-4 py-3">Win Rate</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <LeaderboardRow key={entry.agent} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({ entry }) {
  const medal = MEDALS[entry.rank - 1] || `#${entry.rank}`;
  const score = entry.average_score ?? 0;
  const barW  = Math.round(score * 100);

  return (
    <tr className="border-b border-white/[0.05] last:border-none hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-lg">{medal}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-200">{entry.agent}</span>
          {(entry.win_rate ?? 0) >= 0.8 && (
            <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">
              ★ {pct(entry.win_rate)} wins
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style={{ width: `${barW}%` }} />
          </div>
          <span className="font-mono font-bold text-gray-200">{score.toFixed(3)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-blue-400">{(entry.average_reward ?? 0).toFixed(3)}</td>
      <td className="px-4 py-3 text-right text-gray-400">{entry.episodes_run}</td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-semibold ${(entry.win_rate ?? 0) >= 0.5 ? "text-green-400" : "text-gray-400"}`}>
          {pct(entry.win_rate)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-[11px] text-gray-600 hidden md:table-cell">
        {entry.last_active ? new Date(entry.last_active).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
      </td>
    </tr>
  );
}

function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : "—"; }
