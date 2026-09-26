// @vitest-environment jsdom

// SolutionList (C-04) — UI Spec § Component: SolutionList; frontend DD §
// Main Components "SolutionList.tsx + SolutionCard.tsx"; UI-D24/AC-054
// (không tự sắp xếp lại phía client), AC-056 (khung rỗng), "editHref (v1.4)"
// (dựng một lần, giao đúng một hàng `isMine`).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SolutionList } from "@/features/solutions/components/SolutionList";
import type { OwnSolutionSummary } from "@/features/solutions/components/OwnSolutionBlock";
import type { SolutionListItem } from "@/features/solutions/queries";

const EXAM_ID = "E1";
const NOW = new Date("2026-09-20T10:05:00.000Z");

function summary(overrides: Partial<OwnSolutionSummary> = {}): OwnSolutionSummary {
  return {
    status: "published",
    attemptId: "A1",
    notedCount: 0,
    questionCount: 12,
    changedQuestionCount: 0,
    ...overrides,
  };
}

function item(overrides: Partial<SolutionListItem> = {}): SolutionListItem {
  return {
    id: "S1",
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    author: { kind: "named", displayName: "Người viết" },
    helpfulCount: 0,
    iMarkedHelpful: false,
    commentCount: 0,
    changedQuestionCount: 0,
    ...overrides,
  };
}

function cardHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/exams/E1/solutions/"]')).map(
    (a) => a.getAttribute("href") ?? ""
  );
}

afterEach(cleanup);

describe("SolutionList — thứ tự server, không tự sắp xếp (UI-D24, AC-054, Required Test #6)", () => {
  it("thẻ render đúng thứ tự mảng items nhận được, không sắp lại", () => {
    const { container } = render(
      <SolutionList
        examId={EXAM_ID}
        items={[item({ id: "S3" }), item({ id: "S1" }), item({ id: "S2" })]}
        own={summary()}
        now={NOW}
      />
    );

    expect(cardHrefs(container)).toEqual([
      "/exams/E1/solutions/S3",
      "/exams/E1/solutions/S1",
      "/exams/E1/solutions/S2",
    ]);
  });
});

describe("SolutionList — rỗng (AC-056, Required Test #7)", () => {
  it("items=[]: khung nét đứt 'Chưa có bài giải nào...' hiện, KHÔNG có ul thẻ nào", () => {
    const { container } = render(
      <SolutionList examId={EXAM_ID} items={[]} own={summary({ status: null })} now={NOW} />
    );

    expect(screen.getByText("Chưa có bài giải nào. Hãy là người đầu tiên.")).toBeTruthy();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("khung rỗng đứng SAU khối 'bài của tôi' trong DOM (ngay dưới khối đầu, AC-056)", () => {
    render(<SolutionList examId={EXAM_ID} items={[]} own={summary({ status: null })} now={NOW} />);

    const ownCta = screen.getByRole("button", { name: "Viết bài giải của bạn" });
    const emptyFrame = screen.getByText("Chưa có bài giải nào. Hãy là người đầu tiên.");
    // DOCUMENT_POSITION_FOLLOWING (4): ownCta đứng trước emptyFrame.
    expect(ownCta.compareDocumentPosition(emptyFrame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("SolutionList — editHref dựng một lần, giao đúng hàng isMine (frontend DD 'editHref (v1.4)')", () => {
  it("hàng isMine=true nhận editHref = /exams/{examId}/attempt/{own.attemptId}/solution; hàng khác không nhận", () => {
    render(
      <SolutionList
        examId={EXAM_ID}
        items={[item({ id: "S1", isMine: false }), item({ id: "S2", isMine: true })]}
        own={summary({ attemptId: "A9" })}
        now={NOW}
      />
    );

    expect(screen.getByRole("link", { name: "Sửa" }).getAttribute("href")).toBe(
      "/exams/E1/attempt/A9/solution"
    );
  });
});

describe("SolutionList — unreadCommentCount chỉ chuyển tiếp cho hàng isMine (task 29, AC-091/AC-092)", () => {
  it("hàng isMine=true nhận unreadCommentCount=2; hàng isMine=false không hiện 'bình luận mới' nào", () => {
    render(
      <SolutionList
        examId={EXAM_ID}
        items={[item({ id: "S1", isMine: false }), item({ id: "S2", isMine: true })]}
        own={summary()}
        now={NOW}
        unreadCommentCount={2}
      />
    );

    expect(screen.getByText("2 bình luận mới")).toBeTruthy();
    expect(screen.getAllByText(/bình luận mới/)).toHaveLength(1);
  });

  it("KHÔNG truyền unreadCommentCount: không thẻ nào hiện 'bình luận mới'", () => {
    render(
      <SolutionList
        examId={EXAM_ID}
        items={[item({ id: "S1", isMine: true })]}
        own={summary()}
        now={NOW}
      />
    );

    expect(screen.queryByText(/bình luận mới/)).toBeNull();
  });
});
