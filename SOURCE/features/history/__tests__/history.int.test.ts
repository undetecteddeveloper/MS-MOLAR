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
// @dependency: SOURCE/features/history/queries.ts (listMyHistory) + mocked Supabase
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIST_ROW_CEILING } from "@/lib/supabase/boundedRead";
import { summariseEssays } from "@/lib/scoring/essayLifecycle";

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

const { listMyHistory } = await import("@/features/history/queries");

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
        // ADR-0018 (Task B2.2) — hai boolean BAT BUOC, additive. `false` la gia
        // tri dung cho ROW_A: fixture cua Test 1 khong mang `per_question`, nen
        // khong dong nao co khoa vong doi. Chinh khang dinh VET CAN nay la thu
        // bat duoc thay doi — dung viec no phai lam voi mot boundary-change.
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
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

// =============================================================================
// Test 2 — listMyHistory(): per_question + created_at in the select, and the
//          TWO required essay booleans (ADR-0018, Task B2.2)
// =============================================================================
// AC: EG-BE-034 (`hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`),
//   EG-BE-035 (both booleans are REAL booleans, never `undefined` — including an
//   attempt with no essays and a legacy row), D-13/O-8/F-06 (TWO fields, not one),
//   AC-012 (Output Comparison pipeline 3).
// @lane: integration
// @dependency: SOURCE/features/history/queries.ts (listMyHistory) + REAL
//   SOURCE/lib/scoring/essayLifecycle.ts + mocked Supabase client
// @real-dependency: none — the same sanctioned createClient() boundary as Test 1.
//
// Gate D is what makes this select shape legitimate rather than a judgement call:
// measured at 375 B/row without `per_question, created_at` and 3 401 B/row with
// them (≈9.1×, largest single row 5 385 B), engineer decision D3 = ACCEPT, with
// the 500-row ceiling recorded as the trigger for PAGINATION rather than for a
// bigger number. The RPC alternative was considered and REJECTED — choosing it
// here would be DDL, reopening a closed escalation.
//
// TIME IS FROZEN for the same reason as in getResult.int.test.ts: the deadline is
// 600 000 ms with an exclusive boundary, and a real clock makes these cases green
// today and red on an afternoon nobody touched them.

const HISTORY_NOW = new Date("2026-08-29T12:00:00.000Z");
const HISTORY_CREATED_AT = "2026-08-29T11:59:00.000Z"; // one minute old — inside the deadline

/** A stored `per_question` element with no `essay*` key — the legacy shape. */
const HISTORY_LEGACY_ELEMENT = {
  questionId: "q-mcq",
  selected: "A",
  correct: "A",
  isCorrect: true,
  scored: true,
};

function historyEssayElement(overrides: Record<string, unknown> = {}) {
  return {
    questionId: "q-essay",
    selected: "Bài làm của học sinh.",
    isCorrect: false,
    scored: false,
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
    ...overrides,
  };
}

/** One joined row in PostgREST's embedded shape, now carrying the two columns
 *  Gate D authorised. Deliberately separate from Test 1's `joinedRow`: that
 *  helper predates this task and Test 1's fixtures must not start depending on
 *  essay data to keep passing. */
function joinedEssayRow(o: {
  attemptId: string;
  submittedAt: string;
  perQuestion: unknown[] | null;
  createdAt?: string;
}) {
  return {
    attempt_id: o.attemptId,
    total_score: 7,
    correct: 3,
    total: 4,
    per_question: o.perQuestion,
    created_at: o.createdAt ?? HISTORY_CREATED_AT,
    exam_attempts: {
      exam_id: "exam-9",
      started_at: "2026-08-29T11:00:00.000Z",
      submitted_at: o.submittedAt,
      exams: { title: "Đề Văn giữa kỳ", subject: "Ngữ văn" },
    },
  };
}

describe("listMyHistory — per_question + created_at in the select and the two required essay booleans (Test 2)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(HISTORY_NOW);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  function mockRows(rows: unknown[]) {
    const joinBuilder = createQueryBuilder({ data: rows, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_results") return joinBuilder.builder;
      throw new Error(`unexpected table: ${table}`);
    });
    return joinBuilder;
  }

  it("the select carries BOTH per_question and created_at — the shape Gate D priced and accepted", async () => {
    const { calls } = mockRows([
      joinedEssayRow({ attemptId: "a", submittedAt: "2026-08-29T11:50:00.000Z", perQuestion: [] }),
    ]);

    await listMyHistory();

    const selectArg = calls.find((c) => c.method === "select")?.args[0] as string;
    expect(selectArg).toContain("per_question");
    // `created_at` is the half most likely to be forgotten, because the booleans
    // still compute without it — they just compute against `undefined`, and an
    // overdue pending question is then classified as still-pending here while
    // /result calls it RS-6. That is INT-2's primary failure mode, and it is
    // INVISIBLE to any assertion made on mapped output alone.
    expect(selectArg).toContain("created_at");
    // The pre-existing projection is untouched — this is additive.
    expect(selectArg).toContain("attempt_id, total_score, correct, total");
    expect(selectArg).toContain("exam_attempts!inner(");
  });

  it("EG-BE-035: both booleans are REAL booleans in all four shapes — RS-6, essay-free, legacy, and a null per_question", async () => {
    mockRows([
      // RS-6: failed AND out of retries ⇒ incomplete, and NOT unresolved.
      joinedEssayRow({
        attemptId: "a-rs6",
        submittedAt: "2026-08-29T11:54:00.000Z",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 3 })],
      }),
      // No essay question at all.
      joinedEssayRow({
        attemptId: "a-no-essay",
        submittedAt: "2026-08-29T11:53:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
      // Legacy: an essay-looking row from before the feature shipped — the
      // element is there, the lifecycle keys are not.
      joinedEssayRow({
        attemptId: "a-legacy",
        submittedAt: "2026-08-29T11:52:00.000Z",
        perQuestion: [{ questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false }],
      }),
      // A row whose per_question column is null outright.
      joinedEssayRow({
        attemptId: "a-null",
        submittedAt: "2026-08-29T11:51:00.000Z",
        perQuestion: null,
      }),
    ]);

    const entries = await listMyHistory();

    // `typeof === "boolean"` on EVERY entry, not just "the values look right":
    // `undefined` is falsy, so a bug in this direction renders correctly today
    // and surfaces the first time anything does a strict comparison — or, worse,
    // the first time the PDF pipeline has to decide an annotation from it.
    for (const entry of entries) {
      expect(typeof entry.hasUnresolvedEssay).toBe("boolean");
      expect(typeof entry.hasIncompleteEssay).toBe("boolean");
    }

    const byId = Object.fromEntries(entries.map((e) => [e.attemptId, e]));
    // D-13 / O-8 / F-06: the two fields are STRUCTURALLY exclusive — `unresolved`
    // requires retries left, `incomplete` requires them exhausted. This row is
    // the proof that one boolean could not have carried both answers.
    expect(byId["a-rs6"].hasIncompleteEssay).toBe(true);
    expect(byId["a-rs6"].hasUnresolvedEssay).toBe(false);
    for (const id of ["a-no-essay", "a-legacy", "a-null"]) {
      expect(byId[id].hasIncompleteEssay).toBe(false);
      expect(byId[id].hasUnresolvedEssay).toBe(false);
    }
  });

  it("EG-BE-034: hasUnresolvedEssay equals (summariseEssays(...)?.unresolvedCount ?? 0) > 0 on the same fixtures", async () => {
    // Two derivations of one truth, held against each other. This is the pin that
    // stops them drifting — the shape of defect F-06, which this feature's own
    // review history already caught once.
    const fixtures: Array<{ id: string; perQuestion: unknown[] }> = [
      { id: "f-pending", perQuestion: [historyEssayElement()] },
      {
        id: "f-retryable",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 1 })],
      },
      {
        id: "f-exhausted",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 3 })],
      },
      {
        id: "f-graded",
        perQuestion: [
          historyEssayElement({ essayState: "graded", essayEarned: 1, essayMax: 1 }),
        ],
      },
      { id: "f-none", perQuestion: [HISTORY_LEGACY_ELEMENT] },
    ];

    mockRows(
      fixtures.map((f, i) =>
        joinedEssayRow({
          attemptId: f.id,
          submittedAt: `2026-08-29T11:${50 - i}:00.000Z`,
          perQuestion: f.perQuestion,
        }),
      ),
    );

    const entries = await listMyHistory();
    const byId = Object.fromEntries(entries.map((e) => [e.attemptId, e]));

    for (const f of fixtures) {
      const expected =
        (summariseEssays(
          f.perQuestion as Parameters<typeof summariseEssays>[0],
          HISTORY_CREATED_AT,
          HISTORY_NOW,
        )?.unresolvedCount ?? 0) > 0;
      expect(byId[f.id].hasUnresolvedEssay).toBe(expected);
    }
    // A positive control: at least one fixture must be `true`, or the loop above
    // would pass for an implementation that returns `false` unconditionally.
    expect(entries.some((e) => e.hasUnresolvedEssay)).toBe(true);
  });

  it("AC-012 pipeline 3: legacy rows produce a hand-built MyHistoryEntry[] literal, in unchanged submittedAt-descending order", async () => {
    // Deliberately fed OUT of order so the ordering assertion is not satisfied by
    // the mock's own arrangement.
    mockRows([
      joinedEssayRow({
        attemptId: "older",
        submittedAt: "2026-08-29T10:00:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
      joinedEssayRow({
        attemptId: "newer",
        submittedAt: "2026-08-29T11:30:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
    ]);

    const entries = await listMyHistory();

    // The whole array against a literal authored by hand: all nine pre-existing
    // fields, plus the two new booleans as `false`, newest first.
    expect(entries).toEqual([
      {
        attemptId: "newer",
        examId: "exam-9",
        examTitle: "Đề Văn giữa kỳ",
        subject: "Ngữ văn",
        totalScore: 7,
        startedAt: "2026-08-29T11:00:00.000Z",
        submittedAt: "2026-08-29T11:30:00.000Z",
        correct: 3,
        total: 4,
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
      {
        attemptId: "older",
        examId: "exam-9",
        examTitle: "Đề Văn giữa kỳ",
        subject: "Ngữ văn",
        totalScore: 7,
        startedAt: "2026-08-29T11:00:00.000Z",
        submittedAt: "2026-08-29T10:00:00.000Z",
        correct: 3,
        total: 4,
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
    ]);

    // UI-D11: the raw jsonb stops at this function. An exhaustive key set is the
    // only assertion that catches `per_question` being passed through by a
    // spread someone added later for convenience.
    expect(Object.keys(entries[0]).sort()).toEqual([
      "attemptId",
      "correct",
      "examId",
      "examTitle",
      "hasIncompleteEssay",
      "hasUnresolvedEssay",
      "startedAt",
      "subject",
      "submittedAt",
      "total",
      "totalScore",
    ]);
  });

  it("the row ceiling is unchanged at 500, and an unrecognised essayState warns ONCE per element, not once per predicate", async () => {
    const { calls } = mockRows([
      joinedEssayRow({
        attemptId: "a-broken",
        submittedAt: "2026-08-29T11:40:00.000Z",
        perQuestion: [historyEssayElement({ essayState: "in_review" })],
      }),
    ]);

    const entries = await listMyHistory();

    // Scope boundary: this task must not move the ceiling. `readBounded` asks for
    // ceiling + 1 so it can DETECT the overflow rather than silently truncate.
    expect(LIST_ROW_CEILING).toBe(500);
    const limitArg = calls.find((c) => c.method === "limit")?.args[0];
    expect(limitArg).toBe(LIST_ROW_CEILING + 1);

    // Both predicates fold the array themselves, so the naive call site would
    // derive this element twice and warn twice — per row, on every /history
    // render. Same defect the sibling read path had, same fix.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warnSpy.mock.calls[0])).not.toContain("Bài làm của học sinh");
    expect(entries[0].hasUnresolvedEssay).toBe(false);
    expect(entries[0].hasIncompleteEssay).toBe(false);
  });
});
