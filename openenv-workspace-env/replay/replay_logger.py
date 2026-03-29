"""
ReplayLogger — records every step of an episode for later inspection.

Stored per step:
  step_number, action, params, observation_snapshot, reward,
  total_reward, done, action_valid, reason, timestamp

The full log is accessible via the GET /episode_replay endpoint.
"""

from __future__ import annotations

import copy
import logging
from datetime import datetime, timezone
from typing import Any, Optional

log = logging.getLogger(__name__)


class ReplayLogger:
    """Thread-safe (single-process) episode replay recorder."""

    def __init__(self) -> None:
        self._episodes: list[dict] = []   # one entry per completed episode
        self._current:  list[dict] = []   # steps for the episode in progress
        self._session_id: str      = ""
        self._task_id: str         = ""
        self._task_name: str       = ""
        self._started_at: str      = ""

    # ── Episode lifecycle ──────────────────────────────────────────────────

    def begin_episode(self, session_id: str, task_id: str, task_name: str) -> None:
        """Call once at the start of each episode (after reset)."""
        self._current     = []
        self._session_id  = session_id
        self._task_id     = task_id
        self._task_name   = task_name
        self._started_at  = _now()
        log.info("replay | begin_episode session=%s task=%s", session_id, task_id)

    def end_episode(
        self,
        completed: bool,
        grader_score: float,
        total_reward: float,
    ) -> None:
        """Call once when the episode terminates (done=True or reset)."""
        episode = {
            "session_id":    self._session_id,
            "task_id":       self._task_id,
            "task_name":     self._task_name,
            "started_at":    self._started_at,
            "ended_at":      _now(),
            "total_steps":   len(self._current),
            "total_reward":  round(total_reward, 4),
            "grader_score":  round(grader_score, 4),
            "completed":     completed,
            "steps":         self._current,
        }
        self._episodes.append(episode)
        log.info(
            "replay | end_episode session=%s steps=%d reward=%.3f score=%.2f",
            self._session_id, len(self._current), total_reward, grader_score,
        )
        self._current = []

    # ── Step recording ─────────────────────────────────────────────────────

    def record(
        self,
        step_number: int,
        action: str,
        params: dict,
        observation: dict,
        reward: float,
        total_reward: float,
        done: bool,
        action_valid: bool,
        reason: str = "",
        info: Optional[dict] = None,
    ) -> None:
        """Record one environment step."""
        entry: dict[str, Any] = {
            "step":          step_number,
            "timestamp":     _now(),
            "action":        action,
            "params":        params,
            "reward":        round(reward, 4),
            "total_reward":  round(total_reward, 4),
            "done":          done,
            "action_valid":  action_valid,
            "reason":        reason,
            # Lightweight snapshot — avoid copying large email bodies
            "observation_snapshot": _slim_obs(observation),
        }
        if info:
            entry["info"] = info
        self._current.append(entry)

    # ── Query API ──────────────────────────────────────────────────────────

    def current_episode(self) -> dict:
        """Return the in-progress episode steps."""
        return {
            "session_id":  self._session_id,
            "task_id":     self._task_id,
            "task_name":   self._task_name,
            "started_at":  self._started_at,
            "total_steps": len(self._current),
            "in_progress": True,
            "steps":       self._current,
        }

    def all_episodes(self) -> list[dict]:
        """Return all completed episodes (most recent first)."""
        return list(reversed(self._episodes))

    def latest_episode(self) -> Optional[dict]:
        """Return the most recently completed episode."""
        return self._episodes[-1] if self._episodes else None

    def clear(self) -> None:
        """Wipe all history (useful for testing)."""
        self._episodes.clear()
        self._current.clear()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim_obs(obs: dict) -> dict:
    """Return a lightweight version of the observation for replay storage."""
    return {
        "current_app":    obs.get("current_app"),
        "step_count":     obs.get("step_count"),
        "total_reward":   obs.get("total_reward"),
        "current_task":   obs.get("current_task"),
        "email_count":    len(obs.get("email_list", [])),
        "calendar_count": len(obs.get("calendar_events", [])),
        "doc_count":      len(obs.get("documents", [])),
        "selected_email": (
            obs["selected_email"]["id"] if obs.get("selected_email") else None
        ),
    }
