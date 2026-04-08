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

Overview
SupportAgentEnv is a reinforcement learning evaluation environment for the Meta PyTorch OpenEnv Hackathon. It tests an LLM agent's ability to act as an automated customer support agent across three progressively harder tasks.

The agent receives a customer support ticket and must:

Easy — Classify the ticket category
Medium — Classify category + detect priority level
Hard — Classify category + priority + write an empathetic response
All scoring is partial-credit and deterministic, with scores strictly in (0.0, 1.0).

Tasks
#	Difficulty	Task	Grader
1	Easy	Category classification	grade_easy — exact/semantic match
2	Medium	Category + priority detection	grade_medium — rank-distance partial credit
3	Hard	Full response generation	grade_hard — 5-component partial credit
Scoring
Easy: Exact match → 0.95 · Same group → 0.45 · Wrong → 0.15
Medium: Category (max 0.50) + Priority rank-distance (max 0.45) → total in [0.10, 0.95]
Hard: Base(0.10) + Category(max 0.25) + Priority(max 0.25) + Empathy(max 0.20) + Action(max 0.20) → total in [0.10, 0.90]
All scores are clamped to (0.05, 0.95) — never exactly 0 or 1.

Repository Structure
support-agent-env/
├── inference.py        ← Main inference script (project root)
├── api.py              ← FastAPI server (reset/step/state endpoints)
├── support_env.py      ← Core environment class (reset/step)
├── graders.py          ← Deterministic graders for all 3 tasks
├── schema.py           ← Pydantic models (observation, action, reward)
├── tickets.json        ← Static ticket dataset with ground truth labels
├── openenv.yaml        ← OpenEnv task configuration
├── requirements.txt    ← Python dependencies
├── Dockerfile          ← Container for Hugging Face Space
├── templates/          ← Dashboard HTML UI
└── verify_inference.py ← Pre-submission compliance checker
Setup
Local Development
# Clone the repo
git clone https://github.com/visshaalpvt/support-agent-env.git
cd support-agent-env

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn api:app --host 0.0.0.0 --port 7860 --reload
Running inference.py
export API_KEY=<your-litellm-proxy-key>
export HF_TOKEN=<your-hf-token>
export API_BASE_URL=https://api.openai.com/v1   # optional
export MODEL_NAME=gpt-4o-mini                   # optional
export SPACE_URL=https://visshaalpvt-support-agent-env.hf.space  # optional

python inference.py
Expected Output Format
[START] task=support-easy env=SupportAgentEnv model=gpt-4o-mini
[STEP] step=1 action=billing reward=0.95 done=true error=null
[END] success=true reward=0.95

[START] task=support-medium env=SupportAgentEnv model=gpt-4o-mini
[STEP] step=1 action=billing|high reward=0.75 done=true error=null
[END] success=true reward=0.75

[START] task=support-hard env=SupportAgentEnv model=gpt-4o-mini
[STEP] step=1 action=billing|high|response reward=0.70 done=true error=null
[END] success=true reward=0.70
Environment API
Endpoint	Method	Body	Description
/reset	POST	{"task_difficulty": "easy"}	Start new episode
/step	POST	{"classification": "billing", "priority": "high", "response": "..."}	Submit action
/state	GET	—	Current env state
/health	GET	—	Health check
/	GET	—	Dashboard UI
/docs	GET	—	Swagger API docs
Action Space
{
  "classification": "billing",       // required: delivery|billing|technical|account|general
  "priority": "high",                // required for medium/hard: low|medium|high|urgent
  "response": "We apologize..."      // required for hard: empathetic text response
}
Observation Space
{
  "ticket_id": "T001",
  "ticket_text": "My order hasn't arrived after 2 weeks...",
  "task_level": "easy",
  "step_number": 0,
  "done": false,
  "history": []
}
Pre-Submission Verification
python verify_inference.py
Checks all 15 Phase 2 compliance requirements.

Deployment
The environment is deployed as a Docker-based Hugging Face Space:

Space URL: https://huggingface.co/spaces/visshaalpvt/support-agent-env
Hardware: CPU Basic (2 vCPU / 16 GB RAM)
Port: 7860
Required Space Secrets
Secret	Description
HF_TOKEN	Your Hugging Face token
API_KEY	LiteLLM proxy key (injected by evaluator)
API_BASE_URL	Optional — proxy URL override
MODEL_NAME	Optional — model override

License
MIT — see LICENSE for details.

👨‍💻 Author
Mohan Raj

⭐ Conclusion
A complete OpenEnv-compatible environment for training AI agents on real-world tasks.
