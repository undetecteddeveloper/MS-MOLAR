// @vitest-environment jsdom

// /pricing/checkout — hai ranh giới của route: error.tsx và loading.tsx.
//
// error.tsx phải: báo lỗi bằng role="alert" và kéo focus vào đó (người dùng
// bàn phím/trình đọc màn hình không bị bỏ lại ở nút vừa bấm), cho thử lại qua
// `reset`, và chỉ log `digest` — message lỗi có thể mang nội dung đơn.
// loading.tsx phải: nói "đang tải" cho trình đọc màn hình và giữ ĐÚNG khung
// đệm của page.tsx, nếu lệch thì nội dung giật khi thay skeleton.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import CheckoutError from "../error";
import CheckoutLoading from "../loading";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/pricing/checkout error.tsx", () => {
  function renderError(error: Error & { digest?: string }, reset = vi.fn()) {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<CheckoutError error={error} reset={reset} />);
    return reset;
  }

  it("báo lỗi bằng role=alert và kéo focus vào đó", () => {
    renderError(Object.assign(new Error("x"), { digest: "d1" }));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(copy["error.couldntLoad"]);
    expect(document.activeElement).toBe(alert);
  });

  it("nút Thử lại gọi reset đúng một lần", () => {
    const reset = renderError(new Error("x"));

    fireEvent.click(screen.getByRole("button", { name: copy["common.retry"] }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("chỉ log digest, không log message (message có thể mang nội dung đơn)", () => {
    const SECRET = "đơn 1792503843145 của user-abc";
    renderError(Object.assign(new Error(SECRET), { digest: "digest-42" }));

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("digest-42");
    expect(logged).not.toContain(SECRET);
  });
});

describe("/pricing/checkout loading.tsx", () => {
  it("aria-busy và có câu 'đang tải' cho trình đọc màn hình", () => {
    const { container } = render(<CheckoutLoading />);

    const main = container.querySelector("main")!;
    expect(main.getAttribute("aria-busy")).toBe("true");
    expect(main.querySelector(".sr-only")?.textContent).toBe(copy["common.loading"]);
  });

  it("khung đệm khớp page.tsx — thay skeleton không làm nội dung giật", () => {
    const { container } = render(<CheckoutLoading />);
    const page = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"),
      "utf8"
    );

    const padding = "px-4 py-6 sm:px-6 sm:py-8";
    expect(page).toContain(padding);
    expect(container.querySelector("main")!.className).toContain(padding);
  });
});
