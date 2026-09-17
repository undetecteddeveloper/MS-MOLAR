// @vitest-environment jsdom

// AnonymousAvatar — ô tròn "mắt gạch" thay ảnh của danh tính ẩn danh (UI Spec
// C-08, DV-18; PRD AC-039, AC-105).
//
// Nghĩa vụ chứng minh: component KHÔNG CÓ đường nào mang danh tính vào DOM.
// Vế kiểu: `src`/`name` là lỗi biên dịch (`@ts-expect-error` không dùng tới tự
// nó là lỗi của `tsc`). Vế chạy: kể cả khi bị ép truyền, không có <img>, không
// có chữ nào lọt ra.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnonymousAvatar } from "@/components/shared/AnonymousAvatar";

afterEach(cleanup);

describe("AnonymousAvatar", () => {
  it("mặc định: không <img>, không chữ, icon mang aria-hidden", () => {
    const { container } = render(<AnonymousAvatar size={28} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("");
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("size 28 / 32 chọn đúng ô 28px / 32px", () => {
    const { container: small } = render(<AnonymousAvatar size={28} />);
    const { container: large } = render(<AnonymousAvatar size={32} />);
    expect((small.firstElementChild as HTMLElement).className.split(/\s+/)).toContain("size-7");
    expect((large.firstElementChild as HTMLElement).className.split(/\s+/)).toContain("size-8");
  });

  it("src/name không phải prop hợp lệ — và nếu bị ép truyền cũng không lọt vào DOM", () => {
    const withSrc = (
      // @ts-expect-error — AnonymousAvatar không bao giờ nhận `src` (AC-039)
      <AnonymousAvatar size={32} src="https://test-project.supabase.co/a.png" />
    );
    const withName = (
      // @ts-expect-error — AnonymousAvatar không bao giờ nhận `name` (AC-039)
      <AnonymousAvatar size={32} name="an.nguyen" />
    );
    const { container } = render(
      <>
        {withSrc}
        {withName}
      </>
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("");
    expect(container.innerHTML).not.toContain("supabase.co");
    expect(container.innerHTML).not.toContain("an.nguyen");
  });
});
