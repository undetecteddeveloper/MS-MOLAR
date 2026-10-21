// @vitest-environment jsdom

// PlanComparison — hai thẻ gói Free / Premium. Chữ giá và số lượt được ghim bằng
// chuỗi cố định: đây là lời hứa bán hàng, đổi phải là quyết định có chủ ý.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { PlanComparison } from "@/features/billing/components/pricing/PlanComparison";

afterEach(cleanup);

const PREMIUM: Entitlement = {
  plan: "premium",
  expiresAt: "2099-11-30T23:59:59.000Z",
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
};

function renderCards(entitlement?: Entitlement) {
  const ui = <PlanComparison premiumFooter={<button type="button">FOOTER</button>} />;
  return render(entitlement ? <EntitlementProvider value={entitlement}>{ui}</EntitlementProvider> : ui);
}

const card = (container: HTMLElement, plan: "free" | "premium") =>
  container.querySelector(`section[aria-labelledby="plan-${plan}-name"]`) as HTMLElement;

describe("hai thẻ", () => {
  it("có đúng hai thẻ, mỗi thẻ có tiêu đề đặt tên cho vùng", () => {
    const { container } = renderCards();
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(card(container, "free").querySelector("h2")?.textContent).toBe("Miễn phí");
    expect(card(container, "premium").querySelector("h2")?.textContent).toBe("Premium");
  });

  it("ghim giá và kỳ hạn", () => {
    const { container } = renderCards();
    expect(card(container, "free").textContent).toContain("0 đồng");
    expect(card(container, "free").textContent).toContain("mãi mãi");
    expect(card(container, "premium").textContent).toContain("39.000 VNĐ");
    expect(card(container, "premium").textContent).toContain("cho mỗi kỳ 30 ngày, trả trước");
  });

  it("mỗi thẻ liệt kê đúng bốn điểm lợi ích", () => {
    const { container } = renderCards();
    expect(card(container, "free").querySelectorAll("li")).toHaveLength(4);
    expect(card(container, "premium").querySelectorAll("li")).toHaveLength(4);
    expect(card(container, "premium").textContent).toContain("500 lượt gia sư mỗi 30 ngày");
    expect(card(container, "free").textContent).toContain("5 lượt gia sư mỗi 30 ngày");
  });

  it("phần chân (liên kết pháp lý + nút mua) chỉ nằm trong thẻ Premium", () => {
    const { container } = renderCards();
    expect(card(container, "premium").textContent).toContain("FOOTER");
    expect(card(container, "free").textContent).not.toContain("FOOTER");
  });
});

describe("nhãn 'Gói bạn đang dùng'", () => {
  const badge = (c: HTMLElement) => c.textContent?.includes("Gói bạn đang dùng") ?? false;

  it("thiếu provider (fail-closed) → gắn cho thẻ Miễn phí, không gắn nhầm Premium", () => {
    const { container } = renderCards();
    expect(badge(card(container, "free"))).toBe(true);
    expect(badge(card(container, "premium"))).toBe(false);
  });

  it("người dùng Premium → gắn cho thẻ Premium, không gắn Miễn phí", () => {
    const { container } = renderCards(PREMIUM);
    expect(badge(card(container, "premium"))).toBe(true);
    expect(badge(card(container, "free"))).toBe(false);
  });
});
