"""
utils/agent_io.py — Q-table agent persistence.

STEP 3 fix: ensures the trained model is saved to disk and loaded correctly
            at inference time, so predictions use the actual trained weights
            rather than a freshly-initialised zero Q-table.

Usage
-----
    from utils.agent_io import save_agent, load_agent, agent_summary

    # After training
    save_agent(agent, "models/q_agent.json")

    # At inference
    agent = load_agent("models/q_agent.json")
    action_idx = agent.act(state, explore=False)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

log = logging.getLogger(__name__)


def save_agent(agent, path: str = "models/q_agent.json") -> None:
    """
    Save Q-table agent weights + hyperparameters to JSON.

    Works for any agent that exposes:
      .Q              : dict[tuple, list[float]]
      .lr, .gamma, .epsilon, .eps_min, .eps_dec
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    q_serialisable = {
        str(list(k)): v
        for k, v in getattr(agent, "Q", {}).items()
    }

    payload = {
        "agent_type":    type(agent).__name__,
        "hyperparams": {
            "learning_rate":   getattr(agent, "lr",      0.1),
            "discount_factor": getattr(agent, "gamma",   0.95),
            "epsilon":         getattr(agent, "epsilon", 0.05),
            "epsilon_min":     getattr(agent, "eps_min", 0.05),
            "epsilon_decay":   getattr(agent, "eps_dec", 0.97),
        },
        "q_table_size":  len(q_serialisable),
        "update_count":  getattr(agent, "_update_count", 0),
        "Q":             q_serialisable,
    }
    Path(path).write_text(json.dumps(payload, indent=2))
    log.info(
        "Agent saved → %s  (Q-table states: %d, updates: %d)",
        path, len(q_serialisable), payload["update_count"],
    )


def load_agent(path: str = "models/q_agent.json"):
    """
    Load a saved Q-table agent from JSON.

    Returns a lightweight wrapper that exposes .act(state, explore=False).

    Raises FileNotFoundError if the model file is missing.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"Agent model not found at '{path}'. "
            "Run train.py first to train and save an agent."
        )

    payload = json.loads(p.read_text())

    # Re-hydrate Q-table: JSON keys are string lists → convert back to tuples
    Q: dict = {}
    for k_str, v in payload.get("Q", {}).items():
        try:
            key = tuple(json.loads(k_str))
            Q[key] = v
        except Exception:
            pass

    hp = payload.get("hyperparams", {})
    agent = _LoadedQAgent(
        Q       = Q,
        epsilon = hp.get("epsilon", 0.05),
        lr      = hp.get("learning_rate",   0.1),
        gamma   = hp.get("discount_factor", 0.95),
    )
    log.info(
        "Agent loaded ← %s  (type=%s, Q-table states=%d)",
        path, payload.get("agent_type", "unknown"), len(Q),
    )
    return agent


def agent_summary(path: str = "models/q_agent.json") -> dict:
    """Return a metadata dict without fully loading the Q-table."""
    p = Path(path)
    if not p.exists():
        return {"exists": False, "path": path}
    payload = json.loads(p.read_text())
    return {
        "exists":        True,
        "path":          path,
        "agent_type":    payload.get("agent_type"),
        "q_table_size":  payload.get("q_table_size", 0),
        "update_count":  payload.get("update_count", 0),
        "hyperparams":   payload.get("hyperparams", {}),
    }


# ── Minimal agent wrapper returned by load_agent() ────────────────────────────

class _LoadedQAgent:
    """Read-only Q-table agent — predicts actions, does not update weights."""

    def __init__(
        self,
        Q:       dict,
        epsilon: float,
        lr:      float,
        gamma:   float,
    ) -> None:
        self.Q       = Q
        self.epsilon = epsilon
        self.lr      = lr
        self.gamma   = gamma
        self.td_errors: list[float] = []

    def act(self, state: tuple, explore: bool = False) -> int:
        """
        Greedy policy (explore=False) — returns action index with highest Q-value.
        Falls back to action 0 (open_email_inbox) for unseen states.
        """
        n_actions = 15  # must match ACTION_CATALOGUE length in train.py
        q_values  = self.Q.get(state, [0.0] * n_actions)
        return int(max(range(len(q_values)), key=lambda a: q_values[a]))

    def q_values_for(self, state: tuple) -> list[float]:
        """Return raw Q-values for a state (for interpretability / STEP 7)."""
        return self.Q.get(state, [0.0] * 15)

    @property
    def q_table_size(self) -> int:
        return len(self.Q)
