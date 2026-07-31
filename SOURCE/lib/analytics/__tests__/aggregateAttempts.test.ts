// aggregateAttemptsByRange [unit] — pure reducer, no I/O, no mocks needed.
// Design Doc: docs/design/analytics-layer3-data-logic-design.md
// § Acceptance Criteria (AC-01..AC-13), § Aggregation Algorithm.
//
// `now` is fixed and injected (never read from the system clock) so range
// boundaries are deterministic across runs.

import { describe, expect, it } from "vitest";
import { aggregateAttemptsByRange, type AttemptRow } from "../aggregateAttempts";

const NOW = new Date("2026-07-31T00:00:00.000Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

function row(overrides: Partial<AttemptRow>): AttemptRow {
  return {
    correct: 8,
    total: 10,
    submittedAt: daysAgo(1),
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
    expect(math).toEqual({ subject: "Math", correct: 13, wrong: 7, sessions: 2 });
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
    expect(result.all).toEqual([{ subject: "Biology", correct: 8, wrong: 2, sessions: 1 }]);
  });

  it("empty input resolves to empty arrays for every range, without throwing", () => {
    const result = aggregateAttemptsByRange([], NOW);
    expect(result).toEqual({ week: [], month: [], all: [] });
  });
});
