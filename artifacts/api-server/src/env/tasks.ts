/**
 * Task definitions for the OpenEnv AI Web Navigation Training Environment.
 * Three tasks of increasing difficulty: easy, medium, hard.
 */

export interface Task {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  target_product: string;
  target_product_id: string;
  max_steps: number;
  reward_breakdown: {
    navigate_home: number;
    search_product: number;
    find_correct_product: number;
    add_to_cart: number;
    incorrect_action: number;
  };
}

export const TASKS: Task[] = [
  {
    id: "task_1",
    name: "Basic Search",
    description:
      "Navigate to the homepage and search for a product. Your goal is to find the search bar and search for 'laptop'.",
    difficulty: "easy",
    target_product: "laptop",
    target_product_id: "prod_laptop_001",
    max_steps: 5,
    reward_breakdown: {
      navigate_home: 0.2,
      search_product: 0.5,
      find_correct_product: 0.0,
      add_to_cart: 0.0,
      incorrect_action: -0.1,
    },
  },
  {
    id: "task_2",
    name: "Product Discovery",
    description:
      "Find the correct product from search results. Search for 'wireless headphones' and click on the product with the highest rating.",
    difficulty: "medium",
    target_product: "wireless headphones",
    target_product_id: "prod_headphones_003",
    max_steps: 8,
    reward_breakdown: {
      navigate_home: 0.1,
      search_product: 0.2,
      find_correct_product: 0.5,
      add_to_cart: 0.0,
      incorrect_action: -0.1,
    },
  },
  {
    id: "task_3",
    name: "Complete Purchase Flow",
    description:
      "Complete the full purchase flow: navigate to home, search for 'mechanical keyboard', select the correct product, and add it to cart.",
    difficulty: "hard",
    target_product: "mechanical keyboard",
    target_product_id: "prod_keyboard_002",
    max_steps: 12,
    reward_breakdown: {
      navigate_home: 0.1,
      search_product: 0.1,
      find_correct_product: 0.3,
      add_to_cart: 0.5,
      incorrect_action: -0.1,
    },
  },
];

export function getTaskById(id: string): Task | undefined {
  return TASKS.find((t) => t.id === id);
}

export function getRandomTask(): Task {
  const idx = Math.floor(Math.random() * TASKS.length);
  return TASKS[idx];
}
