// format — unit tests for the shared History/PDF formatters (Work Plan Phase 2
// Task 2.2). Single source of truth consumed identically by generateAttemptPdf.ts
// (Task 09), result/page.tsx's ScoreCard usage (Task 12), and HistoryRow (Task 13)
// — see docs/design/history-frontend-design.md § Data Contracts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPdfFilename, formatCompletionTime, formatSubmittedDate } from "./format";

describe("formatSubmittedDate", () => {
  it("formats an ISO timestamp as DD/MM/YYYY", () => {
    expect(formatSubmittedDate("2026-07-15T09:30:00.000Z")).toBe("15/07/2026");
  });

  it("pads single-digit day/month", () => {
    expect(formatSubmittedDate("2026-01-05T00:00:00.000Z")).toBe("05/01/2026");
  });

  it("returns em dash for null", () => {
    expect(formatSubmittedDate(null)).toBe("—");
  });

  it("returns em dash for an unparseable date, never throws", () => {
    expect(() => formatSubmittedDate("not-a-date")).not.toThrow();
    expect(formatSubmittedDate("not-a-date")).toBe("—");
  });
});

describe("formatCompletionTime", () => {
  it("formats as Ss when under 60 seconds", () => {
    expect(
      formatCompletionTime("2026-07-15T09:00:00.000Z", "2026-07-15T09:00:45.000Z"),
    ).toBe("45s");
  });

  it("formats as Mm Ss when at least 60s and under 60 minutes", () => {
    expect(
      formatCompletionTime("2026-07-15T09:00:00.000Z", "2026-07-15T09:05:30.000Z"),
    ).toBe("5m 30s");
  });

  it("formats as Hh Mm when at least 60 minutes", () => {
    expect(
      formatCompletionTime("2026-07-15T09:00:00.000Z", "2026-07-15T11:15:00.000Z"),
    ).toBe("2h 15m");
  });

  it("treats exactly 60 seconds as the Mm Ss boundary (not Ss)", () => {
    expect(
      formatCompletionTime("2026-07-15T09:00:00.000Z", "2026-07-15T09:01:00.000Z"),
    ).toBe("1m 0s");
  });

  it("treats exactly 60 minutes as the Hh Mm boundary (not Mm Ss)", () => {
    expect(
      formatCompletionTime("2026-07-15T09:00:00.000Z", "2026-07-15T10:00:00.000Z"),
    ).toBe("1h 0m");
  });

  it("returns em dash when submittedAt is null", () => {
    expect(formatCompletionTime("2026-07-15T09:00:00.000Z", null)).toBe("—");
  });

  it("returns em dash when submittedAt is unparseable, never throws", () => {
    expect(() =>
      formatCompletionTime("2026-07-15T09:00:00.000Z", "not-a-date"),
    ).not.toThrow();
    expect(formatCompletionTime("2026-07-15T09:00:00.000Z", "not-a-date")).toBe("—");
  });

  it("returns em dash when startedAt is unparseable, never throws", () => {
    expect(() =>
      formatCompletionTime("not-a-date", "2026-07-15T09:00:45.000Z"),
    ).not.toThrow();
    expect(formatCompletionTime("not-a-date", "2026-07-15T09:00:45.000Z")).toBe("—");
  });

  it("returns em dash when the computed diff is negative", () => {
    expect(
      formatCompletionTime("2026-07-15T09:05:00.000Z", "2026-07-15T09:00:00.000Z"),
    ).toBe("—");
  });
});

describe("buildPdfFilename", () => {
  it("builds the D2 example filename verbatim", () => {
    expect(buildPdfFilename("Algebra Midterm 1", "2026-07-15T09:00:00.000Z")).toBe(
      "algebra-midterm-1_20260715.pdf",
    );
  });

  it("collapses non-alphanumeric runs to a single hyphen and lowercases", () => {
    expect(
      buildPdfFilename("  Geometry: Chapter 2 -- Review!!  ", "2026-03-05T00:00:00.000Z"),
    ).toBe("geometry-chapter-2-review_20260305.pdf");
  });

  it("falls back to the exam slug for an empty/whitespace title", () => {
    expect(buildPdfFilename("   ", "2026-07-15T09:00:00.000Z")).toBe(
      "exam_20260715.pdf",
    );
  });

  it("falls back to the exam slug when the title has no alphanumeric characters", () => {
    expect(buildPdfFilename("!!!???", "2026-07-15T09:00:00.000Z")).toBe(
      "exam_20260715.pdf",
    );
  });

  it("truncates the slug to 60 chars with no trailing hyphen", () => {
    const longTitle = "a".repeat(70);
    const result = buildPdfFilename(longTitle, "2026-07-15T09:00:00.000Z");
    const slug = result.replace(/_\d{8}\.pdf$/, "");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
    expect(result).toBe(`${"a".repeat(60)}_20260715.pdf`);
  });

  it("truncation does not leave a trailing hyphen when the cut lands on a separator run", () => {
    // 59 'a's + a run of non-alphanumeric chars that collapses right at the 60-char cut.
    const title = `${"a".repeat(59)}   more text here`;
    const result = buildPdfFilename(title, "2026-07-15T09:00:00.000Z");
    const slug = result.replace(/_\d{8}\.pdf$/, "");
    expect(slug.endsWith("-")).toBe(false);
  });

  describe("submittedAt fallback to current date (mocked clock)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("falls back to the current date when submittedAt is null", () => {
      expect(buildPdfFilename("Algebra Midterm 1", null)).toBe(
        "algebra-midterm-1_20260731.pdf",
      );
    });

    it("falls back to the current date when submittedAt is unparseable", () => {
      expect(buildPdfFilename("Algebra Midterm 1", "not-a-date")).toBe(
        "algebra-midterm-1_20260731.pdf",
      );
    });
  });
});
