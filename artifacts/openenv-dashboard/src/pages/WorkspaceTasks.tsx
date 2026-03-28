import React from "react";
import { useWorkspaceTasks, useWorkspaceReset } from "@/hooks/use-workspace";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { Mail, Calendar, FolderOpen, PlayCircle, Loader2, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { WorkspaceTask } from "@workspace/api-client-react";

const TASK_ICONS: Record<string, React.ElementType> = {
  ws_task_1: Mail,
  ws_task_2: Calendar,
  ws_task_3: FolderOpen,
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  hard: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function WorkspaceTasks() {
  const { data, isLoading } = useWorkspaceTasks();
  const { mutate: resetWorkspace, isPending } = useWorkspaceReset();
  const [, setLocation] = useLocation();

  const handleStart = (taskId: string) => {
    resetWorkspace({ taskId }, { onSuccess: () => setLocation("/workspace") });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Workspace Tasks</h1>
        <p className="text-muted-foreground">Select a productivity task to start an agent training session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data?.tasks?.map((task: WorkspaceTask) => {
          const Icon = TASK_ICONS[task.id] ?? Zap;
          return (
            <Card key={task.id} className="group hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm border-white/5 flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="outline" className={`capitalize ${DIFFICULTY_STYLES[task.difficulty]}`}>
                    {task.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{task.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground mb-4 flex-1">{task.description}</p>

                <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-5 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/60">Goal: </span>{task.goal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/60">Max Steps: </span>
                    <span className="font-mono text-white">{task.max_steps}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground font-medium">Rewards: </span>
                    {Object.entries(task.reward_breakdown ?? {})
                      .filter(([, v]) => (v as number) !== 0)
                      .slice(0, 3)
                      .map(([k, v]) => (
                        <span key={k} className={`inline-flex items-center gap-0.5 mr-2 ${(v as number) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(v as number) > 0 ? "+" : ""}{v as number}
                        </span>
                      ))}
                  </div>
                </div>

                <Button className="w-full" onClick={() => handleStart(task.id)} disabled={isPending}>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {isPending ? "Starting..." : "Start Session"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
