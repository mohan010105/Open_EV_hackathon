"""
inference.py — OpenEnv Workspace Assistant LLM inference loop.

Reads environment variables:
  API_BASE_URL  – base URL of the running FastAPI server  (default: http://localhost:7860)
  MODEL_NAME    – model to use with the OpenAI-compatible API  (default: gpt-4o-mini)
  HF_TOKEN      – HuggingFace token (used as the OpenAI API key)
  TASK_ID       – optional task to run  (default: random)
  MAX_STEPS     – episode step limit override  (default: 20)

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
TASK_ID      = os.getenv("TASK_ID",      "")        # empty → random
MAX_STEPS    = int(os.getenv("MAX_STEPS", "20"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── OpenAI client (HF Inference endpoint or any compatible API) ────────────────
client = OpenAI(
    api_key=HF_TOKEN or "hf_anonymous",
    base_url=f"{API_BASE_URL}/v1" if HF_TOKEN else None,
)

# ── Environment HTTP helpers ───────────────────────────────────────────────────

def _post(path: str, payload: dict | None = None) -> dict:
    url = f"{API_BASE_URL}{path}"
    resp = httpx.post(url, json=payload or {}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> dict:
    url = f"{API_BASE_URL}{path}"
    resp = httpx.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── Prompt builders ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are an AI agent operating inside the OpenEnv Workspace Assistant environment.
You must complete the given task by choosing one action per turn from the list of
available_actions.

Respond ONLY with a valid JSON object in this exact format:
{
  "action": "<action_name>",
  "params": { ... }   // include only when required; omit for no-param actions
}

Action parameter reference:
  search_email        → {"sender": "<name>"}
  read_email          → {"email_id": "<id>"}
  move_document       → {"document_id": "<id>", "folder": "<folder_name>"}
  create_calendar_event, open_email_inbox, view_calendar, view_documents, noop → no params

Do NOT include any explanation or markdown — pure JSON only.
"""


def build_user_message(obs: dict) -> str:
    """Serialise the observation into a concise prompt for the model."""
    lines = [
        f"TASK: {obs.get('task_description', '')}",
        f"CURRENT APP: {obs['current_app']}",
        f"STEP: {obs['step_count']}  TOTAL REWARD: {obs['total_reward']:.3f}",
        f"AVAILABLE ACTIONS: {', '.join(obs['available_actions'])}",
    ]

    if obs.get("email_list"):
        lines.append("\nEMAILS IN VIEW:")
        for e in obs["email_list"]:
            flag = "[UNREAD]" if not e["read"] else "[read]"
            mtg  = " [has meeting details]" if e.get("has_meeting_details") else ""
            lines.append(f"  {flag} id={e['id']} from={e['sender']!r} subj={e['subject']!r}{mtg}")

    if obs.get("selected_email"):
        em = obs["selected_email"]
        lines.append(f"\nOPEN EMAIL ({em['id']}) — {em['sender']}: {em['subject']}")
        lines.append(em.get("body", "")[:400])

    if obs.get("calendar_events"):
        lines.append("\nCALENDAR EVENTS:")
        for ev in obs["calendar_events"]:
            new = " [NEW]" if ev.get("created_from_email") else ""
            lines.append(f"  {ev['date']} {ev['time']} — {ev['title']}{new}")

    if obs.get("documents"):
        lines.append("\nDOCUMENTS:")
        for d in obs["documents"]:
            lines.append(f"  id={d['id']} name={d['name']!r} folder={d['folder']!r}")

    return "\n".join(lines)


# ── Main episode loop ──────────────────────────────────────────────────────────

def run_episode() -> dict[str, Any]:
    log.info("=" * 60)
    log.info("OpenEnv Workspace Assistant — inference episode")
    log.info("API_BASE_URL : %s", API_BASE_URL)
    log.info("MODEL_NAME   : %s", MODEL_NAME)
    log.info("TASK_ID      : %s", TASK_ID or "(random)")
    log.info("MAX_STEPS    : %d", MAX_STEPS)
    log.info("=" * 60)

    # 1. Reset environment
    reset_payload = {"task_id": TASK_ID} if TASK_ID else {}
    result = _post("/reset", reset_payload)
    log.info("Episode started | task=%s", result["observation"]["task_id"])

    episode_reward = 0.0
    step_log: list[dict] = []
    history: list[dict] = []  # OpenAI message history

    for step_n in range(1, MAX_STEPS + 1):
        obs = result["observation"]

        # 2. Build prompt
        user_msg = build_user_message(obs)
        history.append({"role": "user", "content": user_msg})

        # 3. Query LLM
        try:
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}] + history,
                temperature=0.0,
                max_tokens=128,
            )
            raw = completion.choices[0].message.content.strip()
        except Exception as exc:
            log.warning("LLM call failed: %s — using noop", exc)
            raw = '{"action": "noop", "params": {}}'

        history.append({"role": "assistant", "content": raw})

        # 4. Parse action
        try:
            action_obj = json.loads(raw)
            action = action_obj.get("action", "noop")
            params = action_obj.get("params", {})
        except json.JSONDecodeError:
            log.warning("Invalid JSON from model: %r — using noop", raw)
            action, params = "noop", {}

        # 5. Step environment
        result   = _post("/step", {"action": action, "params": params})
        reward   = result["reward"]
        done     = result["done"]
        info     = result.get("info", {})
        episode_reward += reward

        step_log.append({
            "step":   step_n,
            "action": action,
            "params": params,
            "reward": round(reward, 4),
            "total":  round(result["observation"]["total_reward"], 4),
            "reason": info.get("reason", ""),
            "valid":  info.get("action_valid", True),
        })

        log.info(
            "step %2d | %-25s reward=%+.3f  total=%.3f  %s",
            step_n, action, reward,
            result["observation"]["total_reward"],
            "✓" if info.get("action_valid") else "✗ " + info.get("reason", ""),
        )

        if done:
            grade = info.get("grade", {})
            log.info(
                "Episode done | grader_score=%.2f  passed=%s  feedback=%s",
                grade.get("score", 0.0),
                grade.get("passed", False),
                grade.get("feedback", ""),
            )
            break

        time.sleep(0.1)   # small throttle

    # 6. Summary
    summary = {
        "task_id":       obs["task_id"],
        "steps":         step_n,
        "episode_reward": round(episode_reward, 4),
        "total_reward":  round(result["observation"]["total_reward"], 4),
        "done":          done,
        "step_log":      step_log,
    }
    log.info("=" * 60)
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
