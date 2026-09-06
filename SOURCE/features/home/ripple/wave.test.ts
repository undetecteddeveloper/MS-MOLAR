import { describe, expect, it } from "vitest";
import {
  BAND,
  MAX_RIPPLES,
  PEAK_ALPHA,
  bandRange,
  cellAlpha,
  cellJitter,
  crestIntensity,
  fadeAt,
  maxRadiusFrom,
  radiusAt,
} from "./wave";
import { TAP_MAX_MOVE, TAP_MAX_MS, isTap } from "./tap";

describe("wave", () => {
  it("bán kính đi từ 0 tới maxRadius, không vượt quá", () => {
    expect(radiusAt(0, 900)).toBe(0);
    expect(radiusAt(1, 900)).toBe(900);
    expect(radiusAt(2, 900)).toBe(900);
    expect(radiusAt(0.5, 900)).toBeGreaterThan(450); // ease-out: bung nhanh trước
  });

  it("độ mờ giảm đơn điệu về 0", () => {
    expect(fadeAt(0)).toBe(1);
    expect(fadeAt(1)).toBe(0);
    expect(fadeAt(0.3)).toBeGreaterThan(fadeAt(0.6));
  });

  it("ô ngay vành đậm nhất, ô cách vành 3 sigma coi như tắt", () => {
    expect(crestIntensity(300, 300)).toBe(1);
    expect(crestIntensity(300 + BAND, 300)).toBeCloseTo(Math.exp(-1), 6);
    expect(crestIntensity(300 + 3 * BAND, 300)).toBeLessThan(0.001);
    const [lo, hi] = bandRange(300);
    expect([lo, hi]).toEqual([300 - 3 * BAND, 300 + 3 * BAND]);
    expect(bandRange(10)[0]).toBe(0);
  });

  it("alpha của ô không bao giờ vượt PEAK_ALPHA", () => {
    let max = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      for (let d = 0; d <= 900; d += 7) max = Math.max(max, cellAlpha(d, p, 900, 1));
    }
    expect(max).toBeLessThanOrEqual(PEAK_ALPHA);
    expect(max).toBeGreaterThan(PEAK_ALPHA * 0.9);
  });

  it("jitter tất định, trong [0.65, 1], và hai ô cạnh nhau khác nhau", () => {
    expect(cellJitter(3, 7)).toBe(cellJitter(3, 7));
    for (let c = 0; c < 40; c++) {
      for (let r = 0; r < 40; r++) {
        const j = cellJitter(c, r);
        expect(j).toBeGreaterThanOrEqual(0.65);
        expect(j).toBeLessThanOrEqual(1);
      }
    }
    expect(cellJitter(0, 0)).not.toBe(cellJitter(1, 0));
  });

  it("bán kính tối đa chạm tới góc xa nhất của khung nhìn", () => {
    expect(maxRadiusFrom(0, 0, 300, 400)).toBe(500);
    expect(maxRadiusFrom(300, 400, 300, 400)).toBe(500);
    expect(maxRadiusFrom(150, 200, 300, 400)).toBe(250);
  });

  it("chặn trên số sóng cùng lúc là một số nhỏ", () => {
    expect(MAX_RIPPLES).toBeLessThanOrEqual(4);
  });
});

describe("tap", () => {
  const down = { id: 1, x: 100, y: 100, time: 1000 };

  it("chạm tại chỗ, nhanh → sóng", () => {
    expect(isTap(down, { id: 1, x: 104, y: 97, time: 1120 })).toBe(true);
  });

  it("kéo quá ngưỡng hoặc giữ lâu hoặc khác con trỏ → không", () => {
    expect(isTap(down, { id: 1, x: 100 + TAP_MAX_MOVE + 1, y: 100, time: 1100 })).toBe(false);
    expect(isTap(down, { id: 1, x: 100, y: 100, time: 1000 + TAP_MAX_MS + 1 })).toBe(false);
    expect(isTap(down, { id: 2, x: 100, y: 100, time: 1100 })).toBe(false);
    expect(isTap(null, { id: 1, x: 100, y: 100, time: 1100 })).toBe(false);
  });
});
