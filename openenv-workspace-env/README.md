# AI Workspace Assistant Environment

An **OpenEnv-compatible** reinforcement learning environment that simulates a digital productivity workspace. An AI agent learns to perform office tasks by interacting with:

- **Email inbox** — search and read emails
- **Calendar** — schedule meetings from email context
- **Document folders** — organise files into the correct folder

---

## Environment Design

### Observation Space

```json
{
  "current_app":       "email_inbox | email_detail | calendar | documents | task_manager",
  "email_list":        [ { "id", "sender", "subject", "read", "has_meeting_details" } ],
  "selected_email":    null | { ... full email object ... },
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
| `create_calendar_event` | — | Schedule a meeting from the open email |
| `view_calendar` | — | Switch to the calendar view |
| `view_documents` | — | Switch to the documents view |
| `move_document` | `document_id: str`, `folder: str` | Move a document to a folder |
| `noop` | — | Do nothing |

### Reward Structure

| Event | Reward |
|-------|--------|
| Correct action (generic) | `+0.3` |
| Task completion | `+1.0` |
| Wrong action | `−0.1` |
| Invalid navigation | `−0.2` |

Total reward is clamped to `[0.0, 1.0]`.

### Tasks

| # | Name | Difficulty | Goal |
|---|------|-----------|------|
| `ws_task_1` | Email Retrieval | Easy | Find and read Alex Johnson's email |
| `ws_task_2` | Meeting Scheduling | Medium | Schedule the meeting from Alex's email |
| `ws_task_3` | Document Organization | Hard | Move `project_proposal.pdf` → `Projects/` |

### Graders

Each task includes an automated grader returning:

```json
{ "score": 0.0–1.0, "passed": true|false, "feedback": "...", "criteria": [...] }
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/reset` | Reset environment; optionally pass `task_id` |
| `POST` | `/step` | Execute an action; pass `action` + `params` |
| `GET` | `/state` | Inspect current state (no step taken) |
| `GET` | `/tasks` | List available tasks |
| `GET` | `/sessions` | Session history |
| `GET` | `/healthz` | Health check |

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the server

```bash
uvicorn server:app --host 0.0.0.0 --port 7860 --reload
```

Open the interactive docs at `http://localhost:7860/docs`.

### 3. Run a manual episode (curl)

```bash
# Reset with a specific task
curl -X POST http://localhost:7860/reset \
     -H "Content-Type: application/json" \
     -d '{"task_id": "ws_task_1"}'

# Open inbox
curl -X POST http://localhost:7860/step \
     -H "Content-Type: application/json" \
     -d '{"action": "open_email_inbox"}'

# Search for Alex
curl -X POST http://localhost:7860/step \
     -H "Content-Type: application/json" \
     -d '{"action": "search_email", "params": {"sender": "Alex"}}'

# Read the email
curl -X POST http://localhost:7860/step \
     -H "Content-Type: application/json" \
     -d '{"action": "read_email", "params": {"email_id": "email_001"}}'

# Check state
curl http://localhost:7860/state
```

### 4. Run LLM inference

```bash
export HF_TOKEN=hf_your_token_here
export MODEL_NAME=gpt-4o-mini
export API_BASE_URL=http://localhost:7860
export TASK_ID=ws_task_1     # omit for random task

python inference.py
```

The inference script loops through the episode, feeds observations to the LLM, and logs each step with reward details.

---

## Docker

```bash
# Build
docker build -t openenv-workspace .

# Run
docker run -p 7860:7860 openenv-workspace

# Run inference against the container
API_BASE_URL=http://localhost:7860 \
HF_TOKEN=hf_... \
python inference.py
```

---

## HuggingFace Spaces Deployment

1. Create a new Space → choose **Docker** SDK.
2. Push this repository to the Space.
3. Set the following Space secrets:
   - `HF_TOKEN` — your HuggingFace access token
   - `MODEL_NAME` — e.g. `mistralai/Mistral-7B-Instruct-v0.3`
   - `API_BASE_URL` — the Space URL (auto-available as `SPACE_HOST`)
4. The Dockerfile exposes port `7860` and launches the FastAPI server automatically.
5. Validation pings: `GET /healthz` → `{"status": "ok"}`.

```yaml
# Example Space metadata (README.md front matter)
---
title: AI Workspace Assistant Environment
emoji: 🗂️
colorFrom: blue
colorTo: violet
sdk: docker
pinned: false
---
```

---

## Project Structure

```
openenv-workspace-env/
├── openenv.yaml        ← environment manifest
├── Dockerfile          ← HuggingFace Spaces / Docker deploy
├── requirements.txt
├── server.py           ← FastAPI server (POST /reset, POST /step, GET /state)
├── inference.py        ← LLM episode loop (OpenAI client)
├── README.md
└── env/
    ├── __init__.py
    ├── environment.py  ← WorkspaceEnvironment class (reset/step/state)
    ├── actions.py      ← action dispatch and reward logic
    ├── state.py        ← seed data and APP_ACTIONS map
    ├── tasks.py        ← task definitions
    └── graders.py      ← automated graders (0.0 – 1.0)
```

---

## System Requirements

| Resource | Minimum |
|----------|---------|
| CPU | 1 vCPU |
| RAM | 512 MB |
| Python | 3.10+ |
| Runtime | < 20 min per episode |
