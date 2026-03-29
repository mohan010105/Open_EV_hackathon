"""
RewardEngine — centralised reward calculation for the Workspace Assistant environment.

Reward table
------------
correct_navigation  +0.20   switching to the right app as part of progress
correct_action      +0.30   taking a semantically correct action
task_completion     +1.00   grader confirms the goal is fully achieved
incorrect_action    -0.10   wrong but structurally valid action
invalid_navigation  -0.20   action not available in the current app context

All rewards are clamped so that running_total stays within [0.0, 1.0].
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal

log = logging.getLogger(__name__)

RewardEvent = Literal[
    "correct_navigation",
    "correct_action",
    "task_completion",
    "incorrect_action",
    "invalid_navigation",
    "neutral",
]

REWARD_TABLE: dict[RewardEvent, float] = {
    "correct_navigation":  +0.20,
    "correct_action":      +0.30,
    "task_completion":     +1.00,
    "incorrect_action":    -0.10,
    "invalid_navigation":  -0.20,
    "neutral":              0.00,
}


@dataclass
class RewardEngine:
    """
    Stateful reward calculator for one episode.

    Attributes
    ----------
    running_total : float   – cumulative reward clamped to [0.0, 1.0]
    events        : list    – ordered record of (event, delta, reason) tuples
    """

    running_total: float = 0.0
    events: list[dict] = field(default_factory=list)

    # ── Public API ─────────────────────────────────────────────────────────

    def compute(self, event: RewardEvent, reason: str = "") -> float:
        """
        Apply a reward event and return the step reward.

        Parameters
        ----------
        event  : one of the RewardEvent literals
        reason : optional human-readable explanation for logging / replay

        Returns
        -------
        float – the step reward (positive or negative)
        """
        delta = REWARD_TABLE.get(event, 0.0)
        prev  = self.running_total
        self.running_total = max(0.0, min(1.0, self.running_total + delta))

        entry = {
            "event":         event,
            "delta":         delta,
            "prev_total":    round(prev, 4),
            "new_total":     round(self.running_total, 4),
            "reason":        reason,
        }
        self.events.append(entry)
        log.debug("reward | %s  delta=%+.2f  total=%.3f  %s", event, delta, self.running_total, reason)
        return delta

    def reset(self) -> None:
        """Reset for a new episode."""
        self.running_total = 0.0
        self.events.clear()

    def summary(self) -> dict:
        """Return a summary suitable for the episode replay log."""
        return {
            "total_reward":    round(self.running_total, 4),
            "event_count":     len(self.events),
            "positive_events": sum(1 for e in self.events if e["delta"] > 0),
            "negative_events": sum(1 for e in self.events if e["delta"] < 0),
            "events":          self.events,
        }

    # ── Convenience shortcuts ──────────────────────────────────────────────

    def nav(self, reason: str = "") -> float:
        return self.compute("correct_navigation", reason)

    def correct(self, reason: str = "") -> float:
        return self.compute("correct_action", reason)

    def complete(self, reason: str = "") -> float:
        return self.compute("task_completion", reason)

    def wrong(self, reason: str = "") -> float:
        return self.compute("incorrect_action", reason)

    def invalid(self, reason: str = "") -> float:
        return self.compute("invalid_navigation", reason)

    def neutral(self, reason: str = "") -> float:
        return self.compute("neutral", reason)
