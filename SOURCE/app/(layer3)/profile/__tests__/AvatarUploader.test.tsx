// @vitest-environment jsdom

// AvatarUploader — hai bước (chọn → xem trước → Lưu), hai trạng thái từ chối
// phía client (AC-027..AC-029), giữ tệp lại khi upload hỏng (AC-067), và chốt
// chặn upload trùng (AC-069).
//
// checkAvatarFile KHÔNG bị mock: nghĩa vụ chứng minh ở đây gồm cả việc control
// này dùng ĐÚNG hằng số mà Server Action dùng, chứ không chép riêng một bản
// giới hạn 2MB.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(layer1)/actions", () => ({ changeAvatar: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { changeAvatar } from "@/app/(layer1)/actions";
import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { AvatarUploader } from "../_components/AvatarUploader";

const changeAvatarMock = vi.mocked(changeAvatar);

beforeAll(() => {
  // jsdom không implement createObjectURL/revokeObjectURL.
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  changeAvatarMock.mockReset();
  refresh.mockReset();
});

afterEach(cleanup);

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // Dựng một tệp 2MB thật chỉ để kiểm một phép so sánh là lãng phí; `size` là
  // thứ duy nhất checkAvatarFile đọc.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function renderUploader() {
  const props = { onSuccess: vi.fn(), onStatus: vi.fn() };
  render(<AvatarUploader {...props} />);
  return props;
}

function expand() {
  act(() => {
    screen.getByRole("button", { name: "Change picture" }).click();
  });
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText("Choose an image") as HTMLInputElement;
}

function pick(file: File) {
  const input = fileInput();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("bộ chọn tệp", () => {
  it("input thật là `peer sr-only`, KHÔNG phải `hidden` — giữ điểm dừng Tab và ở lại cây a11y", () => {
    renderUploader();
    expand();

    const input = fileInput();
    expect(input.className).toContain("sr-only");
    expect(input.className).toContain("peer");
    expect(input.className).not.toContain("hidden");
    expect(input.hidden).toBe(false);
  });

  it("chỉ nhận đúng ba MIME mà Server Action nhận", () => {
    renderUploader();
    expand();
    expect(fileInput().getAttribute("accept")).toBe(AVATAR_LIMITS.ALLOWED_MIME.join(","));
  });

  it("nhãn hiển thị phản chiếu focus của input ẩn qua peer-focus-visible", () => {
    renderUploader();
    expand();
    const label = screen.getByText("Choose an image");
    expect(label.className).toContain("peer-focus-visible:border-ring");
  });

  it("`e.target.value` được reset sau mỗi lần chọn — chọn LẠI đúng tệp đó vẫn bắn onChange", () => {
    renderUploader();
    expand();
    const input = fileInput();
    pick(fakeFile("photo.png", "image/png", 1024));
    expect(input.value).toBe("");
  });
});

describe("từ chối phía client — không byte nào rời máy", () => {
  it("MIME ngoài danh sách → role=alert, KHÔNG gọi Server Action (AC-027, AC-028)", () => {
    renderUploader();
    expand();
    pick(fakeFile("animation.gif", "image/gif", 1024));

    expect(screen.getByRole("alert").textContent).toBe(
      "Only JPG, PNG and WebP images are accepted."
    );
    expect(changeAvatarMock).not.toHaveBeenCalled();
  });

  it("quá trần dung lượng → câu lỗi NÊU RÕ giới hạn (AC-029)", () => {
    renderUploader();
    expand();
    pick(fakeFile("huge.jpg", "image/jpeg", AVATAR_LIMITS.MAX_BYTES + 1));

    expect(screen.getByRole("alert").textContent).toBe(
      "That image is over 2MB. Choose a smaller one."
    );
    expect(changeAvatarMock).not.toHaveBeenCalled();
  });

  it("ĐÚNG trần 2MB vẫn được nhận — biên là `>`, không phải `>=`", () => {
    renderUploader();
    expand();
    pick(fakeFile("exact.jpg", "image/jpeg", AVATAR_LIMITS.MAX_BYTES));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("sau khi bị từ chối, bộ chọn vẫn còn đó — lần chọn kế tiếp cách một cú chạm", () => {
    renderUploader();
    expand();
    pick(fakeFile("animation.gif", "image/gif", 1024));

    expect(fileInput()).toBeDefined();
    // Không có gì để lưu, nên nút Lưu không được xuất hiện.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("aria-describedby của input chỉ trỏ tới node CÓ THẬT, cả khi có lẫn không có lỗi", () => {
    renderUploader();
    expand();

    for (const id of (fileInput().getAttribute("aria-describedby") as string).split(" ")) {
      expect(document.getElementById(id)).not.toBeNull();
    }

    pick(fakeFile("animation.gif", "image/gif", 1024));

    for (const id of (fileInput().getAttribute("aria-describedby") as string).split(" ")) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});

describe("chọn xong — xem trước rồi mới Lưu (UI-D11)", () => {
  it("chọn tệp KHÔNG upload; hiện ảnh xem trước + tên tệp + nút Lưu", () => {
    renderUploader();
    expand();
    pick(fakeFile("chan-dung.png", "image/png", 4096));

    expect(changeAvatarMock).not.toHaveBeenCalled();
    expect(screen.getByText("chan-dung.png")).toBeDefined();
    expect(document.querySelector("img[src='blob:fake-url']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("báo tên tệp đã chọn cho vùng role=status của thẻ", () => {
    const props = renderUploader();
    expand();
    pick(fakeFile("chan-dung.png", "image/png", 4096));

    expect(props.onStatus).toHaveBeenCalledWith({
      key: "profile.avatar.selected",
      values: { name: "chan-dung.png" },
    });
  });

  it("Huỷ trả focus về nút vừa làm nó biến mất, không thả xuống <body>", () => {
    renderUploader();
    expand();
    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change picture" }));
  });

  it("thu hồi object URL khi tháo — không rò blob", () => {
    const { unmount } = render(<AvatarUploader onSuccess={vi.fn()} onStatus={vi.fn()} />);
    act(() => {
      screen.getByRole("button", { name: "Change picture" }).click();
    });
    pick(fakeFile("chan-dung.png", "image/png", 4096));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});

describe("đường upload", () => {
  async function pickAndSave(outcome: Awaited<ReturnType<typeof changeAvatar>>) {
    changeAvatarMock.mockResolvedValue(outcome);
    const props = renderUploader();
    expand();
    pick(fakeFile("chan-dung.png", "image/png", 4096));
    await act(async () => {
      screen.getByRole("button", { name: "Save" }).click();
    });
    return props;
  }

  it("gửi tệp dưới ĐÚNG tên trường `avatar` mà changeAvatar đọc", async () => {
    await pickAndSave(null);
    const formData = changeAvatarMock.mock.calls[0][1];
    expect(formData.get("avatar")).toBeInstanceOf(File);
  });

  it("thành công → báo toast, thu gọn hàng, và refresh để header thấy ảnh mới (AC-071)", async () => {
    const props = await pickAndSave(null);

    expect(props.onSuccess).toHaveBeenCalledWith("profile.avatar.saved");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Change picture" })).toBeDefined();
  });

  it("hỏng → GIỮ tệp đã chọn để thử lại bằng một cú chạm (AC-067)", async () => {
    await pickAndSave({ error: "profile.avatar.uploadFailed" });

    expect(screen.getByRole("alert").textContent).toBe("The picture was not saved. Try again.");
    expect(screen.getByText("chan-dung.png")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("bị chặn tần suất → câu lỗi mang số giây thật", async () => {
    await pickAndSave({ error: "profile.error.rateLimited:120" });
    expect(screen.getByRole("alert").textContent).toBe(
      "Too many attempts. Try again in 120 seconds."
    );
  });

  it("bấm Lưu hai lần trong một tick chỉ chạy Server Action MỘT lần (AC-069)", async () => {
    let release: (v: null) => void = () => {};
    changeAvatarMock.mockReturnValue(
      new Promise<null>((resolve) => {
        release = resolve;
      })
    );
    renderUploader();
    expand();
    pick(fakeFile("chan-dung.png", "image/png", 4096));

    act(() => {
      const save = screen.getByRole("button", { name: "Save" });
      save.click();
      save.click();
    });

    expect(changeAvatarMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(null);
    });
  });
});
