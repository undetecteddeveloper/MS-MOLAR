// @vitest-environment jsdom

// ConfirmDialog — hộp thoại xác nhận dùng chung, hai lựa chọn (Gỡ về nháp, Xoá
// bình luận, Xoá hẳn) và ba lựa chọn Lưu/Bỏ/Ở lại (UI Spec C-32; PRD AC-104).
//
// Nghĩa vụ chứng minh chính (AC-104, nguyên văn EARS): "when a note or comment
// sheet is closed with unsaved content different from what was open, the
// system shall present exactly three choices (Lưu/Bỏ/Ở lại) before closing."
// Ranh giới được kiểm là OverlaySheet + ConfirmDialog variant="dirty-close"
// render CÙNG NHAU như NoteSheet/CommentSheet sẽ làm; đường đóng là Escape và
// chạm scrim; trạng thái kiểm là hộp thoại có đúng 3 nút VÀ tấm trượt vẫn còn
// trong DOM với nguyên chữ.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { OverlaySheet } from "@/components/shared/OverlaySheet";
import { t } from "@/lib/copy";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** matchMedia giả: giảm chuyển động TẮT (và bề rộng hẹp) — usePresence chạy
 *  pha đóng thật, lớp phủ còn trong DOM thêm một lúc sau khi `open` về false. */
function stubMotionOn(): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Promise điều khiển tay — để quan sát trạng thái "đang xử lý". */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function buttonNames(dialog: HTMLElement): string[] {
  return within(dialog)
    .getAllByRole("button")
    .map((button) => button.textContent ?? "");
}

describe("ConfirmDialog variant='confirm' — hai lựa chọn", () => {
  function renderConfirm(overrides: Partial<{ destructive: boolean; error: string | null }> = {}) {
    const onConfirm = vi.fn(async () => {});
    const onCancel = vi.fn();
    const utils = render(
      <ConfirmDialog
        open
        variant="confirm"
        title="Xoá bình luận này?"
        body="Mọi người sẽ không thấy nó nữa."
        confirmLabel="Xoá"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...overrides}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Xoá bình luận này?" });
    return { ...utils, dialog, onConfirm, onCancel };
  }

  it("đúng hai nút [Huỷ] [Hành động]; aria-modal; mô tả trỏ tới dòng hệ quả", () => {
    const { dialog } = renderConfirm();
    expect(buttonNames(dialog)).toEqual(["Huỷ", "Xoá"]);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const bodyId = dialog.getAttribute("aria-describedby");
    expect(bodyId && document.getElementById(bodyId)?.textContent).toBe(
      "Mọi người sẽ không thấy nó nữa."
    );
  });

  it("tiêu điểm vào nút chính khi mở", () => {
    renderConfirm();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Xoá" }));
  });

  it("Escape = 'Huỷ': gọi onCancel, không gọi onConfirm", () => {
    const { onCancel, onConfirm } = renderConfirm();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("bấm 'Huỷ' hoặc chạm scrim gọi onCancel", () => {
    const { dialog, onCancel } = renderConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    const scrim = dialog.previousElementSibling as HTMLElement;
    expect(scrim.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(scrim);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("destructive tô nút hành động màu xoá; mặc định là nút chính thường", () => {
    const { unmount } = renderConfirm({ destructive: true });
    expect(screen.getByRole("button", { name: "Xoá" }).className).toContain("text-destructive");
    unmount();
    renderConfirm();
    const tokens = screen.getByRole("button", { name: "Xoá" }).className.split(/\s+/);
    expect(tokens).toContain("bg-primary");
    expect(tokens).not.toContain("text-destructive");
  });

  it("lỗi: role=alert NẰM TRONG hộp thoại, hộp thoại vẫn mở", () => {
    const { dialog } = renderConfirm({ error: "Chưa gỡ được. Bạn thử lại nhé." });
    expect(within(dialog).getByRole("alert").textContent).toBe("Chưa gỡ được. Bạn thử lại nhé.");
    expect(screen.getByRole("dialog", { name: "Xoá bình luận này?" })).toBe(dialog);
  });

  it("Tab ở nút cuối vòng về nút đầu trong hộp thoại", () => {
    renderConfirm();
    const last = screen.getByRole("button", { name: "Xoá" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Huỷ" }));
  });
});

describe("ConfirmDialog — đang xử lý", () => {
  it("nút chính 'Đang xử lý…' + aria-busy + aria-disabled; KHÔNG đóng và không gửi lần hai cho tới khi có kết quả", async () => {
    const pending = deferred();
    const onConfirm = vi.fn(() => pending.promise);
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        variant="confirm"
        title="Gỡ bài giải về nháp?"
        body="Bài sẽ không hiện với ai."
        confirmLabel="Gỡ về nháp"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Gỡ về nháp" }));
    const busyButton = screen.getByRole("button", { name: "Đang xử lý…" });
    expect(busyButton.getAttribute("aria-busy")).toBe("true");
    expect(busyButton.getAttribute("aria-disabled")).toBe("true");
    expect(busyButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(busyButton);
    fireEvent.keyDown(busyButton, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(screen.getByRole("button", { name: "Gỡ về nháp" }).getAttribute("aria-busy")).toBeNull();
  });

  it("onConfirm bị từ chối: không có unhandled rejection, hết 'đang xử lý', hộp thoại vẫn mở và không tự hiện gì", async () => {
    // Node phát `unhandledRejection` sau khi hàng microtask cạn — đợi một
    // macrotask rồi mới đọc.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <ConfirmDialog
          open
          variant="confirm"
          title="Gỡ bài giải về nháp?"
          body="Bài sẽ không hiện với ai."
          confirmLabel="Gỡ về nháp"
          onConfirm={() => Promise.reject(new Error("mất mạng"))}
          onCancel={() => {}}
        />
      );

      const textBefore = screen.getByRole("dialog", { name: "Gỡ bài giải về nháp?" }).textContent;
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Gỡ về nháp" }));
      });
      await new Promise((done) => setTimeout(done, 0));

      expect(unhandled).not.toHaveBeenCalled();
      const action = screen.getByRole("button", { name: "Gỡ về nháp" });
      expect(action.getAttribute("aria-busy")).toBeNull();
      expect(action.getAttribute("aria-disabled")).toBeNull();
      const dialog = screen.getByRole("dialog", { name: "Gỡ bài giải về nháp?" });
      // Thông báo lỗi là việc của cha qua `error` — hộp thoại không tự bịa một dòng.
      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(dialog.textContent).toBe(textBefore);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      process.off("unhandledRejection", unhandled);
      consoleError.mockRestore();
    }
  });
});

describe("ConfirmDialog variant='dirty-close' — ba lựa chọn", () => {
  function renderDirty() {
    const onConfirm = vi.fn(async () => {});
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        variant="dirty-close"
        title={t("solutions.dirty.title")}
        body={t("solutions.dirty.body")}
        onConfirm={onConfirm}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    return { dialog, onConfirm, onDiscard, onCancel };
  }

  it("đúng ba nút theo thứ tự [Ở lại] [Bỏ] [Lưu]; tiêu điểm mặc định vào 'Lưu'", () => {
    const { dialog } = renderDirty();
    expect(buttonNames(dialog)).toEqual(["Ở lại", "Bỏ", "Lưu"]);
    expect(within(dialog).getByText("Lưu lại trước khi đóng?")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lưu" }));
  });

  it("Escape = 'Ở lại': chỉ gọi onCancel", () => {
    const { onCancel, onDiscard, onConfirm } = renderDirty();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("'Bỏ' gọi onDiscard; 'Lưu' gọi onConfirm", () => {
    const { onDiscard, onConfirm } = renderDirty();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("AC-104 — OverlaySheet + ConfirmDialog dirty-close render cùng nhau", () => {
  /** Cha mẫu của NoteSheet/CommentSheet: so nội dung hiện tại với lúc mở. */
  function DirtyNoteHarness({
    onSave,
    onRequestCloseCall,
    onNoteFocus,
    initiallyOpen = true,
  }: {
    onSave: () => Promise<void>;
    /** Đếm số lần tấm trượt xin đóng — lớp phía sau không được nghe Escape. */
    onRequestCloseCall?: () => void;
    /** Đếm số lần ô ghi chú nhận tiêu điểm — bẫy Tab phía sau không được giành. */
    onNoteFocus?: () => void;
    /** false ⇒ tấm trượt mở từ nút "Viết ghi chú" — để kiểm tiêu điểm trả về đâu. */
    initiallyOpen?: boolean;
  }) {
    const [open, setOpen] = useState(initiallyOpen);
    const [asking, setAsking] = useState(false);
    const [text, setText] = useState("");
    const closeBoth = () => {
      setAsking(false);
      setOpen(false);
    };
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Viết ghi chú
        </button>
        <OverlaySheet
          open={open}
          titleId="note-title"
          onRequestClose={() => {
            onRequestCloseCall?.();
            if (text === "") {
              setOpen(false);
              return "closed";
            }
            setAsking(true);
            return "kept";
          }}
        >
          <h2 id="note-title">Câu 1</h2>
          <textarea
            aria-label="Ghi chú"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={onNoteFocus}
          />
        </OverlaySheet>
        <ConfirmDialog
          open={asking}
          variant="dirty-close"
          title={t("solutions.dirty.title")}
          body={t("solutions.dirty.body")}
          onConfirm={async () => {
            await onSave();
            closeBoth();
          }}
          onDiscard={closeBoth}
          onCancel={() => setAsking(false)}
        />
      </>
    );
  }

  function typeNote(): HTMLTextAreaElement {
    const field = screen.getByRole("textbox", { name: "Ghi chú" }) as HTMLTextAreaElement;
    field.focus();
    fireEvent.change(field, { target: { value: "Vì delta âm nên phương trình vô nghiệm." } });
    return field;
  }

  function expectThreeChoicesWithSheetStillOpen(field: HTMLTextAreaElement) {
    const confirm = screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    expect(buttonNames(confirm)).toEqual(["Ở lại", "Bỏ", "Lưu"]);
    expect(screen.getByRole("dialog", { name: "Câu 1" }).isConnected).toBe(true);
    expect(field.isConnected).toBe(true);
    expect(field.value).toBe("Vì delta âm nên phương trình vô nghiệm.");
  }

  it("chữ khác lúc mở + Escape ⇒ đúng ba lựa chọn, tấm trượt vẫn mở nguyên chữ", () => {
    render(<DirtyNoteHarness onSave={async () => {}} />);
    const field = typeNote();
    fireEvent.keyDown(field, { key: "Escape" });
    expectThreeChoicesWithSheetStillOpen(field);
  });

  it("chữ khác lúc mở + chạm scrim ⇒ đúng ba lựa chọn, tấm trượt vẫn mở nguyên chữ", () => {
    render(<DirtyNoteHarness onSave={async () => {}} />);
    const field = typeNote();
    const sheet = screen.getByRole("dialog", { name: "Câu 1" });
    fireEvent.click(sheet.previousElementSibling as HTMLElement);
    expectThreeChoicesWithSheetStillOpen(field);
  });

  it("nội dung KHÔNG đổi + Escape ⇒ đóng ngay, không hỏi", () => {
    render(<DirtyNoteHarness onSave={async () => {}} />);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Câu 1" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape trong hộp thoại = 'Ở lại': chỉ hộp thoại đóng, tấm trượt KHÔNG bị hỏi đóng lần nữa", () => {
    const onRequestCloseCall = vi.fn();
    render(<DirtyNoteHarness onSave={async () => {}} onRequestCloseCall={onRequestCloseCall} />);
    const field = typeNote();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onRequestCloseCall).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });

    fireEvent.keyDown(within(confirm).getByRole("button", { name: "Lưu" }), { key: "Escape" });

    expect(onRequestCloseCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Bạn có thay đổi chưa lưu" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Câu 1" }).isConnected).toBe(true);
    expect(field.value).toBe("Vì delta âm nên phương trình vô nghiệm.");
    // UI Spec C-32, hàng AC-104 "Ở lại / Escape": tiêu điểm về ô nhập của tấm trượt.
    expect(document.activeElement).toBe(field);
  });

  it("Tab trong hộp thoại vòng trong hộp thoại — bẫy của tấm trượt phía sau không giành tiêu điểm", () => {
    const onNoteFocus = vi.fn();
    render(<DirtyNoteHarness onSave={async () => {}} onNoteFocus={onNoteFocus} />);
    fireEvent.keyDown(typeNote(), { key: "Escape" });
    const confirm = screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    const save = within(confirm).getByRole("button", { name: "Lưu" });
    save.focus();
    onNoteFocus.mockClear();

    fireEvent.keyDown(save, { key: "Tab" });
    fireEvent.keyDown(within(confirm).getByRole("button", { name: "Ở lại" }), {
      key: "Tab",
      shiftKey: true,
    });

    expect(onNoteFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(save);

    // Tab giữa hai nút của hộp thoại là việc của trình duyệt: tấm trượt phía sau
    // không được chặn (preventDefault) phím đó.
    const stay = within(confirm).getByRole("button", { name: "Ở lại" });
    stay.focus();
    expect(fireEvent.keyDown(stay, { key: "Tab" })).toBe(true);
  });

  it("tấm trượt phía sau mang inert trong lúc hỏi; 'Ở lại' gỡ inert của nó, trang vẫn inert; đóng tấm trượt sau đó thì trang trở lại nguyên trạng", () => {
    const onRequestCloseCall = vi.fn();
    const { container } = render(
      <DirtyNoteHarness onSave={async () => {}} onRequestCloseCall={onRequestCloseCall} />
    );
    const field = typeNote();
    fireEvent.keyDown(field, { key: "Escape" });
    const sheetRoot = screen.getByRole("dialog", { name: "Câu 1" }).parentElement as HTMLElement;
    expect(sheetRoot.hasAttribute("inert")).toBe(true);
    expect(container.hasAttribute("inert")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ở lại" }));

    expect(sheetRoot.hasAttribute("inert")).toBe(false);
    expect(container.hasAttribute("inert")).toBe(true);
    // Hộp thoại đóng không được mở khoá cuộn khi tấm trượt vẫn còn mở.
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(field);

    // Lớp trên đóng ⇒ tấm trượt lại giam Tab: tiêu điểm lọt ra trang phía sau bị kéo về ô nhập.
    const behind = screen.getByRole("button", { name: "Viết ghi chú" });
    behind.focus();
    fireEvent.keyDown(behind, { key: "Tab" });
    expect(document.activeElement).toBe(field);

    // Hộp thoại (lớp trên) đóng TRƯỚC: tấm trượt phải lại là lớp trên cùng —
    // Escape lần nữa lại xin đóng và lại hỏi.
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onRequestCloseCall).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" })).toBeTruthy();

    // Ở lại, xoá hết chữ rồi Escape ⇒ tấm trượt đóng ngay (lớp dưới đóng SAU).
    fireEvent.click(screen.getByRole("button", { name: "Ở lại" }));
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("'Bỏ' ⇒ cả hai đóng, trang hết inert, body hết khoá cuộn", () => {
    const { container } = render(<DirtyNoteHarness onSave={async () => {}} />);
    fireEvent.keyDown(typeNote(), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("'Lưu' ⇒ đang xử lý tới khi lưu xong rồi đóng cả hai", async () => {
    const pending = deferred();
    const onSave = vi.fn(() => pending.promise);
    render(<DirtyNoteHarness onSave={onSave} />);
    fireEvent.keyDown(typeNote(), { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Đang xử lý…" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Câu 1" }).isConnected).toBe(true);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // UI-D10 / C-16: đóng tấm trượt thì tiêu điểm về phần tử đã mở nó. Khi có
  // chuyển động, hai lớp còn nằm trong DOM suốt pha đóng: hộp thoại không được
  // trả tiêu điểm về ô nhập của tấm trượt đang đóng (ô đó sắp bị gỡ và tiêu
  // điểm rơi về <body>) — phải về người mở của lớp NGOÀI CÙNG.
  it.each(["Bỏ", "Lưu"])(
    "có chuyển động: '%s' đóng cả hai ⇒ tiêu điểm về nút đã mở tấm trượt, không rơi về <body>",
    async (choice) => {
      stubMotionOn();
      vi.useFakeTimers();
      render(<DirtyNoteHarness initiallyOpen={false} onSave={async () => {}} />);
      const opener = screen.getByRole("button", { name: "Viết ghi chú" });
      opener.focus();
      fireEvent.click(opener);
      const sheet = screen.getByRole("dialog", { name: "Câu 1" });
      fireEvent.keyDown(typeNote(), { key: "Escape" });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: choice }));
      });
      // Pha đóng chạy thật — không có dòng này thì ca này xanh cả khi lỗi còn.
      expect(sheet.hasAttribute("data-closing")).toBe(true);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
    }
  );
});
