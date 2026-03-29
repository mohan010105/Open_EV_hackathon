"""
General-purpose utility helpers for the Workspace Assistant environment.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)


def now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def truncate(text: str, max_chars: int = 200, suffix: str = "…") -> str:
    """Truncate *text* to *max_chars* characters, appending *suffix* if cut."""
    if len(text) <= max_chars:
        return text
    return text[: max_chars - len(suffix)] + suffix


def safe_json(obj: Any, fallback: str = "{}") -> str:
    """
    Serialise *obj* to a JSON string, handling non-serialisable types.

    Sets (e.g. read_email_ids) are converted to sorted lists.
    """
    def default(o: Any) -> Any:
        if isinstance(o, set):
            return sorted(o)
        return str(o)

    try:
        return json.dumps(obj, default=default, ensure_ascii=False)
    except Exception as exc:
        log.warning("safe_json serialisation failed: %s", exc)
        return fallback


def format_obs_for_log(obs: dict) -> str:
    """
    Produce a compact, human-readable one-liner from an observation dict.
    Suitable for log lines and replay previews.
    """
    emails  = len(obs.get("email_list", []))
    cal     = len(obs.get("calendar_events", []))
    docs    = len(obs.get("documents", []))
    app     = obs.get("current_app", "?")
    task    = truncate(obs.get("current_task", ""), 60)
    step    = obs.get("step_count", 0)
    reward  = obs.get("total_reward", 0.0)
    return (
        f"[step={step} app={app} emails={emails} cal={cal} docs={docs} "
        f"reward={reward:.3f}] task={task!r}"
    )


def normalize_action_name(raw: str) -> tuple[str, dict]:
    """
    Accept action strings in several common formats and return
    a canonical (action_name, params) pair.

    Examples accepted
    -----------------
    "open_email_inbox()"
    "search_email(sender='Alex')"
    "move_document(document_id='doc_001', folder='Projects')"
    "noop"
    """
    raw = raw.strip().rstrip(")")
    if "(" not in raw:
        return raw, {}

    name, rest = raw.split("(", 1)
    params: dict[str, str] = {}
    for part in rest.split(","):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip()] = v.strip().strip("'\"")
    return name.strip(), params


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamp *value* to [*lo*, *hi*]."""
    return max(lo, min(hi, value))
