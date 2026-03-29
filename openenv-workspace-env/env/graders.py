"""
Automated graders for the Workspace Assistant environment.

Every grader returns a dict:
  {
    "score":    float   – normalised 0.0 … 1.0
    "passed":   bool    – True when the task goal is fully achieved
    "feedback": str
    "criteria": list[dict]
  }
"""

from __future__ import annotations


# ── Public helpers ─────────────────────────────────────────────────────────────

def grade_task(state: dict, task: dict) -> dict:
    """Dispatch to the correct grader based on task ID."""
    graders = {
        "ws_task_1": grade_email_retrieval,
        "ws_task_2": grade_meeting_scheduling,
        "ws_task_3": grade_document_organization,
    }
    fn = graders.get(task["id"], grade_document_organization)
    return fn(state, task)


# ── Task graders ───────────────────────────────────────────────────────────────

def grade_email_retrieval(state: dict, task: dict) -> dict:
    """
    Task 1 — Email Retrieval
    Goal: open inbox → search for Alex → read Alex's email
    """
    opened_inbox = any(h["app"] == "email_inbox" for h in state["history"])
    searched = (
        state.get("last_search_query") is not None
        and (task.get("target_email_sender", "").split()[0].lower()
             in state["last_search_query"].lower())
    )
    read_target = task.get("target_email_id", "") in state["read_email_ids"]

    criteria = [
        _c("opened_inbox",      opened_inbox, 0.10, "Agent opened the email inbox"),
        _c("searched_for_alex", searched,     0.40, "Agent searched for Alex's emails"),
        _c("read_target_email", read_target,  0.50, "Agent read the correct email"),
    ]
    score = _sum(criteria)
    return {
        "score": score,
        "passed": score >= 0.9,
        "feedback": "Target email found and read" if score >= 0.9 else "Email retrieval incomplete",
        "criteria": criteria,
    }


def grade_meeting_scheduling(state: dict, task: dict) -> dict:
    """
    Task 2 — Meeting Scheduling
    Goal: read email → create calendar event on the correct date/time
    """
    read_email = task.get("target_email_id", "") in state["read_email_ids"]
    correct_event = any(
        e.get("created_from_email")
        and e.get("date")  == task.get("meeting_date")
        and e.get("time")  == task.get("meeting_time")
        for e in state["calendar_events"]
    )

    criteria = [
        _c("read_target_email",     read_email,     0.30, "Agent read the email with meeting details"),
        _c("created_correct_event", correct_event,  0.70, "Agent created calendar event at correct date/time"),
    ]
    score = _sum(criteria)
    return {
        "score": score,
        "passed": correct_event,
        "feedback": "Meeting scheduled correctly" if correct_event else "Calendar event not yet created",
        "criteria": criteria,
    }


def grade_document_organization(state: dict, task: dict) -> dict:
    """
    Task 3 — Document Organization
    Goal: navigate to documents → move target doc to target folder
    """
    viewed_docs = any(h["app"] == "documents" for h in state["history"])
    target_id     = task.get("target_document_id", "")
    target_folder = task.get("target_folder", "")
    moved_correctly = (
        target_id in state.get("document_moves", {})
        and state["document_moves"][target_id] == target_folder
    )

    criteria = [
        _c("viewed_documents",       viewed_docs,      0.10, "Agent opened the documents app"),
        _c("moved_correct_document", moved_correctly,  0.90, f"Agent moved doc to '{target_folder}'"),
    ]
    score = _sum(criteria)
    return {
        "score": score,
        "passed": moved_correctly,
        "feedback": "Document moved to correct folder" if moved_correctly else "Document not yet organised",
        "criteria": criteria,
    }


# ── Internal helpers ───────────────────────────────────────────────────────────

def _c(name: str, passed: bool, weight: float, description: str) -> dict:
    return {"name": name, "passed": passed, "weight": weight, "description": description}


def _sum(criteria: list[dict]) -> float:
    return min(1.0, sum(c["weight"] for c in criteria if c["passed"]))
