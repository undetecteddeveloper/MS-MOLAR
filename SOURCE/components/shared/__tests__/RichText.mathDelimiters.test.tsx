// @vitest-environment jsdom

// LaTeX delimiter normalisation — RichText renders \(…\) and \[…\] as math.
//
// Vì sao test này tồn tại: remark-math CHỈ nhận $…$ / $$…$$. Với \(…\), markdown
// coi "\(" là escape của "(" nên công thức tụt xuống văn bản thường — KHÔNG lỗi,
// KHÔNG cảnh báo, chỉ mất công thức. Đó là hình dạng im lặng nên phải có test
// canh, không thể trông vào việc nhìn thấy lúc review.
//
// Behavior: RichText(text) -> normalizeMathDelimiters -> remark-math -> KaTeX.
// @category: core-functionality
// @dependency: none — real RichText, no mocks

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText, normalizeMathDelimiters } from "../RichText";

/** Nguồn LaTeX mà KaTeX ghi lại trong <annotation> — bằng chứng đã render math. */
function annotations(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("annotation")).map((a) => a.textContent ?? "");
}

describe("normalizeMathDelimiters", () => {
  it("đổi \\(…\\) thành $…$", () => {
    expect(normalizeMathDelimiters("Cho \\(y = x^2\\) tính \\(y'\\).")).toBe(
      "Cho $y = x^2$ tính $y'$.",
    );
  });

  it("đổi \\[…\\] thành $$…$$", () => {
    expect(normalizeMathDelimiters("\\[x^2 - 4x + 3 = 0\\]")).toBe("$$x^2 - 4x + 3 = 0$$");
  });

  it("không đụng vào $…$ đã đúng sẵn", () => {
    const src = "Cho $y = x^2 + 1$, tính $y'$.";
    expect(normalizeMathDelimiters(src)).toBe(src);
  });

  it("delimiter mở mà không có đóng thì để nguyên (không đoán)", () => {
    expect(normalizeMathDelimiters("Khoảng \\(0; 5")).toBe("Khoảng \\(0; 5");
  });
});

// LƯU Ý: text phải truyền dạng {"…"} chứ KHÔNG phải text="…" — chuỗi trong
// thuộc tính JSX không xử lý escape, nên "\\(" ở đó là HAI backslash thật.
describe("RichText — \\(…\\) / \\[…\\] render thành KaTeX", () => {
  it("inline \\(…\\) ra math thay vì văn bản thường", () => {
    const { container } = render(<RichText text={"Cho hàm số \\(y = x^2 + 1\\)."} />);

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(annotations(container)).toEqual(["y = x^2 + 1"]);
  });

  it("display \\[…\\] ra math", () => {
    const { container } = render(<RichText text={"Giải: \\[x^2 - 4x + 3 = 0\\]"} />);

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(annotations(container)).toEqual(["x^2 - 4x + 3 = 0"]);
  });

  it("lệnh LaTeX giữ nguyên backslash qua bước quy đổi", () => {
    const { container } = render(<RichText text={"\\(\\frac{1}{2} + \\sqrt{2}\\)"} inline />);

    expect(annotations(container)).toEqual(["\\frac{1}{2} + \\sqrt{2}"]);
  });

  it("KHÔNG mở đường cho HTML thô (sanitize vẫn chạy cuối)", () => {
    const { container } = render(<RichText text={"\\(x\\) <img src=x onerror=alert(1)>"} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });
});
