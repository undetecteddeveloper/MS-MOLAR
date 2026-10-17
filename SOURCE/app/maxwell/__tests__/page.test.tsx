// @vitest-environment jsdom

// app/maxwell/page.tsx — trang ẩn Maxwell (brief 20261012-feature-maxwell-easter-egg).
// Cảnh 3D được mock: WebGL không chạy trong jsdom, phần đó đo trên trình duyệt thật.

import { describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/features/maxwell/components/MaxwellStage", () => ({
  MaxwellStage: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
    <div data-testid="stage-mock" className={className}>
      {children}
    </div>
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

  it("nền đen; khung cảnh 3D phủ cả trang và CHỨA tiêu đề (sàn chạy xuống dưới chữ, không chia vùng)", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    expect(container.querySelector("main")?.className).toContain("bg-black");
    const stage = container.querySelector("[data-testid='stage-mock']");
    expect(stage).not.toBeNull();
    expect(stage?.className).toContain("min-h-dvh");
    expect(stage?.querySelector("h1")).not.toBeNull();
  });

  it("ghi công CC BY 4.0: tên + tác giả cho trình đọc màn hình (đã in trên bục), link nguồn và giấy phép mở tab mới an toàn", async () => {
    const { container } = await renderServerTree(<MaxwellPage />);

    // Tên + tác giả in trên bục trong canvas; DOM giữ bản chữ ẩn thị giác cho trình đọc màn hình.
    const spoken = container.querySelector("p.sr-only");
    expect(spoken?.textContent).toBe("Mô hình 3D Maxwell the cat (Dingus) của bean (alwayshasbean)");

    const credit = container.querySelector("[data-testid='maxwell-credit']");
    expect(credit?.textContent).toBe("Nguồn mô hình·CC BY 4.0");
    expect(credit?.textContent).not.toContain("bean");

    const links = [...(credit?.querySelectorAll("a") ?? [])];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://sketchfab.com/3d-models/maxwell-the-cat-dingus-2ca7f3c1957847d6a145fc35de9046b0",
      "https://creativecommons.org/licenses/by/4.0/",
    ]);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      // Vùng chạm ≥ 44px (min-h-11); lớp chữ của khung cảnh cho cú nhấn xuyên qua nên link tự bật lại.
      expect(a.className).toContain("min-h-11");
      expect(a.className).toContain("pointer-events-auto");
    }
  });

  it("trang ẩn: noindex, không nằm trong sitemap/robots; thanh địa chỉ điện thoại màu đen", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(viewport.themeColor).toBe("#000000");
    expect(viewport.viewportFit).toBe("cover");
  });
});
