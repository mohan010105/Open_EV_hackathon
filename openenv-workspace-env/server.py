"""
FastAPI server — OpenEnv AI Workspace Assistant Environment v2.

Endpoints
---------
GET  /                   → live HTML dashboard
GET  /dashboard/...      → static dashboard assets
POST /reset              → start a new episode
POST /step               → apply an action
GET  /state              → inspect current state (no step)
GET  /episode_replay     → current episode step log
GET  /episodes           → all completed episode logs
GET  /tasks              → list available tasks
GET  /sessions           → session history
GET  /metrics            → aggregated performance metrics
GET  /leaderboard        → agent score rankings
GET  /healthz            → liveness probe
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Literal, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from env.environment import WorkspaceEnvironment
from replay.replay_logger import ReplayLogger
from utils.metrics import MetricsTracker
from utils.leaderboard import Leaderboard

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
        "RL environment simulating a digital productivity workspace. "
        "Supports difficulty levels, training/evaluation modes, "
        "performance metrics, and a leaderboard."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_DASHBOARD_DIR = Path(__file__).parent / "dashboard"
if _DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(_DASHBOARD_DIR)), name="dashboard")

# ── Singletons ─────────────────────────────────────────────────────────────────
env         = WorkspaceEnvironment()
replay      = ReplayLogger()
metrics     = MetricsTracker()
leaderboard = Leaderboard()


# ── Request schemas ────────────────────────────────────────────────────────────

class ResetRequest(BaseModel):
    task_id:    Optional[str]                                   = Field(None,        description="Task ID; random if omitted.")
    seed:       Optional[int]                                   = Field(None,        description="Random seed for reproducibility.")
    difficulty: Literal["easy", "medium", "hard"]              = Field("medium",    description="Difficulty level.")
    mode:       Literal["training", "evaluation"]               = Field("training",  description="training=dense rewards | evaluation=sparse rewards.")
    agent_name: str                                             = Field("agent",     description="Agent identifier for leaderboard tracking.")


class StepRequest(BaseModel):
    action: str              = Field(...,               description="Action name.")
    params: dict[str, Any]  = Field(default_factory=dict, description="Action parameters.")


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
    """Liveness probe."""
    return {"status": "ok", "version": "2.0.0"}


@app.post("/reset", tags=["environment"])
def reset(body: ResetRequest = ResetRequest()):
    """
    Reset the environment and begin a new episode.

    Accepts optional task_id, seed, difficulty, mode, and agent_name.
    """
    result = env.reset(
        task_id=body.task_id,
        seed=body.seed,
        difficulty=body.difficulty,
        mode=body.mode,
        agent_name=body.agent_name,
    )
    obs        = result["observation"]
    state_data = env.state()

    replay.begin_episode(
        session_id=state_data.get("session_id", ""),
        task_id=obs.get("task_id", ""),
        task_name=obs.get("current_task", ""),
    )
    log.info(
        "/reset  task=%s diff=%s mode=%s agent=%s",
        obs.get("task_id"), body.difficulty, body.mode, body.agent_name,
    )
    return result


@app.post("/step", tags=["environment"])
def step(body: StepRequest):
    """Apply an action and advance the episode by one step."""
    if not body.action:
        raise HTTPException(status_code=400, detail="'action' is required")

    result = env.step(action=body.action, params=body.params)
    obs    = result["observation"]
    info   = result.get("info", {})

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

    if result["done"]:
        grade      = info.get("grade", {})
        session    = env.last_session() or {}

        # End replay episode
        replay.end_episode(
            completed    = grade.get("passed",  False),
            grader_score = grade.get("score",   0.0),
            total_reward = obs.get("total_reward", 0.0),
        )

        # Record metrics
        metrics.record(
            session_id   = session.get("session_id", ""),
            task_id      = session.get("task_id",    obs.get("task_id", "")),
            task_name    = session.get("task_name",  ""),
            mode         = session.get("mode",       "training"),
            difficulty   = session.get("difficulty", "medium"),
            success      = grade.get("passed",  False),
            grader_score = grade.get("score",   0.0),
            total_reward = obs.get("total_reward", 0.0),
            steps        = obs.get("step_count", 0),
            agent_name   = session.get("agent_name", "agent"),
        )

        # Update leaderboard (evaluation mode only, or always — configurable)
        leaderboard.record_score(
            agent_name   = session.get("agent_name", "agent"),
            grader_score = grade.get("score",   0.0),
            total_reward = obs.get("total_reward", 0.0),
            task_id      = session.get("task_id",    obs.get("task_id", "")),
            task_name    = session.get("task_name",  ""),
            mode         = session.get("mode",       "training"),
        )

    return result


@app.get("/state", tags=["environment"])
def get_state():
    """Return current environment state without stepping."""
    return env.state()


@app.get("/episode_replay", tags=["replay"])
def episode_replay():
    """Return the step log for the current in-progress episode."""
    return replay.current_episode()


@app.get("/episodes", tags=["replay"])
def all_episodes():
    """Return all completed episode logs (most recent first)."""
    episodes = replay.all_episodes()
    return {"episodes": episodes, "total": len(episodes)}


@app.get("/tasks", tags=["environment"])
def get_tasks():
    """List the named tasks available by ID."""
    return {"tasks": env.list_tasks()}


@app.get("/sessions", tags=["environment"])
def get_sessions():
    """Return session history tracked by the environment."""
    return env.get_sessions()


@app.get("/metrics", tags=["analytics"])
def get_metrics(mode: Optional[str] = Query(None, description="Filter by 'training' or 'evaluation'")):
    """
    Return aggregated performance metrics across all completed episodes.

    Optional query param `mode=training|evaluation` filters by episode mode.

    Example response:
        {
          "episode_count": 10,
          "success_rate":  0.80,
          "avg_reward":    0.72,
          "avg_steps":     6.4,
          "avg_score":     0.75,
          "by_task":       { ... },
          "by_difficulty": { ... },
          "by_mode":       { ... }
        }
    """
    return metrics.get_metrics(mode=mode)


@app.get("/leaderboard", tags=["analytics"])
def get_leaderboard(limit: int = Query(20, ge=1, le=100)):
    """
    Return agent scores ranked by average grader score (descending).

    Example response:
        [
          { "rank": 1, "agent": "gpt-4o", "average_score": 0.92, "episodes_run": 15 },
          { "rank": 2, "agent": "agent",  "average_score": 0.65, "episodes_run": 8  }
        ]
    """
    return {"leaderboard": leaderboard.get_leaderboard(limit=limit)}


@app.delete("/metrics", tags=["analytics"])
def reset_metrics():
    """Clear all metrics history."""
    metrics.reset()
    return {"status": "metrics cleared"}


@app.delete("/leaderboard", tags=["analytics"])
def reset_leaderboard():
    """Clear the leaderboard."""
    leaderboard.reset()
    return {"status": "leaderboard cleared"}


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    log.info("Starting OpenEnv Workspace Assistant v2 on port %d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
