/**
 * Automated graders for workspace tasks.
 * Each grader returns a score between 0.0 and 1.0.
 */

import { WorkspaceState } from "./state.js";
import { WorkspaceTask } from "./tasks.js";

export interface WorkspaceGradeResult {
  score: number;
  passed: boolean;
  feedback: string;
  criteria: { name: string; passed: boolean; weight: number; description: string }[];
}

/** Task 1: Did the agent find and read the target email? */
export function gradeEmailRetrieval(
  state: WorkspaceState,
  task: WorkspaceTask,
): WorkspaceGradeResult {
  const openedInbox = state.history.some((h) => h.app === "email_inbox");
  const searchedForSender =
    state.last_search_query !== null &&
    task.target_email_sender !== undefined &&
    state.last_search_query.toLowerCase().includes(task.target_email_sender.toLowerCase().split(" ")[0]);
  const readTargetEmail = state.read_email_ids.has(task.target_email_id ?? "");

  const criteria = [
    {
      name: "opened_inbox",
      passed: openedInbox,
      weight: 0.1,
      description: "Agent opened the email inbox",
    },
    {
      name: "searched_for_sender",
      passed: searchedForSender,
      weight: 0.4,
      description: `Agent searched for emails from '${task.target_email_sender}'`,
    },
    {
      name: "read_target_email",
      passed: readTargetEmail,
      weight: 0.5,
      description: `Agent read the target email (ID: ${task.target_email_id})`,
    },
  ];

  const score = Math.min(1.0, criteria.reduce((a, c) => a + (c.passed ? c.weight : 0), 0));
  return {
    score,
    passed: score >= 0.9,
    feedback: score >= 0.9 ? "Successfully found and read the target email" : "Did not fully complete email retrieval",
    criteria,
  };
}

/** Task 2: Did the agent schedule the correct meeting? */
export function gradeMeetingScheduling(
  state: WorkspaceState,
  task: WorkspaceTask,
): WorkspaceGradeResult {
  const readTargetEmail = state.read_email_ids.has(task.target_email_id ?? "");
  const extractedMeeting = state.extracted_meeting_details;
  const correctEventCreated = state.calendar_events.some(
    (e) =>
      e.created_from_email &&
      (!task.meeting_date || e.date === task.meeting_date) &&
      (!task.meeting_time || e.time === task.meeting_time),
  );

  const criteria = [
    {
      name: "read_email",
      passed: readTargetEmail,
      weight: 0.15,
      description: "Agent read the email with meeting details",
    },
    {
      name: "extracted_meeting",
      passed: extractedMeeting,
      weight: 0.15,
      description: "Agent extracted meeting details from email",
    },
    {
      name: "created_event",
      passed: correctEventCreated,
      weight: 0.7,
      description: `Agent created calendar event for ${task.meeting_date} at ${task.meeting_time}`,
    },
  ];

  const score = Math.min(1.0, criteria.reduce((a, c) => a + (c.passed ? c.weight : 0), 0));
  return {
    score,
    passed: correctEventCreated,
    feedback: correctEventCreated
      ? "Meeting successfully scheduled in the calendar"
      : "Meeting not yet scheduled",
    criteria,
  };
}

/** Task 3: Did the agent move the document to the correct folder? */
export function gradeDocumentOrganization(
  state: WorkspaceState,
  task: WorkspaceTask,
): WorkspaceGradeResult {
  const viewedDocuments = state.history.some((h) => h.app === "documents");
  const movedCorrectDocument =
    task.target_document_id !== undefined &&
    task.target_folder !== undefined &&
    state.document_moves[task.target_document_id] === task.target_folder;

  const criteria = [
    {
      name: "viewed_documents",
      passed: viewedDocuments,
      weight: 0.1,
      description: "Agent opened the documents app",
    },
    {
      name: "moved_correct_document",
      passed: movedCorrectDocument,
      weight: 0.9,
      description: `Agent moved '${task.target_document_id}' to '${task.target_folder}'`,
    },
  ];

  const score = Math.min(1.0, criteria.reduce((a, c) => a + (c.passed ? c.weight : 0), 0));
  return {
    score,
    passed: movedCorrectDocument,
    feedback: movedCorrectDocument
      ? "Document successfully moved to the correct folder"
      : "Document not yet moved correctly",
    criteria,
  };
}

export function gradeWorkspaceTask(
  state: WorkspaceState,
  task: WorkspaceTask,
): WorkspaceGradeResult {
  switch (task.id) {
    case "ws_task_1":
      return gradeEmailRetrieval(state, task);
    case "ws_task_2":
      return gradeMeetingScheduling(state, task);
    case "ws_task_3":
      return gradeDocumentOrganization(state, task);
    default:
      return gradeDocumentOrganization(state, task);
  }
}
