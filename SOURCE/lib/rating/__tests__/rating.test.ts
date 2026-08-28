// SOURCE/lib/rating — unit tests. Literal-fixture vitest theo backend DD
// (§ Test Boundaries — vitest — SOURCE/lib/rating/__tests__/rating.test.ts).
// Không I/O; mỗi assertion dùng giá trị literal tính độc lập với implementation.

import { describe, expect, it } from "vitest";
import {
  BUCKET_HARD_MIN,
  BUCKET_MEDIUM_MIN,
  RATING_MAX,
  RATING_MIN,
  RATING_THRESHOLD,
  bucket,
  communityDifficultyFrom,
  formatMean,
  isValidPartScore,
  overall,
} from "../index";

describe("bucket — ranh giới nửa-mở [1,2.5) Easy / [2.5,3.5) Medium / [3.5,5] Hard (AC-018)", () => {
  it("bucket(2.4) → Easy", () => {
    expect(bucket(2.4)).toBe("Easy");
  });

  it("bucket(2.5) → Medium", () => {
    expect(bucket(2.5)).toBe("Medium");
  });

  it("bucket(3.4) → Medium", () => {
    expect(bucket(3.4)).toBe("Medium");
  });

  it("bucket(3.5) → Hard", () => {
    expect(bucket(3.5)).toBe("Hard");
  });

  it("bucket(1.0) → Easy (cận dưới)", () => {
    expect(bucket(1.0)).toBe("Easy");
  });

  it("bucket(5.0) → Hard (cận trên)", () => {
    expect(bucket(5.0)).toBe("Hard");
  });

  it("ranh giới xuất khẩu khớp bucket() — queries.ts lọc DB-side bằng chính chúng", () => {
    expect(BUCKET_MEDIUM_MIN).toBe(2.5);
    expect(BUCKET_HARD_MIN).toBe(3.5);
  });
});

describe("overall — mean 3 điểm phần (AC-003)", () => {
  it("overall(3,3,3) → 3", () => {
    expect(overall(3, 3, 3)).toBe(3);
  });

  it("overall(3,4,5) → 4", () => {
    expect(overall(3, 4, 5)).toBe(4);
  });

  it("overall(1,1,4) → 2", () => {
    expect(overall(1, 1, 4)).toBe(2);
  });
});

describe("communityDifficultyFrom — threshold gating (AC-014/015)", () => {
  it("count < RATING_THRESHOLD (2 ratings) → null", () => {
    expect(communityDifficultyFrom(3.0, 2)).toBeNull();
  });

  it("count === RATING_THRESHOLD (3 ratings) → {bucket, mean, count}", () => {
    expect(communityDifficultyFrom(3.0, 3)).toEqual({
      bucket: "Medium",
      mean: 3.0,
      count: 3,
    });
  });

  it("avgOverall null (view đã NULL dưới ngưỡng) → null dù count lớn", () => {
    expect(communityDifficultyFrom(null, 5)).toBeNull();
  });
});

describe("isValidPartScore — số nguyên trong [1,5] (AC-002)", () => {
  it("0 → false (dưới RATING_MIN)", () => {
    expect(isValidPartScore(0)).toBe(false);
  });

  it("6 → false (trên RATING_MAX)", () => {
    expect(isValidPartScore(6)).toBe(false);
  });

  it("10 → false (điểm thang CŨ 1-10 không còn hợp lệ)", () => {
    expect(isValidPartScore(10)).toBe(false);
  });

  it("2.5 → false (không nguyên)", () => {
    expect(isValidPartScore(2.5)).toBe(false);
  });

  it("1 → true (cận dưới hợp lệ)", () => {
    expect(isValidPartScore(1)).toBe(true);
  });

  it("5 → true (cận trên hợp lệ)", () => {
    expect(isValidPartScore(5)).toBe(true);
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
  it('formatMean(3.24) → "3.2"', () => {
    expect(formatMean(3.24)).toBe("3.2");
  });

  it('formatMean(4) → "4.0"', () => {
    expect(formatMean(4)).toBe("4.0");
  });
});

describe("RATING_MIN/RATING_MAX — hằng số miền giá trị điểm phần (AC-002)", () => {
  it("RATING_MIN === 1, RATING_MAX === 5 (thang sao)", () => {
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(5);
  });
});
