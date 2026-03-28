"""Workspace task definitions."""
import random

WORKSPACE_TASKS = [
    {
        "id": "ws_task_1",
        "name": "Email Retrieval",
        "description": "Find the email from Alex Johnson about the team meeting. Open the inbox, search for Alex, and read the email.",
        "difficulty": "easy",
        "goal": "Find and read the email from Alex",
        "max_steps": 6,
        "target_email_sender": "Alex Johnson",
        "target_email_id": "email_001",
        "reward_breakdown": {
            "open_inbox": 0.1,
            "find_email": 0.4,
            "read_email": 0.5,
            "extract_meeting": 0.0,
            "create_event": 0.0,
            "move_document": 0.0,
            "incorrect_action": -0.1,
            "invalid_navigation": -0.2,
        },
    },
    {
        "id": "ws_task_2",
        "name": "Meeting Scheduling",
        "description": "Read the email from Alex about the team meeting and schedule it in the calendar for Thursday at 3:00 PM.",
        "difficulty": "medium",
        "goal": "Schedule meeting with Alex at 3pm Thursday",
        "max_steps": 10,
        "target_email_sender": "Alex Johnson",
        "target_email_id": "email_001",
        "meeting_date": "2026-03-29",
        "meeting_time": "15:00",
        "reward_breakdown": {
            "open_inbox": 0.05,
            "find_email": 0.1,
            "read_email": 0.15,
            "extract_meeting": 0.3,
            "create_event": 0.7,
            "move_document": 0.0,
            "incorrect_action": -0.1,
            "invalid_navigation": -0.2,
        },
    },
    {
        "id": "ws_task_3",
        "name": "Document Organization",
        "description": "Move 'project_proposal.pdf' from the Inbox folder to the 'Projects' folder.",
        "difficulty": "hard",
        "goal": "Move project_proposal.pdf to Projects folder",
        "max_steps": 8,
        "target_document_id": "doc_001",
        "target_folder": "Projects",
        "reward_breakdown": {
            "open_inbox": 0.0,
            "find_email": 0.0,
            "read_email": 0.0,
            "extract_meeting": 0.0,
            "create_event": 0.0,
            "move_document": 1.0,
            "incorrect_action": -0.1,
            "invalid_navigation": -0.2,
        },
    },
]


def get_task_by_id(task_id: str):
    return next((t for t in WORKSPACE_TASKS if t["id"] == task_id), None)


def get_random_task():
    return random.choice(WORKSPACE_TASKS)
