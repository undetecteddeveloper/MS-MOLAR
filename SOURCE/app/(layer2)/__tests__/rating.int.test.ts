// Rating System [integration] Test Skeleton
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
// Generated: 2026-07-24 | Budget Used: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Test 2 converted to real vitest (backend task 4). Test 1 remains
// skeleton-only until its own implementation task; this file stays green
// under tsc/eslint/build for it until converted.
//
// Test 3 (RatingEntry — the result-page auto-open ?rate=auto dialog) was
// removed 2026-07-27: the Result page's rating button now navigates straight
// to the standalone /exams/[id]/rate page instead of opening a popup there,
// so RatingEntry/the dialog/the ?rate=auto marker it tested no longer exist.
// That's also why this file's environment reverted from jsdom back to plain
// node and the @testing-library/react + next/navigation mocking it needed are
// gone — nothing left in this file renders a component.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as SOURCE/lib/ugc/__tests__/extractMeta.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction; real Postgres NULL/order/range semantics are covered by Task 1's
// spike (S1-S4) and Task 9-backend's SE2, not by this mock.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

const { listExams, listExamsRanked } = await import("../queries");
const { rateExam, getMyRating } = await import("../actions");

type BuilderCall = { method: string; args: unknown[] };

/** Chainable + awaitable fake mirroring the Supabase query-builder surface listExams uses. */
function createQueryBuilder(result: { data: unknown[]; error: null }) {
  const calls: BuilderCall[] = [];
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const method of ["select", "eq", "gte", "lt", "order"]) {
    builder[method] = chain(method);
  }
  builder.then = (onFulfilled: (value: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

// =============================================================================
// Test 1 — rateExam: validation gate, upsert call shape, non-leaking error mapping
// =============================================================================
// AC-002: "...each accepted value is an integer in [1, 10] and a value outside that
//   range or a non-integer is not submittable."
// AC-012: "...their existing rating row is updated in place (no second row is created)
//   and the new three scores replace the old ones."
// AC-025: "...the user sees an actionable message and their entered three scores are
//   preserved for retry."
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Behavior: rateExam(examId, scores) is called against a mocked Supabase client
//   boundary -> isValidPartScore runs before any DB call -> a valid call issues one
//   upsert keyed on (exam_id, user_id) -> a simulated DB error is mapped to a status
//   object, never a raw/leaked error.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/actions.ts (rateExam) + mocked Supabase client
//   (createClient() boundary)
// @complexity: medium
// @real-dependency: none — the Supabase client is the sanctioned mock boundary per
//   backend Design Doc Test Boundaries ("Supabase client inside rateExam — Yes (mock);
//   the real write path is covered by the RLS suite"). rateExam's own validation and
//   control flow run for real; only the network/DB call is stubbed.
// Primary failure mode: an out-of-range or non-integer part score reaches the upsert
//   call; OR a simulated DB error leaks raw Supabase error detail to the caller instead
//   of the mapped { error: "server" }; OR a re-rate issues a bare INSERT instead of an
//   upsert keyed on (exam_id, user_id).
// Proof obligation:
//   (a) a call with any part score non-integer or outside [1,10] resolves to
//       { error: "invalid" } and the mocked client's upsert is never invoked (AC-002);
//   (b) a call with three valid scores invokes upsert(..., { onConflict: "exam_id,user_id" })
//       exactly once, with score_part1/2/3 mapped from partI/partII/partIII (AC-012);
//   (c) a simulated Supabase error on upsert resolves to exactly { error: "server" } —
//       assert the returned object has no other keys and does not contain the mocked
//       error's message/code (AC-025, non-leaking mapping).

describe("rateExam — validation gate, upsert call shape, non-leaking error mapping (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const validScores = { partI: 8, partII: 7, partIII: 9 };

  // Khoá rate-limit lấy từ chính dòng attempt của precheck. Mỗi test dùng một
  // id RIÊNG (ngẫu nhiên) để bộ đếm in-memory của lib/security/rateLimit không
  // rò rỉ giữa các case — cả file chạy trong cùng một tiến trình.
  const RATER_ID = `rater-${Math.random().toString(36).slice(2)}`;

  /** Wires fromMock so the eligibility precheck (exam_attempts) finds a submitted
   * attempt and the upsert (exam_difficulty_ratings) resolves via upsertMock.
   *
   * 2026-08-03 (Security review Low): the precheck changed from a count-head
   * query to `.select("user_id").limit(1).maybeSingle()`. Same single round
   * trip, but it now also yields the rate-limit key — the alternative was an
   * extra `auth.getUser()` network call on every rate. Eligibility semantics
   * are unchanged: a row means eligible, null means not. */
  function mockEligibleWithUpsert(upsertMock: ReturnType<typeof vi.fn>) {
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { user_id: RATER_ID }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "exam_difficulty_ratings") {
        return { upsert: upsertMock };
      }
      throw new Error(`unexpected table: ${table}`);
    });
  }

  it("obligation (a): a non-integer or out-of-range part score resolves to {error:'invalid'} without touching the Supabase client (AC-002)", async () => {
    const outOfRange = await rateExam("exam-1", { partI: 11, partII: 5, partIII: 5 });
    expect(outOfRange).toEqual({ error: "invalid" });

    const nonInteger = await rateExam("exam-1", { partI: 5.5, partII: 5, partIII: 5 });
    expect(nonInteger).toEqual({ error: "invalid" });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("obligation (b): three valid scores invoke upsert(..., {onConflict:'exam_id,user_id'}) exactly once with score_part1/2/3 mapped from partI/partII/partIII (AC-012)", async () => {
    const upsertMock = vi.fn(async () => ({ error: null }));
    mockEligibleWithUpsert(upsertMock);

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({});
    expect(upsertMock).toHaveBeenCalledTimes(1);
    // Exact match (not objectContaining): proves user_id is absent from the payload
    // (DB-defaulted to auth.uid(), never taken from input — backend DD Security
    // Considerations). objectContaining would let a leaked client-supplied user_id
    // pass through this assertion undetected.
    expect(upsertMock).toHaveBeenCalledWith(
      { exam_id: "exam-1", score_part1: 8, score_part2: 7, score_part3: 9 },
      { onConflict: "exam_id,user_id" }
    );
  });

  it("obligation (c): a simulated Supabase error on upsert resolves to exactly {error:'server'} with no leaked message/code (AC-025)", async () => {
    const upsertMock = vi.fn(async () => ({
      error: { code: "23503", message: "secret constraint detail" },
    }));
    mockEligibleWithUpsert(upsertMock);

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({ error: "server" });
    expect(Object.keys(result)).toEqual(["error"]);
    expect(JSON.stringify(result)).not.toContain("secret constraint detail");
    expect(JSON.stringify(result)).not.toContain("23503");
  });

  // AC-003 (backend DD Data Contracts, rateExam): eligibility precheck (exists
  //   submitted attempt) -> else { error: "ineligible" } (UX; RLS with-check
  //   remains the authoritative gate per ADR-0008 Decision 3 — not covered by the
  //   skeleton's obligations (a)-(c), added for the Binding Decision compliance
  //   check).
  // Behavior: rateExam(examId, validScores) is called with a mocked exam_attempts
  //   count of 0 (no submitted attempt) -> the precheck short-circuits before any
  //   upsert call.
  // @category: edge-case
  // @dependency: SOURCE/app/(layer2)/actions.ts (rateExam) + mocked Supabase
  //   client (createClient() boundary)
  it("no submitted attempt resolves to {error:'ineligible'} without invoking upsert (backend DD eligibility precheck; UX-only, RLS remains authoritative)", async () => {
    const upsertMock = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                // No submitted attempt → maybeSingle() yields null (was count:0).
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "exam_difficulty_ratings") {
        return { upsert: upsertMock };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({ error: "ineligible" });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

// AC-013: "...getMyRating(examId) returns their currently stored three scores (or
//   null if none)..." — not in the skeleton's Test 1 proof obligations (a)-(c);
//   added per this task's Proof Obligations (derived from AC-013).
// Behavior: getMyRating(examId) is called against a mocked Supabase client
//   boundary -> reads only the caller's own row (ratings_select_own RLS scope) ->
//   maps score_part1/2/3 to partI/partII/partIII, or returns null if absent, or
//   throws on infra error (Server Component boundary, consistent with getExam).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/actions.ts (getMyRating) + mocked Supabase
//   client (createClient() boundary)
// @real-dependency: none — same sanctioned mock boundary as rateExam; cross-user
//   select-own isolation is proven by Task 2's RLS suite (R-u), not this test.
describe("getMyRating — caller's own three stored scores, or null (Test 1 extension, AC-013)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  function mockRow(row: { score_part1: number; score_part2: number; score_part3: number } | null) {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    });
  }

  it("returns {partI,partII,partIII} mapped from score_part1/2/3 when a row exists", async () => {
    mockRow({ score_part1: 8, score_part2: 7, score_part3: 9 });

    const result = await getMyRating("exam-1");

    expect(result).toEqual({ partI: 8, partII: 7, partIII: 9 });
  });

  it("returns null when the caller has not rated this exam", async () => {
    mockRow(null);

    const result = await getMyRating("exam-1");

    expect(result).toBeNull();
  });

  it("throws on infrastructure error instead of swallowing it", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: "500", message: "infra failure" },
          }),
        }),
      }),
    });

    await expect(getMyRating("exam-1")).rejects.toBeTruthy();
  });
});

// =============================================================================
// Test 2 — listExams: Hardest-sort and Level-filter query construction
// =============================================================================
// AC-017: "...it presents the three real buckets Easy / Medium / Hard (not the
//   'Coming soon' symbolic panel)."
// AC-019/AC-020: "...rated exams appear first ordered by community difficulty
//   descending, and all below-threshold exams appear after them in a deterministic
//   order (by created_at/id)... tie-broken by created_at/id."
// AC-021: "...it contains only exams whose community difficulty is >= 3 ratings and
//   falls in that bucket, and excludes below-threshold exams and exams in other
//   buckets."
// ROI: 80 (BV:8 x Freq:9 + Legal:0 + Defect:8)
// Behavior: listExams({ sort: "hardest" }) and listExams({ level: "easy"|"medium"|"hard" })
//   are called against a mocked Supabase query-builder chain (from/select/eq/order/
//   gte/lt); assert the exact chain calls constructed match the backend Design Doc's
//   Data Flow spec.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/queries.ts (listExams) + mocked Supabase
//   query-builder chain
// @complexity: medium
// @real-dependency: none — this test proves only the JS call construction. Real
//   Postgres NULL/order/range semantics are out of scope here and are covered by the
//   service-integration-e2e lane (Test SE2) and the backend phase-0 spike (S1-S4).
// Primary failure mode: sort:"hardest" omits nullsFirst:false, or omits the chained
//   secondary .order("created_at").order("id") tie-break; OR a level bucket's .gte/.lt
//   pair does not match [1,4)/[4,7)/[7,10]; OR the pre-existing .eq("status","published")
//   guard is dropped when the source relation swaps to the view.
// Proof obligation:
//   (a) for sort:"hardest", assert .order() is called with
//       ("avg_overall", { ascending: false, nullsFirst: false }) followed by
//       .order("created_at") then .order("id") (AC-019/020);
//   (b) for level:"easy"/"medium"/"hard", assert the exact .gte/.lt boundary pair per
//       bucket ([1,4) / [4,7) / [7,10]) and that .eq("status","published") is still
//       present in the chain (AC-017/021);
//   (c) for sort:"newest"/"oldest" and no level filter, assert the pre-existing chain
//       is unchanged (regression guard for AC-023 continuity — no accidental
//       difficulty-filtering side effect on unrelated calls).

describe("listExams — Hardest-sort and Level-filter query construction (Test 2)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("sort:'hardest' chains .order(avg_overall desc, nullsFirst:false).order(created_at).order(id) (AC-019/020, obligation a)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "hardest" });

    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls).toEqual([
      { method: "order", args: ["avg_overall", { ascending: false, nullsFirst: false }] },
      { method: "order", args: ["created_at"] },
      { method: "order", args: ["id"] },
    ]);
  });

  it.each([
    ["easy", 1, 4],
    ["medium", 4, 7],
  ] as const)(
    "level:'%s' chains .gte(avg_overall,%d).lt(avg_overall,%d) and preserves .eq(status,published) (AC-017/021, obligation b)",
    async (level, gte, lt) => {
      const { builder, calls } = createQueryBuilder({ data: [], error: null });
      fromMock.mockReturnValue(builder);

      await listExams({ level });

      expect(calls).toContainEqual({ method: "gte", args: ["avg_overall", gte] });
      expect(calls).toContainEqual({ method: "lt", args: ["avg_overall", lt] });
      expect(calls).toContainEqual({ method: "eq", args: ["status", "published"] });
    }
  );

  it("level:'hard' chains .gte(avg_overall,7) with no upper bound and preserves .eq(status,published) (AC-017/021, obligation b)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ level: "hard" });

    expect(calls).toContainEqual({ method: "gte", args: ["avg_overall", 7] });
    expect(calls.some((c) => c.method === "lt")).toBe(false);
    expect(calls).toContainEqual({ method: "eq", args: ["status", "published"] });
  });

  it("sort:'newest' leaves the pre-existing chain unchanged, with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "newest" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });

  it("sort:'oldest' leaves the pre-existing chain unchanged, with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "oldest" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });

  // RE-SCOPED 2026-08-16 (exam-recommendation v1.2, Success Criteria #5): câu
  // này KHÔNG còn là phát biểu về thứ tự mặc định mà /exams hiển thị — thứ tự
  // đó nay do listExamsRanked quyết (ADR-0015 Decision 1b, xem describe cuối
  // file). Nó vẫn đúng và vẫn có giá trị với tư cách hợp đồng của LƯỢT FETCH
  // NỀN: listExams giữ nguyên hành vi, và một thứ tự nền ổn định là thứ làm
  // đầu vào của bộ xếp hạng tất định. Giữ lại chứ KHÔNG xoá — xoá nó là đúng
  // hình dạng rủi ro R-d.
  it("no sort/no level falls back to .order(id), with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({});

    expect(calls).toContainEqual({ method: "order", args: ["id"] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });
});

describe("listExams — dir overrides a sort axis's default direction (ExamFilters direction toggle)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("sort:'hardest', dir:'asc' flips avg_overall to ascending, nullsFirst still false (easiest-first, below-threshold still sinks)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "hardest", dir: "asc" });

    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls).toEqual([
      { method: "order", args: ["avg_overall", { ascending: true, nullsFirst: false }] },
      { method: "order", args: ["created_at"] },
      { method: "order", args: ["id"] },
    ]);
  });

  it("sort:'newest', dir:'asc' flips created_at to ascending (same effective order as 'oldest')", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "newest", dir: "asc" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
  });

  it("sort:'oldest', dir:'desc' flips created_at to descending (same effective order as 'newest')", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "oldest", dir: "desc" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });

  // RE-SCOPED 2026-08-16 (exam-recommendation v1.2, Success Criteria #5 / I005):
  // `dir` không kèm `sort` vẫn là no-op Ở TẦNG NÀY — listExams vẫn .order("id").
  // Nhưng ở tầng TRANG thì không còn no-op: listExamsRanked xếp hạng cá nhân hoá
  // cho đúng trường hợp đó (PRD AC-037 — một chiều mà không có trục để áp vào
  // thì không phải là một phát biểu về thứ tự). Hai câu không mâu thuẫn; chúng
  // nói về hai tầng khác nhau, và câu ở tầng trang nằm ở describe cuối file.
  it("dir without sort is a no-op — falls back to .order(id) same as no filters at all", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ dir: "asc" });

    expect(calls).toContainEqual({ method: "order", args: ["id"] });
    expect(calls.some((c) => c.method === "order" && c.args[0] === "avg_overall")).toBe(false);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "created_at")).toBe(false);
  });
});

describe("toExam — communityDifficulty mapping is additive, byte-identical below threshold (backend DD Output Comparison)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const baseRow = {
    id: "exam-1",
    title: "Đề kiểm tra",
    question_ids: ["q1", "q2"],
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    school: "THPT A",
    school_year: 2025,
    semester: "HK1",
    author_display_name: "Cô B",
    parts: null,
  };

  it("below-threshold row (rating_count<3) maps to communityDifficulty:null with every pre-existing field byte-identical", async () => {
    const { builder } = createQueryBuilder({
      data: [{ ...baseRow, rating_count: 2, avg_overall: null }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [exam] = await listExams();

    expect(exam).toEqual({
      id: "exam-1",
      title: "Đề kiểm tra",
      questionIds: ["q1", "q2"],
      durationMinutes: 45,
      subject: "Toán",
      grade: 10,
      school: "THPT A",
      schoolYear: 2025,
      semester: "HK1",
      authorDisplayName: "Cô B",
      parts: undefined,
      communityDifficulty: null,
    });
  });

  it("at-threshold row (rating_count=3) maps avg_overall/rating_count through communityDifficultyFrom without re-deriving bucket logic locally", async () => {
    const { builder } = createQueryBuilder({
      data: [{ ...baseRow, rating_count: 3, avg_overall: 6.0 }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [exam] = await listExams();

    expect(exam.communityDifficulty).toEqual({ bucket: "Medium", mean: 6.0, count: 3 });
  });
});


// =============================================================================
// listExamsRanked — hợp đồng thứ tự MẶC ĐỊNH của /exams + ngân sách round-trip
// =============================================================================
// PRD: docs/prd/exam-recommendation-prd.md (v1.2) — AC-001/015/016/021/037,
//      Success Criteria #5; ADR-0015 Decision 1b/6.
//
// Thêm MỚI (2026-08-16), không thay thế câu nào: hai assertion `.order("id")`
// ở trên vẫn xanh và vẫn nói đúng về listExams. Cái được ghim ở đây là thứ
// KHÁC — thứ tự mà trang thực sự render, và số lượt đi mạng để có nó.
describe("listExamsRanked — thứ tự mặc định của /exams và ngân sách round-trip", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const examRow = (id: string, grade: number, createdAt: string) => ({
    id,
    title: `Đề ${id}`,
    question_ids: ["q1"],
    duration_minutes: 45,
    subject: "Toán",
    grade,
    school: null,
    school_year: null,
    semester: null,
    author_display_name: null,
    parts: null,
    rating_count: 0,
    avg_overall: null,
    created_at: createdAt,
  });

  /**
   * Một builder RIÊNG cho mỗi bảng — khác hẳn `fromMock.mockReturnValue(builder)`
   * dùng ở các test trên, và đó chính là điểm mấu chốt: dùng chung một builder
   * thì mọi lượt đọc đều được phục vụ cùng một fixture đề, và `exam_attempts`
   * sẽ nhận nhầm dòng đề làm lịch sử làm bài — test vẫn XANH trong khi đang đo
   * sai thứ. Map theo tên bảng để chuyện đó không xảy ra được.
   */
  function mockTables(byTable: Record<string, unknown[]>) {
    const order: string[] = [];
    fromMock.mockImplementation((table: string) => {
      order.push(table);
      const { builder } = createQueryBuilder({ data: byTable[table] ?? [], error: null });
      return builder;
    });
    return order;
  }

  it("không có ?sort: thứ tự là xếp hạng cá nhân hoá, KHÔNG phải thứ tự id", async () => {
    // Theo id thì "a" đứng đầu. Theo xếp hạng: "a" đã nộp nên bị đẩy xuống, và
    // giữa hai đề chưa làm thì "z" (lớp 12, khớp lịch sử) trên "m" (lớp 9).
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("m", 9, "2026-06-01T00:00:00.000Z"),
        examRow("z", 12, "2026-02-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        {
          id: "att-1",
          exam_id: "a",
          submitted_at: "2026-05-01T00:00:00.000Z",
          exams: { grade: 12 },
        },
      ],
      exam_results: [{ attempt_id: "att-1", total_score: 5 }],
    });

    const { exams, submittedExamIds } = await listExamsRanked({});

    expect(exams.map((e) => e.id)).toEqual(["z", "m", "a"]);
    expect(submittedExamIds).toEqual(new Set(["a"]));
  });

  it("?dir không kèm ?sort vẫn được xếp hạng cá nhân hoá (AC-037)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("z", 12, "2026-06-01T00:00:00.000Z"),
      ],
      exam_attempts: [],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({ dir: "asc" });

    // Thứ tự id sẽ là a,z — xếp hạng cho z trước vì mới hơn.
    expect(exams.map((e) => e.id)).toEqual(["z", "a"]);
  });

  it("?sort tường minh thắng cá nhân hoá: thứ tự DB-side giữ nguyên (AC-016)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("z", 12, "2026-06-01T00:00:00.000Z"),
      ],
      exam_attempts: [],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({ sort: "oldest" });

    expect(exams.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("0 đề bị thêm hay mất so với tập ứng viên (AC-021)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("b", 9, "2026-02-01T00:00:00.000Z"),
        examRow("c", 12, "2026-03-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        { id: "att-1", exam_id: "b", submitted_at: null, exams: { grade: 9 } },
      ],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({});

    expect(exams.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("embed to-one trả về MẢNG vẫn đọc được lớp — hình dạng này chưa được kiểm chứng trên deployment", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("g9", 9, "2026-06-01T00:00:00.000Z"),
        examRow("g12", 12, "2026-01-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        { id: "att-1", exam_id: "other", submitted_at: null, exams: [{ grade: 12 }] },
      ],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({});

    // Lớp đọc được -> g12 (khớp lớp) thắng g9 dù g9 mới hơn. Nếu embed bị bỏ
    // qua thì thứ tự sẽ là g9,g12 và câu này đỏ.
    expect(exams.map((e) => e.id)).toEqual(["g12", "g9"]);
  });

  it("ngân sách: đúng 3 lượt đọc, đúng 3 bảng, 0 lượt ghi (ADR-0015 Decision 6)", async () => {
    const tables = mockTables({
      exams_with_difficulty: [examRow("a", 12, "2026-01-01T00:00:00.000Z")],
      exam_attempts: [],
      exam_results: [],
    });

    await listExamsRanked({});

    expect(tables).toHaveLength(3);
    expect([...tables].sort()).toEqual(["exam_attempts", "exam_results", "exams_with_difficulty"]);
  });

  it("ba lượt đọc chạy SONG SONG: cả ba được phát trước khi lượt nào kịp resolve", async () => {
    // Đây là hồi quy thực sự sẽ xảy ra: ai đó chèn một `await` vào giữa hai
    // lượt đọc và biến chúng thành tuần tự. Mock hoãn resolve để "chúng chạy
    // song song" trở thành một câu kiểm chứng được, offline, không cần DB.
    const issued: string[] = [];
    let settle: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      settle = resolve;
    });

    fromMock.mockImplementation((table: string) => {
      issued.push(table);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lt", "order"]) {
        builder[method] = () => builder;
      }
      builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
        gate.then(() => onFulfilled({ data: [], error: null }));
      return builder;
    });

    const pending = listExamsRanked({});
    // Nhường microtask cho cả ba nhánh của Promise.all được phát đi.
    await Promise.resolve();
    await Promise.resolve();

    expect(issued).toHaveLength(3);

    settle();
    await pending;
  });
});
