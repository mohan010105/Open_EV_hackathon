"""
MetricsTracker — records and aggregates agent performance across episodes.

Tracked per episode
-------------------
  task_id, task_name, success, grader_score, total_reward, steps, mode

Aggregated on demand
--------------------
  episode_count, success_rate, avg_reward, avg_steps, avg_score
  per_task breakdown, per_mode breakdown
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)


@dataclass
class EpisodeRecord:
    session_id:   str
    task_id:      str
    task_name:    str
    mode:         str               # "training" | "evaluation"
    difficulty:   str               # "easy" | "medium" | "hard"
    success:      bool
    grader_score: float
    total_reward: float
    steps:        int
    agent_name:   str
    ended_at:     str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MetricsTracker:
    """Thread-safe (single-process) metrics aggregator."""

    def __init__(self) -> None:
        self._records: list[EpisodeRecord] = []

    # ── Recording ──────────────────────────────────────────────────────────

    def record(
        self,
        session_id:   str,
        task_id:      str,
        task_name:    str,
        mode:         str,
        difficulty:   str,
        success:      bool,
        grader_score: float,
        total_reward: float,
        steps:        int,
        agent_name:   str = "agent",
    ) -> None:
        rec = EpisodeRecord(
            session_id=session_id,
            task_id=task_id,
            task_name=task_name,
            mode=mode,
            difficulty=difficulty,
            success=success,
            grader_score=grader_score,
            total_reward=total_reward,
            steps=steps,
            agent_name=agent_name,
        )
        self._records.append(rec)
        log.info(
            "metrics | task=%s mode=%s success=%s score=%.2f reward=%.3f steps=%d",
            task_id, mode, success, grader_score, total_reward, steps,
        )

    # ── Aggregation ────────────────────────────────────────────────────────

    def get_metrics(self, mode: Optional[str] = None) -> dict:
        """Return aggregated metrics, optionally filtered by mode."""
        records = self._filter(mode=mode)
        if not records:
            return self._empty()

        n          = len(records)
        successes  = [r for r in records if r.success]
        return {
            "episode_count":  n,
            "success_rate":   round(len(successes) / n, 4),
            "avg_reward":     round(sum(r.total_reward  for r in records) / n, 4),
            "avg_steps":      round(sum(r.steps         for r in records) / n, 2),
            "avg_score":      round(sum(r.grader_score  for r in records) / n, 4),
            "by_task":        self._by_task(records),
            "by_difficulty":  self._by_difficulty(records),
            "by_mode":        self._by_mode(records) if mode is None else {},
        }

    def get_full_history(self) -> list[dict]:
        """Return every episode record as a list of dicts."""
        return [self._rec_to_dict(r) for r in reversed(self._records)]

    def reset(self) -> None:
        self._records.clear()

    # ── Private helpers ────────────────────────────────────────────────────

    def _filter(self, mode: Optional[str]) -> list[EpisodeRecord]:
        if mode:
            return [r for r in self._records if r.mode == mode]
        return list(self._records)

    def _by_task(self, records: list[EpisodeRecord]) -> dict:
        tasks: dict[str, list[EpisodeRecord]] = {}
        for r in records:
            tasks.setdefault(r.task_id, []).append(r)
        return {
            tid: {
                "name":         recs[0].task_name,
                "episodes":     len(recs),
                "success_rate": round(sum(1 for r in recs if r.success) / len(recs), 4),
                "avg_reward":   round(sum(r.total_reward for r in recs) / len(recs), 4),
                "avg_steps":    round(sum(r.steps        for r in recs) / len(recs), 2),
            }
            for tid, recs in tasks.items()
        }

    def _by_difficulty(self, records: list[EpisodeRecord]) -> dict:
        levels: dict[str, list[EpisodeRecord]] = {}
        for r in records:
            levels.setdefault(r.difficulty, []).append(r)
        return {
            lvl: {
                "episodes":     len(recs),
                "success_rate": round(sum(1 for r in recs if r.success) / len(recs), 4),
                "avg_reward":   round(sum(r.total_reward for r in recs) / len(recs), 4),
            }
            for lvl, recs in levels.items()
        }

    def _by_mode(self, records: list[EpisodeRecord]) -> dict:
        modes: dict[str, list[EpisodeRecord]] = {}
        for r in records:
            modes.setdefault(r.mode, []).append(r)
        return {
            m: {
                "episodes":     len(recs),
                "success_rate": round(sum(1 for r in recs if r.success) / len(recs), 4),
                "avg_reward":   round(sum(r.total_reward for r in recs) / len(recs), 4),
            }
            for m, recs in modes.items()
        }

    @staticmethod
    def _empty() -> dict:
        return {
            "episode_count": 0,
            "success_rate":  0.0,
            "avg_reward":    0.0,
            "avg_steps":     0.0,
            "avg_score":     0.0,
            "by_task":       {},
            "by_difficulty": {},
            "by_mode":       {},
        }

    @staticmethod
    def _rec_to_dict(r: EpisodeRecord) -> dict:
        return {
            "session_id":   r.session_id,
            "task_id":      r.task_id,
            "task_name":    r.task_name,
            "mode":         r.mode,
            "difficulty":   r.difficulty,
            "success":      r.success,
            "grader_score": r.grader_score,
            "total_reward": r.total_reward,
            "steps":        r.steps,
            "agent_name":   r.agent_name,
            "ended_at":     r.ended_at,
        }
