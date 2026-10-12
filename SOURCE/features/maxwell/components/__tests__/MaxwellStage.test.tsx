// @vitest-environment jsdom

// MaxwellStage — ba trạng thái (đang tải / sẵn sàng / không hỗ trợ) và dọn dẹp.
// Cảnh thật được mock: WebGL không có trong jsdom.

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Options = { onContextLost?: () => void };

const dispose = vi.fn();
let readyPromise: Promise<void>;
let capturedOptions: Options | undefined;
let createImpl: (host: HTMLElement, options?: Options) => { ready: Promise<void>; dispose: () => void };

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
  capturedOptions = undefined;
  readyPromise = Promise.resolve();
  createImpl = () => ({ ready: readyPromise, dispose });
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
