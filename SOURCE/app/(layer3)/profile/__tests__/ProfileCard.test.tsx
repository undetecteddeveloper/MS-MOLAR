// @vitest-environment jsdom

// ProfileCard — mặt nạ mật khẩu là HẰNG SỐ (AC-010), không có control hiện mật
// khẩu ở bất kỳ đâu (AC-011, AC-012), và vòng focus của hộp thoại được ĐÓNG bởi
// cha chứ không phải bởi panel (AC-050).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(layer1)/actions", () => ({
  changeAvatar: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ProfileCard } from "../_components/ProfileCard";

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

    // Tên xuất hiện hai lần theo đúng đặc tả: một lần trong khối danh tính, một
    // lần làm giá trị của hàng "Display name". Không lần nào được là h1/h2/h3 —
    // globals.css tự gán serif cho ba thẻ đó, và serif ở đây sẽ nói dối rằng
    // tên người dùng là một cấp mục lục của trang.
    const occurrences = screen.getAllByText("an.nguyen");
    expect(occurrences).toHaveLength(2);
    for (const node of occurrences) expect(node.tagName).not.toMatch(/^H[1-6]$/);

    expect(screen.getByText("an.nguyen@example.com")).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("email được nói rõ là KHÔNG đổi được, và không có ô nhập nào cho nó (AC-009)", () => {
    const { container } = render(<ProfileCard user={USER} />);

    expect(screen.getByText("Cannot be changed")).toBeDefined();
    // Không hộp thoại nào đang mở → toàn bộ input trên thẻ chỉ có đúng ô file
    // của bộ chọn ảnh khi nó mở; lúc nghỉ thì không có input nào cả.
    expect(container.querySelectorAll("input").length).toBe(0);
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
      screen.getByText("Passwords are stored hashed, so nobody — us included — can show yours again.")
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
