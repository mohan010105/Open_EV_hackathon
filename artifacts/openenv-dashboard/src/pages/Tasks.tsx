import React from "react";
import { useTasks, useEnvReset } from "@/hooks/use-env";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { Target, PlayCircle, Loader2, PackageSearch } from "lucide-react";
import { useLocation } from "wouter";

export default function Tasks() {
  const { data, isLoading } = useTasks();
  const { mutate: resetEnv, isPending } = useEnvReset();
  const [, setLocation] = useLocation();

  const handleStartTask = (taskId: string) => {
    resetEnv({ taskId }, {
      onSuccess: () => {
        setLocation("/simulation");
      }
    });
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'easy': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'hard': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400';
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Available Tasks</h1>
          <p className="text-muted-foreground">Select a task to initialize the environment and start training.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.tasks.map((task) => (
          <Card key={task.id} className="group hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm border-white/5 flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <Badge variant="outline" className={`capitalize ${getDifficultyColor(task.difficulty)}`}>
                  {task.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-xl">{task.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                {task.description}
              </p>
              
              <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-lg border border-white/5">
                <div className="flex items-center text-xs">
                  <PackageSearch className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                  <span className="text-muted-foreground mr-2">Target:</span>
                  <span className="font-mono text-primary font-medium truncate" title={task.target_product}>
                    {task.target_product}
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <PlayCircle className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                  <span className="text-muted-foreground mr-2">Max Steps:</span>
                  <span className="font-mono text-white font-medium">{task.max_steps}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => handleStartTask(task.id)}
                disabled={isPending}
              >
                {isPending ? "Starting..." : "Start Session"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {(!data?.tasks || data.tasks.length === 0) && !isLoading && (
        <div className="text-center py-20 border-2 border-dashed border-border/50 rounded-2xl">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">No tasks available</h3>
          <p className="text-muted-foreground">The environment has no configured tasks.</p>
        </div>
      )}
    </div>
  );
}
