// Hàm thuần của cảnh Maxwell. Phần WebGL (createMaxwellScene) không chạy được
// trong jsdom — nó được đo trên trình duyệt thật (brief task 5).

import { describe, expect, it } from "vitest";
import { fitDistance } from "../framing";
import { BOB_AMPLITUDE, poseAt, SPIN_RAD_PER_SEC } from "../motion";

describe("fitDistance", () => {
  const base = { radius: 1.75, fovDeg: 32 };

  it("khung ngang: giới hạn bởi góc nhìn dọc", () => {
    const d = fitDistance({ ...base, aspect: 16 / 9 });
    const expected = base.radius / Math.sin((base.fovDeg * Math.PI) / 180 / 2);
    expect(d).toBeCloseTo(expected, 6);
  });

  it("khung dọc hẹp (điện thoại 360px): xa hơn khung ngang để không cắt hai bên", () => {
    const landscape = fitDistance({ ...base, aspect: 16 / 9 });
    const portrait = fitDistance({ ...base, aspect: 0.8 });
    expect(portrait).toBeGreaterThan(landscape);
  });

  it("khối cầu thật sự nằm trong khung ở cả hai chiều", () => {
    for (const aspect of [0.5, 0.8, 1, 1.5, 2.4]) {
      const d = fitDistance({ ...base, aspect });
      const v = (base.fovDeg * Math.PI) / 180;
      const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
      // Bán kính nhìn thấy ở khoảng cách d (khối cầu bao: sin(nửa góc) * d).
      expect(d * Math.sin(v / 2)).toBeGreaterThanOrEqual(base.radius - 1e-9);
      expect(d * Math.sin(h / 2)).toBeGreaterThanOrEqual(base.radius - 1e-9);
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "tỉ lệ khung vô nghĩa (%s) không sinh NaN/Infinity",
    (aspect) => {
      const d = fitDistance({ ...base, aspect });
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  );
});

describe("poseAt", () => {
  it("bắt đầu ở góc 0, ngang vị trí gốc", () => {
    expect(poseAt(0)).toEqual({ rotationY: 0, offsetY: 0 });
  });

  it("xoay đều theo thời gian", () => {
    expect(poseAt(2).rotationY).toBeCloseTo(2 * SPIN_RAD_PER_SEC, 9);
  });

  it("góc luôn nằm trong [0, 2π) kể cả sau nhiều giờ", () => {
    for (const seconds of [10, 1000, 3600 * 5, 1e7]) {
      const { rotationY } = poseAt(seconds);
      expect(rotationY).toBeGreaterThanOrEqual(0);
      expect(rotationY).toBeLessThan(Math.PI * 2);
    }
  });

  it("nhấp nhô không vượt biên độ và đổi dấu (lên rồi xuống)", () => {
    let min = 0;
    let max = 0;
    for (let t = 0; t < 10; t += 0.01) {
      const { offsetY } = poseAt(t);
      expect(Math.abs(offsetY)).toBeLessThanOrEqual(BOB_AMPLITUDE + 1e-12);
      min = Math.min(min, offsetY);
      max = Math.max(max, offsetY);
    }
    expect(max).toBeGreaterThan(BOB_AMPLITUDE * 0.99);
    expect(min).toBeLessThan(-BOB_AMPLITUDE * 0.99);
  });

  it.each([-5, Number.NaN, Number.POSITIVE_INFINITY])("thời gian vô nghĩa (%s) → tư thế gốc", (t) => {
    expect(poseAt(t)).toEqual({ rotationY: 0, offsetY: 0 });
  });
});
