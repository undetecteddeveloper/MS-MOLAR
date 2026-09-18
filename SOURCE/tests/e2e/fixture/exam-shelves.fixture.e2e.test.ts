// @vitest-environment jsdom

// Kho đề theo kệ (Exam Shelves) — FIXTURE-E2E lane skeleton
// Design Docs: docs/design/exam-shelves-frontend-design.md (v1.0, § Test Plan :405-417,
//                "the ONE new fixture file", mock boundary :417)
//              docs/design/exam-shelves-backend-design.md (v1.2, § Implementation Path
//                Mapping — hasBrowseParam(sp), the AC-008/AC-010 branch predicate)
// UI Spec:     docs/ui-spec/exam-shelves-ui-spec.md (v1.1, § Screens S-01/S-02,
//                § Page State Matrix rows #1-#10, § Component: ExamShelf)
// PRD:         docs/prd/exam-shelves-prd.md (v1.2, AC-001-AC-004, AC-007-AC-010,
//                AC-013, AC-026, AC-032, AC-033, AC-051)
// ADR:         docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
// Generated:   2026-09-18 | Budget used: fixture-e2e 2/3 (1 reserved slot + 1
//                additional, ROI >= 20). 3rd slot intentionally left unfilled — no
//                further candidate is both named by the Design Docs' own Test Plan
//                and not already covered elsewhere in this generation round.
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// BOTH CANDIDATES BELOW ARE SKELETONS (`it.todo`). `ExamShelf.tsx`, `ExamRibbon.tsx`,
// `ExamShelfTile`, `features/exams/queries/shelves.ts` and `lib/exams/browseParams.ts`
// DO NOT EXIST YET (frontend DD Existing Codebase Analysis — all rows "New" or
// "External dep"). This file imports NOTHING from them: an import of a not-yet-
// existing module would fail `tsc --noEmit`/`eslint`/`build` the moment this skeleton
// is committed. It must stay green under all three gates until the implementing task
// (frontend DD Implementation Plan slice 5, "the integration point") adds the real
// imports, the route-tree composition and the assertions in the same commit.
//
// HOW THIS LANE RUNS: `npm run test:fixture` (from `SOURCE/`), i.e.
// `vitest run --config vitest.fixture.config.ts`. That config globs the WHOLE
// directory (`tests/e2e/fixture/**/*.test.{ts,tsx}`) and excludes six files BY NAME
// (`vitest.fixture.config.ts:45-52`) — this file is not among them, so it is
// COLLECTED FROM THE MOMENT IT IS COMMITTED and needs no config edit. A collected
// file with zero test tasks makes vitest report "No test suite found in file" and
// exit 1 (measured fact, recorded in that config's own header comment) — this is
// exactly why both candidates below carry real `it.todo(...)` calls, never bare
// comments, and why this file must NOT be added to that config's exclude list.
//
// Line 1 above is `// @vitest-environment jsdom` — `vitest.fixture.config.ts:43` sets
// `environment: "node"`, and `renderServerTree()` needs `document`. Precedent:
// `essay-auto-scoring.fixture.e2e.test.ts:1`, `RichText.regression.test.tsx:1`.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to both candidates (frontend DD § Test Plan,
// "Mock boundary" row, verbatim decision)
// -----------------------------------------------------------------------------
// MOCKED — `listExamShelves`, `listExamFacets`, `getCurrentUser` (hand-built
//   fixtures, per frontend DD).
// UNREACHED — `features/exams/actions` (no attempt is ever started from this
//   lane — clicking is not available under `renderServerTree()` anyway, see
//   hazard note below; the composed render tree never reaches this module, so
//   it is not mocked).
// REAL — `lib/copy.ts` and every dictionary lookup (assertions read resolved
//   Vietnamese strings, e.g. `copy["exams.shelfHotTitle"]`, never a raw key or an
//   English literal); `ExamShelf`, `ExamCard`, `ExamRibbon`, `ExamFilters`, both
//   `ExamBrowser` layouts, `subjectLabel`, `hasBrowseParam` (imported for real so
//   the branch predicate under test is the SAME code the page calls, not a
//   hand-copied re-implementation of the ten-key list).
// NO DATABASE, NO NETWORK, NO MSW — this lane needs neither `HAS_LIVE_DB` nor any
//   live Supabase credential; it proves UI composition against fixture data only.
// @real-dependency: none.
//
// -----------------------------------------------------------------------------
// ONE HAZARD THAT MAKES A GREEN CASE MEANINGLESS — read before writing assertions
// -----------------------------------------------------------------------------
// EMPTY-TREE VACUOUS PASS. `render(await Component())` returns an EMPTY TREE when
// the awaited server component has an async child, and every
// `expect(queryBy…).toBeNull()` written against it PASSES AGAINST NOTHING.
// `ExamsPage`, `ExamShelf` and `ExamCard` are all async AND `ExamCard` renders the
// async `AuthorByline`, so this file lands squarely in the hazard the frontend DD's
// own Containment Rule section names. Every case below MUST use
// `renderServerTree()` (import verbatim: `import { renderServerTree } from
// "@/tests/helpers/renderServerTree";` — NOT the stale path some older fixture
// files' comments quote) AND carry at least one POSITIVE assertion (a shelf title
// or a card title actually found in the tree) before any negative assertion, so an
// empty tree is always red, never a silent pass.
//
// -----------------------------------------------------------------------------
// SELECTION — why these two
// -----------------------------------------------------------------------------
//   Candidate 1  109  bare /exams = 3 shelves ⇄ any listed param = flat grid   <- RESERVED
//                      (highest-ROI user-facing multi-step journey: S-01 ⇄ S-02,
//                      state = URL param presence, completion point = the correct
//                      branch rendered — UI Spec stateDiagram-v2). Emitted
//                      regardless of threshold; it also clears it by a wide margin.
//   Candidate 2   56  a shelf whose selection yields 0 cards is entirely absent
//                      at the rendered page level (AC-051/AC-013)             <- additional,
//                      ROI 56 >= 20 floor.
//   NOT SELECTED (out of this agent's scope, or already covered elsewhere):
//     - ExamCard containment byte-identity (AC-043) — Component lane,
//       `ExamCard.snapshot.test.tsx`, not `.int.`/`.fixture.e2e.`/`.service.e2e.`
//       named; see hand-off report.
//     - Home page (`/`) guarded fetch (F-001, AC-036-038) — frontend DD's own Test
//       Plan names NO fixture-e2e file for the home block; F-001 is proven at the
//       Integration lane instead (`shelves.int.test.ts` Candidate 2, this same
//       generation round) per backend DD's own assignment.
//     - Keyboard reachability (AC-047) — Success Criteria #8, a recorded MANUAL
//       pass (keyboard + TalkBack); this repo has no axe dependency and none is
//       added (frontend DD Quality Assurance Mechanisms).

import { describe, expect, it, vi } from "vitest";

// =============================================================================
// MOCK BOUNDARY (implementation) — data sources per the frontend DD's Test Plan
// declaration, plus the framework shims and the two Server Action modules
// reached (never invoked — no click is possible under `renderServerTree()`) via
// SiteHeader's/SupportWidget's static imports. Same composition shape as
// `essay-auto-scoring.fixture.e2e.test.ts`, the one other case in this lane
// that actually executes today (D005) — mirrored closely rather than
// reinvented, since it is the sole proven precedent for RootLayout -> (exams)
// layout -> page in this repo.
// =============================================================================

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? "",
    className: "",
  });
  return { Lexend: font };
});
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
// `ExamFilters` (client, renders on BOTH branches) and `SiteHeader`/`BottomNav`/
// `SupportWidget` (AppShell) all read these hooks at mount.
vi.mock("next/navigation", () => ({
  usePathname: () => "/exams",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
// SkipLink is an async Server Component — stubbed for the same reason
// `(exams)/__tests__/layout.test.tsx` and `essay-auto-scoring.fixture.e2e.test.ts`
// stub it (outside any assertion this file makes; it sits before the navbar).
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
// Reached only via SiteHeader's static import of HeaderProfile and
// SupportWidget's static import of SupportWidgetDialog. `SupportWidget` itself
// returns `null` for a signed-out user (`user === null` guard,
// `SupportWidget.tsx:40`), so neither module's export is ever called here.
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));

const {
  listExamShelvesMock,
  listExamsRankedMock,
  listExamFacetsMock,
  getCurrentUserMock,
  getCurrentUserProfileMock,
} = vi.hoisted(() => ({
  listExamShelvesMock: vi.fn(),
  listExamsRankedMock: vi.fn(),
  listExamFacetsMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getCurrentUserProfileMock: vi.fn(),
}));

vi.mock("@/features/exams/queries/shelves", () => ({
  listExamShelves: listExamShelvesMock,
}));
vi.mock("@/features/exams/queries", () => ({
  listExamsRanked: listExamsRankedMock,
  listExamFacets: listExamFacetsMock,
}));
// `getCurrentUser` (page.tsx) and `getCurrentUserProfile` (AppShell) share one
// module — both stubbed to a signed-out user so the real, UNMOCKED
// `readEntitlement(null)` takes its zero-I/O fast path (`readEntitlement.ts:61`)
// instead of reaching Supabase/Redis, keeping this lane's NO DATABASE/NO
// NETWORK promise without a third mock. `readEntitlement`/`AppShell` stay REAL
// per the frontend DD's Mock boundary ("both layouts").
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: getCurrentUserMock,
  getCurrentUserProfile: getCurrentUserProfileMock,
}));

import { renderServerTree } from "@/tests/helpers/renderServerTree";
import RootLayout from "@/app/layout";
import Layer2Layout from "@/app/(exams)/layout";
import ExamsPage from "@/app/(exams)/exams/page";
import { copy } from "@/lib/copy";
import type { Exam } from "@/types/exam";

function makeExam(overrides: Partial<Exam> & { id: string }): Exam {
  return {
    title: `Đề ${overrides.id}`,
    questionIds: ["q1"],
    durationMinutes: 45,
    subject: "Math",
    grade: 10,
    ...overrides,
  };
}

const FACETS = { subjects: [], grades: [], schools: [], years: [], semesters: [] };

/** Candidate 1's cold-open fixture — all three shelves qualify. */
const THREE_SHELVES_FIXTURE = {
  practice: {
    subject: "Chemistry",
    exams: [makeExam({ id: "practice-1", subject: "Chemistry" })],
  },
  hot: {
    rung: "grade-recent" as const,
    grade: 10,
    exams: [makeExam({ id: "hot-1" }), makeExam({ id: "hot-2" })],
  },
  explore: {
    exams: [makeExam({ id: "explore-1" }), makeExam({ id: "explore-2" })],
  },
  submittedExamIds: new Set<string>(),
};

/** Candidate 2's cold-start fixture — the SAME hot/explore shelves as
 *  Candidate 1 (skeleton's own "Behavior" note: "the same route-tree
 *  composition as Candidate 1 is rendered, this time with listExamShelves
 *  stubbed to a fixture where the practice shelf's data is null ... while hot
 *  and explore both qualify"); only `practice` differs. */
const COLD_START_FIXTURE = { ...THREE_SHELVES_FIXTURE, practice: null };

/** `pageCount: 2` is load-bearing — `ExamPagination` returns `null` when
 *  `pageCount <= 1` (`ExamPagination.tsx:62`), and obligation (g) requires the
 *  flat-grid case to prove the `<nav>` pagination element is ACTUALLY present,
 *  not merely never asserted against because it never rendered. */
const RANKED_FIXTURE = {
  exams: [makeExam({ id: "ranked-1" }), makeExam({ id: "ranked-2" })],
  page: 1,
  pageCount: 2,
  total: 12,
  submittedExamIds: new Set<string>(),
};

/** Every shelf `<section>` in the tree, in DOM order. */
function shelfSections(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("section[aria-labelledby^='shelf-']"));
}

/** The PAGINATION `<nav>` specifically — `container.querySelector("nav")`
 *  alone is meaningless in this composed route tree: `SiteHeader` carries its
 *  own permanent `<nav aria-label="Điều hướng phụ">` and `BottomNav` its own
 *  `<nav aria-label="...">`, both present on every render regardless of
 *  branch. Only `ExamPagination`'s `<nav>` carries this resolved label. */
function paginationNav(container: HTMLElement): Element | null {
  return container.querySelector(`nav[aria-label="${copy["exams.pagination"]}"]`);
}

async function renderExamsRoute(searchParams: Record<string, string | undefined>) {
  const page = await ExamsPage({ searchParams: Promise.resolve(searchParams) });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

// =============================================================================
// Candidate 1 — RESERVED SLOT (journey). Bare /exams renders three shelves in
// order; any of the ten listed URL parameters — including the parsed-to-undefined
// cases — renders the flat grid instead, and never both
// =============================================================================
// AC-001: "...it contains every shelf that qualifies...and — unconditionally,
//   whatever qualifies — 0 instances of the flat grid and 0 ExamPagination."
// AC-002: "...it contains at most 10 ExamCard elements."
// AC-003: "...DOM order is Cần luyện → Nổi nhất → Khám phá..."
// AC-004: "...it carries its lucide icon..., an h2 title, a subtitle line, and —
//   for Cần luyện and Nổi nhất — a right-aligned Xem tất cả link; the Khám phá
//   shelf ends with the Xem toàn bộ kho đề tile instead."
// AC-007: "...none of them loses or resizes an element relative to today."
// AC-008: "Given a request carrying any one of q, subject, grade, school, year,
//   semester, sort, level, dir, page, when the page renders, then 0 shelf sections
//   appear and ExamBrowser + ExamPagination render exactly as today."
// AC-009/AC-010: "...an unrecognised ?sort= value...renders in today's
//   personalised order...and 0 shelves appear."
// AC-026: "...exactly 1 card (rank 1) carries the ribbon Hot nhất and ranks 2-10
//   carry 0 ribbons."
// AC-032: "...its last item is the Xem toàn bộ kho đề tile..."
// AC-033: "...it contains Bộ lọc, Mới nhất, Cũ nhất, Khó nhất...plus 1 new chip
//   Nổi nhất; the four existing chips gain 0 changed props."
// Frontend DD R-3: "Branch written against the normalised locals instead of raw
//   keys, so ?dir=asc or ?sort=bogus renders shelves | High | Medium | Branch
//   delegates to hasBrowseParam(sp)...the fixture case covers ?sort=hot, and ?dir /
//   ?page=2 are named in AC-010."
// ROI: 109 (BV:10 x Freq:10 + Legal:0 + Defect:9)
//   BV 10 — this IS the feature's primary user surface; the reserved-slot journey
//     per the Multi-Step User Journey Definition (2 distinct route states, state =
//     URL param presence carried across the transition, completion point = the
//     correct branch rendered — UI Spec's own stateDiagram-v2, S01 ⇄ S02).
//   Freq 10 — every signed-in student's default /exams visit, and every filter/
//     sort/search interaction that stands the shelves down.
//   Defect 9 — R-3 is named explicitly as High-impact/Medium-probability, with the
//     EXACT failure mode this candidate is built to catch: a branch predicate
//     written against parsed locals (which are `undefined` for BOTH "absent" and
//     "present but garbage") cannot tell the two apart, so `?sort=garbage`,
//     `?page=abc` and `?dir=asc` would silently render shelves instead of the flat
//     grid — wrong for a URL a user can bookmark, share or hand-edit.
// Behavior: RootLayout -> (exams) layout -> ExamsPage is composed in-process with
//   listExamShelves/listExamFacets/getCurrentUser stubbed to fixture data ->
//   rendered with 0 searchParams -> 3 <section> elements appear in DOM order
//   practice→hot→explore, 0 ExamBrowser <ul> and 0 ExamPagination <nav>, <=10 cards
//   per row, exactly 1 [data-slot="ribbon"] page-wide (on hot rank 1), the Khám phá
//   tile present as the row's last <li> and nowhere else, and the chip row carries
//   4 sort chips including "Nổi nhất" -> the SAME composition is re-rendered, this
//   time with each of a representative param set (?sort=hot, ?sort=garbage,
//   ?page=abc, ?dir=asc) on searchParams -> every one of them renders 0 <section>
//   shelf elements and the ExamBrowser + ExamPagination tree instead.
// @category: core-functionality
// @lane: fixture-e2e
// @dependency: full-UI in-process (RootLayout -> (exams) layout ->
//   app/(exams)/exams/page.tsx), mocked backend (listExamShelves/listExamFacets/
//   getCurrentUser stubs), real hasBrowseParam, real dictionaries
// @complexity: high
// @real-dependency: none
// Primary failure mode: the /exams branch predicate is written against the parsed
//   `sort`/`page`/`dir` locals (each `undefined`/`NaN` for both "absent" and
//   "present but garbage") instead of `hasBrowseParam(sp)`'s raw-key-presence
//   check, so `?sort=garbage`, `?page=abc` or `?dir=asc` renders the shelves branch
//   — a page a user can reach by hand-editing or bookmarking a URL silently shows
//   the wrong surface, with no error and no visual cue that anything is wrong.
// Proof obligation — what the implemented test must assert:
//   (a) POSITIVE FIRST (empty-tree hazard): the bare-/exams render actually
//       produced markup — a shelf `h2` title text (e.g. the resolved
//       `exams.shelfHotTitle`) is found via `getByText`/`container.textContent`.
//       Every assertion below is only meaningful once this one passes.
//   (b) exactly 3 `<section aria-labelledby="shelf-...">` elements in DOM order
//       practice, hot, explore (only the shelves that qualify under the fixture's
//       data are present — construct the fixture so all three qualify for this
//       candidate; the 0-card-shelf case is Candidate 2's job, not this one's);
//   (c) 0 elements matching the flat grid's own list container and 0 `<nav>`
//       pagination element anywhere in the tree (AC-001);
//   (d) each shelf row contains at most 10 `<li>` cards (AC-002), and exactly 1
//       `[data-slot="ribbon"]` exists in the ENTIRE page (AC-026), located inside
//       the first card of the hot shelf — not merely "at least 1";
//   (e) the Khám phá row's last `<li>` is the "Xem toàn bộ kho đề" tile, and no
//       other shelf's row contains that tile (AC-032);
//   (f) the chip row contains exactly 4 sort-chip elements, including one whose
//       resolved text is `exams.sortHot` = "Nổi nhất" (AC-033);
//   (g) TABLE-DRIVEN, same test or a `describe.each`: for EACH of
//       `{ sort: "hot" }`, `{ sort: "garbage" }`, `{ page: "abc" }`, `{ dir: "asc" }`
//       on `searchParams`, re-render the SAME composition and assert 0 `<section>`
//       shelf elements exist and the flat-grid tree (its list container +
//       `<nav>` pagination) is present instead — this is the R-3 regression guard,
//       and `?sort=garbage`/`?page=abc`/`?dir=asc` are the parsed-to-undefined
//       cases a locals-based predicate would get wrong while a raw-key-presence
//       predicate gets right.
describe("Bare /exams renders three shelves; any listed URL parameter renders the flat grid instead, including parsed-to-undefined values (AC-001-004, AC-007-010, AC-026, AC-032, AC-033, R-3)", () => {
  it("bare /exams (0 searchParams): 3 <section> shelves in DOM order practice→hot→explore, 0 flat-grid list, 0 pagination <nav>, <=10 cards/row, exactly 1 ribbon page-wide on hot rank 1, Khám phá tile only as the last <li> of its own row, chip row has 4 chips incl. Nổi nhất (obligations a-f)", async () => {
    listExamShelvesMock.mockResolvedValue(THREE_SHELVES_FIXTURE);
    listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
    listExamFacetsMock.mockResolvedValue(FACETS);
    getCurrentUserMock.mockResolvedValue(null);
    getCurrentUserProfileMock.mockResolvedValue(null);

    const { container } = await renderExamsRoute({});

    // (a) POSITIVE FIRST (empty-tree hazard): a real shelf title actually
    // resolved and rendered, before any negative assertion is trusted.
    expect(container.textContent).toContain(copy["exams.shelfHotTitle"]);

    // (b) exactly 3 shelves, DOM order practice -> hot -> explore (AC-003).
    const sections = shelfSections(container);
    expect(sections.map((s) => s.getAttribute("aria-labelledby"))).toEqual([
      "shelf-practice",
      "shelf-hot",
      "shelf-explore",
    ]);
    const [practiceSection, hotSection, exploreSection] = sections;

    // (c) 0 flat-grid list container, 0 pagination <nav> anywhere (AC-001).
    expect(container.querySelector("ul.grid")).toBeNull();
    expect(paginationNav(container)).toBeNull();

    // (d) <=10 cards per shelf row (AC-002); exactly 1 ribbon page-wide, on
    // the hot shelf's first card (AC-026).
    for (const section of sections) {
      expect(section.querySelectorAll("ul > li").length).toBeLessThanOrEqual(10);
    }
    expect(container.querySelectorAll('[data-slot="ribbon"]')).toHaveLength(1);
    const hotCards = hotSection.querySelectorAll("ul > li");
    expect(hotCards[0].querySelector('[data-slot="ribbon"]')).not.toBeNull();

    // (e) the Khám phá row's last <li> is the "Xem toàn bộ kho đề" tile, and
    // no other shelf's row contains it (AC-032).
    const exploreCards = exploreSection.querySelectorAll("ul > li");
    const lastExploreCard = exploreCards[exploreCards.length - 1];
    expect(lastExploreCard.querySelector('a[href="/exams?page=1"]')).not.toBeNull();
    expect(lastExploreCard.textContent).toContain(copy["exams.shelfViewAllStore"]);
    expect(container.querySelectorAll('a[href="/exams?page=1"]')).toHaveLength(1);
    expect(practiceSection.querySelector('a[href="/exams?page=1"]')).toBeNull();
    expect(hotSection.querySelector('a[href="/exams?page=1"]')).toBeNull();

    // (f) the chip row carries exactly 4 sort chips, incl. Nổi nhất (AC-033).
    const sortChips = container.querySelectorAll("button[aria-pressed]");
    expect(sortChips).toHaveLength(4);
    expect(
      Array.from(sortChips).some((chip) => chip.textContent === copy["exams.sortHot"])
    ).toBe(true);
  });

  it.each([
    { name: "?sort=hot", params: { sort: "hot" } },
    { name: "?sort=garbage", params: { sort: "garbage" } },
    { name: "?page=abc", params: { page: "abc" } },
    { name: "?dir=asc", params: { dir: "asc" } },
  ])(
    "$name renders 0 shelf <section> elements and the flat-grid + pagination tree instead — the parsed-to-undefined R-3 regression guard (obligation g)",
    async ({ params }) => {
      listExamShelvesMock.mockResolvedValue(THREE_SHELVES_FIXTURE);
      listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
      listExamFacetsMock.mockResolvedValue(FACETS);
      getCurrentUserMock.mockResolvedValue(null);
      getCurrentUserProfileMock.mockResolvedValue(null);

      const { container } = await renderExamsRoute(params);

      // POSITIVE FIRST (empty-tree hazard): the flat-grid tree is actually
      // present with real content, not merely "not the shelves".
      const grid = container.querySelector("ul.grid");
      expect(grid).not.toBeNull();
      expect(grid?.textContent).toContain(RANKED_FIXTURE.exams[0].title);
      expect(paginationNav(container)).not.toBeNull();

      // Obligation (g): 0 shelf <section> elements anywhere (R-3 guard).
      expect(shelfSections(container)).toHaveLength(0);
    }
  );
});

// =============================================================================
// Candidate 2 — A shelf whose selection yields 0 cards is absent from the
// rendered page entirely, at every breakpoint the composition renders
// =============================================================================
// AC-051: "Given any shelf, when its own selection yields 0 cards, then that shelf
//   is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders, 0
//   empty cards, 0 errors — and the remaining shelves keep their relative order
//   (D8). AC-013 and AC-024 are two named instances of this rule, not its
//   definition."
// AC-013: "Given a student with 0 submitted attempts, or with submitted attempts
//   but 0 scored representative attempts, when /exams renders, then the Cần luyện
//   selection yields 0 cards and the shelf is absent under AC-051, and Nổi nhất
//   leads."
// UI Spec Page State Matrix row #5: "Signed-in, 0 submitted attempts (no dominant
//   grade) | Nổi nhất → Khám phá | Cần luyện (AC-013) | ..."
// ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
//   BV 8 — this is the PRD's own named cold-start user story ("As a new student
//     with no history, I want a usable page on my first visit, so I am not shown
//     an empty state or a fake diagnosis") — a visible placeholder or a phantom
//     header here is the exact failure that story rules out.
//   Freq 6 — every first-visit / cold-start student, a smaller but PRD-named and
//     structurally distinct segment from the steady-state population Candidate 1
//     already covers.
//   Defect 8 — the failure mode (an empty-but-present `<section>`, or a header
//     with no cards beneath it) is exactly what the frontend DD's discriminated
//     `null`-vs-`{exams:[]}` contract (shelves.int.test.ts Candidate 2, this same
//     generation round) exists to prevent at the data layer; this candidate proves
//     the PAGE actually narrows on it (`data && <ExamShelf .../>`), which a
//     composition-level assertion alone cannot show.
// Behavior: the same route-tree composition as Candidate 1 is rendered, this time
//   with listExamShelves stubbed to a fixture where the practice shelf's data is
//   null (cold-start: 0 scored representative attempts) while hot and explore both
//   qualify -> the page contains 0 elements referencing the practice shelf (no
//   "shelf-practice" id, no `exams.shelfPracticeTitle` text, no dashed placeholder
//   card) and exactly 2 <section> elements, in order hot then explore.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: full-UI in-process (RootLayout -> (exams) layout ->
//   app/(exams)/exams/page.tsx), mocked backend (listExamShelves stub returning
//   practice: null)
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the page's `SHELF_ORDER.map` narrowing (`data && <ExamShelf
//   .../>`) is written as a ternary with an empty-but-rendered fallback, or
//   `ExamShelf` itself is called with `exams: []` instead of the caller skipping it
//   entirely, so a heading + subtitle (or a dashed empty card) appears for a shelf
//   the student has no data for — precisely the "fake diagnosis" the PRD's cold-
//   start user story forbids.
// Proof obligation — what the implemented test must assert:
//   (a) POSITIVE FIRST: the hot and explore shelf titles are both found in the
//       rendered tree, proving the composition rendered at all before any
//       negative assertion is trusted;
//   (b) 0 elements with `id="shelf-practice"` or `aria-labelledby="shelf-practice"`
//       exist anywhere in the document, and the resolved
//       `exams.shelfPracticeTitle`/`exams.shelfPracticeSubtitle` strings appear
//       NOWHERE in `container.textContent`;
//   (c) exactly 2 `<section>` shelf elements exist, in DOM order hot then explore
//       (D8 — "the remaining shelves keep their relative order");
//   (d) 0 dashed/placeholder card elements exist in place of the missing shelf —
//       assert the total card count across the page equals exactly the sum of the
//       hot and explore fixtures' card counts, so a stray placeholder card would
//       be caught by the count even if it carries no obviously-named class.
describe("A shelf whose selection yields 0 cards is entirely absent from the rendered page — no header, no subtitle, no placeholder (AC-051, AC-013, cold-start user story)", () => {
  it("cold-start fixture (practice shelf data = null): 0 nodes reference shelf-practice, exactly 2 <section> shelves render in order hot→explore, and the total card count equals exactly the hot+explore fixtures' card counts (obligations a-d)", async () => {
    listExamShelvesMock.mockResolvedValue(COLD_START_FIXTURE);
    listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
    listExamFacetsMock.mockResolvedValue(FACETS);
    getCurrentUserMock.mockResolvedValue(null);
    getCurrentUserProfileMock.mockResolvedValue(null);

    const { container } = await renderExamsRoute({});

    // (a) POSITIVE FIRST (empty-tree hazard): both remaining shelf titles are
    // actually found before any negative assertion is trusted.
    expect(container.textContent).toContain(copy["exams.shelfHotTitle"]);
    expect(container.textContent).toContain(copy["exams.shelfExploreTitle"]);

    // (b) 0 nodes referencing shelf-practice anywhere — id, aria-labelledby,
    // or the resolved copy strings.
    expect(container.querySelector("#shelf-practice")).toBeNull();
    expect(container.querySelector('[aria-labelledby="shelf-practice"]')).toBeNull();
    expect(container.textContent).not.toContain(copy["exams.shelfPracticeTitle"]);
    // The subtitle template carries a `{subject}` interpolation that is never
    // even computed — `page.tsx`'s `data && (...)` narrowing skips the whole
    // `ExamShelf`/`shelfSubtitle` call when practice is null — so the stable
    // trailing clause is enough to prove the string never lands anywhere.
    expect(container.textContent).not.toContain(
      "đang là môn điểm trung bình thấp nhất của bạn"
    );

    // (c) exactly 2 shelves, DOM order hot then explore (D8).
    const sections = shelfSections(container);
    expect(sections.map((s) => s.getAttribute("aria-labelledby"))).toEqual([
      "shelf-hot",
      "shelf-explore",
    ]);

    // (d) 0 placeholder/dashed card in place of the missing shelf: the total
    // <li> count under the two remaining shelves' rows equals exactly the
    // fixtures' card counts plus the one Khám phá row always carries (the
    // "Xem toàn bộ kho đề" tile) — a stray element is caught by the count
    // regardless of whether it carries an obviously-named class.
    const totalListItems = sections.reduce(
      (sum, section) => sum + section.querySelectorAll("ul > li").length,
      0
    );
    const expectedListItems =
      COLD_START_FIXTURE.hot.exams.length + COLD_START_FIXTURE.explore.exams.length + 1;
    expect(totalListItems).toBe(expectedListItems);
  });
});
