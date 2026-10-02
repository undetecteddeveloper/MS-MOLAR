// @vitest-environment jsdom

// HomeStage — lưới caro nền hero (2026-10-02): chỉ trang trí, ẩn với trình đọc
// màn hình, chỉ hiện ở khổ hẹp (`sm:hidden`) và không chặn thao tác.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/AuthForm", () => ({ AuthForm: () => <div>auth-form</div> }));

const { HomeStage } = await import("@/features/auth/components/HomeStage");

afterEach(cleanup);

describe("HomeStage — lưới caro nền hero", () => {
  it("có một khối trang trí aria-hidden, chỉ ở khổ hẹp, không bắt chuột, nằm sau nội dung", () => {
    render(<HomeStage auth={null} signedIn={false} />);

    const grid = screen.getByTestId("hero-grid");
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(grid.className).toContain("hero-grid");
    expect(grid.className).toContain("sm:hidden");
    expect(grid.className).toContain("pointer-events-none");
    expect(grid.className).toContain("-z-10");
    expect(grid.textContent).toBe("");
  });

  it("không đụng tới nội dung hero: tiêu đề và nút chính vẫn là phần tử bấm được/đọc được", () => {
    render(<HomeStage auth={null} signedIn={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Bắt đầu luyện đề/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Xem kho đề/ })).toBeTruthy();
  });
});
