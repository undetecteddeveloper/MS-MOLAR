// History [integration] Test Skeleton
// Design Docs: docs/design/history-backend-design.md (v1.2), docs/design/history-frontend-design.md (v1.3)
// PRD: docs/prd/history-prd.md (v1.3, AC-001..AC-019)
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1)
// Generated: 2026-07-30 | Budget Used: integration 3/3, fixture-e2e 3/3, service-integration-e2e 0/2
//
// Converted to real vitest (backend Task 03) — listMyHistory() implemented in
// ../queries.ts; import + describe/it blocks added below, alongside the real
// code, in the same commit (Red -> Green).
//
// Mock boundary (backend DD Test Boundaries): the Supabase client
// (createClient()) is the sanctioned mock — proves JS call construction (query
// shape, .in()/.eq()/.order() arguments and call sequence, matching
// rating.int.test.ts's established fromMock/createQueryBuilder style), not
// real-Postgres semantics. Real-Postgres RLS behavior for the exams-visibility
// omission edge case (R-1) is NOT provable by this file — see the required,
// blocking SOURCE/supabase/test-rls.ts case H-a instead (added in this same
// generation pass).

// =============================================================================
// Test 1 — listMyHistory(): submitted+scored filtering, ordering, field
// completeness, exams-visibility JS-assembly omission, no-N+1, throw-on-error
// =============================================================================
// AC-001: "Given a user with a mix of in-progress and completed+scored
//   attempts, when they open /history, then only rows with status='submitted'
//   and an existing exam_results record appear — no in-progress attempt is
//   shown." [PRD's own highest-flagged risk, R-1 in the backend DD — the
//   exams-visibility omission edge case is part of this same AC's scope.]
// AC-002: "Given a user with zero completed+scored attempts, when they open
//   /history, then an empty state renders... [listMyHistory() resolves to []
//   without throwing]."
// AC-003: "...when the list renders, then rows are ordered by submitted_at
//   descending."
// AC-004/AC-005: "...it shows the exam title, score as X/10, the submitted
//   date, and a completion time..." / "...they land on
//   /exams/[id]/attempt/[attemptId]/result for that exact attempt" —
//   MyHistoryEntry must carry every field both ACs need (examTitle, totalScore,
//   startedAt, submittedAt, attemptId, examId), with none silently dropped.
// AC-019: "Given a /history list-read failure (e.g., a DB/network error)...
//   the user sees an actionable error message... and can retry the load."
//   (backend half: listMyHistory() must throw, never resolve to a
//   partial/silent result, so the frontend's error.tsx boundary can catch it.)
// Exams-Visibility Edge Case (backend DD, risk R-1): a self-authored exam later
//   reverted away from 'published' must be OMITTED from the list — the title
//   lookup uses exams_select_visible RLS AND an explicit
//   .eq("status","published") filter (matching getExam()'s convention), not RLS
//   alone. This test proves only the JS-assembly/omit-logic half against a
//   manually mocked response; it does NOT prove real-Postgres RLS behavior —
//   that is test-rls.ts case H-a's job exclusively.
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9) — this is the PRD's own named
//   Success Criteria measurement file (#1, "List scope correctness"); every
//   /history page load for every user depends on this single function.
// Behavior: listMyHistory() is called against a mocked Supabase client
//   boundary (3 sequential .from() calls: exam_results -> exam_attempts ->
//   exams) -> asserts the returned MyHistoryEntry[] matches AC-001/002/003/
//   004/005's content/order/filtering guarantees, that a titleless row is
//   silently omitted (not defaulted to a placeholder), that the exams-title
//   lookup is invoked exactly once regardless of attempt-row count (no N+1),
//   and that a simulated Supabase error at any of the 3 steps rejects the
//   promise rather than resolving to [] or partial data.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(HM)/queries.ts (listMyHistory) + mocked Supabase
//   client (createClient() boundary)
// @complexity: medium
// @real-dependency: none — the Supabase client is the sanctioned mock boundary
//   per backend DD Test Boundaries ("Supabase client inside listMyHistory()/
//   getResult() — Yes (mock)"). The exams_select_visible RLS omission behavior
//   itself is explicitly NOT provable by this mock (backend DD: "Mocks cannot
//   prove RLS filtering... require a real DB") — see the required,
//   blocking SOURCE/supabase/test-rls.ts case H-a for that half.
// Primary failure mode: an in-progress (status='in_progress') attempt leaks
//   into the returned list; OR the list is not ordered submitted_at
//   descending; OR a row whose exam is not visible/published still carries a
//   title (the omission rule silently regresses to "default title" or
//   "include anyway" instead of dropping the row); OR a Supabase error at any
//   of the 3 steps resolves to [] / partial data instead of rejecting; OR the
//   exams lookup is invoked once per row instead of once total (N+1
//   regression, violating the NFR "no per-row round trip" guarantee).
// Proof obligation:
//   (a) AC-001 — with exam_results rows existing for attempts A and B, but
//       exam_attempts returning only A as status='submitted' (B still
//       'in_progress'), the resolved array contains only A's entry, never B's.
//   (b) AC-002 — exam_results resolves to [] -> listMyHistory() resolves to []
//       without invoking the exam_attempts or exams mocks at all (early
//       return, proving the "no per-row round trip" guarantee holds even in
//       the zero-row case).
//   (c) AC-003 — the exam_attempts mock is invoked with
//       .order("submitted_at", { ascending: false }).
//   (d) AC-004/AC-005 (field completeness) — each resolved entry has
//       attemptId, examId, examTitle, totalScore, startedAt, submittedAt all
//       populated from the mocked rows (no field silently dropped or
//       coerced) — sufficient for the frontend to render title/score/date/
//       time and construct the View-details route with zero extra fetch.
//   (e) Exams-Visibility Edge Case (R-1, JS-assembly half ONLY — not proof of
//       real RLS behavior; see test-rls.ts case H-a for that) — with 2
//       attempt rows but the mocked exams response containing a title for
//       only 1 of them, the resolved array has exactly 1 entry; the titleless
//       one is omitted entirely, never defaulted to a placeholder title.
//   (f) No-N+1 regression guard — the exams table's mocked .from is invoked
//       exactly once regardless of attempt-row count (proves the batched
//       .in() shape, not a per-row call) — NFR Performance.
//   (g) AC-019 — a simulated Supabase error at any of the 3 steps (exam_
//       results, exam_attempts, or exams) causes the returned promise to
//       reject, never resolve to [] or a partial array (3 sub-cases, one per
//       step).
// Verification points / expected results / pass criteria:
//   - Obligation (a): resolved array length === 1; the single entry's
//     attemptId identifies attempt A; attempt B's id never appears anywhere in
//     the resolved array.
//   - Obligation (b): resolved array === [] (strict, not undefined/null); the
//     exam_attempts and exams mocks each report a call count of 0.
//   - Obligation (c): the mocked exam_attempts chain's recorded call list
//     contains an .order() invocation with the exact args
//     ["submitted_at", { ascending: false }].
//   - Obligation (d): every key of MyHistoryEntry (attemptId, examId,
//     examTitle, totalScore, startedAt, submittedAt) is present and
//     non-undefined on every resolved entry, and each value equals the
//     corresponding mocked snake_case field's literal value (independent
//     literal expectation, not merely "whatever the mock returned").
//   - Obligation (e): resolved array length === 1 (not 2); the omitted
//     attempt's id never appears in the resolved array's attemptId list.
//   - Obligation (f): the exams table's .from/.select/.in call count === 1 for
//     a fixture with 2+ distinct exam ids across the attempt rows.
//   - Obligation (g): for each of the 3 steps in turn, `await expect(
//     listMyHistory()).rejects.toBeTruthy()` holds when that step's mocked
//     response carries a non-null `error`.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction (query shape, .in()/.eq()/.order() call sequence), not real-Postgres
// RLS semantics. The exams_select_visible RLS omission behavior itself is NOT
// provable here — see the required, blocking SOURCE/supabase/test-rls.ts case H-a.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

const { listMyHistory } = await import("../queries");

type BuilderResult = { data: unknown[] | null; error: unknown };
type BuilderCall = { method: string; args: unknown[] };

/** Chainable + awaitable fake mirroring the Supabase query-builder surface listMyHistory uses. */
function createQueryBuilder(result: BuilderResult) {
  const calls: BuilderCall[] = [];
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  for (const method of ["select", "eq", "in", "order"]) {
    builder[method] = chain(method);
  }
  builder.then = (onFulfilled: (value: BuilderResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

type ThreeStepMocks = {
  resultRows?: BuilderResult;
  attemptRows?: BuilderResult;
  examRows?: BuilderResult;
};

const resultRowA = { attempt_id: "attempt-A", total_score: 8.5 };
const resultRowB = { attempt_id: "attempt-B", total_score: 6 };

const attemptRowA = {
  id: "attempt-A",
  exam_id: "exam-1",
  started_at: "2026-07-01T10:00:00.000Z",
  submitted_at: "2026-07-01T10:20:00.000Z",
};
const attemptRowB = {
  id: "attempt-B",
  exam_id: "exam-2",
  started_at: "2026-07-02T09:00:00.000Z",
  submitted_at: "2026-07-02T09:30:00.000Z",
};

const examRowTitle1 = { id: "exam-1", title: "Đề Toán học kỳ 1", subject: "Toán" };
const examRowTitle2 = { id: "exam-2", title: "Đề Lý học kỳ 1", subject: "Vật lý" };

describe("listMyHistory — filtering, ordering, field completeness, exams-visibility omission, no-N+1, throw-on-error (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  /** Wires fromMock so exam_results/exam_attempts/exams each resolve per the given rows (or error). */
  function mockThreeSteps(options: ThreeStepMocks) {
    const resultBuilder = createQueryBuilder(options.resultRows ?? { data: [], error: null });
    const attemptBuilder = createQueryBuilder(options.attemptRows ?? { data: [], error: null });
    const examBuilder = createQueryBuilder(options.examRows ?? { data: [], error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "exam_results") return resultBuilder.builder;
      if (table === "exam_attempts") return attemptBuilder.builder;
      if (table === "exams") return examBuilder.builder;
      throw new Error(`unexpected table: ${table}`);
    });

    return { resultBuilder, attemptBuilder, examBuilder };
  }

  it("obligation (a): an in-progress attempt never leaks into the returned list (AC-001)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA, resultRowB], error: null },
      // B is still 'in_progress' — the (mocked) DB-side .eq("status","submitted")
      // filter excludes it, so only A is ever returned from this step.
      attemptRows: { data: [attemptRowA], error: null },
      examRows: { data: [examRowTitle1], error: null },
    });

    const entries = await listMyHistory();

    expect(entries).toHaveLength(1);
    expect(entries[0].attemptId).toBe("attempt-A");
    expect(entries.some((e) => e.attemptId === "attempt-B")).toBe(false);
  });

  it("obligation (b): zero scored attempts resolves to [] without calling exam_attempts/exams at all (AC-002)", async () => {
    const { attemptBuilder, examBuilder } = mockThreeSteps({
      resultRows: { data: [], error: null },
    });

    const entries = await listMyHistory();

    expect(entries).toEqual([]);
    expect(attemptBuilder.calls).toHaveLength(0);
    expect(examBuilder.calls).toHaveLength(0);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("exam_results");
  });

  it('obligation (c): exam_attempts is queried with .order("submitted_at", { ascending: false }) (AC-003)', async () => {
    const { attemptBuilder } = mockThreeSteps({
      resultRows: { data: [resultRowA], error: null },
      attemptRows: { data: [attemptRowA], error: null },
      examRows: { data: [examRowTitle1], error: null },
    });

    await listMyHistory();

    expect(attemptBuilder.calls).toContainEqual({
      method: "order",
      args: ["submitted_at", { ascending: false }],
    });
  });

  it("obligation (d): every returned row carries attemptId/examId/examTitle/totalScore/startedAt/submittedAt, all populated (AC-004/AC-005)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA], error: null },
      attemptRows: { data: [attemptRowA], error: null },
      examRows: { data: [examRowTitle1], error: null },
    });

    const entries = await listMyHistory();

    // Independent literal expectation (not merely "whatever the mock returned").
    expect(entries).toEqual([
      {
        attemptId: "attempt-A",
        examId: "exam-1",
        examTitle: "Đề Toán học kỳ 1",
        subject: "Toán",
        totalScore: 8.5,
        startedAt: "2026-07-01T10:00:00.000Z",
        submittedAt: "2026-07-01T10:20:00.000Z",
      },
    ]);
  });

  it("obligation (e): a titleless row (exam not visible/published) is omitted entirely, never defaulted (Exams-Visibility Edge Case, R-1)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA, resultRowB], error: null },
      attemptRows: { data: [attemptRowA, attemptRowB], error: null },
      // exam-2's title is missing — simulates an exam not visible/not published.
      examRows: { data: [examRowTitle1], error: null },
    });

    const entries = await listMyHistory();

    expect(entries).toHaveLength(1);
    expect(entries).toContainEqual({
      attemptId: "attempt-A",
      examId: "exam-1",
      examTitle: "Đề Toán học kỳ 1",
      subject: "Toán",
      totalScore: 8.5,
      startedAt: attemptRowA.started_at,
      submittedAt: attemptRowA.submitted_at,
    });
    expect(entries.some((e) => e.attemptId === "attempt-B")).toBe(false);
  });

  it("obligation (f): the exams table's mocked .from is invoked exactly once regardless of attempt-row count (no-N+1, NFR Performance)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA, resultRowB], error: null },
      attemptRows: { data: [attemptRowA, attemptRowB], error: null },
      examRows: { data: [examRowTitle1, examRowTitle2], error: null },
    });

    await listMyHistory();

    expect(fromMock.mock.calls.filter(([table]) => table === "exams")).toHaveLength(1);
  });

  it("obligation (g): a simulated Supabase error on the exam_results step rejects the promise (AC-019)", async () => {
    mockThreeSteps({
      resultRows: { data: null, error: { code: "500", message: "infra failure" } },
    });

    await expect(listMyHistory()).rejects.toBeTruthy();
  });

  it("obligation (g): a simulated Supabase error on the exam_attempts step rejects the promise (AC-019)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA], error: null },
      attemptRows: { data: null, error: { code: "500", message: "infra failure" } },
    });

    await expect(listMyHistory()).rejects.toBeTruthy();
  });

  it("obligation (g): a simulated Supabase error on the exams step rejects the promise (AC-019)", async () => {
    mockThreeSteps({
      resultRows: { data: [resultRowA], error: null },
      attemptRows: { data: [attemptRowA], error: null },
      examRows: { data: null, error: { code: "500", message: "infra failure" } },
    });

    await expect(listMyHistory()).rejects.toBeTruthy();
  });
});
