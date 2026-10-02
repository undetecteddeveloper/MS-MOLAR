// @vitest-environment jsdom

// HeroGrid — lưới caro nền hero (2026-10-02): chỉ trang trí, ẩn với trình đọc màn
// hình, chỉ hiện ở khổ hẹp (`sm:hidden`), không bắt chuột, nằm sau nội dung.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeroGrid } from "@/features/auth/components/HeroGrid";

afterEach(cleanup);

describe("HeroGrid", () => {
  it("khối trang trí aria-hidden, chỉ khổ hẹp, không bắt chuột, nằm sau nội dung, không có chữ", () => {
    render(<HeroGrid />);

    const grid = screen.getByTestId("hero-grid");
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(grid.className).toContain("hero-grid");
    expect(grid.className).toContain("sm:hidden");
    expect(grid.className).toContain("pointer-events-none");
    expect(grid.className).toContain("-z-10");
    expect(grid.textContent).toBe("");
  });

  it("phủ tới đáy khối bao (bottom-0) để lưới tràn xuống cụm 'Đề nổi nhất'", () => {
    render(<HeroGrid />);

    expect(screen.getByTestId("hero-grid").className).toContain("bottom-0");
  });
});
