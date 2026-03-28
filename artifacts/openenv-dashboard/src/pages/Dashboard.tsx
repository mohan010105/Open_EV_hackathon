import React from "react";
import { useEnvState, useTasks, useSessions } from "@/hooks/use-env";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui";
import { Activity, Target, Trophy, Clock, ArrowRight, Box } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: envState, isLoading: envLoading } = useEnvState();
  const { data: tasksData } = useTasks();
  const { data: sessionsData } = useSessions();

  const isSessionActive = envState?.is_active;

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <Activity className={`w-4 h-4 ${isSessionActive ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isSessionActive ? "Running" : "Idle"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {isSessionActive ? `Session: ${envState.session_id.substring(0,8)}...` : "Ready to start"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Tasks</CardTitle>
            <Target className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasksData?.tasks.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured for training</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
            <HistoryIcon className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionsData?.total_sessions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed runs</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Grader Score</CardTitle>
            <Trophy className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionsData?.sessions.length 
                ? (sessionsData.sessions.reduce((a,b)=>a+(b.grader_score||0),0) / sessionsData.sessions.length).toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all tasks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Session Panel */}
        <Card className="lg:col-span-2 glow-effect bg-card/80 backdrop-blur-md border-white/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-50"></div>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            {envLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : isSessionActive && envState?.observation ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                  <div>
                    <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">Active Task</Badge>
                    <h4 className="font-semibold text-lg">{envState.observation.task_description}</h4>
                    <p className="text-sm text-muted-foreground font-mono mt-1">ID: {envState.observation.task_id}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-display font-bold text-emerald-400">{envState.observation.total_reward.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reward</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                      <span className="text-muted-foreground text-sm font-medium mb-1">Current Page</span>
                      <Badge variant="secondary" className="text-sm px-3 py-1 bg-white/10">{envState.observation.page}</Badge>
                   </div>
                   <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                      <span className="text-muted-foreground text-sm font-medium mb-1">Steps Taken</span>
                      <div className="text-2xl font-mono text-white">{envState.observation.step_count}</div>
                   </div>
                </div>

                <Link href="/simulation">
                  <Button className="w-full group">
                    View Interactive Runner
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/50 rounded-xl">
                <Box className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No active session running.</p>
                <Link href="/tasks">
                  <Button variant="outline">Select a Task to Start</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessionsData?.sessions.slice(0, 4).map((session) => (
                <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div>
                    <div className="font-medium text-sm text-foreground line-clamp-1">{session.task_name}</div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {session.steps_taken} steps</span>
                      {session.completed && <Badge variant="success" className="px-1.5 py-0 text-[10px]">Done</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-emerald-400">+{session.total_reward.toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {(!sessionsData?.sessions || sessionsData.sessions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>
              )}
            </div>
            <Link href="/history">
              <Button variant="ghost" className="w-full mt-4 text-xs text-muted-foreground">View All History</Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function HistoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>;
}
