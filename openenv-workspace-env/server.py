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
from utils.preprocessor import ObservationEncoder, FEATURE_NAMES, N_FEATURES
from utils.agent_io import load_agent, save_agent, agent_summary

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

# ── Inference pipeline singletons ──────────────────────────────────────────────
_ENCODER_PATH = "models/encoder.json"
_MODEL_PATH   = "models/q_agent.json"

# Lazily initialised — only loaded if models/ files exist
_encoder: Optional[ObservationEncoder] = None
_agent                                  = None

def _get_encoder() -> ObservationEncoder:
    global _encoder
    if _encoder is None:
        from pathlib import Path as _Path
        if _Path(_ENCODER_PATH).exists():
            _encoder = ObservationEncoder.load(_ENCODER_PATH)
        else:
            _encoder = ObservationEncoder().fit()
    return _encoder

def _get_agent():
    global _agent
    from pathlib import Path as _Path
    if _agent is None and _Path(_MODEL_PATH).exists():
        _agent = load_agent(_MODEL_PATH)
    return _agent

# Action catalogue (must match train.py)
_ACTION_CATALOGUE = [
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
    """Reset the environment and begin a new episode. Always returns 200."""
    try:
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
        log.info("/reset task=%s diff=%s mode=%s agent=%s",
                 obs.get("task_id"), body.difficulty, body.mode, body.agent_name)
        return result
    except Exception as exc:
        log.error("/reset failed: %s", exc)
        # STEP 5 — stable fallback response
        return {
            "observation": env.state().get("observation", {}),
            "reward":      0.0,
            "done":        False,
            "info":        {"error": str(exc)},
        }


@app.post("/step", tags=["environment"])
def step(body: StepRequest):
    """Apply an action and advance the episode. Always returns 200."""
    # STEP 6: default to noop if action is empty
    action = body.action if body.action else "noop"

    try:
        result = env.step(action=action, params=body.params)
    except Exception as exc:
        log.error("/step failed: %s — returning noop result", exc)
        return {
            "observation": env.state().get("observation", {}),
            "reward":      0.0,
            "done":        False,
            "info":        {"error": str(exc), "fallback_action": "noop"},
        }

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
    """Return current environment state without stepping. Always returns 200."""
    try:
        st = env.state()
        return {
            "observation": st.get("observation", {}),
            "reward": 0.0,
            "done": not st.get("is_active", True),
            "session_id": st.get("session_id", ""),
            "is_active": st.get("is_active", False),
            "difficulty": st.get("difficulty", "medium"),
            "mode": st.get("mode", "training"),
            "created_at": st.get("created_at", "")
        }
    except Exception as exc:
        log.error("/state failed: %s", exc)
        return {
            "observation": {},
            "reward": 0.0,
            "done": False,
            "session_id":  "",
            "is_active":   False,
            "created_at":  "",
            "error":       str(exc),
        }


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


# ── Inference / prediction endpoints ───────────────────────────────────────────

class PredictRequest(BaseModel):
    observation: dict[str, Any] = Field(..., description="Raw observation dict from /state")


@app.post("/predict", tags=["inference"])
def predict(body: PredictRequest):
    """
    Real-time prediction endpoint. Never crashes — falls back to 'noop' on failure.

    STEP 3: validates input before encoding.
    STEP 5: returns stable {action, params, ...} always.
    STEP 6: action = 'noop' when model not available or validation fails.
    STEP 7: prints Action + Reward to stdout for debugging.
    """
    try:
        enc = _get_encoder()

        # STEP 3 — validate incoming input
        val_errors = enc.validate(body.observation)
        if val_errors:
            log.warning("/predict validation errors: %s — using noop", val_errors)
            print("Action: noop  (validation failed)")
            print("Reward: 0.000  (no step taken)")
            return {
                "action":           "noop",
                "params":           {},
                "action_idx":       14,
                "feature_vec":      [],
                "feature_names":    FEATURE_NAMES,
                "validation":       "failed",
                "validation_errors": val_errors,
                "fallback":         True,
            }

        # STEP 2 — apply the saved encoder (not raw dict)
        feature_vec = enc.transform(body.observation)
        agent = _get_agent()

        # STEP 6 — noop fallback when no trained model is available
        if agent is None:
            log.warning("/predict: no trained agent — returning noop fallback")
            action_name, action_params = "noop", {}
            action_idx = 14
        else:
            # STEP 1 — use loaded agent (not a new zero Q-table)
            action_idx = agent.act(feature_vec, explore=False)
            action_name, action_params = _ACTION_CATALOGUE[action_idx]

        # STEP 7 — minimal debug output
        print(f"Action: {action_name}")
        print(f"Reward: N/A (prediction only — call /step to get reward)")

        return {
            "action":        action_name,
            "params":        action_params,
            "action_idx":    action_idx,
            "feature_vec":   list(feature_vec),
            "feature_names": FEATURE_NAMES,
            "validation":    "passed",
            "fallback":      agent is None,
        }

    except Exception as exc:
        log.error("/predict exception: %s — returning noop", exc)
        print(f"Action: noop  (exception: {exc})")
        print("Reward: 0.000")
        return {
            "action":     "noop",
            "params":     {},
            "action_idx": 14,
            "feature_vec": [],
            "feature_names": FEATURE_NAMES,
            "validation": "error",
            "error":      str(exc),
            "fallback":   True,
        }


class TrainRequest(BaseModel):
    episodes:   int                                     = Field(60,        ge=5,   le=500)
    task_id:    Optional[str]                           = Field(None)
    difficulty: Literal["easy", "medium", "hard"]      = Field("medium")
    agent_type: Literal["q_table", "greedy", "random"] = Field("q_table")
    learning_rate: float                                = Field(0.10, ge=0.001, le=1.0)


@app.post("/train", tags=["inference"])
def train_agent(body: TrainRequest):
    """
    Run a training session and save the resulting agent + encoder.

    Returns training diagnostics: reward history, success rate, TD loss,
    and the resolved root causes from the pipeline audit.
    """
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))

    import random
    import time
    from copy import deepcopy
    from collections import defaultdict

    enc = ObservationEncoder().fit()
    enc.save(_ENCODER_PATH)

    global _encoder, _agent
    _encoder = enc
    _agent   = None  # reset so next /predict loads fresh

    # ── Inline Q-table agent ────────────────────────────────────────────────
    N_ACT = len(_ACTION_CATALOGUE)

    class _QAgent:
        def __init__(self, lr, gamma=0.95, eps=1.0, eps_min=0.05, eps_dec=0.97):
            self.lr = lr; self.gamma = gamma
            self.epsilon = eps; self.eps_min = eps_min; self.eps_dec = eps_dec
            self.Q: dict = defaultdict(lambda: [0.0] * N_ACT)
            self.td_errors: list = []
            self._update_count = 0
            self.q_table_size_val = 0

        def act(self, state, explore=True):
            if explore and random.random() < self.epsilon:
                return random.randrange(N_ACT)
            return int(max(range(N_ACT), key=lambda a: self.Q[state][a]))

        def update(self, s, a, r, s_next, done):
            q_cur = self.Q[s][a]
            q_next = 0.0 if done else max(self.Q[s_next])
            td = r + self.gamma * q_next - q_cur
            self.Q[s][a] += self.lr * td
            self.td_errors.append(abs(td))
            self._update_count += 1
            self.q_table_size_val = len(self.Q)
            return abs(td)

        def decay(self):
            self.epsilon = max(self.eps_min, self.epsilon * self.eps_dec)

    if body.agent_type == "q_table":
        agent = _QAgent(lr=body.learning_rate)
    else:
        agent = None  # greedy/random handled below

    train_rewards: list[float] = []
    train_success: list[bool]  = []
    train_losses:  list[float] = []
    eval_rewards:  list[float] = []
    eval_success:  list[bool]  = []

    # Greedy playbooks
    _PLAYBOOKS = {
        "ws_task_1": [0, 1, 4],
        "ws_task_2": [0, 1, 4, 7, 8],
        "ws_task_3": [10, 11],
    }

    def run_ep(mode_: str, seed_: int, explore_: bool):
        env_ep = WorkspaceEnvironment()
        result = env_ep.reset(task_id=body.task_id, difficulty=body.difficulty,
                              mode=mode_, seed=seed_, agent_name=body.agent_type)
        obs = result["observation"]
        task_key = obs.get("task_id", "ws_task_2")
        state = enc.transform(obs)
        ep_r = 0.0; ep_l = 0.0; done = False; step = 0
        playbook = _PLAYBOOKS.get(task_key, [14])
        pb_step = 0

        while not done and step < 15:  # STEP 4: cap at MAX_STEPS=15
            if body.agent_type == "q_table":
                a_idx = agent.act(state, explore=explore_)
            elif body.agent_type == "greedy":
                a_idx = playbook[pb_step] if pb_step < len(playbook) else 14
                pb_step += 1
            else:
                a_idx = random.randrange(N_ACT)

            a_name, a_params = _ACTION_CATALOGUE[a_idx]
            result2 = env_ep.step(a_name, deepcopy(a_params))
            r = result2["reward"]; done = result2["done"]
            obs2 = result2["observation"]
            state2 = enc.transform(obs2)

            if body.agent_type == "q_table":
                ep_l += agent.update(state, a_idx, r, state2, done)

            ep_r += r; state = state2; step += 1

        if body.agent_type == "q_table":
            agent.decay()

        sess = env_ep.last_session() or {}
        return ep_r, sess.get("completed", False), ep_l / max(step, 1)

    t0 = time.time()
    for ep in range(1, body.episodes + 1):
        r, s, l = run_ep("training", ep, explore_=True)
        train_rewards.append(r); train_success.append(s); train_losses.append(l)
        if ep % max(1, body.episodes // 10) == 0:
            r_e, s_e, _ = run_ep("evaluation", ep + 10000, explore_=False)
            eval_rewards.append(r_e); eval_success.append(s_e)

    elapsed = time.time() - t0

    # Save agent
    if body.agent_type == "q_table":
        save_agent(agent, _MODEL_PATH)
        _agent = load_agent(_MODEL_PATH)

    n = len(train_rewards)
    tail = max(1, n // 5)
    final_sr = sum(float(s) for s in train_success[-tail:]) / tail
    initial_r = sum(train_rewards[:max(1, n // 10)]) / max(1, n // 10)
    final_r   = sum(train_rewards[-tail:]) / tail

    return {
        "status":          "ok",
        "agent_type":      body.agent_type,
        "episodes":        n,
        "elapsed_s":       round(elapsed, 2),
        "train_rewards":   [round(r, 4) for r in train_rewards],
        "train_success":   train_success,
        "train_losses":    [round(l, 4) for l in train_losses],
        "eval_rewards":    [round(r, 4) for r in eval_rewards],
        "eval_success":    eval_success,
        "final_success_rate": round(final_sr, 4),
        "reward_delta":    round(final_r - initial_r, 4),
        "q_table_states":  getattr(agent, "q_table_size_val", 0) if body.agent_type == "q_table" else 0,
        "update_count":    getattr(agent, "_update_count", 0) if body.agent_type == "q_table" else 0,
        "model_saved":     _MODEL_PATH if body.agent_type == "q_table" else None,
        "encoder_saved":   _ENCODER_PATH,
        "pipeline_fixes":  [
            "Feature mismatch fixed: ObservationEncoder used at training AND inference",
            "Scaler saved: models/encoder.json persists between sessions",
            "Model saved: models/q_agent.json loaded on each /predict call",
            "Input validated: enc.validate(obs) called before enc.transform(obs)",
        ],
    }


@app.get("/pipeline_status", tags=["inference"])
def pipeline_status():
    """Check whether encoder and model are saved and ready for /predict."""
    from pathlib import Path as _Path
    enc_ok   = _Path(_ENCODER_PATH).exists()
    model_ok = _Path(_MODEL_PATH).exists()
    summary  = agent_summary(_MODEL_PATH) if model_ok else {}
    return {
        "encoder_ready":  enc_ok,
        "model_ready":    model_ok,
        "model_path":     _MODEL_PATH,
        "encoder_path":   _ENCODER_PATH,
        "feature_names":  FEATURE_NAMES,
        "n_features":     N_FEATURES,
        "agent_summary":  summary,
        "predict_ready":  enc_ok and model_ok and summary.get("q_table_size", 0) > 0,
    }


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    log.info("Starting OpenEnv Workspace Assistant v2 on port %d", port)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
