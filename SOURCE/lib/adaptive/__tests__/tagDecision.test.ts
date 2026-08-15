// decideSkillTag() [unit] — AC-005/006/007
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (§ tagQuestionSkills.ts)
//
// Cổng tin cậy của batch tagger được tách khỏi supabase/tagQuestionSkills.ts ra
// đây vì hai lý do: (1) vitest.config.ts không thu supabase/** nên logic nằm
// trong script là logic KHÔNG được test; (2) đúng một hàm thuần quyết định cả
// nội dung report (dry-run) lẫn nội dung ghi (--apply), nên "report nói một
// đằng, DB ghi một nẻo" — lớp lỗi kinh điển của script dry-run/apply — trở
// thành bất khả thi về mặt cấu trúc chứ không phải nhờ kỷ luật code.

import { describe, expect, it } from "vitest";

import { SKILL_TAG_CONFIDENCE_THRESHOLD } from "../constants";
import { decideSkillTag } from "../tagDecision";

const KNOWN = new Set(["nguyen-ham", "tich-phan"]);
const T = SKILL_TAG_CONFIDENCE_THRESHOLD;

describe("AC-005 — không bao giờ GHI tag dưới ngưỡng tin cậy", () => {
  it("dưới ngưỡng → left-null, không ghi", () => {
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: { skillNodeId: "nguyen-ham", confidence: T - 0.01 },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("left-null");
    expect(d.skillNodeId).toBeNull();
    expect(d.writeNeeded).toBe(false);
    expect(d.reason).toBe("below-threshold");
  });

  it("ĐÚNG bằng ngưỡng → tagged (biên là >=, không phải >)", () => {
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: { skillNodeId: "nguyen-ham", confidence: T },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("tagged");
    expect(d.skillNodeId).toBe("nguyen-ham");
    expect(d.writeNeeded).toBe(true);
    expect(d.reason).toBe("at-or-above-threshold");
  });

  it("trên ngưỡng → tagged", () => {
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: { skillNodeId: "tich-phan", confidence: 0.99 },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("tagged");
    expect(d.skillNodeId).toBe("tich-phan");
  });

  it("model trả node KHÔNG có trong taxonomy → left-null dù confidence cao", () => {
    // Gemini bịa ra một slug nghe hợp lý: nếu lọt xuống UPDATE thì FK của
    // questions.skill_node_id sẽ ném lỗi và làm hỏng cả batch, còn nếu slug đó
    // vô tình tồn tại thì câu hỏi bị gắn sai âm thầm (PRD R-a).
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: { skillNodeId: "dao-ham-bia-ra", confidence: 1 },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("left-null");
    expect(d.skillNodeId).toBeNull();
    expect(d.writeNeeded).toBe(false);
    expect(d.reason).toBe("unknown-node");
  });

  it("gọi Gemini lỗi (classification null) → left-null, không phải crash", () => {
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: null,
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("left-null");
    expect(d.reason).toBe("classification-error");
    expect(d.writeNeeded).toBe(false);
  });

  it("confidence null/NaN → left-null (không coi như 0 rồi lỡ so sánh sai)", () => {
    for (const confidence of [null, Number.NaN]) {
      const d = decideSkillTag({
        existingSkillNodeId: null,
        classification: { skillNodeId: "nguyen-ham", confidence },
        knownNodeIds: KNOWN,
        threshold: T,
      });

      expect(d.decision).toBe("left-null");
      expect(d.writeNeeded).toBe(false);
    }
  });

  it("model tự nhận không xếp được → 'no-matching-node', KHÔNG phải 'classification-error'", () => {
    // Hai thứ khác hẳn nhau về hành động tiếp theo: câu ngoài taxonomy thì
    // không cần làm gì, còn lời gọi rớt mạng thì chạy lại là tag được. Report
    // là vật liệu engineer duyệt (AC-008) nên không được gộp nhãn.
    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: { skillNodeId: null, confidence: 0 },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("left-null");
    expect(d.reason).toBe("no-matching-node");
  });

  it("lời gọi Gemini thất bại vẫn giữ nhãn riêng 'classification-error'", () => {
    expect(
      decideSkillTag({
        existingSkillNodeId: null,
        classification: null,
        knownNodeIds: KNOWN,
        threshold: T,
      }).reason,
    ).toBe("classification-error");
  });
});

describe("AC-006 — chạy lại --apply trên corpus không đổi ra đúng trạng thái cũ", () => {
  it("câu đã có tag → giữ nguyên tag cũ, KHÔNG ghi lại, KHÔNG phân loại lại", () => {
    // Đây là mặt trái của failure mode mà task nêu đích danh: lần chạy --apply
    // thứ hai phân loại lại câu đã tag, và vì Gemini không tất định, tag có thể
    // nhảy sang node khác. Chặn bằng cách không đụng tới câu đã có tag.
    const d = decideSkillTag({
      existingSkillNodeId: "nguyen-ham",
      classification: { skillNodeId: "tich-phan", confidence: 1 },
      knownNodeIds: KNOWN,
      threshold: T,
    });

    expect(d.decision).toBe("tagged");
    expect(d.skillNodeId).toBe("nguyen-ham");
    expect(d.writeNeeded).toBe(false);
    expect(d.reason).toBe("already-tagged");
  });

  it("quyết định là hàm thuần của đầu vào: cùng đầu vào → deep-equal", () => {
    const input = {
      existingSkillNodeId: null,
      classification: { skillNodeId: "nguyen-ham", confidence: 0.9 },
      knownNodeIds: KNOWN,
      threshold: T,
    };

    expect(decideSkillTag(input)).toEqual(decideSkillTag({ ...input }));
  });
});

describe("AC-007 — mọi câu được xét rơi vào đúng MỘT trong hai trạng thái", () => {
  it("mọi tổ hợp đầu vào đều trả 'tagged' hoặc 'left-null', không có trạng thái thứ ba", () => {
    const classifications = [
      null,
      { skillNodeId: null, confidence: null },
      { skillNodeId: "nguyen-ham", confidence: 0.1 },
      { skillNodeId: "nguyen-ham", confidence: 0.99 },
      { skillNodeId: "bia-dat", confidence: 0.99 },
    ];

    for (const existingSkillNodeId of [null, "tich-phan"]) {
      for (const classification of classifications) {
        const d = decideSkillTag({
          existingSkillNodeId,
          classification,
          knownNodeIds: KNOWN,
          threshold: T,
        });

        expect(["tagged", "left-null"]).toContain(d.decision);
        // Bất biến nối report với DB: 'tagged' <=> có id, 'left-null' <=> null.
        expect(d.skillNodeId === null).toBe(d.decision === "left-null");
      }
    }
  });
});
