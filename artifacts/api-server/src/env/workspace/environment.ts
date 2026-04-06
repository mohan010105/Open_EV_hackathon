/**
 * Workspace Assistant RL environment.
 * Simulates: Email Inbox, Calendar, Document Manager, Task Manager.
 *
 * Features:
 *   • Dynamic task generation (Feature 1)
 *   • Environment randomization with seed (Feature 2)
 *   • Difficulty levels — easy / medium / hard (Feature 3)
 *   • Performance metrics tracking (Feature 4)
 *   • Leaderboard system (Feature 5)
 *   • Training vs evaluation mode (Feature 7)
 */

import { randomUUID } from "crypto";
import { WorkspaceState, WorkspaceApp, WorkspaceHistoryEntry } from "./state.js";
import { WorkspaceTask, WORKSPACE_TASKS, getWorkspaceTaskById, getRandomWorkspaceTask } from "./tasks.js";
import { Email, CalendarEvent, Document, SEED_EMAILS, SEED_CALENDAR_EVENTS, SEED_DOCUMENTS, AVAILABLE_FOLDERS } from "./data.js";
import { gradeWorkspaceTask, WorkspaceGradeResult } from "./graders.js";

// ── Available actions per app ──────────────────────────────────────────────────
const APP_ACTIONS: Record<WorkspaceApp, string[]> = {
  email_inbox:  ["open_email_inbox", "search_email", "read_email", "view_calendar", "view_documents", "noop"],
  email_detail: ["open_email_inbox", "extract_meeting_details", "create_calendar_event", "view_calendar", "view_documents", "noop"],
  calendar:     ["view_calendar", "create_calendar_event", "open_email_inbox", "view_documents", "noop"],
  documents:    ["view_documents", "move_document", "open_email_inbox", "view_calendar", "noop"],
  task_manager: ["open_email_inbox", "view_calendar", "view_documents", "noop"],
};

// ── Difficulty dataset sizes ───────────────────────────────────────────────────
const DIFFICULTY_EMAIL_COUNT: Record<Difficulty, number> = { easy: 3, medium: 5, hard: 8 };
const DIFFICULTY_DOC_COUNT:   Record<Difficulty, number> = { easy: 3, medium: 5, hard: 8 };

export type Difficulty = "easy" | "medium" | "hard";
export type Mode       = "training" | "evaluation";

// ── Public observation type ───────────────────────────────────────────────────
export interface WorkspaceObservation {
  current_app:     WorkspaceApp;
  email_list:      Email[];
  selected_email:  Email | null;
  calendar_events: CalendarEvent[];
  documents:       Document[];
  current_task:    string;
  available_actions: string[];
  task_id:         string;
  task_description: string;
  step_count:      number;
  total_reward:    number;
}

export interface WorkspaceStepResult {
  observation: WorkspaceObservation;
  reward:      number;
  done:        boolean;
  info:        Record<string, unknown>;
}

// ── Session history record ────────────────────────────────────────────────────
export interface WorkspaceSessionRecord {
  session_id:   string;
  task_id:      string;
  task_name:    string;
  agent_name:   string;
  difficulty:   Difficulty;
  mode:         Mode;
  total_reward: number;
  steps_taken:  number;
  completed:    boolean;
  grader_score: number;
  started_at:   string;
  ended_at:     string | null;
}

// ── Episode replay step ───────────────────────────────────────────────────────
export interface ReplayStep {
  step:         number;
  action:       string;
  reward:       number;
  total_reward: number;
  action_valid: boolean;
  reason:       string;
}

// ── Internal episode replay buffer ────────────────────────────────────────────
interface EpisodeReplay {
  session_id: string;
  task_id:    string;
  task_name:  string;
  difficulty: Difficulty;
  mode:       Mode;
  in_progress: boolean;
  total_steps: number;
  steps:      ReplayStep[];
}

// ── Metrics response ──────────────────────────────────────────────────────────
export interface MetricsResponse {
  episode_count: number;
  success_rate:  number;
  avg_reward:    number;
  avg_steps:     number;
  avg_score:     number;
  by_task:       Record<string, { name: string; episodes: number; success_rate: number; avg_reward: number }>;
  by_difficulty: Record<Difficulty, { episodes: number; success_rate: number; avg_reward: number }>;
}

// ── Leaderboard entry ─────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank:           number;
  agent:          string;
  average_score:  number;
  average_reward: number;
  episodes_run:   number;
  win_rate:       number;
  last_active:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  WorkspaceEnvironment
// ─────────────────────────────────────────────────────────────────────────────

export class WorkspaceEnvironment {
  private state:       WorkspaceState | null = null;
  private task:        WorkspaceTask  | null = null;
  private difficulty:  Difficulty            = "medium";
  private mode:        Mode                  = "training";
  private agentName:   string               = "agent";

  private sessions:    WorkspaceSessionRecord[] = [];
  private replayBuffer: EpisodeReplay | null     = null;

  // ── RL Interface ─────────────────────────────────────────────────────────

  reset(
    taskId?:     string,
    seed?:       number,
    difficulty?: Difficulty,
    mode?:       Mode,
    agentName?:  string,
  ): WorkspaceStepResult {
    if (this.state && this.task) this.finalizeSession();

    // Configuration
    this.difficulty = difficulty ?? "medium";
    this.mode       = mode       ?? "training";
    this.agentName  = agentName  ?? "agent";

    const task = taskId ? (getWorkspaceTaskById(taskId) ?? getRandomWorkspaceTask()) : getRandomWorkspaceTask();
    this.task = task;

    // Seed-based shuffle for deterministic environment (Feature 2)
    const emails    = this.sliceBySeed(SEED_EMAILS.map(e => ({ ...e })),   seed, DIFFICULTY_EMAIL_COUNT[this.difficulty]);
    const documents = this.sliceBySeed(SEED_DOCUMENTS.map(d => ({ ...d })), seed, DIFFICULTY_DOC_COUNT[this.difficulty]);

    this.state = {
      session_id:                randomUUID(),
      task_id:                   task.id,
      current_app:               "task_manager",
      email_list:                emails,
      selected_email:            null,
      calendar_events:           SEED_CALENDAR_EVENTS.map(e => ({ ...e })),
      documents,
      read_email_ids:            new Set(),
      last_search_query:         null,
      extracted_meeting_details: false,
      document_moves:            {},
      step_count:                0,
      total_reward:              0,
      is_done:                   false,
      history:                   [],
      created_at:                new Date().toISOString(),
      ended_at:                  null,
    };

    // Initialise replay buffer
    this.replayBuffer = {
      session_id:  this.state.session_id,
      task_id:     task.id,
      task_name:   task.name,
      difficulty:  this.difficulty,
      mode:        this.mode,
      in_progress: true,
      total_steps: 0,
      steps:       [],
    };

    return {
      observation: this.buildObservation(),
      reward: 0,
      done:   false,
      info:   { step_reward_reason: "Workspace environment reset", action_valid: true, difficulty: this.difficulty, mode: this.mode },
    };
  }

  step(action: string, params: Record<string, unknown> = {}): WorkspaceStepResult {
    if (!this.state || !this.task) return this.errorResult("Call reset() first.");
    if (this.state.is_done) return this.errorResult("Episode done. Call reset().");

    this.state.step_count += 1;
    let reward     = 0;
    let reason     = "";
    let actionValid = true;

    const validActions = APP_ACTIONS[this.state.current_app];
    if (!validActions.includes(action)) {
      reward      = this.task.reward_breakdown.invalid_navigation;
      reason      = `Invalid action '${action}' on app '${this.state.current_app}'`;
      actionValid = false;
    } else {
      switch (action) {
        case "open_email_inbox":
          ({ reward, reason } = this.doOpenInbox());
          break;
        case "search_email": {
          const sender = typeof params.sender === "string" ? params.sender : "";
          ({ reward, reason } = this.doSearchEmail(sender));
          break;
        }
        case "read_email": {
          const emailId = typeof params.email_id === "string" ? params.email_id : "";
          ({ reward, reason } = this.doReadEmail(emailId));
          break;
        }
        case "extract_meeting_details":
          ({ reward, reason } = this.doExtractMeeting());
          break;
        case "create_calendar_event":
          ({ reward, reason } = this.doCreateCalendarEvent());
          break;
        case "view_calendar":
          ({ reward, reason } = this.doViewCalendar());
          break;
        case "view_documents":
          ({ reward, reason } = this.doViewDocuments());
          break;
        case "move_document": {
          const docId  = typeof params.document_id === "string" ? params.document_id : "";
          const folder = typeof params.folder       === "string" ? params.folder       : "";
          ({ reward, reason } = this.doMoveDocument(docId, folder));
          break;
        }
        case "noop":
          reward = 0;
          reason = "No operation";
          break;
        default:
          reward      = this.task.reward_breakdown.incorrect_action;
          reason      = `Unknown action: ${action}`;
          actionValid = false;
      }
    }

    // In evaluation mode suppress intermediate rewards outside defined bands
    const rawReward = reward;
    if (this.mode === "evaluation" && Math.abs(rawReward) < 0.2 && rawReward > 0) {
      reward = 0; // only terminal / strong rewards visible in eval
    }

    this.state.total_reward = Math.max(0, Math.min(1.0, this.state.total_reward + rawReward));
    this.state.history.push({ app: this.state.current_app, action, step: this.state.step_count });

    // Record in replay buffer
    if (this.replayBuffer) {
      this.replayBuffer.steps.push({
        step:         this.state.step_count,
        action,
        reward:       rawReward,
        total_reward: this.state.total_reward,
        action_valid: actionValid,
        reason,
      });
      this.replayBuffer.total_steps = this.state.step_count;
    }

    const grade = gradeWorkspaceTask(this.state, this.task);
    const done  = grade.passed || this.state.step_count >= this.task.max_steps;

    const info: Record<string, unknown> = { action_valid: actionValid, step_reward_reason: reason, reason };
    if (done) {
      this.state.is_done  = true;
      this.state.ended_at = new Date().toISOString();
      if (this.replayBuffer) this.replayBuffer.in_progress = false;
      this.finalizeSession(grade);
      info.grade = grade;
    }

    return { observation: this.buildObservation(), reward, done, info };
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  getState() {
    if (!this.state || !this.task) {
      return {
        observation: this.emptyObservation(),
        session_id:  "",
        is_active:   false,
        difficulty:  this.difficulty,
        mode:        this.mode,
        created_at:  new Date().toISOString(),
      };
    }
    return {
      observation: this.buildObservation(),
      session_id:  this.state.session_id,
      is_active:   !this.state.is_done,
      difficulty:  this.difficulty,
      mode:        this.mode,
      created_at:  this.state.created_at,
    };
  }

  getTasks()    { return WORKSPACE_TASKS; }
  getSessions() { return { sessions: [...this.sessions].reverse(), total_sessions: this.sessions.length }; }

  /** Feature 4 — Performance Metrics */
  getMetrics(): MetricsResponse {
    const done = this.sessions.filter(s => s.ended_at);
    if (done.length === 0) {
      return {
        episode_count: 0, success_rate: 0, avg_reward: 0,
        avg_steps: 0, avg_score: 0, by_task: {}, by_difficulty: { easy: { episodes:0, success_rate:0, avg_reward:0 }, medium: { episodes:0, success_rate:0, avg_reward:0 }, hard: { episodes:0, success_rate:0, avg_reward:0 } },
      };
    }
    const n         = done.length;
    const successes = done.filter(s => s.completed).length;

    const byTask:       MetricsResponse["by_task"]       = {};
    const byDifficulty: MetricsResponse["by_difficulty"] = {
      easy:   { episodes: 0, success_rate: 0, avg_reward: 0 },
      medium: { episodes: 0, success_rate: 0, avg_reward: 0 },
      hard:   { episodes: 0, success_rate: 0, avg_reward: 0 },
    };

    for (const s of done) {
      // by task
      if (!byTask[s.task_id]) byTask[s.task_id] = { name: s.task_name, episodes: 0, success_rate: 0, avg_reward: 0 };
      byTask[s.task_id].episodes     += 1;
      byTask[s.task_id].avg_reward   += s.total_reward;
      if (s.completed) byTask[s.task_id].success_rate += 1;

      // by difficulty
      const d = byDifficulty[s.difficulty];
      d.episodes   += 1;
      d.avg_reward += s.total_reward;
      if (s.completed) d.success_rate += 1;
    }

    // normalise
    for (const v of Object.values(byTask)) {
      v.avg_reward   = round(v.avg_reward   / v.episodes);
      v.success_rate = round(v.success_rate / v.episodes);
    }
    for (const v of Object.values(byDifficulty)) {
      if (v.episodes > 0) {
        v.avg_reward   = round(v.avg_reward   / v.episodes);
        v.success_rate = round(v.success_rate / v.episodes);
      }
    }

    return {
      episode_count: n,
      success_rate:  round(successes / n),
      avg_reward:    round(done.reduce((s, r) => s + r.total_reward,  0) / n),
      avg_steps:     round(done.reduce((s, r) => s + r.steps_taken,   0) / n),
      avg_score:     round(done.reduce((s, r) => s + r.grader_score,  0) / n),
      by_task:       byTask,
      by_difficulty: byDifficulty,
    };
  }

  /** Feature 5 — Leaderboard */
  getLeaderboard(): { leaderboard: LeaderboardEntry[] } {
    const agentMap: Record<string, { scores: number[]; rewards: number[]; wins: number; last: string }> = {};

    for (const s of this.sessions.filter(s => s.ended_at)) {
      if (!agentMap[s.agent_name]) agentMap[s.agent_name] = { scores: [], rewards: [], wins: 0, last: s.ended_at! };
      const a = agentMap[s.agent_name];
      a.scores.push(s.grader_score);
      a.rewards.push(s.total_reward);
      if (s.completed) a.wins += 1;
      if (s.ended_at! > a.last) a.last = s.ended_at!;
    }

    const entries: LeaderboardEntry[] = Object.entries(agentMap).map(([agent, a]) => ({
      rank:           0,
      agent,
      average_score:  round(a.scores.reduce((x, y) => x + y, 0)  / a.scores.length),
      average_reward: round(a.rewards.reduce((x, y) => x + y, 0) / a.rewards.length),
      episodes_run:   a.scores.length,
      win_rate:       round(a.wins / a.scores.length),
      last_active:    a.last,
    }));

    entries.sort((a, b) => b.average_score - a.average_score);
    entries.forEach((e, i) => { e.rank = i + 1; });
    return { leaderboard: entries };
  }

  /** Feature 6 — Episode Replay */
  getEpisodeReplay(): EpisodeReplay {
    if (!this.replayBuffer) {
      return { session_id: "", task_id: "", task_name: "", difficulty: "medium", mode: "training", in_progress: false, total_steps: 0, steps: [] };
    }
    return { ...this.replayBuffer };
  }

  // ── Action handlers ────────────────────────────────────────────────────

  private doOpenInbox() {
    const was = this.state!.current_app === "email_inbox";
    this.state!.current_app   = "email_inbox";
    this.state!.selected_email = null;
    if (was) return { reward: 0, reason: "Already in inbox" };
    return { reward: this.task!.reward_breakdown.open_inbox, reason: "Opened email inbox" };
  }

  private doSearchEmail(sender: string) {
    if (!sender) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "search_email requires params.sender" };
    this.state!.current_app     = "email_inbox";
    this.state!.last_search_query = sender;
    const matched = this.state!.email_list.filter(e => e.sender.toLowerCase().includes(sender.toLowerCase()));
    const hitTarget = matched.some(e => e.id === this.task!.target_email_id);
    if (hitTarget) return { reward: this.task!.reward_breakdown.find_email,       reason: `Found emails from '${sender}'` };
    return             { reward: this.task!.reward_breakdown.find_email * 0.3, reason: `Searched '${sender}', target not matched` };
  }

  private doReadEmail(emailId: string) {
    const email = this.state!.email_list.find(e => e.id === emailId);
    if (!email) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Email '${emailId}' not found` };
    this.state!.current_app    = "email_detail";
    this.state!.selected_email = email;
    email.read = true;
    this.state!.read_email_ids.add(emailId);
    const isTarget = emailId === this.task!.target_email_id;
    if (isTarget) return { reward: this.task!.reward_breakdown.read_email,                  reason: `Read target email from ${email.sender}` };
    return               { reward: this.task!.reward_breakdown.incorrect_action * 0.5, reason: `Read non-target email from ${email.sender}` };
  }

  private doExtractMeeting() {
    if (!this.state!.selected_email)                      return { reward: this.task!.reward_breakdown.incorrect_action, reason: "No email selected" };
    if (!this.state!.selected_email.has_meeting_details)  return { reward: this.task!.reward_breakdown.incorrect_action, reason: "Selected email has no meeting details" };
    this.state!.extracted_meeting_details = true;
    return { reward: this.task!.reward_breakdown.extract_meeting, reason: "Extracted meeting details from email" };
  }

  private doCreateCalendarEvent() {
    if (!this.state!.selected_email) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "No email selected" };
    const isFromTarget = this.state!.selected_email.id === this.task!.target_email_id;
    const newEvent: CalendarEvent = {
      id:                 `cal_${Date.now()}`,
      title:              this.state!.selected_email.subject,
      date:               this.task!.meeting_date ?? "2026-03-29",
      time:               this.task!.meeting_time ?? "15:00",
      attendees:          [this.state!.selected_email.sender],
      location:           "Conference Room B",
      created_from_email: true,
    };
    this.state!.calendar_events.push(newEvent);
    this.state!.current_app = "calendar";
    if (isFromTarget) return { reward: this.task!.reward_breakdown.create_event,     reason: "Created calendar event from target email" };
    return                  { reward: this.task!.reward_breakdown.incorrect_action,  reason: "Created event from wrong email" };
  }

  private doViewCalendar() {
    this.state!.current_app = "calendar";
    return { reward: 0, reason: "Switched to calendar view" };
  }

  private doViewDocuments() {
    this.state!.current_app = "documents";
    return { reward: 0, reason: "Switched to documents view" };
  }

  private doMoveDocument(docId: string, folder: string) {
    if (!docId || !folder)             return { reward: this.task!.reward_breakdown.incorrect_action, reason: "move_document requires document_id and folder" };
    if (!AVAILABLE_FOLDERS.includes(folder)) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Invalid folder: '${folder}'` };
    const doc = this.state!.documents.find(d => d.id === docId);
    if (!doc)                          return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Document '${docId}' not found` };
    doc.folder = folder;
    this.state!.document_moves[docId] = folder;
    const correctDoc    = docId  === this.task!.target_document_id;
    const correctFolder = folder === this.task!.target_folder;
    if (correctDoc && correctFolder) return { reward: this.task!.reward_breakdown.move_document, reason: `Moved '${doc.name}' to '${folder}'` };
    if (correctDoc)                  return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Correct document, wrong folder '${folder}'` };
    return                                  { reward: this.task!.reward_breakdown.incorrect_action, reason: `Wrong document '${doc.name}'` };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private buildObservation(): WorkspaceObservation {
    return {
      current_app:      this.state!.current_app,
      email_list:       this.getVisibleEmails(),
      selected_email:   this.state!.selected_email,
      calendar_events:  this.state!.calendar_events,
      documents:        this.state!.documents,
      current_task:     this.task!.goal,
      available_actions: APP_ACTIONS[this.state!.current_app],
      task_id:          this.task!.id,
      task_description: this.task!.description,
      step_count:       this.state!.step_count,
      total_reward:     this.state!.total_reward,
    };
  }

  private getVisibleEmails(): Email[] {
    if (!this.state!.last_search_query) return this.state!.email_list;
    const q = this.state!.last_search_query.toLowerCase();
    return this.state!.email_list.filter(e =>
      e.sender.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q),
    );
  }

  private emptyObservation(): WorkspaceObservation {
    return {
      current_app:      "task_manager",
      email_list:       [],
      selected_email:   null,
      calendar_events:  [],
      documents:        [],
      current_task:     "No active session. Call reset() to start.",
      available_actions: ["open_email_inbox", "view_calendar", "view_documents", "noop"],
      task_id:          "",
      task_description: "No active session",
      step_count:       0,
      total_reward:     0,
    };
  }

  private finalizeSession(grade?: WorkspaceGradeResult) {
    if (!this.state || !this.task) return;
    this.sessions.push({
      session_id:   this.state.session_id,
      task_id:      this.task.id,
      task_name:    this.task.name,
      agent_name:   this.agentName,
      difficulty:   this.difficulty,
      mode:         this.mode,
      total_reward: this.state.total_reward,
      steps_taken:  this.state.step_count,
      completed:    grade?.passed ?? false,
      grader_score: grade?.score  ?? 0,
      started_at:   this.state.created_at,
      ended_at:     this.state.ended_at ?? new Date().toISOString(),
    });
  }

  /** Seed-based deterministic shuffle + slice for dataset subsets (Feature 2 + 3) */
  private sliceBySeed<T>(arr: T[], seed: number | undefined, count: number): T[] {
    const copy = [...arr];
    if (seed !== undefined) {
      // Simple seeded Fisher-Yates shuffle
      let s = seed;
      for (let i = copy.length - 1; i > 0; i--) {
        s = ((s * 1664525) + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
    }
    return copy.slice(0, Math.min(count, copy.length));
  }

  private errorResult(message: string): WorkspaceStepResult {
    return { observation: this.getState().observation, reward: 0, done: false, info: { action_valid: false, error: message } };
  }
}

function round(n: number, dp = 4) { return Math.round(n * 10 ** dp) / 10 ** dp; }

export const workspaceEnv = new WorkspaceEnvironment();
