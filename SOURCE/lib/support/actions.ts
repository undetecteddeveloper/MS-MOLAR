// User Support System v1 (PRD support-system-prd.md v1.2, ADR-0012, Design Doc
// support-system-backend-design.md v1.2 §Data Contracts/Data Flow) —
// submitSupportTicket: Server Action duy nhất mà widget gọi để tạo ticket.
"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagSupportTicketNotifyFailed } from "@/lib/supabase/service-role";
import { guard } from "@/lib/security/rateLimit";
import { getTranslate } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { LIMITS } from "@/lib/ugc/limits";
import { checkScreenshotFile } from "@/lib/support/validateScreenshot";
import type { SubmitTicketResult, TicketIntent } from "@/lib/support/types";
import { sendSupportNotification } from "@/lib/mail/sendSupportNotification";

const SCREENSHOTS_BUCKET = "support-screenshots";
const INTENTS: readonly TicketIntent[] = ["bug", "suggestion", "question"];

// Chỉ 3 loại LIMITS.ALLOWED_SCREENSHOT_MIME cho phép — KHÔNG dùng EXT_BY_MIME
// của lib/ugc (nó có thêm application/pdf, không áp dụng cho screenshot).
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function stringOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Cố ý KHÔNG mirror `requireUser()`'s redirect behavior (features/authoring/actions.ts) —
 * widget mount ở 5 route group + trang chủ, không có một đích redirect tự
 * nhiên nào, và nó luôn được gọi từ một dialog trong trang mà state của dialog
 * (message đã gõ, intent đã chọn, ảnh đã đính) sẽ mất sạch nếu redirect() cả
 * trang. Client đã tự guard user!=null (UI-D1) nên nhánh này gần như dead-code
 * defense-in-depth, giống cách requireUser() tự nó cũng vậy cho reportExam.
 */
export async function submitSupportTicket(formData: FormData): Promise<SubmitTicketResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const rl = await guard("submitTicket", user.id);
  if (!rl.ok) return { error: "rate_limited" };

  const rawIntent = formData.get("intent");
  const intent = typeof rawIntent === "string" ? rawIntent : "";
  if (!INTENTS.includes(intent as TicketIntent)) return { error: "invalid" };

  const rawMessage = formData.get("message");
  const trimmedMessage = typeof rawMessage === "string" ? rawMessage.trim() : "";
  if (trimmedMessage.length === 0) return { error: "invalid" };
  // Cắt ngầm, mirror reportExam — không báo lỗi cho phần vượt giới hạn.
  const message = trimmedMessage.slice(0, LIMITS.MAX_SUPPORT_MESSAGE);

  const pageUrl = stringOrNull(formData.get("pageUrl"));
  const userAgent = stringOrNull(formData.get("userAgent"));
  const screenWidth = intOrNull(formData.get("screenWidth"));
  const screenHeight = intOrNull(formData.get("screenHeight"));

  let screenshotPath: string | null = null;
  const screenshotFile = formData.get("screenshot");
  if (screenshotFile instanceof File && screenshotFile.size > 0) {
    const check = checkScreenshotFile({ type: screenshotFile.type, size: screenshotFile.size });
    if (!check.ok) return { error: "screenshot_rejected" };

    const ext = EXT_BY_MIME[screenshotFile.type] ?? "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, screenshotFile, { contentType: screenshotFile.type });
    if (uploadError) {
      console.error("[submitSupportTicket] upload", uploadError.message);
      return { error: "server" };
    }
    screenshotPath = path;
  }

  const { data: ticket, error: insertError } = await supabase
    .from("support_tickets")
    .insert({
      intent,
      message,
      page_url: pageUrl,
      user_agent: userAgent,
      screen_width: screenWidth,
      screen_height: screenHeight,
      screenshot_path: screenshotPath,
    })
    .select("id")
    .single();

  if (insertError || !ticket) {
    // Best-effort: object vừa upload đã mồ côi nếu insert hỏng — dọn nhưng
    // KHÔNG chặn response bằng kết quả dọn (mirror deleteExam's storage cleanup).
    if (screenshotPath) {
      const { error: rmError } = await supabase.storage
        .from(SCREENSHOTS_BUCKET)
        .remove([screenshotPath]);
      if (rmError) {
        console.error("[submitSupportTicket] cleanup ảnh mồ côi", rmError.message);
      }
    }
    console.error("[submitSupportTicket]", insertError?.code, insertError?.message);
    return { error: "server" };
  }

  const ticketId = ticket.id as string;

  // D5/I003 (v1.1) — after() lên lịch gửi mail chạy SAU KHI response đã trả
  // cho client, nên bước 8 (return) không bao giờ chờ bước 9 (gửi mail) dù
  // chỉ một mili giây. Phải ĐĂNG KÝ trước return (yêu cầu của chính after()),
  // nhưng thân callback không chạy cho tới khi response đã xong.
  const translate = await getTranslate();
  after(() =>
    sendTicketNotificationSafely(
      {
        id: ticketId,
        intent: intent as TicketIntent,
        message,
        pageUrl,
        userAgent,
        screenWidth,
        screenHeight,
        hasScreenshot: screenshotPath !== null,
      },
      translate
    )
  );

  return { ok: true, shortRef: ticketId.slice(0, 8) };
}

async function sendTicketNotificationSafely(
  ticket: {
    id: string;
    intent: TicketIntent;
    message: string;
    pageUrl: string | null;
    userAgent: string | null;
    screenWidth: number | null;
    screenHeight: number | null;
    hasScreenshot: boolean;
  },
  translate: Translate
): Promise<void> {
  // sendSupportNotification tự nó không bao giờ throw/reject (task-05) —
  // try/catch ở đây là phòng thủ theo lớp, không phải đường xử lý chính.
  try {
    const result = await sendSupportNotification({ ticket, translate });
    if (!result.ok) {
      console.error("[submitSupportTicket] mail thất bại", ticket.id, result.error);
      await flagFailureSafely(ticket.id);
    }
  } catch (err) {
    console.error("[submitSupportTicket] mail lỗi không lường trước", ticket.id, err);
    await flagFailureSafely(ticket.id);
  }
}

async function flagFailureSafely(ticketId: string): Promise<void> {
  const { error } = await flagSupportTicketNotifyFailed(ticketId);
  if (error) {
    console.error("[submitSupportTicket] ghi cờ notify_failed lỗi", ticketId, error.message);
  }
}
