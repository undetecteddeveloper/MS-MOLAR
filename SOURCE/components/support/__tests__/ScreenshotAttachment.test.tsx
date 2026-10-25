// @vitest-environment jsdom

// ScreenshotAttachment — thay thế, không cộng dồn (AC-011); pre-validate
// bằng checkScreenshotFile thật (task-04), không mock — chứng minh nó dùng
// đúng LIMITS chung, không chép riêng.
// Không bọc I18nProvider → useT() render các chuỗi mặc định "en".

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ScreenshotAttachment } from "@/components/support/ScreenshotAttachment";
import { LIMITS } from "@/lib/ugc/limits";

beforeAll(() => {
  // jsdom không implement createObjectURL/revokeObjectURL.
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

function pngFile(name: string, size = 1024): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: "image/png" });
}

describe("ScreenshotAttachment", () => {
  it("no file selected: shows the file input, no thumbnail", () => {
    render(<ScreenshotAttachment file={null} error={null} onSelect={() => {}} disabled={false} />);
    expect(screen.getByLabelText(/Đính kèm ảnh chụp màn hình/)).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("selecting a valid file calls onSelect(file, null)", () => {
    const onSelect = vi.fn();
    render(<ScreenshotAttachment file={null} error={null} onSelect={onSelect} disabled={false} />);
    const input = screen.getByLabelText(/Đính kèm ảnh chụp màn hình/) as HTMLInputElement;
    const file = pngFile("shot.png");
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(file, null);
  });

  it("a second selection replaces the first — onSelect is called with the NEW file only, never both (AC-011)", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <ScreenshotAttachment file={null} error={null} onSelect={onSelect} disabled={false} />
    );
    const firstFile = pngFile("first.png");
    let input = screen.getByLabelText(/Đính kèm ảnh chụp màn hình/) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [firstFile] });
    input.dispatchEvent(new Event("change", { bubbles: true }));

    rerender(<ScreenshotAttachment file={firstFile} error={null} onSelect={onSelect} disabled={false} />);
    // Khi đã đính kèm file, control chuyển sang dạng thumbnail+nút xoá —
    // chỉ có đúng một ô, nên không với tới input file được nếu chưa
    // xoá trước. Thao tác nút xoá, rồi chọn lại.
    screen.getByText("Xoá ảnh").click();
    expect(onSelect).toHaveBeenLastCalledWith(null, null);

    rerender(<ScreenshotAttachment file={null} error={null} onSelect={onSelect} disabled={false} />);
    const secondFile = pngFile("second.png");
    input = screen.getByLabelText(/Đính kèm ảnh chụp màn hình/) as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [secondFile] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith(secondFile, null);
    // Không bao giờ được gọi với hai file cùng lúc — chính hình dạng API (một File | null) buộc điều đó.
  });

  it("an oversized file is rejected client-side: onSelect(null, 'too_large'), same LIMITS as the server", () => {
    const onSelect = vi.fn();
    render(<ScreenshotAttachment file={null} error={null} onSelect={onSelect} disabled={false} />);
    const input = screen.getByLabelText(/Đính kèm ảnh chụp màn hình/) as HTMLInputElement;
    const tooBig = pngFile("big.png", LIMITS.MAX_SCREENSHOT_BYTES + 1);
    Object.defineProperty(input, "files", { value: [tooBig] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(null, "too_large");
  });

  it("a disallowed MIME type is rejected client-side: onSelect(null, 'invalid_type')", () => {
    const onSelect = vi.fn();
    render(<ScreenshotAttachment file={null} error={null} onSelect={onSelect} disabled={false} />);
    const input = screen.getByLabelText(/Đính kèm ảnh chụp màn hình/) as HTMLInputElement;
    const pdf = new File([new Uint8Array(10)], "doc.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { value: [pdf] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(null, "invalid_type");
  });

  it("renders the server-rejection error as role=alert when error='invalid_type'", () => {
    render(<ScreenshotAttachment file={null} error="invalid_type" onSelect={() => {}} disabled={false} />);
    expect(screen.getByRole("alert").textContent).toContain("PNG");
  });
});
