// @vitest-environment jsdom

// MaxwellBackButton — về đúng trang trước; không có lịch sử thì về Kho đề.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

import { MaxwellBackButton } from "../MaxwellBackButton";

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", { value: length, configurable: true });
}

beforeEach(() => {
  back.mockReset();
  push.mockReset();
});

afterEach(() => {
  cleanup();
  // Trả lại getter gốc của jsdom (thuộc tính định nghĩa trên instance che nó).
  delete (window.history as unknown as { length?: number }).length;
});

describe("MaxwellBackButton", () => {
  it("có tên truy cập và đủ lớn cho ngón tay (size-11 = 44px)", () => {
    render(<MaxwellBackButton />);
    const button = screen.getByRole("button", { name: "Quay lại trang trước" });
    expect(button.className).toContain("size-11");
  });

  it("có trang trước trong lịch sử → router.back(), không điều hướng mới", () => {
    setHistoryLength(3);
    render(<MaxwellBackButton />);

    fireEvent.click(screen.getByRole("button", { name: "Quay lại trang trước" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("mở thẳng link ở tab mới (lịch sử chỉ có 1 mục) → Kho đề", () => {
    setHistoryLength(1);
    render(<MaxwellBackButton />);

    fireEvent.click(screen.getByRole("button", { name: "Quay lại trang trước" }));

    expect(push).toHaveBeenCalledWith("/exams");
    expect(back).not.toHaveBeenCalled();
  });
});
