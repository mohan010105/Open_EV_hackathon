"""
WorkspaceEnvironment — core RL environment with difficulty, mode, and seed support.

New in v2
---------
  difficulty : "easy" | "medium" | "hard"   — controls dataset size / distractors
  mode       : "training" | "evaluation"    — controls intermediate reward shaping
  seed       : int | None                   — makes randomisation deterministic
  agent_name : str                          — used for leaderboard attribution

Randomisation
-------------
  Every reset shuffles emails, documents, and calendar events using a fresh
  random.Random(seed) instance. When seed is provided the episode is fully
  deterministic and reproducible.
"""

from __future__ import annotations

import random
import uuid
import logging
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional

from .state import (
    ALL_EMAILS, ALL_CALENDAR_EVENTS, ALL_DOCUMENTS,
    APP_ACTIONS, DIFFICULTY_CONFIG,
)
from .task_generator import get_task
from .actions import dispatch
from .graders import grade_task

log = logging.getLogger(__name__)

# In evaluation mode, only task_completion and invalid_navigation rewards
# are passed through — intermediate step rewards are suppressed to zero so
# the agent must rely on the final grader score rather than dense feedback.
_EVAL_SUPPRESSED_RANGE = (-0.15, 0.35)   # suppress rewards in this range


class WorkspaceEnvironment:
    """OpenEnv-compatible Workspace Assistant environment (v2)."""

    def __init__(self) -> None:
        self._state:      Optional[dict] = None
        self._task:       Optional[dict] = None
        self._sessions:   list[dict]     = []
        self._mode:       str            = "training"
        self._difficulty: str            = "medium"
        self._agent_name: str            = "agent"

    # ── Public RL interface ────────────────────────────────────────────────

    def reset(
        self,
        task_id:    Optional[str] = None,
        seed:       Optional[int] = None,
        difficulty: str           = "medium",
        mode:       str           = "training",
        agent_name: str           = "agent",
    ) -> dict:
        """
        Reset the environment and begin a new episode.

        Parameters
        ----------
        task_id    : specific task ID; random task chosen if omitted
        seed       : integer seed for reproducible randomisation
        difficulty : "easy" | "medium" | "hard"
        mode       : "training" | "evaluation"
        agent_name : identifier recorded in session history and leaderboard
        """
        if self._state and self._task:
            self._finalise()

        difficulty = difficulty if difficulty in DIFFICULTY_CONFIG else "medium"
        mode       = mode       if mode       in ("training", "evaluation") else "training"

        self._mode       = mode
        self._difficulty = difficulty
        self._agent_name = agent_name

        # Seeded RNG — reproducible when seed is provided
        actual_seed = seed if seed is not None else random.randint(0, 2**31)
        rng = random.Random(actual_seed)

        # Build difficulty-scaled, randomised dataset
        emails    = self._sample_emails(rng, difficulty)
        calendar  = self._sample_calendar(rng, difficulty)
        documents = self._sample_documents(rng, difficulty)

        self._task = get_task(task_id, rng, emails, documents)
        self._state = {
            "session_id":                str(uuid.uuid4()),
            "task_id":                   self._task["id"],
            "difficulty":                difficulty,
            "mode":                      mode,
            "agent_name":                agent_name,
            "seed":                      actual_seed,
            "current_app":               "task_manager",
            "email_list":                emails,
            "selected_email":            None,
            "calendar_events":           calendar,
            "documents":                 documents,
            "read_email_ids":            set(),
            "last_search_query":         None,
            "extracted_meeting_details": False,
            "document_moves":            {},
            "step_count":                0,
            "total_reward":              0.0,
            "is_done":                   False,
            "history":                   [],
            "created_at":                _now(),
            "ended_at":                  None,
        }
        log.info(
            "reset | task=%s diff=%s mode=%s seed=%d session=%s",
            self._task["id"], difficulty, mode, actual_seed, self._state["session_id"],
        )
        return self._make_result(reward=0.0, done=False, info={
            "event":      "reset",
            "difficulty": difficulty,
            "mode":       mode,
            "seed":       actual_seed,
            "task":       self._task["description"],
        })

    def step(self, action: str, params: Optional[dict] = None) -> dict:
        """
        Apply an action and advance the episode.

        In evaluation mode, intermediate rewards (between invalid_navigation
        and task_completion) are suppressed so the agent cannot exploit
        dense feedback during scoring runs.
        """
        if self._state is None or self._task is None:
            return self._error("Call reset() before step()")
        if self._state["is_done"]:
            return self._error("Episode is done — call reset() to start a new one")

        params = params or {}
        self._state["step_count"] += 1

        reward, reason, valid = dispatch(action, params, self._state, self._task)

        # Evaluation mode: suppress intermediate rewards
        if self._mode == "evaluation":
            suppressed = _EVAL_SUPPRESSED_RANGE[0] < reward < _EVAL_SUPPRESSED_RANGE[1]
            if suppressed:
                reward = 0.0

        self._state["total_reward"] = max(0.0, min(1.0, self._state["total_reward"] + reward))

        self._state["history"].append({
            "app":    self._state["current_app"],
            "action": action,
            "step":   self._state["step_count"],
            "valid":  valid,
        })

        grade = grade_task(self._state, self._task)
        done  = grade["passed"] or self._state["step_count"] >= self._task["max_steps"]

        info: dict = {"action_valid": valid, "reason": reason, "mode": self._mode}
        if done:
            self._state["is_done"]  = True
            self._state["ended_at"] = _now()
            self._finalise(grade)
            info["grade"] = grade

        log.info(
            "step %d | action=%-25s reward=%+.3f total=%.3f done=%s mode=%s",
            self._state["step_count"], action, reward,
            self._state["total_reward"], done, self._mode,
        )
        return self._make_result(reward=reward, done=done, info=info)

    def state(self) -> dict:
        """Return current environment state without advancing the episode."""
        if self._state is None or self._task is None:
            return {"observation": self._empty_obs(), "session_id": "", "is_active": False, "created_at": _now()}
        return {
            "observation": self._build_obs(),
            "session_id":  self._state["session_id"],
            "is_active":   not self._state["is_done"],
            "difficulty":  self._state["difficulty"],
            "mode":        self._state["mode"],
            "created_at":  self._state["created_at"],
        }

    def list_tasks(self) -> list[dict]:
        from .tasks import list_tasks
        return list_tasks()

    def get_sessions(self) -> dict:
        return {"sessions": list(reversed(self._sessions)), "total_sessions": len(self._sessions)}

    def last_session(self) -> Optional[dict]:
        return self._sessions[-1] if self._sessions else None

    # ── Dataset sampling with randomisation ───────────────────────────────

    @staticmethod
    def _sample_emails(rng: random.Random, difficulty: str) -> list[dict]:
        cfg   = DIFFICULTY_CONFIG[difficulty]
        count = cfg["email_count"]
        pool  = deepcopy(ALL_EMAILS)
        # Always include email_001 so named tasks still work
        core  = [e for e in pool if e["id"] == "email_001"]
        rest  = [e for e in pool if e["id"] != "email_001"]
        rng.shuffle(rest)
        selected = core + rest[:count - 1]
        rng.shuffle(selected)
        return selected

    @staticmethod
    def _sample_calendar(rng: random.Random, difficulty: str) -> list[dict]:
        cfg   = DIFFICULTY_CONFIG[difficulty]
        pool  = deepcopy(ALL_CALENDAR_EVENTS)
        rng.shuffle(pool)
        return pool[:cfg["calendar_count"]]

    @staticmethod
    def _sample_documents(rng: random.Random, difficulty: str) -> list[dict]:
        cfg   = DIFFICULTY_CONFIG[difficulty]
        count = cfg["document_count"]
        pool  = deepcopy(ALL_DOCUMENTS)
        # Always include doc_001 for named tasks
        core  = [d for d in pool if d["id"] == "doc_001"]
        rest  = [d for d in pool if d["id"] != "doc_001"]
        rng.shuffle(rest)
        selected = core + rest[:count - 1]
        rng.shuffle(selected)
        return selected

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
            "difficulty":        s["difficulty"],
            "mode":              s["mode"],
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
            "available_actions": APP_ACTIONS["task_manager"],
            "task_id":           "",
            "task_description":  "No active session",
            "difficulty":        "medium",
            "mode":              "training",
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
            "difficulty":   self._state["difficulty"],
            "mode":         self._state["mode"],
            "agent_name":   self._state["agent_name"],
            "seed":         self._state["seed"],
            "total_reward": self._state["total_reward"],
            "steps_taken":  self._state["step_count"],
            "completed":    grade.get("passed",  False) if grade else False,
            "grader_score": grade.get("score",   0.0)   if grade else 0.0,
            "started_at":   self._state["created_at"],
            "ended_at":     self._state.get("ended_at"),
        })


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
