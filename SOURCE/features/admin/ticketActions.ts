// User Support System v1 — /admin/tickets Server Actions.
// Mirrors features/admin/actions.ts's moderateExamAction convention: mỗi
// action tự kiểm quyền LẠI, không tin trang page.tsx đã kiểm — Server Action
// là endpoint HTTP độc lập, gọi thẳng được mà không qua trang nào.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/admin";
import { getTranslate } from "@/lib/i18n/server";
import { addSupportTicketNote, changeSupportTicketStatus } from "@/lib/supabase/service-role";
import type { TicketActionState, TicketStatus } from "@/lib/support/types";
import type { MessageKey } from "@/lib/i18n/translate";

const VALID_STATUSES: readonly TicketStatus[] = ["new", "in_progress", "resolved"];

const STATUS_INFO_KEY: Record<TicketStatus, MessageKey> = {
  new: "support.admin.status.new",
  in_progress: "support.admin.status.inProgress",
  resolved: "support.admin.status.resolved",
};

/**
 * Đổi status ticket. KHÔNG BAO GIỜ gửi mail (AC-030, D7) — không có email báo
 * đổi status cho student trong v1, ở đâu cả.
 */
export async function changeTicketStatusAction(
  ticketId: string,
  nextStatus: TicketStatus
): Promise<TicketActionState> {
  const t = await getTranslate();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Không phân biệt "chưa đăng nhập" với "không phải admin" trong thông báo —
  // mirror moderateExamAction.
  if (!user || !isAdminUserId(user.id)) {
    console.warn("[changeTicketStatusAction] từ chối:", user?.id ?? "chưa đăng nhập");
    return { error: t("support.admin.statusError") };
  }

  // Phòng thủ: DB CHECK constraint là backstop có thẩm quyền (AC-029), nhưng
  // UI này vốn chỉ render đúng 3 giá trị cố định — kiểm lại đây mirror
  // submitSupportTicket's intent check (task-06), không phó mặc hoàn toàn cho DB.
  if (!VALID_STATUSES.includes(nextStatus)) {
    return { error: t("support.admin.statusError") };
  }

  const result = await changeSupportTicketStatus(ticketId, nextStatus);
  if ("error" in result) {
    console.error("[changeTicketStatusAction]", result.error.message);
    return { error: t("support.admin.statusError") };
  }

  revalidatePath("/admin/tickets");
  return { info: t(STATUS_INFO_KEY[result.status]) };
}

/**
 * Ghi ghi chú nội bộ. adminId LUÔN suy từ auth.uid() của chính phiên đang gọi
 * — KHÔNG BAO GIỜ nhận từ tham số/FormData — một admin không thể gán ghi chú
 * cho danh tính admin khác (AC-027).
 */
export async function addTicketNoteAction(
  ticketId: string,
  noteText: string
): Promise<TicketActionState> {
  const t = await getTranslate();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminUserId(user.id)) {
    console.warn("[addTicketNoteAction] từ chối:", user?.id ?? "chưa đăng nhập");
    return { error: t("support.admin.noteError") };
  }

  const trimmed = noteText.trim();
  if (trimmed.length === 0) {
    return { error: t("support.admin.noteError") };
  }

  const { error } = await addSupportTicketNote(ticketId, user.id, trimmed);
  if (error) {
    console.error("[addTicketNoteAction]", error.message);
    return { error: t("support.admin.noteError") };
  }

  revalidatePath("/admin/tickets");
  return { info: t("support.admin.noteSubmit") };
}
