/**
 * Seed data for the Workspace Assistant environment.
 * All data is deterministic and reproducible.
 */

export interface Email {
  id: string;
  sender: string;
  sender_email: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
  has_meeting_details: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  attendees: string[];
  location: string;
  created_from_email: boolean;
}

export interface Document {
  id: string;
  name: string;
  folder: string;
  type: string;
  size: string;
  modified: string;
}

export const SEED_EMAILS: Email[] = [
  {
    id: "email_001",
    sender: "Alex Johnson",
    sender_email: "alex.johnson@company.com",
    subject: "Team Meeting Tomorrow at 3pm",
    body: `Hi,\n\nI wanted to confirm our team meeting scheduled for tomorrow (Thursday) at 3:00 PM in Conference Room B.\n\nAgenda:\n- Q3 progress review\n- Project roadmap discussion\n- Team updates\n\nPlease bring your status reports.\n\nBest,\nAlex`,
    timestamp: "2026-03-28T09:15:00Z",
    read: false,
    has_meeting_details: true,
  },
  {
    id: "email_002",
    sender: "Sarah Chen",
    sender_email: "sarah.chen@company.com",
    subject: "Project Proposal Review",
    body: `Hello,\n\nI've attached the revised project_proposal.pdf for your review. Please move it to the Projects folder when you get a chance.\n\nLet me know if you have any feedback.\n\nThanks,\nSarah`,
    timestamp: "2026-03-28T08:30:00Z",
    read: false,
    has_meeting_details: false,
  },
  {
    id: "email_003",
    sender: "HR Department",
    sender_email: "hr@company.com",
    subject: "Updated Leave Policy Document",
    body: `Dear Team,\n\nPlease find the updated leave_policy_2026.pdf attached. This document should be filed in the HR folder.\n\nRegards,\nHR Team`,
    timestamp: "2026-03-27T14:00:00Z",
    read: true,
    has_meeting_details: false,
  },
  {
    id: "email_004",
    sender: "Mike Torres",
    sender_email: "mike.torres@company.com",
    subject: "Sync on Budget Planning - Friday 10am",
    body: `Hey,\n\nCan we sync on budget planning this Friday at 10:00 AM? I'll set up the call in the main boardroom.\n\nLet me add it to the calendar.\n\nThanks,\nMike`,
    timestamp: "2026-03-27T11:00:00Z",
    read: false,
    has_meeting_details: true,
  },
  {
    id: "email_005",
    sender: "IT Support",
    sender_email: "it@company.com",
    subject: "System Maintenance Window",
    body: `Team,\n\nWe will be performing scheduled system maintenance this Sunday from 2am to 6am.\n\nPlease save your work before leaving Friday.\n\nIT Support`,
    timestamp: "2026-03-26T16:00:00Z",
    read: true,
    has_meeting_details: false,
  },
];

export const SEED_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "cal_001",
    title: "Daily Standup",
    date: "2026-03-29",
    time: "09:00",
    attendees: ["Alex Johnson", "Sarah Chen", "Mike Torres"],
    location: "Zoom",
    created_from_email: false,
  },
  {
    id: "cal_002",
    title: "Product Demo",
    date: "2026-03-30",
    time: "14:00",
    attendees: ["All Team"],
    location: "Main Boardroom",
    created_from_email: false,
  },
];

export const SEED_DOCUMENTS: Document[] = [
  {
    id: "doc_001",
    name: "project_proposal.pdf",
    folder: "Inbox",
    type: "PDF",
    size: "2.4 MB",
    modified: "2026-03-28",
  },
  {
    id: "doc_002",
    name: "leave_policy_2026.pdf",
    folder: "Inbox",
    type: "PDF",
    size: "1.1 MB",
    modified: "2026-03-27",
  },
  {
    id: "doc_003",
    name: "q1_report.xlsx",
    folder: "Finance",
    type: "Spreadsheet",
    size: "3.8 MB",
    modified: "2026-03-25",
  },
  {
    id: "doc_004",
    name: "onboarding_checklist.docx",
    folder: "HR",
    type: "Document",
    size: "0.5 MB",
    modified: "2026-03-20",
  },
  {
    id: "doc_005",
    name: "architecture_diagram.png",
    folder: "Engineering",
    type: "Image",
    size: "4.2 MB",
    modified: "2026-03-22",
  },
];

export const AVAILABLE_FOLDERS = ["Projects", "HR", "Finance", "Engineering", "Archive", "Inbox"];
