"""
Workspace Assistant RL Environment (Python equivalent).
Supports: reset(), step(action, params), state()
"""

import json
import uuid
from datetime import datetime
from copy import deepcopy
from typing import Optional

from .data import SEED_EMAILS, SEED_CALENDAR_EVENTS, SEED_DOCUMENTS, AVAILABLE_FOLDERS
from .tasks import WORKSPACE_TASKS, get_task_by_id, get_random_task
from .graders import grade_task

APP_ACTIONS = {
    "email_inbox": ["open_email_inbox", "search_email", "read_email", "view_calendar", "view_documents", "noop"],
    "email_detail": ["open_email_inbox", "extract_meeting_details", "create_calendar_event", "view_calendar", "view_documents", "noop"],
    "calendar": ["view_calendar", "create_calendar_event", "open_email_inbox", "view_documents", "noop"],
    "documents": ["view_documents", "move_document", "open_email_inbox", "view_calendar", "noop"],
    "task_manager": ["open_email_inbox", "view_calendar", "view_documents", "noop"],
}


class WorkspaceEnvironment:
    def __init__(self):
        self.state = None
        self.task = None
        self.sessions = []

    def reset(self, task_id: Optional[str] = None, seed: Optional[int] = None):
        if self.state and self.task:
            self._finalize_session()

        self.task = get_task_by_id(task_id) if task_id else get_random_task()
        self.state = {
            "session_id": str(uuid.uuid4()),
            "task_id": self.task["id"],
            "current_app": "task_manager",
            "email_list": deepcopy(SEED_EMAILS),
            "selected_email": None,
            "calendar_events": deepcopy(SEED_CALENDAR_EVENTS),
            "documents": deepcopy(SEED_DOCUMENTS),
            "read_email_ids": set(),
            "last_search_query": None,
            "extracted_meeting_details": False,
            "document_moves": {},
            "step_count": 0,
            "total_reward": 0.0,
            "is_done": False,
            "history": [],
            "created_at": datetime.utcnow().isoformat(),
            "ended_at": None,
        }
        return {"observation": self._build_obs(), "reward": 0.0, "done": False, "info": {"reset": True}}

    def step(self, action: str, params: dict = None):
        if not self.state or not self.task:
            return {"observation": self._empty_obs(), "reward": 0.0, "done": False, "info": {"error": "Call reset() first"}}
        if self.state["is_done"]:
            return {"observation": self._build_obs(), "reward": 0.0, "done": True, "info": {"error": "Episode done"}}

        params = params or {}
        self.state["step_count"] += 1
        reward, reason, valid = 0.0, "", True

        valid_actions = APP_ACTIONS.get(self.state["current_app"], [])
        if action not in valid_actions:
            reward = self.task["reward_breakdown"]["invalid_navigation"]
            reason = f"Invalid action '{action}' on '{self.state['current_app']}'"
            valid = False
        else:
            reward, reason = self._dispatch(action, params)

        self.state["total_reward"] = max(0.0, min(1.0, self.state["total_reward"] + reward))
        self.state["history"].append({"app": self.state["current_app"], "action": action, "step": self.state["step_count"]})

        grade = grade_task(self.state, self.task)
        done = grade["passed"] or self.state["step_count"] >= self.task["max_steps"]
        info = {"action_valid": valid, "step_reward_reason": reason}
        if done:
            self.state["is_done"] = True
            self.state["ended_at"] = datetime.utcnow().isoformat()
            self._finalize_session(grade)
            info["grade_result"] = grade

        return {"observation": self._build_obs(), "reward": reward, "done": done, "info": info}

    def get_state(self):
        if not self.state or not self.task:
            return {"observation": self._empty_obs(), "session_id": "", "is_active": False}
        return {
            "observation": self._build_obs(),
            "session_id": self.state["session_id"],
            "is_active": not self.state["is_done"],
            "created_at": self.state["created_at"],
        }

    def get_tasks(self):
        return WORKSPACE_TASKS

    def get_sessions(self):
        return {"sessions": list(reversed(self.sessions)), "total_sessions": len(self.sessions)}

    # ── Dispatch ────────────────────────────────────────────────────────────

    def _dispatch(self, action, params):
        rb = self.task["reward_breakdown"]
        if action == "open_email_inbox":
            was = self.state["current_app"] == "email_inbox"
            self.state["current_app"] = "email_inbox"
            self.state["selected_email"] = None
            return (0.0, "Already in inbox") if was else (rb["open_inbox"], "Opened email inbox")

        if action == "search_email":
            sender = params.get("sender", "")
            if not sender:
                return rb["incorrect_action"], "search_email requires params.sender"
            self.state["current_app"] = "email_inbox"
            self.state["last_search_query"] = sender
            target_found = any(e["id"] == self.task.get("target_email_id") and
                               sender.lower() in e["sender"].lower()
                               for e in self.state["email_list"])
            r = rb["find_email"] if target_found else rb["find_email"] * 0.3
            return r, f"Searched for '{sender}'"

        if action == "read_email":
            eid = params.get("email_id", "")
            email = next((e for e in self.state["email_list"] if e["id"] == eid), None)
            if not email:
                return rb["incorrect_action"], f"Email '{eid}' not found"
            self.state["current_app"] = "email_detail"
            self.state["selected_email"] = email
            email["read"] = True
            self.state["read_email_ids"].add(eid)
            is_target = eid == self.task.get("target_email_id")
            return (rb["read_email"], f"Read target email from {email['sender']}") if is_target \
                else (rb["incorrect_action"] * 0.5, f"Read non-target email")

        if action == "extract_meeting_details":
            if not self.state["selected_email"]:
                return rb["incorrect_action"], "No email selected"
            if not self.state["selected_email"].get("has_meeting_details"):
                return rb["incorrect_action"], "Selected email has no meeting details"
            self.state["extracted_meeting_details"] = True
            return rb["extract_meeting"], "Extracted meeting details"

        if action == "create_calendar_event":
            if not self.state["selected_email"]:
                return rb["incorrect_action"], "No email selected"
            is_target = self.state["selected_email"]["id"] == self.task.get("target_email_id")
            new_event = {
                "id": f"cal_{self.state['step_count']}",
                "title": self.state["selected_email"]["subject"],
                "date": self.task.get("meeting_date", "2026-03-29"),
                "time": self.task.get("meeting_time", "15:00"),
                "attendees": [self.state["selected_email"]["sender"]],
                "location": "Conference Room B",
                "created_from_email": True,
            }
            self.state["calendar_events"].append(new_event)
            self.state["current_app"] = "calendar"
            return (rb["create_event"], "Created calendar event") if is_target \
                else (rb["incorrect_action"], "Created event from wrong email")

        if action == "view_calendar":
            self.state["current_app"] = "calendar"
            return 0.0, "Switched to calendar"

        if action == "view_documents":
            self.state["current_app"] = "documents"
            return 0.0, "Switched to documents"

        if action == "move_document":
            doc_id = params.get("document_id", "")
            folder = params.get("folder", "")
            if not doc_id or not folder:
                return rb["incorrect_action"], "move_document requires document_id and folder"
            if folder not in AVAILABLE_FOLDERS:
                return rb["incorrect_action"], f"Invalid folder: '{folder}'"
            doc = next((d for d in self.state["documents"] if d["id"] == doc_id), None)
            if not doc:
                return rb["incorrect_action"], f"Document '{doc_id}' not found"
            doc["folder"] = folder
            self.state["document_moves"][doc_id] = folder
            correct_doc = doc_id == self.task.get("target_document_id")
            correct_folder = folder == self.task.get("target_folder")
            if correct_doc and correct_folder:
                return rb["move_document"], f"Moved '{doc['name']}' to '{folder}'"
            return rb["incorrect_action"], "Moved wrong doc or wrong folder"

        if action == "noop":
            return 0.0, "No-op"

        return rb["incorrect_action"], f"Unknown action: {action}"

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _build_obs(self):
        visible_emails = self.state["email_list"]
        if self.state["last_search_query"]:
            q = self.state["last_search_query"].lower()
            visible_emails = [e for e in visible_emails if q in e["sender"].lower() or q in e["subject"].lower()]
        return {
            "current_app": self.state["current_app"],
            "email_list": visible_emails,
            "selected_email": self.state["selected_email"],
            "calendar_events": self.state["calendar_events"],
            "documents": self.state["documents"],
            "current_task": self.task["goal"],
            "available_actions": APP_ACTIONS[self.state["current_app"]],
            "task_id": self.task["id"],
            "task_description": self.task["description"],
            "step_count": self.state["step_count"],
            "total_reward": self.state["total_reward"],
        }

    def _empty_obs(self):
        return {
            "current_app": "task_manager",
            "email_list": [],
            "selected_email": None,
            "calendar_events": [],
            "documents": [],
            "current_task": "No active session. Call reset() first.",
            "available_actions": ["open_email_inbox", "view_calendar", "view_documents", "noop"],
            "task_id": "",
            "task_description": "No active session",
            "step_count": 0,
            "total_reward": 0.0,
        }

    def _finalize_session(self, grade=None):
        if not self.state or not self.task:
            return
        self.sessions.append({
            "session_id": self.state["session_id"],
            "task_id": self.task["id"],
            "task_name": self.task["name"],
            "total_reward": self.state["total_reward"],
            "steps_taken": self.state["step_count"],
            "completed": grade.get("passed", False) if grade else False,
            "grader_score": grade.get("score", 0.0) if grade else 0.0,
            "started_at": self.state["created_at"],
            "ended_at": self.state.get("ended_at"),
        })


workspace_env = WorkspaceEnvironment()
