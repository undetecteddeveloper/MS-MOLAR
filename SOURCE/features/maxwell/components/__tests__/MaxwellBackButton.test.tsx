// @vitest-environment jsdom

// MaxwellBackButton — về đúng trang trước khi ô tìm đã ghi dấu; không thì Kho đề.
// Cố ý KHÔNG dựa vào history.length: trình duyệt mới đã có sẵn một mục trống.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const back = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

import { MaxwellBackButton } from "../MaxwellBackButton";

const ORIGIN_KEY = "ms-molar-maxwell-origin";

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", { value: length, configurable: true });
}

function clickBack() {
  fireEvent.click(screen.getByRole("button", { name: "Quay lại trang trước" }));
}

beforeEach(() => {
  back.mockReset();
  push.mockReset();
  window.sessionStorage.clear();
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

  it("ô tìm đã ghi trang trước → router.back(), không điều hướng mới", () => {
    window.sessionStorage.setItem(ORIGIN_KEY, "/exams?subject=Math");
    setHistoryLength(3);
    render(<MaxwellBackButton />);

    clickBack();

    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("mở thẳng link: KHÔNG có dấu → Kho đề, dù lịch sử có sẵn mục trống (about:blank)", () => {
    setHistoryLength(2);
    render(<MaxwellBackButton />);

    clickBack();

    expect(push).toHaveBeenCalledWith("/exams");
    expect(back).not.toHaveBeenCalled();
  });

  it("có dấu nhưng không còn mục để lùi → điều hướng thẳng tới trang đã ghi", () => {
    window.sessionStorage.setItem(ORIGIN_KEY, "/history?scoreMin=5");
    setHistoryLength(1);
    render(<MaxwellBackButton />);

    clickBack();

    expect(push).toHaveBeenCalledWith("/history?scoreMin=5");
    expect(back).not.toHaveBeenCalled();
  });

  it.each(["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "/maxwell"])(
    "dấu không an toàn %j bị bỏ qua → Kho đề, không ra ngoài site",
    (poisoned) => {
      window.sessionStorage.setItem(ORIGIN_KEY, poisoned);
      setHistoryLength(1);
      render(<MaxwellBackButton />);

      clickBack();

      expect(push).toHaveBeenCalledWith("/exams");
    }
  );
});
