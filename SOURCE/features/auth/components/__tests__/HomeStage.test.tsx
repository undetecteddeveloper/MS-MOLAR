// @vitest-environment jsdom

// HomeStage — nội dung hero (tiêu đề, nút chính, liên kết phụ). Lưới caro nền nay do
// HeroGrid đảm nhiệm (HeroGrid.test.tsx), HomeStage không còn mang phần tử trang trí nào.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/AuthForm", () => ({ AuthForm: () => <div>auth-form</div> }));

const { HomeStage } = await import("@/features/auth/components/HomeStage");

afterEach(cleanup);

describe("HomeStage — nội dung hero", () => {
  it("tiêu đề, nút chính và liên kết phụ là phần tử đọc được/bấm được; không có khối trang trí", () => {
    render(<HomeStage auth={null} signedIn={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bắt đầu luyện đề/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Xem kho đề/ })).toBeTruthy();
    expect(screen.queryByTestId("hero-grid")).toBeNull();
  });
});
