// @vitest-environment jsdom

// onHistoryWrite — nghe hai hàm ghi history để biết một lượt điều hướng đã hoàn
// tất kể cả khi URL không đổi (bug prod 2026-10-05, xem pageNavigation.ts).
// Nghĩa vụ chứng minh: bọc thì KHÔNG đổi hành vi của hàm gốc, và gỡ thì KHÔNG
// được làm mất hàm bọc của bên khác.

import { afterEach, describe, expect, it, vi } from "vitest";
import { onHistoryWrite } from "./pageNavigation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onHistoryWrite", () => {
  it("replaceState và pushState đều gọi listener, sau khi hàm gốc đã ghi", async () => {
    const seen: string[] = [];
    const off = onHistoryWrite(() => seen.push(window.location.pathname));

    window.history.pushState({}, "", "/a");
    window.history.replaceState({}, "", "/b");
    await Promise.resolve();

    // Listener thấy URL SAU khi ghi (chạy hoãn, sau hàm gốc).
    expect(seen).toEqual(["/b", "/b"]);
    off();
  });

  it("hàm gốc vẫn ghi đúng URL và trả đúng giá trị", () => {
    const off = onHistoryWrite(() => {});
    window.history.replaceState({ k: 1 }, "", "/giu-nguyen");
    expect(window.location.pathname).toBe("/giu-nguyen");
    expect(window.history.state).toEqual({ k: 1 });
    off();
  });

  it("listener hoãn sang microtask, KHÔNG chạy đồng bộ trong lúc ghi", async () => {
    const listener = vi.fn();
    const off = onHistoryWrite(listener);
    window.history.replaceState({}, "", "/x");
    expect(listener).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("gỡ xong thì trả hai hàm về nguyên bản và hết gọi listener", async () => {
    const push = window.history.pushState;
    const replace = window.history.replaceState;
    const listener = vi.fn();
    const off = onHistoryWrite(listener);
    off();

    expect(window.history.pushState).toBe(push);
    expect(window.history.replaceState).toBe(replace);
    window.history.replaceState({}, "", "/sau-khi-go");
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
  });

  it("bên khác đã bọc chồng lên thì gỡ KHÔNG đạp mất hàm bọc của họ", () => {
    const off = onHistoryWrite(() => {});
    const theirs = vi.fn(window.history.replaceState.bind(window.history));
    window.history.replaceState = theirs as typeof window.history.replaceState;

    off();
    expect(window.history.replaceState).toBe(theirs);

    // Dọn: trả về hàm gốc của jsdom cho các test sau.
    window.history.replaceState = History.prototype.replaceState;
  });
});
