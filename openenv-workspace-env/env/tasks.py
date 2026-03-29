"""
Task definitions for the Workspace Assistant environment.
Each task specifies its goal, grader reference, and reward structure.
"""

import random
from typing import Optional

TASKS: list[dict] = [
    {
        "id": "ws_task_1",
        "name": "Email Retrieval",
        "description": (
            "Find the email from Alex Johnson about the team meeting. "
            "Open the inbox, search for Alex, and read his email."
        ),
        "difficulty": "easy",
        "goal": "Find and read the email from Alex Johnson",
        "max_steps": 6,
        "target_email_id": "email_001",
        "target_email_sender": "Alex Johnson",
        "target_document_id": None,
        "target_folder": None,
        "meeting_date": None,
        "meeting_time": None,
    },
    {
        "id": "ws_task_2",
        "name": "Meeting Scheduling",
        "description": (
            "Read Alex Johnson's email about the team meeting and schedule it "
            "in the calendar for Thursday at 3:00 PM."
        ),
        "difficulty": "medium",
        "goal": "Schedule the meeting from Alex's email into the calendar",
        "max_steps": 10,
        "target_email_id": "email_001",
        "target_email_sender": "Alex Johnson",
        "target_document_id": None,
        "target_folder": None,
        "meeting_date": "2026-03-29",
        "meeting_time": "15:00",
    },
    {
        "id": "ws_task_3",
        "name": "Document Organization",
        "description": "Move 'project_proposal.pdf' from the Inbox folder to the 'Projects' folder.",
        "difficulty": "hard",
        "goal": "Move project_proposal.pdf to the Projects folder",
        "max_steps": 8,
        "target_email_id": None,
        "target_email_sender": None,
        "target_document_id": "doc_001",
        "target_folder": "Projects",
        "meeting_date": None,
        "meeting_time": None,
    },
]


def get_task(task_id: Optional[str] = None) -> dict:
    """Return task by ID, or a random task if no ID given."""
    if task_id:
        task = next((t for t in TASKS if t["id"] == task_id), None)
        if task:
            return task
    return random.choice(TASKS)


def list_tasks() -> list[dict]:
    return TASKS
