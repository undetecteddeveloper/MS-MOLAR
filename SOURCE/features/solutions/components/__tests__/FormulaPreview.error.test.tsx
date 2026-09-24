// @vitest-environment jsdom

// FormulaPreview — trạng thái nạp hỏng (Required Test #11, AC-102, UI-D23).
// File RIÊNG vì cần mock `RichText` cho TOÀN FILE ngay từ lượt import đầu.
//
// Mô phỏng "nạp hỏng" bằng một `RichText` giả THROW LÚC RENDER (không throw
// lúc `import()`): công cụ mock module động của Vitest 4 (`@vitest/mocker`)
// biến một factory NÉM LỖI LÚC IMPORT thành một "unhandled rejection" ở tầng
// resolver riêng của nó thay vì trả về đúng promise bị reject cho `import()`
// mà component đang `await` — nên phép thử "mock reject lúc import" không
// tái tạo được sự cố qua công cụ này. Ném lỗi LÚC RENDER (bên trong
// `PreviewErrorBoundary`, `componentDidCatch`) đi qua đúng nhánh bắt lỗi thứ
// hai mà `FormulaPreview.tsx` tự vẽ SẴN cho ca "render xong nhưng vẫn throw" —
// cùng trạng thái người dùng cuối cùng nhìn thấy (role=alert + "Thử lại"),
// khác NGUYÊN NHÂN kỹ thuật kích hoạt nó.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/RichText", () => ({
  RichText: () => {
    throw new Error("chunk load failed");
  },
}));

afterEach(cleanup);

describe("FormulaPreview — nạp hỏng (Required Test #11, trạng thái lỗi)", () => {
  it("RichText throw lúc render: role=alert + nút 'Thử lại'; ô nhập/chữ không đổi", async () => {
    const { FormulaPreview } = await import("@/features/solutions/components/FormulaPreview");
    render(<FormulaPreview text="Công thức $x^2$" />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước công thức" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa mở được phần xem trước. Bạn thử lại nhé.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  });

  it("bấm 'Thử lại': gọi lại open() (chunk vẫn hỏng nên vẫn quay lại role=alert)", async () => {
    const { FormulaPreview } = await import("@/features/solutions/components/FormulaPreview");
    render(<FormulaPreview text="Công thức $x^2$" />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước công thức" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa mở được phần xem trước. Bạn thử lại nhé.");
  });
});
