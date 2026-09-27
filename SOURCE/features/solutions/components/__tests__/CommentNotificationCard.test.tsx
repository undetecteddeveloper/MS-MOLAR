// @vitest-environment jsdom

// CommentNotificationCard (C-36) — UI Spec § Component: CommentNotificationCard;
// frontend DD § Data Contracts "Comment feed contract". Required Tests (task 45
// task file § Required Tests): #1 (S8 row), #2 (counted row), #4 ("Trả lời"
// href + roundtrip qua hàm parse của task 21), #5 (dòng ẩn danh), #6 (chỉ tên,
// không avatar).
//
// Mock boundary: `CommentNotificationCard` tự nó không mock gì — `identity.ts`
// (không dùng trực tiếp ở đây, `item.author` đã là `AuthorIdentity` sẵn) và
// `RichText` giữ thật, đúng chỉ dẫn của task file. Required Test #4 cần import
// `parseSolutionDeepLink` (export thuần của route `[solutionId]/page.tsx`,
// task 21) để chứng minh roundtrip — file route đó nhập `@/features/solutions/queries`
// và `@/features/exams/queries` ở top-level, cả hai mang `import "server-only"`
// (throw ngay khi require ngoài bối cảnh Server Component/Action); mock hai
// module đó theo đúng khuôn `SolutionViewPage.test.tsx` (task 21) để việc
// import không vỡ — các mock KHÔNG được dùng cho hành vi thật nào trong file
// này, chỉ để module top-level resolve an toàn.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentNotificationCard } from "@/features/solutions/components/CommentNotificationCard";
import type { CommentFeedItem } from "@/features/solutions/queries";

vi.mock("@/features/solutions/queries", () => ({
  getSolutionDetail: vi.fn(),
  getMySolutionForWriter: vi.fn(),
}));
vi.mock("@/features/exams/queries", () => ({ getExam: vi.fn(), isExamAuthor: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: vi.fn(),
  setPin: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
}));

const { parseSolutionDeepLink } = await import(
  "@/app/(exams)/exams/[id]/solutions/[solutionId]/page"
);

const NOW = new Date("2026-09-27T10:00:00.000Z");

function item(overrides: Partial<CommentFeedItem> = {}): CommentFeedItem {
  return {
    commentId: "c1",
    solutionId: "sol1",
    examId: "E1",
    examTitle: "Đề Toán 12 — Học kỳ 1",
    questionNumber: 3,
    commentBody: "Bài này giải thế nào vậy?",
    commentCreatedAt: "2026-09-27T09:00:00.000Z",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isUnread: true,
    examVisible: true,
    ...overrides,
  };
}

afterEach(cleanup);

describe("CommentNotificationCard — S8: đề không còn hiện (Required Test #1, AC-098, AC-091)", () => {
  it("examVisible:false → 'Đề không còn hiện', KHÔNG 'Trả lời', KHÔNG chấm chưa đọc", () => {
    const { container } = render(
      <ul>
        <CommentNotificationCard item={item({ examVisible: false, isUnread: true })} now={NOW} />
      </ul>
    );

    expect(screen.getByText("Đề không còn hiện")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Trả lời/ })).toBeNull();
    expect(container.querySelector("span[aria-hidden].bg-destructive.size-2.rounded-full")).toBeNull();
  });
});

describe("CommentNotificationCard — hàng được tính là mới (Required Test #2, AC-091/AC-092)", () => {
  it("isUnread:true, examVisible:true → có chấm chưa đọc", () => {
    const { container } = render(
      <ul>
        <CommentNotificationCard item={item({ isUnread: true, examVisible: true })} now={NOW} />
      </ul>
    );

    expect(container.querySelector("span[aria-hidden].bg-destructive.size-2.rounded-full")).toBeTruthy();
  });

  it("isUnread:false → KHÔNG chấm dù examVisible:true", () => {
    const { container } = render(
      <ul>
        <CommentNotificationCard item={item({ isUnread: false, examVisible: true })} now={NOW} />
      </ul>
    );

    expect(container.querySelector("span[aria-hidden].bg-destructive.size-2.rounded-full")).toBeNull();
  });
});

describe("CommentNotificationCard — href 'Trả lời' + roundtrip qua parser của task 21 (Required Test #4, AC-098)", () => {
  it("href đúng /exams/{examId}/solutions/{solutionId}?q={questionNumber}&comments=1, roundtrip ra {q:k, commentsOpen:true}", () => {
    render(
      <ul>
        <CommentNotificationCard
          item={item({ examId: "E9", solutionId: "sol9", questionNumber: 5 })}
          now={NOW}
        />
      </ul>
    );

    const link = screen.getByRole("link", { name: /Trả lời/ });
    const href = link.getAttribute("href");
    expect(href).toBe("/exams/E9/solutions/sol9?q=5&comments=1");

    const url = new URL(href!, "http://localhost");
    const parsed = parseSolutionDeepLink(
      url.searchParams.get("q") ?? undefined,
      url.searchParams.get("comments") ?? undefined,
      10
    );
    expect(parsed).toEqual({ q: 5, commentsOpen: true });
  });
});

describe("CommentNotificationCard — dòng ẩn danh (Required Test #5, AC-097, AC-105)", () => {
  it("hàng ẩn danh có '?' trong body → 'Ẩn danh hỏi ở câu k'", () => {
    render(
      <ul>
        <CommentNotificationCard
          item={item({ author: { kind: "anonymous" }, commentBody: "Câu này đáp án là gì?", questionNumber: 4 })}
          now={NOW}
        />
      </ul>
    );

    expect(screen.getByText("Ẩn danh hỏi ở câu 4")).toBeTruthy();
  });

  it("hàng ẩn danh KHÔNG có '?' trong body → 'Ẩn danh bình luận ở câu k'", () => {
    render(
      <ul>
        <CommentNotificationCard
          item={item({ author: { kind: "anonymous" }, commentBody: "Mình cũng làm giống vậy.", questionNumber: 2 })}
          now={NOW}
        />
      </ul>
    );

    expect(screen.getByText("Ẩn danh bình luận ở câu 2")).toBeTruthy();
  });
});

describe("CommentNotificationCard — chỉ tên, KHÔNG avatar (Required Test #6, frontend DD § Data Contracts)", () => {
  it("hàng có tên: hiện tên hiển thị, KHÔNG <img>, không chỗ giữ avatar nào", () => {
    const { container } = render(
      <ul>
        <CommentNotificationCard
          item={item({ author: { kind: "named", displayName: "Nguyễn Văn A" }, commentBody: "Cảm ơn bạn nhé" })}
          now={NOW}
        />
      </ul>
    );

    expect(screen.getByText("Nguyễn Văn A bình luận ở câu 3")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
