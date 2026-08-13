// User Support System v1 — sendSupportNotification / composeSupportNotificationSubject
//   [integration] — filled in from the skeleton (2026-08-13, task-05).
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §sendSupportNotification)
// PRD: docs/prd/support-system-prd.md (v1.2, D10, R16, AC-043, AC-044, AC-045, AC-046,
//   metric 14)
//
// SMTP transport mocked (no live Gmail account/credential in CI); real
// SOURCE/lib/i18n/translate.ts createTranslate()/dictionaries used, NOT mocked —
// a mocked translate function would defeat the point of proving locale-invariance.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sendSupportNotification.ts imports "server-only" (throws outside a Next
// server/react-server bundle) — mirrors submitExam.int.test.ts's precedent.
vi.mock("server-only", () => ({}));

import { createTranslate, getDictionary } from "@/lib/i18n/translate";
import {
  composeSupportNotificationSubject,
  sendSupportNotification,
  type SupportTicketMailPayload,
} from "@/lib/mail/sendSupportNotification";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi as viDict } from "@/lib/i18n/dictionaries/vi";

const sendMailMock = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

const ENV_KEYS = ["SUPPORT_NOTIFY_EMAIL", "SUPPORT_SMTP_USER", "SUPPORT_SMTP_APP_PASSWORD"] as const;

function setGoodEnv() {
  process.env.SUPPORT_NOTIFY_EMAIL = "maintainer@example.com";
  process.env.SUPPORT_SMTP_USER = "bot@example.com";
  process.env.SUPPORT_SMTP_APP_PASSWORD = "app-password";
}

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function fixtureTicket(intent: SupportTicketMailPayload["intent"]): SupportTicketMailPayload {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    intent,
    message: "Nút nộp bài không phản hồi trên iPhone Safari.",
    pageUrl: "https://example.com/exams/abc/attempt/xyz",
    userAgent: "Mozilla/5.0 (iPhone)",
    screenWidth: 390,
    screenHeight: 844,
    hasScreenshot: true,
  };
}

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ messageId: "test" });
  setGoodEnv();
});

afterEach(() => {
  clearEnv();
  vi.restoreAllMocks();
});

describe("Group 1 — [report-ms] subject-prefix contract", () => {
  it("composeSupportNotificationSubject: first 12 chars are the literal prefix for all 3 intents x 2 locales, byte-identical across locales", async () => {
    const intents = ["bug", "suggestion", "question"] as const;
    const locales = ["vi", "en"] as const;

    for (const intent of intents) {
      const prefixes = locales.map((locale) =>
        composeSupportNotificationSubject({
          intent,
          shortRef: "abc12345",
          translate: createTranslate(getDictionary(locale)),
        }).slice(0, 12)
      );
      for (const prefix of prefixes) {
        expect(prefix).toBe("[report-ms] ");
      }
      expect(prefixes[0]).toBe(prefixes[1]);
    }
  });

  it("failure-and-flag path: the subject composed immediately before a thrown SMTP error still carries the identical prefix (AC-046)", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await sendSupportNotification({
      ticket: fixtureTicket("bug"),
      translate: createTranslate(getDictionary("vi")),
    });

    expect(result.ok).toBe(false);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendMailMock.mock.calls[0][0] as { subject: string };
    expect(sentArgs.subject.slice(0, 12)).toBe("[report-ms] ");
  });
});

describe("Group 2 — report-ms token absent from both i18n dictionaries", () => {
  it("neither vi.ts nor en.ts contains 'report-ms' in any key or value", () => {
    const containsToken = (dict: Record<string, string>) =>
      Object.entries(dict).some(([k, v]) => k.includes("report-ms") || v.includes("report-ms"));
    expect(containsToken(en)).toBe(false);
    expect(containsToken(viDict)).toBe(false);
  });
});

describe("Group 3 — sendSupportNotification never throws (D5 backstop)", () => {
  it("a synchronous throw from the mocked transport resolves to { ok: false, error }, never propagates", async () => {
    sendMailMock.mockImplementationOnce(() => {
      throw new Error("sync boom");
    });

    await expect(
      sendSupportNotification({
        ticket: fixtureTicket("suggestion"),
        translate: createTranslate(getDictionary("en")),
      })
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
  });

  it("a rejected transport promise resolves to { ok: false, error }, never rejects", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    await expect(
      sendSupportNotification({
        ticket: fixtureTicket("question"),
        translate: createTranslate(getDictionary("en")),
      })
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
  });

  it("with all 3 SMTP/recipient env vars unset, resolves { ok: false, error } without throwing at call time", async () => {
    clearEnv();

    await expect(
      sendSupportNotification({
        ticket: fixtureTicket("bug"),
        translate: createTranslate(getDictionary("en")),
      })
    ).resolves.toEqual({ ok: false, error: expect.any(String) });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
