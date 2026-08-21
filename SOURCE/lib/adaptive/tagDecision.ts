// Cổng quyết định của batch tagger (Engine 1, PRD R2/D2, AC-005/006/007).
//
// Tách khỏi supabase/tagQuestionSkills.ts có chủ ý: vitest.config.ts không thu
// supabase/**, nên logic để trong script là logic không được test. Quan trọng
// hơn, cả nhánh dry-run (dựng report) lẫn nhánh --apply (ghi DB) đều gọi ĐÚNG
// hàm này, nên "report nói một đằng, DB ghi một nẻo" là bất khả thi về cấu
// trúc chứ không phải nhờ kỷ luật khi sửa code.
//
// Không I/O, không đọc env, không gọi Gemini — kết quả phân loại được TIÊM vào.

export interface SkillClassification {
  /** Node model đề xuất; null khi model tự nhận không xếp được. */
  skillNodeId: string | null;
  /** Độ tin cậy 0..1; null/NaN được coi là không có tín hiệu. */
  confidence: number | null;
}

export type TagDecisionReason =
  | "already-tagged"
  | "at-or-above-threshold"
  | "below-threshold"
  | "unknown-node"
  /** Model tự nhận câu hỏi không thuộc node nào — một câu trả lời hợp lệ. */
  | "no-matching-node"
  /** Lời gọi Gemini thất bại (mạng, quota, payload hỏng) — KHÔNG phải câu trả lời. */
  | "classification-error";

export interface TagDecision {
  /**
   * Trạng thái CUỐI của câu hỏi sau lần chạy này — chỉ hai giá trị, để mọi
   * câu được xét rơi vào đúng một trạng thái (AC-007: 0 câu ở trạng thái
   * không xác định).
   */
  decision: "tagged" | "left-null";
  /** Giá trị questions.skill_node_id sẽ có sau lần chạy này. */
  skillNodeId: string | null;
  confidence: number | null;
  reason: TagDecisionReason;
  /**
   * Có cần chạy UPDATE hay không. Tách khỏi `decision` vì câu đã có tag từ
   * lần trước cũng là "tagged" nhưng KHÔNG được ghi lại — đó chính là thứ làm
   * lần chạy --apply thứ hai ra 0 dòng thay đổi (AC-006).
   */
  writeNeeded: boolean;
}

export interface DecideSkillTagInput {
  /** questions.skill_node_id hiện tại (null = chưa gắn). */
  existingSkillNodeId: string | null;
  /** Kết quả Gemini; null khi lời gọi thất bại. */
  classification: SkillClassification | null;
  /** Tập id node có thật trong taxonomy đã seed. */
  knownNodeIds: ReadonlySet<string>;
  /** SKILL_TAG_CONFIDENCE_THRESHOLD. */
  threshold: number;
}

/**
 * Quyết định trạng thái tag cho MỘT câu hỏi.
 *
 * Thứ tự nhánh là cố ý: câu đã có tag được trả về trước khi bất kỳ kết quả
 * phân loại nào được xét, nên một lần chạy lại không thể lật tag cũ sang node
 * khác dù Gemini lần này trả kết quả khác (Gemini không tất định — idempotence
 * "by construction" của thao tác UPDATE một cột không tự nó đủ để chặn việc
 * đó).
 *
 * Mọi nhánh không chắc chắn đều rơi về `left-null` chứ không đoán: một tag sai
 * không hiện ra như lỗi, học sinh chỉ đơn giản bị đẩy đi luyện sai thứ và mô
 * hình mastery học theo cái sai đó (PRD R-a). Cùng quy ước với
 * `normalizeSubject()` (lib/ugc/subjects.ts) trả null thay vì đoán.
 */
export function decideSkillTag(input: DecideSkillTagInput): TagDecision {
  const { existingSkillNodeId, classification, knownNodeIds, threshold } = input;

  if (existingSkillNodeId !== null) {
    return {
      decision: "tagged",
      skillNodeId: existingSkillNodeId,
      confidence: null,
      reason: "already-tagged",
      writeNeeded: false,
    };
  }

  const leftNull = (reason: TagDecisionReason, confidence: number | null): TagDecision => ({
    decision: "left-null",
    skillNodeId: null,
    confidence,
    reason,
    writeNeeded: false,
  });

  if (classification === null) return leftNull("classification-error", null);

  const { skillNodeId, confidence } = classification;

  // Model tự nhận không xếp được: tách khỏi lỗi gọi hàm, vì report này là vật
  // liệu engineer đọc để duyệt (AC-008). Gộp hai thứ vào một nhãn thì một câu
  // hỏi nằm ngoài taxonomy (đúng, không cần làm gì) trông y hệt một lời gọi
  // rớt mạng (sai, chạy lại là tag được) — engineer không phân biệt nổi.
  if (skillNodeId === null) return leftNull("no-matching-node", confidence);

  if (confidence === null || !Number.isFinite(confidence)) {
    return leftNull("classification-error", null);
  }

  // Kiểm tra node có thật TRƯỚC ngưỡng: một slug bịa ra mà lọt xuống UPDATE sẽ
  // làm khoá ngoại questions.skill_node_id ném lỗi và hỏng cả batch.
  if (!knownNodeIds.has(skillNodeId)) return leftNull("unknown-node", confidence);

  if (confidence < threshold) return leftNull("below-threshold", confidence);

  return {
    decision: "tagged",
    skillNodeId,
    confidence,
    reason: "at-or-above-threshold",
    writeNeeded: true,
  };
}
