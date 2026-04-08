---

title: OpenEnv Workspace Assistant
emoji: 🗂️
colorFrom: blue
colorTo: violet
sdk: docker
app_port: 7860
pinned: false
-------------

# OpenEnv Workspace Assistant — Meta OpenEnv Hackathon

[![Hugging Face Space](https://img.shields.io/badge/🤗%20HF%20Space-Running-green)](https://huggingface.co/spaces/visshaalpvt/support-agent-env)
[![GitHub](https://img.shields.io/badge/GitHub-Public-blue)](https://github.com/mohan010105/Open_EV_hackathon)


---

## 🧠 Overview

**OpenEnv Workspace Assistant** is a real-world reinforcement learning environment built for the Meta OpenEnv Hackathon.

It simulates a **digital productivity workspace** where an AI agent learns to:

* 📧 Read and search emails
* 📅 Schedule meetings
* 📂 Organize documents

The agent interacts using a standard OpenEnv API (`reset`, `step`, `state`) and receives rewards based on task completion.

---

## 🎯 Tasks

| # | Difficulty | Task                  | Description                           |
| - | ---------- | --------------------- | ------------------------------------- |
| 1 | Easy       | Email Retrieval       | Find and read Alex's email            |
| 2 | Medium     | Meeting Scheduling    | Extract meeting info and create event |
| 3 | Hard       | Document Organization | Move document to correct folder       |

---

## 📊 Scoring System

All tasks use **partial-credit grading** with normalized scores:

| Action             | Reward |
| ------------------ | ------ |
| Correct navigation | +0.20  |
| Correct action     | +0.30  |
| Task completion    | +1.00  |
| Incorrect action   | -0.10  |
| Invalid navigation | -0.20  |

✔ Final score always in **[0.0 – 1.0]**

---

## ⚙️ OpenEnv API

| Endpoint          | Method | Description       |
| ----------------- | ------ | ----------------- |
| `/reset`          | POST   | Start new episode |
| `/step`           | POST   | Execute action    |
| `/state`          | GET    | Current state     |
| `/episode_replay` | GET    | Replay actions    |
| `/metrics`        | GET    | Performance stats |
| `/leaderboard`    | GET    | Agent ranking     |

---

## 🔄 Agent Interaction Flow

1. `POST /reset` → get initial observation
2. Agent decides action
3. `POST /step` → receive reward + next state
4. Repeat until `done=True`

---

## 🧩 Key Features

* ✅ OpenEnv-compliant environment
* ✅ Real-world workspace simulation
* ✅ Multi-step task system
* ✅ Automated graders with partial scoring
* ✅ Replay logging system
* ✅ Metrics + leaderboard tracking
* ✅ LLM-compatible inference pipeline
* ✅ Live dashboard visualization

---

## 🤖 Inference (Agent Execution)

Run the agent:

```bash
python inference.py
```

Environment variables:

```bash
API_BASE_URL=https://mohanit007-open-ev-environment.hf.space
MODEL_NAME=gpt-4o-mini
HF_TOKEN=your_token
```

---

## 🐳 Deployment (Hugging Face Spaces)

This project is deployed using **Docker**.

### Required files:

* Dockerfile
* requirements.txt
* server.py
* openenv.yaml
* inference.py

The app runs on:

```
http://0.0.0.0:7860
```

---

## 📁 Project Structure

```
openenv-workspace-env/
├── server.py
├── inference.py
├── openenv.yaml
├── Dockerfile
├── requirements.txt
│
├── env/
├── utils/
├── replay/
├── dashboard/
```

---

## 🧪 Validation Checklist

✔ `/reset` returns valid JSON
✔ `/step` executes correctly
✔ Rewards between 0.0–1.0
✔ 3+ tasks implemented
✔ inference.py runs without error
✔ Docker builds successfully
✔ Space returns HTTP 200

---

## 🚀 Live Demo

👉 https://mohanit007-open-ev-environment.hf.space

---

## 🏆 Highlights

* Real-world AI training environment
* Fully API-driven OpenEnv system
* LLM + RL compatible
* Interactive dashboard
* Production-ready deployment

---

## 👨‍💻 Author

Mohan Raj

---

## ⭐ Conclusion

This project demonstrates how AI agents can operate in structured environments to complete real-world tasks using reinforcement learning and LLM reasoning.

🔥 **A complete OpenEnv training platform — not just a demo.**
