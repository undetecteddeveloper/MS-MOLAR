// @vitest-environment jsdom

// SupportWidgetDialog — máy trạng thái compose -> submitting -> (compose,
// lỗi) | success, KHÔNG BAO GIỜ compose -> success thẳng (AC-040); lỗi giữ
// nguyên intent/message/screenshot (AC-020, AC-039); no-op guard chặn double-
// submit; timeout 20s race.
// No I18nProvider wrapping → useT() renders the "en" default strings.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportWidgetDialog } from "@/components/support/SupportWidgetDialog";
import { submitSupportTicket } from "@/lib/support/actions";

vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
const submitMock = vi.mocked(submitSupportTicket);

beforeEach(() => {
  submitMock.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function fillValidCompose() {
  screen.getByRole("radio", { name: "Bug report" }).click();
  const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: "The submit button does not respond" } });
}

function clickSubmit() {
  act(() => {
    screen.getByRole("button", { name: /^Send$|Sending/ }).click();
  });
}

describe("SupportWidgetDialog", () => {
  it("open=false renders nothing", () => {
    const { container } = render(<SupportWidgetDialog open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("open=true renders the Compose view (dialog role, intent/message/screenshot fields)", () => {
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByLabelText("Message")).toBeDefined();
  });

  it("submitting with no intent selected shows validation error, never calls submitSupportTicket", () => {
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    const textarea = screen.getByLabelText("Message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "message only, no intent chosen" } });
    clickSubmit();
    expect(screen.getByText("Please pick a feedback type.")).toBeDefined();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("never reaches Success except immediately after submitSupportTicket resolves { ok: true } (AC-040, non-optimistic)", async () => {
    let resolveSubmit!: (v: Awaited<ReturnType<typeof submitSupportTicket>>) => void;
    submitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    await act(async () => {
      await fillValidCompose();
    });
    act(() => {
      clickSubmit();
    });

    // Immediately after click, still NOT success — promise hasn't resolved yet.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("dialog")).toBeDefined();

    await act(async () => {
      resolveSubmit({ ok: true, shortRef: "ab12cd34" });
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText("Reference: ab12cd34")).toBeDefined();
  });

  it("a rate-limited refusal preserves intent/message exactly as typed (AC-020)", async () => {
    submitMock.mockResolvedValue({ error: "rate_limited" });
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    await act(async () => {
      await fillValidCompose();
    });
    await act(async () => {
      clickSubmit();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("You're sending a bit fast — try again in a few minutes.")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Bug report" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
      "The submit button does not respond"
    );
  });

  it("a repeat click while submitting fires submitSupportTicket exactly once (no-op guard)", async () => {
    let resolveSubmit!: (v: Awaited<ReturnType<typeof submitSupportTicket>>) => void;
    submitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    await act(async () => {
      await fillValidCompose();
    });
    act(() => {
      clickSubmit();
      clickSubmit();
      clickSubmit();
    });

    expect(submitMock).toHaveBeenCalledTimes(1);
    const submitButton = screen.getByRole("button", { name: /Sending/ });
    expect(submitButton.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      resolveSubmit({ ok: true, shortRef: "ab12cd34" });
      await Promise.resolve();
    });
  });

  it("a submission that never resolves surfaces the retryable timeout error after 20s, fields preserved (AC-039)", async () => {
    vi.useFakeTimers();
    submitMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SupportWidgetDialog open={true} onClose={() => {}} />);
    await act(async () => {
      await fillValidCompose();
    });
    act(() => {
      clickSubmit();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(screen.getByText("Couldn't send — might be a network issue. Please try again.")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Bug report" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe(
      "The submit button does not respond"
    );
  });
});
