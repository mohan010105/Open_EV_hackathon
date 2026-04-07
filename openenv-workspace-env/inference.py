"""
inference.py — OpenEnv Workspace Assistant inference loop.

STEP 4  : MAX_STEPS capped at 12 (env var override: MAX_STEPS=N).
STEP 6  : fallback action = "noop" on any LLM or parse failure.
STEP 7  : minimal print-level logs for action + reward every step.
STEP 9  : stops cleanly when done or MAX_STEPS reached; handles all failures.

Environment variables
---------------------
  API_BASE_URL  – base URL of the running FastAPI server  (default: http://localhost:7860)
  MODEL_NAME    – OpenAI-compatible model name            (default: gpt-4o-mini)
  HF_TOKEN      – HuggingFace / OpenAI API key
  TASK_ID       – optional task to run                   (default: random)
  MAX_STEPS     – episode step limit                     (default: 12)

Usage
-----
  export HF_TOKEN=hf_...
  export API_BASE_URL=https://your-space.hf.space
  python inference.py
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from typing import Any

import httpx
from openai import OpenAI

# ── Configuration ──────────────────────────────────────────────────────────────
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:7860").rstrip("/")
MODEL_NAME   = os.getenv("MODEL_NAME",   "gpt-4o-mini")
HF_TOKEN     = os.getenv("HF_TOKEN",     "")
TASK_ID      = os.getenv("TASK_ID",      "")

# STEP 4: cap at 12 by default; caller can raise via env var (max 15)
MAX_STEPS    = min(15, max(1, int(os.getenv("MAX_STEPS", "12"))))

# Runtime guard — abort if wall-clock exceeds this (STEP 4)
MAX_WALL_SECONDS = 18 * 60   # 18 minutes → leaves 2 min margin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── OpenAI client ──────────────────────────────────────────────────────────────
client = OpenAI(
    api_key=HF_TOKEN or "hf_anonymous",
    base_url=f"{API_BASE_URL}/v1" if HF_TOKEN else None,
)

# ── STEP 6: canonical fallback ─────────────────────────────────────────────────
FALLBACK_ACTION = "noop"
FALLBACK_PARAMS: dict = {}

# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _post(path: str, payload: dict | None = None) -> dict:
    """POST to the environment server; raise on HTTP error."""
    resp = httpx.post(f"{API_BASE_URL}{path}", json=payload or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> dict:
    resp = httpx.get(f"{API_BASE_URL}{path}", timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── STEP 5: safe step wrapper — always returns {observation, reward, done} ─────

def safe_step(action: str, params: dict) -> dict:
    """
    Call /step and guarantee the response always contains
    observation, reward, and done — no crashes allowed.
    """
    try:
        result = _post("/step", {"action": action, "params": params})
        # Ensure required keys are present (defensive)
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


# ── Prompt builders ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are an AI agent operating inside the OpenEnv Workspace Assistant environment.
Complete the task by choosing ONE action per turn from available_actions.

Respond ONLY with a valid JSON object:
{
  "action": "<action_name>",
  "params": {}
}

Parameter reference:
  search_email        → {"sender": "<name>"}
  read_email          → {"email_id": "<id>"}
  move_document       → {"document_id": "<id>", "folder": "<folder>"}
  All other actions   → no params needed

No explanation, no markdown — pure JSON only.
"""


def build_user_message(obs: dict) -> str:
    lines = [
        f"TASK: {obs.get('task_description', '')}",
        f"APP:  {obs.get('current_app', 'unknown')}",
        f"STEP: {obs.get('step_count', 0)}  REWARD: {obs.get('total_reward', 0.0):.3f}",
        f"ACTIONS: {', '.join(obs.get('available_actions', ['noop']))}",
    ]

    if obs.get("email_list"):
        lines.append("\nEMAILS:")
        for e in obs["email_list"]:
            flag = "[UNREAD]" if not e.get("read") else "[read]"
            mtg  = " [meeting]" if e.get("has_meeting_details") else ""
            lines.append(f"  {flag} id={e['id']} from={e['sender']!r} subj={e['subject']!r}{mtg}")

    if obs.get("selected_email"):
        em = obs["selected_email"]
        lines.append(f"\nOPEN EMAIL ({em['id']}) — {em['sender']}: {em['subject']}")
        lines.append(em.get("body", "")[:300])

    if obs.get("calendar_events"):
        lines.append("\nCALENDAR:")
        for ev in obs["calendar_events"]:
            new = " [NEW]" if ev.get("created_from_email") else ""
            lines.append(f"  {ev.get('date','?')} {ev.get('time','?')} — {ev.get('title','?')}{new}")

    if obs.get("documents"):
        lines.append("\nDOCS:")
        for d in obs["documents"]:
            lines.append(f"  {d['id']} {d['name']!r} → {d['folder']!r}")

    return "\n".join(lines)


# ── STEP 3: input validation helper ───────────────────────────────────────────

def validate_obs(obs: dict) -> list[str]:
    """Return a list of validation errors; empty = OK."""
    errors: list[str] = []
    required = ["task_id", "current_app", "available_actions",
                "email_list", "documents", "calendar_events",
                "step_count", "total_reward"]
    for k in required:
        if k not in obs:
            errors.append(f"MISSING: {k!r}")
        elif obs[k] is None:
            errors.append(f"NULL: {k!r}")
    if "available_actions" in obs and obs["available_actions"] is not None:
        if not isinstance(obs["available_actions"], list):
            errors.append("available_actions must be a list")
    return errors


# ── Main episode loop ──────────────────────────────────────────────────────────

def run_episode() -> dict[str, Any]:
    log.info("=" * 60)
    log.info("OpenEnv inference | api=%s model=%s task=%s max_steps=%d",
             API_BASE_URL, MODEL_NAME, TASK_ID or "(random)", MAX_STEPS)
    log.info("=" * 60)

    # 1. Reset — STEP 5: safe, always returns well-formed dict
    try:
        reset_payload = {"task_id": TASK_ID} if TASK_ID else {}
        result = _post("/reset", reset_payload)
        log.info("Episode started | task=%s", result["observation"].get("task_id"))
    except Exception as exc:
        log.error("Failed to reset environment: %s", exc)
        return {"error": str(exc), "done": False, "steps": 0}

    episode_reward = 0.0
    step_log: list[dict] = []
    history:  list[dict] = []
    wall_start = time.time()

    for step_n in range(1, MAX_STEPS + 1):
        # STEP 4: wall-clock runtime guard
        if time.time() - wall_start > MAX_WALL_SECONDS:
            log.warning("Wall-clock limit reached — stopping early at step %d", step_n)
            break

        obs = result.get("observation", {})

        # STEP 3: validate incoming obs
        val_errors = validate_obs(obs)
        if val_errors:
            log.warning("Observation validation errors: %s — using noop", val_errors)
            result = safe_step(FALLBACK_ACTION, FALLBACK_PARAMS)
            continue

        # 2. Build prompt
        user_msg = build_user_message(obs)
        history.append({"role": "user", "content": user_msg})

        # 3. Query LLM — STEP 6: fallback to noop on any failure
        action, params = FALLBACK_ACTION, FALLBACK_PARAMS
        try:
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}] + history[-10:],
                temperature=0.0,
                max_tokens=128,
            )
            raw = completion.choices[0].message.content.strip()
            history.append({"role": "assistant", "content": raw})

            # 4. Parse action — STEP 6: fallback on bad JSON
            action_obj = json.loads(raw)
            action = action_obj.get("action") or FALLBACK_ACTION
            params = action_obj.get("params") or {}
            if not isinstance(params, dict):
                params = {}

        except json.JSONDecodeError:
            log.warning("step %d: bad JSON from model → noop", step_n)
            history.append({"role": "assistant", "content": '{"action":"noop","params":{}}'})
        except Exception as exc:
            log.warning("step %d: LLM call failed (%s) → noop", step_n, exc)
            history.append({"role": "assistant", "content": '{"action":"noop","params":{}}'})

        # 5. Step — STEP 5: safe wrapper, no crashes
        result  = safe_step(action, params)
        reward  = result["reward"]
        done    = result["done"]
        info    = result.get("info", {})
        episode_reward += reward

        # STEP 7: minimal required logs
        print(f"Action: {action}")
        print(f"Reward: {reward:+.3f}")

        step_log.append({
            "step":   step_n,
            "action": action,
            "params": params,
            "reward": round(reward, 4),
            "total":  round(result["observation"].get("total_reward", episode_reward), 4),
            "reason": info.get("reason", ""),
            "valid":  info.get("action_valid", True),
        })

        log.info(
            "step %2d | %-25s reward=%+.3f  total=%.3f  %s",
            step_n, action, reward,
            result["observation"].get("total_reward", 0.0),
            "✓" if info.get("action_valid", True) else "✗ " + info.get("reason", ""),
        )

        if done:
            grade = info.get("grade", {})
            log.info(
                "Episode DONE | score=%.2f  passed=%s  feedback=%s",
                grade.get("score", 0.0),
                grade.get("passed", False),
                grade.get("feedback", ""),
            )
            break

        time.sleep(0.05)   # minimal throttle — keeps runtime well under 20 min

    # 6. Summary
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
        log.error(
            "Cannot connect to %s — is the server running?\n"
            "  Start it with:  uvicorn server:app --port 7860",
            API_BASE_URL,
        )
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Interrupted by user.")
        sys.exit(0)
