import { describe, expect, it } from "vitest";
import { filterHistoryEntries } from "./filterEntries";
import type { MyHistoryEntry } from "@/app/(HM)/queries";

function entry(overrides: Partial<MyHistoryEntry>): MyHistoryEntry {
  return {
    attemptId: "attempt-1",
    examId: "exam-1",
    examTitle: "Đề Toán 10",
    subject: "Toán",
    totalScore: 5,
    startedAt: "2026-07-10T00:00:00.000Z",
    submittedAt: "2026-07-10T00:10:00.000Z",
    correct: 8,
    total: 10,
    // ADR-0018 — hai boolean BAT BUOC tren MyHistoryEntry. `false` la gia tri
    // dung o day: khong fixture nao trong file nay co cau tu luan. `tsc` tim ra
    // dong nay, dung nhu muc Quality Assurance cua Task B2.2 du doan.
    hasUnresolvedEssay: false,
    hasIncompleteEssay: false,
    ...overrides,
  };
}

describe("filterHistoryEntries", () => {
  it("returns every entry unchanged when no filters are set", () => {
    const entries = [entry({ attemptId: "a" }), entry({ attemptId: "b" })];
    expect(filterHistoryEntries(entries, {})).toEqual(entries);
  });

  it("filters by exact subject match", () => {
    const entries = [
      entry({ attemptId: "a", subject: "Toán" }),
      entry({ attemptId: "b", subject: "Vật lý" }),
    ];
    const result = filterHistoryEntries(entries, { subject: "Vật lý" });
    expect(result.map((e) => e.attemptId)).toEqual(["b"]);
  });

  it("filters by exact examId match", () => {
    const entries = [
      entry({ attemptId: "a", examId: "exam-1" }),
      entry({ attemptId: "b", examId: "exam-2" }),
    ];
    const result = filterHistoryEntries(entries, { examId: "exam-2" });
    expect(result.map((e) => e.attemptId)).toEqual(["b"]);
  });

  it("applies an inclusive score range (both bounds pass exactly at the boundary)", () => {
    const entries = [
      entry({ attemptId: "low", totalScore: 4 }),
      entry({ attemptId: "mid", totalScore: 6 }),
      entry({ attemptId: "high", totalScore: 8 }),
    ];
    const result = filterHistoryEntries(entries, { scoreMin: 4, scoreMax: 8 });
    expect(result.map((e) => e.attemptId)).toEqual(["low", "mid", "high"]);

    const narrower = filterHistoryEntries(entries, { scoreMin: 5, scoreMax: 7 });
    expect(narrower.map((e) => e.attemptId)).toEqual(["mid"]);
  });

  it("applies an inclusive date range on submittedAt's date portion (both bounds pass exactly at the boundary)", () => {
    const entries = [
      entry({ attemptId: "early", submittedAt: "2026-07-01T08:00:00.000Z" }),
      entry({ attemptId: "mid", submittedAt: "2026-07-10T08:00:00.000Z" }),
      entry({ attemptId: "late", submittedAt: "2026-07-20T08:00:00.000Z" }),
    ];
    const result = filterHistoryEntries(entries, { dateFrom: "2026-07-01", dateTo: "2026-07-20" });
    expect(result.map((e) => e.attemptId)).toEqual(["early", "mid", "late"]);

    const narrower = filterHistoryEntries(entries, { dateFrom: "2026-07-05", dateTo: "2026-07-15" });
    expect(narrower.map((e) => e.attemptId)).toEqual(["mid"]);
  });

  it("combines multiple filters with AND semantics", () => {
    const entries = [
      entry({ attemptId: "match", subject: "Toán", totalScore: 7 }),
      entry({ attemptId: "wrong-subject", subject: "Vật lý", totalScore: 7 }),
      entry({ attemptId: "wrong-score", subject: "Toán", totalScore: 2 }),
    ];
    const result = filterHistoryEntries(entries, { subject: "Toán", scoreMin: 5 });
    expect(result.map((e) => e.attemptId)).toEqual(["match"]);
  });
});
