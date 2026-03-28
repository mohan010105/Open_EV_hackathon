"""
FastAPI server for the OpenEnv AI Web Navigation Training Environment.
Exposes the RL interface over HTTP: reset(), step(action), state().
"""

import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from env.environment import WebNavigationEnvironment
from env.tasks import TASKS

# ── App setup ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="OpenEnv AI Web Navigation",
    description="RL environment for training AI agents on web navigation tasks",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton environment instance
environment = WebNavigationEnvironment()

# ── Routes ─────────────────────────────────────────────────────────────────


@app.get("/api/healthz")
def health_check():
    """Health check endpoint for automated validation pings."""
    return {"status": "ok"}


@app.post("/api/env/reset")
def reset_environment(body: dict = None):
    """
    Reset the environment to the initial state.
    Optionally pass { task_id, seed } in the request body.
    """
    body = body or {}
    task_id = body.get("taskId") or body.get("task_id")
    seed = body.get("seed")
    result = environment.reset(task_id=task_id, seed=seed)
    return result


@app.post("/api/env/step")
def step_environment(body: dict):
    """
    Execute an action in the environment.
    Body: { action: str, params: dict }
    """
    if not body or "action" not in body:
        raise HTTPException(status_code=400, detail="Missing required field: action")

    action = body["action"]
    params = body.get("params", {})
    result = environment.step(action, params)
    return result


@app.get("/api/env/state")
def get_state():
    """Return the current environment state without modifying it."""
    return environment.get_state()


@app.get("/api/env/tasks")
def list_tasks():
    """List all available tasks."""
    return {"tasks": TASKS}


@app.get("/api/env/sessions")
def get_sessions():
    """Return session history with metrics."""
    return environment.get_sessions()


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
