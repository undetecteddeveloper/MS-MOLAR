// @vitest-environment jsdom

// AvatarUploader — BƯỚC HAI của việc đổi ảnh: xem trước tệp đã chọn rồi mới
// Lưu (UI-D11), hai trạng thái từ chối phía client (AC-027..AC-029), giữ tệp
// lại khi upload hỏng (AC-067), và chốt chặn upload trùng (AC-069).
//
// BƯỚC MỘT (ô `<input type="file">` + nhãn "Đổi ảnh") nay thuộc về ProfileCard,
// nên nó được kiểm ở ProfileCard.test.tsx — ở đây `Harness` chỉ dựng lại đúng
// phần sở hữu đó để có thể bơm một tệp vào và để kiểm việc trả tiêu điểm.
//
// checkAvatarFile KHÔNG bị mock: nghĩa vụ chứng minh ở đây gồm cả việc control
// này dùng ĐÚNG hằng số mà Server Action dùng, chứ không chép riêng một bản
// giới hạn 2MB.

import { useRef, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({ changeAvatar: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { changeAvatar } from "@/features/auth/actions";
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

/** Dựng lại đúng phần sở hữu mà ProfileCard đảm nhiệm: bộ chọn tệp nằm NGOÀI
 *  khối xem trước và ở LẠI trong cây khi khối đó mở, còn khối xem trước thì
 *  được gắn/gỡ theo việc có tệp hay không. Không có cái khung này thì không
 *  test được việc trả tiêu điểm — đích trả về không tồn tại. */
function Harness({ onSuccess, onStatus }: { onSuccess: () => void; onStatus: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        id="profile-avatar"
        type="file"
        className="peer sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <label htmlFor="profile-avatar">Change picture</label>
      {file && (
        <AvatarUploader
          id="profile-avatar-panel"
          file={file}
          onClose={() => {
            setFile(null);
            inputRef.current?.focus();
          }}
          onSuccess={onSuccess}
          onStatus={onStatus}
        />
      )}
    </>
  );
}

function renderUploader() {
  const props = { onSuccess: vi.fn(), onStatus: vi.fn() };
  render(<Harness {...props} />);
  return props;
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText("Change picture") as HTMLInputElement;
}

/** Người dùng chọn một tệp trong trình quản lý tệp của máy. Đây là ĐƯỜNG VÀO
 *  duy nhất của khối này — không còn cú bấm "mở khối" nào đứng trước nó. */
function pick(file: File) {
  const input = fileInput();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("từ chối phía client — không byte nào rời máy", () => {
  it("MIME ngoài danh sách → role=alert, KHÔNG gọi Server Action (AC-027, AC-028)", () => {
    renderUploader();
    pick(fakeFile("animation.gif", "image/gif", 1024));

    expect(screen.getByRole("alert").textContent).toBe(
      "Only JPG, PNG and WebP images are accepted."
    );
    expect(changeAvatarMock).not.toHaveBeenCalled();
  });

  it("quá trần dung lượng → câu lỗi NÊU RÕ giới hạn (AC-029)", () => {
    renderUploader();
    pick(fakeFile("huge.jpg", "image/jpeg", AVATAR_LIMITS.MAX_BYTES + 1));

    expect(screen.getByRole("alert").textContent).toBe(
      "That image is over 2MB. Choose a smaller one."
    );
    expect(changeAvatarMock).not.toHaveBeenCalled();
  });

  it("ĐÚNG trần 2MB vẫn được nhận — biên là `>`, không phải `>=`", () => {
    renderUploader();
    pick(fakeFile("exact.jpg", "image/jpeg", AVATAR_LIMITS.MAX_BYTES));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("tệp bị từ chối KHÔNG có nút Lưu, và cũng không tạo object URL nào để rò", () => {
    renderUploader();
    pick(fakeFile("animation.gif", "image/gif", 1024));

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(document.querySelector("img[src='blob:fake-url']")).toBeNull();
  });

  it("sau khi bị từ chối, bộ chọn vẫn còn đó — lần chọn kế tiếp cách một cú chạm", () => {
    renderUploader();
    pick(fakeFile("animation.gif", "image/gif", 1024));

    expect(fileInput()).toBeDefined();
  });
});

describe("chọn xong — xem trước rồi mới Lưu (UI-D11)", () => {
  it("chọn tệp KHÔNG upload; hiện ảnh xem trước + tên tệp + nút Lưu", () => {
    renderUploader();
    pick(fakeFile("chan-dung.png", "image/png", 4096));

    expect(changeAvatarMock).not.toHaveBeenCalled();
    expect(screen.getByText("chan-dung.png")).toBeDefined();
    expect(document.querySelector("img[src='blob:fake-url']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("KHÔNG còn bước 'Chọn ảnh' trung gian — chọn tệp xong là vào thẳng xem trước", () => {
    renderUploader();
    // Trước khi chọn: khối này chưa tồn tại, nên không có nút nào của nó cả.
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    pick(fakeFile("chan-dung.png", "image/png", 4096));
    // Sau khi chọn: đi thẳng tới xem trước, không có nút mở bộ chọn thứ hai.
    expect(screen.queryByRole("button", { name: "Choose an image" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("Huỷ trả tiêu điểm về bộ chọn tệp, không thả xuống <body>", () => {
    renderUploader();
    pick(fakeFile("chan-dung.png", "image/png", 4096));
    act(() => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });

    expect(document.activeElement).toBe(fileInput());
  });

  it("thu hồi object URL khi tháo — không rò blob", () => {
    const { unmount } = render(<Harness onSuccess={vi.fn()} onStatus={vi.fn()} />);
    pick(fakeFile("chan-dung.png", "image/png", 4096));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});

describe("đường upload", () => {
  async function pickAndSave(outcome: Awaited<ReturnType<typeof changeAvatar>>) {
    changeAvatarMock.mockResolvedValue(outcome);
    const props = renderUploader();
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
    // Khối xem trước đã biến mất; bộ chọn tệp thì vẫn ở đó.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(fileInput()).toBeDefined();
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
