// @vitest-environment jsdom

// VerifyCodeForm — view nhập mã xác minh email (`/?auth=verify`). Mock boundary:
// chỉ `@/features/auth/actions`; bảng nhãn và Button/Input chạy thật. Repo không
// nạp jest-dom nên đọc thuộc tính DOM thô (`.disabled`, `getAttribute`).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth/verifyCode";

const { verifyMock, resendMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  resendMock: vi.fn(),
}));

vi.mock("@/features/auth/actions", () => ({
  verifySignupCode: verifyMock,
  resendSignupCode: resendMock,
}));

const { VerifyCodeForm } = await import("@/features/auth/components/VerifyCodeForm");

beforeEach(() => {
  vi.useFakeTimers();
  verifyMock.mockReset();
  resendMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function button(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("VerifyCodeForm", () => {
  it("starts in cooldown when the email came from sign-up (the mail was just sent)", () => {
    render(<VerifyCodeForm initialEmail="hs@example.com" onChangeEmail={() => {}} />);
    expect(button(`Gửi lại mã sau ${RESEND_COOLDOWN_SECONDS} giây`).disabled).toBe(true);
  });

  it("counts down and re-enables the resend button when the cooldown ends", () => {
    render(<VerifyCodeForm initialEmail="hs@example.com" onChangeEmail={() => {}} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(button(`Gửi lại mã sau ${RESEND_COOLDOWN_SECONDS - 1} giây`).disabled).toBe(true);

    // Mỗi giây một `act`: tick kế tiếp chỉ được hẹn sau khi React render lại, nên
    // một lần advance dài trong một act chỉ chạy được MỘT tick.
    for (let second = 1; second < RESEND_COOLDOWN_SECONDS; second++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(button("Gửi lại mã").disabled).toBe(false);
  });

  it("shows an email field and keeps resend disabled until it is filled, when opened without ?email", () => {
    render(<VerifyCodeForm initialEmail="" onChangeEmail={() => {}} />);
    expect(button("Gửi lại mã").disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "hs@example.com" } });
    expect(button("Gửi lại mã").disabled).toBe(false);
  });

  it("offers a one-time-code numeric input for the code", () => {
    render(<VerifyCodeForm initialEmail="hs@example.com" onChangeEmail={() => {}} />);
    const code = screen.getByLabelText("Mã xác minh");
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
  });

  it("calls onChangeEmail from the 'Đổi email' button", () => {
    const onChangeEmail = vi.fn();
    render(<VerifyCodeForm initialEmail="hs@example.com" onChangeEmail={onChangeEmail} />);
    fireEvent.click(button("Đổi email"));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });
});
