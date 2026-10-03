// @vitest-environment jsdom

// ExamFilters — hợp đồng hàng chip lọc của Kho đề (P4-T4, AC-033/AC-034).
// Mock duy nhất biên `next/navigation` (router/pathname/searchParams), như
// HeaderSearch.test.tsx. `FilterSheet` đóng ngay từ đầu (`open` khởi tạo
// `false`, `usePresence` trả `present: false` khi jsdom không có
// `matchMedia`), nên hàng chip là TOÀN BỘ nội dung có `role="button"` khi
// `selected={}` và `query` bỏ trống (không có chip "Xoá lọc").

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/exams",
  useSearchParams: () => new URLSearchParams(search),
}));

import { ExamFilters } from "../ExamFilters";

const BASE_PROPS = {
  subjects: [],
  grades: [],
  schools: [],
  years: [],
  semesters: [],
  selected: {},
};

beforeEach(() => {
  push.mockReset();
  search = "";
});

afterEach(() => {
  cleanup();
});

describe("ExamFilters — hàng chip", () => {
  it("5 chip đúng thứ tự: Bộ lọc, Mới nhất, Cũ nhất, Khó nhất, Nổi nhất", () => {
    render(<ExamFilters {...BASE_PROPS} />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["Bộ lọc", "Mới nhất", "Cũ nhất", "Khó nhất", "Nổi nhất"]);
  });

  it("chip Nổi nhất đang chọn (?sort=hot) → aria-pressed đúng chip, 3 chip cũ vẫn tắt", () => {
    render(<ExamFilters {...BASE_PROPS} sort="hot" />);
    expect(screen.getByRole("button", { name: "Nổi nhất" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Mới nhất" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Cũ nhất" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Khó nhất" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  it("bấm chip Nổi nhất → điều hướng ?sort=hot, xoá page/dir, giữ tham số khác — giống 3 chip cũ", () => {
    search = "subject=Math&page=3&dir=asc";
    render(<ExamFilters {...BASE_PROPS} selected={{ subject: "Math" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nổi nhất" }));

    expect(push).toHaveBeenCalledWith("/exams?subject=Math&sort=hot", { scroll: false });
  });

  it("bấm lại chip Nổi nhất khi đang chọn → bỏ sort (toggle off), giống 3 chip cũ", () => {
    search = "sort=hot";
    render(<ExamFilters {...BASE_PROPS} sort="hot" />);

    fireEvent.click(screen.getByRole("button", { name: "Nổi nhất" }));

    expect(push).toHaveBeenCalledWith("/exams", { scroll: false });
  });

  it("chip Mới nhất (đã có từ trước) — hành vi không đổi: điều hướng ?sort=newest, xoá page", () => {
    search = "page=2";
    render(<ExamFilters {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: "Mới nhất" }));

    expect(push).toHaveBeenCalledWith("/exams?sort=newest", { scroll: false });
  });
});

describe("ExamFilters — chip dạng bài (?skill=, brief 20261003 AC-06)", () => {
  it("không có skill → không có chip dạng bài, không có nút Xoá lọc", () => {
    render(<ExamFilters {...BASE_PROPS} />);

    expect(screen.queryByText(/Dạng bài/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá lọc" })).toBeNull();
  });

  it("có skill + nhãn → chip 'Dạng bài: <nhãn>' đứng ĐẦU hàng, có nút Xoá lọc", () => {
    render(<ExamFilters {...BASE_PROPS} skill="ham-so-bac-hai" skillLabel="Hàm số bậc hai" />);

    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(labels[0]).toBe("Dạng bài: Hàm số bậc hai");
    expect(screen.getByRole("button", { name: "Xoá lọc" })).not.toBeNull();
  });

  it("bấm chip → bỏ ĐÚNG skill, giữ subject, xoá page", () => {
    search = "subject=Math&skill=ham-so-bac-hai&page=2";
    render(
      <ExamFilters
        {...BASE_PROPS}
        selected={{ subject: "Math" }}
        skill="ham-so-bac-hai"
        skillLabel="Hàm số bậc hai"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc dạng bài Hàm số bậc hai" }));

    expect(push).toHaveBeenCalledWith("/exams?subject=Math", { scroll: false });
  });

  it("nhãn không đọc được → chip nói chung chung, KHÔNG in id thô lên màn hình", () => {
    render(<ExamFilters {...BASE_PROPS} skill="ham-so-bac-hai" />);

    const chip = screen.getByRole("button", { name: "Bỏ lọc theo dạng bài" });
    expect(chip.textContent).toBe("Theo dạng bài");
    expect(document.body.textContent).not.toContain("ham-so-bac-hai");
  });

  it("Xoá lọc → về /exams trần (xoá cả skill)", () => {
    search = "skill=ham-so-bac-hai";
    render(<ExamFilters {...BASE_PROPS} skill="ham-so-bac-hai" skillLabel="Hàm số bậc hai" />);

    fireEvent.click(screen.getByRole("button", { name: "Xoá lọc" }));

    expect(push).toHaveBeenCalledWith("/exams", { scroll: false });
  });
});
