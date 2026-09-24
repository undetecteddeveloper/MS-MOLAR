// @vitest-environment jsdom

// FormulaPreview — trạng thái nạp (khối giữ chỗ cao cố định → nội dung),
// bấm lại để ẩn, ô nhập trống (Required Test #11, AC-102, UI-D23). `RichText`
// KHÔNG bị mock ở đây (S15/Proof Obligation cần bản render THẬT giống hệt màn
// xem) — trạng thái "nạp hỏng" có file test riêng (`FormulaPreview.error.test.tsx`)
// vì nó cần mock `RichText` cho CẢ FILE ngay từ đầu (ES module cache khiến một
// mock bật/tắt giữa chừng trong cùng file không tái tạo lại được sự cố nạp).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormulaPreview } from "@/features/solutions/components/FormulaPreview";

afterEach(cleanup);

describe("FormulaPreview — nạp thật (Required Test #11)", () => {
  it("bấm 'Xem trước công thức': hiện khối giữ chỗ cao cố định rồi bản render thật", async () => {
    render(<FormulaPreview text="Công thức $x^2$" />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước công thức" }));
    expect(screen.getByRole("button", { name: "Đang mở xem trước…" })).toBeTruthy();

    await screen.findByRole("button", { name: "Xem trước công thức" });
    await waitFor(() => expect(document.querySelector(".rich-text")).toBeTruthy());
    expect(document.body.textContent).toContain("Công thức");
  });

  it("ô nhập trống: hiện 'Chưa có gì để xem trước.' ngay, không qua trạng thái đang tải", () => {
    render(<FormulaPreview text="   " />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước công thức" }));

    expect(screen.getByText("Chưa có gì để xem trước.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Đang mở xem trước…" })).toBeNull();
  });

  it("bấm lại khi đang hiện: ẩn vùng xem trước (aria-expanded false)", async () => {
    render(<FormulaPreview text="Công thức $x^2$" />);
    const button = screen.getByRole("button", { name: "Xem trước công thức" });

    fireEvent.click(button);
    await screen.findByRole("button", { name: "Xem trước công thức" });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("FormulaPreview — không import tĩnh RichText (M12)", () => {
  it("mã nguồn không chứa 'import { RichText }' hay import mặc định tĩnh từ RichText.tsx", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../FormulaPreview.tsx"),
      "utf-8"
    );
    expect(source).not.toMatch(/^\s*import\s+\{[^}]*RichText[^}]*\}\s+from\s+["']@\/components\/shared\/RichText["']/m);
    expect(source).toContain('dynamic(() => import("@/components/shared/RichText")');
  });
});
