/**
 * Workspace Assistant RL environment.
 * Simulates: Email Inbox, Calendar, Document Manager, Task Manager.
 * Implements reset(), step(action), state() interface.
 */

import { randomUUID } from "crypto";
import { WorkspaceState, WorkspaceApp, WorkspaceHistoryEntry } from "./state.js";
import { WorkspaceTask, WORKSPACE_TASKS, getWorkspaceTaskById, getRandomWorkspaceTask } from "./tasks.js";
import { Email, CalendarEvent, Document, SEED_EMAILS, SEED_CALENDAR_EVENTS, SEED_DOCUMENTS, AVAILABLE_FOLDERS } from "./data.js";
import { gradeWorkspaceTask, WorkspaceGradeResult } from "./graders.js";

// Available actions per app
const APP_ACTIONS: Record<WorkspaceApp, string[]> = {
  email_inbox: ["open_email_inbox", "search_email", "read_email", "view_calendar", "view_documents", "noop"],
  email_detail: ["open_email_inbox", "extract_meeting_details", "create_calendar_event", "view_calendar", "view_documents", "noop"],
  calendar: ["view_calendar", "create_calendar_event", "open_email_inbox", "view_documents", "noop"],
  documents: ["view_documents", "move_document", "open_email_inbox", "view_calendar", "noop"],
  task_manager: ["open_email_inbox", "view_calendar", "view_documents", "noop"],
};

export interface WorkspaceObservation {
  current_app: WorkspaceApp;
  email_list: Email[];
  selected_email: Email | null;
  calendar_events: CalendarEvent[];
  documents: Document[];
  current_task: string;
  available_actions: string[];
  task_id: string;
  task_description: string;
  step_count: number;
  total_reward: number;
}

export interface WorkspaceStepResult {
  observation: WorkspaceObservation;
  reward: number;
  done: boolean;
  info: Record<string, unknown>;
}

export interface WorkspaceSessionRecord {
  session_id: string;
  task_id: string;
  task_name: string;
  total_reward: number;
  steps_taken: number;
  completed: boolean;
  grader_score: number;
  started_at: string;
  ended_at: string | null;
}

export class WorkspaceEnvironment {
  private state: WorkspaceState | null = null;
  private task: WorkspaceTask | null = null;
  private sessions: WorkspaceSessionRecord[] = [];

  // ── RL Interface ───────────────────────────────────────────────────────

  reset(taskId?: string, _seed?: number): WorkspaceStepResult {
    if (this.state && this.task) this.finalizeSession();

    const task = taskId ? (getWorkspaceTaskById(taskId) ?? getRandomWorkspaceTask()) : getRandomWorkspaceTask();
    this.task = task;
    this.state = {
      session_id: randomUUID(),
      task_id: task.id,
      current_app: "task_manager",
      email_list: SEED_EMAILS.map((e) => ({ ...e })),
      selected_email: null,
      calendar_events: SEED_CALENDAR_EVENTS.map((e) => ({ ...e })),
      documents: SEED_DOCUMENTS.map((d) => ({ ...d })),
      read_email_ids: new Set(),
      last_search_query: null,
      extracted_meeting_details: false,
      document_moves: {},
      step_count: 0,
      total_reward: 0,
      is_done: false,
      history: [],
      created_at: new Date().toISOString(),
      ended_at: null,
    };

    return {
      observation: this.buildObservation(),
      reward: 0,
      done: false,
      info: { step_reward_reason: "Workspace environment reset", action_valid: true },
    };
  }

  step(action: string, params: Record<string, unknown> = {}): WorkspaceStepResult {
    if (!this.state || !this.task) return this.errorResult("Call reset() first.");
    if (this.state.is_done) return this.errorResult("Episode done. Call reset().");

    this.state.step_count += 1;
    let reward = 0;
    let reason = "";
    let actionValid = true;

    const validActions = APP_ACTIONS[this.state.current_app];
    if (!validActions.includes(action)) {
      reward = this.task.reward_breakdown.invalid_navigation;
      reason = `Invalid action '${action}' on app '${this.state.current_app}'`;
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
          const docId = typeof params.document_id === "string" ? params.document_id : "";
          const folder = typeof params.folder === "string" ? params.folder : "";
          ({ reward, reason } = this.doMoveDocument(docId, folder));
          break;
        }
        case "noop":
          reward = 0;
          reason = "No operation";
          break;
        default:
          reward = this.task.reward_breakdown.incorrect_action;
          reason = `Unknown action: ${action}`;
          actionValid = false;
      }
    }

    this.state.total_reward = Math.max(0, Math.min(1.0, this.state.total_reward + reward));
    this.state.history.push({
      app: this.state.current_app,
      action,
      step: this.state.step_count,
    });

    const grade = gradeWorkspaceTask(this.state, this.task);
    const done = grade.passed || this.state.step_count >= this.task.max_steps;

    const info: Record<string, unknown> = { action_valid: actionValid, step_reward_reason: reason };
    if (done) {
      this.state.is_done = true;
      this.state.ended_at = new Date().toISOString();
      this.finalizeSession(grade);
      info.grade_result = grade;
    }

    return { observation: this.buildObservation(), reward, done, info };
  }

  getState() {
    if (!this.state || !this.task) {
      return {
        observation: this.emptyObservation(),
        session_id: "",
        is_active: false,
        created_at: new Date().toISOString(),
      };
    }
    return {
      observation: this.buildObservation(),
      session_id: this.state.session_id,
      is_active: !this.state.is_done,
      created_at: this.state.created_at,
    };
  }

  getTasks() { return WORKSPACE_TASKS; }

  getSessions() {
    return { sessions: [...this.sessions].reverse(), total_sessions: this.sessions.length };
  }

  // ── Action handlers ────────────────────────────────────────────────────

  private doOpenInbox() {
    const was = this.state!.current_app === "email_inbox";
    this.state!.current_app = "email_inbox";
    this.state!.selected_email = null;
    if (was) return { reward: 0, reason: "Already in inbox" };
    return { reward: this.task!.reward_breakdown.open_inbox, reason: "Opened email inbox" };
  }

  private doSearchEmail(sender: string) {
    if (!sender) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "search_email requires params.sender" };
    this.state!.current_app = "email_inbox";
    this.state!.last_search_query = sender;
    const matched = this.state!.email_list.filter((e) =>
      e.sender.toLowerCase().includes(sender.toLowerCase()),
    );
    const hitTarget = matched.some((e) => e.id === this.task!.target_email_id);
    if (hitTarget) {
      return { reward: this.task!.reward_breakdown.find_email, reason: `Found emails from '${sender}'` };
    }
    return { reward: this.task!.reward_breakdown.find_email * 0.3, reason: `Searched for '${sender}', target not matched` };
  }

  private doReadEmail(emailId: string) {
    const email = this.state!.email_list.find((e) => e.id === emailId);
    if (!email) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Email '${emailId}' not found` };

    this.state!.current_app = "email_detail";
    this.state!.selected_email = email;
    email.read = true;
    this.state!.read_email_ids.add(emailId);

    const isTarget = emailId === this.task!.target_email_id;
    if (isTarget) return { reward: this.task!.reward_breakdown.read_email, reason: `Read target email from ${email.sender}` };
    return { reward: this.task!.reward_breakdown.incorrect_action * 0.5, reason: `Read non-target email from ${email.sender}` };
  }

  private doExtractMeeting() {
    if (!this.state!.selected_email) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "No email selected" };
    if (!this.state!.selected_email.has_meeting_details) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "Selected email has no meeting details" };
    this.state!.extracted_meeting_details = true;
    return { reward: this.task!.reward_breakdown.extract_meeting, reason: "Extracted meeting details from email" };
  }

  private doCreateCalendarEvent() {
    if (!this.state!.selected_email) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "No email selected to base meeting on" };

    const isFromTarget = this.state!.selected_email.id === this.task!.target_email_id;
    const newEvent: CalendarEvent = {
      id: `cal_${Date.now()}`,
      title: this.state!.selected_email.subject,
      date: this.task!.meeting_date ?? "2026-03-29",
      time: this.task!.meeting_time ?? "15:00",
      attendees: [this.state!.selected_email.sender],
      location: "Conference Room B",
      created_from_email: true,
    };
    this.state!.calendar_events.push(newEvent);
    this.state!.current_app = "calendar";

    if (isFromTarget) return { reward: this.task!.reward_breakdown.create_event, reason: "Created calendar event from target email" };
    return { reward: this.task!.reward_breakdown.incorrect_action, reason: "Created event from wrong email" };
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
    if (!docId || !folder) return { reward: this.task!.reward_breakdown.incorrect_action, reason: "move_document requires document_id and folder" };
    if (!AVAILABLE_FOLDERS.includes(folder)) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Invalid folder: '${folder}'` };
    const doc = this.state!.documents.find((d) => d.id === docId);
    if (!doc) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Document '${docId}' not found` };

    doc.folder = folder;
    this.state!.document_moves[docId] = folder;

    const correctDoc = docId === this.task!.target_document_id;
    const correctFolder = folder === this.task!.target_folder;

    if (correctDoc && correctFolder) return { reward: this.task!.reward_breakdown.move_document, reason: `Moved '${doc.name}' to '${folder}'` };
    if (correctDoc) return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Moved correct document to wrong folder '${folder}'` };
    return { reward: this.task!.reward_breakdown.incorrect_action, reason: `Moved wrong document '${doc.name}'` };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private buildObservation(): WorkspaceObservation {
    return {
      current_app: this.state!.current_app,
      email_list: this.getVisibleEmails(),
      selected_email: this.state!.selected_email,
      calendar_events: this.state!.calendar_events,
      documents: this.state!.documents,
      current_task: this.task!.goal,
      available_actions: APP_ACTIONS[this.state!.current_app],
      task_id: this.task!.id,
      task_description: this.task!.description,
      step_count: this.state!.step_count,
      total_reward: this.state!.total_reward,
    };
  }

  private getVisibleEmails(): Email[] {
    if (!this.state!.last_search_query) return this.state!.email_list;
    const q = this.state!.last_search_query.toLowerCase();
    return this.state!.email_list.filter(
      (e) => e.sender.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q),
    );
  }

  private emptyObservation(): WorkspaceObservation {
    return {
      current_app: "task_manager",
      email_list: [],
      selected_email: null,
      calendar_events: [],
      documents: [],
      current_task: "No active session. Call reset() to start.",
      available_actions: ["open_email_inbox", "view_calendar", "view_documents", "noop"],
      task_id: "",
      task_description: "No active session",
      step_count: 0,
      total_reward: 0,
    };
  }

  private finalizeSession(grade?: WorkspaceGradeResult) {
    if (!this.state || !this.task) return;
    this.sessions.push({
      session_id: this.state.session_id,
      task_id: this.task.id,
      task_name: this.task.name,
      total_reward: this.state.total_reward,
      steps_taken: this.state.step_count,
      completed: grade?.passed ?? false,
      grader_score: grade?.score ?? 0,
      started_at: this.state.created_at,
      ended_at: this.state.ended_at ?? new Date().toISOString(),
    });
  }

  private errorResult(message: string): WorkspaceStepResult {
    return { observation: this.getState().observation, reward: 0, done: false, info: { action_valid: false, error: message } };
  }
}

export const workspaceEnv = new WorkspaceEnvironment();
