// app/page.tsx — Trang chủ: lấy kệ hot có cổng bảo vệ (F-001) (P7-T1)
// Design Docs: docs/design/exam-shelves-backend-design.md (§ Integration Point I5)
//              docs/design/exam-shelves-frontend-design.md (§ Home block AC-036–AC-038)
// PRD:         docs/prd/exam-shelves-prd.md (AC-036–AC-038)
// Task:        docs/plans/tasks/exam-shelves-task-P7-T1.md — Completion Criterion ràng buộc
//
// ĐÓNG MỘT PHẦN DƯ CỦA P3-T2. Ca "guard PATTERN" của `features/exams/__tests__/shelves.int.test.ts`
// chỉ chứng minh rằng biểu thức ba ngôi `user ? await listHotExams(...) :
// null` đúng cú pháp khi đánh giá với `currentUser: null` khai báo tay —
// literal đó không bao giờ rẽ vào nhánh truthy, nên ca đó không thể hỏng bất kể
// điểm gọi thật (`app/page.tsx`) của FILE NÀY làm gì.
// File này đóng khoảng trống đó: nó import export `Home` THẬT và gọi
// trực tiếp (gọi hàm thường, không phải JSX) với một tra cứu user MOCK
// (`getCurrentUserProfile`) và một ranh giới client Supabase MOCK
// (`createClient` của `@/lib/supabase/server`) — `listHotExams` thật (cùng các
// phụ thuộc thật `fetchExamRows`/`readMyAttemptRows`/`readHotCounts`) chạy
// KHÔNG mock, nên một cổng bị rơi/đảo ngược ở điểm gọi thật sẽ hiện ở đây
// dưới dạng số lần gọi `fromMock`/`rpcMock` khác 0.
//
// VÌ SAO GỌI HÀM THƯỜNG, KHÔNG RENDER. Thân hàm của chính `Home` — phần
// chứa biểu thức có cổng `const hot = user ? await listHotExams(...) : null;`
// mà file này phải kích hoạt — chạy xong hoàn toàn TRƯỚC khi bất kỳ component con
// nào (`SiteHeader`, `ExamBrowser`, `TechStack`, …) được gọi: các phần tử JSX con
// là descriptor chưa thực thi (`{type, props}`) cho tới khi một renderer
// duyệt cây. Gọi thẳng `await Home(props)` rồi xem cây phần tử trả về như dữ liệu thuần
// do đó kích hoạt đúng biểu thức thật đang được kiểm mà không cần dựng
// môi trường riêng của từng component con (hook next/navigation, HeaderSearch,
// script chat của SupportWidget, …) — không thứ nào trong đó thuộc Reference Contract của task này.
// `renderServerTree` (tiền lệ trang exams, `app/(exams)/exams/__tests__/page.test.tsx`)
// là công cụ đúng khi khẳng định nói về DOM đã render; các khẳng định ở đây (số lần gọi,
// hình dạng cây JSX) không cần DOM.
//
//RANH GIỚI MOCK: `server-only` được stub (`shelves.ts`/`catalogue.ts`/
// `attempts.ts`/`hotCounts.ts` thật đều import nó, như `shelves.int.test.ts:98`);
// `next/headers` được stub (`Home` await nó trực tiếp); `getCurrentUserProfile`
// được mock ("tra cứu user" mà task file nêu); `createClient` của `@/lib/supabase/server`
// được mock thành `{ from, rpc }` (CHÍNH kỹ thuật mà
// `shelves.int.test.ts` dùng cho `listExamShelves`/`listHotExams` ) —
// mọi thứ nằm sau ranh giới client, kể cả chính `listHotExams`, là THẬT.

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
import { LatestSolutionsSpotlight } from "@/features/home/components/LatestSolutionsSpotlight";
import { PersonalProgressStrip } from "@/features/home/components/PersonalProgressStrip";

// --- Hàm phụ trợ cho cây phần tử React ----------------------------------------------
// `Home(...)` trả về một cây phần tử CHƯA RENDER (các object {type, props} thuần,
// theo ghi chú đầu file ở trên) — các hàm này duyệt cây đó như dữ liệu, không bao giờ
// gọi vào một hàm component.

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

// --- Hàm dựng fixture (cùng hình dạng thô với
//     features/exams/__tests__/shelves.int.test.ts, file anh em ở tầng truy vấn) -----

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

/** Hàng thô của `community_solutions_latest_for_home` (schema.sql §26, F-041) —
 *  cùng hình dạng `RawHomeSolutionRow` (features/solutions/queries.ts). */
function homeSolutionRow(
  id: string,
  examId: string,
  subject: string,
  grade: number,
  updatedAt: string,
  helpfulCount: number
) {
  return {
    id,
    exam_id: examId,
    exam_subject: subject,
    exam_grade: grade,
    updated_at: updatedAt,
    author_display_name: null,
    author_avatar_path: null,
    helpful_count: helpfulCount,
  };
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
  /** Hàng `community_solutions_latest_for_home` (F-041) — RPC THỨ HAI cùng đi
   *  qua `rpcMock`, định tuyến theo TÊN hàm (không phải theo builder dùng
   *  chung) để không lẫn hình dạng với `hotRows`. */
  latestSolutionRows?: unknown[];
};

/** Nối `fromMock`/`rpcMock` theo TÊN BẢNG/rpc — cùng kỹ thuật
 *  `shelves.int.test.ts`'s `mockBoundary` dùng, tránh một builder dùng chung
 *  trả nhầm hình dạng bảng cho nhau. */
function mockSupabaseBoundary(fixtures: TableFixtures) {
  const { hotRows = [], latestSolutionRows = [], ...byTable } = fixtures;
  fromMock.mockImplementation((table: string) =>
    createResolvedBuilder((byTable as Record<string, unknown[]>)[table] ?? [])
  );
  rpcMock.mockImplementation((fn: string) =>
    createResolvedBuilder(fn === "community_solutions_latest_for_home" ? latestSolutionRows : hotRows)
  );
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
    mockSupabaseBoundary({}); // đã nối dây nhưng không bao giờ được chạm tới

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

    // Khác ca ẩn danh ở trên: lượt lấy dữ liệu CÓ chạy cho khách đã đăng nhập —
    // việc không thấy gì đến từ kết quả rỗng, chứ không phải bỏ qua lời gọi.
    // 2 lượt .rpc(): exam_hot_counts (F-001) + community_solutions_latest_for_home
    // (F-041) — cả hai chạy song song trong CÙNG một Promise.all khi có `user`.
    expect(fromMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledTimes(2);
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

  it("signed-in visitor: PersonalProgressStrip gets the tie-broken top subject + total count from `exam_attempts`, LatestSolutionsSpotlight gets the RPC rows verbatim (F-041)", async () => {
    getCurrentUserProfileMock.mockResolvedValue(SIGNED_IN_USER);
    mockSupabaseBoundary({
      exams_with_difficulty: [],
      // 2 lượt "Toán", 1 lượt "Physics" -> topSubject = "Toán" (nhiều lượt hơn);
      // 3 exam_id khác nhau -> totalCompleted = 3.
      exam_attempts: [
        attemptRow("att-1", "h1", "2026-05-01T00:00:00.000Z", { grade: 10, subject: "Toán", school: null }),
        attemptRow("att-2", "h2", "2026-05-02T00:00:00.000Z", { grade: 10, subject: "Toán", school: null }),
        attemptRow("att-3", "h3", "2026-05-03T00:00:00.000Z", {
          grade: 10,
          subject: "Physics",
          school: null,
        }),
      ],
      hotRows: [],
      latestSolutionRows: [
        homeSolutionRow("sol-1", "h1", "Toán", 10, "2026-05-01T00:00:00.000Z", 2),
        homeSolutionRow("sol-2", "h2", "Physics", 10, "2026-05-02T00:00:00.000Z", 0),
      ],
    });

    const element = await Home({ searchParams: Promise.resolve({}) });

    const progress = findByType(element, PersonalProgressStrip);
    expect(progress).toHaveLength(1);
    expect((progress[0].props as { totalCompleted: number }).totalCompleted).toBe(3);
    expect((progress[0].props as { topSubject: string | null }).topSubject).toBe("Toán");

    const spotlight = findByType(element, LatestSolutionsSpotlight);
    expect(spotlight).toHaveLength(1);
    const items = (spotlight[0].props as { items: { id: string }[] }).items;
    expect(items.map((item) => item.id)).toEqual(["sol-1", "sol-2"]);
  });

  it("signed-in visitor, 0 lời giải đủ điều kiện: LatestSolutionsSpotlight vắng mặt, không phải một khối rỗng (cùng ranh giới AC-038 của kệ Nổi nhất)", async () => {
    getCurrentUserProfileMock.mockResolvedValue(SIGNED_IN_USER);
    mockSupabaseBoundary({
      exams_with_difficulty: [],
      exam_attempts: [],
      hotRows: [],
      latestSolutionRows: [],
    });

    const element = await Home({ searchParams: Promise.resolve({}) });

    expect(findByType(element, LatestSolutionsSpotlight)).toHaveLength(0);
    // Dải tiến độ vẫn hiện dù 0 đề đã hoàn thành (component's own doc: "vắng
    // mặt hẳn thì không ai biết trang chủ có theo dõi tiến độ").
    const progress = findByType(element, PersonalProgressStrip);
    expect(progress).toHaveLength(1);
    expect((progress[0].props as { totalCompleted: number }).totalCompleted).toBe(0);
  });
});

// =============================================================================
// `?next=` — đăng nhập xong về đúng trang khách đang xem (brief 20261012 T7/D4)
// =============================================================================
describe("Home (app/page.tsx) — ?next= của form đăng nhập", () => {
  it("khách + ?auth=signin&next=/history: HomeStage nhận next='/history'", async () => {
    getCurrentUserProfileMock.mockResolvedValue(null);
    mockSupabaseBoundary({});

    const element = await Home({
      searchParams: Promise.resolve({ auth: "signin", next: "/history" }),
    });

    expect(findAllByProp(element, "next", "/history")).toHaveLength(1);
  });

  it("khách + next là đích ngoài/lạ: bị bỏ ở server, HomeStage không nhận next", async () => {
    getCurrentUserProfileMock.mockResolvedValue(null);
    mockSupabaseBoundary({});

    for (const evil of ["//evil.example", "https://evil.example", "/profile", "javascript:alert(1)"]) {
      const element = await Home({
        searchParams: Promise.resolve({ auth: "signin", next: evil }),
      });
      expect(findAllByProp(element, "next", evil), evil).toHaveLength(0);
    }
  });

  it("đã đăng nhập mà mở form auth: redirect tới next hợp lệ, còn lại /exams", async () => {
    getCurrentUserProfileMock.mockResolvedValue(SIGNED_IN_USER);
    mockSupabaseBoundary({});

    await expect(
      Home({ searchParams: Promise.resolve({ auth: "signin", next: "/me/dashboard" }) })
    ).rejects.toMatchObject({ digest: expect.stringContaining("/me/dashboard") });

    await expect(
      Home({ searchParams: Promise.resolve({ auth: "signin", next: "//evil.example" }) })
    ).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_REDIRECT;[a-z]+;\/exams;/) });
  });
});
