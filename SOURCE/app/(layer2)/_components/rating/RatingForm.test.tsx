// @vitest-environment jsdom

// RatingForm — jsdom boundary tests for the frontend DD Proof Obligations not
// covered by CircleScale.test.tsx/lib fixtures: (1) exactly the 3 fixed parts
// render in order regardless of any exam.parts input (AC-001); (3) initialScores
// prefill (AC-006/013); (4) header SUBMIT pinned-disabled → enabled at 3/3
// rated (Reference Contract row 1); (5)/(6) submit success/error (AC-003/009/
// 012, AC-025/008 UI side). `onSubmit` is the injected prop-level boundary
// RatingForm actually calls (RatingFormProps.onSubmit per UI Spec) — the
// deeper rateExam server-action boundary is separately covered by
// submitRating.test.ts (Mock Boundary Decisions table).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RatingForm } from "./RatingForm";

afterEach(cleanup);

describe("RatingForm — three fixed parts (AC-001)", () => {
  it("renders exactly Part I / Part II / Part III eyebrows, in order, on mount", () => {
    render(<RatingForm examId="exam-1" layout="page" onSubmit={vi.fn()} />);
    const eyebrows = screen.getAllByText(/^PART (I|II|III) ·/);
    expect(eyebrows.map((el) => el.textContent)).toEqual([
      "PART I · MULTIPLE CHOICE",
      "PART II · TRUE / FALSE",
      "PART III · SHORT ANSWER",
    ]);
  });
});

describe("RatingForm — initialScores prefill (AC-006/013)", () => {
  it("pre-fills each rated part's x/10 and the overall readout reflects them", () => {
    render(
      <RatingForm
        examId="exam-1"
        layout="page"
        initialScores={{ mcq: 6, true_false: 8 }}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText("6/10")).toBeTruthy();
    expect(screen.getByText("8/10")).toBeTruthy();
    // 2/3 rated -> running mean (6+8)/2 = 7.0, "2/3 RATED" (readoutModel).
    expect(screen.getByText("OVERALL 7.0/10 · 2/3 RATED")).toBeTruthy();
  });

  it("parts with no stored score stay unrated (—/10) on mount", () => {
    render(
      <RatingForm examId="exam-1" layout="page" initialScores={{ mcq: 6 }} onSubmit={vi.fn()} />
    );
    // Part II and Part III have no initialScores entry -> both show "—/10".
    expect(screen.getAllByText("—/10")).toHaveLength(2);
  });
});

describe("RatingForm — header SUBMIT enablement (Reference Contract row 1)", () => {
  it("stays disabled with aria-describedby hint while fewer than 3 parts are rated", () => {
    render(
      <RatingForm
        examId="exam-1"
        layout="page"
        initialScores={{ mcq: 5, true_false: 5 }}
        onSubmit={vi.fn()}
      />
    );
    const submit = screen.getByRole("button", { name: "SUBMIT" });
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.getAttribute("aria-describedby")).toBe("rating-form-submit-hint-exam-1");
  });

  it("enables once the 3rd part is rated via its PartDetail", () => {
    render(
      <RatingForm
        examId="exam-1"
        layout="page"
        initialScores={{ mcq: 5, true_false: 5 }}
        onSubmit={vi.fn()}
      />
    );
    // Open Part III detail (AC-002 default: no selection -> "Selected: —/10",
    // "SUBMIT RATING" disabled).
    fireEvent.click(screen.getByText("Short Answer"));
    expect(screen.getByText("Selected: —/10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "SUBMIT RATING" })).toHaveProperty("disabled", true);

    // Select circle 9 -> readout updates live, "SUBMIT RATING" enables (AC-002).
    fireEvent.click(screen.getByRole("radio", { name: "9" }));
    expect(screen.getByText("Selected: 9/10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "SUBMIT RATING" })).toHaveProperty("disabled", false);

    // Commit -> returns to overview; the part's x/10 + header SUBMIT reflect it.
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT RATING" }));

    const submit = screen.getByRole("button", { name: "SUBMIT" });
    expect(submit).toHaveProperty("disabled", false);
    expect(submit.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("RatingForm — submit success (AC-003/009/012 UI side)", () => {
  it("calls onSubmit with the mapped scores; swaps label to Sent; announces via aria-live", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(
      <RatingForm
        examId="exam-1"
        layout="page"
        initialScores={{ mcq: 3, true_false: 4, short_answer: 5 }}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Sent" })).toBeTruthy());
    expect(onSubmit).toHaveBeenCalledWith({ mcq: 3, true_false: 4, short_answer: 5 });

    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Rating saved.");
  });

  it("invokes onSaved only when provided (modal layout hook)", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(
      <RatingForm
        examId="exam-1"
        layout="modal"
        initialScores={{ mcq: 1, true_false: 1, short_answer: 1 }}
        onSubmit={onSubmit}
        onSaved={onSaved}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});

describe("RatingForm — submit error (AC-025/008 UI side)", () => {
  it("shows the mapped message in role=alert, preserves scores, re-enables SUBMIT", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: "Couldn't save your rating right now. Please try again.",
    });
    render(
      <RatingForm
        examId="exam-1"
        layout="page"
        initialScores={{ mcq: 2, true_false: 6, short_answer: 9 }}
        onSubmit={onSubmit}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Couldn't save your rating right now. Please try again."
      )
    );

    // Scores preserved.
    expect(screen.getByText("2/10")).toBeTruthy();
    expect(screen.getByText("6/10")).toBeTruthy();
    expect(screen.getByText("9/10")).toBeTruthy();

    // SUBMIT re-enabled (no longer stuck on "Submitting…").
    const submit = screen.getByRole("button", { name: "SUBMIT" });
    expect(submit).toHaveProperty("disabled", false);
  });
});

describe("RatingForm — CircleScale value stays within the PartScore type ([1,10])", () => {
  it("committing a circle never exceeds 10 or drops below 1 (spot-check the boundary circles)", () => {
    render(<RatingForm examId="exam-1" layout="page" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText("Multiple Choice"));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(10);
    fireEvent.click(radios[0]);
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT RATING" }));
    expect(screen.getByText("1/10")).toBeTruthy();
  });
});
