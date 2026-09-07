// aggregateAttemptsByRange [unit] — pure reducer, no I/O, no mocks needed.
// Design Doc: docs/design/analytics-layer3-data-logic-design.md
// § Acceptance Criteria (AC-01..AC-13), § Aggregation Algorithm.
// 2026-09-06: thêm `seconds` (thời gian làm bài cộng dồn theo môn) cho vòng
// tròn "Thời gian luyện theo môn" — docs/design/ui-refactor-san-truong-design.md §3.
//
// `now` is fixed and injected (never read from the system clock) so range
// boundaries are deterministic across runs.

import { describe, expect, it } from "vitest";
import { aggregateAttemptsByRange, type AttemptRow } from "../aggregateAttempts";

const NOW = new Date("2026-07-31T00:00:00.000Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** `submittedAt` lùi `minutes` phút — mốc bắt đầu của một lượt. */
function minutesBefore(submittedAt: string, minutes: number): string {
  return new Date(Date.parse(submittedAt) - minutes * 60 * 1000).toISOString();
}

const DEFAULT_SUBMITTED = daysAgo(1);

function row(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    correct: 8,
    total: 10,
    startedAt: minutesBefore(DEFAULT_SUBMITTED, 10),
    submittedAt: DEFAULT_SUBMITTED,
    durationMinutes: 45,
    subject: "Math",
    ...overrides,
  };
}

describe("aggregateAttemptsByRange", () => {
  it("AC-01/AC-02/AC-03: sums correct, derives wrong = total - correct, counts sessions", () => {
    const rows = [
      row({ correct: 8, total: 10, subject: "Math" }),
      row({ correct: 5, total: 10, subject: "Math" }),
    ];
    const result = aggregateAttemptsByRange(rows, NOW);
    const math = result.week.find((s) => s.subject === "Math");
    expect(math).toEqual({ subject: "Math", correct: 13, wrong: 7, sessions: 2, seconds: 1200 });
  });

  it("AC-02: wrong is always derived (total - correct), never a stored field", () => {
    const rows = [row({ correct: 3, total: 10, subject: "Physics" })];
    const result = aggregateAttemptsByRange(rows, NOW);
    expect(result.week.find((s) => s.subject === "Physics")?.wrong).toBe(7);
  });

  it("AC-04: a non-union subject (e.g. Geography) contributes to no range's output, no 'Other' bucket", () => {
    const rows = [row({ subject: "Geography" })];
    const result = aggregateAttemptsByRange(rows, NOW);
    expect(result.week).toEqual([]);
    expect(result.month).toEqual([]);
    expect(result.all).toEqual([]);
  });

  it("AC-05: zero-attempt subjects are omitted; present subjects follow SUBJECT_ORDER regardless of row arrival order", () => {
    const rows = [row({ subject: "English" }), row({ subject: "Math" })];
    const result = aggregateAttemptsByRange(rows, NOW);
    // SUBJECT_ORDER = [Math, Physics, Chemistry, Biology, Literature, English, History]
    expect(result.week.map((s) => s.subject)).toEqual(["Math", "English"]);
  });

  it("AC-06: range boundaries — 3 days ago in all 3 ranges; 20 days ago in month+all only; 200 days ago in all only", () => {
    const rows = [
      row({ subject: "Math", submittedAt: daysAgo(3) }),
      row({ subject: "Physics", submittedAt: daysAgo(20) }),
      row({ subject: "Chemistry", submittedAt: daysAgo(200) }),
    ];
    const result = aggregateAttemptsByRange(rows, NOW);

    expect(result.week.map((s) => s.subject)).toEqual(["Math"]);
    expect(result.month.map((s) => s.subject)).toEqual(["Math", "Physics"]);
    expect(result.all.map((s) => s.subject)).toEqual(["Math", "Physics", "Chemistry"]);
  });

  it("defensive rule: null submittedAt is counted in 'all' but skipped for 'week'/'month' (never throws)", () => {
    const rows = [row({ subject: "Biology", submittedAt: null })];
    const result = aggregateAttemptsByRange(rows, NOW);

    expect(result.week).toEqual([]);
    expect(result.month).toEqual([]);
    // Không có mốc nộp thì không đo được thời gian — lượt vẫn đếm, giây = 0.
    expect(result.all).toEqual([{ subject: "Biology", correct: 8, wrong: 2, sessions: 1, seconds: 0 }]);
  });

  it("seconds (2026-09-06): started→submitted per attempt, summed per subject, sliced by range like everything else", () => {
    const rows = [
      row({ subject: "Math", submittedAt: daysAgo(3), startedAt: minutesBefore(daysAgo(3), 25) }),
      row({ subject: "Math", submittedAt: daysAgo(20), startedAt: minutesBefore(daysAgo(20), 40) }),
      row({ subject: "Physics", submittedAt: daysAgo(3), startedAt: minutesBefore(daysAgo(3), 5) }),
    ];
    const result = aggregateAttemptsByRange(rows, NOW);

    expect(result.week.map((s) => [s.subject, s.seconds])).toEqual([
      ["Math", 25 * 60],
      ["Physics", 5 * 60],
    ]);
    expect(result.month.find((s) => s.subject === "Math")?.seconds).toBe(65 * 60);
    expect(result.all.find((s) => s.subject === "Math")?.seconds).toBe(65 * 60);
  });

  it("seconds: a broken attempt (missing/unparseable start, or submitted before started) adds 0, never throws or goes negative", () => {
    const rows = [
      row({ subject: "Math", startedAt: null }),
      row({ subject: "Math", startedAt: "not-a-date" }),
      // Nộp TRƯỚC khi bắt đầu — dữ liệu hỏng, không được kéo tổng xuống âm.
      row({ subject: "Math", startedAt: minutesBefore(DEFAULT_SUBMITTED, -15) }),
      row({ subject: "Math" }),
    ];
    const result = aggregateAttemptsByRange(rows, NOW);
    const math = result.all.find((s) => s.subject === "Math");
    expect(math?.sessions).toBe(4);
    expect(math?.seconds).toBe(600);
  });

  it("seconds: one attempt never counts more than the exam's duration — an attempt left open for days is capped, no cap when duration is null/0", () => {
    const rows = [
      // 15-minute exam left open for three days before submitting → 15 minutes.
      row({ subject: "Math", startedAt: daysAgo(4), durationMinutes: 15 }),
      // 45-minute exam finished in 20 minutes → the real 20 minutes.
      row({ subject: "Math", startedAt: minutesBefore(DEFAULT_SUBMITTED, 20), durationMinutes: 45 }),
      // No duration known → raw elapsed time.
      row({ subject: "Physics", startedAt: minutesBefore(DEFAULT_SUBMITTED, 200), durationMinutes: null }),
      row({ subject: "Chemistry", startedAt: minutesBefore(DEFAULT_SUBMITTED, 200), durationMinutes: 0 }),
    ];
    const result = aggregateAttemptsByRange(rows, NOW);
    expect(result.week.map((s) => [s.subject, s.seconds])).toEqual([
      ["Math", 15 * 60 + 20 * 60],
      ["Physics", 200 * 60],
      ["Chemistry", 200 * 60],
    ]);
  });

  it("empty input resolves to empty arrays for every range, without throwing", () => {
    const result = aggregateAttemptsByRange([], NOW);
    expect(result).toEqual({ week: [], month: [], all: [] });
  });
});
