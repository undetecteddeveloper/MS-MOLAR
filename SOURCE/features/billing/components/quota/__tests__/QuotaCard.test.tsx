// @vitest-environment jsdom

// QuotaCard — bảng Hạn mức đầu tab Tài khoản (2026-10-21).
//
// Hạn mức chỉ hiện khi CẢ HAI nửa `known`. Nhánh `unknown` là hỏng-MỞ (máy chủ
// không chặn gì) nên KHÔNG được in "0" hay "—": một người đang trả tiền sẽ hiểu
// thành "hết hạn mức".

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement, Quota } from "@/lib/billing/types";
import { formatDate } from "@/lib/format/datetime";
import { QuotaCard } from "@/features/billing/components/quota/QuotaCard";

afterEach(cleanup);

const EXPIRES = "2099-11-30T23:59:59.000Z";
const RESETS = "2099-10-30T23:59:59.000Z";
const known = (used: number, limit: number): Quota => ({
  state: "known",
  used,
  limit,
  resetsAt: RESETS,
});
const UNKNOWN: Quota = { state: "unknown" };

function renderWith(value: Entitlement | null) {
  const ui = <QuotaCard />;
  return render(value ? <EntitlementProvider value={value}>{ui}</EntitlementProvider> : ui);
}

/** Cặp nhãn → giá trị (khoảng trắng gộp một). */
function rows(container: HTMLElement): Record<string, string> {
  const terms = Array.from(container.querySelectorAll("dt")).map((n) => n.textContent ?? "");
  const values = Array.from(container.querySelectorAll("dd")).map((n) =>
    (n.textContent ?? "").replace(/\s+/g, " ").trim()
  );
  return Object.fromEntries(terms.map((term, i) => [term, values[i]]));
}

const badge = (container: HTMLElement) =>
  container.querySelector('[data-slot="badge"]')?.textContent;

describe("tiêu đề và huy hiệu gói", () => {
  it("có tiêu đề 'Hạn mức' đặt tên cho vùng", () => {
    const { container } = renderWith(null);
    expect(container.querySelector("section h2")?.textContent).toBe("Hạn mức");
    expect(container.querySelector("section")?.getAttribute("aria-labelledby")).toBe(
      container.querySelector("h2")?.id
    );
  });

  it("thiếu provider → Miễn phí và báo chưa đọc được bộ đếm, không in số", () => {
    const { container } = renderWith(null);
    expect(badge(container)).toBe("Miễn phí");
    expect(container.querySelector("dl")).toBeNull();
    expect(container.textContent).toContain("Chưa đọc được bộ đếm lượt dùng");
  });

  it("Premium còn hạn: huy hiệu ghi ngày hết hạn", () => {
    const { container } = renderWith({
      plan: "premium",
      expiresAt: EXPIRES,
      inGracePeriod: false,
      tutor: UNKNOWN,
      upload: UNKNOWN,
    });
    expect(badge(container)).toBe(`Premium · đến ${formatDate(EXPIRES)}`);
  });

  it("Premium đang ân hạn: nói rõ là ân hạn, không giả làm còn hạn", () => {
    const { container } = renderWith({
      plan: "premium",
      expiresAt: EXPIRES,
      inGracePeriod: true,
      tutor: UNKNOWN,
      upload: UNKNOWN,
    });
    expect(badge(container)).toBe(`Premium · đang ân hạn, hết hạn ${formatDate(EXPIRES)}`);
  });
});

describe("hạn mức", () => {
  const FREE_KNOWN: Entitlement = {
    plan: "free",
    expiresAt: null,
    inGracePeriod: false,
    tutor: known(2, 5),
    upload: known(1, 3),
  };

  it("hiện số lượt CÒN LẠI trên hạn mức và ngày đặt lại", () => {
    const { container } = renderWith(FREE_KNOWN);
    expect(rows(container)).toEqual({
      "Lượt gia sư còn": "3 / 5",
      "Lượt tải đề còn": "2 / 3",
      "Đặt lại vào": formatDate(RESETS),
    });
    expect(container.textContent).not.toContain("Chưa đọc được bộ đếm");
  });

  it("dùng quá hạn mức (hạn mức bị hạ giữa kỳ) → kẹp ở 0, không ra số âm", () => {
    const { container } = renderWith({ ...FREE_KNOWN, tutor: known(9, 5) });
    expect(rows(container)["Lượt gia sư còn"]).toBe("0 / 5");
  });

  it("thanh tiến độ rộng đúng phần trăm còn lại và là trang trí (aria-hidden)", () => {
    const { container } = renderWith(FREE_KNOWN);
    const bars = Array.from(
      container.querySelectorAll('[aria-hidden="true"] > div')
    ) as HTMLElement[];
    expect(bars.map((b) => b.style.width)).toEqual(["60%", "67%"]);
  });

  it("hết lượt: thanh đổi sang màu cảnh báo", () => {
    const { container } = renderWith({ ...FREE_KNOWN, tutor: known(5, 5) });
    const bar = container.querySelector('[aria-hidden="true"] > div') as HTMLElement;
    expect(bar.className).toContain("bg-destructive");
    expect(bar.style.width).toBe("0%");
  });

  it("chỉ MỘT nửa known vẫn là chưa đọc được: không in số nào", () => {
    const { container } = renderWith({ ...FREE_KNOWN, upload: UNKNOWN });
    expect(container.querySelector("dl")).toBeNull();
    expect(container.textContent).toContain("Chưa đọc được bộ đếm lượt dùng");
  });
});
