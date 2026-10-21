// @vitest-environment jsdom

// VietQrCode — mã QR SVG nội tuyến. Repo CHƯA có thư viện mã hoá QR (ADR-0018
// chưa chốt) nên VietQrCode hiện render rỗng; khối chữ chuyển khoản vẫn đủ để
// trả tiền. QrSvg (phần vẽ) là phần đã sẵn sàng và được kiểm riêng ở đây.
//
// Khi có thư viện mã hoá và VietQrCode bắt đầu vẽ, hai ca "render rỗng" ở dưới sẽ
// ĐỎ — đó là chủ ý: người đổi phải viết lại hợp đồng, không để nó đổi lặng lẽ.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QrSvg, VietQrCode } from "@/features/billing/components/checkout/VietQrCode";

afterEach(cleanup);

describe("VietQrCode (chưa có bộ mã hoá)", () => {
  it("payload rỗng → không render gì", () => {
    const { container } = render(<VietQrCode payload="" />);
    expect(container.innerHTML).toBe("");
  });

  it("payload có nội dung → vẫn không render, không ném lỗi, không in payload ra màn hình", () => {
    const payload = "00020101021238570010A000000727";
    const { container } = render(<VietQrCode payload={payload} />);
    expect(container.innerHTML).toBe("");
    expect(document.body.textContent).not.toContain(payload);
  });
});

describe("QrSvg", () => {
  const matrix = [
    [true, false],
    [false, true],
  ];

  it("là ảnh có tên khả truy cập, viewBox = kích thước ma trận + vành lặng 4 module mỗi bên", () => {
    const { container } = render(<QrSvg matrix={matrix} label="Mã quét" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Mã quét");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 10 10");
  });

  it("vẽ đúng một ô cho mỗi module tối, lùi vào theo vành lặng", () => {
    const { container } = render(<QrSvg matrix={matrix} label="x" />);
    const rects = Array.from(container.querySelectorAll("rect")).map((r) => [
      r.getAttribute("x"),
      r.getAttribute("y"),
    ]);
    expect(rects).toEqual([
      ["4", "4"],
      ["5", "5"],
    ]);
  });

  it("nền trắng + module đen cố định, không theo theme tối (máy quét cần tương phản lớn nhất)", () => {
    const { container } = render(<QrSvg matrix={matrix} label="x" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("bg-white");
    expect(svg?.getAttribute("class")).toContain("text-black");
  });

  it("ma trận toàn sáng → không có ô nào", () => {
    const { container } = render(<QrSvg matrix={[[false]]} label="x" />);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
  });
});
