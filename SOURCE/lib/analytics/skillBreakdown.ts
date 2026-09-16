// aggregateSkillsByRange / rankWeakSkills — reducer thuần (không I/O) trả lời
// "% đúng theo DẠNG BÀI" cho cả 7 môn, và từ đó "cần sửa chỗ nào".
//
// Vì sao thay `exam_results.topic_breakdown` (bản trước, lib/analytics/
// weakTopics.ts): `topic := subject` cho mọi câu UGC (ADR-0004), nên trên prod
// mỗi đề có đúng MỘT topic trùng tên môn (đo 2026-09-16: `Biology:Biology`,
// `Math:Math`…) — thẻ "Cần sửa chỗ nào" chỉ lặp lại biểu đồ theo môn và còn in
// khoá tiếng Anh ra màn hình. Dạng bài thật nằm ở `questions.skill_node_id`
// (cây kỹ năng 7 môn, lib/adaptive/skillTaxonomy.ts) + `skill_nodes.label_vi`.
//
// Vì sao tính lúc ĐỌC từ `per_question` chứ không đọc `user_skill_mastery`:
// mastery chỉ ghi lúc NỘP BÀI theo thẻ có tại thời điểm đó (record_skill_mastery),
// nên mọi lượt nộp trước ngày gắn thẻ môn mới không bao giờ có dòng nào; đọc
// lại từ per_question thì hồi tố được, và theo được chip Tuần/Tháng — mastery
// là số cộng dồn không có mốc thời gian.
//
// Câu `scored === false` (tự luận, Đ/S–trả lời ngắn thiếu đáp án) KHÔNG đếm —
// cùng quy ước với ô Đúng/Sai và record_skill_mastery(); `undefined` = true.
// Câu chưa gắn thẻ (skill_node_id null, hoặc id không có trong `questions` /
// nhãn không còn) gom vào MỘT ô "Chưa phân loại" mỗi môn — không rơi, không
// ném: một môn vừa được gắn thẻ nửa chừng vẫn hiện đúng phần đã biết.
//
// Cả thẻ "Kết quả theo dạng bài" lẫn "Cần sửa chỗ nào" suy từ CÙNG kết quả
// của aggregateSkillsByRange(), nên hai thẻ không thể nói hai con số khác nhau
// về cùng một dạng bài.
//
// Đặt ngoài app/(analytics)/ cùng lý do với aggregateAttempts.ts: vitest.config.ts
// không quét app/**, reducer phải import thẳng được trong test.
import { SUBJECT_ORDER, type Subject, type TimeRange } from "@/lib/analytics/constants";

/** Một dòng per_question đã rút gọn — chỉ ba trường reducer cần. */
export interface SkillAttemptQuestion {
  questionId: string;
  isCorrect: boolean;
  /** false = câu KHÔNG tính điểm (tự luận…). undefined = true (dòng cũ). */
  scored?: boolean;
}

/** Một exam_result đã submit + môn của đề + các câu của nó. */
export interface SkillAttemptRow {
  /** Chuỗi thô từ exams.subject — có thể KHÔNG thuộc union 7 môn Thống kê. */
  subject: string;
  submittedAt: string | null;
  perQuestion: readonly SkillAttemptQuestion[];
}

/** Tra cứu tĩnh đọc từ DB một lần cho cả trang. */
export interface SkillLookup {
  /** questions.id → skill_node_id (null = chưa gắn). Id vắng mặt = chưa gắn. */
  questionSkills: ReadonlyMap<string, string | null>;
  /** skill_nodes.id → label_vi. */
  nodeLabels: ReadonlyMap<string, string>;
}

export interface SkillBucket {
  /** null = ô "Chưa phân loại" của môn đó. */
  skillNodeId: string | null;
  /** Nhãn tiếng Việt của dạng bài; null khi và chỉ khi skillNodeId null. */
  labelVi: string | null;
  correct: number;
  total: number;
  /** correct / total, luôn trong [0,1] — tính sẵn để UI không tự chia lại. */
  accuracy: number;
}

export interface SubjectSkillBreakdown {
  subject: Subject;
  /** Dạng bài đã gắn thẻ trước (yếu nhất lên đầu), ô "Chưa phân loại" cuối cùng. */
  skills: SkillBucket[];
}

/** Một dạng bài yếu — hình dạng WeakTopicsCard nhận (giữ tên trường `topic` từ bản trước). */
export interface TopicWeakness {
  subject: Subject;
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
}

/**
 * Số câu tối thiểu (cộng dồn qua mọi lượt làm) trước khi một dạng bài được phép
 * gọi là điểm yếu. Không có sàn này thì một câu sai duy nhất tạo ra một dạng
 * bài "0% — yếu nhất của bạn", đứng trên cả dạng bài sai 12/30 câu: nhiễu được
 * trình bày y hệt như bằng chứng. Thẻ "Kết quả theo dạng bài" KHÔNG áp sàn này
 * — nó là bảng kê, in kèm "Đúng a/b" nên bằng chứng nằm ngay cạnh con số.
 */
export const MIN_TOPIC_QUESTIONS = 4;

/** Trần số dòng "cần sửa" — danh sách dài thì không còn là ưu tiên nữa. */
export const MAX_WEAK_TOPICS = 3;

const RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = { week: 7, month: 30 };
const RANGES: readonly TimeRange[] = ["week", "month", "all"];

function isAnalyticsSubject(value: string): value is Subject {
  return (SUBJECT_ORDER as readonly string[]).includes(value);
}

const collator = new Intl.Collator("vi");

/**
 * Với 1 tập SkillAttemptRow[] + bảng tra + mốc `now` cố định (tiêm vào để test
 * tất định, cùng quy ước aggregateAttemptsByRange), trả về cho mỗi range danh
 * sách môn (theo SUBJECT_ORDER, chỉ môn có ít nhất một câu chấm tự động) với
 * các dạng bài của môn ấy.
 * - Cộng dồn theo (môn của ĐỀ, skill_node_id) qua mọi lượt làm trong range.
 *   Môn lấy từ đề chứ không từ câu — đúng nguồn biểu đồ "Kết quả theo môn".
 * - Môn ngoài SUBJECT_ORDER bị loại hẳn (cùng quy tắc với biểu đồ).
 * - `submittedAt` null/không parse được: vẫn tính vào "all", bỏ ở week/month.
 * - Thứ tự trong môn: accuracy tăng dần → total giảm dần → nhãn (collator vi);
 *   ô "Chưa phân loại" luôn cuối, dù tỉ lệ bao nhiêu.
 */
export function aggregateSkillsByRange(
  rows: readonly SkillAttemptRow[],
  lookup: SkillLookup,
  now: Date,
): Record<TimeRange, SubjectSkillBreakdown[]> {
  const result = {} as Record<TimeRange, SubjectSkillBreakdown[]>;

  for (const range of RANGES) {
    const lowerBound =
      range === "all" ? null : now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

    // subject → skillKey → bucket. skillKey "" = chưa phân loại (id thật không
    // bao giờ rỗng: slug ≥ 1 ký tự, test skillTaxonomy ghim).
    const bySubject = new Map<Subject, Map<string, { correct: number; total: number }>>();

    for (const row of rows) {
      if (!isAnalyticsSubject(row.subject)) continue;

      if (lowerBound !== null) {
        if (!row.submittedAt) continue;
        const submittedMs = Date.parse(row.submittedAt);
        if (Number.isNaN(submittedMs) || submittedMs < lowerBound) continue;
      }

      for (const q of row.perQuestion) {
        if (q.scored === false) continue;

        const nodeId = lookup.questionSkills.get(q.questionId) ?? null;
        // Thẻ trỏ node không còn nhãn (node đã xoá, FK set null chưa kịp chạy,
        // hoặc DB lệch code) đọc như chưa phân loại — không in một id thô.
        const key = nodeId !== null && lookup.nodeLabels.has(nodeId) ? nodeId : "";

        let skills = bySubject.get(row.subject);
        if (!skills) {
          skills = new Map();
          bySubject.set(row.subject, skills);
        }
        const bucket = skills.get(key) ?? { correct: 0, total: 0 };
        bucket.total += 1;
        if (q.isCorrect) bucket.correct += 1;
        skills.set(key, bucket);
      }
    }

    result[range] = SUBJECT_ORDER.filter((s) => bySubject.has(s)).map((subject) => {
      const skills = bySubject.get(subject)!;
      const tagged: SkillBucket[] = [];
      let untagged: SkillBucket | null = null;

      for (const [key, b] of skills) {
        const bucket: SkillBucket = {
          skillNodeId: key === "" ? null : key,
          labelVi: key === "" ? null : (lookup.nodeLabels.get(key) ?? null),
          correct: b.correct,
          total: b.total,
          accuracy: b.total > 0 ? b.correct / b.total : 0,
        };
        if (key === "") untagged = bucket;
        else tagged.push(bucket);
      }

      tagged.sort(
        (a, b) =>
          a.accuracy - b.accuracy ||
          b.total - a.total ||
          collator.compare(a.labelVi ?? "", b.labelVi ?? ""),
      );

      return { subject, skills: untagged ? [...tagged, untagged] : tagged };
    });
  }

  return result;
}

/**
 * "Cần sửa chỗ nào" của MỘT range: tối đa MAX_WEAK_TOPICS dạng bài đã gắn thẻ,
 * đủ MIN_TOPIC_QUESTIONS câu, đúng dưới `threshold` — xếp yếu nhất trước.
 * Ô "Chưa phân loại" không bao giờ vào đây: "yếu ở chỗ chưa biết là chỗ nào"
 * không phải một việc để làm.
 * - Thứ tự: accuracy tăng dần → total giảm dần (nhiều bằng chứng hơn đứng
 *   trước khi hoà) → tên môn → nhãn (tất định qua mọi lần đọc).
 */
export function rankWeakSkills(
  breakdown: readonly SubjectSkillBreakdown[],
  threshold: number,
): TopicWeakness[] {
  const candidates: TopicWeakness[] = [];
  for (const { subject, skills } of breakdown) {
    for (const s of skills) {
      if (s.skillNodeId === null || s.labelVi === null) continue;
      if (s.total < MIN_TOPIC_QUESTIONS) continue;
      if (s.accuracy >= threshold) continue;
      candidates.push({
        subject,
        topic: s.labelVi,
        correct: s.correct,
        total: s.total,
        accuracy: s.accuracy,
      });
    }
  }

  return candidates
    .sort(
      (a, b) =>
        a.accuracy - b.accuracy ||
        b.total - a.total ||
        a.subject.localeCompare(b.subject) ||
        collator.compare(a.topic, b.topic),
    )
    .slice(0, MAX_WEAK_TOPICS);
}

/** Tiện ích cho queries.ts: cả ba range trong một lượt. */
export function rankWeakSkillsByRange(
  byRange: Record<TimeRange, SubjectSkillBreakdown[]>,
  threshold: number,
): Record<TimeRange, TopicWeakness[]> {
  return {
    week: rankWeakSkills(byRange.week, threshold),
    month: rankWeakSkills(byRange.month, threshold),
    all: rankWeakSkills(byRange.all, threshold),
  };
}
