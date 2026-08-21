// User Support System v1 (ADR-0012) — Gmail SMTP + App Password via
// nodemailer, gọi DUY NHẤT từ bên trong after()-scheduled callback của
// submitSupportTicket, sau khi INSERT ticket đã thành công (D5). Node-only,
// KHÔNG "use client", KHÔNG export Edge runtime — import "server-only" chặn
// nhầm client import ngay lúc build.
import "server-only";
import nodemailer from "nodemailer";
import type { Translate } from "@/lib/i18n/translate";
import type { TicketIntent } from "@/lib/support/types";

// R16/D10 — token BẮT BUỘC đứng đầu MỌI subject module này compose, kể cả
// nhánh sắp báo lỗi (AC-046). Hằng số module-level, KHÔNG BAO GIỜ đi qua
// vi.ts/en.ts — Gmail filter của maintainer khớp trực tiếp trên byte này.
const SUPPORT_MAIL_SUBJECT_PREFIX = "[report-ms] ";

// Timeout SMTP là hằng số đặt tên, tương đương AbortSignal.timeout(3000) của
// checkSchemaVersion.ts (nodemailer không có hook AbortSignal). Tổng tệ nhất
// 21000ms — không còn áp lực lên ngưỡng abort 20s phía client vì send đã tách
// khỏi request/response bằng after() (xem submitSupportTicket).
const CONNECTION_TIMEOUT_MS = 8000;
const GREETING_TIMEOUT_MS = 5000;
const SOCKET_TIMEOUT_MS = 8000;

const INTENT_LABEL_KEY = {
  bug: "mail.ticketIntent.bug",
  suggestion: "mail.ticketIntent.suggestion",
  question: "mail.ticketIntent.question",
} as const satisfies Record<TicketIntent, string>;

export type SupportTicketMailPayload = {
  id: string;
  intent: TicketIntent;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  hasScreenshot: boolean;
};

/**
 * Luôn bắt đầu bằng literal "[report-ms] " (AC-043), byte-identical 12 ký tự
 * đầu bất kể translate là vi hay en (AC-044) — vì token nằm NGOÀI translate(),
 * chỉ phần nhãn intent phía sau mới đi qua translate.
 */
export function composeSupportNotificationSubject(params: {
  intent: TicketIntent;
  shortRef: string;
  translate: Translate;
}): string {
  const label = params.translate(
    INTENT_LABEL_KEY[params.intent] as Parameters<Translate>[0]
  );
  return `${SUPPORT_MAIL_SUBJECT_PREFIX}${label} #${params.shortRef}`;
}

function buildBody(ticket: SupportTicketMailPayload, shortRef: string): string {
  return [
    `Ticket #${shortRef} (${ticket.intent})`,
    "",
    ticket.message,
    "",
    `URL: ${ticket.pageUrl ?? "(không có)"}`,
    `User-Agent: ${ticket.userAgent ?? "(không có)"}`,
    `Screen: ${ticket.screenWidth ?? "?"}x${ticket.screenHeight ?? "?"}`,
    `Screenshot: ${ticket.hasScreenshot ? "có đính kèm" : "không"}`,
  ].join("\n");
}

/**
 * KHÔNG BAO GIỜ throw/reject ra khỏi hàm này — mọi lỗi nội bộ (auth, timeout,
 * network, env chưa cấu hình) đều bị bắt và trả về { ok: false, error }
 * (ADR-0012: "wrap the entire send in a single try/catch"). Thiếu
 * SUPPORT_SMTP_USER/SUPPORT_SMTP_APP_PASSWORD/SUPPORT_NOTIFY_EMAIL được coi
 * là một lần gửi thất bại BÌNH THƯỜNG, không phải lỗi ném ra — build với env
 * placeholder (CI) không được chết lúc import, mirror
 * checkSchemaVersion.ts's degrade-on-missing-env.
 */
export async function sendSupportNotification(params: {
  ticket: SupportTicketMailPayload;
  translate: Translate;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const shortRef = params.ticket.id.slice(0, 8);
  const recipient = process.env.SUPPORT_NOTIFY_EMAIL;

  try {
    const user = process.env.SUPPORT_SMTP_USER;
    const pass = process.env.SUPPORT_SMTP_APP_PASSWORD;

    const subject = composeSupportNotificationSubject({
      intent: params.ticket.intent,
      shortRef,
      translate: params.translate,
    });

    if (!recipient || !user || !pass) {
      throw new Error(
        "support mail chưa cấu hình đủ (SUPPORT_NOTIFY_EMAIL/SUPPORT_SMTP_USER/SUPPORT_SMTP_APP_PASSWORD)"
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });

    await transporter.sendMail({
      from: user,
      to: recipient,
      subject,
      text: buildBody(params.ticket, shortRef),
    });

    return { ok: true };
  } catch (error) {
    // Không bao giờ log SUPPORT_SMTP_APP_PASSWORD — `error` từ nodemailer
    // không chứa credential, chỉ chứa message/lỗi kết nối.
    console.error("[sendSupportNotification]", params.ticket.id, recipient, error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
