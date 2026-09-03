// @vitest-environment jsdom

// ProfileCard — mặt nạ mật khẩu là HẰNG SỐ (AC-010), không có control hiện mật
// khẩu ở bất kỳ đâu (AC-011, AC-012), và vòng focus của hộp thoại được ĐÓNG bởi
// cha chứ không phải bởi panel (AC-050).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  changeAvatar: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { ProfileCard } from "@/features/profile/components/ProfileCard";

const USER = {
  id: "u1",
  email: "an.nguyen@example.com",
  displayName: "an.nguyen",
  avatarUrl: null,
};

afterEach(cleanup);

function openDialog() {
  act(() => {
    screen.getByRole("button", { name: "Change password" }).click();
  });
}

describe("khối danh tính", () => {
  it("hiện tên và email; tên KHÔNG BAO GIỜ là heading (nó là dữ liệu, không phải cấu trúc)", () => {
    render(<ProfileCard user={USER} />);

    // Tên xuất hiện ĐÚNG MỘT lần (2026-08-17). Trước đây là hai: một trong khối
    // danh tính, một làm giá trị của hàng "Display name" — nhưng hàng đó chỉ
    // hiển thị lại đúng cái tên nằm ngay phía trên nó, và cái nhãn ấy tồn tại
    // chỉ để làm chỗ treo một cái nút. Nút đó nay là bút chì đứng cạnh chính
    // cái tên, nên hàng thừa đã bị bỏ.
    // Không được là h1/h2/h3 — globals.css tự gán serif cho ba thẻ đó, và serif
    // ở đây sẽ nói dối rằng tên người dùng là một cấp mục lục của trang.
    const occurrences = screen.getAllByText("an.nguyen");
    expect(occurrences).toHaveLength(1);
    for (const node of occurrences) expect(node.tagName).not.toMatch(/^H[1-6]$/);

    expect(screen.getByText("an.nguyen@example.com")).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("email được nói rõ là KHÔNG đổi được, và không có ô nhập nào cho nó (AC-009)", () => {
    const { container } = render(<ProfileCard user={USER} />);

    expect(screen.getByText("Cannot be changed")).toBeDefined();
    // Lúc nghỉ, ô nhập DUY NHẤT trên thẻ là bộ chọn tệp ảnh (nó luôn nằm trong
    // cây từ 2026-08-21, xem describe bên dưới). Không có ô text nào — email
    // không sửa được thì cũng không được có chỗ để gõ vào.
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.map((i) => i.type)).toEqual(["file"]);
  });
});

// Bộ chọn ảnh chuyển từ AvatarUploader sang ĐÂY (2026-08-21): bấm "Đổi ảnh"
// nay mở thẳng trình quản lý tệp của máy thay vì mở một khối chỉ chứa đúng một
// nút "Chọn ảnh". Ba tính chất của khuôn `peer sr-only` phải sống sót qua lần
// chuyển chỗ đó, nên chúng theo chân xuống đây.
describe("bộ chọn ảnh — mở thẳng trình quản lý tệp", () => {
  function avatarInput(): HTMLInputElement {
    return screen.getByLabelText("Change picture") as HTMLInputElement;
  }

  it("'Đổi ảnh' là NHÃN của input file, không phải nút mở một khối trung gian", () => {
    render(<ProfileCard user={USER} />);

    // Nhãn trỏ đúng vào ô file → cú chạm đầu tiên mở trình quản lý tệp.
    expect(avatarInput().type).toBe("file");
    // Và không có nút nào mang chữ đó — nút thì phải có onClick để mở gì đó.
    expect(screen.queryByRole("button", { name: "Change picture" })).toBeNull();
  });

  it("input thật là `peer sr-only`, KHÔNG phải `hidden` — giữ điểm dừng Tab và ở lại cây a11y", () => {
    render(<ProfileCard user={USER} />);

    const input = avatarInput();
    expect(input.className).toContain("sr-only");
    expect(input.className).toContain("peer");
    expect(input.className).not.toContain("hidden");
    expect(input.hidden).toBe(false);
  });

  it("chỉ nhận đúng ba MIME mà Server Action nhận", () => {
    render(<ProfileCard user={USER} />);
    expect(avatarInput().getAttribute("accept")).toBe(AVATAR_LIMITS.ALLOWED_MIME.join(","));
  });

  it("nhãn hiển thị phản chiếu focus của input ẩn qua peer-focus-visible", () => {
    render(<ProfileCard user={USER} />);
    const label = screen.getByText("Change picture");
    expect(label.className).toContain("peer-focus-visible:border-ring");
  });

  it("aria-describedby của input trỏ tới một node CÓ THẬT, ngay cả khi chưa chọn gì", () => {
    render(<ProfileCard user={USER} />);
    const id = avatarInput().getAttribute("aria-describedby") as string;
    expect(document.getElementById(id)?.textContent).toBe("JPG, PNG or WebP, up to 2MB.");
  });

  it("chọn tệp → khối xem trước hiện ra, và `value` được reset để chọn LẠI vẫn bắn onChange", () => {
    render(<ProfileCard user={USER} />);
    const input = avatarInput();
    const file = new File(["x"], "chan-dung.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });

    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(screen.getByText("chan-dung.png")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
    expect(input.value).toBe("");
  });
});

describe("hàng mật khẩu", () => {
  it("mặt nạ là ĐÚNG 8 ký tự U+2022, không nhiều không ít (AC-010)", () => {
    render(<ProfileCard user={USER} />);

    const mask = document.querySelector(".font-mono") as HTMLElement;
    const chars = Array.from(mask.textContent as string);
    expect(chars).toHaveLength(8);
    expect(new Set(chars.map((c) => c.codePointAt(0)))).toEqual(new Set([0x2022]));
  });

  it("mặt nạ mang aria-hidden, và một câu sr-only nói thay nó", () => {
    render(<ProfileCard user={USER} />);

    expect((document.querySelector(".font-mono") as HTMLElement).getAttribute("aria-hidden")).toBe(
      "true"
    );
    expect(screen.getByText("Your password is not shown here.")).toBeDefined();
  });

  it("KHÔNG tồn tại control hiện mật khẩu nào (AC-011)", () => {
    render(<ProfileCard user={USER} />);

    const controls = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(controls.some((label) => /show|reveal|hiện|hiển thị/i.test(label))).toBe(false);
    // Và không có ô mật khẩu nào tồn tại khi hộp thoại chưa mở (AC-012).
    expect(document.querySelectorAll("input[type=password]").length).toBe(0);
  });

  it("nói rõ VÌ SAO không thể hiện lại được", () => {
    render(<ProfileCard user={USER} />);
    expect(
      screen.getByText("Hashed — not even we can show it again.")
    ).toBeDefined();
  });
});

describe("vòng focus của hộp thoại — việc của CHA (AC-050)", () => {
  it("Escape đóng hộp thoại và trả focus về nút đã mở nó", () => {
    render(<ProfileCard user={USER} />);
    const trigger = screen.getByRole("button", { name: "Change password" });
    openDialog();
    expect(screen.getByRole("dialog")).toBeDefined();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Huỷ cũng trả focus về đúng nút đó", () => {
    render(<ProfileCard user={USER} />);
    const trigger = screen.getByRole("button", { name: "Change password" });
    openDialog();

    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });

    expect(document.activeElement).toBe(trigger);
  });
});

describe("phản hồi thành công", () => {
  it("SuccessToast im lặng lúc mount — bộ đếm phải khởi tạo ở 0", () => {
    render(<ProfileCard user={USER} />);

    // Vùng sr-only của toast tồn tại nhưng RỖNG: một toast bắn lúc mount là
    // thông báo một thành công chưa từng xảy ra.
    const liveRegions = Array.from(document.querySelectorAll("[role=status]"));
    expect(liveRegions.length).toBeGreaterThan(0);
    for (const region of liveRegions) expect(region.textContent).toBe("");
  });

  it("vùng role=status dùng chung của thẻ tồn tại và rỗng khi rảnh", () => {
    render(<ProfileCard user={USER} />);
    const polite = document.querySelector("[role=status][aria-live=polite]");
    expect(polite).not.toBeNull();
    expect(polite?.textContent).toBe("");
  });
});
