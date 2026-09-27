// @vitest-environment jsdom

// Task 46 (P5-T7) — verification + wiring pass: `SolutionCard` (task 17),
// `SolutionAuthorCard` (task 19) và `CommentItem` (task 28) phải truyền
// `item.author`/`solution.author`/`comment.author` THẲNG qua `AuthorIdentity`
// → `Avatar`, không điều kiện self/non-self, không prop phụ nào có thể làm
// rớt `avatarUrl` (frontend DD § Minimal Surface Alternatives Element 1,
// Alternative A; PRD AC-039). Proof Obligation: "the system shall set
// `avatarUrl` on the resulting `AuthorIdentity` regardless of whether
// `isMine` is `true` or `false`" — bài kiểm ở đây chỉ render với props đã map
// sẵn (không cần is_mine=true/false vì cả ba component không có nhánh nào đọc
// isMine để quyết định avatar).
//
// Boundary Context roundtrip check: một chuỗi signed URL trên MỘT hàng có tên,
// KHÔNG phải của mình, ra tới `src` của `<img>` được render nguyên vẹn, ở cả
// ba component.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionListItem, SolutionDetailComment } from "@/features/solutions/queries";
import type { SolutionAuthorCardHeader } from "@/features/solutions/components/SolutionAuthorCard";

const STORAGE_ORIGIN = "https://test-project.supabase.co";
const AVATAR_URL = `${STORAGE_ORIGIN}/storage/v1/object/sign/avatars/u-2/avatar.webp?token=t0k3n`;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE_ORIGIN;
});

const { toggleHelpfulMock, setPinMock, deleteCommentMock, reportCommentMock } = vi.hoisted(() => ({
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
  deleteCommentMock: vi.fn(),
  reportCommentMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
  deleteComment: deleteCommentMock,
  reportComment: reportCommentMock,
}));

const { SolutionCard } = await import("@/features/solutions/components/SolutionCard");
const { SolutionAuthorCard } = await import("@/features/solutions/components/SolutionAuthorCard");
const { CommentItem } = await import("@/features/solutions/components/CommentItem");

const NOW = new Date("2026-09-27T10:00:00.000Z");
const EXAM_ID = "E1";

function listItem(overrides: Partial<SolutionListItem> = {}): SolutionListItem {
  return {
    id: "S1",
    isPinned: false,
    updatedAt: "2026-09-27T09:00:00.000Z",
    isMine: false,
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    helpfulCount: 3,
    iMarkedHelpful: false,
    commentCount: 2,
    changedQuestionCount: 0,
    ...overrides,
  };
}

function authorCardHeader(overrides: Partial<SolutionAuthorCardHeader> = {}): SolutionAuthorCardHeader {
  return {
    id: "S1",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isPinned: false,
    updatedAt: "2026-09-27T09:00:00.000Z",
    isMine: false,
    helpfulCount: 3,
    iMarkedHelpful: false,
    iReported: false,
    ...overrides,
  };
}

function commentItem(overrides: Partial<SolutionDetailComment> = {}): SolutionDetailComment {
  return {
    id: "c1",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isSolutionAuthor: false,
    isMine: false,
    body: "Bình luận thường",
    iReported: false,
    createdAt: "2026-09-27T08:00:00.000Z",
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => {
  toggleHelpfulMock.mockReset();
  setPinMock.mockReset();
  deleteCommentMock.mockReset();
  reportCommentMock.mockReset();
});

describe("SolutionCard — avatarUrl không tự mình (roundtrip)", () => {
  it("hàng có tên, không phải của mình, có avatarUrl: <img src> đúng nguyên URL", () => {
    const { container } = render(
      <ul>
        <SolutionCard
          item={listItem({ author: { kind: "named", displayName: "Nguyễn Văn A", avatarUrl: AVATAR_URL } })}
          examId={EXAM_ID}
          now={NOW}
        />
      </ul>
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(AVATAR_URL);
  });

  it("hàng có tên, không có avatarUrl: không lỗi, hiện chữ cái đầu (không <img>)", () => {
    const { container } = render(
      <ul>
        <SolutionCard
          item={listItem({ author: { kind: "named", displayName: "Trần Thị B" } })}
          examId={EXAM_ID}
          now={NOW}
        />
      </ul>
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
  });

  it("hàng ẩn danh: không <img> nào", () => {
    const { container } = render(
      <ul>
        <SolutionCard item={listItem({ author: { kind: "anonymous" } })} examId={EXAM_ID} now={NOW} />
      </ul>
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("SolutionAuthorCard — avatarUrl không tự mình (roundtrip)", () => {
  it("hàng có tên, không phải của mình, có avatarUrl: <img src> đúng nguyên URL", () => {
    const { container } = render(
      <SolutionAuthorCard
        solution={authorCardHeader({
          author: { kind: "named", displayName: "Nguyễn Văn A", avatarUrl: AVATAR_URL },
        })}
        examId={EXAM_ID}
        now={NOW}
        isExamAuthor={false}
      />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(AVATAR_URL);
  });

  it("hàng có tên, không có avatarUrl: không lỗi, hiện chữ cái đầu (không <img>)", () => {
    const { container } = render(
      <SolutionAuthorCard
        solution={authorCardHeader({ author: { kind: "named", displayName: "Trần Thị B" } })}
        examId={EXAM_ID}
        now={NOW}
        isExamAuthor={false}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
  });

  it("hàng ẩn danh: không <img> nào", () => {
    const { container } = render(
      <SolutionAuthorCard
        solution={authorCardHeader({ author: { kind: "anonymous" } })}
        examId={EXAM_ID}
        now={NOW}
        isExamAuthor={false}
      />
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("CommentItem — avatarUrl không tự mình (roundtrip)", () => {
  it("hàng có tên, không phải của mình, có avatarUrl: <img src> đúng nguyên URL", () => {
    const { container } = render(
      <CommentItem
        comment={commentItem({ author: { kind: "named", displayName: "Nguyễn Văn A", avatarUrl: AVATAR_URL } })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(AVATAR_URL);
  });

  it("hàng có tên, không có avatarUrl: không lỗi, hiện chữ cái đầu (không <img>)", () => {
    const { container } = render(
      <CommentItem
        comment={commentItem({ author: { kind: "named", displayName: "Trần Thị B" } })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Trần Thị B")).toBeTruthy();
  });

  it("hàng ẩn danh: không <img> nào", () => {
    const { container } = render(
      <CommentItem comment={commentItem({ author: { kind: "anonymous" } })} now={NOW} onDeleted={vi.fn()} />
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
