// suggestWeakSkills — reducer thuần (không I/O) cho thẻ vàng "Nên luyện gì tiếp
// theo" của Thống kê: với MỖI trong 7 môn, hoặc MỘT dạng bài yếu kèm số đề còn
// làm được, hoặc "không có gì để luyện" kèm lý do (brief 20261003).
//
// Thay engine định tuyến cũ (lib/adaptive/route.ts: chỉ Toán, đọc
// `user_skill_mastery`, dạng chưa làm tính là yếu nhất). Quyết định sản phẩm
// 2026-10-03:
//  - YẾU = dạng bài học sinh ĐÃ làm và đúng dưới `threshold` (0,7). Dạng chưa
//    làm KHÔNG tính: "chưa biết" không phải "yếu", và trên prod phần lớn dạng
//    chưa làm cũng chưa có đề nào (Toán 17/20) nên nút sẽ dẫn tới lưới trống.
//  - Số liệu lấy từ "Kết quả theo dạng bài" (`skillBreakdownByRange.all`) —
//    cùng một nguồn, nên con số trên thẻ vàng và trên bảng kê không thể lệch.
//    Luôn là toàn thời gian, không theo chip Tuần/Tháng.
//  - Nút "Tìm đề" chỉ có khi còn ÍT NHẤT MỘT đề published CÙNG MÔN, chứa dạng đó,
//    mà học sinh CHƯA nộp. Mỗi dạng trên prod chỉ có tối đa 1 đề và thường chính
//    là đề vừa làm, nên "hết đề mới" là ca thường gặp chứ không phải ngoại lệ —
//    người dùng chọn báo thẳng "không có gì để luyện" + lý do thay vì dẫn tới một
//    lưới chỉ có đề cũ.
//
// Đặt ở lib/ (không phải features/analytics) cùng lý do với skillBreakdown.ts:
// vitest.config.ts quét lib/**, reducer phải import thẳng được trong test.
import { SUBJECT_ORDER, type Subject } from "@/lib/analytics/constants";
import type { SubjectSkillBreakdown } from "@/lib/analytics/skillBreakdown";

/** Một đề published — chỉ hai trường reducer cần (khớp `SkillExam` của exams/queries/skill.ts). */
export interface ExamRef {
  id: string;
  /** `exams.subject` thô; chỉ đề trùng môn đang xét mới tính. */
  subject: string;
}

export type NoSuggestionReason =
  /** Môn chưa có câu đã gắn dạng nào mà học sinh làm → chưa biết dạng nào yếu. */
  | "no-data"
  /** Mọi dạng đã làm đều đúng từ ngưỡng trở lên. */
  | "no-weak"
  /** Có dạng yếu, đã có đề chứa nó, nhưng học sinh đã nộp hết. */
  | "all-done"
  /** Có dạng yếu nhưng không đề published nào của môn này chứa nó. */
  | "no-exam";

export type SubjectSuggestion =
  | {
      kind: "suggest";
      subject: Subject;
      skillNodeId: string;
      skillLabel: string;
      correct: number;
      total: number;
      /** Số đề published cùng môn, chứa dạng này, học sinh chưa nộp (≥ 1). */
      openExamCount: number;
    }
  | { kind: "none"; subject: Subject; reason: "no-data" | "no-weak" }
  | {
      kind: "none";
      subject: Subject;
      reason: "all-done" | "no-exam";
      /** Dạng yếu được nêu trong lời giải thích. */
      skillLabel: string;
      correct: number;
      total: number;
    };

interface WeakSkill {
  skillNodeId: string;
  skillLabel: string;
  correct: number;
  total: number;
}

/** Dạng yếu của một môn, yếu nhất trước (thứ tự sẵn của reducer skillBreakdown). */
function weakSkillsOf(entry: SubjectSkillBreakdown | undefined, threshold: number): WeakSkill[] {
  if (!entry) return [];
  const weak: WeakSkill[] = [];
  for (const skill of entry.skills) {
    // `skillNodeId`/`labelVi` null = ô "Chưa phân loại": không phải một dạng bài.
    if (skill.skillNodeId === null || skill.labelVi === null) continue;
    if (skill.accuracy < threshold) {
      weak.push({
        skillNodeId: skill.skillNodeId,
        skillLabel: skill.labelVi,
        correct: skill.correct,
        total: skill.total,
      });
    }
  }
  return weak;
}

/**
 * Id mọi dạng yếu của mọi môn — danh sách mà tầng đọc cần tra "đề nào chứa nó".
 * Cùng `threshold` với `suggestWeakSkills` nên hai bên không thể bất đồng về
 * "yếu" (nếu lệch, một dạng yếu sẽ không có dữ liệu đề và bị báo `no-exam` sai).
 */
export function weakSkillIds(
  breakdown: readonly SubjectSkillBreakdown[],
  threshold: number,
): string[] {
  const ids = new Set<string>();
  for (const entry of breakdown) {
    for (const weak of weakSkillsOf(entry, threshold)) ids.add(weak.skillNodeId);
  }
  return [...ids];
}

export interface SuggestWeakSkillsInput {
  /** `skillBreakdownByRange.all` — "% đúng theo dạng bài" cộng dồn mọi thời gian. */
  breakdown: readonly SubjectSkillBreakdown[];
  /** `skill_nodes.id` → các đề published chứa dạng đó (mọi môn; reducer tự lọc theo môn). */
  examsBySkill: ReadonlyMap<string, readonly ExamRef[]>;
  /** Id đề học sinh đã nộp. */
  doneExamIds: ReadonlySet<string>;
  /** Dưới mức này (tỉ lệ đúng) là yếu — `MASTERY_CLEARED_THRESHOLD`, tiêm vào để test tất định. */
  threshold: number;
}

/**
 * Luôn trả ĐỦ 7 phần tử theo `SUBJECT_ORDER` (kể cả môn chưa làm bài nào): chip
 * môn ở UI luôn đủ bảy, mỗi chip có một câu để nói.
 *
 * Với mỗi môn: chọn dạng yếu ĐẦU TIÊN (yếu nhất) mà còn đề chưa làm — không chỉ
 * xét dạng yếu nhất, vì một dạng yếu hơn mà hết đề không nên che dạng kế tiếp
 * còn luyện được. Không dạng nào còn đề: `all-done` nếu có dạng yếu nào có đề
 * (nêu dạng yếu nhất trong số đó), ngược lại `no-exam` (nêu dạng yếu nhất).
 */
export function suggestWeakSkills(input: SuggestWeakSkillsInput): SubjectSuggestion[] {
  const { breakdown, examsBySkill, doneExamIds, threshold } = input;
  const bySubject = new Map(breakdown.map((entry) => [entry.subject, entry]));

  return SUBJECT_ORDER.map((subject): SubjectSuggestion => {
    const entry = bySubject.get(subject);
    const hasTagged = entry?.skills.some((s) => s.skillNodeId !== null && s.labelVi !== null);
    if (!entry || !hasTagged) return { kind: "none", subject, reason: "no-data" };

    const weak = weakSkillsOf(entry, threshold);
    if (weak.length === 0) return { kind: "none", subject, reason: "no-weak" };

    let weakestWithExam: WeakSkill | null = null;
    for (const skill of weak) {
      const exams = (examsBySkill.get(skill.skillNodeId) ?? []).filter((e) => e.subject === subject);
      if (exams.length === 0) continue;
      weakestWithExam ??= skill;
      const open = exams.filter((e) => !doneExamIds.has(e.id));
      if (open.length > 0) {
        return {
          kind: "suggest",
          subject,
          skillNodeId: skill.skillNodeId,
          skillLabel: skill.skillLabel,
          correct: skill.correct,
          total: skill.total,
          openExamCount: open.length,
        };
      }
    }

    const named = weakestWithExam ?? weak[0];
    return {
      kind: "none",
      subject,
      reason: weakestWithExam ? "all-done" : "no-exam",
      skillLabel: named.skillLabel,
      correct: named.correct,
      total: named.total,
    };
  });
}
