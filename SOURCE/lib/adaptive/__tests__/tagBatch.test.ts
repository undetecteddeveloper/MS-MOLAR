// tagBatch [unit] — phần thuần của batch tagger 7 môn (2026-09-16).
// Không I/O, không mock: prompt là chuỗi, phản hồi là chuỗi, report là object.

import { describe, expect, it } from "vitest";

import {
  buildBatchPrompt,
  chunkBatches,
  classificationsFromReport,
  findSharedKeyMatch,
  parseBatchResponse,
  type BatchQuestion,
} from "../tagBatch";
import { decideSkillTag } from "../tagDecision";

const CATALOGUE = [
  { id: "ly-dong-hoc", labelVi: "Động học chất điểm" },
  { id: "ly-quang-hinh", labelVi: "Quang hình học" },
];

const QUESTIONS: BatchQuestion[] = [
  { id: "q1", content: "Tiêu cự của thấu kính hội tụ…", grade: 11, questionType: "mcq" },
  { id: "q2", content: "", grade: null, questionType: null },
];

describe("buildBatchPrompt", () => {
  it("liệt kê đúng danh mục của môn, mọi questionId, và chỉ dẫn riêng của môn", () => {
    const prompt = buildBatchPrompt({
      subject: "Physics",
      subjectLabel: "Vật lý",
      catalogue: CATALOGUE,
      questions: QUESTIONS,
    });

    expect(prompt).toContain("Vật lý");
    expect(prompt).toContain("- ly-dong-hoc: Động học chất điểm");
    expect(prompt).toContain("- ly-quang-hinh: Quang hình học");
    expect(prompt).toContain("questionId=q1 (lớp: 11, dạng: mcq)");
    expect(prompt).toContain("questionId=q2 (lớp: không rõ, dạng: không rõ)");
    expect(prompt).toContain("(nội dung rỗng)");
    // Chỉ dẫn của Lý có mặt, chỉ dẫn của môn khác thì không.
    expect(prompt).toContain("`ly-quang-hinh`");
    expect(prompt).not.toContain("van-tieng-viet");
    expect(prompt).toContain("2 câu");
  });

  it("môn không có chỉ dẫn riêng vẫn dựng được prompt", () => {
    const prompt = buildBatchPrompt({
      subject: "History",
      subjectLabel: "Lịch sử",
      catalogue: [{ id: "su-ho-chi-minh", labelVi: "Hồ Chí Minh trong lịch sử Việt Nam" }],
      questions: [QUESTIONS[0]],
    });

    expect(prompt).toContain("Lịch sử");
    expect(prompt).toContain("- su-ho-chi-minh:");
  });
});

describe("parseBatchResponse", () => {
  it("đọc đúng từng câu; chuỗi rỗng → skillNodeId null; giữ confidence", () => {
    const text = JSON.stringify({
      results: [
        { questionId: "q1", skillNodeId: "ly-quang-hinh", confidence: 0.96 },
        { questionId: "q2", skillNodeId: "", confidence: 0 },
      ],
    });

    const { byQuestionId, warnings } = parseBatchResponse(text, ["q1", "q2"]);

    expect(byQuestionId.get("q1")).toEqual({ skillNodeId: "ly-quang-hinh", confidence: 0.96 });
    expect(byQuestionId.get("q2")).toEqual({ skillNodeId: null, confidence: 0 });
    expect(warnings).toEqual([]);
  });

  it("câu thiếu trong phản hồi → null (classification-error), kèm warning", () => {
    const text = JSON.stringify({
      results: [{ questionId: "q1", skillNodeId: "ly-quang-hinh", confidence: 0.9 }],
    });

    const { byQuestionId, warnings } = parseBatchResponse(text, ["q1", "q2"]);

    expect(byQuestionId.get("q2")).toBeNull();
    expect(warnings).toEqual(["câu q2 không có trong phản hồi"]);
  });

  it("questionId lạ bị bỏ, questionId lặp giữ phần tử đầu", () => {
    const text = JSON.stringify({
      results: [
        { questionId: "q1", skillNodeId: "ly-dong-hoc", confidence: 0.5 },
        { questionId: "q1", skillNodeId: "ly-quang-hinh", confidence: 0.99 },
        { questionId: "q-la", skillNodeId: "ly-quang-hinh", confidence: 0.99 },
      ],
    });

    const { byQuestionId, warnings } = parseBatchResponse(text, ["q1"]);

    expect(byQuestionId.get("q1")).toEqual({ skillNodeId: "ly-dong-hoc", confidence: 0.5 });
    expect(byQuestionId.has("q-la")).toBe(false);
    expect(warnings.length).toBe(2);
  });

  it("JSON hỏng / thiếu results / phản hồi rỗng → cả lô null, không ném", () => {
    for (const text of ["{oops", JSON.stringify({ nope: [] }), undefined, ""]) {
      const { byQuestionId, warnings } = parseBatchResponse(text, ["q1", "q2"]);
      expect([...byQuestionId.values()]).toEqual([null, null]);
      expect(warnings.length).toBeGreaterThan(0);
    }
  });

  it("confidence không phải số → decideSkillTag báo classification-error, không tag", () => {
    const text = JSON.stringify({
      results: [{ questionId: "q1", skillNodeId: "ly-quang-hinh", confidence: "0.99" }],
    });
    const { byQuestionId } = parseBatchResponse(text, ["q1"]);

    const d = decideSkillTag({
      existingSkillNodeId: null,
      classification: byQuestionId.get("q1") ?? null,
      knownNodeIds: new Set(["ly-quang-hinh"]),
      threshold: 0.9,
    });

    expect(d.reason).toBe("classification-error");
    expect(d.decision).toBe("left-null");
  });
});

describe("chunkBatches", () => {
  it("chia đúng cỡ và giữ thứ tự; lô cuối ngắn hơn", () => {
    expect(chunkBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkBatches([], 3)).toEqual([]);
  });

  it("cỡ lô không hợp lệ thì ném", () => {
    expect(() => chunkBatches([1], 0)).toThrow();
    expect(() => chunkBatches([1], 1.5)).toThrow();
  });
});

describe("classificationsFromReport — --apply --from-report ghi đúng thứ đã duyệt", () => {
  const report = {
    meta: { subject: "Physics" },
    entries: [
      {
        questionId: "tagged",
        modelSkillNodeId: "ly-quang-hinh",
        proposedSkillNodeId: "ly-quang-hinh",
        confidence: 0.95,
        reason: "at-or-above-threshold",
      },
      {
        questionId: "below",
        modelSkillNodeId: "ly-dong-hoc",
        proposedSkillNodeId: null,
        confidence: 0.85,
        reason: "below-threshold",
      },
      {
        questionId: "none",
        modelSkillNodeId: null,
        proposedSkillNodeId: null,
        confidence: 0,
        reason: "no-matching-node",
      },
      { questionId: "err", modelSkillNodeId: null, proposedSkillNodeId: null, confidence: null, reason: "classification-error" },
    ],
  };

  it("map từng dòng về phân loại; classification-error → null", () => {
    const map = classificationsFromReport(report);

    expect(map.get("tagged")).toEqual({ skillNodeId: "ly-quang-hinh", confidence: 0.95 });
    expect(map.get("below")).toEqual({ skillNodeId: "ly-dong-hoc", confidence: 0.85 });
    expect(map.get("none")).toEqual({ skillNodeId: null, confidence: 0 });
    expect(map.get("err")).toBeNull();
  });

  it("qua decideSkillTag: dòng tagged ghi, dòng below-threshold vẫn NULL với đúng lý do cũ", () => {
    const map = classificationsFromReport(report);
    const known = new Set(["ly-quang-hinh", "ly-dong-hoc"]);

    const tagged = decideSkillTag({
      existingSkillNodeId: null,
      classification: map.get("tagged") ?? null,
      knownNodeIds: known,
      threshold: 0.9,
    });
    const below = decideSkillTag({
      existingSkillNodeId: null,
      classification: map.get("below") ?? null,
      knownNodeIds: known,
      threshold: 0.9,
    });

    expect(tagged).toMatchObject({ decision: "tagged", writeNeeded: true, skillNodeId: "ly-quang-hinh" });
    expect(below).toMatchObject({ decision: "left-null", reason: "below-threshold" });
  });

  it("report bản cũ (mảng thuần, không có modelSkillNodeId) vẫn đọc được", () => {
    const legacy = [
      {
        questionId: "x",
        proposedSkillNodeId: "tich-phan",
        confidence: 1,
        decision: "tagged",
        reason: "at-or-above-threshold",
        wrote: true,
      },
    ];

    expect(classificationsFromReport(legacy).get("x")).toEqual({
      skillNodeId: "tich-phan",
      confidence: 1,
    });
  });

  it("không phải report thì ném — không im lặng ghi 0 dòng", () => {
    expect(() => classificationsFromReport({ meta: {} })).toThrow();
    expect(() => classificationsFromReport("x")).toThrow();
  });
});

describe("findSharedKeyMatch — key gắn thẻ không được là key của app (TD-019)", () => {
  const appKeys = [
    { file: ".env.local", key: "AIza-dev" },
    { file: ".env.local.prod-backup", key: "AIza-prod " },
  ];

  it("trùng key app (kể cả khác khoảng trắng) → trả tên file trùng", () => {
    expect(findSharedKeyMatch("AIza-prod", appKeys)).toBe(".env.local.prod-backup");
    expect(findSharedKeyMatch(" AIza-dev\n", appKeys)).toBe(".env.local");
  });

  it("key riêng → null; file không có key → bỏ qua", () => {
    expect(findSharedKeyMatch("AIza-tagging", appKeys)).toBeNull();
    expect(findSharedKeyMatch("AIza-tagging", [{ file: "x", key: undefined }])).toBeNull();
  });

  it("key rỗng không bao giờ 'trùng' (lỗi thiếu key báo ở chỗ khác)", () => {
    expect(findSharedKeyMatch("", [{ file: "x", key: "" }])).toBeNull();
  });
});
