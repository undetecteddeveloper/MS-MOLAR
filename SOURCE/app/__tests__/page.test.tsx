// app/page.tsx — Home: guarded hot-exams fetch (F-001) (P7-T1)
// Design Docs: docs/design/exam-shelves-backend-design.md (§ Integration Point I5)
//              docs/design/exam-shelves-frontend-design.md (§ Home block AC-036–AC-038)
// PRD:         docs/prd/exam-shelves-prd.md (AC-036–AC-038)
// Task:        docs/plans/tasks/exam-shelves-task-P7-T1.md — binding Completion Criterion
//
// CLOSES A P3-T2 RESIDUAL. `features/exams/__tests__/shelves.int.test.ts`'s own
// "guard PATTERN" case proves only that the ternary `user ? await listHotExams(...) :
// null` is syntactically correct when evaluated against a hand-declared literal
// `currentUser: null` — that literal can never take the truthy branch, so the case
// cannot fail regardless of what THIS file's real call site (`app/page.tsx`) does.
// This file closes that gap: it imports the REAL `Home` export and invokes it
// directly (a plain function call, not JSX) with a MOCKED user-lookup
// (`getCurrentUserProfile`) and a MOCKED Supabase client boundary
// (`@/lib/supabase/server`'s `createClient`) — the real `listHotExams` (and its
// real `fetchExamRows`/`readMyAttemptRows`/`readHotCounts` dependencies) run
// UNMOCKED, so a dropped/inverted guard at the real call site would show up here
// as a non-zero `fromMock`/`rpcMock` call count.
//
// WHY A PLAIN FUNCTION CALL, NOT A RENDER. `Home`'s own function body — the part
// that contains the guarded `const hot = user ? await listHotExams(...) : null;`
// expression this file must exercise — completes entirely BEFORE any child
// component (`SiteHeader`, `ExamBrowser`, `TechStack`, …) is ever invoked: JSX
// child elements are un-executed descriptors (`{type, props}`) until a renderer
// walks the tree. Calling `await Home(props)` directly and inspecting the
// returned element tree as plain data therefore exercises the exact real
// expression under test without needing to stand up every child component's own
// environment (next/navigation hooks, HeaderSearch, SupportWidget's chat
// script, …) — none of that is this task's Reference Contract. `renderServerTree`
// (the exams-page precedent, `app/(exams)/exams/__tests__/page.test.tsx`) is the
// right tool when the claim is about rendered DOM; the claims here (call counts,
// JSX-tree shape) do not need DOM.
//
// MOCK BOUNDARY: `server-only` stubbed (real `shelves.ts`/`catalogue.ts`/
// `attempts.ts`/`hotCounts.ts` all import it, same as `shelves.int.test.ts:98`);
// `next/headers` stubbed (`Home` awaits it directly); `getCurrentUserProfile`
// mocked (the "user-lookup" the task file names); `@/lib/supabase/server`'s
// `createClient` mocked as `{ from, rpc }` (the SAME technique
// `shelves.int.test.ts` uses for `listExamShelves`/`listHotExams` themselves) —
// everything downstream of the client boundary, incl. `listHotExams` itself, is
// REAL.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => undefined }),
}));

const { getCurrentUserProfileMock, fromMock, rpcMock } = vi.hoisted(() => ({
  getCurrentUserProfileMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

import Home from "@/app/page";
import { ExamBrowser } from "@/features/exams/components/ExamBrowser";

// --- React-element tree helpers ----------------------------------------------
// `Home(...)` returns an UN-RENDERED element tree (plain {type, props} objects,
// per the file header note above) — these walk that tree as data, never calling
// into a component function.

function isReactElement(node: unknown): node is ReactElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in (node as Record<string, unknown>) &&
    "props" in (node as Record<string, unknown>)
  );
}

function walk(node: ReactNode, visit: (el: ReactElement) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!isReactElement(node)) return;
  visit(node);
  walk((node.props as Record<string, unknown>)?.children as ReactNode, visit);
}

function findAllByProp(root: ReactNode, propName: string, propValue: unknown): ReactElement[] {
  const found: ReactElement[] = [];
  walk(root, (el) => {
    if ((el.props as Record<string, unknown>)?.[propName] === propValue) found.push(el);
  });
  return found;
}

function findByType(root: ReactNode, type: unknown): ReactElement[] {
  const found: ReactElement[] = [];
  walk(root, (el) => {
    if (el.type === type) found.push(el);
  });
  return found;
}

function countText(root: ReactNode, text: string): number {
  let count = 0;
  function visitText(node: ReactNode): void {
    if (Array.isArray(node)) {
      node.forEach(visitText);
      return;
    }
    if (node === text) {
      count += 1;
      return;
    }
    if (!isReactElement(node)) return;
    visitText((node.props as Record<string, unknown>)?.children as ReactNode);
  }
  visitText(root);
  return count;
}

// --- Fixture builders (same raw shapes as
//     features/exams/__tests__/shelves.int.test.ts, this file's query-layer
//     sibling) -----------------------------------------------------------------

function examRow(id: string, grade: number, subject: string, createdAt: string) {
  return {
    id,
    title: `Đề ${id}`,
    question_ids: ["q1"],
    duration_minutes: 45,
    subject,
    grade,
    school: null,
    school_year: null,
    semester: null,
    author_display_name: null,
    parts: null,
    passages: null,
    rating_count: 0,
    avg_overall: null,
    created_at: createdAt,
  };
}

function attemptRow(
  id: string,
  examId: string,
  submittedAt: string,
  embed: { grade: number; subject: string; school: string | null }
) {
  return { id, exam_id: examId, submitted_at: submittedAt, exams: embed };
}

function hotRow(examId: string, recent: number, wide: number, total: number) {
  return { exam_id: examId, recent_count: recent, wide_count: wide, total_count: total };
}

function createResolvedBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data, error: null }).then(onFulfilled);
  return builder;
}

type TableFixtures = {
  exams_with_difficulty?: unknown[];
  exam_attempts?: unknown[];
  hotRows?: unknown[];
};

/** Nối `fromMock`/`rpcMock` theo TÊN BẢNG/rpc — cùng kỹ thuật
 *  `shelves.int.test.ts`'s `mockBoundary` dùng, tránh một builder dùng chung
 *  trả nhầm hình dạng bảng cho nhau. */
function mockSupabaseBoundary(fixtures: TableFixtures) {
  const { hotRows = [], ...byTable } = fixtures;
  fromMock.mockImplementation((table: string) =>
    createResolvedBuilder((byTable as Record<string, unknown[]>)[table] ?? [])
  );
  rpcMock.mockImplementation(() => createResolvedBuilder(hotRows));
}

const SIGNED_IN_USER = {
  id: "user-1",
  email: "student@example.com",
  displayName: "Học sinh",
  avatarUrl: null,
};

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  getCurrentUserProfileMock.mockReset();
});

describe("Home (app/page.tsx) — guarded hot-exams call site, real composition (P7-T1 binding Completion Criterion)", () => {
  it("anonymous visitor (getCurrentUserProfile resolves null): the mocked Supabase client records 0 .from(...) and 0 .rpc(...) calls of any kind, and the hot section is absent (F-001, Reference Contract row 2)", async () => {
    getCurrentUserProfileMock.mockResolvedValue(null);
    mockSupabaseBoundary({}); // wired but must never be reached

    const element = await Home({ searchParams: Promise.resolve({}) });

    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(findAllByProp(element, "aria-labelledby", "home-new-exams")).toHaveLength(0);
  });

  it("signed-in visitor, 0 submitted attempts sitewide: listHotExams still runs (hot !== null) but hot.exams.length === 0 -> the whole section is absent, not an empty frame, 0 errors thrown (AC-038, Reference Contract row 1)", async () => {
    getCurrentUserProfileMock.mockResolvedValue(SIGNED_IN_USER);
    mockSupabaseBoundary({
      exams_with_difficulty: [examRow("exam-a", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [],
      hotRows: [],
    });

    const element = await Home({ searchParams: Promise.resolve({}) });

    // Differs from the anonymous case above: the fetch DOES fire for a signed-in
    // visitor — the absence comes from an empty result, never from skipping the call.
    expect(fromMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(findAllByProp(element, "aria-labelledby", "home-new-exams")).toHaveLength(0);
  });

  it("signed-in visitor with a populated hot order: renders 'Đề nổi nhất' (not 'Đề mới đăng'), passes exactly HOME_EXAM_COUNT=3 exams and their submittedExamIds into the stacked ExamBrowser (Green phase — label swap + HOME_EXAM_COUNT preserved)", async () => {
    getCurrentUserProfileMock.mockResolvedValue(SIGNED_IN_USER);
    mockSupabaseBoundary({
      exams_with_difficulty: [
        examRow("h1", 10, "Toán", "2026-01-01T00:00:00.000Z"),
        examRow("h2", 10, "Toán", "2026-01-02T00:00:00.000Z"),
        examRow("h3", 10, "Toán", "2026-01-03T00:00:00.000Z"),
        examRow("h4", 10, "Toán", "2026-01-04T00:00:00.000Z"),
        examRow("h5", 10, "Toán", "2026-01-05T00:00:00.000Z"),
      ],
      exam_attempts: [
        attemptRow("att-1", "h1", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      hotRows: [
        hotRow("h1", 5, 5, 5),
        hotRow("h2", 4, 4, 4),
        hotRow("h3", 3, 3, 3),
        hotRow("h4", 2, 2, 2),
        hotRow("h5", 1, 1, 1),
      ],
    });

    const element = await Home({ searchParams: Promise.resolve({}) });

    expect(countText(element, "Đề nổi nhất")).toBe(1);
    expect(countText(element, "Đề mới đăng")).toBe(0);

    const browsers = findByType(element, ExamBrowser);
    expect(browsers).toHaveLength(1);
    const props = browsers[0].props as {
      exams: { id: string }[];
      layout: string;
      isLoggedIn: boolean;
      submittedExamIds: Set<string>;
    };
    // 5 lượt ứng viên đủ điều kiện đưa vào, chỉ HOME_EXAM_COUNT=3 đi ra — chứng
    // minh call site thật vẫn truyền đúng hằng số HOME_EXAM_COUNT, không đổi.
    expect(props.exams.map((exam) => exam.id)).toHaveLength(3);
    expect(props.layout).toBe("stack");
    expect(props.isLoggedIn).toBe(true);
    expect(props.submittedExamIds).toEqual(new Set(["h1"]));
  });
});
