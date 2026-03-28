/**
 * Automated graders for evaluating task completion.
 * Each grader returns a score between 0.0 and 1.0.
 */

import { EnvironmentState } from "./state.js";
import { Task } from "./tasks.js";

export interface GradeResult {
  score: number; // 0.0 to 1.0
  passed: boolean;
  feedback: string;
  criteria: GradeCriteria[];
}

export interface GradeCriteria {
  name: string;
  passed: boolean;
  weight: number;
  description: string;
}

/**
 * Task 1 grader: Did the agent successfully search for the product?
 */
export function gradeTask1(state: EnvironmentState): GradeResult {
  const criteria: GradeCriteria[] = [
    {
      name: "navigated_home",
      passed: state.history.some((s) => s.page === "home"),
      weight: 0.3,
      description: "Agent navigated to the homepage",
    },
    {
      name: "searched_product",
      passed:
        state.history.some((s) => s.page === "search_results") &&
        state.last_search_query !== null,
      weight: 0.5,
      description: "Agent performed a product search",
    },
    {
      name: "correct_search_term",
      passed:
        state.last_search_query !== null &&
        state.last_search_query.toLowerCase().includes("laptop"),
      weight: 0.2,
      description: "Agent searched for the correct product category (laptop)",
    },
  ];

  const score = criteria.reduce(
    (acc, c) => acc + (c.passed ? c.weight : 0),
    0,
  );

  return {
    score: Math.min(1.0, score),
    passed: score >= 0.7,
    feedback:
      score >= 0.7
        ? "Successfully completed the basic search task"
        : "Did not complete the search task correctly",
    criteria,
  };
}

/**
 * Task 2 grader: Did the agent find and click the correct product?
 */
export function gradeTask2(
  state: EnvironmentState,
  task: Task,
): GradeResult {
  const correctProductClicked =
    state.history.some(
      (s) =>
        s.page === "product_detail" &&
        s.current_product_id === task.target_product_id,
    ) || state.current_product_id === task.target_product_id;

  const criteria: GradeCriteria[] = [
    {
      name: "searched_for_product",
      passed:
        state.last_search_query !== null &&
        state.last_search_query
          .toLowerCase()
          .includes(task.target_product.split(" ")[0].toLowerCase()),
      weight: 0.2,
      description: `Agent searched for '${task.target_product}'`,
    },
    {
      name: "viewed_search_results",
      passed: state.history.some((s) => s.page === "search_results"),
      weight: 0.2,
      description: "Agent viewed search results",
    },
    {
      name: "clicked_correct_product",
      passed: correctProductClicked,
      weight: 0.6,
      description: `Agent selected the correct product (ID: ${task.target_product_id})`,
    },
  ];

  const score = criteria.reduce(
    (acc, c) => acc + (c.passed ? c.weight : 0),
    0,
  );

  return {
    score: Math.min(1.0, score),
    passed: score >= 0.8,
    feedback:
      score >= 0.8
        ? "Successfully found the correct product"
        : "Did not find the correct product",
    criteria,
  };
}

/**
 * Task 3 grader: Did the agent complete the full purchase flow?
 */
export function gradeTask3(
  state: EnvironmentState,
  task: Task,
): GradeResult {
  const correctProductInCart = state.cart_items.some(
    (id) => id === task.target_product_id,
  );
  const correctProductClicked =
    state.history.some(
      (s) =>
        s.page === "product_detail" &&
        s.current_product_id === task.target_product_id,
    ) || state.current_product_id === task.target_product_id;

  const criteria: GradeCriteria[] = [
    {
      name: "navigated_home",
      passed: state.history.some((s) => s.page === "home"),
      weight: 0.1,
      description: "Agent started from homepage",
    },
    {
      name: "searched_correct_product",
      passed:
        state.last_search_query !== null &&
        state.last_search_query
          .toLowerCase()
          .includes(task.target_product.split(" ")[0].toLowerCase()),
      weight: 0.2,
      description: `Agent searched for '${task.target_product}'`,
    },
    {
      name: "clicked_correct_product",
      passed: correctProductClicked,
      weight: 0.3,
      description: "Agent selected the correct product",
    },
    {
      name: "added_to_cart",
      passed: correctProductInCart,
      weight: 0.4,
      description: "Agent successfully added the correct product to cart",
    },
  ];

  const score = criteria.reduce(
    (acc, c) => acc + (c.passed ? c.weight : 0),
    0,
  );

  return {
    score: Math.min(1.0, score),
    passed: correctProductInCart,
    feedback: correctProductInCart
      ? "Successfully completed the full purchase flow"
      : "Did not complete the purchase flow",
    criteria,
  };
}

/**
 * Dispatch grading to the appropriate grader based on task ID.
 */
export function gradeTask(
  state: EnvironmentState,
  task: Task,
): GradeResult {
  switch (task.id) {
    case "task_1":
      return gradeTask1(state);
    case "task_2":
      return gradeTask2(state, task);
    case "task_3":
      return gradeTask3(state, task);
    default:
      return gradeTask3(state, task);
  }
}
