import React from "react";
import { useEnvState, useTasks, useSessions } from "@/hooks/use-env";
import { useWorkspaceState, useWorkspaceTasks, useWorkspaceSessions } from "@/hooks/use-workspace";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { Activity, Target, Trophy, Clock, ArrowRight, Box, Globe, BriefcaseBusiness, Mail, Calendar, FolderOpen } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: envState, isLoading: envLoading } = useEnvState();
  const { data: tasksData } = useTasks();
  const { data: sessionsData } = useSessions();
  const { data: wsState } = useWorkspaceState();
  const { data: wsTasksData } = useWorkspaceTasks();
  const { data: wsSessionsData } = useWorkspaceSessions();

  const isWebNavActive = envState?.is_active;
  const isWorkspaceActive = wsState?.is_active;
  const totalSessions = (sessionsData?.total_sessions ?? 0) + (wsSessionsData?.total_sessions ?? 0);
  const allSessions = [...(sessionsData?.sessions ?? []), ...(wsSessionsData?.sessions ?? [])];
  const avgScore = allSessions.length
    ? allSessions.reduce((a, b) => a + (b.grader_score ?? 0), 0) / allSessions.length
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Environment Overview</h1>
        <p className="text-muted-foreground">Monitor and manage your AI agent training sessions.</p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Web Nav</CardTitle>
            <Activity className={`w-4 h-4 ${isWebNavActive ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isWebNavActive ? "Running" : "Idle"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isWebNavActive ? `Session: ${envState.session_id.substring(0, 8)}…` : "Ready to start"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workspace</CardTitle>
            <BriefcaseBusiness className={`w-4 h-4 ${isWorkspaceActive ? "text-violet-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isWorkspaceActive ? "Running" : "Idle"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isWorkspaceActive ? `Session: ${wsState.session_id?.substring(0, 8)}…` : "Ready to start"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            <ClockIcon className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {sessionsData?.total_sessions ?? 0} web · {wsSessionsData?.total_sessions ?? 0} workspace
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Grader Score</CardTitle>
            <Trophy className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all environments</p>
          </CardContent>
        </Card>
      </div>

      {/* Environment cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Web Navigation */}
        <Card className="glow-effect bg-card/80 backdrop-blur-md border-white/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-500 opacity-50" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <CardTitle className="text-base">Web Navigation</CardTitle>
              </div>
              <Badge variant="outline" className={isWebNavActive ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-muted-foreground border-white/10"}>
                {isWebNavActive ? "Active" : "Idle"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">E-commerce navigation for shopping task completion</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isWebNavActive && envState?.observation ? (
              <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-sm">
                <span className="text-muted-foreground">Task: </span>
                <span className="font-medium">{envState.observation.task_description}</span>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Step {envState.observation.step_count}</span>
                  <span className="text-emerald-400 font-mono">+{envState.observation.total_reward.toFixed(3)}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-black/10 rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground text-center">
                {envLoading ? "Loading…" : "No active session"}
              </div>
            )}
            <div className="flex gap-2">
              <Link href="/tasks" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <Target className="w-3 h-3 mr-1.5" /> {tasksData?.tasks.length ?? 0} Tasks
                </Button>
              </Link>
              <Link href="/simulation" className="flex-1">
                <Button size="sm" className="w-full text-xs">
                  Open Runner <ArrowRight className="w-3 h-3 ml-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Workspace Assistant */}
        <Card className="bg-card/80 backdrop-blur-md border-white/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 opacity-50" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <BriefcaseBusiness className="w-4 h-4 text-violet-400" />
                </div>
                <CardTitle className="text-base">Workspace Assistant</CardTitle>
              </div>
              <Badge variant="outline" className={isWorkspaceActive ? "text-violet-400 border-violet-500/30 bg-violet-500/10" : "text-muted-foreground border-white/10"}>
                {isWorkspaceActive ? "Active" : "Idle"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email, calendar & document productivity tasks</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isWorkspaceActive && wsState?.observation ? (
              <div className="p-3 bg-black/20 rounded-lg border border-white/5 text-sm">
                <span className="text-muted-foreground">Task: </span>
                <span className="font-medium">{(wsState.observation as any)?.current_task}</span>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Step {(wsState.observation as any)?.step_count}</span>
                  <span className="text-violet-400 font-mono">+{((wsState.observation as any)?.total_reward ?? 0).toFixed(3)}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-black/10 rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground text-center">
                No active session
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Mail, label: "Email", color: "text-blue-400" },
                { icon: Calendar, label: "Calendar", color: "text-violet-400" },
                { icon: FolderOpen, label: "Docs", color: "text-amber-400" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="bg-black/20 rounded-lg p-2 border border-white/5 flex flex-col items-center gap-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Link href="/workspace/tasks" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <Target className="w-3 h-3 mr-1.5" /> {wsTasksData?.tasks?.length ?? 0} Tasks
                </Button>
              </Link>
              <Link href="/workspace" className="flex-1">
                <Button size="sm" className="w-full text-xs bg-violet-600 hover:bg-violet-700">
                  Open Runner <ArrowRight className="w-3 h-3 ml-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent runs across both envs */}
      <Card className="bg-card/50 backdrop-blur-sm border-white/5">
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allSessions
              .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
              .slice(0, 8)
              .map((session) => (
                <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{session.task_name}</div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {session.steps_taken} steps</span>
                      {session.completed && <Badge variant="success" className="px-1.5 py-0 text-[10px]">Done</Badge>}
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <div className="font-mono text-sm text-emerald-400">+{session.total_reward.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            {allSessions.length === 0 && (
              <div className="col-span-4 text-sm text-muted-foreground text-center py-6">
                No sessions yet. Start a task to see history here.
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <Link href="/history">
              <Button variant="ghost" className="text-xs text-muted-foreground">Web Nav History</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
