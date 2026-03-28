"""
Task definitions for the OpenEnv AI Web Navigation Training Environment.
"""

import random
from dataclasses import dataclass, field
from typing import Dict, Optional, List


@dataclass
class RewardBreakdown:
    navigate_home: float = 0.2
    search_product: float = 0.5
    find_correct_product: float = 0.3
    add_to_cart: float = 1.0
    incorrect_action: float = -0.1


@dataclass
class Task:
    id: str
    name: str
    description: str
    difficulty: str  # "easy", "medium", "hard"
    target_product: str
    target_product_id: str
    max_steps: int
    reward_breakdown: RewardBreakdown = field(default_factory=RewardBreakdown)


TASKS: List[Task] = [
    Task(
        id="task_1",
        name="Basic Search",
        description="Navigate to the homepage and search for a product. Your goal is to find the search bar and search for 'laptop'.",
        difficulty="easy",
        target_product="laptop",
        target_product_id="prod_laptop_001",
        max_steps=5,
        reward_breakdown=RewardBreakdown(
            navigate_home=0.2,
            search_product=0.5,
            find_correct_product=0.0,
            add_to_cart=0.0,
            incorrect_action=-0.1,
        ),
    ),
    Task(
        id="task_2",
        name="Product Discovery",
        description="Find the correct product from search results. Search for 'wireless headphones' and click on the product with the highest rating.",
        difficulty="medium",
        target_product="wireless headphones",
        target_product_id="prod_headphones_003",
        max_steps=8,
        reward_breakdown=RewardBreakdown(
            navigate_home=0.1,
            search_product=0.2,
            find_correct_product=0.5,
            add_to_cart=0.0,
            incorrect_action=-0.1,
        ),
    ),
    Task(
        id="task_3",
        name="Complete Purchase Flow",
        description="Complete the full purchase flow: navigate to home, search for 'mechanical keyboard', select the correct product, and add it to cart.",
        difficulty="hard",
        target_product="mechanical keyboard",
        target_product_id="prod_keyboard_002",
        max_steps=12,
        reward_breakdown=RewardBreakdown(
            navigate_home=0.1,
            search_product=0.1,
            find_correct_product=0.3,
            add_to_cart=0.5,
            incorrect_action=-0.1,
        ),
    ),
]

TASKS_BY_ID: Dict[str, Task] = {t.id: t for t in TASKS}


def get_task_by_id(task_id: str) -> Optional[Task]:
    return TASKS_BY_ID.get(task_id)


def get_random_task() -> Task:
    return random.choice(TASKS)
