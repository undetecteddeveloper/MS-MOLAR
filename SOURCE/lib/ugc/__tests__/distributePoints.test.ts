import { describe, expect, it } from "vitest";
import { distributePoints, isTotalBalanced, sumPoints } from "@/lib/ugc/distributePoints";
import { LIMITS } from "@/lib/ugc/limits";

/** Bất biến duy nhất đáng kiểm: tổng trả về khớp `total` trong sai số của cổng publish. */
function totalOf(points: number[]): number {
  return points.reduce((a, b) => a + b, 0);
}

describe("distributePoints — chia đều", () => {
  it("chia hết thì mọi câu bằng nhau", () => {
    expect(distributePoints(4, [1, 1, 1, 1])).toEqual([1, 1, 1, 1]);
  });

  it("40 câu × 0.25 = 10 — đề thuần trắc nghiệm", () => {
    const out = distributePoints(10, Array(40).fill(1));
    expect(new Set(out)).toEqual(new Set([0.25]));
    expect(totalOf(out)).toBeCloseTo(10, 10);
  });

  it("3 điểm cho 7 câu: tổng vẫn ĐÚNG 3, phần dư dồn vào câu cuối", () => {
    // Ví dụ khởi phát của luật dồn dư: 3/7 = 0.428571…, làm tròn độc lập ra 3.01.
    const out = distributePoints(3, Array(7).fill(1));
    expect(out).toHaveLength(7);
    expect(totalOf(out)).toBeCloseTo(3, 10);
    expect(out.slice(0, 6)).toEqual([0.43, 0.43, 0.43, 0.43, 0.43, 0.43]);
    expect(out[6]).toBeCloseTo(0.42, 10);
  });

  it("tổng luôn khớp với mọi cặp (tổng, số câu) trong tầm đề thật", () => {
    for (const total of [1, 2, 2.5, 3, 5, 7, 10]) {
      for (let n = 1; n <= LIMITS.MAX_QUESTIONS; n++) {
        const out = distributePoints(total, Array(n).fill(1));
        if (out.length === 0) continue; // không chia nổi — nhánh riêng dưới
        expect(Math.abs(totalOf(out) - total)).toBeLessThanOrEqual(LIMITS.POINTS_EPSILON);
      }
    }
  });
});

describe("distributePoints — trọng số", () => {
  it("tôn trọng tỉ lệ: NLXH 2đ / NLVH 5đ trên tổng 7", () => {
    expect(distributePoints(7, [2, 5])).toEqual([2, 5]);
  });

  it("trọng số 0 = câu không nhận điểm, và KHÔNG bị dồn dư", () => {
    const out = distributePoints(3, [1, 0, 1]);
    expect(out[1]).toBe(0);
    expect(totalOf(out)).toBeCloseTo(3, 10);
  });

  it("mọi trọng số 0 ⇒ rơi về chia đều thay vì trả rỗng", () => {
    expect(distributePoints(2, [0, 0])).toEqual([1, 1]);
  });

  it("trọng số rác (NaN/âm) bị coi là 0, không làm hỏng tổng", () => {
    const out = distributePoints(4, [1, Number.NaN, -3, 1]);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
    expect(totalOf(out)).toBeCloseTo(4, 10);
  });
});

describe("distributePoints — từ chối thay vì trả biểu điểm cổng publish sẽ chặn", () => {
  it("nhóm rỗng", () => {
    expect(distributePoints(3, [])).toEqual([]);
  });

  it("tổng không dương hoặc không hữu hạn", () => {
    expect(distributePoints(0, [1, 1])).toEqual([]);
    expect(distributePoints(-1, [1, 1])).toEqual([]);
    expect(distributePoints(Number.NaN, [1, 1])).toEqual([]);
  });

  it("tổng quá nhỏ so với số câu ⇒ rỗng, không trả câu 0 điểm", () => {
    // 0.001 cho 50 câu: mọi câu làm tròn về 0 và câu cuối cũng không cứu nổi.
    expect(distributePoints(0.001, Array(50).fill(1))).toEqual([]);
  });
});

describe("sumPoints / isTotalBalanced", () => {
  it("bỏ qua câu chưa có điểm", () => {
    expect(sumPoints([1, undefined, 2])).toBe(3);
  });

  it("không rò sai số dấu phẩy động ra UI", () => {
    expect(sumPoints(Array(40).fill(0.25))).toBe(10);
    expect(sumPoints(Array(3).fill(0.1))).toBe(0.3);
  });

  it("khớp thang 10 trong đúng sai số của cổng publish", () => {
    expect(isTotalBalanced(10)).toBe(true);
    expect(isTotalBalanced(10 - LIMITS.POINTS_EPSILON)).toBe(true);
    expect(isTotalBalanced(9.5)).toBe(false);
  });
});
