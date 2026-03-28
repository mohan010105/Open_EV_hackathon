/**
 * Core environment logic for the OpenEnv AI Web Navigation Training Environment.
 * Implements the RL interface: reset(), step(action), state().
 */

import { randomUUID } from "crypto";
import {
  EnvironmentState,
  createInitialState,
  PageType,
  HistoryEntry,
} from "./state.js";
import { Task, getTaskById, getRandomTask, TASKS } from "./tasks.js";
import { Product, searchProducts, getProductById } from "./products.js";
import { gradeTask, GradeResult } from "./graders.js";

export interface Observation {
  page: PageType;
  available_actions: string[];
  search_results: Product[];
  current_product: Product | null;
  cart_items: Product[];
  task_description: string;
  task_id: string;
  step_count: number;
  total_reward: number;
}

export interface StepResult {
  observation: Observation;
  reward: number;
  done: boolean;
  info: {
    action_valid: boolean;
    grade_result?: GradeResult;
    error?: string;
    step_reward_reason?: string;
  };
}

export interface SessionRecord {
  session_id: string;
  task_id: string;
  task_name: string;
  total_reward: number;
  steps_taken: number;
  completed: boolean;
  grader_score: number;
  started_at: string;
  ended_at: string | null;
}

/** Available actions per page */
const PAGE_ACTIONS: Record<PageType, string[]> = {
  home: ["open_home", "search_product", "noop"],
  search_results: ["open_home", "search_product", "click_product", "noop"],
  product_detail: ["open_home", "search_product", "add_to_cart", "noop"],
  cart: ["open_home", "search_product", "noop"],
};

/**
 * Main environment class implementing the RL interface.
 * Singleton-per-process; state is stored in memory.
 */
export class WebNavigationEnvironment {
  private state: EnvironmentState | null = null;
  private currentTask: Task | null = null;
  private sessions: SessionRecord[] = [];

  /**
   * Reset the environment to the initial state.
   * @param taskId Optional task ID to select a specific task
   * @param seed Optional random seed (currently used for logging only)
   */
  reset(taskId?: string, _seed?: number): StepResult {
    // If there was a previous session, record it
    if (this.state && this.currentTask) {
      this.finalizeSession();
    }

    const task = taskId ? (getTaskById(taskId) ?? getRandomTask()) : getRandomTask();
    const sessionId = randomUUID();
    this.state = createInitialState(sessionId, task.id);
    this.currentTask = task;

    return {
      observation: this.buildObservation(),
      reward: 0,
      done: false,
      info: { action_valid: true, step_reward_reason: "Environment reset" },
    };
  }

  /**
   * Execute an action and return the new observation, reward, and done flag.
   */
  step(action: string, params: Record<string, unknown> = {}): StepResult {
    if (!this.state || !this.currentTask) {
      return this.errorResult("Environment not initialized. Call reset() first.");
    }

    if (this.state.is_done) {
      return this.errorResult("Episode is already done. Call reset() to start a new episode.");
    }

    this.state.step_count += 1;
    let reward = 0;
    let done = false;
    let rewardReason = "";
    let actionValid = true;

    // Check if action is valid on current page
    const validActions = PAGE_ACTIONS[this.state.current_page];
    const isValidAction = validActions.includes(action);

    if (!isValidAction) {
      reward = this.currentTask.reward_breakdown.incorrect_action;
      rewardReason = `Invalid action '${action}' on page '${this.state.current_page}'`;
      actionValid = false;
    } else {
      // Execute the action
      switch (action) {
        case "open_home":
          reward = this.executeOpenHome();
          rewardReason = "Navigated to homepage";
          break;

        case "search_product": {
          const productName = typeof params.product_name === "string" ? params.product_name : "";
          if (!productName) {
            reward = this.currentTask.reward_breakdown.incorrect_action;
            rewardReason = "search_product requires params.product_name";
            actionValid = false;
          } else {
            reward = this.executeSearchProduct(productName);
            rewardReason = `Searched for '${productName}'`;
          }
          break;
        }

        case "click_product": {
          const productId = typeof params.product_id === "string" ? params.product_id : "";
          if (!productId) {
            reward = this.currentTask.reward_breakdown.incorrect_action;
            rewardReason = "click_product requires params.product_id";
            actionValid = false;
          } else {
            const result = this.executeClickProduct(productId);
            reward = result.reward;
            rewardReason = result.reason;
          }
          break;
        }

        case "add_to_cart":
          reward = this.executeAddToCart();
          rewardReason = "Added product to cart";
          break;

        case "noop":
          reward = 0;
          rewardReason = "No operation";
          break;

        default:
          reward = this.currentTask.reward_breakdown.incorrect_action;
          rewardReason = `Unknown action: ${action}`;
          actionValid = false;
      }
    }

    // Clamp reward contribution to avoid negative total going below 0
    this.state.total_reward = Math.max(
      0,
      Math.min(1.0, this.state.total_reward + reward),
    );

    // Record history
    const entry: HistoryEntry = {
      page: this.state.current_page,
      action,
      current_product_id: this.state.current_product_id,
      step: this.state.step_count,
    };
    this.state.history.push(entry);

    // Check termination conditions
    const gradeResult = gradeTask(this.state, this.currentTask);
    if (
      gradeResult.passed ||
      this.state.step_count >= this.currentTask.max_steps
    ) {
      done = true;
      this.state.is_done = true;
      this.state.ended_at = new Date().toISOString();
      this.finalizeSession(gradeResult);
    }

    return {
      observation: this.buildObservation(),
      reward,
      done,
      info: {
        action_valid: actionValid,
        grade_result: done ? gradeResult : undefined,
        step_reward_reason: rewardReason,
      },
    };
  }

  /**
   * Return the current state without modifying it.
   */
  getState(): {
    observation: Observation;
    session_id: string;
    is_active: boolean;
    created_at: string;
  } {
    if (!this.state || !this.currentTask) {
      const emptyObs: Observation = {
        page: "home",
        available_actions: ["open_home", "search_product", "noop"],
        search_results: [],
        current_product: null,
        cart_items: [],
        task_description: "No active session. Call reset() to start.",
        task_id: "",
        step_count: 0,
        total_reward: 0,
      };
      return {
        observation: emptyObs,
        session_id: "",
        is_active: false,
        created_at: new Date().toISOString(),
      };
    }

    return {
      observation: this.buildObservation(),
      session_id: this.state.session_id,
      is_active: !this.state.is_done,
      created_at: this.state.created_at,
    };
  }

  /**
   * Get the list of available tasks.
   */
  getTasks(): Task[] {
    return TASKS;
  }

  /**
   * Get session history.
   */
  getSessions(): { sessions: SessionRecord[]; total_sessions: number } {
    return {
      sessions: [...this.sessions].reverse(),
      total_sessions: this.sessions.length,
    };
  }

  // ─────────────────────────── Action handlers ───────────────────────────

  private executeOpenHome(): number {
    const wasAlreadyHome = this.state!.current_page === "home";
    this.state!.current_page = "home";
    this.state!.search_results = [];
    this.state!.current_product_id = null;

    // Reward only first time navigating home
    if (wasAlreadyHome) return 0;
    return this.currentTask!.reward_breakdown.navigate_home;
  }

  private executeSearchProduct(query: string): number {
    this.state!.current_page = "search_results";
    this.state!.last_search_query = query;
    const results = searchProducts(query);
    this.state!.search_results = results.map((p) => p.id);
    this.state!.current_product_id = null;

    // Check if the search matched the target product category
    const targetHit = results.some(
      (p) => p.id === this.currentTask!.target_product_id,
    );

    if (targetHit) {
      return this.currentTask!.reward_breakdown.search_product;
    }
    // Partial reward for any search
    return this.currentTask!.reward_breakdown.search_product * 0.5;
  }

  private executeClickProduct(productId: string): { reward: number; reason: string } {
    const product = getProductById(productId);

    // Product must be in current search results
    if (!this.state!.search_results.includes(productId)) {
      return {
        reward: this.currentTask!.reward_breakdown.incorrect_action,
        reason: `Product '${productId}' not in current search results`,
      };
    }

    if (!product) {
      return {
        reward: this.currentTask!.reward_breakdown.incorrect_action,
        reason: `Product '${productId}' not found`,
      };
    }

    this.state!.current_page = "product_detail";
    this.state!.current_product_id = productId;

    if (productId === this.currentTask!.target_product_id) {
      return {
        reward: this.currentTask!.reward_breakdown.find_correct_product,
        reason: `Clicked correct target product: ${product.name}`,
      };
    }

    // Partial reward for clicking any product
    return {
      reward: this.currentTask!.reward_breakdown.incorrect_action * 0.5,
      reason: `Clicked wrong product: ${product.name}`,
    };
  }

  private executeAddToCart(): number {
    if (this.state!.current_page !== "product_detail" || !this.state!.current_product_id) {
      return this.currentTask!.reward_breakdown.incorrect_action;
    }

    const productId = this.state!.current_product_id;

    // Don't add duplicates
    if (!this.state!.cart_items.includes(productId)) {
      this.state!.cart_items.push(productId);
    }

    this.state!.current_page = "cart";

    if (productId === this.currentTask!.target_product_id) {
      return this.currentTask!.reward_breakdown.add_to_cart;
    }
    // Wrong product added
    return this.currentTask!.reward_breakdown.incorrect_action;
  }

  // ─────────────────────────── Helpers ───────────────────────────────────

  private buildObservation(): Observation {
    const state = this.state!;
    const task = this.currentTask!;

    return {
      page: state.current_page,
      available_actions: PAGE_ACTIONS[state.current_page],
      search_results: state.search_results
        .map(getProductById)
        .filter((p): p is Product => p !== undefined),
      current_product: state.current_product_id
        ? (getProductById(state.current_product_id) ?? null)
        : null,
      cart_items: state.cart_items
        .map(getProductById)
        .filter((p): p is Product => p !== undefined),
      task_description: task.description,
      task_id: task.id,
      step_count: state.step_count,
      total_reward: state.total_reward,
    };
  }

  private finalizeSession(gradeResult?: GradeResult): void {
    if (!this.state || !this.currentTask) return;

    const record: SessionRecord = {
      session_id: this.state.session_id,
      task_id: this.currentTask.id,
      task_name: this.currentTask.name,
      total_reward: this.state.total_reward,
      steps_taken: this.state.step_count,
      completed: gradeResult?.passed ?? false,
      grader_score: gradeResult?.score ?? 0,
      started_at: this.state.created_at,
      ended_at: this.state.ended_at ?? new Date().toISOString(),
    };

    this.sessions.push(record);
  }

  private errorResult(message: string): StepResult {
    const obs = this.getState().observation;
    return {
      observation: obs,
      reward: 0,
      done: false,
      info: { action_valid: false, error: message },
    };
  }
}

// Export a singleton instance
export const env = new WebNavigationEnvironment();
