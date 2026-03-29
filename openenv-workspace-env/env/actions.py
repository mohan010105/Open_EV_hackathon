"""
Action handlers for the Workspace Assistant environment.

Reward table (per openenv.yaml spec)
--------------------------------------
correct_navigation  +0.20   switching to the right app as part of progress
correct_action      +0.30   taking a semantically correct action
task_completion     +1.00   task fully achieved (added by environment after grading)
incorrect_action    -0.10   wrong but structurally valid action
invalid_navigation  -0.20   action not permitted in the current app

Each handler receives (params, state, task) and returns (reward, reason, valid).
"""

from __future__ import annotations

from .state import AVAILABLE_FOLDERS, APP_ACTIONS

# ── Reward constants ───────────────────────────────────────────────────────────
R_NAV        = +0.20   # correct navigation
R_CORRECT    = +0.30   # correct action
R_COMPLETION = +1.00   # task completion
R_WRONG      = -0.10   # incorrect action
R_INVALID    = -0.20   # invalid navigation


def dispatch(
    action: str,
    params: dict,
    state: dict,
    task: dict,
) -> tuple[float, str, bool]:
    """
    Route *action* to its handler and return (reward, reason, valid).

    Performs the invalid-navigation guard first.
    """
    valid_actions = APP_ACTIONS.get(state["current_app"], [])
    if action not in valid_actions:
        return (
            R_INVALID,
            f"Action '{action}' is not valid in app '{state['current_app']}'",
            False,
        )

    handlers = {
        "open_email_inbox":        _open_inbox,
        "search_email":            _search_email,
        "read_email":              _read_email,
        "extract_meeting_details": _extract_meeting,
        "create_calendar_event":   _create_event,
        "view_calendar":           _view_calendar,
        "view_documents":          _view_documents,
        "move_document":           _move_document,
        "noop":                    _noop,
    }
    fn = handlers.get(action)
    if fn is None:
        return R_WRONG, f"Unknown action: '{action}'", False
    return fn(params, state, task)


# ── Action handlers ────────────────────────────────────────────────────────────

def _open_inbox(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Navigate to the email inbox."""
    already = state["current_app"] == "email_inbox"
    state["current_app"]    = "email_inbox"
    state["selected_email"] = None
    if already:
        return 0.0, "Already in inbox", True
    return R_NAV, "Opened email inbox", True


def _search_email(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Filter the inbox by sender name."""
    sender = params.get("sender", "").strip()
    if not sender:
        return R_WRONG, "search_email requires params.sender", False

    state["current_app"]      = "email_inbox"
    state["last_search_query"] = sender

    target_id      = task.get("target_email_id")
    target_sender  = task.get("target_email_sender", "")
    matched_target = (
        target_sender.lower() in sender.lower()
        or sender.lower() in target_sender.lower()
    )
    if matched_target:
        return R_CORRECT, f"Searched for '{sender}' — target sender matched", True
    return R_WRONG * 0.5, f"Searched for '{sender}' — target not matched", True


def _read_email(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Open a specific email by ID and mark it read."""
    email_id = params.get("email_id", "").strip()
    email    = next((e for e in state["email_list"] if e["id"] == email_id), None)

    if not email:
        return R_WRONG, f"Email '{email_id}' not found", False

    state["current_app"]    = "email_detail"
    state["selected_email"] = email
    email["read"]            = True
    state["read_email_ids"].add(email_id)

    is_target = email_id == task.get("target_email_id")
    if is_target:
        return R_CORRECT, f"Read target email from {email['sender']}", True
    return R_WRONG * 0.5, f"Read non-target email from {email['sender']}", True


def _extract_meeting(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Extract meeting details from the currently open email."""
    if not state.get("selected_email"):
        return R_WRONG, "No email open — use read_email first", False
    if not state["selected_email"].get("has_meeting_details"):
        return R_WRONG, "Open email has no meeting details", False

    state["extracted_meeting_details"] = True
    return R_CORRECT, "Extracted meeting details from email", True


def _create_event(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Create a calendar event based on the currently open email."""
    if not state.get("selected_email"):
        return R_WRONG, "No email open — read an email first", False
    if not state["selected_email"].get("has_meeting_details"):
        return R_WRONG, "Open email has no meeting details to schedule", False

    is_target = state["selected_email"]["id"] == task.get("target_email_id")
    new_event = {
        "id":                f"cal_new_{state['step_count']}",
        "title":             state["selected_email"]["subject"],
        "date":              task.get("meeting_date", "2026-03-29"),
        "time":              task.get("meeting_time", "15:00"),
        "attendees":         [state["selected_email"]["sender"]],
        "location":          "Conference Room B",
        "created_from_email": True,
    }
    state["calendar_events"].append(new_event)
    state["current_app"] = "calendar"

    if is_target:
        return R_COMPLETION, "Created calendar event from target email", True
    return R_WRONG, "Created event from non-target email", True


def _view_calendar(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Switch to the calendar view."""
    state["current_app"] = "calendar"
    return R_NAV, "Switched to calendar", True


def _view_documents(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Switch to the documents view."""
    state["current_app"] = "documents"
    return R_NAV, "Switched to documents", True


def _move_document(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Move a document to a specified folder."""
    doc_id = params.get("document_id", "").strip()
    folder = params.get("folder",      "").strip()

    if not doc_id or not folder:
        return R_WRONG, "move_document requires 'document_id' and 'folder'", False
    if folder not in AVAILABLE_FOLDERS:
        return R_WRONG, f"Invalid folder '{folder}'. Valid: {AVAILABLE_FOLDERS}", False

    doc = next((d for d in state["documents"] if d["id"] == doc_id), None)
    if not doc:
        return R_WRONG, f"Document '{doc_id}' not found", False

    doc["folder"]                    = folder
    state["document_moves"][doc_id]  = folder

    correct_doc    = doc_id == task.get("target_document_id")
    correct_folder = folder  == task.get("target_folder")

    if correct_doc and correct_folder:
        return R_COMPLETION, f"Moved '{doc['name']}' → '{folder}'", True
    if correct_doc:
        return R_WRONG, f"Correct doc but wrong folder (got '{folder}')", True
    return R_WRONG, f"Moved wrong document '{doc['name']}'", True


def _noop(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """Do nothing — zero reward."""
    return 0.0, "No-op", True
