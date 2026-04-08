---
title: SupportAgentEnv
emoji: 🎧
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# SupportAgentEnv — Meta PyTorch OpenEnv Hackathon

[![Hugging Face Space](https://img.shields.io/badge/🤗%20HF%20Space-Running-green)](https://huggingface.co/spaces/visshaalpvt/support-agent-env)
[![GitHub](https://img.shields.io/badge/GitHub-Public-blue)](https://github.com/mohan010105/Open_EV_hackathon.git)

OpenEnv Workspace Assistant is a reinforcement learning environment built for the Meta OpenEnv Hackathon.

It simulates a digital workspace where an AI agent learns to:

Read emails

Schedule meetings

Organize documents

The agent interacts through OpenEnv APIs (reset, step, state) and receives rewards based on performance.

🎯 Tasks
#	Difficulty	Task
1	Easy	Email Retrieval
2	Medium	Meeting Scheduling
3	Hard	Document Organization
📊 Scoring System
Action	Reward
Correct navigation	+0.20
Correct action	+0.30
Task completion	+1.00
Incorrect action	-0.10
Invalid navigation	-0.20
✔ Score is always between 0.0 and 1.0

⚙️ API Endpoints
Endpoint	Method
/reset	POST
/step	POST
/state	GET
🚀 Run Locally
pip install -r requirements.txt
uvicorn server:app --port 7860
🐳 Deployment
Docker-based Hugging Face Space

Runs on port 7860

🔗 Live Demo
https://huggingface.co/spaces/visshaalpvt/support-agent-env

👨‍💻 Author
Mohan Raj

⭐ Conclusion
A complete OpenEnv-compatible environment for training AI agents on real-world tasks.
