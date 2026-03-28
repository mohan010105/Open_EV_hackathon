/**
 * Environment state management for the OpenEnv RL environment.
 * Tracks the agent's position in the simulated website navigation.
 */

export type PageType = "home" | "search_results" | "product_detail" | "cart";

export interface HistoryEntry {
  page: PageType;
  action: string;
  current_product_id: string | null;
  step: number;
}

export interface EnvironmentState {
  session_id: string;
  task_id: string;
  current_page: PageType;
  search_results: string[];
  current_product_id: string | null;
  cart_items: string[];
  last_search_query: string | null;
  step_count: number;
  total_reward: number;
  is_done: boolean;
  history: HistoryEntry[];
  created_at: string;
  ended_at: string | null;
}

export function createInitialState(
  sessionId: string,
  taskId: string,
): EnvironmentState {
  return {
    session_id: sessionId,
    task_id: taskId,
    current_page: "home",
    search_results: [],
    current_product_id: null,
    cart_items: [],
    last_search_query: null,
    step_count: 0,
    total_reward: 0,
    is_done: false,
    history: [],
    created_at: new Date().toISOString(),
    ended_at: null,
  };
}
