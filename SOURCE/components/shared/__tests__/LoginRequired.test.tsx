// @vitest-environment jsdom

// LoginRequired — thẻ "cần đăng nhập" ở phần nội dung chính của trang con mà
// khách xem được (brief 20261012 T3).

import { describe, expect, it } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import { LoginRequired } from "../LoginRequired";

async function renderCard(nextPath: string) {
  const { container } = await renderServerTree(
    <LoginRequired title="Đăng nhập để xem lịch sử" body="Mỗi bài nộp được lưu." nextPath={nextPath} />
  );
  return container;
}

describe("LoginRequired", () => {
  it("hiện tiêu đề + một câu nói đăng nhập để làm gì", async () => {
    const c = await renderCard("/history");
    expect(c.querySelector("h2")?.textContent).toBe("Đăng nhập để xem lịch sử");
    expect(c.textContent).toContain("Mỗi bài nộp được lưu.");
  });

  it("hai liên kết, cả hai mang next về đúng trang", async () => {
    const c = await renderCard("/me/dashboard");
    const links = Array.from(c.querySelectorAll("a"));

    expect(links.map((a) => a.textContent)).toEqual(["Đăng nhập", "Đăng ký"]);
    expect(links[0].getAttribute("href")).toBe("/?auth=signin&next=%2Fme%2Fdashboard");
    expect(links[1].getAttribute("href")).toBe("/?auth=signup&next=%2Fme%2Fdashboard");
  });

  it("next không hợp lệ bị bỏ — không dựng liên kết mà trang chủ phải từ chối", async () => {
    const c = await renderCard("//evil.example");
    const hrefs = Array.from(c.querySelectorAll("a")).map((a) => a.getAttribute("href"));

    expect(hrefs).toEqual(["/?auth=signin", "/?auth=signup"]);
  });
});
