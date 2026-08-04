// Admin — Server Actions gỡ/khôi phục nội dung UGC (Security review Medium #7).
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminUserId } from "@/lib/auth/admin";
import { moderateExam } from "@/lib/supabase/service-role";

export type ModerationState = { error?: string; info?: string } | null;

/**
 * Gỡ hoặc khôi phục một đề.
 *
 * Kiểm quyền LẠI Ở ĐÂY, không tin vào việc trang /admin đã kiểm: Server Action
 * là một endpoint HTTP độc lập, gọi thẳng được mà không cần đi qua trang nào.
 * Đây mới là gate thật; guard ở page chỉ để không hiện UI cho người không phận sự.
 */
export async function moderateExamAction(
  _prev: ModerationState,
  formData: FormData
): Promise<ModerationState> {
  const examId = String(formData.get("examId") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!examId) return { error: "Missing exam id." };
  if (action !== "remove" && action !== "restore") {
    return { error: "Unknown moderation action." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Không phân biệt "chưa đăng nhập" với "không phải admin" trong thông báo —
  // trang này không nên xác nhận sự tồn tại của nó cho người lạ.
  if (!user || !isAdminUserId(user.id)) {
    console.warn("[moderateExamAction] từ chối:", user?.id ?? "chưa đăng nhập");
    return { error: "Not allowed." };
  }

  const { error } = await moderateExam(examId, action, user.id, reason);
  if (error) {
    console.error("[moderateExamAction]", error.message);
    return { error: "Could not apply the change. Try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/exams");
  return {
    info: action === "remove" ? "Exam removed from the catalog." : "Exam restored as a draft.",
  };
}
