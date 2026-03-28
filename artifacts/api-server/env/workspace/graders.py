"""Automated graders for workspace tasks. Scores between 0.0 and 1.0."""


def grade_email_retrieval(state: dict, task: dict) -> dict:
    opened_inbox = any(h["app"] == "email_inbox" for h in state["history"])
    searched = (
        state["last_search_query"] is not None
        and task.get("target_email_sender", "").split()[0].lower()
        in state["last_search_query"].lower()
    )
    read_target = task.get("target_email_id", "") in state["read_email_ids"]

    criteria = [
        {"name": "opened_inbox", "passed": opened_inbox, "weight": 0.1},
        {"name": "searched_sender", "passed": searched, "weight": 0.4},
        {"name": "read_target_email", "passed": read_target, "weight": 0.5},
    ]
    score = min(1.0, sum(c["weight"] for c in criteria if c["passed"]))
    return {"score": score, "passed": score >= 0.9, "criteria": criteria}


def grade_meeting_scheduling(state: dict, task: dict) -> dict:
    read_email = task.get("target_email_id", "") in state["read_email_ids"]
    extracted = state["extracted_meeting_details"]
    correct_event = any(
        e.get("created_from_email") and
        e.get("date") == task.get("meeting_date") and
        e.get("time") == task.get("meeting_time")
        for e in state["calendar_events"]
    )
    criteria = [
        {"name": "read_email", "passed": read_email, "weight": 0.15},
        {"name": "extracted_meeting", "passed": extracted, "weight": 0.15},
        {"name": "created_event", "passed": correct_event, "weight": 0.7},
    ]
    score = min(1.0, sum(c["weight"] for c in criteria if c["passed"]))
    return {"score": score, "passed": correct_event, "criteria": criteria}


def grade_document_organization(state: dict, task: dict) -> dict:
    viewed_docs = any(h["app"] == "documents" for h in state["history"])
    moved_correct = (
        task.get("target_document_id") in state["document_moves"]
        and state["document_moves"].get(task.get("target_document_id")) == task.get("target_folder")
    )
    criteria = [
        {"name": "viewed_documents", "passed": viewed_docs, "weight": 0.1},
        {"name": "moved_correct_document", "passed": moved_correct, "weight": 0.9},
    ]
    score = min(1.0, sum(c["weight"] for c in criteria if c["passed"]))
    return {"score": score, "passed": moved_correct, "criteria": criteria}


def grade_task(state: dict, task: dict) -> dict:
    graders = {
        "ws_task_1": grade_email_retrieval,
        "ws_task_2": grade_meeting_scheduling,
        "ws_task_3": grade_document_organization,
    }
    fn = graders.get(task["id"], grade_document_organization)
    return fn(state, task)
