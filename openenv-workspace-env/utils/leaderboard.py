"""
Leaderboard — tracks agent scores across episodes.

Each agent is identified by name. The leaderboard stores a running
average of grader scores and a per-task breakdown.

API
---
  record_score(agent_name, grader_score, task_id, task_name, mode)
  get_leaderboard() → list[dict]   (sorted by avg_score descending)
  reset()
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)


@dataclass
class AgentEntry:
    agent_name:    str
    episodes_run:  int        = 0
    total_score:   float      = 0.0
    total_reward:  float      = 0.0
    wins:          int        = 0    # episodes where grader_score >= 0.9
    per_task:      dict       = field(default_factory=dict)
    last_active:   str        = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def average_score(self) -> float:
        if self.episodes_run == 0:
            return 0.0
        return round(self.total_score / self.episodes_run, 4)

    @property
    def average_reward(self) -> float:
        if self.episodes_run == 0:
            return 0.0
        return round(self.total_reward / self.episodes_run, 4)

    @property
    def win_rate(self) -> float:
        if self.episodes_run == 0:
            return 0.0
        return round(self.wins / self.episodes_run, 4)


class Leaderboard:
    """In-memory leaderboard tracking agent performance."""

    def __init__(self) -> None:
        self._agents: dict[str, AgentEntry] = {}

    # ── Recording ──────────────────────────────────────────────────────────

    def record_score(
        self,
        agent_name:   str,
        grader_score: float,
        total_reward: float,
        task_id:      str,
        task_name:    str,
        mode:         str = "evaluation",
    ) -> None:
        """Record a completed episode for the given agent."""
        if agent_name not in self._agents:
            self._agents[agent_name] = AgentEntry(agent_name=agent_name)

        entry = self._agents[agent_name]
        entry.episodes_run += 1
        entry.total_score  += grader_score
        entry.total_reward += total_reward
        if grader_score >= 0.9:
            entry.wins += 1
        entry.last_active = datetime.now(timezone.utc).isoformat()

        # Per-task breakdown
        if task_id not in entry.per_task:
            entry.per_task[task_id] = {
                "name":        task_name,
                "episodes":    0,
                "total_score": 0.0,
            }
        entry.per_task[task_id]["episodes"]    += 1
        entry.per_task[task_id]["total_score"] += grader_score

        log.info(
            "leaderboard | agent=%s score=%.2f task=%s episodes=%d avg=%.3f",
            agent_name, grader_score, task_id, entry.episodes_run, entry.average_score,
        )

    # ── Query ──────────────────────────────────────────────────────────────

    def get_leaderboard(self, limit: int = 20) -> list[dict]:
        """Return agents sorted by average grader score (descending)."""
        entries = sorted(
            self._agents.values(),
            key=lambda e: (e.average_score, e.average_reward),
            reverse=True,
        )
        result = []
        for rank, entry in enumerate(entries[:limit], start=1):
            per_task = {
                tid: {
                    "name":    t["name"],
                    "episodes": t["episodes"],
                    "avg_score": round(t["total_score"] / t["episodes"], 4) if t["episodes"] else 0.0,
                }
                for tid, t in entry.per_task.items()
            }
            result.append({
                "rank":           rank,
                "agent":          entry.agent_name,
                "average_score":  entry.average_score,
                "average_reward": entry.average_reward,
                "episodes_run":   entry.episodes_run,
                "win_rate":       entry.win_rate,
                "last_active":    entry.last_active,
                "per_task":       per_task,
            })
        return result

    def get_agent(self, agent_name: str) -> Optional[dict]:
        entry = self._agents.get(agent_name)
        if not entry:
            return None
        return self.get_leaderboard()[
            next((i for i, e in enumerate(self.get_leaderboard()) if e["agent"] == agent_name), 0)
        ]

    def reset(self) -> None:
        self._agents.clear()
