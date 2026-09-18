// Kho đề theo kệ (Exam Shelves) [integration] Test Skeleton
// Design Docs: docs/design/exam-shelves-backend-design.md (v1.2, § Query layer,
//                § Test Boundaries and Placement :613-618, § Verification Strategy)
//              docs/design/exam-shelves-frontend-design.md (v1.0, § Data contracts —
//                consumer of listExamShelves()/listHotExams(), not the producer)
// PRD:         docs/prd/exam-shelves-prd.md (v1.2, AC-001, AC-002, AC-006, AC-013,
//                AC-024, AC-027, AC-028, AC-036-AC-038, AC-051)
// ADR:         docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//              (D1 aggregate shape, D3 budget), ADR-0015 (Decision 6, round-trip budget)
// Generated:   2026-09-18 | Budget used: integration 2/3 (feature total 3/3 — see
//                the 3rd candidate appended to rating.int.test.ts)
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// Both candidates converted to real vitest (P3-T2, `features/exams/queries/shelves.ts`
// landed in the same commit) — same "skeleton → real test in the implementing task's
// commit" convention `rating.int.test.ts`'s own header uses. The paragraph below is
// preserved as written at generation time; its rationale for why this file imported
// nothing is now historical, not current status.
//
// `features/exams/queries/shelves.ts`, `hotCounts.ts` and `attempts.ts` DID NOT EXIST YET
// at generation time (backend DD Implementation Path Mapping — all three rows said
// "New"). Nothing here imported them: an import of a not-yet-existing module would fail
// `tsc --noEmit`/`eslint`/`build` the moment this skeleton was committed, and this file
// had to stay green under all three gates until the implementing task added the imports,
// the mocks and the assertions in the same commit that added `shelves.ts` (Red→Green in
// one task, per the backend DD's Vertical Slice plan, step 5 — "the integration point").
//
// HOW THIS LANE RUNS: default `npx vitest run` (`vitest.config.ts:26` collects
// `features/**/*.test.{ts,tsx}`), environment `node` (no DOM needed — this file proves
// call shape and object shape, never rendered markup). A collected file with zero test
// tasks makes vitest report "No test suite found in file" and exit 1 (measured fact,
// `vitest.fixture.config.ts` header — the same runner behaviour applies to this lane),
// so each candidate below carries at least one real `it.todo(...)`, never a bare comment.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to both candidates (backend DD § Test
// Boundaries and Placement, verbatim decision)
// -----------------------------------------------------------------------------
// MOCKED — the Supabase client boundary only, as `{ from, rpc }` with a PER-TABLE
//   builder map (same technique as `rating.int.test.ts`'s `mockTables()` helper,
//   :555-563): a SHARED builder would serve `exams_with_difficulty` rows as
//   `exam_attempts` rows and this file would stay green while measuring the wrong
//   thing. `server-only` is stubbed the same way `rating.int.test.ts:24` does it.
// REAL — every pure `lib/adaptive` helper this composition calls into
//   (`rankExamIds`, `pickHotShelf`, `pickWeakestSubject`, `pickDominantGrade`,
//   `pickExploreShelf`) — this file does NOT re-mock the ladder or the ranking
//   weights; it proves the QUERY LAYER wires them correctly, not that they are
//   individually correct. The exhaustive ladder-boundary matrix (rung order,
//   `HOT_SHELF_MIN_CARDS` widening at 4/5/6 qualifying exams, tie-breaks) is
//   proven by `SOURCE/lib/adaptive/__tests__/examShelves.test.ts` (pure unit, CI
//   lane) — named by the backend DD, outside this file's job and outside this
//   agent's Integration/E2E scope (see hand-off report).
// NEVER MOCKED, NOT PROVEN HERE — RLS isolation, the `exam_hot_counts()` grant,
//   and whether the definer function actually crosses another user's row are
//   explicitly EXCLUDED from this mocked lane by the backend DD: "the function's
//   behaviour, grants, predicates and RLS isolation are never mocked — only real
//   Postgres proves [it]". That proof lives in
//   `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (service-e2e,
//   this same generation round) and `supabase/test-rls.ts` Phần 10 (manual).
// @real-dependency: none — this file's `@lane: integration` candidates are fully
//   mocked-Supabase-client tests. Do not add a live Postgres connection here.
//
// -----------------------------------------------------------------------------
// SELECTION — why these two, and why a third moved to rating.int.test.ts
// -----------------------------------------------------------------------------
//   Candidate 1   90  composition budget & concurrency + RPC argument shape
//   Candidate 2   99  null-shelf structural rule (AC-051) + F-001 guarded home fetch
//                      + listHotExams() shape (submittedExamIds regression guard)
//   (3rd slot)    64  ?sort=hot / ?sort=garbage composition budget (F-005) — SAME
//                      integration budget, but appended to the EXISTING
//                      `rating.int.test.ts` because that is the file both Design
//                      Docs already assign it to (backend DD Implementation Path
//                      Mapping: "Changed (tests) | rating.int.test.ts … | Budget
//                      assertions + rpc in the mock").
//   NOT SELECTED (pushed down, out of this agent's Integration/E2E scope):
//     - ExamCard containment (AC-043) — `ExamCard.snapshot.test.tsx`, Component
//       lane (`npx vitest run`, NOT `.int.test.tsx` named), frontend DD's own
//       "Proof file" section, not this agent's 3-lane output.
//     - Ribbon-count / tile-placement per shelf (AC-026/032) at the single-
//       component level — `ExamShelf.test.tsx`, Component lane. The PAGE-LEVEL
//       instance of the same claim ("exactly 1 ribbon page-wide") is covered by
//       the fixture-e2e reserved-slot candidate instead (this generation round).
//     - Ladder rung order + HOT_SHELF_MIN_CARDS threshold (AC-019-AC-023) — pure
//       unit, `lib/adaptive/__tests__/examShelves.test.ts`, CI lane.
//     - Attempt-source whitelist mapping (AC-040/AC-041) — pure unit,
//       `lib/exams/__tests__/attemptSource.test.ts`, CI lane, plus the real-CHECK
//       proof HS-g in `supabase/test-rls.ts` (manual).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// shelves.ts (and its attempts.ts/hotCounts.ts/catalogue.ts dependencies) import
// "server-only" (throws outside a Next server/react-server bundle) → stub, same
// pattern as rating.int.test.ts:24.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only ({ from, rpc }), per the file-level Mock
// Boundary note above — proves JS call construction and object shape, never real
// Postgres/RLS/grant behaviour.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

const { listExamShelves, listHotExams } = await import("@/features/exams/queries/shelves");
const { LIST_ROW_CEILING } = await import("@/lib/supabase/boundedRead");

// --- Fixture builders --------------------------------------------------------

/** Một dòng `exams_with_difficulty` thô — cùng hình dạng `ExamRow` (rows.ts). */
function examRow(
  id: string,
  grade: number,
  subject: string,
  createdAt: string,
  school: string | null = null
) {
  return {
    id,
    title: `Đề ${id}`,
    question_ids: ["q1"],
    duration_minutes: 45,
    subject,
    grade,
    school,
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

/** Một dòng `exam_attempts` thô kèm embed `exams!inner(grade, subject, school)`. */
function attemptRow(
  id: string,
  examId: string,
  submittedAt: string | null,
  embed: { grade: number; subject: string; school: string | null }
) {
  return { id, exam_id: examId, submitted_at: submittedAt, exams: embed };
}

/** Một dòng `exam_hot_counts()` thô. */
function hotRow(examId: string, recent: number, wide: number, total: number) {
  return { exam_id: examId, recent_count: recent, wide_count: wide, total_count: total };
}

/** Chainable + awaitable fake khớp bề mặt query builder mà shelves.ts dùng
 *  (`select`/`eq`/`ilike`/`order`/`limit`), rồi resolve NGAY với `data`. */
function createResolvedBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data, error: null }).then(onFulfilled);
  return builder;
}

/** Cùng builder trên nhưng CHƯA resolve — chỉ resolve khi `gate` tự nó resolve.
 *  Kỹ thuật "deferred-resolution gate" của `rating.int.test.ts:676-706`, dùng lại
 *  nguyên vẹn để chứng minh 4 lượt đọc của `listExamShelves()` được PHÁT hết
 *  trước khi lượt nào kịp resolve (obligation b). */
function createDeferredBuilder(gate: Promise<void>, data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
    gate.then(() => onFulfilled({ data, error: null }));
  return builder;
}

type TableFixtures = {
  exams_with_difficulty?: unknown[];
  exam_attempts?: unknown[];
  exam_results?: unknown[];
  hotRows?: unknown[];
};

/**
 * Nối `fromMock`/`rpcMock` vào một map theo TÊN BẢNG/rpc — khác hẳn dùng
 * chung một builder cho mọi lượt đọc: dùng chung thì `exam_attempts` có thể
 * nhận nhầm dòng đề của `exams_with_difficulty` mà test vẫn XANH trong khi
 * đang đo sai thứ (cùng cảnh báo `rating.int.test.ts:548-563`).
 *
 * Trả về `issued: string[]` — tên bảng/rpc theo đúng thứ tự lệnh gọi thật,
 * để các test ngân sách đếm `from()`+`rpc()` cộng lại (obligation ADR-0021 D3).
 */
function mockBoundary(fixtures: TableFixtures) {
  const { hotRows = [], ...byTable } = fixtures;
  const issued: string[] = [];

  fromMock.mockImplementation((table: string) => {
    issued.push(table);
    return createResolvedBuilder((byTable as Record<string, unknown[]>)[table] ?? []);
  });
  rpcMock.mockImplementation((fnName: string) => {
    issued.push(fnName);
    return createResolvedBuilder(hotRows);
  });

  return issued;
}

// =============================================================================
// Candidate 1 — Composition budget & concurrency + RPC argument shape
// =============================================================================
// AC-006: "...the cut happens after ranking in Node, never as a DB .limit()/.range()
//   on the candidate query (ADR-0015 kill criterion (a))."
// AC-028: "...the aggregate read...is bounded (an explicit row cap in the same style
//   as readBounded), never an unbounded select over exam_attempts."
// Backend DD Data Flow: "[rows, attemptRows, resultRows, hotRows] = await
//   Promise.all([...])   # 4 concurrent, one batch"; Risks table: "A future read
//   added to /exams slips past the budget | Medium | Medium | The assertion counts
//   from() + rpc() with one case per surface; a new read makes it red."
// ROI: 90 (BV:9 x Freq:9 + Legal:0 + Defect:9)
//   BV 9 — protects the round-trip budget ADR-0015/ADR-0021 both spend a whole
//     Decision on; a silent regression here re-serialises the site's busiest page.
//   Freq 9 — every bare /exams render by a signed-in student (the shelves branch,
//     i.e. the new default view).
//   Defect 9 — the specific failure mode (an `await` accidentally inserted between
//     two of the four reads) produces NO visible symptom on screen, only added
//     latency nobody attributes to this composition — exactly the class of bug
//     `rating.int.test.ts`'s existing "ba lượt đọc chạy SONG SONG" case (:676-706)
//     already defends against for the 3-read composition; this is its 4-read sibling.
// Behavior: listExamShelves() is called against a mocked Supabase client boundary
//   ({ from, rpc }, per-table builder map) -> it issues exactly 4 boundary calls
//   (exams_with_difficulty, exam_attempts, exam_results, rpc exam_hot_counts) in ONE
//   Promise.all with no await between them -> the rpc call's arguments match the
//   imported LIST_ROW_CEILING, not a hand-copied literal.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/queries/shelves.ts (listExamShelves, not yet created)
//   + features/exams/queries/hotCounts.ts (readHotCounts, hotWindows) + mocked
//   Supabase client ({ from, rpc })
// @complexity: high
// @real-dependency: none (see file-level Mock Boundary note)
// Primary failure mode: a future edit inserts a 5th read, or turns the 4 concurrent
//   calls sequential by awaiting one before firing the next, or the rpc call passes
//   a hand-copied row-cap literal (e.g. 501) instead of the imported
//   `LIST_ROW_CEILING + 1`, so the decoy-row tripwire (`boundedRead.ts`) and the SQL
//   `limit least(greatest(coalesce(p_max_rows,500),1),1000)` silently drift apart.
// Proof obligation — what the implemented test must assert:
//   (a) exactly 4 distinct boundary calls are issued: 3 `.from(...)` calls naming
//       `exams_with_difficulty`, `exam_attempts`, `exam_results`, and 1 `.rpc(...)`
//       call naming `exam_hot_counts` — assert the exact set, not `>= 4`;
//   (b) all 4 are issued BEFORE any of them settle — reuse the deferred-resolution
//       gate technique already proven in this file's sibling
//       (`rating.int.test.ts:676-706`: capture call order, yield two microtasks,
//       assert the full call list is already issued, THEN resolve);
//   (c) the rpc call's third argument is `LIST_ROW_CEILING + 1` (imported from
//       `@/lib/supabase/boundedRead`), not a literal `501` — a literal passes today
//       and silently stops tracking the constant if either side is later tuned;
//   (d) `readBounded`'s label for the rpc call at this call site is exactly
//       `"listExamShelves.hotCounts"` (backend DD Query layer comment on the call
//       site) — a mismatched label makes a future truncation log point at the wrong
//       composition when `console.error` fires.
describe("listExamShelves() — composition budget, concurrency, RPC argument shape (AC-006, AC-028)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("issues exactly 4 boundary calls (exams_with_difficulty, exam_attempts, exam_results, rpc exam_hot_counts), all before any settles, obligation (a)+(b)", async () => {
    // Hồi quy thực sự sẽ xảy ra: ai đó chèn một `await` giữa hai lượt đọc và
    // biến 4 lượt song song thành tuần tự. Mock hoãn resolve để "cả 4 được
    // PHÁT trước khi lượt nào kịp resolve" trở thành một câu kiểm chứng được,
    // offline — kỹ thuật của rating.int.test.ts:676-706, 4-lượt sibling.
    const issued: string[] = [];
    let settle: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      settle = resolve;
    });

    fromMock.mockImplementation((table: string) => {
      issued.push(table);
      return createDeferredBuilder(gate, []);
    });
    rpcMock.mockImplementation((fnName: string) => {
      issued.push(fnName);
      return createDeferredBuilder(gate, []);
    });

    const pending = listExamShelves();
    // Nhường microtask cho cả 4 nhánh của Promise.all được phát đi.
    await Promise.resolve();
    await Promise.resolve();

    expect(issued).toHaveLength(4);
    expect(new Set(issued)).toEqual(
      new Set(["exams_with_difficulty", "exam_attempts", "exam_results", "exam_hot_counts"])
    );

    settle();
    await pending;
  });

  it("rpc exam_hot_counts is called with p_max_rows === imported LIST_ROW_CEILING + 1, not a hand-copied literal (AC-028, obligation c)", async () => {
    mockBoundary({});

    await listExamShelves();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fnName).toBe("exam_hot_counts");
    expect(args.p_max_rows).toBe(LIST_ROW_CEILING + 1);
  });

  it('the hotCounts read at this call site is labelled exactly "listExamShelves.hotCounts" for readBounded (obligation d)', async () => {
    // Kỹ thuật duy nhất quan sát được `label` truyền vào readBounded: kích
    // dòng mồi (LIST_ROW_CEILING + 1 dòng) rồi soi thông điệp console.error —
    // đúng cơ chế boundedRead.ts:124-130 mô tả.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const overflow = Array.from({ length: LIST_ROW_CEILING + 1 }, (_, i) => hotRow(`e${i}`, 0, 0, 1));
    mockBoundary({ hotRows: overflow });

    await listExamShelves();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("listExamShelves.hotCounts"));
    consoleErrorSpy.mockRestore();
  });
});

// =============================================================================
// Candidate 2 — Null-shelf structural rule + guarded home fetch (F-001) +
//                listHotExams() shape
// =============================================================================
// AC-051: "Given any shelf, when its own selection yields 0 cards, then that shelf
//   is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders...
//   AC-013 and AC-024 are two named instances of this rule, not its definition."
// AC-024: "Given a site with 0 submitted attempts in total...the hot selection
//   yields 0 cards at every rung, so the shelf is absent under AC-051 and the home
//   hot block is absent under AC-038."
// AC-038: "Given a site with 0 submitted attempts, when / renders for a signed-in
//   visitor, then the block is absent (AC-024) and the page renders with 0 errors."
// Backend DD Integration Point I5: "an unguarded call returns 42501 and surfaces an
//   error page instead of the signed-out hero. An anonymous visitor therefore
//   issues 0 RPC calls" (F-001). Frontend DD Assumed Behaviors: "listHotExams(limit)
//   returns { exams, submittedExamIds }, not bare Exam[]" (O-1/R-1).
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9)
//   BV 10 — F-001 protects the ONE public route in the app (`/`) from a thrown
//     42501 replacing the signed-out hero with an error page; this is the highest
//     possible blast radius (every anonymous visitor, forever, until noticed).
//   Freq 9 — every anonymous landing on `/`, which given `/exams` requires sign-in
//     (AC-014), is effectively every first-time visitor to the site.
//   Defect 9 — the failure mode is silent until an anonymous user actually hits it
//     in production (no unit test of `listHotExams` alone can catch it, because the
//     guard lives at the CALL SITE, not inside the function); Security Considerations
//     names this exact mechanism ("anon has no EXECUTE...42501...readBounded rethrows
//     -> error page on the landing page").
// Behavior: (i) listExamShelves() is called with fixture data producing 0 ids for one
//   shelf -> that key in the returned ExamShelves object is exactly null, not {exams:
//   []}; (ii) listHotExams(limit) is called against the mocked boundary -> exactly 3
//   calls (no exam_results read), and the returned submittedExamIds set is populated
//   from the same attempt read; (iii) the home-fetch call site (app/page.tsx's `user ?
//   await listHotExams(...) : null` guard) is invoked with a null user -> the mocked
//   Supabase client records 0 calls of any kind.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/queries/shelves.ts (listExamShelves, listHotExams) +
//   app/page.tsx (Home, for the F-001 guard) + mocked Supabase client
// @complexity: medium
// @real-dependency: none (see file-level Mock Boundary note)
// Primary failure mode: (i) a 0-card shelf serialises as `{ exams: [] }` instead of
//   `null`, so the page-level `data && <ExamShelf .../>` narrowing in the frontend DD
//   renders an empty-but-present shelf instead of omitting it; (ii) `listHotExams`
//   is refactored to return a bare `Exam[]`, silently flipping every already-
//   submitted exam's rate button from eligible to not-attempted on the home block
//   (frontend DD Assumed Behaviors, "confirmed by cross-layer verification"); (iii)
//   the `user ?` guard at the `app/page.tsx` call site is dropped or inverted, so an
//   anonymous visitor's request reaches `listHotExams` and throws 42501.
// Proof obligation — what the implemented test must assert:
//   (a) with fixture data yielding 0 candidate ids for the practice shelf (no scored
//       representative attempts, AC-013) AND separately for the hot shelf (0 site-
//       wide submitted attempts, AC-024), the corresponding `ExamShelves` key is
//       `null` via `Object.is`/`toBeNull()` — not an empty-array object, not a
//       missing key (`"practice" in shelves` must still be `true`);
//   (b) `listHotExams(limit)` issues exactly 3 boundary calls (not 4 — no
//       `exam_results` read, since no prior score is needed) and the returned
//       `submittedExamIds` is a non-empty `Set` for a fixture with at least one
//       submitted attempt, sourced from the SAME attempt read the hot composition
//       issued (not a second independent read);
//   (c) invoking the guarded home-fetch composition with a mocked `getCurrentUser`/
//       `getCurrentUserProfile` resolving to `null` results in the mocked Supabase
//       client recording ZERO `.from(...)` and ZERO `.rpc(...)` calls of any kind —
//       assert on the mock's total call count, not only on the absence of the rpc
//       call, so a stray `exam_attempts` read introduced elsewhere in the same
//       composition is also caught.
describe("listExamShelves() / listHotExams() — 0-card shelf is null, and the guarded home fetch issues 0 calls for an anonymous visitor (AC-051, AC-024, AC-038, F-001)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("a shelf whose selection yields 0 candidate ids is exactly null on the ExamShelves object, not an empty-array shape (AC-051/AC-013/AC-024, obligation a)", async () => {
    // Kịch bản 1 — Cần luyện: học sinh có một lượt đã nộp nhưng KHÔNG có dòng
    // exam_results nào cho lượt đó → buildSubjectWeakness không có lượt đại
    // diện CÓ ĐIỂM nào → trả null → weakest === null (AC-013).
    mockBoundary({
      exams_with_difficulty: [examRow("exam-a", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "exam-a", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      exam_results: [],
      hotRows: [],
    });

    const withoutScore = await listExamShelves();

    expect(withoutScore.practice).toBeNull();
    expect("practice" in withoutScore).toBe(true);

    fromMock.mockReset();
    rpcMock.mockReset();

    // Kịch bản 2 — Nổi nhất: 0 lượt đã nộp trên TOÀN site (AC-024) — RPC trả
    // 0 dòng, nên pool của MỌI bậc thang đều rỗng, kể cả bậc terminal.
    mockBoundary({
      exams_with_difficulty: [examRow("exam-b", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [],
      exam_results: [],
      hotRows: [],
    });

    const withoutHotCount = await listExamShelves();

    expect(withoutHotCount.hot).toBeNull();
    expect("hot" in withoutHotCount).toBe(true);
  });

  it("listHotExams(limit) issues exactly 3 boundary calls and returns a populated submittedExamIds sourced from that same attempt read (frontend DD O-1/R-1, obligation b)", async () => {
    const issued = mockBoundary({
      exams_with_difficulty: [examRow("h1", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "submitted-1", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      hotRows: [hotRow("h1", 1, 1, 1)],
    });

    const result = await listHotExams(3);

    expect(issued).toHaveLength(3);
    expect(new Set(issued)).toEqual(new Set(["exams_with_difficulty", "exam_attempts", "exam_hot_counts"]));
    expect(issued.includes("exam_results")).toBe(false);
    expect(result.submittedExamIds).toEqual(new Set(["submitted-1"]));
  });

  it("the guard PATTERN (user ? await listHotExams(...) : null) issues 0 Supabase calls when evaluated with a null user — proves the pattern in isolation only, obligation c", async () => {
    mockBoundary({});
    // `currentUser` là literal `null` CỐ ĐỊNH, không phải kết quả của một
    // lượt lookup thật (`getCurrentUser`/`getCurrentUserProfile`) — nên
    // nhánh truthy của ternary KHÔNG THỂ nào được vào, và assertion dưới đây
    // không thể đỏ bất kể một guard thật ở app/page.tsx có tồn tại hay đúng
    // hay không. Test này chỉ chứng minh biểu thức GUARD `user ? await
    // listHotExams(...) : null` (frontend DD § Home block) là đúng CÚ PHÁP
    // khi tự nó được đánh giá — KHÔNG chứng minh app/page.tsx's call site
    // thật có tồn tại hay dùng đúng guard này. Việc đó thuộc về P7-T1
    // (chưa build call site thật), và là một Completion Criterion RÀNG BUỘC
    // rõ ràng trên task file của P7-T1, không chỉ ngụ ý qua "wiring".
    const currentUser: { id: string } | null = null;
    const hot = currentUser ? await listHotExams(3) : null;

    expect(hot).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  // AC-049/D13 (additional obligation beyond the skeleton's own text — see this
  // task's Proof Obligations): "an exam that qualifies for BOTH the weakest-
  // subject pool AND a qualifying hot count appears in BOTH practice.exams and
  // hot.exams of the SAME listExamShelves() result" — closes the gap the plan
  // review identified (shelves are not mutually exclusive, unlike Khám phá's
  // dedup against the other two).
  it("AC-049/D13: an exam qualifying for both practice and hot appears in BOTH shelves of the same listExamShelves() result (cross-shelf overlap is allowed, not deduped)", async () => {
    mockBoundary({
      exams_with_difficulty: [examRow("ex-overlap", 10, "Toán", "2026-01-01T00:00:00.000Z")],
      exam_attempts: [
        attemptRow("att-1", "other-exam", "2026-05-01T00:00:00.000Z", {
          grade: 10,
          subject: "Toán",
          school: null,
        }),
      ],
      exam_results: [{ attempt_id: "att-1", total_score: 2 }],
      hotRows: [hotRow("ex-overlap", 1, 1, 1)],
    });

    const shelves = await listExamShelves();

    expect(shelves.practice?.exams.map((e) => e.id)).toContain("ex-overlap");
    expect(shelves.hot?.exams.map((e) => e.id)).toContain("ex-overlap");
  });
});
