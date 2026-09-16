// aggregateSkillsByRange / rankWeakSkills [unit] — reducer thuần, không I/O,
// không mock. `now` cố định và tiêm vào (không đọc đồng hồ hệ thống) để biên
// range tất định — cùng quy ước với aggregateAttempts.test.ts.

import { describe, expect, it } from "vitest";
import {
  MAX_WEAK_TOPICS,
  MIN_TOPIC_QUESTIONS,
  aggregateSkillsByRange,
  rankWeakSkills,
  rankWeakSkillsByRange,
  type SkillAttemptRow,
  type SkillLookup,
} from "../skillBreakdown";

const NOW = new Date("2026-09-16T00:00:00.000Z");
const THRESHOLD = 0.75;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

const LOOKUP: SkillLookup = {
  questionSkills: new Map<string, string | null>([
    ["q-tp-1", "tich-phan"],
    ["q-tp-2", "tich-phan"],
    ["q-sp-1", "so-phuc"],
    ["q-null", null],
    ["q-ghost", "node-da-xoa"],
    ["q-ly-1", "ly-dong-hoc"],
    ["q-ly-2", "ly-dong-hoc"],
  ]),
  nodeLabels: new Map([
    ["tich-phan", "Tích phân"],
    ["so-phuc", "Số phức"],
    ["ly-dong-hoc", "Động học chất điểm"],
  ]),
};

function row(overrides: Partial<SkillAttemptRow>): SkillAttemptRow {
  return {
    subject: "Math",
    submittedAt: daysAgo(1),
    perQuestion: [
      { questionId: "q-tp-1", isCorrect: true },
      { questionId: "q-tp-2", isCorrect: false },
    ],
    ...overrides,
  };
}

describe("aggregateSkillsByRange", () => {
  it("cộng dồn theo (môn, dạng bài) qua nhiều lượt và tính accuracy sẵn", () => {
    const rows = [row({}), row({ perQuestion: [{ questionId: "q-tp-1", isCorrect: true }] })];

    const { week } = aggregateSkillsByRange(rows, LOOKUP, NOW);

    expect(week).toEqual([
      {
        subject: "Math",
        skills: [
          { skillNodeId: "tich-phan", labelVi: "Tích phân", correct: 2, total: 3, accuracy: 2 / 3 },
        ],
      },
    ]);
  });

  it("gom câu chưa gắn thẻ VÀ câu trỏ node không còn nhãn vào một ô 'Chưa phân loại', đứng cuối dù tỉ lệ cao", () => {
    const rows = [
      row({
        perQuestion: [
          { questionId: "q-null", isCorrect: true },
          { questionId: "q-ghost", isCorrect: true },
          { questionId: "q-chua-tung-thay", isCorrect: true },
          { questionId: "q-sp-1", isCorrect: true },
        ],
      }),
    ];

    const { all } = aggregateSkillsByRange(rows, LOOKUP, NOW);

    expect(all[0].skills.map((s) => [s.skillNodeId, s.labelVi, s.correct, s.total])).toEqual([
      ["so-phuc", "Số phức", 1, 1],
      [null, null, 3, 3],
    ]);
  });

  it("bỏ câu scored === false (tự luận) nhưng giữ câu scored undefined (dòng cũ = true)", () => {
    const rows = [
      row({
        perQuestion: [
          { questionId: "q-tp-1", isCorrect: false, scored: false },
          { questionId: "q-tp-2", isCorrect: true, scored: undefined },
          { questionId: "q-sp-1", isCorrect: true, scored: true },
        ],
      }),
    ];

    const { all } = aggregateSkillsByRange(rows, LOOKUP, NOW);

    expect(all[0].skills.map((s) => [s.skillNodeId, s.correct, s.total])).toEqual([
      ["so-phuc", 1, 1],
      ["tich-phan", 1, 1],
    ]);
  });

  it("một lượt toàn câu tự luận không tạo ra môn rỗng", () => {
    const rows = [
      row({
        subject: "Literature",
        perQuestion: [{ questionId: "q-null", isCorrect: false, scored: false }],
      }),
    ];

    expect(aggregateSkillsByRange(rows, LOOKUP, NOW).all).toEqual([]);
  });

  it("xếp môn theo SUBJECT_ORDER và trong môn: yếu nhất trước, hoà thì nhiều câu hơn trước", () => {
    const rows = [
      row({
        subject: "Physics",
        perQuestion: [
          { questionId: "q-ly-1", isCorrect: true },
          { questionId: "q-ly-2", isCorrect: true },
        ],
      }),
      row({
        subject: "Math",
        perQuestion: [
          { questionId: "q-tp-1", isCorrect: false },
          { questionId: "q-tp-2", isCorrect: true },
          { questionId: "q-sp-1", isCorrect: false },
        ],
      }),
    ];

    const { all } = aggregateSkillsByRange(rows, LOOKUP, NOW);

    expect(all.map((b) => b.subject)).toEqual(["Math", "Physics"]);
    // so-phuc 0/1 (0%) đứng trước tich-phan 1/2 (50%).
    expect(all[0].skills.map((s) => s.skillNodeId)).toEqual(["so-phuc", "tich-phan"]);
    expect(all[1].skills).toEqual([
      {
        skillNodeId: "ly-dong-hoc",
        labelVi: "Động học chất điểm",
        correct: 2,
        total: 2,
        accuracy: 1,
      },
    ]);
  });

  it("loại môn ngoài SUBJECT_ORDER (cùng quy tắc với biểu đồ)", () => {
    const rows = [row({ subject: "Geography" }), row({ subject: "" })];

    expect(aggregateSkillsByRange(rows, LOOKUP, NOW).all).toEqual([]);
  });

  it("tôn trọng biên range: lượt 10 ngày trước vào month/all nhưng không vào week; submittedAt null chỉ vào all", () => {
    const rows = [row({ submittedAt: daysAgo(10) }), row({ submittedAt: null })];

    const result = aggregateSkillsByRange(rows, LOOKUP, NOW);

    expect(result.week).toEqual([]);
    expect(result.month[0].skills[0].total).toBe(2);
    expect(result.all[0].skills[0].total).toBe(4);
  });

  it("không sửa đầu vào và không ném với perQuestion rỗng", () => {
    const rows = [row({ perQuestion: [] })];
    const frozen = Object.freeze(rows);

    expect(aggregateSkillsByRange(frozen, LOOKUP, NOW).all).toEqual([]);
  });
});

describe("rankWeakSkills", () => {
  const breakdown = (skills: { id: string | null; label: string | null; c: number; t: number }[]) => [
    {
      subject: "Math" as const,
      skills: skills.map((s) => ({
        skillNodeId: s.id,
        labelVi: s.label,
        correct: s.c,
        total: s.t,
        accuracy: s.t > 0 ? s.c / s.t : 0,
      })),
    },
  ];

  it(`bỏ dạng bài dưới ${MIN_TOPIC_QUESTIONS} câu — một câu sai không phải bằng chứng`, () => {
    const weak = rankWeakSkills(
      breakdown([{ id: "so-phuc", label: "Số phức", c: 0, t: MIN_TOPIC_QUESTIONS - 1 }]),
      THRESHOLD,
    );

    expect(weak).toEqual([]);
  });

  it("chỉ giữ dạng bài DƯỚI ngưỡng (đúng ngưỡng không phải điểm yếu)", () => {
    const weak = rankWeakSkills(
      breakdown([
        { id: "a", label: "Đúng ngưỡng", c: 3, t: 4 },
        { id: "b", label: "Dưới ngưỡng", c: 2, t: 4 },
      ]),
      THRESHOLD,
    );

    expect(weak.map((w) => w.topic)).toEqual(["Dưới ngưỡng"]);
  });

  it("không bao giờ đưa ô 'Chưa phân loại' vào danh sách cần sửa", () => {
    const weak = rankWeakSkills(breakdown([{ id: null, label: null, c: 0, t: 10 }]), THRESHOLD);

    expect(weak).toEqual([]);
  });

  it(`cắt còn ${MAX_WEAK_TOPICS} dòng, yếu nhất trước, hoà thì nhiều câu hơn trước`, () => {
    const weak = rankWeakSkills(
      breakdown([
        { id: "a", label: "A", c: 2, t: 4 }, // 50%
        { id: "b", label: "B", c: 1, t: 4 }, // 25%
        { id: "c", label: "C", c: 2, t: 8 }, // 25%, nhiều câu hơn → trước B
        { id: "d", label: "D", c: 0, t: 4 }, // 0%
        { id: "e", label: "E", c: 2, t: 5 }, // 40%
      ]),
      THRESHOLD,
    );

    expect(weak.map((w) => w.topic)).toEqual(["D", "C", "B"]);
    expect(weak[0]).toEqual({ subject: "Math", topic: "D", correct: 0, total: 4, accuracy: 0 });
  });

  it("rankWeakSkillsByRange áp cùng luật cho cả ba range", () => {
    const rows = [
      row({
        perQuestion: Array.from({ length: MIN_TOPIC_QUESTIONS }, () => ({
          questionId: "q-tp-1",
          isCorrect: false,
        })),
      }),
    ];
    const byRange = aggregateSkillsByRange(rows, LOOKUP, NOW);

    const weak = rankWeakSkillsByRange(byRange, THRESHOLD);

    for (const range of ["week", "month", "all"] as const) {
      expect(weak[range]).toEqual([
        { subject: "Math", topic: "Tích phân", correct: 0, total: MIN_TOPIC_QUESTIONS, accuracy: 0 },
      ]);
    }
  });
});
