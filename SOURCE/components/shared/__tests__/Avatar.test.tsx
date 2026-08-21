// @vitest-environment jsdom

// Avatar — bốn đường rơi về initials và MỘT đường duy nhất render <img>
// (PRD AC-006, AC-033b, AC-040, AC-042; UI Spec §Component: Avatar).
//
// Nghĩa vụ chứng minh của file này là câu "KHÔNG BAO GIỜ có ảnh vỡ": mỗi case
// dưới đây kiểm CẢ HAI vế — có initials VÀ không có phần tử <img> nào. Chỉ
// kiểm vế đầu thì một bản cài đặt render <img src=""> bên cạnh initials vẫn
// xanh, mà đó đúng là ảnh vỡ.

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Avatar } from "../Avatar";

const STORAGE_ORIGIN = "https://test-project.supabase.co";
const SIGNED_URL = `${STORAGE_ORIGIN}/storage/v1/object/sign/avatars/u1/a.png?token=x`;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE_ORIGIN;
});

afterEach(cleanup);

describe("Avatar", () => {
  it("src null → initials, và KHÔNG phát ra phần tử <img> nào (AC-006)", () => {
    const { container } = render(<Avatar src={null} name="an.nguyen" size={96} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AN");
  });

  it("origin ngoài allowlist → initials, không <img> (fail closed)", () => {
    const { container } = render(
      <Avatar src="https://evil.example.com/a.png" name="an.nguyen" size={32} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AN");
  });

  it("javascript: URL → initials, không <img>", () => {
    const { container } = render(<Avatar src="javascript:alert(1)" name="Nguyễn" size={24} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("N");
  });

  it("src hợp lệ → <img> với alt rỗng (trang trí — tên hiển thị đứng cạnh, AC-042)", () => {
    const { container } = render(<Avatar src={SIGNED_URL} name="an.nguyen" size={96} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(SIGNED_URL);
    expect(img?.getAttribute("alt")).toBe("");
    expect(container.textContent).toBe("");
  });

  it("ảnh lỗi lúc chạy (object bị xoá / chữ ký hết hạn) → rơi về initials", () => {
    const { container } = render(<Avatar src={SIGNED_URL} name="an.nguyen" size={96} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();

    fireEvent.error(img as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AN");
  });

  it("tên không có chữ cái nào (`...`) → glyph trung tính, không phải vòng tròn rỗng", () => {
    const { container } = render(<Avatar src={null} name="..." size={96} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("");
    // Vòng tròn RỖNG là lỗi được nêu đích danh trong Design Doc; chỗ trống phải
    // do một glyph (svg) chiếm, không phải do không có gì.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("chữ initials mang aria-hidden — nó nhắc lại một cái tên đã có trong DOM", () => {
    const { container } = render(<Avatar src={null} name="an.nguyen" size={24} />);
    const letters = container.querySelector("[aria-hidden]");
    expect(letters?.textContent).toBe("AN");
  });

  it("size điều khiển hộp render (24 / 32 / 96 đều dùng chung một component)", () => {
    const { container } = render(<Avatar src={null} name="An" size={32} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.width).toBe("32px");
    expect(box.style.height).toBe("32px");
  });
});
