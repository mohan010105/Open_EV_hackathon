"""
Environment state definitions for the OpenEnv AI Web Navigation Training Environment.
"""

from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime


PAGE_TYPES = ["home", "search_results", "product_detail", "cart"]


@dataclass
class HistoryEntry:
    page: str
    action: str
    current_product_id: Optional[str]
    step: int


@dataclass
class EnvironmentState:
    session_id: str
    task_id: str
    current_page: str = "home"
    search_results: List[str] = field(default_factory=list)
    current_product_id: Optional[str] = None
    cart_items: List[str] = field(default_factory=list)
    last_search_query: Optional[str] = None
    step_count: int = 0
    total_reward: float = 0.0
    is_done: bool = False
    history: List[HistoryEntry] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    ended_at: Optional[str] = None


def create_initial_state(session_id: str, task_id: str) -> EnvironmentState:
    """Create a fresh environment state for a new session."""
    return EnvironmentState(session_id=session_id, task_id=task_id)
