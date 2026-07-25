// @vitest-environment jsdom

// DifficultyBadge — Reference Contracts (rating-system-frontend-task-5.md):
//  - non-null communityDifficulty -> `${bucket} · ${formatMean(mean)}` verbatim.
//  - null/missing communityDifficulty -> literal "—", never throws (AC-015).
//  - AC-018: renders the server-provided bucket verbatim, never re-buckets.
// Mỗi test tự scope query vào container riêng (render() không auto-cleanup
// giữa các test trong file này — theo đúng convention QuestionFigure.test.tsx).

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DifficultyBadge } from "./DifficultyBadge";

describe("DifficultyBadge", () => {
  it("renders `Hard · 7.2` for a Hard-bucket, ≥3-rating exam (card variant)", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 7.2, count: 5 }}
        variant="card"
      />
    );
    expect(container.querySelector("dd")?.textContent).toBe("Hard · 7.2");
  });

  it("formats a whole-number mean with exactly one decimal (`Medium · 4.0`)", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Medium", mean: 4, count: 3 }}
        variant="card"
      />
    );
    expect(container.querySelector("dd")?.textContent).toBe("Medium · 4.0");
  });

  it("renders the maximum mean as `Hard · 10.0` (detail variant)", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 10, count: 12 }}
        variant="detail"
      />
    );
    expect(container.querySelector("dd")?.textContent).toBe("Hard · 10.0");
  });

  it('renders literal "—" when communityDifficulty is null (fail-safe, AC-015)', () => {
    const { container } = render(
      <DifficultyBadge communityDifficulty={null} variant="card" />
    );
    expect(container.querySelector("dd")?.textContent).toBe("—");
  });

  it('renders literal "—" when communityDifficulty is missing (undefined), without throwing', () => {
    let container!: HTMLElement;
    expect(() => {
      container = render(
        <DifficultyBadge communityDifficulty={undefined} variant="detail" />
      ).container;
    }).not.toThrow();
    expect(container.querySelector("dd")?.textContent).toBe("—");
  });

  it("renders the server-provided bucket verbatim — never re-buckets from mean (AC-018)", () => {
    // Contrived inconsistent input (mean=2 would bucket() as "Easy" if
    // recomputed client-side): the component must still render the given
    // bucket "Hard" verbatim, proving it never recomputes bucket(mean).
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 2, count: 3 }}
        variant="card"
      />
    );
    expect(container.querySelector("dd")?.textContent).toBe("Hard · 2.0");
  });

  it('detail variant applies text-foreground when present, text-muted-foreground when "—"', () => {
    const present = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Easy", mean: 2.3, count: 5 }}
        variant="detail"
      />
    );
    expect(present.container.querySelector("dd")?.className).toContain("text-foreground");

    const absent = render(<DifficultyBadge communityDifficulty={null} variant="detail" />);
    expect(absent.container.querySelector("dd")?.className).toContain("text-muted-foreground");
  });
});
