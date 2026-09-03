// Đề + câu hỏi cho màn LÀM BÀI.
//
// Ranh giới bảo mật của thư mục này: hàm ở đây KHÔNG BAO GIỜ select
// correct_answer / essay_answer / sub_answers. Màn Chi tiết (result.ts) mới
// được đọc đáp án, và chỉ sau khi đã nộp.
//
// Tách khỏi `features/exams/queries.ts` (835 dòng) ngày 2026-09-03, mục 7 của
// đợt refactor. Đường import ngoài KHÔNG đổi — `@/features/exams/queries` nay
// phân giải vào `queries/index.ts`.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveSignedImageUrls } from "@/lib/ugc/imageUrl";
import { repairTrueFalseStem } from "@/lib/ugc/tfShape";
import type { SubItemId } from "@/lib/ugc/types";
import type { Exam } from "@/types/exam";
import type { PublicQuestion } from "@/types/question";
import { getExam } from "./catalogue";

/**
 * Đề + danh sách câu hỏi cho Player — KHÔNG kèm `correctAnswer` (bảo mật).
 * Câu hỏi được sắp theo đúng thứ tự `questionIds`. null nếu đề không tồn tại.
 */
export async function getExamForPlayer(
  id: string
): Promise<{ exam: Exam; questions: PublicQuestion[] } | null> {
  const supabase = await createClient();
  const exam = await getExam(id);
  if (!exam) return null;

  // KHÔNG select correct_answer / essay_answer / sub_answers (đáp án — mọi
  // dạng đều server-only, kể cả Đ/S từng ý của true_false — v2.1 ADR-0005).
  // UGC v2.0: thêm question_type + image_url; v2.1: part_number (cột choices
  // với true_false chứa các Ý a–d — nội dung, an toàn để render).
  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, content, choices, subject, grade, topic, question_type, part_number, image_url, passage_id"
    )
    .in("id", exam.questionIds);
  if (error) throw error;

  const rows = data as Array<{
    id: string;
    content: string;
    choices: PublicQuestion["choices"];
    subject: string;
    grade: number;
    topic: string;
    question_type: string | null;
    part_number: number | null;
    image_url: string | null;
    passage_id: string | null;
  }>;

  // Đổi image_url đã lưu → signed URL (bucket private) để player render được.
  // MỘT lượt gọi Storage cho cả đề (`createSignedUrls`) thay vì N lượt song
  // song — đo 2026-09-03 trên dev: một lượt lô ≈ 216 ms, một lượt đơn ≈ 409 ms;
  // đề 40 câu có hình trước đây là 40 request (A3). Mục nào ký hỏng thì
  // `get()` trả undefined, y như bản ký từng ảnh.
  const signedImages = await resolveSignedImageUrls(
    supabase,
    rows.map((r) => r.image_url)
  );
  const byId = new Map<string, PublicQuestion>();
  rows.forEach((r) => {
    const questionType =
      (r.question_type as "mcq" | "essay" | "true_false" | "short_answer" | null) ?? "mcq";
    // SHIM CHO ROW CŨ (2026-09-02) — câu Đúng/Sai lưu TRƯỚC bản vá
    // `repairTrueFalseStem` có `choices` rỗng và câu phán xét kẹt trong
    // `content`. Đây là đường đọc mà việc KHÔNG vá tốn nhiều nhất: học sinh
    // mở bài ra và thấy một câu hỏi không có gì để bấm. Cùng một hàm với màn
    // duyệt, cố ý — hai đường đọc dựng hai cấu trúc khác nhau cho cùng một
    // row là đúng thứ shim này sinh ra để tránh.
    const shaped = repairTrueFalseStem(
      questionType,
      r.content,
      questionType === "true_false"
        ? (r.choices as unknown as { id: SubItemId; text: string }[])
        : undefined
    );
    byId.set(r.id, {
      id: r.id,
      content: shaped.stem,
      // true_false: cột choices chứa các ý a–d → map sang subItems.
      choices: questionType === "true_false" ? [] : r.choices,
      subItems:
        questionType === "true_false"
          ? (shaped.subItems as unknown as PublicQuestion["subItems"])
          : undefined,
      subject: r.subject,
      grade: r.grade,
      topic: r.topic,
      questionType,
      partNumber: r.part_number ?? 1,
      passageId: r.passage_id ?? undefined,
      imageUrl: r.image_url ? signedImages.get(r.image_url) : undefined,
    });
  });
  const questions = exam.questionIds
    .map((qid) => byId.get(qid))
    .filter((q): q is PublicQuestion => q !== undefined);

  return { exam, questions };
}

