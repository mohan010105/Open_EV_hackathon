"""
Core environment logic for the OpenEnv AI Web Navigation Training Environment.
Implements the standard RL interface: reset(), step(action), state().
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List

from env.state import EnvironmentState, HistoryEntry, create_initial_state
from env.tasks import Task, TASKS, get_task_by_id, get_random_task
from env.products import Product, search_products, get_product_by_id
from env.graders import grade_task, GradeResult


# Available actions per page
PAGE_ACTIONS: Dict[str, List[str]] = {
    "home": ["open_home", "search_product", "noop"],
    "search_results": ["open_home", "search_product", "click_product", "noop"],
    "product_detail": ["open_home", "search_product", "add_to_cart", "noop"],
    "cart": ["open_home", "search_product", "noop"],
}


def build_observation(state: EnvironmentState, task: Task) -> dict:
    """Build an observation dict from the current environment state."""
    return {
        "page": state.current_page,
        "available_actions": PAGE_ACTIONS.get(state.current_page, ["noop"]),
        "search_results": [
            p.to_dict()
            for pid in state.search_results
            if (p := get_product_by_id(pid)) is not None
        ],
        "current_product": (
            get_product_by_id(state.current_product_id).to_dict()
            if state.current_product_id
            else None
        ),
        "cart_items": [
            p.to_dict()
            for pid in state.cart_items
            if (p := get_product_by_id(pid)) is not None
        ],
        "task_description": task.description,
        "task_id": task.id,
        "step_count": state.step_count,
        "total_reward": state.total_reward,
    }


class WebNavigationEnvironment:
    """
    Simulated web navigation RL environment.
    Maintains a single active session; call reset() to start a new one.
    """

    def __init__(self):
        self._state: Optional[EnvironmentState] = None
        self._task: Optional[Task] = None
        self._sessions: List[dict] = []

    # ── RL Interface ───────────────────────────────────────────────────────

    def reset(self, task_id: Optional[str] = None, seed: Optional[int] = None) -> dict:
        """
        Reset the environment.
        Returns: { observation, reward, done, info }
        """
        # Finalize any previous session
        if self._state and self._task:
            self._finalize_session()

        task = get_task_by_id(task_id) if task_id else None
        if task is None:
            task = get_random_task()

        session_id = str(uuid.uuid4())
        self._state = create_initial_state(session_id, task.id)
        self._task = task

        return {
            "observation": build_observation(self._state, self._task),
            "reward": 0,
            "done": False,
            "info": {"action_valid": True, "step_reward_reason": "Environment reset"},
        }

    def step(self, action: str, params: Dict[str, Any] = None) -> dict:
        """
        Execute an action.
        Returns: { observation, reward, done, info }
        """
        if self._state is None or self._task is None:
            return self._error_result("Environment not initialized. Call reset() first.")

        if self._state.is_done:
            return self._error_result("Episode already done. Call reset() to start a new episode.")

        params = params or {}
        self._state.step_count += 1
        reward = 0.0
        reason = ""
        action_valid = True

        valid_actions = PAGE_ACTIONS.get(self._state.current_page, [])
        if action not in valid_actions:
            reward = self._task.reward_breakdown.incorrect_action
            reason = f"Invalid action '{action}' on page '{self._state.current_page}'"
            action_valid = False
        else:
            if action == "open_home":
                reward, reason = self._do_open_home()
            elif action == "search_product":
                product_name = params.get("product_name", "")
                if not product_name:
                    reward = self._task.reward_breakdown.incorrect_action
                    reason = "search_product requires params.product_name"
                    action_valid = False
                else:
                    reward, reason = self._do_search_product(product_name)
            elif action == "click_product":
                product_id = params.get("product_id", "")
                if not product_id:
                    reward = self._task.reward_breakdown.incorrect_action
                    reason = "click_product requires params.product_id"
                    action_valid = False
                else:
                    reward, reason = self._do_click_product(product_id)
            elif action == "add_to_cart":
                reward, reason = self._do_add_to_cart()
            elif action == "noop":
                reward, reason = 0.0, "No operation"

        # Clamp total reward
        self._state.total_reward = max(0.0, min(1.0, self._state.total_reward + reward))

        # Record history
        self._state.history.append(
            HistoryEntry(
                page=self._state.current_page,
                action=action,
                current_product_id=self._state.current_product_id,
                step=self._state.step_count,
            )
        )

        # Check termination
        grade_result = grade_task(self._state, self._task)
        done = grade_result.passed or self._state.step_count >= self._task.max_steps

        info: dict = {"action_valid": action_valid, "step_reward_reason": reason}
        if done:
            self._state.is_done = True
            self._state.ended_at = datetime.utcnow().isoformat()
            self._finalize_session(grade_result)
            info["grade_result"] = grade_result.to_dict()

        return {
            "observation": build_observation(self._state, self._task),
            "reward": reward,
            "done": done,
            "info": info,
        }

    def state(self) -> dict:
        """Return current state without modifying it."""
        return self.get_state()

    def get_state(self) -> dict:
        if self._state is None or self._task is None:
            return {
                "observation": {
                    "page": "home",
                    "available_actions": ["open_home", "search_product", "noop"],
                    "search_results": [],
                    "current_product": None,
                    "cart_items": [],
                    "task_description": "No active session. Call reset() to start.",
                    "task_id": "",
                    "step_count": 0,
                    "total_reward": 0.0,
                },
                "session_id": "",
                "is_active": False,
                "created_at": datetime.utcnow().isoformat(),
            }
        return {
            "observation": build_observation(self._state, self._task),
            "session_id": self._state.session_id,
            "is_active": not self._state.is_done,
            "created_at": self._state.created_at,
        }

    def get_sessions(self) -> dict:
        return {
            "sessions": list(reversed(self._sessions)),
            "total_sessions": len(self._sessions),
        }

    # ── Action handlers ────────────────────────────────────────────────────

    def _do_open_home(self):
        was_home = self._state.current_page == "home"
        self._state.current_page = "home"
        self._state.search_results = []
        self._state.current_product_id = None
        if was_home:
            return 0.0, "Already on homepage"
        return self._task.reward_breakdown.navigate_home, "Navigated to homepage"

    def _do_search_product(self, query: str):
        self._state.current_page = "search_results"
        self._state.last_search_query = query
        results = search_products(query)
        self._state.search_results = [p.id for p in results]
        self._state.current_product_id = None

        target_hit = any(p.id == self._task.target_product_id for p in results)
        if target_hit:
            return self._task.reward_breakdown.search_product, f"Searched '{query}' — target product found in results"
        return self._task.reward_breakdown.search_product * 0.5, f"Searched '{query}' — target not in results"

    def _do_click_product(self, product_id: str):
        if product_id not in self._state.search_results:
            return self._task.reward_breakdown.incorrect_action, f"Product '{product_id}' not in current search results"
        product = get_product_by_id(product_id)
        if product is None:
            return self._task.reward_breakdown.incorrect_action, f"Product '{product_id}' not found"

        self._state.current_page = "product_detail"
        self._state.current_product_id = product_id

        if product_id == self._task.target_product_id:
            return self._task.reward_breakdown.find_correct_product, f"Clicked correct product: {product.name}"
        return self._task.reward_breakdown.incorrect_action * 0.5, f"Clicked wrong product: {product.name}"

    def _do_add_to_cart(self):
        if self._state.current_page != "product_detail" or not self._state.current_product_id:
            return self._task.reward_breakdown.incorrect_action, "No product to add to cart"
        product_id = self._state.current_product_id
        if product_id not in self._state.cart_items:
            self._state.cart_items.append(product_id)
        self._state.current_page = "cart"
        if product_id == self._task.target_product_id:
            return self._task.reward_breakdown.add_to_cart, "Added correct product to cart"
        return self._task.reward_breakdown.incorrect_action, "Added wrong product to cart"

    # ── Helpers ────────────────────────────────────────────────────────────

    def _finalize_session(self, grade_result: Optional[GradeResult] = None):
        if not self._state or not self._task:
            return
        self._sessions.append({
            "session_id": self._state.session_id,
            "task_id": self._task.id,
            "task_name": self._task.name,
            "total_reward": self._state.total_reward,
            "steps_taken": self._state.step_count,
            "completed": grade_result.passed if grade_result else False,
            "grader_score": grade_result.score if grade_result else 0.0,
            "started_at": self._state.created_at,
            "ended_at": self._state.ended_at or datetime.utcnow().isoformat(),
        })

    def _error_result(self, message: str) -> dict:
        obs = self.get_state()["observation"]
        return {"observation": obs, "reward": 0, "done": False, "info": {"action_valid": False, "error": message}}
