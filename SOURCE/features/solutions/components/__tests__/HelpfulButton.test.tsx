// @vitest-environment jsdom

// HelpfulButton (C-24) — frontend DD § Data Contracts "Helpful toggle
// contract"; § Required Tests rows 1-4. Mock boundary (task file): only
// `@/features/solutions/actions` is mocked; nothing else.

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToggleHelpfulResult } from "@/features/solutions/actions";

const { toggleHelpfulMock } = vi.hoisted(() => ({
  toggleHelpfulMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
}));

const { HelpfulButton } = await import("@/features/solutions/components/HelpfulButton");

afterEach(cleanup);
beforeEach(() => {
  toggleHelpfulMock.mockReset();
});

describe("HelpfulButton — Required Test 1 (tối đa một cuộc gọi đang chạy)", () => {
  it("bấm dồn 3 lần khi cuộc gọi đầu còn đang chờ: gọi toggleHelpful tối đa 2 lần, trạng thái cuối theo lần bấm thứ ba", async () => {
    let resolveFirst!: (value: ToggleHelpfulResult) => void;
    toggleHelpfulMock.mockImplementationOnce(
      () =>
        new Promise<ToggleHelpfulResult>((resolve) => {
          resolveFirst = resolve;
        })
    );
    toggleHelpfulMock.mockResolvedValueOnce({ ok: true, on: true });

    render(
      <HelpfulButton solutionId="S1" initialPressed={false} initialCount={5} onError={vi.fn()} />
    );
    const button = screen.getByRole("button");

    fireEvent.click(button); // bấm 1: desiredOn -> true, phát cuộc gọi #1
    fireEvent.click(button); // bấm 2: desiredOn -> false, đang có cuộc gọi -> không gọi
    fireEvent.click(button); // bấm 3: desiredOn -> true, đang có cuộc gọi -> không gọi

    expect(toggleHelpfulMock).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    // Cuộc gọi #1 resolve LỆCH với ý định mới nhất (on: false, trong khi
    // desiredOn đã là true sau 3 lần bấm) -> phải phát đúng một cuộc gọi sửa.
    await act(async () => {
      resolveFirst({ ok: true, on: false });
    });

    await waitFor(() => expect(toggleHelpfulMock).toHaveBeenCalledTimes(2));
    expect(toggleHelpfulMock.mock.calls.length).toBeLessThanOrEqual(2);
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
  });
});

describe("HelpfulButton — Required Test 2 (generic: về nguyên trạng thái)", () => {
  it("{ ok: false, error: { code: 'generic' } } -> aria-pressed và số đếm về giá trị ban đầu, onError nhận đúng chữ", async () => {
    toggleHelpfulMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });
    const onError = vi.fn();

    render(
      <HelpfulButton solutionId="S1" initialPressed={false} initialCount={3} onError={onError} />
    );
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé.")
    );
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toContain("3");
  });
});

describe("HelpfulButton — Required Test 3 (rateLimited)", () => {
  it("{ code: 'rateLimited', seconds: 42 } -> chữ lỗi chứa '42'; trạng thái bấm và số đếm về nguyên", async () => {
    toggleHelpfulMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "rateLimited", seconds: 42 },
    });
    const onError = vi.fn();

    render(
      <HelpfulButton solutionId="S1" initialPressed={true} initialCount={10} onError={onError} />
    );
    const button = screen.getByRole("button");

    fireEvent.click(button); // đang bấm -> bỏ bấm

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toContain("42");
    });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("10");
  });
});

describe("HelpfulButton — Required Test 4 (hợp đồng một tham số)", () => {
  it("mọi lời gọi toggleHelpful ghi lại đều có ĐÚNG một tham số — không có cờ trạng thái đích", async () => {
    toggleHelpfulMock.mockResolvedValue({ ok: true, on: true });

    render(
      <HelpfulButton solutionId="S9" initialPressed={false} initialCount={0} onError={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toggleHelpfulMock).toHaveBeenCalled());
    for (const call of toggleHelpfulMock.mock.calls) {
      expect(call).toEqual(["S9"]);
    }
  });
});

describe("HelpfulButton — chạy dưới React StrictMode (dev gắn → gỡ → gắn lại)", () => {
  it("phản hồi của máy chủ vẫn được áp: nút hết aria-busy và số đếm cập nhật, bấm tiếp vẫn gọi máy chủ", async () => {
    toggleHelpfulMock.mockResolvedValue({ ok: true, on: true });

    render(
      <StrictMode>
        <HelpfulButton solutionId="S1" initialPressed={false} initialCount={5} onError={vi.fn()} />
      </StrictMode>
    );
    const button = screen.getByRole("button");

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-busy")).not.toBe("true"));
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("6");

    toggleHelpfulMock.mockResolvedValueOnce({ ok: true, on: false });
    fireEvent.click(button);
    await waitFor(() => expect(toggleHelpfulMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));
  });
});
