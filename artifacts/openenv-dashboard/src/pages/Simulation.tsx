import React, { useState, useEffect } from "react";
import { useEnvState, useEnvStep, useEnvReset } from "@/hooks/use-env";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from "@/components/ui";
import { BrowserMockup } from "@/components/BrowserMockup";
import { Play, RotateCcw, AlertCircle, Search, MousePointerClick, ShoppingCart, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Simulation() {
  const { data: envState, isLoading: envLoading } = useEnvState();
  const { mutate: stepMutate, isPending: isStepping } = useEnvStep();
  const { mutate: resetMutate, isPending: isResetting } = useEnvReset();

  const [history, setHistory] = useState<{step: number, reward: number}[]>([]);
  const [paramInputs, setParamInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    // Keep local chart history updated
    if (envState?.observation) {
      setHistory(prev => {
        const step = envState.observation.step_count;
        if (prev.find(p => p.step === step)) return prev;
        // If it's step 0, reset history
        if (step === 0) return [{ step: 0, reward: envState.observation.total_reward }];
        return [...prev, { step, reward: envState.observation.total_reward }];
      });
    }
  }, [envState?.observation]);

  const handleAction = (action: string, params?: any) => {
    stepMutate({ action, params: params || {} });
    setParamInputs({}); // clear inputs after action
  };

  const handleReset = () => {
    resetMutate({});
  };

  if (envLoading && !envState) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const isActive = envState?.is_active;
  const obs = envState?.observation;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulation Runner</h1>
          <p className="text-muted-foreground text-sm">Interactive step-by-step environment control</p>
        </div>
        <Button onClick={handleReset} disabled={isResetting} variant="outline" className="bg-background">
          <RotateCcw className={`w-4 h-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />
          Reset Environment
        </Button>
      </div>

      {!isActive ? (
        <Card className="flex-1 flex flex-col items-center justify-center border-dashed border-2 bg-card/30">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">No Active Session</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            The environment needs to be reset or a task selected to begin a session.
          </p>
          <Button onClick={handleReset} size="lg" disabled={isResetting}>
            {isResetting ? "Initializing..." : "Start Random Task"}
          </Button>
        </Card>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* Main Browser View */}
          <div className="flex-1 flex flex-col rounded-xl overflow-hidden border-2 border-white/10 shadow-2xl relative min-h-[500px]">
            <div className="bg-slate-900 px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-black/50 font-mono text-[10px] text-muted-foreground border-white/10">
                  PAGE: {obs?.page.toUpperCase()}
                </Badge>
                {isStepping && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </div>
              <div className="text-xs font-mono text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">
                REWARD: {obs?.total_reward.toFixed(2)}
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden pointer-events-none opacity-90 transition-opacity">
               {/* Note: We wrapper BrowserMockup to look like it's inside our dashboard, and pass actions to it so if user clicks it executes step */}
               <div className="w-full h-full pointer-events-auto">
                 <BrowserMockup observation={obs} onAction={handleAction} />
               </div>
            </div>

            {/* Loading overlay for step execution */}
            {isStepping && (
               <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
               </div>
            )}
          </div>

          {/* Side Control Panel */}
          <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
            
            <Card className="bg-card/80 backdrop-blur-xl border-white/10 shrink-0">
              <CardHeader className="py-4 border-b border-white/5">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Current Task</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm font-medium leading-relaxed">{obs?.task_description}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>STEP: {obs?.step_count}</span>
                  <span>ID: {obs?.task_id.split('-')[0]}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col min-h-0 bg-card/80 backdrop-blur-xl border-white/10">
              <CardHeader className="py-4 border-b border-white/5 shrink-0">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center">
                  <Play className="w-4 h-4 mr-2 text-primary" />
                  Available Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex-1 overflow-auto space-y-3">
                {obs?.available_actions.map(action => (
                  <div key={action} className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-xs text-primary font-bold">{action}</code>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={() => handleAction(action, paramInputs[action] ? { 
                          [action === 'search_product' ? 'product_name' : 'product_id']: paramInputs[action] 
                        } : undefined)}
                        disabled={isStepping}
                      >
                        Execute
                      </Button>
                    </div>
                    
                    {/* Render input field if action requires parameters */}
                    {action === 'search_product' && (
                      <Input 
                        placeholder="product_name..." 
                        className="h-8 text-xs bg-black/40"
                        value={paramInputs[action] || ''}
                        onChange={(e) => setParamInputs(prev => ({...prev, [action]: e.target.value}))}
                      />
                    )}
                    {action === 'click_product' && (
                      <Input 
                        placeholder="product_id..." 
                        className="h-8 text-xs bg-black/40"
                        value={paramInputs[action] || ''}
                        onChange={(e) => setParamInputs(prev => ({...prev, [action]: e.target.value}))}
                      />
                    )}
                  </div>
                ))}

                {obs?.available_actions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No actions available.</p>
                )}
              </CardContent>
            </Card>

            <Card className="h-48 shrink-0 bg-card/80 backdrop-blur-xl border-white/10 flex flex-col">
               <CardHeader className="py-3 border-b border-white/5 shrink-0">
                 <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reward History</CardTitle>
               </CardHeader>
               <CardContent className="p-0 flex-1 min-h-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="step" hide />
                      <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ display: 'none' }}
                      />
                      <Area type="stepAfter" dataKey="reward" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorReward)" />
                    </AreaChart>
                 </ResponsiveContainer>
               </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}
