// @vitest-environment jsdom

// app/maxwell/page.tsx — trang ẩn Maxwell (brief 20261012-feature-maxwell-easter-egg).
// Cảnh 3D được mock: WebGL không chạy trong jsdom, phần đó đo trên trình duyệt thật.

import { describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/features/maxwell/components/MaxwellStage", () => ({
  MaxwellStage: ({ className }: { className?: string }) => (
    <div data-testid="stage-mock" className={className} />
  ),
}));

import MaxwellPage, { metadata, viewport } from "@/app/maxwell/page";

describe("MaxwellPage", () => {
  it("có đúng tiêu đề, một h1 duy nhất, dùng lớp chữ cầu vồng", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    const headings = container.querySelectorAll("h1");
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe("Chúc mừng bạn đã tìm ra Maxwell!!!");
    expect(headings[0].className).toContain("motion-rainbow-text");
  });

  it("không có navbar: không <header>, không <nav>, chỉ một nút (mũi tên quay lại)", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("nav")).toBeNull();
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Quay lại trang trước");
  });

  it("nền đen và có khung cảnh 3D chiếm phần giữa", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    expect(container.querySelector("main")?.className).toContain("bg-black");
    const stage = container.querySelector("[data-testid='stage-mock']");
    expect(stage).not.toBeNull();
    expect(stage?.className).toContain("flex-1");
  });

  it("ghi công CC BY 4.0: tên mô hình, tác giả, giấy phép, đều là link mở tab mới an toàn", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    const credit = container.querySelector("[data-testid='maxwell-credit']");
    expect(credit?.textContent).toContain("Maxwell the cat (Dingus)");
    expect(credit?.textContent).toContain("bean (alwayshasbean)");
    expect(credit?.textContent).toContain("CC BY 4.0");

    const links = [...(credit?.querySelectorAll("a") ?? [])];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://sketchfab.com/3d-models/maxwell-the-cat-dingus-2ca7f3c1957847d6a145fc35de9046b0",
      "https://sketchfab.com/alwayshasbean",
      "https://creativecommons.org/licenses/by/4.0/",
    ]);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      // Vùng chạm ≥ 44px (min-h-11) kể cả cho dòng chữ nhỏ.
      expect(a.className).toContain("min-h-11");
    }
  });

  it("trang ẩn: noindex, không nằm trong sitemap/robots; thanh địa chỉ điện thoại màu đen", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(viewport.themeColor).toBe("#000000");
    expect(viewport.viewportFit).toBe("cover");
  });
});
