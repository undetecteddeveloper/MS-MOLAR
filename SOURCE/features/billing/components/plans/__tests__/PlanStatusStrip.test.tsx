// @vitest-environment jsdom

// PlanStatusStrip — dải "Gói đang dùng" đầu tab Gói.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { formatDate } from "@/lib/format/datetime";
import { PlanStatusStrip } from "@/features/billing/components/plans/PlanStatusStrip";

afterEach(cleanup);

const EXPIRES = "2099-11-30T23:59:59.000Z";
const PREMIUM: Entitlement = {
  plan: "premium",
  expiresAt: EXPIRES,
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
};

function renderStrip(value?: Entitlement) {
  const ui = <PlanStatusStrip />;
  return render(value ? <EntitlementProvider value={value}>{ui}</EntitlementProvider> : ui);
}

describe("dải gói đang dùng", () => {
  it("thiếu provider → Miễn phí kèm hạn mức của gói Free", () => {
    const { container } = renderStrip();
    expect(container.textContent).toContain("Gói đang dùng");
    expect(container.textContent).toContain("Miễn phí");
    expect(container.textContent).toContain("5 lượt gia sư · 3 lượt tải đề mỗi 30 ngày");
    expect(container.textContent).not.toContain("Premium");
  });

  it("Premium: ghi ngày hết hạn, hạn mức của gói Premium và có viền nhấn", () => {
    const { container } = renderStrip(PREMIUM);
    expect(container.textContent).toContain(`Premium · đến ${formatDate(EXPIRES)}`);
    expect(container.textContent).toContain("500 lượt gia sư · 15 lượt tải đề mỗi 30 ngày");
    expect(container.querySelector("section")?.className).toContain("ring-primary");
  });

  it("Miễn phí không có viền nhấn", () => {
    const { container } = renderStrip();
    expect(container.querySelector("section")?.className).not.toContain("ring-primary");
  });

  it("là một vùng có tên để trình đọc màn hình nhảy tới", () => {
    const { container } = renderStrip();
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe("Gói đang dùng");
  });
});
