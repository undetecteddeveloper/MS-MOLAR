// @vitest-environment jsdom

// ChangePasswordDialog — bẫy focus (HÀNH VI MỚI, AC-050), Escape, hai lần từ
// chối không chạm mạng (AC-017/AC-019), xoá sạch ba ô sau mỗi lượt bị từ chối
// (AC-068), và chốt chặn gửi trùng (AC-069).
//
// Không bọc I18nProvider → useT() rơi về từ điển "en", nên các chuỗi khẳng định
// dưới đây là bản tiếng Anh.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(layer1)/actions", () => ({ changePassword: vi.fn() }));

import { changePassword } from "@/app/(layer1)/actions";
import { ChangePasswordDialog } from "../_components/ChangePasswordDialog";

const changePasswordMock = vi.mocked(changePassword);

function renderDialog(overrides: Partial<Parameters<typeof ChangePasswordDialog>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
  render(<ChangePasswordDialog {...props} />);
  return props;
}

/** Panel — KHÔNG dùng `[tabindex="-1"]` trần: scrim cũng mang đúng thuộc tính
 *  đó và đứng trước trong DOM, nên bộ chọn trần sẽ bắt nhầm scrim. */
function panelOf(): HTMLElement {
  return screen.getByRole("dialog").querySelector("div[tabindex='-1']") as HTMLElement;
}

function fields() {
  return {
    current: screen.getByLabelText("Current password") as HTMLInputElement,
    next: screen.getByLabelText("New password") as HTMLInputElement,
    confirm: screen.getByLabelText("Confirm new password") as HTMLInputElement,
  };
}

function fill(current: string, next: string, confirm: string) {
  const f = fields();
  fireEvent.change(f.current, { target: { value: current } });
  fireEvent.change(f.next, { target: { value: next } });
  fireEvent.change(f.confirm, { target: { value: confirm } });
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: /Update password|Saving/ }).closest("form")!);
}

beforeEach(() => {
  changePasswordMock.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("khuôn hộp thoại", () => {
  it("open=false không render gì — panel bị THÁO, không phải bị ẩn", () => {
    renderDialog({ open: false });
    expect(document.querySelector("[role=dialog]")).toBeNull();
    // Không có ô mật khẩu nào tồn tại trong DOM khi hộp thoại đóng (AC-012).
    expect(document.querySelectorAll("input[type=password]").length).toBe(0);
  });

  it("mở ra: portal tới <body>, ba ô type=password, tên khả truy cập từ <h2>", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const labelledBy = dialog.getAttribute("aria-labelledby") as string;
    expect(document.getElementById(labelledBy)?.textContent).toBe("Change password");
    expect(document.querySelectorAll("input[type=password]").length).toBe(3);
  });

  it("khoá cuộn nền khi mở và TRẢ LẠI giá trị cũ khi đóng", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(
      <ChangePasswordDialog open onClose={vi.fn()} onSuccess={vi.fn()} onStatus={vi.fn()} />
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("panel nhận focus lúc mở — người dùng nghe tên hộp thoại trước, rồi mới tới ô đầu", () => {
    renderDialog();
    expect(document.activeElement).toBe(panelOf());
  });

  it("Escape đóng hộp thoại", () => {
    const props = renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("bấm scrim đóng hộp thoại; scrim KHÔNG phải một điểm dừng Tab", () => {
    const props = renderDialog();
    const scrim = screen.getByRole("dialog").querySelector("button[aria-hidden]") as HTMLElement;
    expect(scrim.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(scrim);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("bẫy focus — hành vi MỚI, không kế thừa từ modal nào trong repo", () => {
  it("Tab từ phần tử CUỐI vòng về phần tử ĐẦU", () => {
    renderDialog();
    const submitBtn = screen.getByRole("button", { name: "Update password" });
    submitBtn.focus();
    expect(document.activeElement).toBe(submitBtn);

    fireEvent.keyDown(submitBtn, { key: "Tab" });

    expect(document.activeElement).toBe(fields().current);
  });

  it("Shift+Tab từ phần tử ĐẦU vòng xuống phần tử CUỐI", () => {
    renderDialog();
    const current = fields().current;
    current.focus();

    fireEvent.keyDown(current, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Update password" }));
  });

  it("Shift+Tab ngay khi vừa mở (focus đang ở panel) vòng xuống phần tử CUỐI, không thoát ra trang", () => {
    renderDialog();
    const panel = panelOf() as HTMLElement;
    expect(document.activeElement).toBe(panel);

    fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Update password" }));
  });

  it("Tab ở GIỮA không bị chặn — trình duyệt tự đi tiếp", () => {
    renderDialog();
    const next = fields().next;
    next.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    next.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("từ chối phía client — KHÔNG lượt mạng nào được phát ra", () => {
  it("thiếu mật khẩu hiện tại → lỗi riêng, không gọi Server Action (AC-017)", () => {
    renderDialog();
    fill("", "a-new-password", "a-new-password");
    submit();

    expect(screen.getByRole("alert").textContent).toBe("Enter your current password.");
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("hai ô mật khẩu mới lệch nhau → lỗi riêng, không gọi Server Action (AC-019)", () => {
    renderDialog();
    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2027");
    submit();

    expect(screen.getByRole("alert").textContent).toBe("The two new passwords do not match.");
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("lỗi lệch nhau đánh dấu ĐÚNG hai ô mới, KHÔNG đánh dấu ô hiện tại", () => {
    renderDialog();
    fill("cu-rich-2026", "moi-rich-2026", "khac-han-2026");
    submit();

    const f = fields();
    expect(f.next.getAttribute("aria-invalid")).toBe("true");
    expect(f.confirm.getAttribute("aria-invalid")).toBe("true");
    expect(f.current.getAttribute("aria-invalid")).toBeNull();
  });

  it("mọi lượt từ chối đều xoá SẠCH ba ô và đưa con trỏ về ô hiện tại (AC-068)", () => {
    renderDialog();
    fill("cu-rich-2026", "moi-rich-2026", "khac-han-2026");
    submit();

    const f = fields();
    expect(f.current.value).toBe("");
    expect(f.next.value).toBe("");
    expect(f.confirm.value).toBe("");
    expect(document.activeElement).toBe(f.current);
  });
});

describe("aria-describedby chỉ tồn tại khi lỗi tồn tại", () => {
  it("lúc chưa lỗi, ô hiện tại KHÔNG mang aria-describedby treo lơ lửng", () => {
    renderDialog();
    expect(fields().current.getAttribute("aria-describedby")).toBeNull();
  });

  it("mọi id trong aria-describedby đều trỏ tới node CÓ THẬT trong tài liệu", () => {
    renderDialog();
    fill("", "x", "x");
    submit();

    const ids = (fields().current.getAttribute("aria-describedby") as string).split(" ");
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
  });

  it("ô mật khẩu mới luôn được gợi ý mô tả, và gợi ý đó nêu sàn độ dài", () => {
    renderDialog();
    const describedBy = fields().next.getAttribute("aria-describedby") as string;
    expect(document.getElementById(describedBy)?.textContent).toBe("At least 10 characters.");
  });
});

describe("đường server", () => {
  it("thành công (trả null) → báo thành công rồi đóng; mật khẩu mới không hiện ở đâu", async () => {
    changePasswordMock.mockResolvedValue(null);
    const props = renderDialog();

    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2026");
    await act(async () => {
      submit();
    });

    expect(props.onSuccess).toHaveBeenCalledWith("profile.password.changed");
    expect(props.onClose).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("moi-rich-2026");
  });

  it("sai mật khẩu hiện tại → hộp thoại VẪN MỞ, gửi lại được ngay (AC-018d)", async () => {
    changePasswordMock.mockResolvedValue({ error: "profile.password.errorCurrentWrong" });
    const props = renderDialog();

    fill("sai-mat-khau", "moi-rich-2026", "moi-rich-2026");
    await act(async () => {
      submit();
    });

    expect(screen.getByRole("alert").textContent).toBe("That is not your current password.");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(fields().current.getAttribute("aria-disabled")).toBe("false");
  });

  it("câu NGUYÊN VĂN của validatePassword được dịch, không hiện tiếng Anh thô (UI-D10)", async () => {
    changePasswordMock.mockResolvedValue({
      error: "This password is too common — please choose a different one",
    });
    renderDialog();

    fill("cu-rich-2026", "password123", "password123");
    await act(async () => {
      submit();
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "That password is too common. Choose a different one."
    );
  });

  it("rate limit mang theo số giây (AC-023)", async () => {
    changePasswordMock.mockResolvedValue({ error: "profile.error.rateLimited:900" });
    renderDialog();

    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2026");
    await act(async () => {
      submit();
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Too many attempts. Try again in 900 seconds."
    );
  });

  it("gửi lần hai lúc đang bay bị chốt đồng bộ chặn — Server Action chỉ chạy MỘT lần (AC-069)", async () => {
    let release: (v: null) => void = () => {};
    changePasswordMock.mockReturnValue(
      new Promise<null>((resolve) => {
        release = resolve;
      })
    );
    renderDialog();

    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2026");
    act(() => {
      submit();
      submit();
    });

    expect(changePasswordMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(null);
    });
  });

  it("lúc đang gửi: các ô readOnly + aria-disabled (không phải disabled gốc), Huỷ vẫn sống", async () => {
    let release: (v: null) => void = () => {};
    changePasswordMock.mockReturnValue(
      new Promise<null>((resolve) => {
        release = resolve;
      })
    );
    renderDialog();

    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2026");
    act(() => {
      submit();
    });

    await waitFor(() => {
      expect(fields().current.readOnly).toBe(true);
    });
    const f = fields();
    expect(f.current.disabled).toBe(false);
    expect(f.current.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Cancel" }).getAttribute("aria-disabled")).toBeNull();

    await act(async () => {
      release(null);
    });
  });

  it("báo chữ 'đang xử lý' cho vùng role=status của thẻ, rồi dọn sạch khi xong", async () => {
    changePasswordMock.mockResolvedValue(null);
    const props = renderDialog();

    fill("cu-rich-2026", "moi-rich-2026", "moi-rich-2026");
    await act(async () => {
      submit();
    });

    expect(props.onStatus).toHaveBeenCalledWith({ key: "common.saving" });
    expect(props.onStatus).toHaveBeenLastCalledWith(null);
  });
});
