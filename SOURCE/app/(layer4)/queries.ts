// Logic Layer 4 — UGC Exam Upload v2.0: Read queries (Task 4.2).
// Design Doc §Read Queries. Server-only: Supabase server client (RLS là tầng
// authorization). Mọi query order tường minh (không dựa thứ tự insert).
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assembledFromRows } from "@/lib/ugc/fromRows";
import { resolveSignedImageUrl } from "@/lib/ugc/imageUrl";
import type { AssembledExam } from "@/lib/ugc/types";

/** Một dòng trong danh sách "My exams" (S-02). */
export type MyExamListItem = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  questionCount: number;
  status: string;
  createdAt: string;
  /** Mốc publish (set bởi publishExam) — null nếu chưa publish. */
  reviewedAt: string | null;
};

/**
 * Đề của chính user, mọi status, mới nhất trước (AC-020).
 * RLS `exams_select_visible` đã giới hạn về published-hoặc-của-mình; thêm
 * `author_id = auth.uid()` để chỉ lấy đề của mình (loại đề published của người
 * khác lọt vào danh sách quản lý).
 */
export async function listMyExams(): Promise<MyExamListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, question_ids, status, created_at, reviewed_at"
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    data as Array<{
      id: string;
      title: string;
      subject: string;
      grade: number;
      question_ids: string[];
      status: string;
      created_at: string;
      reviewed_at: string | null;
    }>
  ).map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    grade: r.grade,
    questionCount: r.question_ids?.length ?? 0,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
}

/** Đề assembled đầy đủ để review/sửa (S-03), kèm status + signed image URL. */
export type MyExamDetail = {
  id: string;
  status: string;
  exam: AssembledExam;
};

/**
 * Một đề của user cho màn review/sửa (AC-014): metadata + toàn bộ câu hỏi
 * (stem, question_type, choices, correct_answer, essay_answer, image_url).
 * `image_url` đổi sang SIGNED URL (bucket private) trước khi đưa xuống client.
 * null nếu không tồn tại / không phải của mình (RLS lọc).
 */
export async function getMyExam(id: string): Promise<MyExamDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts"
    )
    .eq("id", id)
    .eq("author_id", user.id)
    .maybeSingle();
  if (examErr) throw examErr;
  if (!examRow) return null;

  const questionIds = (examRow.question_ids as string[]) ?? [];
  // Màn review là surface CỦA TÁC GIẢ nên được xem đáp án (khác player, nơi
  // correct_answer/sub_answers/essay_answer KHÔNG BAO GIỜ được select). Từ
  // Security review 2026-08-03 #1, 3 cột đó bị REVOKE khỏi role `authenticated`
  // (RLS lọc dòng chứ không lọc cột) → đọc qua exam_answer_key(), nhánh "tác
  // giả" của nó (schema.sql §10a) tái kiểm tra author_id ở tầng DB, độc lập với
  // .eq("author_id", user.id) trên query exams phía trên.
  const { data: qData, error: qErr } = await supabase.rpc("exam_answer_key", {
    p_exam_id: id,
  });
  if (qErr) throw qErr;
  const qRows = (qData ?? []) as Array<Record<string, unknown>>;

  const exam = assembledFromRows(
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
    },
    qRows
  );

  // Đổi image_url đã lưu → signed URL để <img> đọc được từ bucket private.
  await Promise.all(
    exam.questions.map(async (q) => {
      if (q.imageUrl) {
        q.imageUrl = await resolveSignedImageUrl(supabase, q.imageUrl);
      }
    })
  );

  return { id: examRow.id as string, status: examRow.status as string, exam };
}

/**
 * User hiện tại đã report đề này chưa (AC-026) — cho nút "Bạn đã báo cáo".
 * `reports_select_own` giới hạn về report của chính mình nên chỉ đếm được của mình.
 */
export async function hasReported(examId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("exam_reports")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
