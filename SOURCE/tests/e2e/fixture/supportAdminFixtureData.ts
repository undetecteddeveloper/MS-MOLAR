// User Support System v1 — admin-triage fixture data + override-boundary
// mechanism, reusing task-07's SupportDriver pattern (supportFixtureData.ts).
// Consumed by support-admin-triage.fixture.e2e.test.ts (task-15).
//
// Same documented residual as supportFixtureData.ts: this repo has no MSW/
// mock-injection layer, so wiring listSupportTickets/changeTicketStatusAction/
// addTicketNoteAction fixture data into a real running page is a residual for
// whoever stands up the Playwright harness — the frontend DD's own Mock
// Boundary Decision ("Yes (module boundary)") names the same test-only
// module-boundary override point this file documents.
//
// TicketWithNotes here is task-13's transcribed contract shape
// (support-system-backend-design.md's listSupportTickets return type) — to be
// reconciled against the real exported type from service-role.ts once task-13
// exists (a tsc compile error is the expected, safe failure mode on drift,
// per the frontend DD's own R-F2 note).

import type { TicketIntent, TicketStatus } from "@/lib/support/types";
import type { SupportDriver } from "./supportFixtureData";

export interface FixtureTicketNote {
  id: string;
  noteText: string;
  adminId: string | null;
  createdAt: string;
}

export interface FixtureTicketWithNotes {
  id: string;
  intent: TicketIntent;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  screenshotUrl: string | null;
  status: TicketStatus;
  notifyFailed: boolean;
  createdAt: string;
  firstStatusTransitionAt: string | null;
  notes: FixtureTicketNote[];
}

// Multi-status set, most-recent-first (AC-041 expects created_at desc from
// the real backend — this fixture is already in that order so a driver-level
// "no reorder happened" check can compare directly against array order).
// Ticket A carries notify_failed=true (AC-022/AC-032 collapsed-row flag,
// visible without expanding) and one internal note; B/C exercise the other
// two statuses; D has no notes (empty-state check, AC-027 contrast).
export const FIXTURE_ADMIN_TICKETS: readonly FixtureTicketWithNotes[] = [
  {
    id: "ticket-a-notify-failed",
    intent: "bug",
    message: "The submit button freezes on iPhone Safari.",
    pageUrl: "https://example.com/exams/abc/attempt/xyz",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    screenWidth: 390,
    screenHeight: 844,
    screenshotUrl: "https://fixture.example.com/signed/ticket-a.png",
    status: "in_progress",
    notifyFailed: true,
    createdAt: "2026-08-13T09:00:00.000Z",
    firstStatusTransitionAt: "2026-08-13T09:15:00.000Z",
    notes: [
      {
        id: "note-a-1",
        noteText: "Reproduced on Safari 17 — investigating.",
        adminId: "admin-1",
        createdAt: "2026-08-13T09:20:00.000Z",
      },
    ],
  },
  {
    id: "ticket-b-new",
    intent: "suggestion",
    message: "Would love a dark mode toggle for late-night study sessions.",
    pageUrl: "https://example.com/exams",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    screenWidth: 1920,
    screenHeight: 1080,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-13T08:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
  },
  {
    id: "ticket-c-resolved",
    intent: "question",
    message: "How is the difficulty rating calculated?",
    pageUrl: "https://example.com/exams/def",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    screenWidth: 1440,
    screenHeight: 900,
    screenshotUrl: null,
    status: "resolved",
    notifyFailed: false,
    createdAt: "2026-08-12T14:00:00.000Z",
    firstStatusTransitionAt: "2026-08-12T14:30:00.000Z",
    notes: [
      {
        id: "note-c-1",
        noteText: "Explained via email, closing.",
        adminId: "admin-2",
        createdAt: "2026-08-12T14:30:00.000Z",
      },
    ],
  },
  {
    id: "ticket-d-no-notes",
    intent: "bug",
    message: "Screenshot upload spins forever on slow connections.",
    pageUrl: null,
    userAgent: null,
    screenWidth: null,
    screenHeight: null,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-11T10:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
  },
];

export const FIXTURE_STATUS_CHANGE_SUCCESS = { info: "Status updated." };
export const FIXTURE_NOTE_ADD_SUCCESS = { info: "Note saved." };
export const FIXTURE_STATUS_CHANGE_ERROR = { error: "Couldn't update status. Please try again." };
export const FIXTURE_NOTE_ADD_ERROR = { error: "Couldn't save the note. Please try again." };

/** Structural subset re-exported for task-15's driver script — identical
 *  interface to the student-facing SupportDriver (same Playwright-subset
 *  convention), imported here under its own name for admin-page clarity. */
export type { SupportDriver as SupportAdminDriver };
