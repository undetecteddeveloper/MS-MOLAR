// Cổng phát hành Premium — PRD R14 / AC-049 / AC-054, UI Spec UI-D8.
//
// Điều được ghim: MỌI giá trị không phải "1"/"true" đều là TẮT, kể cả những giá
// trị trông rất giống bật ("yes", "on", "enabled"). Hướng hỏng phải luôn là
// KHÔNG BÁN ĐƯỢC, không bao giờ là BÁN NHẦM — bán 500 lượt/kỳ trong khi cả dự
// án chỉ có 20 lượt/ngày là nhận tiền cho thứ không giao được.
//
import { afterEach, describe, expect, it, vi } from "vitest";

// paidTier.ts `import "server-only"` — module đó ném lỗi ngoài bundle server
// của Next. Stub theo đúng lối 14 file test khác trong repo đã đi (vd
// lib/tutor/__tests__/callTutor.test.ts:17).
vi.mock("server-only", () => ({}));

import { isPaidTierEnabled } from "../paidTier";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isPaidTierEnabled — fail-closed", () => {
  it("TẮT khi biến không tồn tại (ca AC-054: quên đặt ở một môi trường)", () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", undefined);
    expect(isPaidTierEnabled()).toBe(false);
  });

  it.each(["", "   ", "0", "false", "no", "off"])(
    'TẮT với giá trị %j',
    (raw) => {
      vi.stubEnv("GEMINI_PAID_TIER_ENABLED", raw);
      expect(isPaidTierEnabled()).toBe(false);
    }
  );

  it.each(["yes", "on", "enabled", "y", "TRUE_ISH"])(
    'TẮT với giá trị TRÔNG NHƯ bật %j — chỉ "1"/"true" mới tính',
    (raw) => {
      vi.stubEnv("GEMINI_PAID_TIER_ENABLED", raw);
      expect(isPaidTierEnabled()).toBe(false);
    }
  );

  it.each(["1", "true", "TRUE", " true ", "1 "])(
    "BẬT với giá trị %j (có trim + không phân biệt hoa thường)",
    (raw) => {
      vi.stubEnv("GEMINI_PAID_TIER_ENABLED", raw);
      expect(isPaidTierEnabled()).toBe(true);
    }
  );
});
