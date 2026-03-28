"""
Automated graders for evaluating task completion.
Each grader returns a score between 0.0 and 1.0.
"""

from dataclasses import dataclass, field
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from env.state import EnvironmentState
    from env.tasks import Task


@dataclass
class GradeCriteria:
    name: str
    passed: bool
    weight: float
    description: str


@dataclass
class GradeResult:
    score: float
    passed: bool
    feedback: str
    criteria: List[GradeCriteria] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "passed": self.passed,
            "feedback": self.feedback,
            "criteria": [
                {
                    "name": c.name,
                    "passed": c.passed,
                    "weight": c.weight,
                    "description": c.description,
                }
                for c in self.criteria
            ],
        }


def grade_task_1(state: "EnvironmentState") -> GradeResult:
    """Task 1: Did the agent successfully search for the product?"""
    criteria = [
        GradeCriteria(
            name="navigated_home",
            passed=any(h.page == "home" for h in state.history),
            weight=0.3,
            description="Agent navigated to the homepage",
        ),
        GradeCriteria(
            name="searched_product",
            passed=any(h.page == "search_results" for h in state.history)
            and state.last_search_query is not None,
            weight=0.5,
            description="Agent performed a product search",
        ),
        GradeCriteria(
            name="correct_search_term",
            passed=state.last_search_query is not None
            and "laptop" in state.last_search_query.lower(),
            weight=0.2,
            description="Agent searched for the correct product category (laptop)",
        ),
    ]

    score = sum(c.weight for c in criteria if c.passed)
    score = min(1.0, score)
    return GradeResult(
        score=score,
        passed=score >= 0.7,
        feedback="Successfully completed the basic search task"
        if score >= 0.7
        else "Did not complete the search task correctly",
        criteria=criteria,
    )


def grade_task_2(state: "EnvironmentState", task: "Task") -> GradeResult:
    """Task 2: Did the agent find and click the correct product?"""
    correct_product_clicked = any(
        h.page == "product_detail" and h.current_product_id == task.target_product_id
        for h in state.history
    ) or state.current_product_id == task.target_product_id

    criteria = [
        GradeCriteria(
            name="searched_for_product",
            passed=state.last_search_query is not None
            and task.target_product.split()[0].lower()
            in state.last_search_query.lower(),
            weight=0.2,
            description=f"Agent searched for '{task.target_product}'",
        ),
        GradeCriteria(
            name="viewed_search_results",
            passed=any(h.page == "search_results" for h in state.history),
            weight=0.2,
            description="Agent viewed search results",
        ),
        GradeCriteria(
            name="clicked_correct_product",
            passed=correct_product_clicked,
            weight=0.6,
            description=f"Agent selected the correct product (ID: {task.target_product_id})",
        ),
    ]

    score = min(1.0, sum(c.weight for c in criteria if c.passed))
    return GradeResult(
        score=score,
        passed=score >= 0.8,
        feedback="Successfully found the correct product"
        if score >= 0.8
        else "Did not find the correct product",
        criteria=criteria,
    )


def grade_task_3(state: "EnvironmentState", task: "Task") -> GradeResult:
    """Task 3: Did the agent complete the full purchase flow?"""
    correct_product_in_cart = task.target_product_id in state.cart_items
    correct_product_clicked = any(
        h.page == "product_detail" and h.current_product_id == task.target_product_id
        for h in state.history
    ) or state.current_product_id == task.target_product_id

    criteria = [
        GradeCriteria(
            name="navigated_home",
            passed=any(h.page == "home" for h in state.history),
            weight=0.1,
            description="Agent started from homepage",
        ),
        GradeCriteria(
            name="searched_correct_product",
            passed=state.last_search_query is not None
            and task.target_product.split()[0].lower()
            in state.last_search_query.lower(),
            weight=0.2,
            description=f"Agent searched for '{task.target_product}'",
        ),
        GradeCriteria(
            name="clicked_correct_product",
            passed=correct_product_clicked,
            weight=0.3,
            description="Agent selected the correct product",
        ),
        GradeCriteria(
            name="added_to_cart",
            passed=correct_product_in_cart,
            weight=0.4,
            description="Agent successfully added the correct product to cart",
        ),
    ]

    score = min(1.0, sum(c.weight for c in criteria if c.passed))
    return GradeResult(
        score=score,
        passed=correct_product_in_cart,
        feedback="Successfully completed the full purchase flow"
        if correct_product_in_cart
        else "Did not complete the purchase flow",
        criteria=criteria,
    )


def grade_task(state: "EnvironmentState", task: "Task") -> GradeResult:
    """Dispatch to the appropriate grader based on task ID."""
    if task.id == "task_1":
        return grade_task_1(state)
    elif task.id == "task_2":
        return grade_task_2(state, task)
    elif task.id == "task_3":
        return grade_task_3(state, task)
    else:
        return grade_task_3(state, task)
