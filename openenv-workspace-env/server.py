"""
FastAPI server exposing the OpenEnv Workspace Assistant environment.

Endpoints
---------
POST /reset          – start a new episode
POST /step           – apply an action
GET  /state          – inspect current state without stepping
GET  /tasks          – list available tasks
GET  /sessions       – session history
GET  /healthz        – health check (for HuggingFace Spaces pings)
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from env.environment import WorkspaceEnvironment

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

# ── App & CORS ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OpenEnv — AI Workspace Assistant",
    version="1.0.0",
    description="RL environment for email, calendar, and document productivity tasks.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singleton environment ──────────────────────────────────────────────────────
env = WorkspaceEnvironment()


# ── Request / Response schemas ─────────────────────────────────────────────────

class ResetRequest(BaseModel):
    task_id: Optional[str] = Field(None, description="Task ID. Random if omitted.")
    seed:    Optional[int] = Field(None, description="Random seed (reserved).")


class StepRequest(BaseModel):
    action: str                           = Field(..., description="Action name.")
    params: dict[str, Any]               = Field(default_factory=dict)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["health"])
def health_check():
    """Liveness probe — always returns 200 when the server is up."""
    return {"status": "ok"}


@app.post("/reset", tags=["environment"])
def reset(body: ResetRequest = ResetRequest()):
    """Reset the environment and begin a new episode."""
    result = env.reset(task_id=body.task_id, seed=body.seed)
    log.info("/reset → task=%s", result["observation"].get("task_id"))
    return result


@app.post("/step", tags=["environment"])
def step(body: StepRequest):
    """Apply an action and advance the episode."""
    if not body.action:
        raise HTTPException(status_code=400, detail="'action' field is required")
    result = env.step(action=body.action, params=body.params)
    return result


@app.get("/state", tags=["environment"])
def get_state():
    """Return current environment state without stepping."""
    return env.state()


@app.get("/tasks", tags=["environment"])
def get_tasks():
    """List all available tasks."""
    return {"tasks": env.list_tasks()}


@app.get("/sessions", tags=["environment"])
def get_sessions():
    """Return session history for the current server process."""
    return env.get_sessions()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    log.info("Starting OpenEnv Workspace Assistant on port %d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
