// @vitest-environment jsdom

// Hợp đồng quyền lợi — UI Spec C-01 / UI-D1 / UI-D2.
// PRD: subscription-prd.md — R2/AC-001, AC-004 (không cột boolean), AC-014.
//
// Ba thứ được ghim ở đây, và cả ba đều là thứ dễ bị "sửa cho gọn" trong tương
// lai bởi người không biết vì sao chúng như vậy:
//   1. mặc định là Free (fail-closed) — kể cả khi không có provider;
//   2. hạn mức `unknown` KHÔNG chặn (fail-OPEN) — quy nó về 0 sẽ tắt gia sư
//      Engine 1 cho toàn bộ người dùng;
//   3. không có trường boolean nào biểu diễn trạng thái thuê bao.
//
// Không có setup file trong vitest.config.ts nên không có matcher jest-dom;
// test đọc thẳng thuộc tính DOM, và mọi truy vấn bám vào `container` của chính
// lần render đó (tiền lệ ExplainStepAffordance.test.tsx).

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntitlementProvider, useEntitlement } from "../entitlement";
import { FREE_FALLBACK, isQuotaExhausted, type Entitlement } from "../types";

function Probe() {
  const e = useEntitlement();
  return (
    <span data-testid="probe">
      {e.plan}|{String(e.expiresAt)}|{e.tutor.state}|{String(isQuotaExhausted(e.tutor))}
    </span>
  );
}

const read = (container: HTMLElement) =>
  container.querySelector('[data-testid="probe"]')?.textContent ?? "";

describe("useEntitlement — fail-closed mặc định", () => {
  it("trả Free khi KHÔNG có provider (fallback = mặc định an toàn, không phải lỗi)", () => {
    const { container } = render(<Probe />);
    expect(read(container)).toBe("free|null|unknown|false");
  });

  it("trả đúng giá trị provider cấp", () => {
    const premium: Entitlement = {
      plan: "premium",
      expiresAt: "2026-09-15T00:00:00.000Z",
      inGracePeriod: false,
      tutor: { state: "known", used: 12, limit: 500, resetsAt: "2026-09-15T00:00:00.000Z" },
      upload: { state: "unknown" },
    };
    const { container } = render(
      <EntitlementProvider value={premium}>
        <Probe />
      </EntitlementProvider>
    );
    expect(read(container)).toBe("premium|2026-09-15T00:00:00.000Z|known|false");
  });
});

describe("isQuotaExhausted — hai nửa hỏng về hai hướng NGƯỢC nhau (UI-D2)", () => {
  it("`unknown` KHÔNG bị coi là hết hạn mức", () => {
    // Đây là khẳng định quan trọng nhất trong file. Nếu nó đổi thành `true`,
    // stub của pha UI sẽ chặn gia sư cho MỌI người dùng — chưa có bảng đếm nào
    // tồn tại nên `unknown` là trạng thái của tất cả mọi người lúc này.
    expect(isQuotaExhausted({ state: "unknown" })).toBe(false);
  });

  it("chặn đúng tại mốc used === limit, không chặn sớm một lượt", () => {
    const q = (used: number) =>
      ({ state: "known", used, limit: 5, resetsAt: "2026-09-15T00:00:00.000Z" }) as const;
    // AC-014: người Free gọi lượt thứ 6 mới bị từ chối — lượt thứ 5 vẫn phải
    // được phục vụ. Lệch một đơn vị ở đây là ăn mất một lượt đã trả tiền.
    expect(isQuotaExhausted(q(4))).toBe(false);
    expect(isQuotaExhausted(q(5))).toBe(true);
    expect(isQuotaExhausted(q(6))).toBe(true);
  });
});

describe("hình dạng hợp đồng", () => {
  it("FREE_FALLBACK là Free, không hạn nào, không trong ân hạn, hạn mức unknown", () => {
    expect(FREE_FALLBACK.plan).toBe("free");
    expect(FREE_FALLBACK.expiresAt).toBeNull();
    expect(FREE_FALLBACK.inGracePeriod).toBe(false);
    expect(FREE_FALLBACK.tutor.state).toBe("unknown");
    expect(FREE_FALLBACK.upload.state).toBe("unknown");
  });

  it("KHÔNG có trường boolean nào biểu diễn trạng thái thuê bao (AC-004)", () => {
    // `inGracePeriod` là boolean nhưng KHÔNG phải trạng thái thuê bao — nó là
    // một nhánh suy ra từ `expiresAt` lúc đọc. Thứ bị cấm là một cờ đã LƯU thay
    // cho mốc thời gian: nó đúng lúc ghi và sai một tháng sau mà không gì báo.
    const forbidden = ["isPremium", "isActive", "subscribed", "active", "premium", "isPaid"];
    for (const key of forbidden) {
      expect(Object.hasOwn(FREE_FALLBACK, key)).toBe(false);
    }
    // Nguồn sự thật của gói phải là hai thứ: một enum và một mốc thời gian.
    expect(typeof FREE_FALLBACK.plan).toBe("string");
  });
});
