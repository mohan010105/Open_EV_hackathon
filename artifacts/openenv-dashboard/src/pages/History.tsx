import React from "react";
import { useSessions } from "@/hooks/use-env";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { format } from "date-fns";
import { Trophy, Clock, CheckCircle2, XCircle, SearchX } from "lucide-react";

export default function History() {
  const { data, isLoading } = useSessions();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Session History</h1>
        <p className="text-muted-foreground">Review past environment runs and metrics.</p>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-white/5">
        <CardHeader>
          <CardTitle>All Sessions ({data?.total_sessions || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (!data?.sessions || data.sessions.length === 0) ? (
            <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
               <SearchX className="w-12 h-12 mb-4 opacity-30" />
               <p>No history records found.</p>
               <p className="text-sm mt-1 opacity-70">Run some sessions to see them appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-y border-white/5">
                  <tr>
                    <th className="px-6 py-4 font-medium">Session ID / Date</th>
                    <th className="px-6 py-4 font-medium">Task</th>
                    <th className="px-6 py-4 font-medium text-center">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Steps</th>
                    <th className="px-6 py-4 font-medium text-right">Reward</th>
                    <th className="px-6 py-4 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.sessions.map((session) => (
                    <tr key={session.session_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-primary truncate max-w-[150px]">
                          {session.session_id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(session.started_at), "MMM d, HH:mm:ss")}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {session.task_name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {session.completed ? (
                          <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/5">
                            <XCircle className="w-3 h-3 mr-1" /> Terminated
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1.5 opacity-70" />
                          {session.steps_taken}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-bold text-emerald-400">
                          {session.total_reward.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end font-mono">
                          <Trophy className="w-3 h-3 mr-1.5 text-amber-500" />
                          <span className={session.grader_score > 0.8 ? "text-amber-400" : "text-white"}>
                            {(session.grader_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
