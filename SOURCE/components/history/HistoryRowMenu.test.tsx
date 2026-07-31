// @vitest-environment jsdom

// HistoryRowMenu [integration] — front-adjust: the consolidated ⋯ menu that
// replaces HistoryRow's previous 3 separate controls (2x ActionButton +
// "View details" Link). Save/Share still route through usePdfAction
// (components/history/usePdfAction.ts) — the same hook ActionButton.tsx uses — so this
// file focuses on the NEW behavior this component adds on top of that
// already-proven state machine (ActionButton.test.tsx covers busy/error/
// fallback/AC-010 exhaustively): trigger/menu open-close, per-item rendering,
// auto-close-on-success, stays-open-on-error/fallback, and the View details
// link.
//
// Mock boundary + conventions identical to ActionButton.test.tsx: mocks
// generateAttemptPdfFile/downloadPdfFile/canShareFile + navigator.share, no
// jest-dom matchers, no auto-cleanup (render() results scoped via `within`).

import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryRowMenu } from "./HistoryRowMenu";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: vi.fn(),
  downloadPdfFile: vi.fn(),
  canShareFile: vi.fn(),
}));

import {
  canShareFile,
  downloadPdfFile,
  generateAttemptPdfFile,
} from "@/lib/pdf/generateAttemptPdf";

const mockGenerate = vi.mocked(generateAttemptPdfFile);
const mockDownload = vi.mocked(downloadPdfFile);
const mockCanShare = vi.mocked(canShareFile);

const PDF_INPUT: AttemptPdfData = {
  examTitle: "Đề Vật Lý 10",
  totalScore: 7,
  startedAt: "2026-07-01T00:00:00.000Z",
  submittedAt: "2026-07-01T00:10:00.000Z",
};

function mockFile(): File {
  return new File(["pdf-bytes"], "mock-exam.pdf", { type: "application/pdf" });
}

function renderMenu() {
  return render(
    <HistoryRowMenu
      pdfInput={PDF_INPUT}
      resultHref="/exams/exam-1/attempt/attempt-1/result"
      examTitle={PDF_INPUT.examTitle}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "share", {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  // @ts-expect-error — test-only cleanup of the stubbed Web Share API surface
  delete window.navigator.share;
});

describe("HistoryRowMenu", () => {
  it("(a) renders a single trigger with an exam-specific accessible name; menu is closed by default", () => {
    const { container } = render(
      <HistoryRowMenu
        pdfInput={PDF_INPUT}
        resultHref="/x"
        examTitle="Đề Vật Lý 10"
      />
    );
    const trigger = within(container).getByRole("button", {
      name: "More actions for Đề Vật Lý 10",
    });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(within(container).queryByRole("menu")).toBeNull();
  });

  it("(b) clicking the trigger opens a menu containing Save, Share, and View details", () => {
    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));

    const menu = within(container).getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Save/ })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: /Share/ })).toBeTruthy();
    const link = within(menu).getByRole("menuitem", { name: "View details" });
    expect(link.getAttribute("href")).toBe("/exams/exam-1/attempt/attempt-1/result");
  });

  it("(c) Save success calls generateAttemptPdfFile + downloadPdfFile and auto-closes the menu", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    fireEvent.click(within(container).getByRole("menuitem", { name: /Save/ }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(within(container).queryByRole("menu")).toBeNull());
  });

  it("(d) Share success (native) calls navigator.share and auto-closes the menu", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(true);
    vi.mocked(navigator.share).mockResolvedValue(undefined);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    fireEvent.click(within(container).getByRole("menuitem", { name: /Share/ }));

    await waitFor(() => expect(navigator.share).toHaveBeenCalledWith({ files: [file] }));
    await waitFor(() => expect(within(container).queryByRole("menu")).toBeNull());
  });

  it("(e) Share fallback (canShareFile false) downloads instead, shows a status line, and keeps the menu open", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(false);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    fireEvent.click(within(container).getByRole("menuitem", { name: /Share/ }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(file));
    const status = await within(container).findByRole("status");
    expect(status.textContent).toBe("Downloaded — sharing isn't supported in this browser.");
    expect(within(container).getByRole("menu")).not.toBeNull(); // stays open
  });

  it("(f) a generation failure shows an inline alert inside the menu and keeps it open for retry", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("network blip"));

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    fireEvent.click(within(container).getByRole("menuitem", { name: /Save/ }));

    const alert = await within(container).findByRole("alert");
    expect(alert.textContent).toBe("Couldn't generate the PDF. Try again.");
    expect(within(container).getByRole("menu")).not.toBeNull(); // stays open

    // Retry succeeds and then auto-closes.
    const file = mockFile();
    mockGenerate.mockResolvedValueOnce(file);
    fireEvent.click(within(container).getByRole("menuitem", { name: /Save/ }));
    await waitFor(() => expect(within(container).queryByRole("menu")).toBeNull());
  });

  it("(g) clicking the scrim (outside the menu) closes it without triggering an action", () => {
    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    expect(within(container).getByRole("menu")).not.toBeNull();

    const scrim = container.querySelector('button[aria-hidden="true"]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim!);

    expect(within(container).queryByRole("menu")).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("(h) AC-010: two rapid Save clicks while busy invoke generateAttemptPdfFile at most once", async () => {
    let resolveGenerate!: (file: File) => void;
    mockGenerate.mockImplementation(
      () =>
        new Promise<File>((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /More actions/ }));
    const saveItem = within(container).getByRole("menuitem", { name: /Save/ });
    fireEvent.click(saveItem);
    fireEvent.click(within(container).getByRole("menuitem", { name: /Saving/ }));

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    resolveGenerate(mockFile());
    await waitFor(() => expect(within(container).queryByRole("menu")).toBeNull());
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
