// Lượt đọc `exam_attempts` của CHÍNH người gọi + phép chiếu sang tín hiệu xếp
// hạng — MỘT nơi khai, hai bên tiêu thụ (`ranking.ts` hôm nay, `shelves.ts` từ
// P3-T2), nên chuỗi select và quy tắc "embed thiếu field chỉ câm tín hiệu của
// field đó" không thể trôi lệch giữa hai composition (backend DD § Query layer).
//
// Tách khỏi `ranking.ts:27-64` ngày 2026-09-18 (P2-T4, đợt refactor kệ đề).
// `AttemptRow`, `embeddedExam`, `gradeOfAttempt`, `subjectOfAttempt` chuyển
// NGUYÊN VẸN từ đó — kể cả khả năng dung nạp embed OBJECT-hoặc-MẢNG và quy tắc
// "một field thiếu chỉ câm đúng tín hiệu của nó". `ATTEMPT_SELECT` nới thêm
// `school` (zero round-trip, cùng cách dung nạp null-tolerant) cho kệ Khám phá
// (AC-048); `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts` là hàm
// bọc MỚI, gói lại đúng phần thân từng nằm rải trong `listExamsRanked` để hai
// composition dùng chung.
import "server-only";

import type { ShelfAttempt } from "@/lib/adaptive/examShelves";
import { readBounded } from "@/lib/supabase/boundedRead";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Chuỗi select DÙNG CHUNG cho lượt đọc `exam_attempts` của mọi composition —
 *  một chỗ khai để `ranking.ts` và `shelves.ts` (P3-T2) không thể trôi lệch. */
export const ATTEMPT_SELECT = "id, exam_id, submitted_at, exams!inner(grade, subject, school)";

/** Dòng lượt-làm-bài + lớp của đề, lấy kèm trong CÙNG một round-trip. */
export type AttemptRow = {
  id: string;
  exam_id: string;
  submitted_at: string | null;
  // ĐÃ ĐO 2026-08-16 (câu hỏi analytics-layer3 để ngỏ, nay đóng lại): PostgREST
  // trả embed to-one này dưới dạng OBJECT — `{"exams":{"grade":10}}` — kiểm
  // bằng chính @supabase/supabase-js trên dev (hynwleaxtbtjzkvpjsug, 40 dòng
  // qua đường anon key + JWT thật, RLS bật). Trên prod (pebjdlbgbmizgfpuptjl)
  // xác nhận gián tiếp mà chắc chắn: `exam_attempts_exam_id_fkey` là khoá ngoại
  // MỘT cột `exam_id -> exams`, và chính chiều many-to-one đó là thứ PostgREST
  // dùng để quyết to-one. Vẫn khai CẢ HAI hình dạng: chi phí bằng 0, còn thứ
  // được bảo vệ là một giả định về thư viện bên thứ ba có thể đổi khi nâng cấp.
  exams: EmbeddedExamFacets | EmbeddedExamFacets[] | null;
};

/** Các facet của đề mà bộ xếp hạng + ba kệ cần, lấy kèm qua embed to-one.
 *  `school` nới thêm cho kệ Khám phá (AC-048) — nullable như cột `exams.school`. */
type EmbeddedExamFacets = { grade: number; subject: string; school: string | null };

function embeddedExam(row: AttemptRow): EmbeddedExamFacets | undefined {
  return Array.isArray(row.exams) ? row.exams[0] : (row.exams ?? undefined);
}

function gradeOfAttempt(row: AttemptRow): number | null {
  const embedded = embeddedExam(row);
  return typeof embedded?.grade === "number" ? embedded.grade : null;
}

/**
 * Môn của đề đã làm, hoặc null khi embed không giao được nó (TD-028).
 *
 * TÁCH KHỎI `gradeOfAttempt` chứ không gộp thành một guard: một embed thiếu MÔN
 * chỉ được phép làm câm tín hiệu môn. Gộp lại thì lượt ấy rơi khỏi cả tín hiệu
 * LỚP — tức một trường thiếu đi sửa thứ tự theo một trục nó không liên quan.
 */
function subjectOfAttempt(row: AttemptRow): string | null {
  const embedded = embeddedExam(row);
  return typeof embedded?.subject === "string" ? embedded.subject : null;
}

/** Trường của đề đã làm, hoặc null khi embed không giao được nó — cùng quy tắc
 *  dung nạp với `subjectOfAttempt` (kệ Khám phá đọc "trường chưa từng thử", AC-048). */
function schoolOfAttempt(row: AttemptRow): string | null {
  const embedded = embeddedExam(row);
  return typeof embedded?.school === "string" ? embedded.school : null;
}

/**
 * Một lượt đọc `exam_attempts` ĐÃ NỘP của chính người gọi (RLS lo phần "của
 * ai") — dùng chung bởi `listExamsRanked` và `listExamShelves`/`listHotExams`
 * (P3-T2), nên select string và điều kiện lọc chỉ khai đúng MỘT lần.
 */
export async function readMyAttemptRows(
  supabase: SupabaseClient,
  label: string
): Promise<AttemptRow[]> {
  return (await readBounded(
    label,
    supabase.from("exam_attempts").select(ATTEMPT_SELECT).eq("status", "submitted")
  )) as AttemptRow[];
}

/** Tập id đề đã nộp, suy ra từ CHÍNH lượt đọc trên — băng "đã làm" và huy hiệu
 *  "đã làm" trên thẻ đề vì vậy không thể bất đồng với nhau giữa hai composition. */
export function submittedExamIdsOf(rows: readonly AttemptRow[]): Set<string> {
  return new Set(rows.map((row) => row.exam_id));
}

/**
 * Chiếu `AttemptRow[]` sang `ShelfAttempt[]` — tín hiệu xếp hạng dùng chung của
 * cả `rankExamIds` (qua cấu trúc `RankAttempt` mà `ShelfAttempt` mở rộng) lẫn
 * ba kệ (`school`, ADR-0021 D2 "một định nghĩa xếp hạng cá nhân hoá DUY NHẤT,
 * không có bản sao song song nào tính lại").
 *
 * Lượt thiếu lớp (embed lệch hình dạng) bị BỎ khỏi tín hiệu lớp chứ không được
 * gán một lớp đoán bừa — nhưng vẫn nằm trong `submittedExamIdsOf()` ở trên, nên
 * băng "đã làm" không bao giờ mất đề.
 */
export function toShelfAttempts(
  rows: readonly AttemptRow[],
  scoreByAttempt: ReadonlyMap<string, number>
): ShelfAttempt[] {
  return rows.flatMap((row) => {
    const grade = gradeOfAttempt(row);
    if (grade === null) return [];
    return [
      {
        examId: row.exam_id,
        grade,
        subject: subjectOfAttempt(row),
        submittedAt: row.submitted_at,
        totalScore: scoreByAttempt.get(row.id) ?? null,
        school: schoolOfAttempt(row),
      },
    ];
  });
}
