/**
 * Workspace environment state definition.
 */

import { Email, CalendarEvent, Document } from "./data.js";

export type WorkspaceApp = "email_inbox" | "email_detail" | "calendar" | "documents" | "task_manager";

export interface WorkspaceHistoryEntry {
  app: WorkspaceApp;
  action: string;
  step: number;
}

export interface WorkspaceState {
  session_id: string;
  task_id: string;
  current_app: WorkspaceApp;
  email_list: Email[];
  selected_email: Email | null;
  calendar_events: CalendarEvent[];
  documents: Document[];
  read_email_ids: Set<string>;
  last_search_query: string | null;
  extracted_meeting_details: boolean;
  document_moves: Record<string, string>;
  step_count: number;
  total_reward: number;
  is_done: boolean;
  history: WorkspaceHistoryEntry[];
  created_at: string;
  ended_at: string | null;
}
