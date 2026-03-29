---
title: AI Workspace Assistant Environment
emoji: 🗂️
colorFrom: blue
colorTo: violet
sdk: docker
pinned: false
---

# AI Workspace Assistant Environment

> An OpenEnv-compatible reinforcement learning environment where an LLM agent
> learns to be productive — reading emails, scheduling meetings, and organising
> documents — all in a fully simulated digital workspace.

---

## 1. System Overview

This project is a **training and evaluation environment for AI agents** built on
the OpenEnv standard interface. It simulates a realistic digital office workspace
containing an email inbox, a calendar, and a document filing system. An AI agent
interacts with this workspace through a sequence of discrete actions and receives
rewards based on how well it completes productivity tasks.

Unlike toy environments, the workspace is **task-driven**: the agent is given a
concrete goal (e.g. "find Alex's email and schedule the meeting"), must navigate
between different apps to gather context, and is evaluated by an automated grader
that scores partial progress as well as full completion.

The environment is compatible with any LLM or RL policy via a clean REST API, and
ships with a built-in inference script, an episode replay system, and a live
visualization dashboard — making it suitable for rapid research iteration,
hackathon demos, and HuggingFace Spaces deployment.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM / RL Agent                           │
│          (GPT-4o, Mistral, or any OpenAI-compatible model)      │
└──────────────────────────────┬──────────────────────────────────┘
                               │  reads env variables:
                               │  API_BASE_URL  MODEL_NAME  HF_TOKEN
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       inference.py                              │
│                      (episode loop)                             │
│                                                                 │
│   1. POST /reset  →  receive observation                        │
│   2. build prompt from observation                              │
│   3. call LLM  →  parse action JSON                             │
│   4. POST /step   →  receive reward + next observation          │
│   5. repeat until done=True or max_steps reached                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTP (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               FastAPI OpenEnv Server  (server.py)               │
│                                                                 │
│   POST /reset          POST /step          GET /state           │
│   GET  /episode_replay GET /episodes       GET /healthz         │
│   GET  /tasks          GET /sessions       GET /  (dashboard)   │
└─────┬─────────────────────────────────┬───────────────────────┬─┘
      │                                 │                       │
      ▼                                 ▼                       ▼
┌────────────────┐   ┌──────────────────────────────┐   ┌──────────────────┐
│  Workspace     │   │      Reward Engine            │   │  Replay Logger   │
│  Environment   │   │   (utils/reward_engine.py)    │   │  (replay/        │
│  Simulation    │   │                               │   │   replay_logger) │
│                │   │  correct_navigation  +0.20    │   │                  │
│  • Email inbox │   │  correct_action      +0.30    │   │  records every   │
│  • Calendar    │   │  task_completion     +1.00    │   │  step: action,   │
│  • Documents   │   │  incorrect_action   -0.10    │   │  reward, obs,    │
│  • Task mgr    │   │  invalid_navigation -0.20    │   │  timestamp       │
└────────┬───────┘   └──────────────────────────────┘   └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Tasks + Automated Graders                     │
│                       (env/graders.py)                          │
│                                                                 │
│   ws_task_1  Email Retrieval          → grade 0.0 – 1.0        │
│   ws_task_2  Meeting Scheduling       → grade 0.0 – 1.0        │
│   ws_task_3  Document Organization    → grade 0.0 – 1.0        │
│                                                                 │
│   Partial credit awarded for each completed criterion           │
└──────────────────────────────┬──────────────────────────────────┘
                               │  episode data
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Visualization Dashboard  (GET /)                   │
│                   dashboard/dashboard.html                      │
│                                                                 │
│   • Live environment state (email, calendar, documents)         │
│   • Agent action timeline                                       │
│   • Cumulative reward progression graph  (Chart.js)            │
│   • Task completion progress bar                                │
│   • Reset + task selector controls                              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | File | Responsibility |
|-----------|------|----------------|
| **WorkspaceEnvironment** | `env/environment.py` | Manages episode lifecycle, state mutation, session history |
| **Action Dispatch** | `env/actions.py` | Routes action names to handlers; enforces per-app action permissions |
| **State** | `env/state.py` | Seed data (emails, calendar, documents) and per-app action lists |
| **Task Definitions** | `env/tasks.py` | Goals, targets, difficulty ratings, max step limits |
| **Graders** | `env/graders.py` | Automated scoring with criteria breakdown and partial credit |
| **Reward Engine** | `utils/reward_engine.py` | Centralised reward table with shortcuts; clamps total to [0, 1] |
| **Replay Logger** | `replay/replay_logger.py` | Immutable step log per episode; exposed via `GET /episode_replay` |
| **FastAPI Server** | `server.py` | REST API surface; wires env + replay + static dashboard together |
| **Inference Script** | `inference.py` | OpenAI-compatible episode loop; reads env vars; structured logging |
| **Dashboard** | `dashboard/` | Dark-mode HTML/JS monitoring UI; polls server every 2 seconds |

---

## 3. Agent Interaction Flow

The environment follows the standard RL loop. Below is the precise sequence for
every episode:

```
Agent                            Server (FastAPI)               Environment
  │                                    │                              │
  │── POST /reset ──────────────────►  │── env.reset(task_id) ──────► │
  │◄─ {observation, task_description} ─│◄─ initial state ─────────── │
  │                                    │                              │
  │  ┌─ episode loop ──────────────────────────────────────────────┐  │
  │  │                                 │                           │  │
  │  │  1. read observation            │                           │  │
  │  │  2. build LLM prompt            │                           │  │
  │  │  3. call LLM → parse JSON       │                           │  │
  │  │  4. POST /step {action, params} │                           │  │
  │  │     ────────────────────────── ►│── env.step(action) ──────►│  │
  │  │     ◄─ {observation,           ─│◄─ {reward, done, info} ──-│  │
  │  │           reward, done, info}   │                           │  │
  │  │  5. log reward                  │                           │  │
  │  │  6. if done → break             │                           │  │
  │  └─────────────────────────────────────────────────────────────┘  │
  │                                    │                              │
  │── GET /episode_replay ──────────►  │── replay.current_episode()   │
  │◄─ full step log ─────────────────  │                              │
```

Key rules enforced by the environment:

- **App context** — each app exposes only a subset of actions; attempting an
  action outside that set returns an `invalid_navigation` penalty (`-0.20`).
- **Progress is stateful** — reading an email marks it as read; moving a document
  updates its folder permanently within the episode.
- **Grader runs every step** — the episode ends automatically when `passed=True`
  or `max_steps` is reached.
- **Total reward is clamped** — the running total never exceeds `1.0` or drops
  below `0.0`.

---

## 4. Example Episode

**Goal:** Schedule the team meeting from Alex Johnson's email.
**Task:** `ws_task_2` — Meeting Scheduling (medium difficulty, max 10 steps)

```
POST /reset  {"task_id": "ws_task_2"}
→ observation: current_app="task_manager", task="Schedule the meeting from Alex's email"
```

| Step | Action | Params | Reward | Running Total | Reason |
|------|--------|--------|--------|---------------|--------|
| 1 | `open_email_inbox` | — | +0.20 | 0.20 | Correct navigation to inbox |
| 2 | `search_email` | `sender: "Alex"` | +0.30 | 0.50 | Target sender matched |
| 3 | `read_email` | `email_id: "email_001"` | +0.30 | 0.80 | Target email opened |
| 4 | `extract_meeting_details` | — | +0.30 | 1.00 | Meeting details extracted |
| 5 | `create_calendar_event` | — | +1.00 | 1.00 | Event created — task complete |

```
done=True
grader_score=1.0
feedback="Meeting scheduled correctly"
```

Grader criteria breakdown:

```json
[
  { "name": "read_target_email",     "passed": true,  "weight": 0.30 },
  { "name": "created_correct_event", "passed": true,  "weight": 0.70 }
]
```

**Partial credit example** — if the agent creates the event without reading the
email first, the grader still awards `0.70` (event criterion passes, email
criterion fails), so the agent receives meaningful signal even from incomplete runs.

---

## 5. Key Features

**OpenEnv-compliant RL interface**
Standard `reset()` / `step()` / `state()` API with structured JSON observations,
discrete named action space, and per-step reward signals.

**Realistic workspace simulation**
Five apps (email inbox, email detail, calendar, document folders, task manager),
each with its own permitted action list. State mutations persist across the episode —
reading an email marks it read; moving a document changes its folder.

**Three graded tasks with partial credit**
Easy → medium → hard progression. Every grader awards partial scores for
individual criteria, giving the agent a dense reward signal rather than
sparse end-of-episode feedback only.

**Centralised reward engine**
`utils/reward_engine.py` encodes the full reward table and exposes shortcuts
(`.nav()`, `.correct()`, `.complete()`, `.wrong()`, `.invalid()`). All rewards
are clamped to `[0.0, 1.0]`.

**LLM-driven inference loop**
`inference.py` works with any OpenAI-compatible endpoint. Configure via three
environment variables (`API_BASE_URL`, `MODEL_NAME`, `HF_TOKEN`) and run a
full episode with a single command.

**Step-by-step episode replay**
`replay/replay_logger.py` records every step — action, params, reward,
observation snapshot, timestamp — and exposes it via `GET /episode_replay`.
Completed episodes accumulate at `GET /episodes`.

**Live visualization dashboard**
Dark-mode HTML/JS dashboard served at `GET /` polls the server every two
seconds. Shows email inbox, open email, calendar, documents, available actions,
a Chart.js reward progression graph, and the full action timeline.

**Production-ready deployment**
Dockerized with a non-root user, HuggingFace Spaces-compatible on port 7860,
health check at `GET /healthz`, and interactive API docs at `/docs`.

---

## 6. Demo Instructions

### Prerequisites

```bash
git clone <this-repo>
cd openenv-workspace-env
pip install -r requirements.txt
```

### Step 1 — Start the API server

```bash
uvicorn server:app --host 0.0.0.0 --port 7860 --reload
```

The server is ready when you see:

```
INFO:     Application startup complete.
```

### Step 2 — Open the dashboard

Visit `http://localhost:7860` in your browser.

You will see the live monitoring dashboard. The environment starts idle — the
inbox, calendar, and documents panels will populate as soon as an episode begins.

### Step 3 — Run the LLM inference agent

In a second terminal:

```bash
export HF_TOKEN=hf_your_token_here          # HuggingFace or OpenAI key
export MODEL_NAME=gpt-4o-mini               # any OpenAI-compatible model
export API_BASE_URL=http://localhost:7860
export TASK_ID=ws_task_2                    # omit for a random task

python inference.py
```

### Step 4 — Watch the agent work

Switch back to the dashboard. You will see in real time:

- The **current app** the agent is navigating
- The **action timeline** updating with each step and its reward
- The **reward graph** rising as the agent makes correct decisions
- The **progress bar** filling toward task completion
- The **open email**, **calendar events**, and **documents** reacting to agent actions

### Step 5 — Inspect the episode replay

```bash
curl http://localhost:7860/episode_replay | python -m json.tool
```

Returns the full step log — useful for evaluating agent reasoning and debugging.

### Step 6 — Try all three tasks

```bash
# Easy   — find and read Alex's email
export TASK_ID=ws_task_1 && python inference.py

# Medium — schedule the meeting from the email
export TASK_ID=ws_task_2 && python inference.py

# Hard   — move the document to the correct folder
export TASK_ID=ws_task_3 && python inference.py
```

### Docker (one command)

```bash
docker build -t openenv-workspace . && \
docker run -p 7860:7860 \
  -e HF_TOKEN=hf_... \
  -e MODEL_NAME=gpt-4o-mini \
  openenv-workspace
```

---

## Environment Design Reference

### Observation Space

```json
{
  "current_app":       "email_inbox | email_detail | calendar | documents | task_manager",
  "email_list":        [ { "id", "sender", "subject", "read", "has_meeting_details" } ],
  "selected_email":    null,
  "calendar_events":   [ { "id", "title", "date", "time", "attendees" } ],
  "documents":         [ { "id", "name", "folder", "type" } ],
  "current_task":      "string — the active task goal",
  "available_actions": [ "list of valid action names for this app" ],
  "task_id":           "ws_task_1 | ws_task_2 | ws_task_3",
  "step_count":        0,
  "total_reward":      0.0
}
```

### Action Space

| Action | Params | Description |
|--------|--------|-------------|
| `open_email_inbox` | — | Navigate to the email inbox |
| `search_email` | `sender: str` | Filter inbox by sender name |
| `read_email` | `email_id: str` | Open and mark an email as read |
| `extract_meeting_details` | — | Parse meeting info from the open email |
| `create_calendar_event` | — | Schedule a meeting from the open email |
| `view_calendar` | — | Switch to the calendar view |
| `view_documents` | — | Switch to the documents view |
| `move_document` | `document_id: str`, `folder: str` | Move a document to a folder |
| `noop` | — | Do nothing |

### Reward Table

| Event | Reward |
|-------|--------|
| Correct navigation | `+0.20` |
| Correct action | `+0.30` |
| Task completion | `+1.00` |
| Incorrect action | `−0.10` |
| Invalid navigation | `−0.20` |

Total reward clamped to `[0.0, 1.0]`.

### Tasks

| ID | Name | Difficulty | Goal | Max Steps |
|----|------|-----------|------|-----------|
| `ws_task_1` | Email Retrieval | Easy | Find and read Alex Johnson's email | 6 |
| `ws_task_2` | Meeting Scheduling | Medium | Schedule the meeting from Alex's email | 10 |
| `ws_task_3` | Document Organization | Hard | Move `project_proposal.pdf` → `Projects/` | 8 |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Live HTML monitoring dashboard |
| `POST` | `/reset` | Start a new episode (optional `task_id`) |
| `POST` | `/step` | Execute one action (`action` + `params`) |
| `GET` | `/state` | Inspect current state without stepping |
| `GET` | `/episode_replay` | Current episode step log |
| `GET` | `/episodes` | All completed episode logs |
| `GET` | `/tasks` | List available tasks |
| `GET` | `/sessions` | Session history |
| `GET` | `/healthz` | Liveness probe → `{"status": "ok"}` |
| `GET` | `/docs` | Interactive OpenAPI documentation |

---

## HuggingFace Spaces Deployment

1. Create a new Space and choose the **Docker** SDK.
2. Push this repository to the Space.
3. Set Space secrets: `HF_TOKEN`, `MODEL_NAME`, `API_BASE_URL`.
4. The Dockerfile exposes port `7860` and starts the server automatically.
5. The OpenEnv validator pings `POST /reset` — returns HTTP 200 on success.

---

## Project Structure

```
openenv-workspace-env/
├── openenv.yaml              ← environment manifest (v2.0.0)
├── Dockerfile                ← HuggingFace Spaces-compatible build
├── requirements.txt
├── server.py                 ← FastAPI server
├── inference.py              ← LLM episode loop
├── README.md
│
├── env/
│   ├── environment.py        ← WorkspaceEnvironment (reset/step/state)
│   ├── actions.py            ← 9 action handlers + reward dispatch
│   ├── state.py              ← seed data + per-app action permissions
│   ├── tasks.py              ← task definitions
│   └── graders.py            ← automated graders (0.0 – 1.0)
│
├── replay/
│   └── replay_logger.py      ← step-by-step episode recorder
│
├── dashboard/
│   ├── dashboard.html        ← live monitoring UI
│   └── dashboard.js          ← Chart.js + polling logic
│
└── utils/
    ├── reward_engine.py      ← centralised reward table
    └── helpers.py            ← safe_json, truncate, clamp, normalize_action
```

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Python | 3.10+ | 3.11 |
| Episode runtime | — | < 5 min |
| Max supported | — | 2 vCPU / 8 GB |
