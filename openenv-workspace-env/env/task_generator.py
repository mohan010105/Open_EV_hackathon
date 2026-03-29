"""
Dynamic task generator for the Workspace Assistant environment.

Instead of fixed task IDs, each episode randomly selects a task type
and a concrete target from the available seed data, producing a unique
task description each time.

Functions
---------
generate_random_task(rng, emails, documents) → dict
    Build a fully-specified task dict from live seed data.

get_task(task_id, rng, emails, documents) → dict
    Return a named task (ws_task_1/2/3) or delegate to generate_random_task.
"""

from __future__ import annotations

import random
from typing import Optional


# ── Task type weights (controls sampling probability) ─────────────────────────
_TASK_WEIGHTS = {
    "find_email_from_sender": 0.35,
    "schedule_meeting":       0.35,
    "organize_document":      0.30,
}


def generate_random_task(
    rng: random.Random,
    emails: list[dict],
    documents: list[dict],
) -> dict:
    """
    Randomly select a task type and pick concrete targets from the available
    seed data.

    Parameters
    ----------
    rng       : seeded Random instance for reproducibility
    emails    : current episode email list (may be difficulty-filtered)
    documents : current episode document list

    Returns
    -------
    A fully-specified task dict compatible with WorkspaceEnvironment.
    """
    task_types = list(_TASK_WEIGHTS.keys())
    weights    = [_TASK_WEIGHTS[t] for t in task_types]
    task_type  = rng.choices(task_types, weights=weights, k=1)[0]

    if task_type == "find_email_from_sender":
        return _make_find_email_task(rng, emails)
    if task_type == "schedule_meeting":
        return _make_schedule_meeting_task(rng, emails)
    return _make_organize_document_task(rng, documents)


def get_task(
    task_id: Optional[str],
    rng: random.Random,
    emails: list[dict],
    documents: list[dict],
) -> dict:
    """
    Return a named task by ID, or generate a random one.

    Named tasks
    -----------
    ws_task_1 → find email from Alex Johnson
    ws_task_2 → schedule meeting from Alex's email
    ws_task_3 → move project_proposal.pdf to Projects
    """
    named = {
        "ws_task_1": _static_task_1,
        "ws_task_2": _static_task_2,
        "ws_task_3": _static_task_3,
    }
    if task_id and task_id in named:
        return named[task_id](emails, documents)
    return generate_random_task(rng, emails, documents)


# ── Named task builders ────────────────────────────────────────────────────────

def _static_task_1(emails: list[dict], documents: list[dict]) -> dict:
    target = _find_email_by_id("email_001", emails)
    return _find_email_task_dict(
        task_id="ws_task_1",
        description='Find the email from Alex Johnson about the team meeting. '
                    'Open the inbox, search for Alex, and read his email.',
        goal='Find and read the email from Alex Johnson',
        target_email=target or {"id": "email_001", "sender": "Alex Johnson"},
        max_steps=6,
    )


def _static_task_2(emails: list[dict], documents: list[dict]) -> dict:
    target = _find_email_by_id("email_001", emails)
    return _schedule_task_dict(
        task_id="ws_task_2",
        description="Read Alex Johnson's email about the team meeting and schedule "
                    "it in the calendar for Thursday at 3:00 PM.",
        goal="Schedule the meeting from Alex's email into the calendar",
        target_email=target or {"id": "email_001", "sender": "Alex Johnson"},
        meeting_date="2026-03-29",
        meeting_time="15:00",
        max_steps=10,
    )


def _static_task_3(emails: list[dict], documents: list[dict]) -> dict:
    target = _find_doc_by_id("doc_001", documents)
    return _organize_task_dict(
        task_id="ws_task_3",
        description="Move 'project_proposal.pdf' from the Inbox folder to the 'Projects' folder.",
        goal="Move project_proposal.pdf to the Projects folder",
        target_doc=target or {"id": "doc_001", "name": "project_proposal.pdf"},
        target_folder="Projects",
        max_steps=8,
    )


# ── Random task builders ───────────────────────────────────────────────────────

def _make_find_email_task(rng: random.Random, emails: list[dict]) -> dict:
    unread = [e for e in emails if not e["read"]]
    pool   = unread if unread else emails
    target = rng.choice(pool)
    sender_first = target["sender"].split()[0]

    return _find_email_task_dict(
        task_id="dynamic_find_email",
        description=f'Find the email from {target["sender"]}.',
        goal=f'Find and read the email from {target["sender"]}',
        target_email=target,
        max_steps=6,
    )


def _make_schedule_meeting_task(rng: random.Random, emails: list[dict]) -> dict:
    meeting_emails = [e for e in emails if e.get("has_meeting_details")]
    if not meeting_emails:
        meeting_emails = emails
    target = rng.choice(meeting_emails)

    dates = ["2026-03-29", "2026-03-30", "2026-03-31", "2026-04-01"]
    times = ["09:00", "10:00", "14:00", "15:00", "16:00"]
    date  = rng.choice(dates)
    time  = rng.choice(times)

    return _schedule_task_dict(
        task_id="dynamic_schedule_meeting",
        description=f'Read the email from {target["sender"]} and schedule the meeting '
                    f'in the calendar for {date} at {time}.',
        goal=f'Schedule the meeting from {target["sender"]}\'s email',
        target_email=target,
        meeting_date=date,
        meeting_time=time,
        max_steps=10,
    )


def _make_organize_document_task(rng: random.Random, documents: list[dict]) -> dict:
    _FOLDER_TARGETS = {
        "project_proposal.pdf": "Projects",
        "leave_policy_2026.pdf": "HR",
        "q1_report.xlsx":        "Finance",
        "onboarding.docx":       "HR",
        "architecture.png":      "Engineering",
    }
    inbox_docs = [d for d in documents if d["folder"] == "Inbox"]
    pool       = inbox_docs if inbox_docs else documents
    target_doc = rng.choice(pool)

    correct_folder = _FOLDER_TARGETS.get(target_doc["name"], "Archive")

    return _organize_task_dict(
        task_id="dynamic_organize_document",
        description=f"Move '{target_doc['name']}' to the '{correct_folder}' folder.",
        goal=f"Move {target_doc['name']} to {correct_folder}",
        target_doc=target_doc,
        target_folder=correct_folder,
        max_steps=8,
    )


# ── Task dict constructors ─────────────────────────────────────────────────────

def _find_email_task_dict(
    task_id: str,
    description: str,
    goal: str,
    target_email: dict,
    max_steps: int,
) -> dict:
    return {
        "id":                  task_id,
        "name":                "Email Retrieval",
        "description":         description,
        "difficulty":          "easy",
        "goal":                goal,
        "max_steps":           max_steps,
        "target_email_id":     target_email["id"],
        "target_email_sender": target_email.get("sender", ""),
        "target_document_id":  None,
        "target_folder":       None,
        "meeting_date":        None,
        "meeting_time":        None,
    }


def _schedule_task_dict(
    task_id: str,
    description: str,
    goal: str,
    target_email: dict,
    meeting_date: str,
    meeting_time: str,
    max_steps: int,
) -> dict:
    return {
        "id":                  task_id,
        "name":                "Meeting Scheduling",
        "description":         description,
        "difficulty":          "medium",
        "goal":                goal,
        "max_steps":           max_steps,
        "target_email_id":     target_email["id"],
        "target_email_sender": target_email.get("sender", ""),
        "target_document_id":  None,
        "target_folder":       None,
        "meeting_date":        meeting_date,
        "meeting_time":        meeting_time,
    }


def _organize_task_dict(
    task_id: str,
    description: str,
    goal: str,
    target_doc: dict,
    target_folder: str,
    max_steps: int,
) -> dict:
    return {
        "id":                  task_id,
        "name":                "Document Organization",
        "description":         description,
        "difficulty":          "hard",
        "goal":                goal,
        "max_steps":           max_steps,
        "target_email_id":     None,
        "target_email_sender": None,
        "target_document_id":  target_doc["id"],
        "target_folder":       target_folder,
        "meeting_date":        None,
        "meeting_time":        None,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _find_email_by_id(email_id: str, emails: list[dict]) -> Optional[dict]:
    return next((e for e in emails if e["id"] == email_id), None)


def _find_doc_by_id(doc_id: str, documents: list[dict]) -> Optional[dict]:
    return next((d for d in documents if d["id"] == doc_id), None)
