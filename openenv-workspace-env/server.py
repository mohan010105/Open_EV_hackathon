"""
FastAPI server — OpenEnv AI Workspace Assistant Environment.

Endpoints
---------
GET  /                   → live HTML dashboard
GET  /dashboard/...      → static dashboard assets
POST /reset              → start a new episode
POST /step               → apply an action
GET  /state              → inspect state (no step taken)
GET  /episode_replay     → current episode step log
GET  /episodes           → all completed episode logs
GET  /tasks              → list available tasks
GET  /sessions           → session history
GET  /healthz            → liveness probe (HuggingFace Spaces)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from env.environment import WorkspaceEnvironment
from replay.replay_logger import ReplayLogger

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OpenEnv — AI Workspace Assistant",
    version="2.0.0",
    description=(
        "RL environment simulating a digital productivity workspace "
        "(email, calendar, documents). Compatible with HuggingFace Spaces."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve dashboard JS from /dashboard/
_DASHBOARD_DIR = Path(__file__).parent / "dashboard"
if _DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(_DASHBOARD_DIR)), name="dashboard")

# ── Singletons ─────────────────────────────────────────────────────────────────
env    = WorkspaceEnvironment()
replay = ReplayLogger()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ResetRequest(BaseModel):
    task_id: Optional[str] = Field(None, description="Task ID; random if omitted.")
    seed:    Optional[int] = Field(None, description="Random seed (reserved).")


class StepRequest(BaseModel):
    action: str               = Field(..., description="Action name.")
    params: dict[str, Any]   = Field(default_factory=dict, description="Action parameters.")


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse, tags=["dashboard"])
def dashboard():
    """Serve the live HTML monitoring dashboard."""
    html_path = _DASHBOARD_DIR / "dashboard.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="dashboard.html not found")
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/healthz", tags=["health"])
def health_check():
    """Liveness probe — always returns 200 when the server is up."""
    return {"status": "ok", "version": "2.0.0"}


@app.post("/reset", tags=["environment"])
def reset(body: ResetRequest = ResetRequest()):
    """
    Reset the environment and begin a new episode.

    Body (optional JSON):
      task_id : str   – specific task; random if omitted
      seed    : int   – reserved for deterministic seeding
    """
    result = env.reset(task_id=body.task_id, seed=body.seed)
    obs = result["observation"]

    # Notify replay logger
    state_data = env.state()
    replay.begin_episode(
        session_id=state_data.get("session_id", ""),
        task_id=obs.get("task_id", ""),
        task_name=obs.get("current_task", ""),
    )
    log.info("/reset  task=%s session=%s", obs.get("task_id"), state_data.get("session_id"))
    return result


@app.post("/step", tags=["environment"])
def step(body: StepRequest):
    """
    Apply an action and advance the episode by one step.

    Body (required JSON):
      action : str    – action name
      params : dict   – action-specific parameters (optional)
    """
    if not body.action:
        raise HTTPException(status_code=400, detail="'action' is required")

    result = env.step(action=body.action, params=body.params)
    obs    = result["observation"]
    info   = result.get("info", {})

    # Record step in replay log
    replay.record(
        step_number  = obs.get("step_count", 0),
        action       = body.action,
        params       = body.params,
        observation  = obs,
        reward       = result["reward"],
        total_reward = obs.get("total_reward", 0.0),
        done         = result["done"],
        action_valid = info.get("action_valid", True),
        reason       = info.get("reason", ""),
        info         = info,
    )

    # Finalise replay episode if done
    if result["done"]:
        grade = info.get("grade", {})
        replay.end_episode(
            completed    = grade.get("passed", False),
            grader_score = grade.get("score", 0.0),
            total_reward = obs.get("total_reward", 0.0),
        )

    return result


@app.get("/state", tags=["environment"])
def get_state():
    """Return the current environment state without advancing the episode."""
    return env.state()


@app.get("/episode_replay", tags=["replay"])
def episode_replay():
    """
    Return the step-by-step log for the current (in-progress) episode.

    Each entry contains: step, action, params, reward, total_reward,
    done, action_valid, reason, observation_snapshot, timestamp.
    """
    return replay.current_episode()


@app.get("/episodes", tags=["replay"])
def all_episodes():
    """Return all completed episode logs (most recent first)."""
    return {"episodes": replay.all_episodes(), "total": len(replay.all_episodes())}


@app.get("/tasks", tags=["environment"])
def get_tasks():
    """List all available tasks."""
    return {"tasks": env.list_tasks()}


@app.get("/sessions", tags=["environment"])
def get_sessions():
    """Return session history tracked by the environment."""
    return env.get_sessions()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    log.info("Starting OpenEnv Workspace Assistant on port %d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
