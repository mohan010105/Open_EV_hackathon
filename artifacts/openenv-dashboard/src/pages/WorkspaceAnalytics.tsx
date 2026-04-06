/**
 * WorkspaceAnalytics — shows Metrics (Feature 4), Leaderboard (Feature 5),
 * and Episode Replay (Feature 6) in a tabbed layout.
 */
import React, { useState } from "react";
import { useWorkspaceMetrics, useWorkspaceLeaderboard, useWorkspaceReplay } from "@/hooks/use-workspace";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { RewardChart } from "@/components/RewardChart";
import { cn } from "@/lib/utils";
import {
  BarChart3, Trophy, Clock, Loader2, TrendingUp,
  CheckCircle2, XCircle, Target, Layers
} from "lucide-react";

type Tab = "metrics" | "leaderboard" | "replay";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function WorkspaceAnalytics() {
  const [tab, setTab] = useState<Tab>("metrics");
  const { data: metrics, isLoading: ml } = useWorkspaceMetrics();
  const { data: lb,      isLoading: ll } = useWorkspaceLeaderboard();
  const { data: replay,  isLoading: rl } = useWorkspaceReplay();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Performance metrics, agent leaderboard, and episode replay.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-card/30 border border-white/5 rounded-xl p-1 w-fit">
        {([
          { id: "metrics" as Tab,     label: "Metrics",     Icon: BarChart3 },
          { id: "leaderboard" as Tab, label: "Leaderboard", Icon: Trophy },
          { id: "replay" as Tab,      label: "Episode Replay", Icon: Clock },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Metrics ── */}
      {tab === "metrics" && (
        ml ? <Spinner /> :
        metrics?.episode_count === 0 ? (
          <Empty icon={<BarChart3 className="w-10 h-10" />} title="No data yet" text="Complete at least one workspace episode to see metrics." />
        ) : (
          <div className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Episodes"     value={metrics?.episode_count ?? 0} Icon={Layers} />
              <StatCard label="Success Rate" value={`${((metrics?.success_rate ?? 0) * 100).toFixed(1)}%`} Icon={CheckCircle2} color="text-emerald-400" />
              <StatCard label="Avg Reward"   value={(metrics?.avg_reward ?? 0).toFixed(3)} Icon={TrendingUp} color="text-blue-400" />
              <StatCard label="Avg Steps"    value={(metrics?.avg_steps ?? 0).toFixed(1)}  Icon={Target} />
            </div>

            {/* Per-task breakdown */}
            {metrics?.by_task && Object.keys(metrics.by_task).length > 0 && (
              <Card className="bg-card/60 border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Performance by Task
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-white/10">
                        <th className="text-left pb-2">Task</th>
                        <th className="text-right pb-2">Episodes</th>
                        <th className="text-right pb-2">Success</th>
                        <th className="text-right pb-2">Avg Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics.by_task).map(([id, t]: [string, any]) => (
                        <tr key={id} className="border-b border-white/5 last:border-none">
                          <td className="py-2 text-foreground">{t.name || id}</td>
                          <td className="py-2 text-right text-muted-foreground">{t.episodes}</td>
                          <td className={cn("py-2 text-right font-semibold", (t.success_rate ?? 0) >= 0.7 ? "text-emerald-400" : "text-red-400")}>
                            {((t.success_rate ?? 0) * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 text-right text-blue-400">{(t.avg_reward ?? 0).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* By difficulty */}
            {metrics?.by_difficulty && (
              <Card className="bg-card/60 border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Performance by Difficulty</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {(["easy", "medium", "hard"] as const).map((lvl) => {
                    const d = metrics.by_difficulty?.[lvl];
                    if (!d || d.episodes === 0) return null;
                    return (
                      <div key={lvl} className="flex items-center gap-4">
                        <span className={cn("w-16 text-xs font-semibold capitalize", lvl === "easy" ? "text-emerald-400" : lvl === "medium" ? "text-yellow-400" : "text-red-400")}>
                          {lvl}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(d.success_rate ?? 0) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{((d.success_rate ?? 0) * 100).toFixed(1)}% success</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{d.episodes} ep</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* ── Leaderboard ── */}
      {tab === "leaderboard" && (
        ll ? <Spinner /> :
        (!lb?.leaderboard?.length) ? (
          <Empty icon={<Trophy className="w-10 h-10" />} title="No agents ranked yet" text="Complete episodes to appear on the leaderboard." />
        ) : (
          <Card className="bg-card/60 border-white/5 overflow-hidden">
            <CardHeader className="pb-0 border-b border-white/5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-yellow-400" /> Agent Rankings
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
                    <th className="text-left px-4 py-3 w-10">Rank</th>
                    <th className="text-left px-4 py-3">Agent</th>
                    <th className="text-right px-4 py-3">Score</th>
                    <th className="text-right px-4 py-3">Avg Reward</th>
                    <th className="text-right px-4 py-3">Episodes</th>
                    <th className="text-right px-4 py-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {lb.leaderboard.map((entry: any, i: number) => (
                    <tr key={entry.agent} className="border-b border-white/[0.04] last:border-none hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-lg">{MEDALS[i] || `#${entry.rank}`}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{entry.agent}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(entry.average_score ?? 0) * 100}%` }} />
                          </div>
                          <span className="font-mono font-bold">{(entry.average_score ?? 0).toFixed(3)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-400">{(entry.average_reward ?? 0).toFixed(3)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{entry.episodes_run}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("font-semibold", (entry.win_rate ?? 0) >= 0.5 ? "text-emerald-400" : "text-muted-foreground")}>
                          {((entry.win_rate ?? 0) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Episode Replay ── */}
      {tab === "replay" && (
        rl ? <Spinner /> :
        (!replay?.steps?.length) ? (
          <Empty icon={<Clock className="w-10 h-10" />} title="No episode in progress" text="Start a workspace session and take actions to see the replay." />
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Task"       value={replay.task_name || "—"}           Icon={Target} />
              <StatCard label="Difficulty" value={replay.difficulty || "—"}           Icon={Layers} />
              <StatCard label="Steps"      value={replay.total_steps ?? 0}            Icon={Clock} />
              <StatCard label="Status"     value={replay.in_progress ? "Running" : "Done"} Icon={replay.in_progress ? TrendingUp : CheckCircle2} color={replay.in_progress ? "text-yellow-400" : "text-emerald-400"} />
            </div>

            {/* Reward chart */}
            {replay.steps.length > 0 && (
              <Card className="bg-card/60 border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Reward Progression</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <RewardChart
                    data={replay.steps.map((s: any) => ({ step: s.step, reward: s.total_reward }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step timeline */}
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Action Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 max-h-[400px] overflow-y-auto">
                {[...replay.steps].reverse().map((s: any) => (
                  <div
                    key={s.step}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg border text-xs",
                      s.action_valid
                        ? "border-white/[0.06] bg-white/[0.02]"
                        : "border-red-500/20 bg-red-500/[0.04]"
                    )}
                  >
                    <span className="font-mono text-muted-foreground w-6 text-right shrink-0">#{s.step}</span>
                    {s.action_valid
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      : <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                    <span className="font-mono text-foreground flex-1 truncate">{s.action}</span>
                    <span className={cn("font-mono font-bold shrink-0", s.reward >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {s.reward >= 0 ? "+" : ""}{s.reward?.toFixed(3)}
                    </span>
                    <span className="font-mono text-blue-400 shrink-0">Σ {s.total_reward?.toFixed(3)}</span>
                    {s.reason && (
                      <span className="text-muted-foreground truncate max-w-[160px]">{s.reason}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color = "text-foreground" }: {
  label: string; value: string | number; Icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="bg-card/50 border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={cn("text-xl font-bold truncate", color)}>{String(value)}</p>
      </CardContent>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card className="bg-card/30 border-dashed border-white/10">
      <CardContent className="p-16 flex flex-col items-center justify-center text-center">
        <div className="text-muted-foreground/30 mb-4">{icon}</div>
        <p className="font-semibold text-muted-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground/60">{text}</p>
      </CardContent>
    </Card>
  );
}
