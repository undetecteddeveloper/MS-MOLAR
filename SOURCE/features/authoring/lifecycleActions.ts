// Vòng đời sau khi soạn xong: publish, xoá, báo cáo.
//
// Ba action ngắn, cùng một hình dạng: xác thực chủ sở hữu → một phép kiểm →
// ghi → revalidate. `publishExam` là NƠI DUY NHẤT gate metadata (ADR-0007):
// nút client có disable hay không cũng không thay đổi được điều đó.
//
// Tách khỏi `actions.ts` (1.190 dòng) ngày 2026-09-03, mục 7 của đợt refactor.
// Hợp đồng import KHÔNG đổi: `features/authoring/actions.ts` re-export lại.
"use server";

import { revalidatePath } from "next/cache";
import { guard } from "@/lib/security/rateLimit";
import { validateAssembledExam } from "@/lib/ugc/assembleExam";
import { assembledFromRows } from "@/lib/ugc/fromRows";
import { LIMITS } from "@/lib/ugc/limits";
import { validateMetaForPublish, validatePointsForPublish } from "@/lib/ugc/normalizeMeta";
import type { UgcActionFailure } from "@/lib/ugc/types";

import { IMAGES_BUCKET, UPLOADS_BUCKET, failure, requireUser } from "./internals";

/** Publish (AC-016/017 + v2.2 AC-038): đề của mình + status review/draft +
 * validate SẠCH cả câu hỏi LẪN metadata (ADR-0007 — gate metadata nằm Ở ĐÂY,
 * không phải ở upload; server tự từ chối bất kể nút client có disable hay không). */
export async function publishExam(examId: string): Promise<{ error?: UgcActionFailure["error"] }> {
  const { supabase, user } = await requireUser();

  const { data: examRow } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts, passages"
    )
    .eq("id", examId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!examRow) {
    return failure("server", "Exam not found or you are not its author.");
  }
  if (examRow.status !== "review" && examRow.status !== "draft") {
    return failure(
      "validation",
      examRow.status === "published"
        ? "This exam is already published."
        : examRow.status === "removed"
          ? // Takedown (Security review #7): RLS cũng chặn ở tầng DB
            // (exams_update_author loại trừ 'removed'), đây chỉ là câu thông báo
            // rõ ràng thay cho một lỗi ghi im lặng.
            "This exam was removed by a moderator and cannot be published."
          : "Fix the extraction issues before publishing."
    );
  }

  const questionIds = (examRow.question_ids as string[]) ?? [];
  // Xem ghi chú ở saveExam: đáp án chỉ ra khỏi DB qua exam_answer_key()
  // (schema.sql §10a), nhánh "tác giả".
  const { data: qData } = await supabase.rpc("exam_answer_key", { p_exam_id: examId });
  const qRows = (qData ?? []) as Array<Record<string, unknown>>;

  const assembled = assembledFromRows(
    {
      title: examRow.title as string,
      subject: examRow.subject as string,
      grade: examRow.grade as number,
      duration_minutes: examRow.duration_minutes as number,
      school: examRow.school as string | null,
      school_year: examRow.school_year as number | null,
      semester: examRow.semester as string | null,
      question_ids: questionIds,
      parts: (examRow.parts as { number: number; title: string }[] | null) ?? null,
      passages:
        (examRow.passages as { id: string; title?: string; text: string }[] | null) ?? null,
    },
    qRows ?? []
  );
  // v2.2 (AC-038): metadata sentinel/ngoài khoảng chặn publish — sort TRƯỚC
  // lỗi từng câu (gate toàn đề).
  //
  // B1: biểu điểm cũng chỉ chặn Ở ĐÂY, không ở validateAssembledExam — đề chưa
  // nhập điểm không phải đề bóc tách hỏng, và saveExam đọc validateAssembledExam
  // để tính status nên mọi thứ nhét vào đó sẽ thành nhãn 'failed'. Đây là gate
  // THẬT: nút Publish của client không biết luật này (cố ý — màn review không
  // hiện tổng điểm chạy), nên tác giả gặp nó đúng lúc bấm Publish.
  const errors = [
    ...validateMetaForPublish(assembled.meta),
    ...validatePointsForPublish(assembled),
    ...validateAssembledExam(assembled),
  ];
  if (errors.length > 0) {
    return failure("validation", "Fix these issues before publishing:", {
      errors,
    });
  }

  const { error } = await supabase
    .from("exams")
    .update({ status: "published", reviewed_at: new Date().toISOString() })
    .eq("id", examId);
  if (error) {
    console.error("[publishExam]", error.message);
    return failure("server", "Could not publish. Try again.");
  }

  revalidatePath(`/me/exams/${examId}`);
  revalidatePath("/me/exams");
  revalidatePath("/exams");
  return {};
}

/** Xoá đề của mình (mọi status): questions + Storage objects + row exams. */
export async function deleteExam(examId: string): Promise<{ error?: UgcActionFailure["error"] }> {
  const { supabase, user } = await requireUser();

  const { data: examRow } = await supabase
    .from("exams")
    .select("id, question_ids")
    .eq("id", examId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!examRow) {
    return failure("server", "Exam not found or you are not its author.");
  }

  // ⚠ THỨ TỰ QUAN TRỌNG — DB TRƯỚC, Storage SAU.
  //
  // Trước 2026-08-04 thứ tự ngược lại và đã gây hỏng dữ liệu thật trên
  // production: xoá file xong mới đụng DB, DB fail (khoá ngoại attempt_answers
  // → questions thiếu `on delete cascade`, xem schema.sql §L2) → đề vẫn
  // `published` nhưng ảnh đã bay sạch. Học sinh mở đề thấy câu "như hình vẽ
  // bên" mà không còn hình nào.
  //
  // Không có transaction bao được cả hai (Storage nằm ngoài Postgres), nên
  // chọn chiều fail ÍT HẠI HƠN: DB fail trước → chưa xoá gì, đề còn nguyên
  // vẹn; Storage fail sau → còn file mồ côi, tốn dung lượng nhưng không ai
  // nhìn thấy và dọn lại được bất cứ lúc nào.

  // Questions xoá TRƯỚC exams (policy delete của questions cần row exams còn).
  const questionIds = (examRow.question_ids as string[]) ?? [];
  if (questionIds.length > 0) {
    const { error } = await supabase.from("questions").delete().in("id", questionIds);
    if (error) {
      console.error("[deleteExam] questions:", error.code, error.message);
      return failure("server", "Could not delete the questions. Try again.");
    }
  }

  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) {
    console.error("[deleteExam] exam:", error.code, error.message);
    return failure("server", "Could not delete the exam. Try again.");
  }

  // Từ đây DB đã sạch — đề không còn tồn tại với bất kỳ ai. File rác không
  // ảnh hưởng người dùng, nên lỗi ở bước này chỉ log, KHÔNG báo fail (báo fail
  // sẽ khiến người dùng bấm Delete lại trên một đề đã biến mất).
  for (const bucket of [IMAGES_BUCKET, UPLOADS_BUCKET]) {
    const { data: objects } = await supabase.storage.from(bucket).list(examId);
    const paths = (objects ?? []).map((o) => `${examId}/${o.name}`);
    if (paths.length > 0) {
      const { error: rmError } = await supabase.storage.from(bucket).remove(paths);
      if (rmError) {
        console.error(`[deleteExam] storage ${bucket} (đã mồ côi):`, rmError.message);
      }
    }
  }

  revalidatePath("/me/exams");
  revalidatePath("/exams");
  return {};
}

/** Report đề published (AC-025/026). 1 report / user / đề — trùng → "duplicate". */
export async function reportExam(
  examId: string,
  reason: string
): Promise<{ error?: "duplicate" | "empty" | "rate_limited" | "server" }> {
  const { supabase, user } = await requireUser();

  // Rate limit (Security review Low). unique(exam_id, reporter_id) chỉ chặn
  // report TRÙNG trên CÙNG một đề — không chặn được việc quét qua nhiều đề.
  const rl = await guard("reportExam", user.id);
  if (!rl.ok) return { error: "rate_limited" };

  const trimmed = reason.trim().slice(0, LIMITS.MAX_REPORT_REASON);
  if (trimmed.length === 0) return { error: "empty" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const { error } = await supabase.from("exam_reports").insert({
    exam_id: examId,
    reporter_display_name: profile?.display_name ?? null,
    reason: trimmed,
  });
  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    // RLS chặn (đề chưa published) hoặc lỗi hạ tầng — không lộ chi tiết.
    console.error("[reportExam]", error.code, error.message);
    return { error: "server" };
  }
  return {};
}

