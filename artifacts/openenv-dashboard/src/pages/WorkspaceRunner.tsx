import React, { useState } from "react";
import { useWorkspaceState, useWorkspaceStep, useWorkspaceReset } from "@/hooks/use-workspace";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { WorkspaceObservation, Email, CalendarEvent, Document } from "@workspace/api-client-react";
import {
  Mail, Calendar, FolderOpen, CheckSquare, Search, Inbox,
  ArrowRight, RefreshCw, ChevronRight, Clock, Star, FileText,
  Loader2, Play, MailOpen, Plus, FolderInput
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RewardChart } from "@/components/RewardChart";

const APP_ICONS: Record<string, React.ElementType> = {
  email_inbox: Mail,
  email_detail: MailOpen,
  calendar: Calendar,
  documents: FolderOpen,
  task_manager: CheckSquare,
};

const APP_LABELS: Record<string, string> = {
  email_inbox: "Email Inbox",
  email_detail: "Email",
  calendar: "Calendar",
  documents: "Documents",
  task_manager: "Task Manager",
};

const APP_COLORS: Record<string, string> = {
  email_inbox: "text-blue-400",
  email_detail: "text-sky-400",
  calendar: "text-violet-400",
  documents: "text-amber-400",
  task_manager: "text-emerald-400",
};

const ACTION_LABELS: Record<string, string> = {
  open_email_inbox: "Open Inbox",
  search_email: "Search Email",
  read_email: "Read Email",
  extract_meeting_details: "Extract Meeting",
  create_calendar_event: "Schedule Event",
  view_calendar: "View Calendar",
  view_documents: "View Documents",
  move_document: "Move Document",
  noop: "No-Op",
};

type RewardPoint = { step: number; reward: number; total: number };

export default function WorkspaceRunner() {
  const { data: stateData, isLoading } = useWorkspaceState();
  const { mutate: step, isPending: isStepping } = useWorkspaceStep();
  const { mutate: reset, isPending: isResetting } = useWorkspaceReset();

  const [rewardHistory, setRewardHistory] = useState<RewardPoint[]>([]);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [searchSender, setSearchSender] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("Projects");

  const obs = stateData?.observation as WorkspaceObservation | undefined;
  const isActive = stateData?.is_active ?? false;

  const handleAction = (action: string, params?: Record<string, unknown>) => {
    step({ action, params }, {
      onSuccess: (result) => {
        const r = result.reward as number;
        setLastReward(r);
        const totalR = result.observation?.total_reward as number ?? 0;
        const step_count = result.observation?.step_count as number ?? 0;
        setRewardHistory(prev => [...prev, { step: step_count, reward: r, total: totalR }]);
      }
    });
  };

  const handleReset = (taskId?: string) => {
    reset({ taskId }, {
      onSuccess: () => {
        setRewardHistory([]);
        setLastReward(null);
        setSelectedEmailId("");
        setSelectedDocId("");
      }
    });
  };

  const FOLDERS = ["Projects", "HR", "Finance", "Engineering", "Archive"];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Workspace Runner</h1>
          <p className="text-muted-foreground text-sm">
            {obs?.task_description ?? "Start a workspace session to begin agent training."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => handleReset()} disabled={isResetting}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isResetting && "animate-spin")} />
            New Session
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Current App", value: APP_LABELS[obs?.current_app ?? "task_manager"] ?? "–", icon: APP_ICONS[obs?.current_app ?? "task_manager"] ?? CheckSquare, color: APP_COLORS[obs?.current_app ?? "task_manager"] },
          { label: "Task", value: obs?.current_task ?? "No session", icon: Star, color: "text-primary" },
          { label: "Step", value: String(obs?.step_count ?? 0), icon: Play, color: "text-muted-foreground" },
          { label: "Total Reward", value: (obs?.total_reward ?? 0).toFixed(3), icon: Star, color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/50 border-white/5">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4 shrink-0", color)} />
                <span className="font-semibold text-sm truncate">{value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* App switcher */}
          <Card className="bg-card/60 border-white/5">
            <CardContent className="p-4">
              <div className="flex gap-2 flex-wrap">
                {(["email_inbox", "calendar", "documents", "task_manager"] as const).map((app) => {
                  const Icon = APP_ICONS[app];
                  const isApp = obs?.current_app === app || (app === "email_inbox" && obs?.current_app === "email_detail");
                  return (
                    <button
                      key={app}
                      onClick={() => handleAction(app === "email_inbox" ? "open_email_inbox" : app === "calendar" ? "view_calendar" : app === "documents" ? "view_documents" : "noop")}
                      disabled={isStepping || !isActive}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        isApp ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-white/10 hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {APP_LABELS[app]}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* App views */}
          {(!obs || !isActive) && (
            <Card className="bg-card/30 border-dashed border-white/10">
              <CardContent className="p-16 flex flex-col items-center justify-center text-center">
                <CheckSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No active workspace session.</p>
                <Button className="mt-4" onClick={() => handleReset()} disabled={isResetting}>
                  Start Session
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Email inbox */}
          {isActive && (obs?.current_app === "email_inbox" || obs?.current_app === "email_detail") && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="w-4 h-4 text-blue-400" /> Email Inbox
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    <input
                      value={searchSender}
                      onChange={(e) => setSearchSender(e.target.value)}
                      placeholder="Sender name..."
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs w-36 outline-none focus:border-primary"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={isStepping || !searchSender}
                      onClick={() => handleAction("search_email", { sender: searchSender })}>
                      <Search className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {(obs?.email_list ?? []).map((email: Email) => (
                    <div
                      key={email.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors group",
                        obs?.selected_email?.id === email.id && "bg-primary/5 border-l-2 border-primary"
                      )}
                      onClick={() => {
                        setSelectedEmailId(email.id);
                        handleAction("read_email", { email_id: email.id });
                      }}
                    >
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", email.read ? "bg-transparent border border-white/20" : "bg-blue-400")} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className={cn("text-sm font-medium", !email.read && "text-white")}>{email.sender}</span>
                          <span className="text-xs text-muted-foreground">{new Date(email.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground truncate">{email.subject}</p>
                        {email.has_meeting_details && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-400 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" /> Meeting details
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1 shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected email detail */}
          {isActive && obs?.current_app === "email_detail" && obs.selected_email && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MailOpen className="w-4 h-4 text-sky-400" />
                  {obs.selected_email.subject}
                </CardTitle>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">From: <span className="text-foreground">{obs.selected_email.sender}</span> &lt;{obs.selected_email.sender_email}&gt;</p>
                  {obs.selected_email.has_meeting_details && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAction("extract_meeting_details")} disabled={isStepping}>
                        <FileText className="w-3 h-3 mr-1" /> Extract Meeting
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleAction("create_calendar_event")} disabled={isStepping}>
                        <Plus className="w-3 h-3 mr-1" /> Schedule Event
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono bg-black/20 rounded-lg p-4 border border-white/5">
                  {obs.selected_email.body}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Calendar */}
          {isActive && obs?.current_app === "calendar" && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="w-4 h-4 text-violet-400" /> Calendar Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(obs?.calendar_events ?? []).map((event: CalendarEvent) => (
                    <div key={event.id} className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border",
                      event.created_from_email ? "border-violet-500/30 bg-violet-500/5" : "border-white/5 bg-black/20"
                    )}>
                      <div className="bg-violet-500/10 rounded-lg p-2 text-center min-w-[48px]">
                        <div className="text-xs text-violet-400 font-bold">{new Date(event.date + "T00:00:00").toLocaleDateString([], { month: "short" })}</div>
                        <div className="text-lg font-bold leading-none">{new Date(event.date + "T00:00:00").getDate()}</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-0.5">{event.title}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event.time}</span>
                          {event.location && <span>{event.location}</span>}
                        </div>
                        {event.attendees?.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">👥 {event.attendees.join(", ")}</div>
                        )}
                      </div>
                      {event.created_from_email && (
                        <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-500/30 shrink-0">New</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {isActive && obs?.current_app === "documents" && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderOpen className="w-4 h-4 text-amber-400" /> Documents
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={isStepping || !selectedDocId}
                      onClick={() => handleAction("move_document", { document_id: selectedDocId, folder: selectedFolder })}>
                      <FolderInput className="w-3 h-3 mr-1" /> Move
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(obs?.documents ?? []).map((doc: Document) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-white/[0.03] transition-colors",
                        selectedDocId === doc.id ? "border-primary/30 bg-primary/5" : "border-white/5"
                      )}
                    >
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.size} · Modified {doc.modified}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 border-white/10">{doc.folder}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task manager */}
          {isActive && obs?.current_app === "task_manager" && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckSquare className="w-4 h-4 text-emerald-400" /> Task Manager
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <div className="text-xs text-emerald-400 font-semibold mb-1 uppercase tracking-wider">Active Task</div>
                  <p className="text-sm font-medium">{obs?.current_task}</p>
                  <p className="text-xs text-muted-foreground mt-2">{obs?.task_description}</p>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {(obs?.available_actions ?? []).filter(a => a !== "noop").map(action => (
                      <button key={action} onClick={() => handleAction(action)} disabled={isStepping}
                        className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 text-muted-foreground transition-colors">
                        {ACTION_LABELS[action] ?? action}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Last reward */}
          {lastReward !== null && (
            <Card className={cn("border", lastReward > 0 ? "border-emerald-500/30 bg-emerald-500/5" : lastReward < 0 ? "border-red-500/30 bg-red-500/5" : "border-white/5")}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Last Reward</div>
                <div className={cn("text-3xl font-mono font-bold", lastReward > 0 ? "text-emerald-400" : lastReward < 0 ? "text-red-400" : "text-muted-foreground")}>
                  {lastReward > 0 ? "+" : ""}{lastReward.toFixed(3)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reward chart */}
          {rewardHistory.length > 0 && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reward Curve</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <RewardChart data={rewardHistory.map(r => ({ step: r.step, reward: r.total }))} />
              </CardContent>
            </Card>
          )}

          {/* Available actions */}
          {isActive && obs && (
            <Card className="bg-card/60 border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Available Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(obs.available_actions ?? []).map(action => (
                  <button
                    key={action}
                    onClick={() => {
                      if (action === "search_email" && searchSender) handleAction(action, { sender: searchSender });
                      else if (action === "read_email" && selectedEmailId) handleAction(action, { email_id: selectedEmailId });
                      else if (action === "move_document" && selectedDocId) handleAction(action, { document_id: selectedDocId, folder: selectedFolder });
                      else if (!["search_email", "read_email", "move_document"].includes(action)) handleAction(action);
                    }}
                    disabled={isStepping}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all",
                      action === "noop" ? "opacity-40 border-white/5 text-muted-foreground" : "border-white/10 hover:bg-white/5 hover:border-primary/30 text-foreground"
                    )}
                  >
                    <span>{ACTION_LABELS[action] ?? action}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
