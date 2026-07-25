// Rating System [integration] Test Skeleton
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
// Generated: 2026-07-24 | Budget Used: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Test 2 converted to real vitest (backend task 4) — imports/describe/it blocks apply
// only to Test 2 below. Test 1/Test 3 remain skeleton-only until their own
// implementation tasks (rateExam / RatingModalController) create the targeted modules;
// this file stays green under tsc/eslint/build for those two until converted.

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

const { listExams } = await import("../queries");
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

  /** Wires fromMock so the eligibility precheck (exam_attempts) finds a submitted
   * attempt and the upsert (exam_difficulty_ratings) resolves via upsertMock. */
  function mockEligibleWithUpsert(upsertMock: ReturnType<typeof vi.fn>) {
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
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
              eq: () => Promise.resolve({ count: 0, error: null }),
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

  it("no sort/no level falls back to .order(id), with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({});

    expect(calls).toContainEqual({ method: "order", args: ["id"] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
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
// Test 3 — RatingModalController: idempotent ?rate=auto open condition
// =============================================================================
// AC-004: "...the shared rating form auto-opens as a modal over the result content..."
// AC-005: "...the modal does not re-pop disruptively (a user who has already rated
//   sees the 'already rated' state per R5, not a forced fresh rating)."
// AC-006: "...it shows an 'already rated' state that is editable (pre-filled with the
//   existing three scores) rather than an empty fresh form."
// ROI: 57 (BV:7 x Freq:7 + Legal:0 + Defect:8)
// Behavior: render RatingModalController (RTL, jsdom) with a mocked next/navigation
//   router and varying searchParams (`rate=auto` present/absent) and `initialScores`
//   (present/absent) -> assert open state and the router.replace call.
// @category: edge-case
// @lane: integration
// @dependency: SOURCE/app/(layer2)/_components/rating/RatingModalController.tsx +
//   mocked next/navigation router (useRouter/useSearchParams/usePathname)
// @complexity: medium
// @real-dependency: none — full focus-trap/focus-return/aria-live behavior is a
//   browser-level concern verified in the fixture-e2e lane (Test FE1); this test
//   proves only the open-condition branching logic in-process.
// Primary failure mode: the ?rate=auto marker is re-consulted on every render instead
//   of exactly once (open-loop or repeated router.replace calls); OR the marker is not
//   stripped so a subsequent render (simulating refresh) re-triggers the open
//   condition; OR a user with initialScores present is shown an empty fresh form
//   instead of the editable pre-filled entry point.
// Proof obligation:
//   (a) with searchParams.rate === "auto", the modal opens on mount and
//       router.replace(pathname, { scroll: false }) is called exactly once to strip
//       the marker (AC-004);
//   (b) with no `rate` marker present (simulating refresh/back/bookmark), the modal
//       stays closed on mount regardless of initialScores (AC-005);
//   (c) when initialScores is provided, the inline entry-point label reads
//       "Edit your rating" (not the fresh "Rate this exam" prompt), and if the modal
//       is opened its form is seeded with those three scores (AC-006).
