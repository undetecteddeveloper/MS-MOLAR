// SOURCE/lib/rating — unit tests. Literal-fixture vitest theo backend DD
// (§ Test Boundaries — vitest — SOURCE/lib/rating/__tests__/rating.test.ts).
// Không I/O; mỗi assertion dùng giá trị literal tính độc lập với implementation.

import { describe, expect, it } from "vitest";
import {
  RATING_MAX,
  RATING_MIN,
  RATING_THRESHOLD,
  bucket,
  communityDifficultyFrom,
  formatMean,
  isValidPartScore,
  overall,
} from "../index";

describe("bucket — ranh giới nửa-mở [1,4) Easy / [4,7) Medium / [7,10] Hard (AC-018)", () => {
  it("bucket(3.9) → Easy", () => {
    expect(bucket(3.9)).toBe("Easy");
  });

  it("bucket(4.0) → Medium", () => {
    expect(bucket(4.0)).toBe("Medium");
  });

  it("bucket(6.9) → Medium", () => {
    expect(bucket(6.9)).toBe("Medium");
  });

  it("bucket(7.0) → Hard", () => {
    expect(bucket(7.0)).toBe("Hard");
  });

  it("bucket(1.0) → Easy (cận dưới)", () => {
    expect(bucket(1.0)).toBe("Easy");
  });

  it("bucket(10.0) → Hard (cận trên)", () => {
    expect(bucket(10.0)).toBe("Hard");
  });
});

describe("overall — mean 3 điểm phần (AC-003)", () => {
  it("overall(3,3,3) → 3", () => {
    expect(overall(3, 3, 3)).toBe(3);
  });

  it("overall(7,8,9) → 8", () => {
    expect(overall(7, 8, 9)).toBe(8);
  });

  it("overall(1,1,4) → 2", () => {
    expect(overall(1, 1, 4)).toBe(2);
  });
});

describe("communityDifficultyFrom — threshold gating (AC-014/015)", () => {
  it("count < RATING_THRESHOLD (2 ratings) → null", () => {
    expect(communityDifficultyFrom(6.0, 2)).toBeNull();
  });

  it("count === RATING_THRESHOLD (3 ratings) → {bucket, mean, count}", () => {
    expect(communityDifficultyFrom(6.0, 3)).toEqual({
      bucket: "Medium",
      mean: 6.0,
      count: 3,
    });
  });

  it("avgOverall null (view đã NULL dưới ngưỡng) → null dù count lớn", () => {
    expect(communityDifficultyFrom(null, 5)).toBeNull();
  });
});

describe("isValidPartScore — số nguyên trong [1,10] (AC-002)", () => {
  it("0 → false (dưới RATING_MIN)", () => {
    expect(isValidPartScore(0)).toBe(false);
  });

  it("11 → false (trên RATING_MAX)", () => {
    expect(isValidPartScore(11)).toBe(false);
  });

  it("5.5 → false (không nguyên)", () => {
    expect(isValidPartScore(5.5)).toBe(false);
  });

  it("1 → true (cận dưới hợp lệ)", () => {
    expect(isValidPartScore(1)).toBe(true);
  });

  it("10 → true (cận trên hợp lệ)", () => {
    expect(isValidPartScore(10)).toBe(true);
  });
});

describe("threshold agreement — RATING_THRESHOLD khớp bản sao SQL của view", () => {
  it("RATING_THRESHOLD === 3, khớp literal `3` trong CASE WHEN của view exams_with_difficulty (schema.sql)", () => {
    // Bản sao SQL: `case when coalesce(agg.rating_count, 0) >= 3 then agg.avg_overall end`
    // trong view public.exams_with_difficulty (SOURCE/supabase/schema.sql, Task 1/2).
    // Không có hằng số vật lý chung băng qua ranh giới SQL/TS — test này +
    // RLS 2-vs-3-rating fixtures (test-rls.ts) cùng pin cả hai bản sao về 3.
    expect(RATING_THRESHOLD).toBe(3);
  });
});

describe("formatMean — làm tròn 1 chữ số thập phân để hiển thị (AC-014)", () => {
  it('formatMean(7.24) → "7.2"', () => {
    expect(formatMean(7.24)).toBe("7.2");
  });

  it('formatMean(7) → "7.0"', () => {
    expect(formatMean(7)).toBe("7.0");
  });
});

describe("RATING_MIN/RATING_MAX — hằng số miền giá trị điểm phần (AC-002)", () => {
  it("RATING_MIN === 1, RATING_MAX === 10", () => {
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(10);
  });
});
