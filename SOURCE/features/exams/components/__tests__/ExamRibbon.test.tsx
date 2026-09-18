// @vitest-environment jsdom

// ExamRibbon — băng chéo góc "Hot nhất" trên thẻ hạng 1 kệ Nổi nhất (UI Spec
// § Component: ExamRibbon; AC-026, AC-044).
//
// Thuần trang trí: KHÔNG được lọt vào cây khả truy cập (aria-hidden) và
// KHÔNG được chặn tương tác của thẻ bên dưới nó (pointer-events-none) — thẻ
// vẫn là một liên kết duy nhất, băng chỉ nằm chồng lên trên. Chữ hiển thị
// phải đúng NGUYÊN VĂN prop `label` (chữ thường-đầu-câu) trong DOM; việc viết
// hoa là CSS `uppercase`, không phải biến đổi chuỗi trong JS — nếu `aria-hidden`
// có lúc nào đó bị gỡ, tên khả truy cập vẫn phải đọc đúng nội dung.
//
// @dependency: none — ExamRibbon không sở hữu dữ liệu, chỉ render prop.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExamRibbon } from "@/features/exams/components/ExamRibbon";

describe("ExamRibbon — băng chéo trang trí", () => {
  it("gắn data-slot=ribbon trên gốc", () => {
    const { container } = render(<ExamRibbon label="Hot nhất" />);

    expect(container.querySelector('[data-slot="ribbon"]')).not.toBeNull();
  });

  it("ẩn khỏi cây khả truy cập (aria-hidden)", () => {
    const { container } = render(<ExamRibbon label="Hot nhất" />);

    expect(container.querySelector('[data-slot="ribbon"]')?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  it("không chặn tương tác của thẻ bên dưới (pointer-events-none)", () => {
    const { container } = render(<ExamRibbon label="Hot nhất" />);

    expect(container.querySelector('[data-slot="ribbon"]')?.className).toContain(
      "pointer-events-none"
    );
  });

  it("hiện đúng nguyên văn label, chữ thường-đầu-câu trong DOM (viết hoa là CSS)", () => {
    const { container } = render(<ExamRibbon label="Hot nhất" />);

    expect(container.textContent).toBe("Hot nhất");
    expect(container.textContent).not.toBe("HOT NHẤT");
  });

  it("chỉ dùng token đã khai báo — không màu/spacing tuỳ tiện", () => {
    const { container } = render(<ExamRibbon label="Hot nhất" />);

    const root = container.querySelector('[data-slot="ribbon"]');
    const band = root?.firstElementChild;

    expect(root?.className).toContain("rounded-tr-card");
    expect(band?.className).toContain("bg-sun");
    expect(band?.className).toContain("glow-sun");
    expect(band?.className).toContain("text-[color:var(--sun-on-solid)]");
  });
});
