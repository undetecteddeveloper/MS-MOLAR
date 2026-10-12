// @vitest-environment jsdom

// AuthForm — trường ẩn `next` (brief 20261012 T7): khách bấm đăng nhập từ một
// trang con thì MỌI form của thẻ (email/mật khẩu và Google/Facebook) mang trang
// đó đi; không có `next` thì không thêm trường nào (hành vi cũ).

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  requestPasswordReset: vi.fn(),
  verifySignupCode: vi.fn(),
  resendSignupCode: vi.fn(),
}));

// jsdom không có ResizeObserver; AutoHeightPanel của AuthForm cần nó khi mount.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const { AuthForm } = await import("@/features/auth/components/AuthForm");

afterEach(cleanup);

function nextInputs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>("input[name='next']")).map(
    (input) => input.value
  );
}

describe("AuthForm — trường ẩn next", () => {
  it("có next: cả form email/mật khẩu lẫn form OAuth đều mang next", () => {
    const { container } = render(<AuthForm initialMode="signin" next="/history" />);

    expect(nextInputs(container)).toEqual(["/history", "/history"]);
  });

  it("tab Đăng ký cũng mang next", () => {
    const { container } = render(<AuthForm initialMode="signup" next="/me/dashboard" />);

    expect(nextInputs(container)).toEqual(["/me/dashboard", "/me/dashboard"]);
  });

  it("view nhập mã mang next sang form verify", () => {
    const { container } = render(
      <AuthForm initialMode="verify" initialEmail="a@b.vn" next="/upload" />
    );

    expect(nextInputs(container)).toEqual(["/upload"]);
  });

  it("không có next: không có trường nào", () => {
    const { container } = render(<AuthForm initialMode="signin" />);

    expect(nextInputs(container)).toEqual([]);
  });
});
