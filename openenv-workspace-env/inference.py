"""
inference.py — OpenEnv Workspace Assistant ML inference loop.

STEP 1: REMOVE UNNECESSARY COMPUTATION: no retraining, no LLM queries, no heavy loops.
STEP 2: FIX ML PIPELINE: Uses pre-trained `q_agent.json` and saved `encoder.json`.
STEP 3: INPUT VALIDATION: Validates inputs before scaling via `ObservationEncoder.validate(obs)`.
STEP 4: FAST INFERENCE MODE: Capped at 15 steps; handles runtime limits cleanly.
STEP 5: STABLE API RESPONSES: Enforced via safe_step() with required keys.
STEP 6: ADD FALLBACK ACTION: "noop" used when models fail or invalid inputs occur.
STEP 7: LOGGING + DEBUG: Action, Reward displayed; minimal stdout.
STEP 9: INFERENCE SCRIPT OPTIMIZATION: Handles failures gracefully, stops when done.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from copy import deepcopy
from typing import Any

import httpx

# ── ML Components Import ───────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from utils.preprocessor import ObservationEncoder
from utils.agent_io import load_agent

# ── Configuration ──────────────────────────────────────────────────────────────
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:7860").rstrip("/")
TASK_ID      = os.getenv("TASK_ID",      "")

# STEP 4: FAST INFERENCE MODE limit
MAX_STEPS    = min(15, max(1, int(os.getenv("MAX_STEPS", "12"))))
MAX_WALL_SECONDS = 19 * 60  # Ensure runtime < 20 minutes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# STEP 6: ADD FALLBACK ACTION
FALLBACK_ACTION = "noop"
FALLBACK_PARAMS: dict = {}

ENCODER_PATH = os.path.join(os.path.dirname(__file__), "models", "encoder.json")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "q_agent.json")

ACTION_CATALOGUE = [
    ("open_email_inbox",        {}),
    ("search_email",            {"sender": "Alex"}),
    ("search_email",            {"sender": "Sarah"}),
    ("search_email",            {"sender": "HR"}),
    ("read_email",              {"email_id": "email_001"}),
    ("read_email",              {"email_id": "email_002"}),
    ("read_email",              {"email_id": "email_003"}),
    ("extract_meeting_details", {}),
    ("create_calendar_event",   {}),
    ("view_calendar",           {}),
    ("view_documents",          {}),
    ("move_document",           {"document_id": "doc_001", "folder": "Projects"}),
    ("move_document",           {"document_id": "doc_001", "folder": "HR"}),
    ("move_document",           {"document_id": "doc_002", "folder": "Projects"}),
    ("noop",                    {}),
]

# ── API Helpers ────────────────────────────────────────────────────────────────

def _post(path: str, payload: dict | None = None) -> dict:
    resp = httpx.post(f"{API_BASE_URL}{path}", json=payload or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()

def safe_step(action: str, params: dict) -> dict:
    """STEP 5: STABLE API RESPONSES. Ensures observation, reward and done exist."""
    try:
        result = _post("/step", {"action": action, "params": params})
        return {
            "observation": result.get("observation", {}),
            "reward":      float(result.get("reward", 0.0)),
            "done":        bool(result.get("done", False)),
            "info":        result.get("info", {}),
        }
    except Exception as exc:
        log.warning("safe_step: /step call failed (%s) — returning noop result", exc)
        return {
            "observation": {},
            "reward":      0.0,
            "done":        False,
            "info":        {"error": str(exc), "fallback": True},
        }

# ── Main ML Loop ───────────────────────────────────────────────────────────────

def run_episode() -> dict[str, Any]:
    log.info("=" * 60)
    log.info("OpenEnv ML inference | api=%s task=%s max_steps=%d",
             API_BASE_URL, TASK_ID or "(random)", MAX_STEPS)
    log.info("=" * 60)

    # 1. Reset
    try:
        reset_payload = {"task_id": TASK_ID} if TASK_ID else {}
        result = _post("/reset", reset_payload)
        log.info("Episode started | task=%s", result["observation"].get("task_id"))
    except Exception as exc:
        log.error("Failed to reset environment: %s", exc)
        return {"error": str(exc), "done": False, "steps": 0}

    # STEP 2: FIX ML PIPELINE
    enc = None
    agent = None
    try:
        enc = ObservationEncoder.load(ENCODER_PATH)
        agent = load_agent(MODEL_PATH)
    except Exception as exc:
        log.error("Failed to load encoder or model: %s. Using fallback agent.", exc)

    episode_reward = 0.0
    step_log: list[dict] = []
    wall_start = time.time()

    done = False
    step_n = 0

    for step_n in range(1, MAX_STEPS + 1):
        if time.time() - wall_start > MAX_WALL_SECONDS:
            log.warning("Wall-clock limit reached — stopping early at step %d", step_n)
            break

        obs = result.get("observation", {})
        action, params = FALLBACK_ACTION, FALLBACK_PARAMS

        if enc and agent:
            # STEP 3: INPUT VALIDATION
            val_errors = enc.validate(obs)
            if val_errors:
                log.warning("Observation validation errors: %s — using noop", val_errors)
            else:
                try:
                    # STEP 1: REMOVE UNNECESSARY COMPUTATION
                    X_input = enc.transform(obs)
                    action_idx = agent.act(X_input, explore=False)
                    action, params = ACTION_CATALOGUE[action_idx]
                    params = deepcopy(params)
                except Exception as exc:
                    log.error("Inference prediction failed (%s) — using fallback noop", exc)
        else:
            log.debug("ML Pipeline missing — using fallback noop")

        # Execute Step
        result = safe_step(action, params)
        reward = result["reward"]
        done   = result["done"]
        info   = result.get("info", {})
        episode_reward += reward

        # STEP 7: LOGGING + DEBUG
        print(f"Action: {action}")
        print(f"Reward: {reward}")

        step_log.append({
            "step":   step_n,
            "action": action,
            "params": params,
            "reward": round(reward, 4),
            "total":  round(result["observation"].get("total_reward", episode_reward), 4),
            "reason": info.get("reason", ""),
            "valid":  info.get("action_valid", True),
        })

        if done:
            grade = info.get("grade", {})
            log.info(
                "Episode DONE | score=%.2f  passed=%s",
                grade.get("score", 0.0),
                grade.get("passed", False),
            )
            break

        time.sleep(0.01)

    final_obs = result.get("observation", {})
    summary = {
        "task_id":        final_obs.get("task_id", TASK_ID or "unknown"),
        "steps":          step_n,
        "episode_reward": round(episode_reward, 4),
        "total_reward":   round(final_obs.get("total_reward", episode_reward), 4),
        "done":           done,
        "step_log":       step_log,
    }
    
    log.info("SUMMARY: %s", json.dumps(summary, indent=2))
    return summary

if __name__ == "__main__":
    try:
        run_episode()
    except httpx.ConnectError:
        log.error("Cannot connect to %s — is the server running?", API_BASE_URL)
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")
        sys.exit(0)
