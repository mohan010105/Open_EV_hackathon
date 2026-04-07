"""
inference.py — Runs an AI agent against the OpenEnv Web Navigation Environment.

Reads environment variables:
  API_BASE_URL  - Base URL of the OpenEnv server (e.g. http://localhost:8080)
  MODEL_NAME    - Model name to use (e.g. gpt-4o-mini, meta-llama/Llama-3-8B-Instruct)
  HF_TOKEN      - HuggingFace token (used as API key when MODEL_NAME is an HF model)

The agent:
  1. Resets the environment (selecting a random task)
  2. Queries the model with the current observation
  3. Parses the model's chosen action
  4. Executes step(action)
  5. Repeats until done or max steps reached
"""

import os
import json
import time
import sys
from typing import Optional
from openai import OpenAI

# ── Configuration ──────────────────────────────────────────────────────────

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
HF_TOKEN = os.getenv("HF_TOKEN", "")
MAX_STEPS = int(os.getenv("MAX_STEPS", "15"))
TASK_ID = os.getenv("TASK_ID", None)  # Optional specific task

# ── HTTP helpers ────────────────────────────────────────────────────────────

import urllib.request
import urllib.error


def api_post(path: str, body: dict) -> dict:
    """Send a POST request to the environment API."""
    url = f"{API_BASE_URL}/api{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[ERROR] HTTP {e.code} on POST {path}: {e.read().decode()}")
        raise


def api_get(path: str) -> dict:
    """Send a GET request to the environment API."""
    url = f"{API_BASE_URL}/api{path}"
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[ERROR] HTTP {e.code} on GET {path}: {e.read().decode()}")
        raise


# ── Prompt building ──────────────────────────────────────────────────────────


SYSTEM_PROMPT = """You are an AI agent navigating a simulated e-commerce website to complete tasks.

You will receive an observation describing your current position in the website and the task you must complete.
You must choose the next action to take.

Available actions and their formats:
1. open_home() - Navigate to the homepage
2. search_product(product_name="<query>") - Search for a product
3. click_product(product_id="<id>") - Click on a product from search results
4. add_to_cart() - Add the currently viewed product to cart
5. noop() - Do nothing this step

IMPORTANT: You must respond with EXACTLY one action in the format shown above, and nothing else.
Do not add explanation, just output the action call.

Examples:
  open_home()
  search_product(product_name="laptop")
  click_product(product_id="prod_laptop_001")
  add_to_cart()
"""


def build_user_message(obs: dict) -> str:
    """Build the user message from the current observation."""
    page = obs.get("page", "unknown")
    task_desc = obs.get("task_description", "")
    task_id = obs.get("task_id", "")
    step = obs.get("step_count", 0)
    total_reward = obs.get("total_reward", 0.0)
    available_actions = obs.get("available_actions", [])
    search_results = obs.get("search_results", [])
    current_product = obs.get("current_product")
    cart_items = obs.get("cart_items", [])

    msg = f"""CURRENT STATE:
- Page: {page}
- Task (ID: {task_id}): {task_desc}
- Step: {step}
- Total Reward: {total_reward:.2f}
- Available Actions: {', '.join(available_actions)}
"""

    if search_results:
        msg += "\nSEARCH RESULTS:\n"
        for p in search_results:
            msg += f"  - ID: {p['id']} | {p['name']} | ${p['price']} | Rating: {p.get('rating', 'N/A')}\n"

    if current_product:
        msg += f"\nCURRENT PRODUCT:\n  {current_product['name']} (ID: {current_product['id']}) - ${current_product['price']}\n"

    if cart_items:
        msg += "\nCART:\n"
        for item in cart_items:
            msg += f"  - {item['name']} (${item['price']})\n"

    msg += "\nWhat is your next action?"
    return msg


# ── Action parsing ────────────────────────────────────────────────────────────


def parse_action(response_text: str) -> tuple[str, dict]:
    """
    Parse the model's response into an (action, params) tuple.
    Supports formats like:
      open_home()
      search_product(product_name="laptop")
      click_product(product_id="prod_001")
      add_to_cart()
      noop()
    """
    text = response_text.strip().lower()

    if text.startswith("open_home"):
        return "open_home", {}
    elif text.startswith("add_to_cart"):
        return "add_to_cart", {}
    elif text.startswith("noop"):
        return "noop", {}
    elif text.startswith("search_product"):
        # Extract product_name="..." or product_name='...'
        import re
        match = re.search(r'product_name=["\']?([^"\')\n]+)["\']?', response_text, re.IGNORECASE)
        if match:
            return "search_product", {"product_name": match.group(1).strip()}
        return "noop", {}
    elif text.startswith("click_product"):
        import re
        match = re.search(r'product_id=["\']?([^"\')\n]+)["\']?', response_text, re.IGNORECASE)
        if match:
            return "click_product", {"product_id": match.group(1).strip()}
        return "noop", {}
    else:
        print(f"[WARN] Could not parse action from response: {response_text!r}")
        return "noop", {}


# ── Main inference loop ───────────────────────────────────────────────────────


def run_inference():
    start_time = time.time()
    print(f"[INFO] Starting inference with model={MODEL_NAME}, api={API_BASE_URL}")

    # Build OpenAI client
    # For HuggingFace models, set api_key=HF_TOKEN and base_url to HF endpoint
    if HF_TOKEN and MODEL_NAME.startswith(("meta-llama", "mistral", "Qwen", "google")):
        client = OpenAI(
            api_key=HF_TOKEN,
            base_url="https://api-inference.huggingface.co/v1",
        )
    else:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", HF_TOKEN or "sk-dummy"))

    # 1. Reset the environment
    print(f"[INFO] Resetting environment (task={TASK_ID or 'random'})")
    try:
        reset_body = {}
        if TASK_ID:
            reset_body["taskId"] = TASK_ID
        result = api_post("/env/reset", reset_body)
    except Exception as e:
        print(f"[ERROR] Failed to reset environment: {e}")
        sys.exit(1)

    obs = result["observation"]
    print(f"[INFO] Task: {obs['task_id']} — {obs['task_description']}")
    print(f"[INFO] Starting on page: {obs['page']}")
    print()

    total_reward = 0.0
    done = False
    step = 0

    # 2. Main loop
    while not done and step < MAX_STEPS:
        # Check runtime budget (20 minutes max)
        elapsed = time.time() - start_time
        if elapsed > 19 * 60:
            print("[WARN] Approaching 20-minute runtime limit, stopping.")
            break

        step += 1
        print(f"[STEP {step}] Page: {obs['page']} | Reward so far: {total_reward:.2f}")

        # Build prompt
        user_msg = build_user_message(obs)

        # Query the model
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=64,
                temperature=0.0,
            )
            action_text = response.choices[0].message.content or ""
        except Exception as e:
            print(f"[ERROR] Model query failed at step {step}: {e}")
            action_text = "noop()"

        print(f"[STEP {step}] Model chose: {action_text!r}")

        # Parse and execute action
        action, params = parse_action(action_text)
        print(f"[STEP {step}] Executing: {action}({params})")

        try:
            step_result = api_post("/env/step", {"action": action, "params": params})
        except Exception as e:
            print(f"[ERROR] Step execution failed: {e}")
            break

        obs = step_result["observation"]
        reward = step_result.get("reward", 0)
        done = step_result.get("done", False)
        info = step_result.get("info", {})
        total_reward = obs.get("total_reward", 0.0)

        print(f"[STEP {step}] Reward: {reward:+.2f} | Total: {total_reward:.2f} | {info.get('step_reward_reason', '')}")

        if done:
            grade = info.get("grade_result", {})
            print()
            print("=" * 60)
            print(f"EPISODE COMPLETE after {step} steps")
            print(f"Total reward: {total_reward:.2f}")
            print(f"Grader score: {grade.get('score', 0):.2f}")
            print(f"Task passed: {grade.get('passed', False)}")
            print(f"Feedback: {grade.get('feedback', '')}")
            print("=" * 60)
            break

    if not done:
        print()
        print(f"[INFO] Max steps ({step}) reached without completing the task.")
        print(f"[INFO] Final reward: {total_reward:.2f}")

    elapsed = time.time() - start_time
    print(f"\n[INFO] Total runtime: {elapsed:.1f}s")
    return total_reward


if __name__ == "__main__":
    score = run_inference()
    sys.exit(0 if score > 0 else 1)
