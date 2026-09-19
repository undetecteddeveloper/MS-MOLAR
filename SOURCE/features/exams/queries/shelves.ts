// Điểm hợp thành của kệ đề: ba kệ /exams (Cần luyện, Nổi nhất, Khám phá,
// `listExamShelves()`) + kệ phẳng cho trang chủ (`listHotExams(limit)`) —
// điểm DUY NHẤT gọi các hàm THUẦN của `lib/adaptive/examShelves.ts` với dữ
// liệu THẬT (backend DD § Data Flow "the body of listExamShelves()").
//
// 4 lượt đọc biên của `listExamShelves()` chạy trong MỘT `Promise.all`,
// không `await` nào chen giữa (ADR-0021 D3 — ngân sách 4: 3 `.from` + 1
// `.rpc`, kiểm bằng cách đếm hai loại gọi cộng lại). `listHotExams()` chỉ có
// 3 — không cần lượt đọc điểm số vì trang chủ không xếp hạng cá nhân hoá nào.
// Đồng hồ đọc ĐÚNG MỘT LẦN mỗi lượt gọi — `new Date()` ở đây — rồi truyền vào
// `readHotCounts` như một tham số; không bao giờ đọc lại bên trong
// `lib/adaptive` (ADR-0021 D4).
import "server-only";

import {
  hotCountFieldOf,
  pickDominantGrade,
  pickExploreShelf,
  pickHotShelf,
  pickWeakestSubject,
  type HotRung,
  type ShelfCandidate,
} from "@/lib/adaptive/examShelves";
import {
  buildGradeShares,
  buildRepresentativeAttempts,
  buildSubjectWeakness,
  rankExamIds,
} from "@/lib/adaptive/rankExams";
import {
  EXAM_RANK_GRADE_MATCH_WEIGHT,
  EXAM_RANK_RECENCY_WEIGHT,
  EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
  HOT_SHELF_MIN_CARDS,
  SHELF_MAX_CARDS,
} from "@/lib/adaptive/constants";
import { readBounded } from "@/lib/supabase/boundedRead";
import { createClient } from "@/lib/supabase/server";
import type { Exam } from "@/types/exam";
import { readMyAttemptRows, submittedExamIdsOf, toShelfAttempts } from "./attempts";
import { fetchExamRows } from "./catalogue";
import { readHotCounts } from "./hotCounts";
import { toExam, type ExamRow } from "./rows";

/** Trọng số xếp hạng DÙNG CHUNG với `listExamsRanked` — kệ Cần luyện không
 *  cài lại một định nghĩa "xếp hạng cá nhân hoá" thứ hai (ADR-0021 D2). */
const RANK_WEIGHTS = {
  gradeMatch: EXAM_RANK_GRADE_MATCH_WEIGHT,
  recency: EXAM_RANK_RECENCY_WEIGHT,
  subjectWeakness: EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
};

/**
 * Ba kệ của `/exams` — hình dạng PHÂN BIỆT theo từng kệ, không phải một hình
 * dùng lại ba lần: `practice` không bao giờ mang `rung`/`grade`, `hot` không
 * bao giờ mang `subject`, `explore` không mang gì ngoài `exams` (frontend DD
 * § Data contracts). Một kệ 0 thẻ là `null`, không phải `{ exams: [] }` —
 * "vắng mặt" không biểu diễn được thành "có mặt nhưng rỗng" (AC-051).
 */
export interface ExamShelves {
  /** null => học sinh chưa có lượt đại diện CÓ ĐIỂM nào (AC-013/AC-051). */
  practice: { subject: string; exams: Exam[] } | null;
  /** null => mọi bậc của thang đều 0 đề đạt (AC-024/AC-051). */
  hot: {
    rung: HotRung;
    grade: number | null;
    exams: Exam[];
    /** Số lượt ĐÃ NỘP của mọi học sinh, theo id đề, trong đúng cửa sổ của `rung`
     *  — chính số đã xếp hạng thẻ, nên giảm dần theo thứ tự `exams`. */
    attemptCounts: Record<string, number>;
  } | null;
  /** null => 0 đề còn lại sau khi loại hai kệ kia (kho rất nhỏ). */
  explore: { exams: Exam[] } | null;
  /** Cùng tập mà kệ phẳng `/exams` dùng cho huy hiệu "đã làm" — MỘT lượt đọc
   *  `exam_attempts` phục vụ cả ba kệ (ADR-0021 D2 Decision 1b). */
  submittedExamIds: Set<string>;
}

/** Kệ Nổi nhất dạng danh sách rời cho trang chủ — KHÔNG phải `Exam[]` trần:
 *  thiếu `submittedExamIds` sẽ âm thầm lật nút "Đánh giá" của mọi đề đã nộp
 *  từ "đủ điều kiện" sang "chưa làm" (frontend DD E-1). */
export interface HotExamList {
  exams: Exam[];
  rung: HotRung | null;
  grade: number | null;
  submittedExamIds: Set<string>;
}

/** `ExamRow[]` (catalogue thô) → `ShelfCandidate[]` — tập ứng viên DUY NHẤT
 *  mà cả ba kệ cùng đọc (Data Flow pseudocode), nên ba kệ không thể bất đồng
 *  về "kho đề có gì". */
function candidatesFromRows(rows: readonly ExamRow[]): ShelfCandidate[] {
  return rows.map((row) => ({
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    school: row.school,
    createdAt: row.created_at,
  }));
}

/** id đã chọn → `Exam[]` theo ĐÚNG thứ tự `ids`, bỏ qua id không còn trong
 *  `rows` (aggregate trỏ tới một đề mà lượt đọc catalogue không trả — hiếm,
 *  cùng quy ước "rơi khỏi rowById thì bị bỏ" của `listExamsRanked`). */
function examsFromIds(rows: readonly ExamRow[], ids: readonly string[]): Exam[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = rowById.get(id);
    return row ? [toExam(row)] : [];
  });
}

/**
 * Ba kệ của `/exams` khi URL không có bất kỳ tham số duyệt nào (AC-008) —
 * Cần luyện, Nổi nhất, Khám phá — cùng tập ứng viên, cùng tập lượt-đã-nộp.
 *
 * 4 lượt đọc biên chạy SONG SONG trong MỘT `Promise.all` (ADR-0021 D3 —
 * ngân sách 4, kiểm bằng đếm `from()`+`rpc()` cộng lại): catalogue, lượt làm
 * đã nộp, điểm số (cho tín hiệu điểm-yếu-theo-môn), và cửa sổ đếm cross-user.
 */
export async function listExamShelves(): Promise<ExamShelves> {
  const supabase = await createClient();
  const now = new Date();

  const [rows, attemptRows, resultRows, hotCounts] = await Promise.all([
    fetchExamRows(),
    readMyAttemptRows(supabase, "listExamShelves.attempts"),
    readBounded(
      "listExamShelves.results",
      supabase.from("exam_results").select("attempt_id, total_score")
    ) as Promise<{ attempt_id: string; total_score: number | string }[]>,
    readHotCounts(supabase, "listExamShelves.hotCounts", now),
  ]);

  const submittedExamIds = submittedExamIdsOf(attemptRows);

  // `total_score` là `numeric(4,2)` — PostgREST có thể trả về chuỗi. Ép số
  // một lần ở biên, cùng quy ước `listExamsRanked` đã dùng (ranking.ts:87-92).
  const scoreByAttempt = new Map<string, number>();
  for (const row of resultRows) {
    const score = Number(row.total_score);
    if (Number.isFinite(score)) scoreByAttempt.set(row.attempt_id, score);
  }

  const attempts = toShelfAttempts(attemptRows, scoreByAttempt);
  const candidates = candidatesFromRows(rows);

  const representatives = buildRepresentativeAttempts(attempts);
  const weakness = buildSubjectWeakness(representatives.values());
  const shares = buildGradeShares(attempts);

  const weakest = pickWeakestSubject(weakness);
  const dominantGrade = pickDominantGrade(shares, attempts);

  const practiceIds =
    weakest === null
      ? []
      : rankExamIds({
          candidates: candidates.filter((c) => c.subject === weakest),
          attempts,
          weights: RANK_WEIGHTS,
        }).slice(0, SHELF_MAX_CARDS);

  const hot = pickHotShelf({
    counts: hotCounts,
    candidates,
    dominantGrade,
    minCards: HOT_SHELF_MIN_CARDS,
    maxCards: SHELF_MAX_CARDS,
  });

  // `pickHotShelf`/`rankExamIds` không nhận `excludeIds` nào — nên "Cần
  // luyện" ∩ "Nổi nhất" không bị chặn ở đây, có chủ ý (AC-049: chồng lấn hai
  // kệ đó là HỢP LỆ). CHỈ Khám phá loại hai kệ kia khỏi pool của nó (AC-029).
  const exploreIds = pickExploreShelf({
    candidates,
    attempts,
    excludeIds: new Set([...practiceIds, ...(hot?.examIds ?? [])]),
    maxCards: SHELF_MAX_CARDS,
  });

  return {
    practice:
      weakest !== null && practiceIds.length > 0
        ? { subject: weakest, exams: examsFromIds(rows, practiceIds) }
        : null,
    hot:
      hot !== null
        ? {
            rung: hot.rung,
            grade: dominantGrade,
            exams: examsFromIds(rows, hot.examIds),
            attemptCounts: Object.fromEntries(
              hot.examIds.map((id) => [id, hotCounts.get(id)?.[hotCountFieldOf(hot.rung)] ?? 0])
            ),
          }
        : null,
    explore: exploreIds.length > 0 ? { exams: examsFromIds(rows, exploreIds) } : null,
    submittedExamIds,
  };
}

/**
 * Kệ Nổi nhất dạng danh sách rời cho trang chủ (AC-036-038) — CÙNG thang
 * (`pickHotShelf`) và CÙNG lượt đọc `exam_attempts` với `/exams`, nhưng
 * KHÔNG đọc `exam_results`: trang chủ không xếp hạng cá nhân hoá gì cả, nên
 * không cần điểm số nào (3 lượt đọc, không phải 4).
 *
 * Gọi tại call site đã GUARD bằng `user` (F-001, `app/page.tsx`, P7-T1) —
 * hàm này tự nó không kiểm `user`, vì đó là quyết định của trang, không phải
 * của tầng query.
 */
export async function listHotExams(limit: number): Promise<HotExamList> {
  const supabase = await createClient();
  const now = new Date();

  const [rows, attemptRows, hotCounts] = await Promise.all([
    fetchExamRows(),
    readMyAttemptRows(supabase, "listHotExams.attempts"),
    readHotCounts(supabase, "listHotExams.hotCounts", now),
  ]);

  const submittedExamIds = submittedExamIdsOf(attemptRows);
  // Không có lượt đọc điểm số ở đây: thang Nổi nhất (`pickHotShelf`) không
  // nhận `attempts` nào, nên `totalScore` không đi vào quyết định nào của kệ
  // này — map rỗng là AN TOÀN, không phải một xấp xỉ.
  const attempts = toShelfAttempts(attemptRows, new Map<string, number>());
  const candidates = candidatesFromRows(rows);

  const dominantGrade = pickDominantGrade(buildGradeShares(attempts), attempts);
  const hot = pickHotShelf({
    counts: hotCounts,
    candidates,
    dominantGrade,
    minCards: HOT_SHELF_MIN_CARDS,
    maxCards: limit,
  });

  return {
    exams: hot !== null ? examsFromIds(rows, hot.examIds) : [],
    rung: hot?.rung ?? null,
    grade: hot !== null ? dominantGrade : null,
    submittedExamIds,
  };
}
