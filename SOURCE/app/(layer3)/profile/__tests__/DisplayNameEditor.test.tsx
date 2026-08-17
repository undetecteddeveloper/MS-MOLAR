// @vitest-environment jsdom

// DisplayNameEditor — gọi `updateProfile` NGUYÊN TRẠNG (AC-046), dịch năm câu
// tiếng Anh của nó sang khoá i18n (UI-D9), lọc lúc gõ bằng chính hàm dùng chung
// (AC-043..AC-045 vẫn do server cưỡng chế), và chặn gửi trùng (AC-069).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(layer1)/actions", () => ({ updateProfile: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { updateProfile } from "@/app/(layer1)/actions";
import { DisplayNameEditor } from "../_components/DisplayNameEditor";

const updateProfileMock = vi.mocked(updateProfile);

beforeEach(() => {
  updateProfileMock.mockReset();
  refresh.mockReset();
});

afterEach(cleanup);

function renderEditor(displayName = "an.nguyen") {
  const props = { displayName, onSuccess: vi.fn(), onStatus: vi.fn() };
  render(<DisplayNameEditor {...props} />);
  return props;
}

function startEditing() {
  act(() => {
    screen.getByRole("button", { name: "Change name" }).click();
  });
}

function input(): HTMLInputElement {
  return screen.getByLabelText("Display name") as HTMLInputElement;
}

function submitForm() {
  fireEvent.submit(input().closest("form")!);
}

describe("trạng thái nghỉ", () => {
  it("hiện tên hiện hành dưới dạng chữ, kèm nút mở trình sửa (AC-008)", () => {
    renderEditor("an.nguyen");
    expect(screen.getByText("an.nguyen")).toBeDefined();
    expect(screen.getByRole("button", { name: "Change name" })).toBeDefined();
  });
});

describe("trình sửa", () => {
  it("ô nhập mang nhãn khả truy cập và một gợi ý trỏ tới node có thật", () => {
    renderEditor();
    startEditing();

    const field = input();
    expect(field.getAttribute("name")).toBe("displayName");
    const describedBy = field.getAttribute("aria-describedby") as string;
    expect(document.getElementById(describedBy)?.textContent).toBe(
      "Max 12 characters, letters and dots only."
    );
  });

  it("lọc lúc gõ dùng CHUNG luật với server: bỏ ký tự cấm, cắt ở 12", () => {
    renderEditor();
    startEditing();

    fireEvent.change(input(), { target: { value: "an_ngu#yen1234567890" } });
    expect(input().value).toBe("annguyen");

    fireEvent.change(input(), { target: { value: "abcdefghijklmnopq" } });
    expect(input().value).toBe("abcdefghijkl");
  });

  it("chữ tiếng Việt có dấu KHÔNG bị bộ lọc gạt đi (AC-045)", () => {
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "Nguyễn" } });
    expect(input().value).toBe("Nguyễn");
  });

  it("nháp rỗng → Lưu bị aria-disabled và KHÔNG có chữ lỗi nào", () => {
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");
    // Một ô trống mà người dùng còn đang gõ dở KHÔNG phải một thất bại.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("nháp rỗng → gửi đi không gọi Server Action", () => {
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "" } });
    submitForm();

    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("Huỷ trả focus về nút vừa làm nó biến mất, không thả xuống <body>", () => {
    renderEditor();
    startEditing();
    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change name" }));
  });
});

describe("đường server", () => {
  it("thành công (trả null) → thu gọn, báo toast, refresh cho header + sidebar (AC-047)", async () => {
    updateProfileMock.mockResolvedValue(null);
    const props = renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    await act(async () => {
      submitForm();
    });

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(props.onSuccess).toHaveBeenCalledWith("profile.name.saved");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Change name" })).toBeDefined();
  });

  it("câu tiếng Anh của updateProfile được DỊCH, không lộ nguyên văn (UI-D9)", async () => {
    updateProfileMock.mockResolvedValue({
      error: "Display name may only contain letters and dots",
    });
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "annguyen" } });

    await act(async () => {
      submitForm();
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Display name may only contain letters and dots."
    );
  });

  it("lỗi → giữ nguyên nháp và mở lại mọi control để sửa tại chỗ (AC-067)", async () => {
    updateProfileMock.mockResolvedValue({ error: "Display name must not be empty" });
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    await act(async () => {
      submitForm();
    });

    expect(input().value).toBe("bao.tran");
    expect(input().readOnly).toBe(false);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("false");
  });

  it("lỗi → ô nhập được nối với dòng lỗi, và id đó CHỈ tồn tại lúc có lỗi", async () => {
    updateProfileMock.mockResolvedValue({ error: "Display name must not be empty" });
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    // Trước khi lỗi xảy ra: không có id lỗi nào bị trỏ tới.
    expect(input().getAttribute("aria-describedby")).not.toContain("error");

    await act(async () => {
      submitForm();
    });

    expect(input().getAttribute("aria-invalid")).toBe("true");
    for (const id of (input().getAttribute("aria-describedby") as string).split(" ")) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("câu lỗi lạ của Supabase KHÔNG lên màn hình — rơi về câu chung", async () => {
    updateProfileMock.mockResolvedValue({
      error: 'duplicate key value violates unique constraint "user_profiles_pkey"',
    });
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    await act(async () => {
      submitForm();
    });

    expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
  });

  it("gửi hai lần trong một tick chỉ chạy Server Action MỘT lần (AC-069)", async () => {
    let release: (v: null) => void = () => {};
    updateProfileMock.mockReturnValue(
      new Promise<null>((resolve) => {
        release = resolve;
      })
    );
    renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    act(() => {
      submitForm();
      submitForm();
    });

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
    });
  });

  it("báo chữ 'đang lưu' cho vùng role=status của thẻ rồi dọn sạch", async () => {
    updateProfileMock.mockResolvedValue(null);
    const props = renderEditor();
    startEditing();
    fireEvent.change(input(), { target: { value: "bao.tran" } });

    await act(async () => {
      submitForm();
    });

    expect(props.onStatus).toHaveBeenCalledWith({ key: "common.saving" });
    expect(props.onStatus).toHaveBeenLastCalledWith(null);
  });
});
