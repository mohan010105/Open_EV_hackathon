"""
Action definitions and docstrings for the Workspace Assistant environment.
Each action function takes the current state dict and optional params,
mutates the state in-place, and returns (reward, reason, valid).
"""

from copy import deepcopy
from .state import AVAILABLE_FOLDERS, APP_ACTIONS

# Reward constants
R_CORRECT    = +0.3
R_COMPLETION = +1.0
R_WRONG      = -0.1
R_INVALID    = -0.2


def _rb(task: dict, key: str) -> float:
    """Retrieve a task-level reward override, falling back to defaults."""
    overrides = task.get("reward_overrides", {})
    defaults = {
        "open_inbox":    R_CORRECT * 0.33,
        "find_email":    R_CORRECT,
        "read_email":    R_CORRECT,
        "extract":       R_CORRECT,
        "create_event":  R_COMPLETION,
        "move_document": R_COMPLETION,
        "wrong":         R_WRONG,
        "invalid":       R_INVALID,
    }
    return overrides.get(key, defaults[key])


def dispatch(action: str, params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    """
    Route the action string to its handler.

    Returns
    -------
    reward  : float
    reason  : str   – human-readable explanation for logging
    valid   : bool  – whether the action was structurally valid
    """
    current_app = state["current_app"]
    valid_actions = APP_ACTIONS.get(current_app, [])

    if action not in valid_actions:
        return _rb(task, "invalid"), f"Action '{action}' not valid in '{current_app}'", False

    handlers = {
        "open_email_inbox":     _open_inbox,
        "search_email":         _search_email,
        "read_email":           _read_email,
        "create_calendar_event":_create_event,
        "view_calendar":        _view_calendar,
        "view_documents":       _view_documents,
        "move_document":        _move_document,
        "noop":                 _noop,
    }
    fn = handlers.get(action)
    if fn is None:
        return _rb(task, "wrong"), f"Unknown action: {action}", False
    return fn(params, state, task)


# ── Individual action handlers ─────────────────────────────────────────────────

def _open_inbox(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    already = state["current_app"] == "email_inbox"
    state["current_app"] = "email_inbox"
    state["selected_email"] = None
    if already:
        return 0.0, "Already in inbox", True
    return _rb(task, "open_inbox"), "Opened email inbox", True


def _search_email(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    sender = params.get("sender", "").strip()
    if not sender:
        return _rb(task, "wrong"), "search_email requires params.sender", False

    state["current_app"] = "email_inbox"
    state["last_search_query"] = sender

    target_id = task.get("target_email_id")
    matched_target = any(
        e["id"] == target_id and sender.lower() in e["sender"].lower()
        for e in state["email_list"]
    )
    if matched_target:
        return _rb(task, "find_email"), f"Searched for '{sender}' — target found", True
    return _rb(task, "wrong") * 0.5, f"Searched for '{sender}' — target not matched", True


def _read_email(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    email_id = params.get("email_id", "").strip()
    email = next((e for e in state["email_list"] if e["id"] == email_id), None)
    if not email:
        return _rb(task, "wrong"), f"Email '{email_id}' not found", False

    state["current_app"] = "email_detail"
    state["selected_email"] = email
    email["read"] = True
    state["read_email_ids"].add(email_id)

    is_target = email_id == task.get("target_email_id")
    if is_target:
        return _rb(task, "read_email"), f"Read target email from {email['sender']}", True
    return _rb(task, "wrong") * 0.5, f"Read non-target email from {email['sender']}", True


def _create_event(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    if not state.get("selected_email"):
        return _rb(task, "wrong"), "No email selected — read an email first", False
    if not state["selected_email"].get("has_meeting_details"):
        return _rb(task, "wrong"), "Selected email has no meeting details", False

    is_target = state["selected_email"]["id"] == task.get("target_email_id")
    new_event = {
        "id": f"cal_new_{state['step_count']}",
        "title": state["selected_email"]["subject"],
        "date": task.get("meeting_date", "2026-03-29"),
        "time": task.get("meeting_time", "15:00"),
        "attendees": [state["selected_email"]["sender"]],
        "location": "Conference Room B",
        "created_from_email": True,
    }
    state["calendar_events"].append(new_event)
    state["current_app"] = "calendar"

    if is_target:
        return _rb(task, "create_event"), "Created calendar event from target email", True
    return _rb(task, "wrong"), "Created event from non-target email", True


def _view_calendar(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    state["current_app"] = "calendar"
    return 0.0, "Switched to calendar view", True


def _view_documents(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    state["current_app"] = "documents"
    return 0.0, "Switched to documents view", True


def _move_document(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    doc_id = params.get("document_id", "").strip()
    folder = params.get("folder", "").strip()

    if not doc_id or not folder:
        return _rb(task, "wrong"), "move_document requires document_id and folder", False
    if folder not in AVAILABLE_FOLDERS:
        return _rb(task, "wrong"), f"Invalid folder '{folder}'", False

    doc = next((d for d in state["documents"] if d["id"] == doc_id), None)
    if not doc:
        return _rb(task, "wrong"), f"Document '{doc_id}' not found", False

    doc["folder"] = folder
    state["document_moves"][doc_id] = folder

    correct_doc    = doc_id == task.get("target_document_id")
    correct_folder = folder == task.get("target_folder")

    if correct_doc and correct_folder:
        return _rb(task, "move_document"), f"Moved '{doc['name']}' → '{folder}'", True
    if correct_doc:
        return _rb(task, "wrong"), f"Correct doc but wrong folder '{folder}'", True
    return _rb(task, "wrong"), f"Wrong document moved", True


def _noop(params: dict, state: dict, task: dict) -> tuple[float, str, bool]:
    return 0.0, "No-op", True
