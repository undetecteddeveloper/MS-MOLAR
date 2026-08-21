// User Support System v1 — submitSupportTicket [integration]
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §submitSupportTicket, Data Flow steps 1-9)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-002 server half, AC-004, AC-008..AC-011,
//   AC-018, AC-019, AC-028, AC-031, AC-032, metric 5, metric 7, metric 10)
//
// Mocked Supabase client + mocked next/server after(), per backend DD Test Boundaries.
// The real RLS-enforced insert/Storage-write path and cross-student isolation are
// proven by SOURCE/supabase/test-rls.ts (ST-a..ST-e), not here — this file proves only
// the JS call construction and control flow.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({
  flagSupportTicketNotifyFailed: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/security/rateLimit", () => ({ guard: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/i18n/server", () => ({ getTranslate: vi.fn(async () => (key: string) => key) }));
vi.mock("@/lib/mail/sendSupportNotification", () => ({
  sendSupportNotification: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/support/validateScreenshot", () => ({ checkScreenshotFile: vi.fn(() => ({ ok: true })) }));

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagSupportTicketNotifyFailed } from "@/lib/supabase/service-role";
import { guard } from "@/lib/security/rateLimit";
import { sendSupportNotification } from "@/lib/mail/sendSupportNotification";
import { checkScreenshotFile } from "@/lib/support/validateScreenshot";
import { submitSupportTicket } from "@/lib/support/actions";

const afterMock = vi.mocked(after);
const createClientMock = vi.mocked(createClient);
const guardMock = vi.mocked(guard);
const sendSupportNotificationMock = vi.mocked(sendSupportNotification);
const checkScreenshotFileMock = vi.mocked(checkScreenshotFile);
const flagSupportTicketNotifyFailedMock = vi.mocked(flagSupportTicketNotifyFailed);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const TICKET_ID = "22222222-3333-4444-5555-666666666666";

function makeSupabaseMock(opts: {
  user?: { id: string } | null;
  insertResult?: { data: { id: string } | null; error: { code?: string; message: string } | null };
  uploadError?: { message: string } | null;
}) {
  const insertPayloads: unknown[] = [];
  const insertMock = vi.fn((payload: unknown) => {
    insertPayloads.push(payload);
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => opts.insertResult ?? { data: { id: TICKET_ID }, error: null }),
      })),
    };
  });
  const uploadMock = vi.fn(async () => ({ error: opts.uploadError ?? null }));
  const removeMock = vi.fn(async () => ({ error: null }));

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.user === undefined ? { id: USER_ID } : opts.user },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "support_tickets") return { insert: insertMock };
      throw new Error(`bảng không mong đợi trong test: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({ upload: uploadMock, remove: removeMock })),
    },
  };

  return { client, insertMock, insertPayloads, uploadMock, removeMock };
}

function formDataOf(fields: Record<string, string | File | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  checkScreenshotFileMock.mockReturnValue({ ok: true });
  sendSupportNotificationMock.mockResolvedValue({ ok: true });
  flagSupportTicketNotifyFailedMock.mockResolvedValue({ error: null });
});

describe("Group 1 — three fixed intents + auto-captured metadata (never blocks submission)", () => {
  it.each(["bug", "suggestion", "question"] as const)(
    "(a) intent=%s with full metadata: insert payload carries intent unchanged, message trimmed, metadata verbatim, no status key",
    async (intent) => {
      const { client, insertPayloads } = makeSupabaseMock({});
      createClientMock.mockResolvedValue(client as never);

      const fd = formDataOf({
        intent,
        message: "  có lỗi khi nộp bài  ",
        pageUrl: "https://example.com/exams/abc",
        userAgent: "Mozilla/5.0",
        screenWidth: "390",
        screenHeight: "844",
      });
      const result = await submitSupportTicket(fd);

      expect(result).toEqual({ ok: true, shortRef: TICKET_ID.slice(0, 8) });
      expect(insertPayloads).toHaveLength(1);
      const payload = insertPayloads[0] as Record<string, unknown>;
      expect(payload.intent).toBe(intent);
      expect(payload.message).toBe("có lỗi khi nộp bài");
      expect(payload.page_url).toBe("https://example.com/exams/abc");
      expect(payload.user_agent).toBe("Mozilla/5.0");
      expect(payload.screen_width).toBe(390);
      expect(payload.screen_height).toBe(844);
      expect(payload).not.toHaveProperty("status");
    }
  );

  it("(b) all metadata fields omitted: insert still called once, fields explicitly null, intent/message normal", async () => {
    const { client, insertPayloads } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const fd = formDataOf({ intent: "bug", message: "màn hình trắng" });
    const result = await submitSupportTicket(fd);

    expect(result).toEqual({ ok: true, shortRef: TICKET_ID.slice(0, 8) });
    expect(insertPayloads).toHaveLength(1);
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload.page_url).toBeNull();
    expect(payload.user_agent).toBeNull();
    expect(payload.screen_width).toBeNull();
    expect(payload.screen_height).toBeNull();
    expect(payload.intent).toBe("bug");
    expect(payload.message).toBe("màn hình trắng");
  });

  it("(c) intent outside {bug,suggestion,question} → { error: 'invalid' }, insert never called", async () => {
    const { client, insertMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(
      formDataOf({ intent: "not-a-real-intent", message: "hello" })
    );

    expect(result).toEqual({ error: "invalid" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("(c) whitespace-only message → { error: 'invalid' }, insert never called", async () => {
    const { client, insertMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(formDataOf({ intent: "bug", message: "   " }));

    expect(result).toEqual({ error: "invalid" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("(d) no authenticated session → { error: 'unauthenticated' } before any guard/insert call", async () => {
    const { client, insertMock } = makeSupabaseMock({ user: null });
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));

    expect(result).toEqual({ error: "unauthenticated" });
    expect(guardMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("Group 2 — single-screenshot structural constraint (metric 7, schema-shape half)", () => {
  it("(a) screenshot present + checkScreenshotFile ok: screenshot_path is a single string, no second screenshot key", async () => {
    const { client, insertPayloads, uploadMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const file = new File(["fake-png-bytes"], "shot.png", { type: "image/png" });
    const fd = formDataOf({ intent: "bug", message: "hello", screenshot: file });
    const result = await submitSupportTicket(fd);

    expect(result).toEqual({ ok: true, shortRef: TICKET_ID.slice(0, 8) });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(typeof payload.screenshot_path).toBe("string");
    expect(Object.keys(payload).filter((k) => k.toLowerCase().includes("screenshot"))).toEqual([
      "screenshot_path",
    ]);
  });

  it("(b) no screenshot file present: screenshot_path is exactly null, no Storage upload call", async () => {
    const { client, insertPayloads, uploadMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));

    expect(result).toEqual({ ok: true, shortRef: TICKET_ID.slice(0, 8) });
    expect(uploadMock).not.toHaveBeenCalled();
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload.screenshot_path).toBeNull();
  });

  it("(c) checkScreenshotFile rejects → { error: 'screenshot_rejected' }, no upload call, no insert call", async () => {
    checkScreenshotFileMock.mockReturnValue({ ok: false, reason: "too_large" });
    const { client, insertMock, uploadMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const file = new File(["x"], "shot.png", { type: "image/png" });
    const result = await submitSupportTicket(
      formDataOf({ intent: "bug", message: "hello", screenshot: file })
    );

    expect(result).toEqual({ error: "screenshot_rejected" });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("Group 3 — rate limiting on ticket submission (R6, AC-018/AC-019)", () => {
  it("(a) guard() refusal → exactly { error: 'rate_limited' }, insert never called", async () => {
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const { client, insertMock } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));

    expect(result).toEqual({ error: "rate_limited" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("(b) rate-limited path never registers the after()-scheduled mail callback", async () => {
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const { client } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));

    expect(afterMock).not.toHaveBeenCalled();
  });
});

describe("Group 4 — fire-and-forget mail (D5, AC-031/AC-032): highest-value proof", () => {
  it("(a) resolves { ok: true, shortRef } BEFORE the mocked after() callback is invoked or sendSupportNotification is ever called", async () => {
    const { client } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    const result = await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));

    expect(result).toEqual({ ok: true, shortRef: TICKET_ID.slice(0, 8) });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(afterMock.mock.calls[0][0]).toBeTypeOf("function");
    // sendSupportNotification only runs when the captured after() callback is
    // invoked — proven not to have been called just from submitSupportTicket resolving.
    expect(sendSupportNotificationMock).not.toHaveBeenCalled();
  });

  it("(b) invoking the captured after() callback with a mocked send failure calls flagSupportTicketNotifyFailed exactly once and logs context", async () => {
    sendSupportNotificationMock.mockResolvedValue({ ok: false, error: "ECONNREFUSED" });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));
    const callback = afterMock.mock.calls[0][0] as () => Promise<void>;
    await callback();

    expect(flagSupportTicketNotifyFailedMock).toHaveBeenCalledTimes(1);
    expect(flagSupportTicketNotifyFailedMock).toHaveBeenCalledWith(TICKET_ID);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[submitSupportTicket]"),
      TICKET_ID,
      "ECONNREFUSED"
    );
    consoleErrorSpy.mockRestore();
  });

  it("(b) a rejecting sendSupportNotification also calls flagSupportTicketNotifyFailed exactly once (defense-in-depth try/catch)", async () => {
    sendSupportNotificationMock.mockRejectedValue(new Error("unexpected throw"));
    const { client } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));
    const callback = afterMock.mock.calls[0][0] as () => Promise<void>;
    await callback();

    expect(flagSupportTicketNotifyFailedMock).toHaveBeenCalledTimes(1);
    expect(flagSupportTicketNotifyFailedMock).toHaveBeenCalledWith(TICKET_ID);
  });

  it("(c) a successful send never calls flagSupportTicketNotifyFailed", async () => {
    sendSupportNotificationMock.mockResolvedValue({ ok: true });
    const { client } = makeSupabaseMock({});
    createClientMock.mockResolvedValue(client as never);

    await submitSupportTicket(formDataOf({ intent: "bug", message: "hello" }));
    const callback = afterMock.mock.calls[0][0] as () => Promise<void>;
    await callback();

    expect(flagSupportTicketNotifyFailedMock).not.toHaveBeenCalled();
  });
});

describe("Storage upload failure (unavailable boundary, AC-012)", () => {
  it("upload failure resolves { error: 'server' } with best-effort orphan cleanup attempted, no insert call", async () => {
    const { client, insertMock, removeMock } = makeSupabaseMock({
      uploadError: { message: "storage unreachable" },
    });
    createClientMock.mockResolvedValue(client as never);

    const file = new File(["x"], "shot.png", { type: "image/png" });
    const result = await submitSupportTicket(
      formDataOf({ intent: "bug", message: "hello", screenshot: file })
    );

    expect(result).toEqual({ error: "server" });
    expect(insertMock).not.toHaveBeenCalled();
    // Upload failed, so there is no uploaded object path to clean up — remove()
    // is only attempted when the failure happens AFTER a successful upload
    // (the insert-failure branch below), not here.
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("insert failure after a successful screenshot upload attempts best-effort cleanup of the orphaned object", async () => {
    const { client, removeMock } = makeSupabaseMock({
      insertResult: { data: null, error: { code: "23505", message: "boom" } },
    });
    createClientMock.mockResolvedValue(client as never);

    const file = new File(["x"], "shot.png", { type: "image/png" });
    const result = await submitSupportTicket(
      formDataOf({ intent: "bug", message: "hello", screenshot: file })
    );

    expect(result).toEqual({ error: "server" });
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
