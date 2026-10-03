// @vitest-environment jsdom

// HomeStage — nội dung hero (tiêu đề, nút chính; hết liên kết phụ "Xem kho đề"). Lưới caro nền nay do
// HeroGrid đảm nhiệm (HeroGrid.test.tsx), HomeStage không còn mang phần tử trang trí nào.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/AuthForm", () => ({ AuthForm: () => <div>auth-form</div> }));

const { HomeStage } = await import("@/features/auth/components/HomeStage");

afterEach(cleanup);

describe("HomeStage — nội dung hero", () => {
  it("tiêu đề và nút chính là phần tử đọc được/bấm được; không có khối trang trí", () => {
    render(<HomeStage auth={null} signedIn={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bắt đầu luyện đề/ })).toBeTruthy();
    expect(screen.queryByTestId("hero-grid")).toBeNull();
  });

  it("không còn liên kết phụ 'Xem kho đề' — cả khách lẫn người đã đăng nhập", () => {
    const guest = render(<HomeStage auth={null} signedIn={false} />);
    expect(screen.queryByRole("link", { name: /Xem kho đề/ })).toBeNull();
    guest.unmount();

    render(<HomeStage auth={null} signedIn />);
    expect(screen.queryByRole("link", { name: /Xem kho đề/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Bắt đầu luyện đề/ }).getAttribute("href")).toBe("/exams");
  });
});
