// @vitest-environment jsdom

// PlanSummary — gói hiện tại + hạn mức còn lại, đầu trang /me/orders.
//
// Hạn mức chỉ hiện khi CẢ HAI nửa `known`. Nhánh `unknown` là hỏng-MỞ (máy chủ
// không chặn gì) nên KHÔNG được in "0" hay "—": một người đang trả tiền sẽ hiểu
// thành "hết hạn mức".

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement, Quota } from "@/lib/billing/types";
import { formatDate } from "@/lib/format/datetime";
import { PlanSummary } from "@/features/billing/components/orders/PlanSummary";

afterEach(cleanup);

const EXPIRES = "2099-11-30T23:59:59.000Z";
const RESETS = "2099-10-30T23:59:59.000Z";
const known = (used: number, limit: number): Quota => ({ state: "known", used, limit, resetsAt: RESETS });
const UNKNOWN: Quota = { state: "unknown" };

function renderWith(value: Entitlement | null) {
  const ui = <PlanSummary />;
  return render(value ? <EntitlementProvider value={value}>{ui}</EntitlementProvider> : ui);
}

/** Cặp nhãn → giá trị. */
function rows(container: HTMLElement): Record<string, string> {
  const terms = Array.from(container.querySelectorAll("dt")).map((n) => n.textContent ?? "");
  const values = Array.from(container.querySelectorAll("dd")).map((n) => n.textContent ?? "");
  return Object.fromEntries(terms.map((term, i) => [term, values[i]]));
}

describe("gói", () => {
  it("thiếu provider → rơi về Miễn phí và báo chưa đọc được bộ đếm", () => {
    const { container } = renderWith(null);
    expect(rows(container)).toEqual({ "Gói hiện tại": "Miễn phí" });
    expect(container.textContent).toContain("Chưa đọc được bộ đếm lượt dùng");
  });

  it("Premium còn hạn: ghi ngày hết hạn", () => {
    const { container } = renderWith({
      plan: "premium",
      expiresAt: EXPIRES,
      inGracePeriod: false,
      tutor: UNKNOWN,
      upload: UNKNOWN,
    });
    expect(rows(container)["Gói hiện tại"]).toBe(`Premium · đến ${formatDate(EXPIRES)}`);
  });

  it("Premium đang ân hạn: nói rõ là ân hạn, không giả làm còn hạn", () => {
    const { container } = renderWith({
      plan: "premium",
      expiresAt: EXPIRES,
      inGracePeriod: true,
      tutor: UNKNOWN,
      upload: UNKNOWN,
    });
    expect(rows(container)["Gói hiện tại"]).toBe(`Premium · đang ân hạn, hết hạn ${formatDate(EXPIRES)}`);
  });

  it("Premium không có mốc hết hạn → chỉ ghi 'Premium'", () => {
    const { container } = renderWith({
      plan: "premium",
      expiresAt: null,
      inGracePeriod: false,
      tutor: UNKNOWN,
      upload: UNKNOWN,
    });
    expect(rows(container)["Gói hiện tại"]).toBe("Premium");
  });
});

describe("hạn mức", () => {
  const base = { plan: "free", expiresAt: null, inGracePeriod: false } as const;

  it("cả hai known: hiện kỳ đặt lại, số lượt gia sư và lượt tải đề CÒN LẠI", () => {
    const { container } = renderWith({ ...base, tutor: known(2, 5), upload: known(1, 3) });
    expect(rows(container)).toEqual({
      "Gói hiện tại": "Miễn phí",
      "Kỳ đặt lại vào": formatDate(RESETS),
      "Lượt gia sư": "Còn 3/5 lượt gia sư",
      "Lượt tải đề": "Còn 2/3 lượt tải đề",
    });
    expect(container.textContent).not.toContain("Chưa đọc được bộ đếm lượt dùng");
  });

  it("đã dùng vượt hạn mức (hạ hạn mức giữa kỳ) → kẹp ở 0, không ra số âm", () => {
    const { container } = renderWith({ ...base, tutor: known(9, 5), upload: known(3, 3) });
    expect(rows(container)["Lượt gia sư"]).toBe("Còn 0/5 lượt gia sư");
    expect(rows(container)["Lượt tải đề"]).toBe("Còn 0/3 lượt tải đề");
  });

  it.each([
    ["tutor unknown", UNKNOWN, known(1, 3)],
    ["upload unknown", known(1, 5), UNKNOWN],
    ["cả hai unknown", UNKNOWN, UNKNOWN],
  ])("%s: ẩn TOÀN BỘ hạn mức, không in 0 hay —, có câu báo chưa đọc được bộ đếm", (_name, tutor, upload) => {
    const { container } = renderWith({ ...base, tutor, upload });
    expect(Object.keys(rows(container))).toEqual(["Gói hiện tại"]);
    expect(container.textContent).toContain("Chưa đọc được bộ đếm lượt dùng");
    expect(container.textContent).not.toMatch(/Còn 0\//);
  });
});
