// @vitest-environment jsdom

// Community Solutions [fixture-e2e] Test Skeleton
// Design Docs: docs/design/community-solutions-backend-design.md (v1.1),
//   docs/design/community-solutions-frontend-design.md (v1.1)
// UI Spec: docs/ui-spec/community-solutions-ui-spec.md
// PRD: docs/prd/community-solutions-prd.md (v1.3)
// Generated: 2026-09-17 | Budget Used: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/1-2
//
// SKELETON ONLY — comment-based design intent. No imports, no driver calls, no
// assertions yet. This exact path is pre-named by both design docs (frontend
// DD § Fact Disposition Table, row "test-conventions": "a new
// tests/e2e/fixture/community-solutions.fixture.e2e.test.ts file may be added
// later"). Follows the structural-subset-of-Playwright SupportDriver
// precedent already in this lane (SOURCE/tests/e2e/fixture/
// support-ticket-submission.fixture.e2e.test.ts, rating.fixture.e2e.test.ts,
// history.fixture.e2e.test.ts) — fixture-driven backend (mocked
// Server Actions/queries), no live Supabase. Must stay green under
// tsc/eslint/build until the implementing task adds a real driver import +
// fixture data module + assertions in the same commit as the UI feature.
//
// Mock boundary (frontend DD § Test Boundaries, Mock Boundary Decisions
// table): features/solutions/{queries,actions,adminActions}.ts are mocked at
// the module boundary with fixture data, mirroring the existing whole-module
// vi.mock convention essay-auto-scoring.fixture.e2e.test.ts already uses.
// lib/solutions/identity.ts and RichText render for REAL (not mocked) in any
// screen this file drives — both docs name these as the safety-critical
// boundaries a component/browser test must not fake.

// =============================================================================
// Test J1 [RESERVED SLOT — user-facing multi-step journey, emitted regardless
//   of ROI] — Submitter writes, publishes, and can open their own published
//   community solution
// =============================================================================
// User journey (PRD R1-R2, R4-R7, R11-R12; UI Spec screen transition table:
//   S-01 result page -> S-04 write screen ("Viết bài giải của bạn" CTA, no
//   existing solution) -> S-05 view screen, reached via the write screen's
//   own bottom-bar "Xem bài giải" button, which the UI Spec states appears
//   ONLY once my solution is published, AC-030): a submitted user with no
//   existing solution opens the result page, sees the write CTA on the
//   solution entry card, navigates to the write screen, fills a >=15-word
//   note for every current question, publishes, and — from that same write
//   screen — opens the resulting published solution's own view screen.
// ROI: 109 (BV:10 x Freq:9 + Legal:0 + Defect:9) — reserved regardless of ROI:
//   3 distinct route boundaries (S-01 -> S-04 -> S-05) traversed in sequence,
//   state carries across steps (notes typed + publish outcome determine what
//   S-05 shows), and the journey has a completion point (own published
//   solution viewable), per Phase 4 budget's multi-step user-facing journey
//   definition.
// Behavior: each step's output affects the next step's fixture-driven
//   render — word counts entered on the write screen gate the publish
//   control's availability before any publish call fires, and the publish
//   outcome (fixture success) is what makes S-05's "Xem bài giải" transition
//   reachable at all (AC-030: that button is absent for a non-published
//   solution).
// @category: core-functionality
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — SolutionEntryCard,
//   SolutionEditorScreen, NoteEditor, SolutionPublishBar, SolutionViewScreen
//   fixture data
// @complexity: high
// @real-dependency: none for this file — the real DB persistence claim
//   behind "publish succeeds and is durable" is proven separately in
//   service-integration-e2e (Test SE1), which mirrors backend DD's own
//   Early Verification Point (Slice 2). This test only proves the UI chain
//   does not break given a fixture backend configured to return success.
// Primary failure mode: any single step in the chain silently no-ops (e.g.
//   the "Đăng" button click does not invoke the fixture setSolutionStatus,
//   or a successful publish does not make the write screen's "Xem bài giải"
//   button appear/navigate) — the class of regression isolated
//   component/integration tests cannot catch because each step passes on its
//   own while the chain between them breaks.
// Proof obligation: each of the 3 boundaries is traversed with the PREVIOUS
//   step's output observably affecting the NEXT step's fixture-driven render
//   (not 3 independent page loads with a reset in between) — word counts
//   entered in the write step must be reflected in the live counter/publish-
//   gate state before the publish call fires, and the publish outcome must be
//   what makes the S-05 transition available immediately after, with no
//   manual reload between steps.
// Verification points / expected results / pass criteria:
//   - S-01 result page (fixture: myStatus="none") shows the write CTA, not a
//     "published"/"draft"/"hidden" state (AC-010 label set)
//   - S-04 write screen renders one NoteEditor row per current question;
//     typing <15 words on any row keeps the publish control aria-disabled
//     with an aria-describedby reason; typing >=15 words on every row clears
//     that block
//   - clicking "Đăng" (Publish) with the fixture backend configured to
//     succeed transitions to a visible confirmation, never an optimistic
//     "published" state shown before the fixture promise resolves
//   - the write screen's bottom bar then offers "Xem bài giải" (AC-030),
//     navigating to S-05, which renders this user's own solution content
//     from the post-publish fixture response — not from client-only state
//   - pass criteria: all four checkpoints hold within one continuous driver
//     session (no test-local state reset between steps)

// -----------------------------------------------------------------------------
// REAL DRIVER + FIXTURE DATA (task 23) — Test J1 implementation
// -----------------------------------------------------------------------------
// No `@playwright/test` in this repo (see file header) — this lane's one
// executable shape is an in-process render of the REAL route tree
// (essay-auto-scoring.fixture.e2e.test.ts precedent): `ResultPage` ->
// `SolutionEditorPage` -> `SolutionViewPage`, each awaited and rendered with
// RTL, chained through ONE mutable `FixtureStore` (communitySolutionsFixtureData.ts)
// instead of three independently hand-authored fixtures — the store is what
// makes step 2's `saveSolution`/`setSolutionStatus` calls observably feed
// step 3's `getSolutionDetail` render, per this test's own Proof Obligation.
//
// jsdom (not the lane's default "node" — see vitest.fixture.config.ts) is
// required from this file on for RTL rendering; Test 2/Test 3 (DOM-querying
// per their own annotations above) need it too.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copy, t } from "@/lib/copy";
import {
  FIFTEEN_WORD_NOTE,
  FIXTURE_ATTEMPT_ID,
  FIXTURE_EXAM_ID,
  SERVER_NOTE_PREFIX,
  SHORT_NOTE,
  T2_ANONYMOUS_AUTHOR_SCORE,
  T2_ANONYMOUS_REAL_AVATAR_URL,
  T2_ANONYMOUS_REAL_DISPLAY_NAME,
  T2_ANONYMOUS_SOLUTION_ID,
  T2_AVATAR_ORIGIN,
  T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME,
  T2_HIDDEN_SCORE_REAL_VALUE,
  T2_HIDDEN_SCORE_SOLUTION_ID,
  T2_NAMED_AUTHOR_AVATAR_URL,
  T2_NAMED_AUTHOR_DISPLAY_NAME,
  T2_NAMED_SOLUTION_ID,
  createFixtureStore,
  fixtureExam,
  fixtureExamResult,
  fixtureGetMySolutionForWriter,
  fixtureGetSolutionDetail,
  fixtureGetSolutionDetailForAnonymityCheck,
  fixtureListSolutionsForAnonymityCheck,
  fixtureResultCardSummary,
  fixtureSaveSolution,
  fixtureSetSolutionStatus,
  fixtureWriterState,
  type FixtureStore,
} from "./communitySolutionsFixtureData";

const {
  getResultMock,
  getMyRatingMock,
  getProfileMock,
  getResultCardSummaryMock,
  getMySolutionForWriterMock,
  getSolutionDetailMock,
  listSolutionsMock,
  saveSolutionMock,
  setSolutionStatusMock,
  toggleHelpfulMock,
  setPinMock,
  getExamMock,
  isExamAuthorMock,
  generatePdfMock,
  redirectMock,
} = vi.hoisted(() => ({
  getResultMock: vi.fn(),
  getMyRatingMock: vi.fn(),
  getProfileMock: vi.fn(),
  getResultCardSummaryMock: vi.fn(),
  getMySolutionForWriterMock: vi.fn(),
  getSolutionDetailMock: vi.fn(),
  listSolutionsMock: vi.fn(),
  saveSolutionMock: vi.fn(),
  setSolutionStatusMock: vi.fn(),
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
  getExamMock: vi.fn(),
  isExamAuthorMock: vi.fn(),
  generatePdfMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

// Mock boundary (frontend DD § Test Boundaries; this file's own header
// comment above): features/solutions/{queries,actions} mocked at the module
// boundary with fixture data. features/exams/{queries,actions} and
// lib/auth/getCurrentUser are result-page data OUTSIDE this feature, mocked
// with the same factory shape essay-auto-scoring.fixture.e2e.test.ts uses.
// lib/solutions/identity.ts and RichText are NEVER mocked anywhere below —
// both render for real on every screen this file drives.
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUserProfile: getProfileMock }));
vi.mock("@/features/exams/queries", () => ({
  getResult: getResultMock,
  getExam: getExamMock,
  isExamAuthor: isExamAuthorMock,
}));
vi.mock("@/features/exams/actions", () => ({ getMyRating: getMyRatingMock }));
// jsPDF + html2canvas do not run in jsdom (same note essay-auto-scoring's own
// mock boundary records) — ResultActions' usePdfAction imports this for real.
vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: generatePdfMock,
  downloadPdfFile: vi.fn(),
  canShareFile: () => false,
}));
vi.mock("@/features/solutions/queries", () => ({
  getResultCardSummary: getResultCardSummaryMock,
  getMySolutionForWriter: getMySolutionForWriterMock,
  getSolutionDetail: getSolutionDetailMock,
  listSolutions: listSolutionsMock,
}));
vi.mock("@/features/solutions/actions", () => ({
  saveSolution: saveSolutionMock,
  setSolutionStatus: setSolutionStatusMock,
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
}));

import ResultPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/result/page";
import SolutionEditorPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page";
import SolutionViewPage from "@/app/(exams)/exams/[id]/solutions/[solutionId]/page";
import SolutionsListPage from "@/app/(exams)/exams/[id]/solutions/page";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

beforeAll(() => {
  // jsdom has no scrollIntoView (same note as SolutionViewPage.test.tsx) —
  // SolutionViewScreen's deep-link effect calls it unconditionally on mount.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  redirectMock.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

afterEach(() => {
  cleanup();
});

/** Every element carrying a native `disabled` attribute — the fixture-lane
 *  rule this task carries (UI-D25: aria-disabled only, never native disabled). */
function disabledNodes(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("[disabled]"));
}

/** `<img>` elements in a subtree whose `src` matches an EXACT expected value —
 *  scoped per-row (Test 2's own subtree-query helper, shared across S-03/S-05)
 *  so a DIFFERENT row's own avatar can never accidentally satisfy either a
 *  presence or an absence check made against this one. */
function imagesWithSrc(root: HTMLElement, src: string): Element[] {
  return Array.from(root.querySelectorAll(`img[src="${src}"]`));
}

/** `SolutionAuthorCard`'s own `<section>` (S-05) — the ONLY `<section>` on
 *  this route (`Breadcrumbs` renders `<nav>`), needed because the author's
 *  name/label is ALSO echoed into the page breadcrumb, which would otherwise
 *  make a whole-page `getByText` ambiguous (multiple matches) regardless of
 *  what the card itself renders. */
function authorCardSection(container: HTMLElement): HTMLElement {
  return container.querySelector("section") as HTMLElement;
}

describe("J1 — write, publish, and open my own published community solution", () => {
  it("chains S-01 (write CTA) -> S-04 (gated publish, non-optimistic) -> S-05 (own published content), in one driver session", async () => {
    const store: FixtureStore = createFixtureStore();

    getResultMock.mockResolvedValue(fixtureExamResult());
    getMyRatingMock.mockResolvedValue(null);
    getProfileMock.mockResolvedValue({ id: "u1", displayName: "Người viết fixture", email: "a@b.c" });
    getResultCardSummaryMock.mockResolvedValue(fixtureResultCardSummary());
    getExamMock.mockResolvedValue(fixtureExam());
    isExamAuthorMock.mockResolvedValue(false);
    // Bound to the SAME store for the whole session — read again by S-05
    // after S-04 publishes, so `own`/`editHref` there reflect exactly what
    // the write screen produced, not an independently authored value.
    getMySolutionForWriterMock.mockImplementation(() =>
      Promise.resolve(fixtureGetMySolutionForWriter(store))
    );
    saveSolutionMock.mockImplementation(
      (_examId: string, patch: { notes: { questionId: string; body: string }[] }) =>
        Promise.resolve(fixtureSaveSolution(store, patch))
    );
    setSolutionStatusMock.mockImplementation((_examId: string, action: "publish" | "draft") =>
      fixtureSetSolutionStatus(store, action)
    );
    getSolutionDetailMock.mockImplementation((solutionId: string) =>
      Promise.resolve(fixtureGetSolutionDetail(store, solutionId))
    );

    // ── S-01: result page, myStatus="none" — write CTA, not continue/edit/hidden (AC-010) ──
    //
    // `ScoreCard` is an async Server Component with an async child of its own
    // (same hazard essay-auto-scoring.fixture.e2e.test.ts's own header
    // documents) — RTL's `render(await ResultPage(...))` suspends and hands
    // back an EMPTY tree here, so this ONE checkpoint uses `renderServerTree`
    // instead (no interactivity needed on S-01 — only href/text/role reads).
    const resultJsx = await ResultPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, attemptId: FIXTURE_ATTEMPT_ID }),
    });
    const resultScreen = await renderServerTree(resultJsx);
    // POSITIVE FIRST (same hazard): prove the page actually rendered before
    // any negative assertion below is allowed to mean anything.
    expect(resultScreen.container.textContent).toContain(t("result.nextTitle"));
    const writeLink = within(resultScreen.container).getByRole("link", {
      name: copy["solutions.entry.write"],
    });
    const writeHref = writeLink.getAttribute("href");
    expect(writeHref).toBe(`/exams/${FIXTURE_EXAM_ID}/attempt/${FIXTURE_ATTEMPT_ID}/solution`);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.continue"]);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.edit"]);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.hidden"]);
    expect(disabledNodes(resultScreen.container)).toHaveLength(0);

    // ── S-04: write screen, reached through the S-01 CTA's OWN href ──
    const editorJsx = await SolutionEditorPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, attemptId: FIXTURE_ATTEMPT_ID }),
    });
    const editor = render(editorJsx);

    const questionRows = screen.getAllByRole("button", { name: /^Câu \d,/ });
    expect(questionRows).toHaveLength(2);
    expect(disabledNodes(editor.container)).toHaveLength(0);

    const publishButton = () => screen.getByRole("button", { name: t("solutions.bar.publish") });
    const publishReason = () => {
      const id = publishButton().getAttribute("aria-describedby");
      return document.getElementById(id ?? "");
    };

    // Row 2 first: >=15 words on ONE row alone is not enough while row 1 is
    // still empty — the gate reads every current row, not just one.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 2,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: FIFTEEN_WORD_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 2, đã ghi chú" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("true");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.remaining", { count: 1, total: 2 }));

    // Row 1 with <15 words: a SHORT note is not the same as no note at all,
    // but neither clears the gate — "any row under 15 words" still holds.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: SHORT_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 1, chưa đủ 15 từ" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("true");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.remaining", { count: 1, total: 2 }));

    // Row 1 raised to >=15 words: every current row now clears the gate.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: FIFTEEN_WORD_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 1, đã ghi chú" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("false");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.ready", { total: 2 }));
    expect(disabledNodes(editor.container)).toHaveLength(0);

    // Publish — non-optimistic (Primary failure mode: an optimistic UI would
    // flip to "published" before the fixture's setSolutionStatus resolves).
    // The fixture resolves on a microtask boundary, never synchronously, so a
    // check made in the SAME synchronous tick as the click — no `await`
    // between them — must still observe the pre-publish state.
    fireEvent.click(publishButton());
    expect(screen.queryByText(t("status.published"))).toBeNull();
    expect(screen.getByRole("button", { name: t("solutions.bar.publishing") })).toBeTruthy();

    const viewLink = await screen.findByRole("button", { name: t("solutions.bar.viewMine") });
    expect(screen.getByText(t("status.published"))).toBeTruthy();
    expect(setSolutionStatusMock).toHaveBeenCalledWith(FIXTURE_EXAM_ID, "publish");
    expect(store.status).toBe("published");

    const viewHref = viewLink.getAttribute("href");
    // The bug this checkpoint exists to catch: a publish that succeeds but
    // never threads the newly-created solutionId back into client state
    // leaves this link pointing at "#" forever — AC-030 promises a WORKING
    // "Xem bài giải" link, not a dead one (see SolutionEditorScreen.tsx fix,
    // Investigation Notes).
    expect(viewHref).not.toBe("#");
    expect(viewHref).toBe(`/exams/${FIXTURE_EXAM_ID}/solutions/${store.solutionId}`);
    expect(disabledNodes(editor.container)).toHaveLength(0);
    cleanup();

    // ── S-05: navigate via the write screen's OWN "Xem bài giải" href ──
    const solutionIdFromHref = viewHref?.split("/").pop() ?? "";
    expect(solutionIdFromHref).toBe(store.solutionId);

    const viewJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: solutionIdFromHref }),
      searchParams: Promise.resolve({}),
    });
    const viewScreen = render(viewJsx);

    expect(getSolutionDetailMock).toHaveBeenCalledWith(solutionIdFromHref);
    // Own solution (AC-062): a helpful COUNT, not a helpful button — a client-
    // state-only render could not know `isMine` without this fetch either.
    expect(screen.getByText(t("solutions.view.helpfulCount", { count: 0 }))).toBeTruthy();

    const serverNote = `${SERVER_NOTE_PREFIX}${FIFTEEN_WORD_NOTE}`;
    fireEvent.click(screen.getByRole("button", { name: "Câu 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Câu 2" }));
    // Both rows show the fixture's SERVER-stamped note body — a string that
    // can only have come from this render's getSolutionDetail response, never
    // from any client-only echo of what was typed on S-04.
    expect(screen.getAllByText(serverNote)).toHaveLength(2);
    expect(disabledNodes(viewScreen.container)).toHaveLength(0);
  });
});

// =============================================================================
// Test 2 [additional slot, ROI >= 20] — Anonymous author/comment rows never
//   render a name, avatar, or score in the browser DOM
// =============================================================================
// AC: "While a solution's show_profile is false... omit author_id, author
//   display name, and author avatar path from every payload" (AC-039, M5);
//   "While a comment's is_anonymous is true... omit author_id, display name,
//   avatar path... except a boolean 'is the solution's writer' flag"
//   (AC-105, D42); frontend DD EARS: "the system shall render AuthorIdentity
//   as {kind:'anonymous'} and never pass a displayName/avatarUrl... to any
//   component."
// ROI: 79 (BV:10 x Freq:7 + Legal:0 + Defect:9)
// Behavior: the solutions list (S-03), detail (S-05), and comment sheet
//   (O-02) are rendered with fixture rows that include both a NAMED and an
//   ANONYMOUS solution/comment -> the anonymous row's rendered DOM contains
//   no author name text, no avatar image pointing at the fixture's real
//   avatar URL, and (for a masked show_score=false row) no score value ->
//   the named row's DOM does show its own name/avatar/score.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — SolutionList, SolutionAuthorCard,
//   CommentItem, AnonymousAvatar fixture data
// @complexity: medium
// @real-dependency: none — fixture rows are hand-built to match the masked
//   RPC shape (null identity fields); whether the REAL RPC actually returns
//   that shape is proven only in service-integration-e2e (Test SE2), not
//   here — this test proves the UI's reaction to an already-masked row, per
//   frontend DD § Test Boundaries ("frontend component tests never assert
//   masking correctness at the SQL level").
// Primary failure mode: a component renders row.author_display_name
//   directly (bypassing the AuthorIdentity mapper/discriminated union), so
//   an anonymous-fixture row's real name leaks into the DOM the moment a
//   future edit reintroduces a raw field read — the risk both design docs
//   name as this feature's top risk.
// Proof obligation: query the rendered DOM (not component props/internal
//   state) for the anonymous row's card/item and assert absence of the
//   named author's fixture display-name string anywhere in its subtree,
//   absence of an <img> pointing at the fixture's real avatar URL, and
//   presence of AnonymousAvatar's fallback marker instead; repeat for the
//   named row, asserting presence of its own identity.
// Verification points / expected results / pass criteria:
//   - S-03 solutions list: anonymous row shows no name/avatar; named row
//     shows both
//   - S-05 detail / O-02 comment sheet: same for an anonymous comment, plus
//     the "is the solution's writer" boolean badge renders when applicable,
//     with no other identity leak alongside it
//   - a show_score=false row: no score badge/value rendered anywhere in that
//     row's subtree
//   - pass criteria: zero occurrences of the fixture's real name/avatar/score
//     strings inside the anonymous row's rendered subtree, on every screen
//     checked

// -----------------------------------------------------------------------------
// REAL FIXTURE DATA (task 24) — Test 2 S-03 (list) + S-05 (detail) portions.
// The O-02 comment-sheet portion is NOT written here — task 30 (see this
// task's own Notes section and the residual named in the comment block
// above).
// -----------------------------------------------------------------------------
describe("Test 2 — anonymous author and hidden score never leak into rendered DOM (S-03, S-05)", () => {
  beforeAll(() => {
    // `components/shared/QuestionFigure.ts` `isAllowedImageUrl` only lets an
    // `<img>` render for a URL matching this origin — same fixture origin
    // `AuthorIdentity.test.tsx` uses. Without this, the NAMED row's own
    // avatar would ALSO fail to render, making the anonymous row's "no
    // matching <img>" assertion vacuously true instead of a real proof.
    process.env.NEXT_PUBLIC_SUPABASE_URL = T2_AVATAR_ORIGIN;
  });

  beforeEach(() => {
    getExamMock.mockResolvedValue(fixtureExam());
    isExamAuthorMock.mockResolvedValue(false);
    getMySolutionForWriterMock.mockResolvedValue(
      fixtureWriterState({ solutionId: T2_NAMED_SOLUTION_ID, status: "published" })
    );
    listSolutionsMock.mockResolvedValue(fixtureListSolutionsForAnonymityCheck());
    getSolutionDetailMock.mockImplementation((solutionId: string) =>
      Promise.resolve(fixtureGetSolutionDetailForAnonymityCheck(solutionId))
    );
  });

  it("S-03 solutions list: each row's OWN subtree shows only what that row is allowed to show", async () => {
    const listJsx = await SolutionsListPage({ params: Promise.resolve({ id: FIXTURE_EXAM_ID }) });
    render(listJsx);

    // Row boundary (Proof Obligation: query the rendered DOM for "the
    // anonymous row's card... subtree") — each row's own card-covering link
    // is found by ITS OWN accessible name, then its `<li>` ancestor is the
    // subtree every assertion below is scoped to. A leak on a DIFFERENT row
    // could not accidentally satisfy an absence check made against this one.
    const namedRow = screen
      .getByRole("link", { name: t("solutions.card.openLabel", { name: T2_NAMED_AUTHOR_DISPLAY_NAME }) })
      .closest("li") as HTMLElement;
    const anonymousRow = screen
      .getByRole("link", {
        name: t("solutions.card.openLabel", { name: t("solutions.identity.anonymous") }),
      })
      .closest("li") as HTMLElement;
    const hiddenScoreRow = screen
      .getByRole("link", {
        name: t("solutions.card.openLabel", { name: T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME }),
      })
      .closest("li") as HTMLElement;

    // Named row shows its OWN real identity — proves the technique above is
    // not vacuous (a row CAN show a name/avatar in this same render).
    expect(within(namedRow).getByText(T2_NAMED_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(imagesWithSrc(namedRow, T2_NAMED_AUTHOR_AVATAR_URL)).toHaveLength(1);

    // Anonymous row: "Ẩn danh" present; the REAL name/avatar that could have
    // leaked (T2_ANONYMOUS_REAL_* — see fixture doc) is absent from THIS
    // subtree. Score stays visible (show_score is independent of
    // show_profile) — anonymity alone must not also blank a real score.
    expect(within(anonymousRow).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(anonymousRow).queryByText(T2_ANONYMOUS_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(anonymousRow, T2_ANONYMOUS_REAL_AVATAR_URL)).toHaveLength(0);
    expect(
      within(anonymousRow).getByText(`${T2_ANONYMOUS_AUTHOR_SCORE.toFixed(1)} ${t("result.outOfTen")}`)
    ).toBeTruthy();

    // Hidden-score row: own name shows normally (identity masking untouched
    // here); no score badge/value anywhere in ITS subtree.
    expect(within(hiddenScoreRow).getByText(T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(within(hiddenScoreRow).queryByText(new RegExp(t("result.outOfTen")))).toBeNull();
    expect(within(hiddenScoreRow).queryByText(String(T2_HIDDEN_SCORE_REAL_VALUE))).toBeNull();
  });

  it("S-05 solution detail: SolutionAuthorCard subtree repeats the same guarantees, per solution", async () => {
    const namedJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_NAMED_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const namedScreen = render(namedJsx);
    const namedCard = authorCardSection(namedScreen.container);
    expect(within(namedCard).getByText(T2_NAMED_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(imagesWithSrc(namedCard, T2_NAMED_AUTHOR_AVATAR_URL)).toHaveLength(1);
    cleanup();

    const anonymousJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_ANONYMOUS_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const anonymousScreen = render(anonymousJsx);
    const anonymousCard = authorCardSection(anonymousScreen.container);
    expect(within(anonymousCard).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(anonymousCard).queryByText(T2_ANONYMOUS_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(anonymousCard, T2_ANONYMOUS_REAL_AVATAR_URL)).toHaveLength(0);
    expect(
      within(anonymousCard).getByText(`${T2_ANONYMOUS_AUTHOR_SCORE.toFixed(1)} ${t("result.outOfTen")}`)
    ).toBeTruthy();
    cleanup();

    const hiddenScoreJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_HIDDEN_SCORE_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const hiddenScoreScreen = render(hiddenScoreJsx);
    const hiddenScoreCard = authorCardSection(hiddenScoreScreen.container);
    expect(within(hiddenScoreCard).getByText(T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(within(hiddenScoreCard).queryByText(new RegExp(t("result.outOfTen")))).toBeNull();
    expect(within(hiddenScoreCard).queryByText(String(T2_HIDDEN_SCORE_REAL_VALUE))).toBeNull();
    cleanup();
  });
});

// =============================================================================
// Test 3 [additional slot, ROI >= 20] — Malicious note/comment markdown
//   renders as inert content through RichText, never executes
//   (ADR-0002 boundary — required by the orchestration prompt to have >=1
//   test skeleton proving this boundary, not only stated in documentation)
// =============================================================================
// ADR: docs/adr/ADR-0002-published-content-rendering-and-sanitization.md —
//   the only sanctioned render path for note/comment bodies. Complements
//   (does not duplicate) the unit-lane
//   SOURCE/components/shared/__tests__/RichText.xss.test.tsx fixture
//   additions both design docs name in their Integration Verification
//   Points (M8) — that file proves RichText's sanitizer in isolation; this
//   test proves the same boundary at the full browser-render level, through
//   the actual S-05 view screen and O-02 comment sheet, the first two
//   user-authored-markdown render surfaces this feature introduces.
// ROI: 41 (BV:8 x Freq:4 + Legal:0 + Defect:9)
// Behavior: a solution-note fixture and a comment fixture both contain a
//   known XSS payload (e.g. a <script>/onerror= markdown-HTML injection
//   attempt) -> S-05's note block and O-02's comment body both render
//   through RichText -> the resulting DOM contains no executable <script>
//   element, no javascript: URL, and no on*-attribute originating from the
//   payload.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — SolutionNoteBlock, CommentItem
//   fixture data; RichText renders for real (not mocked, per Mock Boundary
//   Decisions)
// @complexity: low
// @real-dependency: RichText.tsx renders unmocked in this test (frontend DD
//   Mock Boundary Decisions: "RichText in component tests that render
//   note/comment content — No — use the real component... XSS/sanitization
//   behavior must be exercised for real, not assumed").
// Primary failure mode: a future change to the note/comment render path
//   bypasses RichText (e.g. a raw dangerouslySetInnerHTML shortcut), or
//   RichText's sanitizer regresses, letting the payload's script execute or
//   persist as live markup in the DOM.
// Proof obligation: assert on the RENDERED DOM (not the raw fixture string)
//   that the payload's <script>/event-handler content is absent as
//   executable markup — no matching <script> element exists, no element
//   carries the payload's onerror/onclick attribute — independently for
//   both the note-body render path (S-05, server-rendered) and the
//   comment-body render path (O-02, dynamic-import RichText per UI-D10).
// Verification points / expected results / pass criteria:
//   - S-05 solution view screen note body: payload renders as inert
//     text/safe markup; zero <script> elements; zero on*-attributes from
//     the payload
//   - O-02 comment sheet comment body: same, independently checked (a
//     different render call site than the note body)
//   - pass criteria: both render paths show zero executable-markup evidence
//     from the shared payload fixture
