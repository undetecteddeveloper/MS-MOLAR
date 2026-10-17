// @vitest-environment jsdom

// MaxwellStage — ba trạng thái (đang tải / sẵn sàng / không hỗ trợ) và dọn dẹp.
// Cảnh thật được mock: WebGL không có trong jsdom.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Options = { onContextLost?: () => void };
type FakeScene = {
  ready: Promise<void>;
  dispose: () => void;
  kickAt: (x: number, y: number) => boolean;
  kick: () => boolean;
  isOverModel: (x: number, y: number) => boolean;
};

const dispose = vi.fn();
const kickAt = vi.fn<(x: number, y: number) => boolean>();
const kick = vi.fn<() => boolean>();
const isOverModel = vi.fn<(x: number, y: number) => boolean>();
const setBottomInset = vi.fn<(pixels: number) => void>();
let readyPromise: Promise<void>;
let capturedOptions: Options | undefined;
let createImpl: (host: HTMLElement, options?: Options) => FakeScene;

vi.mock("@/features/maxwell/scene/createMaxwellScene", () => ({
  createMaxwellScene: (host: HTMLElement, options?: Options) => {
    capturedOptions = options;
    return createImpl(host, options);
  },
}));

import { MaxwellStage } from "../MaxwellStage";

function sceneStatus(): string | null {
  return screen.getByTestId("maxwell-scene").getAttribute("data-status");
}

beforeEach(() => {
  dispose.mockReset();
  kickAt.mockReset().mockReturnValue(true);
  kick.mockReset().mockReturnValue(true);
  isOverModel.mockReset().mockReturnValue(false);
  setBottomInset.mockReset();
  capturedOptions = undefined;
  readyPromise = Promise.resolve();
  createImpl = () => ({
    ready: readyPromise,
    dispose,
    kickAt,
    kick,
    isOverModel,
    setBottomInset,
  });
});

afterEach(() => {
  cleanup();
});

describe("MaxwellStage", () => {
  it("khung cảnh có vai ảnh kèm mô tả; lúc đầu báo đang tải", () => {
    let resolve!: () => void;
    readyPromise = new Promise<void>((r) => {
      resolve = r;
    });
    render(<MaxwellStage className="flex-1" />);

    const host = screen.getByRole("img", {
      name: "Mô hình 3D chú mèo Maxwell đang xoay và nhấp nhô dưới ánh đèn",
    });
    expect(host).toBeTruthy();
    expect(sceneStatus()).toBe("loading");
    expect(screen.getByTestId("maxwell-status").textContent).toBe("Đang gọi Maxwell…");
    resolve();
  });

  it("cảnh tải xong → sẵn sàng, câu báo biến mất", async () => {
    render(<MaxwellStage />);

    await waitFor(() => expect(sceneStatus()).toBe("ready"));
    expect(screen.queryByTestId("maxwell-status")).toBeNull();
  });

  it("không tạo được WebGL (ném lỗi) → câu báo, không trang trắng", async () => {
    createImpl = () => {
      throw new Error("WebGL không khả dụng");
    };
    render(<MaxwellStage />);

    await waitFor(() => expect(sceneStatus()).toBe("unsupported"));
    expect(screen.getByTestId("maxwell-status").textContent).toContain(
      "chưa hiển thị được mô hình 3D"
    );
  });

  it("tải mô hình hỏng (ready bị reject) → câu báo", async () => {
    readyPromise = Promise.reject(new Error("404"));
    readyPromise.catch(() => {}); // tránh cảnh báo unhandled trước khi component gắn catch
    render(<MaxwellStage />);

    await waitFor(() => expect(sceneStatus()).toBe("unsupported"));
  });

  it("trình duyệt thu hồi ngữ cảnh WebGL giữa chừng → chuyển sang câu báo", async () => {
    render(<MaxwellStage />);
    await waitFor(() => expect(sceneStatus()).toBe("ready"));

    act(() => capturedOptions?.onContextLost?.());

    expect(sceneStatus()).toBe("unsupported");
  });

  it("gỡ component → dispose cảnh đúng một lần (không rò GPU)", async () => {
    const { unmount } = render(<MaxwellStage />);
    await waitFor(() => expect(sceneStatus()).toBe("ready"));

    unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe("MaxwellStage — cú đá", () => {
  const KICK_NAME = "Đá Maxwell một cú";

  async function renderReady() {
    render(<MaxwellStage />);
    await waitFor(() => expect(sceneStatus()).toBe("ready"));
  }

  it("chưa tải xong thì chưa có nút đá", () => {
    readyPromise = new Promise<void>(() => {});
    render(<MaxwellStage />);

    expect(screen.queryByRole("button", { name: KICK_NAME })).toBeNull();
  });

  it("không có WebGL thì không có nút đá", async () => {
    createImpl = () => {
      throw new Error("WebGL không khả dụng");
    };
    render(<MaxwellStage />);

    await waitFor(() => expect(sceneStatus()).toBe("unsupported"));
    expect(screen.queryByRole("button", { name: KICK_NAME })).toBeNull();
  });

  it("nhấn chuột: chuyển toạ độ cho cảnh; trúng thì hết đá được và nhãn đổi", async () => {
    await renderReady();
    expect(screen.getByTestId("maxwell-scene").getAttribute("data-kicked")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: KICK_NAME }), {
      detail: 1,
      clientX: 120,
      clientY: 80,
    });

    expect(kickAt).toHaveBeenCalledExactlyOnceWith(120, 80);
    expect(kick).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: KICK_NAME })).toBeNull();
    const host = screen.getByTestId("maxwell-scene");
    expect(host.getAttribute("data-kicked")).toBe("true");
    expect(host.getAttribute("aria-label")).toBe(
      "Maxwell vừa bị đá văng khỏi bục và đang nằm dưới sàn"
    );
  });

  it("nhấn trượt mô hình: không có gì xảy ra, nút còn để thử lại", async () => {
    kickAt.mockReturnValue(false);
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: KICK_NAME }), { detail: 1, clientX: 5, clientY: 5 });

    expect(screen.getByRole("button", { name: KICK_NAME })).toBeTruthy();
    expect(screen.getByTestId("maxwell-scene").getAttribute("data-kicked")).toBe("false");
  });

  it("bàn phím (Enter/Space sinh click detail=0): đá thẳng, không cần toạ độ", async () => {
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: KICK_NAME }), { detail: 0 });

    expect(kick).toHaveBeenCalledTimes(1);
    expect(kickAt).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: KICK_NAME })).toBeNull();
  });

  it("đổi con trỏ thành bàn tay khi rê trên mô hình", async () => {
    isOverModel.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await renderReady();
    const button = screen.getByRole("button", { name: KICK_NAME });

    fireEvent.pointerMove(button, { clientX: 100, clientY: 100 });
    expect(button.style.cursor).toBe("pointer");

    fireEvent.pointerMove(button, { clientX: 1, clientY: 1 });
    expect(button.style.cursor).toBe("default");
  });
});

describe("MaxwellStage — lớp chữ đè lên sàn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("children nằm trong lớp chữ cho cú nhấn xuyên qua (pointer-events-none), đáy khung", () => {
    render(
      <MaxwellStage>
        <h1>Tiêu đề</h1>
      </MaxwellStage>
    );

    const overlay = screen.getByRole("heading", { name: "Tiêu đề" }).parentElement;
    expect(overlay?.className).toContain("pointer-events-none");
    expect(overlay?.className).toContain("mt-auto");
  });

  it("không có children thì không dựng lớp chữ", () => {
    const { container } = render(<MaxwellStage />);

    expect(container.querySelector(".pointer-events-none")).toBeNull();
  });

  it("đo chiều cao lớp chữ và báo cho cảnh để chừa chỗ ở đáy", async () => {
    let notify: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    let height = 140;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => height);

    render(
      <MaxwellStage>
        <h1>Tiêu đề</h1>
      </MaxwellStage>
    );
    await waitFor(() => expect(sceneStatus()).toBe("ready"));
    // Cảnh vừa tạo đã nhận chiều cao đo được từ trước.
    expect(setBottomInset).toHaveBeenCalledWith(140);

    // Chữ đổi cỡ (xoay màn hình, tiêu đề xuống dòng) → báo lại.
    height = 96;
    act(() => notify());
    expect(setBottomInset).toHaveBeenLastCalledWith(96);
  });
});
