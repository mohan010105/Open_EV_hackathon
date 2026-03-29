"""
Seed data and configuration for the Workspace Assistant environment.

Difficulty levels control how many items appear per episode:
  easy   →  3 emails,  3 documents  (minimal distractors)
  medium →  5 emails,  5 documents  (moderate complexity)
  hard   →  8 emails,  8 documents  (many distractors)
"""

# ── Full email pool (8 items) ──────────────────────────────────────────────────
ALL_EMAILS = [
    {
        "id": "email_001",
        "sender": "Alex Johnson",
        "sender_email": "alex.johnson@company.com",
        "subject": "Team Meeting Tomorrow at 3pm",
        "body": (
            "Hi,\n\nI wanted to confirm our team meeting scheduled for tomorrow (Thursday) "
            "at 3:00 PM in Conference Room B.\n\n"
            "Agenda:\n- Q3 progress review\n- Project roadmap\n- Team updates\n\n"
            "Please bring your status reports.\n\nBest,\nAlex"
        ),
        "timestamp": "2026-03-28T09:15:00Z",
        "read": False,
        "has_meeting_details": True,
    },
    {
        "id": "email_002",
        "sender": "Sarah Chen",
        "sender_email": "sarah.chen@company.com",
        "subject": "Project Proposal Review",
        "body": (
            "Hello,\n\nI've attached project_proposal.pdf for your review. "
            "Please move it to the Projects folder.\n\nThanks,\nSarah"
        ),
        "timestamp": "2026-03-28T08:30:00Z",
        "read": False,
        "has_meeting_details": False,
    },
    {
        "id": "email_003",
        "sender": "HR Department",
        "sender_email": "hr@company.com",
        "subject": "Updated Leave Policy Document",
        "body": (
            "Dear Team,\n\nPlease find the updated leave_policy_2026.pdf attached. "
            "File it in the HR folder.\n\nRegards,\nHR Team"
        ),
        "timestamp": "2026-03-27T14:00:00Z",
        "read": True,
        "has_meeting_details": False,
    },
    {
        "id": "email_004",
        "sender": "Mike Torres",
        "sender_email": "mike.torres@company.com",
        "subject": "Budget Planning Sync — Friday 10am",
        "body": "Hey,\n\nCan we sync on budget planning Friday at 10am?\n\nThanks,\nMike",
        "timestamp": "2026-03-27T11:00:00Z",
        "read": False,
        "has_meeting_details": True,
    },
    {
        "id": "email_005",
        "sender": "IT Support",
        "sender_email": "it@company.com",
        "subject": "System Maintenance Window",
        "body": "Team,\n\nScheduled maintenance Sunday 2am–6am. Save your work.\n\nIT",
        "timestamp": "2026-03-26T16:00:00Z",
        "read": True,
        "has_meeting_details": False,
    },
    # ── Hard-mode distractors ──────────────────────────────────────────────
    {
        "id": "email_006",
        "sender": "Newsletter Bot",
        "sender_email": "noreply@marketing.com",
        "subject": "Your Weekly Digest",
        "body": "Here's what happened in tech this week...",
        "timestamp": "2026-03-26T08:00:00Z",
        "read": False,
        "has_meeting_details": False,
    },
    {
        "id": "email_007",
        "sender": "Priya Sharma",
        "sender_email": "priya.sharma@company.com",
        "subject": "Design Review — Wednesday 2pm",
        "body": "Hi,\n\nDesign review is Wednesday at 2pm in Room A.\n\nPriya",
        "timestamp": "2026-03-25T17:30:00Z",
        "read": False,
        "has_meeting_details": True,
    },
    {
        "id": "email_008",
        "sender": "Finance Alerts",
        "sender_email": "alerts@finance.com",
        "subject": "Invoice #4821 — Action Required",
        "body": "Please approve invoice #4821 by end of week.",
        "timestamp": "2026-03-25T11:00:00Z",
        "read": False,
        "has_meeting_details": False,
    },
]

# ── Full document pool (8 items) ───────────────────────────────────────────────
ALL_DOCUMENTS = [
    {"id": "doc_001", "name": "project_proposal.pdf",   "folder": "Inbox",       "type": "PDF",         "size": "2.4 MB"},
    {"id": "doc_002", "name": "leave_policy_2026.pdf",  "folder": "Inbox",       "type": "PDF",         "size": "1.1 MB"},
    {"id": "doc_003", "name": "q1_report.xlsx",          "folder": "Finance",     "type": "Spreadsheet", "size": "3.8 MB"},
    {"id": "doc_004", "name": "onboarding.docx",         "folder": "HR",          "type": "Document",    "size": "0.5 MB"},
    {"id": "doc_005", "name": "architecture.png",        "folder": "Engineering", "type": "Image",       "size": "4.2 MB"},
    # ── Hard-mode distractors ──────────────────────────────────────────────
    {"id": "doc_006", "name": "meeting_notes_q1.docx",   "folder": "Inbox",       "type": "Document",    "size": "0.3 MB"},
    {"id": "doc_007", "name": "brand_guidelines.pdf",    "folder": "Inbox",       "type": "PDF",         "size": "6.1 MB"},
    {"id": "doc_008", "name": "security_policy.pdf",     "folder": "Inbox",       "type": "PDF",         "size": "1.8 MB"},
]

# ── Calendar seed ──────────────────────────────────────────────────────────────
ALL_CALENDAR_EVENTS = [
    {
        "id": "cal_001",
        "title": "Daily Standup",
        "date": "2026-03-29",
        "time": "09:00",
        "attendees": ["Alex Johnson", "Sarah Chen", "Mike Torres"],
        "location": "Zoom",
        "created_from_email": False,
    },
    {
        "id": "cal_002",
        "title": "Product Demo",
        "date": "2026-03-30",
        "time": "14:00",
        "attendees": ["All Team"],
        "location": "Main Boardroom",
        "created_from_email": False,
    },
    # Hard-mode extras
    {
        "id": "cal_003",
        "title": "1:1 with Manager",
        "date": "2026-03-31",
        "time": "10:00",
        "attendees": ["Manager"],
        "location": "Office",
        "created_from_email": False,
    },
]

AVAILABLE_FOLDERS = ["Projects", "HR", "Finance", "Engineering", "Archive", "Inbox"]

# ── Difficulty bands ───────────────────────────────────────────────────────────
DIFFICULTY_CONFIG: dict[str, dict] = {
    "easy": {
        "email_count":    3,
        "document_count": 3,
        "calendar_count": 1,
        "label":          "Easy",
    },
    "medium": {
        "email_count":    5,
        "document_count": 5,
        "calendar_count": 2,
        "label":          "Medium",
    },
    "hard": {
        "email_count":    8,
        "document_count": 8,
        "calendar_count": 3,
        "label":          "Hard",
    },
}

# ── Per-app permitted actions ─────────────────────────────────────────────────
APP_ACTIONS: dict[str, list[str]] = {
    "email_inbox": [
        "open_email_inbox",
        "search_email",
        "read_email",
        "view_calendar",
        "view_documents",
        "noop",
    ],
    "email_detail": [
        "open_email_inbox",
        "extract_meeting_details",
        "create_calendar_event",
        "view_calendar",
        "view_documents",
        "noop",
    ],
    "calendar": [
        "view_calendar",
        "create_calendar_event",
        "open_email_inbox",
        "view_documents",
        "noop",
    ],
    "documents": [
        "view_documents",
        "move_document",
        "open_email_inbox",
        "view_calendar",
        "noop",
    ],
    "task_manager": [
        "open_email_inbox",
        "view_calendar",
        "view_documents",
        "noop",
    ],
}

# Convenience aliases kept for backwards compatibility
SEED_EMAILS          = ALL_EMAILS[:5]
SEED_CALENDAR_EVENTS = ALL_CALENDAR_EVENTS[:2]
SEED_DOCUMENTS       = ALL_DOCUMENTS[:5]
