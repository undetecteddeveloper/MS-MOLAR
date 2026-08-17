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
//
// -----------------------------------------------------------------------------
// Round-trip collapse (2026-08-03 perf pass) — READ THIS BEFORE EDITING
// -----------------------------------------------------------------------------
// listMyHistory() used to issue 3 sequential round trips (exam_results ->
// exam_attempts -> exams, measured ~580ms). It is now ONE PostgREST request that
// embeds exam_attempts and, through it, exams (~193ms; verified byte-identical
// output against the old chain on the real DB with a 37-row account).
//
// This shifts WHERE some obligations are provable, which changes what this file
// can honestly claim:
//   - STRONGER now: ordering (AC-003) moved from a DB .order() into our own JS
//     sort, so it is real behavior this file can execute — obligation (c) now
//     feeds deliberately shuffled rows and asserts the output order, instead of
//     merely asserting that .order() was called. No-N+1 (f) likewise tightens
//     from "exams queried once" to "exactly one round trip, total".
//   - WEAKER now at this boundary: the submitted-only filter (a) and the
//     exams-visibility omission (e) used to be JS the mock could execute; they
//     are now DB-side predicates (.eq + !inner). Against a mocked client, all
//     this file can prove is that those predicates are still ATTACHED to the
//     query — not that Postgres honors them. That behavioral half now rests
//     entirely on SOURCE/supabase/test-rls.ts case H-a (real Postgres), which
//     was already this feature's designated authority for exactly this reason.
//     Deleting a predicate assertion below therefore removes the only
//     fast-feedback guard against silently dropping a visibility filter.

// =============================================================================
// Test 1 — listMyHistory(): submitted+scored filtering, ordering, field
// completeness, exams-visibility omission, single-round-trip, throw-on-error
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
//   reverted away from 'published' must be OMITTED from the list. The rule is
//   unchanged; its enforcement moved from a JS title-lookup miss to the query's
//   own `exams!inner` + .eq(...exams.status,"published") predicates. This file
//   proves only that those predicates are still attached; real-Postgres
//   behavior remains test-rls.ts case H-a's job exclusively.
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9) — this is the PRD's own named
//   Success Criteria measurement file (#1, "List scope correctness"); every
//   /history page load for every user depends on this single function.
// Behavior: listMyHistory() is called against a mocked Supabase client
//   boundary (ONE .from("exam_results") call whose select embeds exam_attempts
//   and exams) -> asserts the returned MyHistoryEntry[] matches AC-001/002/003/
//   004/005's content/order/filtering guarantees, that the scope-narrowing
//   predicates are still attached to the query, that exactly one round trip is
//   issued, and that a Supabase error rejects the promise rather than resolving
//   to [] or partial data.
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
// Primary failure mode: the submitted-only or published-only predicate is
//   dropped from the query (letting an in-progress attempt, or a withdrawn
//   exam's attempt, leak into the list); OR the list is not ordered
//   submitted_at descending; OR a Supabase error resolves to [] / partial data
//   instead of rejecting; OR the single join is re-split into per-table round
//   trips (undoing the perf collapse with every output assertion still green).
// Proof obligation:
//   (a) AC-001 — the query starts FROM exam_results (so an attempt with no
//       score cannot appear at all) and attaches both scope predicates:
//       `exam_attempts!inner` with .eq("exam_attempts.status","submitted").
//       Dropping either is how an in-progress attempt would leak.
//   (b) AC-002 — a zero-row response resolves to [] (strict), never null/undefined.
//   (c) AC-003 — given rows delivered in deliberately shuffled order, the
//       resolved array is sorted by submittedAt DESCENDING. (Real behavior now:
//       the sort is ours, not the DB's.)
//   (d) AC-004/AC-005 (field completeness) — each resolved entry has
//       attemptId, examId, examTitle, subject, totalScore, startedAt,
//       submittedAt all populated from the mocked row (no field silently
//       dropped or coerced), matched against an independently-authored literal.
//   (e) Exams-Visibility Edge Case (R-1, query-shape half ONLY — see test-rls.ts
//       case H-a for the behavioral half) — the query attaches `exams!inner`
//       and .eq("exam_attempts.exams.status","published"), so a non-published
//       exam drops its whole row rather than rendering with a placeholder title.
//   (f) Single-round-trip guard (supersedes the old no-N+1 obligation) —
//       exactly one .from() call is issued, and it is "exam_results". This is
//       both the no-N+1 guarantee (NFR Performance) and the regression guard on
//       the 3-query -> 1-query collapse.
//   (g) AC-019 — a simulated Supabase error causes the returned promise to
//       reject, never resolve to [] or a partial array.
// Verification points / expected results / pass criteria:
//   - Obligation (a): fromMock's sole call argument === "exam_results"; the
//     recorded .select() argument contains "exam_attempts!inner("; the recorded
//     .eq() calls contain ["exam_attempts.status", "submitted"].
//   - Obligation (b): resolved array === [] (strict, not undefined/null).
//   - Obligation (c): for rows supplied oldest-first, the resolved
//     submittedAt sequence is strictly descending.
//   - Obligation (d): toEqual against a literal expected entry authored
//     independently of the mock's return value.
//   - Obligation (e): the recorded .select() argument contains "exams!inner(";
//     the recorded .eq() calls contain
//     ["exam_attempts.exams.status", "published"].
//   - Obligation (f): fromMock.mock.calls.length === 1.
//   - Obligation (g): `await expect(listMyHistory()).rejects.toBeTruthy()` when
//     the mocked response carries a non-null `error`.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction (query shape, .eq()/.select() arguments) and our own JS mapping/sort,
// not real-Postgres RLS semantics. The exams_select_visible RLS omission behavior
// itself is NOT provable here — see the required, blocking
// SOURCE/supabase/test-rls.ts case H-a.
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
  // "limit": listMyHistory đọc qua `readBounded` (P3), nó áp biên bằng .limit()
  // trước khi await builder.
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = chain(method);
  }
  builder.then = (onFulfilled: (value: BuilderResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

/** One joined exam_results row, PostgREST embedded shape (both embeds are to-one objects). */
function joinedRow(o: {
  attemptId: string;
  examId: string;
  title: string;
  subject: string;
  score: number;
  startedAt: string;
  submittedAt: string;
}) {
  return {
    attempt_id: o.attemptId,
    total_score: o.score,
    exam_attempts: {
      exam_id: o.examId,
      started_at: o.startedAt,
      submitted_at: o.submittedAt,
      exams: { title: o.title, subject: o.subject },
    },
  };
}

const ROW_A = joinedRow({
  attemptId: "attempt-A",
  examId: "exam-1",
  title: "Đề Toán học kỳ 1",
  subject: "Toán",
  score: 8.5,
  startedAt: "2026-07-01T10:00:00.000Z",
  submittedAt: "2026-07-01T10:20:00.000Z",
});
const ROW_B = joinedRow({
  attemptId: "attempt-B",
  examId: "exam-2",
  title: "Đề Lý học kỳ 1",
  subject: "Vật lý",
  score: 6,
  startedAt: "2026-07-02T09:00:00.000Z",
  submittedAt: "2026-07-02T09:30:00.000Z",
});
const ROW_C = joinedRow({
  attemptId: "attempt-C",
  examId: "exam-3",
  title: "Đề Hóa học kỳ 1",
  subject: "Hóa học",
  score: 7.25,
  startedAt: "2026-07-03T08:00:00.000Z",
  submittedAt: "2026-07-03T08:45:00.000Z",
});

describe("listMyHistory — scope predicates, ordering, field completeness, exams-visibility omission, single round trip, throw-on-error (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  /** Wires fromMock so the single exam_results join resolves per the given rows (or error). */
  function mockJoin(result: BuilderResult) {
    const joinBuilder = createQueryBuilder(result);
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_results") return joinBuilder.builder;
      throw new Error(`unexpected table: ${table}`);
    });
    return joinBuilder;
  }

  /** The select-string / .eq() predicates recorded on the single join query. */
  function recorded(calls: BuilderCall[]) {
    const selectArg = calls.find((c) => c.method === "select")?.args[0] as string;
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    return { selectArg, eqArgs };
  }

  it("obligation (a): the query reads FROM exam_results and keeps the submitted-only scope predicate (AC-001)", async () => {
    const { calls } = mockJoin({ data: [ROW_A], error: null });

    await listMyHistory();

    // Starting from exam_results is what makes "scored" a precondition: an
    // attempt with no exam_results row has nothing to join from, so it cannot
    // appear regardless of its status (Assumed Behavior #1).
    expect(fromMock).toHaveBeenCalledWith("exam_results");

    const { selectArg, eqArgs } = recorded(calls);
    expect(selectArg).toContain("exam_attempts!inner(");
    expect(eqArgs).toContainEqual(["exam_attempts.status", "submitted"]);
  });

  it("obligation (b): zero scored attempts resolves to [] (AC-002)", async () => {
    mockJoin({ data: [], error: null });

    const entries = await listMyHistory();

    expect(entries).toEqual([]);
  });

  it("obligation (c): rows delivered out of order come back sorted submitted_at descending (AC-003)", async () => {
    // Deliberately oldest-first — the DB no longer orders for us (supabase-js's
    // .order(col,{referencedTable}) is a no-op for a to-one embed; measured
    // returning PK order), so this asserts our own sort actually runs.
    mockJoin({ data: [ROW_A, ROW_C, ROW_B], error: null });

    const entries = await listMyHistory();

    expect(entries.map((e) => e.attemptId)).toEqual(["attempt-C", "attempt-B", "attempt-A"]);
    expect(entries.map((e) => e.submittedAt)).toEqual([
      "2026-07-03T08:45:00.000Z",
      "2026-07-02T09:30:00.000Z",
      "2026-07-01T10:20:00.000Z",
    ]);
  });

  it("obligation (d): every returned row carries attemptId/examId/examTitle/subject/totalScore/startedAt/submittedAt, all populated (AC-004/AC-005)", async () => {
    mockJoin({ data: [ROW_A], error: null });

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

  it("obligation (e): the published-only visibility predicate is still attached to the exams embed (Exams-Visibility Edge Case, R-1)", async () => {
    const { calls } = mockJoin({ data: [ROW_A], error: null });

    await listMyHistory();

    // `!inner` is what turns a non-published exam into a DROPPED ROW rather than
    // a row with a missing title; the explicit status filter is what excludes a
    // self-authored exam that RLS still lets the reader see. Both are required —
    // this mirrors getExam()'s convention (RLS + explicit filter, not RLS alone).
    // Real-Postgres proof: test-rls.ts case H-a.
    const { selectArg, eqArgs } = recorded(calls);
    expect(selectArg).toContain("exams!inner(");
    expect(eqArgs).toContainEqual(["exam_attempts.exams.status", "published"]);
  });

  it("obligation (f): exactly one round trip is issued (no-N+1 + regression guard on the 3-query collapse, NFR Performance)", async () => {
    mockJoin({ data: [ROW_A, ROW_B, ROW_C], error: null });

    await listMyHistory();

    // Was 3 sequential round trips (~580ms); the embed makes it 1 (~193ms).
    // Re-splitting would pass every output assertion above while silently
    // undoing the optimization, so it is asserted explicitly.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results"]);
  });

  it("obligation (g): a simulated Supabase error rejects the promise rather than resolving to [] (AC-019)", async () => {
    mockJoin({ data: null, error: { code: "500", message: "infra failure" } });

    await expect(listMyHistory()).rejects.toBeTruthy();
  });
});
