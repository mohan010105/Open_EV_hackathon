# 🚀 AI Workspace Assistant Environment (OpenEnv)

## 🧠 Overview

The **AI Workspace Assistant Environment** is a complete OpenEnv-compatible simulation platform designed to train and evaluate AI agents on real-world digital productivity tasks.

This project simulates a **digital workspace** where an AI agent interacts with tools such as:

* 📧 Email Inbox
* 📅 Calendar
* 📂 Document Management

The agent learns to perform multi-step tasks like:

* Finding emails
* Scheduling meetings
* Organizing documents

---

## 🎯 Problem Statement

Build a real-world OpenEnv environment that supports:

* Standard RL interface (`reset`, `step`, `state`)
* Task-based learning
* Automated grading system
* LLM-based agent interaction
* Real-time evaluation

---

## 🏗️ System Architecture

```
Frontend (Next.js Dashboard)
        ↓
FastAPI OpenEnv API
        ↓
Environment Simulation
        ↓
ML + LLM Agent (inference.py)
        ↓
Reward Engine + Graders
        ↓
Replay + Metrics + Leaderboard
```

---

## ⚙️ Core Features

### ✅ OpenEnv Environment

* Fully compliant with OpenEnv standards
* Supports:

  * `reset()`
  * `step(action)`
  * `state()`

---

### 🧩 Task System (3+ Tasks)

1. **Email Retrieval**

   * Find email from a specific sender

2. **Meeting Scheduling**

   * Extract details and create calendar events

3. **Document Organization**

   * Move files to correct folders

---

### 🧮 Reward System

| Action             | Reward |
| ------------------ | ------ |
| Correct navigation | +0.2   |
| Correct action     | +0.3   |
| Task completion    | +1.0   |
| Wrong action       | -0.1   |

✔ Normalized between 0.0 – 1.0

---

### 📊 Graders

Each task includes automated grading:

* ✅ Success → 1.0
* ⚠ Partial → 0.5
* ❌ Failure → 0.0

---

### 🤖 LLM Agent (inference.py)

* Uses OpenAI-compatible API
* Generates actions dynamically
* Interacts with environment step-by-step

---

### 🔁 Episode Replay System

* Tracks all agent actions
* Displays:

  * Step number
  * Action
  * Reward

---

### 📈 Metrics & Leaderboard

Tracks:

* Success rate
* Average reward
* Episode performance

Leaderboard compares agent performance.

---

### 🎮 Interactive Dashboard (Frontend)

Built with Next.js + Tailwind:

* Real-time environment state
* Manual action execution
* Demo mode
* Replay visualization
* Metrics & leaderboard

---

### ⚡ Demo Mode

One-click AI execution:

* Runs full episode automatically
* Displays actions + rewards

---

## 🔗 API Endpoints

| Endpoint          | Method | Description       |
| ----------------- | ------ | ----------------- |
| `/reset`          | POST   | Start new episode |
| `/step`           | POST   | Execute action    |
| `/state`          | GET    | Current state     |
| `/episode_replay` | GET    | Replay actions    |
| `/metrics`        | GET    | Performance stats |
| `/leaderboard`    | GET    | Agent ranking     |

---

## 🧠 ML Pipeline

* Pre-trained model
* Feature preprocessing (scaling + encoding)
* Consistent inference pipeline
* Real-time prediction support

✔ Ensures training and inference consistency

---

## 🐳 Docker Support

Fully containerized:

```bash
docker build -t openenv-env .
docker run -p 7860:7860 openenv-env
```

---

## ☁️ Deployment

### 🔹 Hugging Face Spaces

* Backend API deployed
* `/reset` endpoint validated

### 🔹 Vercel

* Frontend dashboard deployed
* Connected via API

---

## 🚀 How to Run Locally

### 1️⃣ Backend

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

---

### 2️⃣ Frontend

```bash
npm install
npm run dev
```

Set environment variable:

```bash
NEXT_PUBLIC_API_URL=https://open-ev-hackathon-api-server-ifc38anpb-mohan010105s-projects.vercel.app/
```

---

### 3️⃣ Run Agent

```bash
python inference.py
```

---

## ⚙️ Configuration

Environment variables:

* `API_BASE_URL`
* `MODEL_NAME`
* `HF_TOKEN`

---

## 🧪 Validation Checklist

✔ OpenEnv API working
✔ Docker build successful
✔ HuggingFace deployment live
✔ inference.py runs without error
✔ 3+ tasks implemented
✔ rewards normalized
✔ runtime < 20 min

---

## 🏆 Key Highlights

* Real-world AI environment simulation
* LLM-driven agent interaction
* Interactive dashboard
* Replay + metrics + leaderboard
* Fully deployable system

---

## 🔮 Future Improvements

* Multi-agent collaboration
* Advanced RL training
* More complex workspace scenarios

---

## 👨‍💻 Author

Mohan Raj S
Mohan ram B

---

## ⭐ Conclusion

This project demonstrates how AI agents can be trained in structured environments to perform real-world tasks using OpenEnv standards.

It combines:

✔ Reinforcement Learning
✔ LLM-based reasoning
✔ System design
✔ Real-time visualization

---

🔥 **A complete AI training platform — not just a prototype.**
