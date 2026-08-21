// User Support System v1 — admin/tickets actions + service-role reads [integration]
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §changeTicketStatusAction, §addTicketNoteAction, §listSupportTickets,
//   §changeSupportTicketStatus)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-021, AC-022 data half, AC-024,
//   AC-027, AC-029 defensive half, AC-030, AC-047)
//
// Group 1 mocks the underlying @supabase/supabase-js client (the boundary
// serviceRoleClient() itself constructs) — this is the one place in the repo
// that needs to observe service-role.ts's OWN call shape, not just mock the
// whole module away. Groups 2-3 mock @/lib/supabase/service-role wholesale,
// mirroring submitExam.int.test.ts's precedent for testing a caller of it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  // Group 2/2b use vi.doMock per-test (their session/mock shape varies test
  // to test); undo those registrations so Group 1/3's plain, unmocked
  // imports of the real service-role.ts module aren't shadowed by a stale
  // partial mock from an earlier test in this file.
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/auth/admin");
  vi.doUnmock("@/lib/supabase/service-role");
  vi.doUnmock("@/lib/mail/sendSupportNotification");
  vi.doUnmock("@/lib/i18n/server");
  vi.doUnmock("next/cache");
});

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: rpcMock, from: fromMock, storage: { from: vi.fn() } })),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("Group 1 — changeSupportTicketStatus: first-status-transition timestamp write-once (AC-047)", () => {
  it("both calls go through .rpc('change_support_ticket_status', ...), never .from().update(); second call's timestamp equals the first's", async () => {
    const { changeSupportTicketStatus } = await import("@/lib/supabase/service-role");

    // First call: row was 'new' -> function stamps a fresh timestamp.
    rpcMock.mockResolvedValueOnce({
      data: [{ status: "in_progress", first_status_transition_at: "2026-08-13T10:00:00.000Z" }],
      error: null,
    });
    const first = await changeSupportTicketStatus("ticket-1", "in_progress");

    // Second call: row already non-'new' -> function returns the SAME timestamp, unchanged.
    rpcMock.mockResolvedValueOnce({
      data: [{ status: "resolved", first_status_transition_at: "2026-08-13T10:00:00.000Z" }],
      error: null,
    });
    const second = await changeSupportTicketStatus("ticket-1", "resolved");

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "change_support_ticket_status", {
      p_ticket_id: "ticket-1",
      p_status: "in_progress",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "change_support_ticket_status", {
      p_ticket_id: "ticket-1",
      p_status: "resolved",
    });
    expect(fromMock).not.toHaveBeenCalled();

    expect("firstStatusTransitionAt" in first && first.firstStatusTransitionAt).not.toBeNull();
    expect("firstStatusTransitionAt" in first && first.firstStatusTransitionAt).toBe(
      "2026-08-13T10:00:00.000Z"
    );
    expect("firstStatusTransitionAt" in second && second.firstStatusTransitionAt).toBe(
      "firstStatusTransitionAt" in first ? first.firstStatusTransitionAt : undefined
    );
  });
});

describe("Group 2 — independent admin re-authorization (AC-021/AC-024), no email on status change (AC-030)", () => {
  async function importAction() {
    vi.resetModules();
    // getTranslate() reads next/headers' cookies(), which throws outside a
    // real request scope (no Next.js server runtime in vitest) — mocked
    // uniformly here since every Group 2/2b test needs it regardless of its
    // own session/service-role mock shape.
    vi.doMock("@/lib/i18n/server", () => ({
      getTranslate: vi.fn(async () => (key: string) => key),
    }));
    // revalidatePath() requires a real Next.js static-generation store on
    // the success path — not present under vitest.
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    return import("@/app/(admin)/admin/tickets/actions");
  }

  it("(a) non-admin session calling changeTicketStatusAction resolves to a refusal; changeSupportTicketStatus never invoked", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "student-1" } } })) },
      })),
    }));
    vi.doMock("@/lib/auth/admin", () => ({ isAdminUserId: vi.fn(() => false) }));
    const changeSupportTicketStatusMock = vi.fn();
    vi.doMock("@/lib/supabase/service-role", () => ({
      changeSupportTicketStatus: changeSupportTicketStatusMock,
      addSupportTicketNote: vi.fn(),
    }));

    const { changeTicketStatusAction } = await importAction();
    const result = await changeTicketStatusAction("ticket-1", "resolved");

    expect(result?.error).toBeTruthy();
    expect(changeSupportTicketStatusMock).not.toHaveBeenCalled();
  });

  it("(b) non-admin session calling addTicketNoteAction resolves to a refusal; addSupportTicketNote never invoked", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "student-1" } } })) },
      })),
    }));
    vi.doMock("@/lib/auth/admin", () => ({ isAdminUserId: vi.fn(() => false) }));
    const addSupportTicketNoteMock = vi.fn();
    vi.doMock("@/lib/supabase/service-role", () => ({
      changeSupportTicketStatus: vi.fn(),
      addSupportTicketNote: addSupportTicketNoteMock,
    }));

    const { addTicketNoteAction } = await importAction();
    const result = await addTicketNoteAction("ticket-1", "a note");

    expect(result?.error).toBeTruthy();
    expect(addSupportTicketNoteMock).not.toHaveBeenCalled();
  });

  it("(c) admin session calling addTicketNoteAction invokes addSupportTicketNote(ticketId, adminId, noteText) with adminId from auth.uid(), never client-supplied", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
      })),
    }));
    vi.doMock("@/lib/auth/admin", () => ({ isAdminUserId: vi.fn((id: string) => id === "admin-1") }));
    const addSupportTicketNoteMock = vi.fn(async () => ({ error: null }));
    vi.doMock("@/lib/supabase/service-role", () => ({
      changeSupportTicketStatus: vi.fn(),
      addSupportTicketNote: addSupportTicketNoteMock,
    }));

    const { addTicketNoteAction } = await importAction();
    await addTicketNoteAction("ticket-1", "a real note");

    expect(addSupportTicketNoteMock).toHaveBeenCalledWith("ticket-1", "admin-1", "a real note");
  });

  it("(d) admin session successfully changing status never calls sendSupportNotification or any mail-sending function (AC-030)", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
      })),
    }));
    vi.doMock("@/lib/auth/admin", () => ({ isAdminUserId: vi.fn((id: string) => id === "admin-1") }));
    const changeSupportTicketStatusMock = vi.fn(async () => ({
      status: "resolved",
      firstStatusTransitionAt: "2026-08-13T10:00:00.000Z",
    }));
    vi.doMock("@/lib/supabase/service-role", () => ({
      changeSupportTicketStatus: changeSupportTicketStatusMock,
      addSupportTicketNote: vi.fn(),
    }));
    const sendSupportNotificationMock = vi.fn();
    vi.doMock("@/lib/mail/sendSupportNotification", () => ({
      sendSupportNotification: sendSupportNotificationMock,
    }));

    const { changeTicketStatusAction } = await importAction();
    await changeTicketStatusAction("ticket-1", "resolved");

    expect(changeSupportTicketStatusMock).toHaveBeenCalledTimes(1);
    expect(sendSupportNotificationMock).not.toHaveBeenCalled();
  });
});

describe("Group 2b — changeTicketStatusAction rejects an out-of-range status before calling the service layer (AC-029 defensive half)", () => {
  it("a nextStatus outside {new,in_progress,resolved} never reaches changeSupportTicketStatus", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
      })),
    }));
    vi.doMock("@/lib/auth/admin", () => ({ isAdminUserId: vi.fn((id: string) => id === "admin-1") }));
    const changeSupportTicketStatusMock = vi.fn();
    vi.doMock("@/lib/supabase/service-role", () => ({
      changeSupportTicketStatus: changeSupportTicketStatusMock,
      addSupportTicketNote: vi.fn(),
    }));
    vi.doMock("@/lib/i18n/server", () => ({
      getTranslate: vi.fn(async () => (key: string) => key),
    }));

    const { changeTicketStatusAction } = await import("@/app/(admin)/admin/tickets/actions");
    // @ts-expect-error deliberately out-of-range at the call boundary, mirroring a bypassed client
    const result = await changeTicketStatusAction("ticket-1", "archived");

    expect(result?.error).toBeTruthy();
    expect(changeSupportTicketStatusMock).not.toHaveBeenCalled();
  });
});

describe("Group 3 — listSupportTickets: batched read includes notify_failed (AC-022, data half)", () => {
  it("(a)-(b) exactly one support_tickets select + one support_ticket_notes select; notify_failed present as boolean even when false; (c) notes grouped by ticket_id in JS", async () => {
    const { listSupportTickets } = await import("@/lib/supabase/service-role");

    const ticketRows = [
      {
        id: "t1",
        intent: "bug",
        message: "m1",
        page_url: null,
        user_agent: null,
        screen_width: null,
        screen_height: null,
        screenshot_path: null,
        status: "new",
        notify_failed: false,
        created_at: "2026-08-13T10:00:00.000Z",
        first_status_transition_at: null,
      },
      {
        id: "t2",
        intent: "question",
        message: "m2",
        page_url: null,
        user_agent: null,
        screen_width: null,
        screen_height: null,
        screenshot_path: null,
        status: "in_progress",
        notify_failed: true,
        created_at: "2026-08-13T09:00:00.000Z",
        first_status_transition_at: "2026-08-13T09:30:00.000Z",
      },
      {
        id: "t3",
        intent: "suggestion",
        message: "m3",
        page_url: null,
        user_agent: null,
        screen_width: null,
        screen_height: null,
        screenshot_path: null,
        status: "resolved",
        notify_failed: false,
        created_at: "2026-08-13T08:00:00.000Z",
        first_status_transition_at: "2026-08-13T08:30:00.000Z",
      },
    ];
    const noteRows = [
      { id: "n1", ticket_id: "t2", note_text: "note for t2", admin_id: "admin-1", created_at: "2026-08-13T09:35:00.000Z" },
    ];

    let callIndex = 0;
    fromMock.mockImplementation((table: string) => {
      callIndex += 1;
      if (table === "support_tickets") {
        return {
          select: () => ({
            order: async () => ({ data: ticketRows, error: null }),
          }),
        };
      }
      if (table === "support_ticket_notes") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: noteRows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    });

    const result = await listSupportTickets();

    const ticketsCalls = fromMock.mock.calls.filter(([t]) => t === "support_tickets").length;
    const notesCalls = fromMock.mock.calls.filter(([t]) => t === "support_ticket_notes").length;
    expect(ticketsCalls).toBe(1);
    expect(notesCalls).toBe(1);
    void callIndex;

    expect(result).toHaveLength(3);
    for (const ticket of result) {
      expect(typeof ticket.notifyFailed).toBe("boolean");
    }
    expect(result.find((t) => t.id === "t1")?.notifyFailed).toBe(false);
    expect(result.find((t) => t.id === "t2")?.notifyFailed).toBe(true);

    expect(result.find((t) => t.id === "t2")?.notes).toEqual([
      { id: "n1", noteText: "note for t2", adminId: "admin-1", createdAt: "2026-08-13T09:35:00.000Z" },
    ]);
    expect(result.find((t) => t.id === "t1")?.notes).toEqual([]);
    expect(result.find((t) => t.id === "t3")?.notes).toEqual([]);
  });
});
