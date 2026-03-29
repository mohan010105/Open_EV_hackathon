"""
WorkspaceEnvironment — core RL environment class.

Implements the OpenEnv standard interface:
  reset(task_id, seed) → StepResult
  step(action, params) → StepResult
  state()              → StateResult
"""

from __future__ import annotations

import uuid
import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional

from .state import SEED_EMAILS, SEED_CALENDAR_EVENTS, SEED_DOCUMENTS, APP_ACTIONS
from .tasks import get_task, list_tasks
from .actions import dispatch
from .graders import grade_task

log = logging.getLogger(__name__)


class WorkspaceEnvironment:
    """OpenEnv-compatible Workspace Assistant environment."""

    def __init__(self) -> None:
        self._state: Optional[dict] = None
        self._task: Optional[dict] = None
        self._sessions: list[dict] = []

    # ── Public RL interface ────────────────────────────────────────────────

    def reset(self, task_id: Optional[str] = None, seed: Optional[int] = None) -> dict:
        """
        Reset the environment and begin a new episode.

        Parameters
        ----------
        task_id : optional task ID string; random task chosen if omitted
        seed    : reserved for future deterministic seeding

        Returns
        -------
        StepResult dict
        """
        if self._state and self._task:
            self._finalise()

        self._task = get_task(task_id)
        self._state = {
            "session_id":               str(uuid.uuid4()),
            "task_id":                  self._task["id"],
            "current_app":              "task_manager",
            "email_list":               deepcopy(SEED_EMAILS),
            "selected_email":           None,
            "calendar_events":          deepcopy(SEED_CALENDAR_EVENTS),
            "documents":                deepcopy(SEED_DOCUMENTS),
            "read_email_ids":              set(),
            "last_search_query":          None,
            "extracted_meeting_details":  False,
            "document_moves":             {},
            "step_count":               0,
            "total_reward":             0.0,
            "is_done":                  False,
            "history":                  [],
            "created_at":               _now(),
            "ended_at":                 None,
        }
        log.info("reset | task=%s session=%s", self._task["id"], self._state["session_id"])
        return self._make_result(reward=0.0, done=False, info={"event": "reset"})

    def step(self, action: str, params: Optional[dict] = None) -> dict:
        """
        Apply an action to the environment.

        Parameters
        ----------
        action : action name string
        params : optional dict of action parameters

        Returns
        -------
        StepResult dict
        """
        if self._state is None or self._task is None:
            return self._error("Call reset() before step()")
        if self._state["is_done"]:
            return self._error("Episode is done — call reset() to start a new one")

        params = params or {}
        self._state["step_count"] += 1

        reward, reason, valid = dispatch(action, params, self._state, self._task)

        # Clamp total reward to [0, 1]
        self._state["total_reward"] = max(0.0, min(1.0, self._state["total_reward"] + reward))

        self._state["history"].append({
            "app":    self._state["current_app"],
            "action": action,
            "step":   self._state["step_count"],
            "valid":  valid,
        })

        grade = grade_task(self._state, self._task)
        done = grade["passed"] or self._state["step_count"] >= self._task["max_steps"]

        info = {"action_valid": valid, "reason": reason}
        if done:
            self._state["is_done"]  = True
            self._state["ended_at"] = _now()
            self._finalise(grade)
            info["grade"] = grade

        log.info(
            "step %d | action=%s reward=%.3f total=%.3f done=%s",
            self._state["step_count"], action, reward,
            self._state["total_reward"], done,
        )
        return self._make_result(reward=reward, done=done, info=info)

    def state(self) -> dict:
        """Return the current environment state without advancing the episode."""
        if self._state is None or self._task is None:
            return {
                "observation": self._empty_obs(),
                "session_id":  "",
                "is_active":   False,
                "created_at":  _now(),
            }
        return {
            "observation": self._build_obs(),
            "session_id":  self._state["session_id"],
            "is_active":   not self._state["is_done"],
            "created_at":  self._state["created_at"],
        }

    def list_tasks(self) -> list[dict]:
        return list_tasks()

    def get_sessions(self) -> dict:
        return {
            "sessions":       list(reversed(self._sessions)),
            "total_sessions": len(self._sessions),
        }

    # ── Private helpers ────────────────────────────────────────────────────

    def _build_obs(self) -> dict:
        s, t = self._state, self._task
        visible_emails = s["email_list"]
        if s["last_search_query"]:
            q = s["last_search_query"].lower()
            visible_emails = [
                e for e in visible_emails
                if q in e["sender"].lower() or q in e["subject"].lower()
            ]
        return {
            "current_app":       s["current_app"],
            "email_list":        visible_emails,
            "selected_email":    s["selected_email"],
            "calendar_events":   s["calendar_events"],
            "documents":         s["documents"],
            "current_task":      t["goal"],
            "available_actions": APP_ACTIONS[s["current_app"]],
            "task_id":           t["id"],
            "task_description":  t["description"],
            "step_count":        s["step_count"],
            "total_reward":      s["total_reward"],
        }

    def _empty_obs(self) -> dict:
        return {
            "current_app":       "task_manager",
            "email_list":        [],
            "selected_email":    None,
            "calendar_events":   [],
            "documents":         [],
            "current_task":      "No active session. Call /reset to start.",
            "available_actions": ["open_email_inbox", "view_calendar", "view_documents", "noop"],
            "task_id":           "",
            "task_description":  "No active session",
            "step_count":        0,
            "total_reward":      0.0,
        }

    def _make_result(self, reward: float, done: bool, info: dict) -> dict:
        return {
            "observation": self._build_obs() if self._state else self._empty_obs(),
            "reward":      reward,
            "done":        done,
            "info":        info,
        }

    def _error(self, message: str) -> dict:
        return {
            "observation": self._build_obs() if self._state else self._empty_obs(),
            "reward":      0.0,
            "done":        False,
            "info":        {"error": message},
        }

    def _finalise(self, grade: Optional[dict] = None) -> None:
        if not self._state or not self._task:
            return
        self._sessions.append({
            "session_id":   self._state["session_id"],
            "task_id":      self._task["id"],
            "task_name":    self._task["name"],
            "total_reward": self._state["total_reward"],
            "steps_taken":  self._state["step_count"],
            "completed":    grade.get("passed", False) if grade else False,
            "grader_score": grade.get("score", 0.0)   if grade else 0.0,
            "started_at":   self._state["created_at"],
            "ended_at":     self._state.get("ended_at"),
        })


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
