// Rating System [fixture-e2e]
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// UI Spec: docs/design/rating-system-ui-spec.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
//
// Test FE1 (result-page auto-open modal journey) is converted below (frontend
// task 8, RatingModal/RatingModalController) — see the FE1 section further
// down this file for its own driver interface and header note.
//
// Test FE2 is converted below into a real, driver-based script. This repo has
// no `@playwright/test` dependency and no playwright.config.ts committed yet
// (only the Playwright MCP browser-automation server is configured, in
// `.mcp.json`, for interactive/manual sessions — see the frontend Design
// Doc's Test Boundaries: "Playwright MCP / manual pass (no CI)"). Adding a new
// npm test-framework dependency is outside this task's Target Files (would
// touch package.json/playwright.config.ts, neither listed) and is a "new
// external library" decision this implementer escalates rather than makes
// unilaterally (see the task's final JSON response for the recorded
// escalation). So this script is written against a minimal `FE2Driver`
// interface that is a structural SUBSET of Playwright's real `Page`/`Locator`
// API (`goto`, `url`, `getByRole`, `getByText`, `.click`, `.check`,
// `.getAttribute`, `.first`, `.count`) — a real Playwright `Page` satisfies
// this interface as-is, so once a harness exists this script runs unchanged
// (either wrapped in a `@playwright/test` `test()` block, or driven directly
// via the Playwright MCP tool). Assertions use Node's built-in
// `node:assert/strict` (no new dependency either).
//
// Fixture-driven backend: `listExams`/`listMySubmittedExamIds`/`getCurrentUser`
// must resolve to the fixture data below instead of live Supabase for this
// script to run against `npm run dev`. This repo has no existing
// request/route-mocking layer (no MSW, no test-mode query override) — wiring
// FIXTURE_EXAMS/FIXTURE_SUBMITTED_EXAM_IDS/FIXTURE_USER into a real running
// `/exams` page (e.g. via a test-only env flag read by `queries.ts`/
// `getCurrentUser.ts`, or an MSW-style network intercept) is a residual
// left for whoever stands up the Playwright harness — out of this task's
// Target Files (queries.ts/getCurrentUser.ts are backend-owned, Task 4).

import assert from "node:assert/strict";
import type { Bucket } from "@/lib/rating";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface FE2Locator {
  click(): Promise<void>;
  check(): Promise<void>;
  isVisible(): Promise<boolean>;
  /** Native `<input type="checkbox">` state (Newest/Oldest/Hardest quick-sort
   *  checkboxes — ExamFilters.tsx) — checked state is a DOM property, not an
   *  `aria-checked` attribute, so this is queried separately from getAttribute. */
  isChecked(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  first(): FE2Locator;
  count(): Promise<number>;
  allTextContents(): Promise<string[]>;
}

export interface FE2Driver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp; level?: number }): FE2Locator;
  getByText(text: string | RegExp): FE2Locator;
}

// --- Fixture data -----------------------------------------------------------
// Spans 0/1/2/>=3 ratings (AC-014/015/016) across the three buckets, plus a
// mixed-eligibility current user (one exam submitted -> eligible; one not).

export interface FixtureExam {
  id: string;
  title: string;
  communityDifficulty: { bucket: Bucket; mean: number; count: number } | null;
}

export const FIXTURE_EXAMS: readonly FixtureExam[] = [
  { id: "exam-0-ratings", title: "Algebra Basics", communityDifficulty: null },
  { id: "exam-1-rating", title: "Geometry Intro", communityDifficulty: null },
  { id: "exam-2-ratings", title: "Trigonometry Warmup", communityDifficulty: null },
  {
    id: "exam-easy",
    title: "Fractions Practice",
    communityDifficulty: { bucket: "Easy", mean: 2.3, count: 5 },
  },
  {
    id: "exam-medium",
    title: "Quadratic Equations",
    communityDifficulty: { bucket: "Medium", mean: 5.1, count: 4 },
  },
  {
    id: "exam-hard",
    title: "Calculus Challenge",
    communityDifficulty: { bucket: "Hard", mean: 8.7, count: 6 },
  },
];

/** Logged-in fixture user has submitted exam-hard (-> eligible) but not
 *  exam-medium (-> not-attempted). AC-026 reruns the same page logged out. */
export const FIXTURE_SUBMITTED_EXAM_IDS = new Set(["exam-hard"]);
export const FIXTURE_USER = { id: "user-1", email: "fixture@example.com" };

// =============================================================================
// Test FE2 — Browse: Hardest sort, Level filter, and Rate-button eligibility states
// =============================================================================
// AC-010, AC-011, AC-026 (Rate button eligible / not-attempted / logged-out states)
// AC-014, AC-015, AC-016 (DifficultyBadge bucket+mean vs "—")
// AC-017, AC-019, AC-020, AC-021 (Level filter real buckets; Hardest ordering)
// code:F1 (stretched-link: card body vs RateButton independent target)
// ROI: 80 (BV:8 x Freq:9 + Legal:0 + Defect:8)
// Behavior: on /exams with a fixture set of exams spanning 0/1/2/>=3 ratings and a
//   mixed-eligibility current user (one exam eligible, one not-attempted; run once
//   more logged out for AC-026) -> exercise the stretched-link ExamCard, the
//   RateButton's three states, and the Hardest/Level controls.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — listExams/listMySubmittedExamIds/
//   getCurrentUser fixture-driven
// @complexity: medium
// Primary failure mode: clicking the card body no longer navigates to /exams/[id],
//   or the RateButton's independent click target is swallowed by the stretched-link
//   anchor (invalid interactive nesting regression, code:F1); OR checking Hardest
//   still combines with Newest/Oldest instead of replacing them (D002 regression);
//   OR a below-threshold exam is interleaved with rated exams instead of sinking to
//   the bottom; OR the Level filter includes a below-threshold or wrong-bucket exam.
// Proof obligation:
//   (a) clicking an ExamCard's body (outside the RateButton) navigates to
//       /exams/[id]; clicking an enabled RateButton navigates to /exams/[id]/rate
//       independently; a disabled RateButton (not-attempted or logged-out) does not
//       navigate and exposes its AT reason text ("Finish this exam first" /
//       "Log in to rate") via aria-describedby (AC-010/011/026);
//   (b) for the fixture set, DifficultyBadge shows "<Bucket> · <mean>" for every
//       exam with >=3 ratings and literal "—" for every exam with <3 ratings, on
//       both the ExamCard Level cell and the exam-detail Difficulty cell (AC-014/
//       015/016);
//   (c) checking Hardest writes ?sort=hardest, visually de-selects Newest/Oldest, and
//       reorders the list so every below-threshold exam appears after every rated
//       exam in the fixture's expected order (AC-019/020);
//   (d) selecting Level=Hard shows only fixture exams with >=3 ratings whose
//       community difficulty falls in the Hard bucket, excluding below-threshold and
//       other-bucket exams (AC-017/021).
//
// Implementation note: converted below into `checkXxx(driver)` functions (one per
// lettered obligation, plus one extra for the AC-026 logged-out rerun) rather than
// `it()` blocks — this file has no test-runner harness yet (see file header); each
// function's own doc comment repeats its letter + AC IDs for traceability back to
// the block above, mirroring how Test 2 (`rating.int.test.ts`) embeds
// "(AC-xxx, obligation x)" in each `it()` title.

/** (a) card body -> /exams/[id]; enabled RateButton -> /exams/[id]/rate
 *  independently; disabled RateButton (not-attempted/logged-out) does not
 *  navigate and exposes its AT reason via aria-describedby (AC-010/011/026). */
export async function checkCardBodyAndRateButtonIndependentTargets(
  driver: FE2Driver
): Promise<void> {
  await driver.goto("/exams");

  // Enabled RateButton (exam-hard, submitted -> eligible) navigates on its own.
  const enabledRate = driver.getByRole("link", { name: "Rate →" }).first();
  await enabledRate.click();
  assert.match(driver.url(), /\/exams\/exam-hard\/rate$/);

  // Card body (title link) navigates to the detail route, independent of Rate.
  await driver.goto("/exams");
  const cardBody = driver.getByRole("link", { name: "Calculus Challenge" });
  await cardBody.click();
  assert.match(driver.url(), /\/exams\/exam-hard$/);

  // Disabled RateButton — .first() resolves to exam-0-ratings (the first
  // FIXTURE_EXAMS entry not in FIXTURE_SUBMITTED_EXAM_IDS, in DOM order), also
  // logged-in not-attempted like exam-medium: no navigation, reason reachable
  // via aria-describedby.
  await driver.goto("/exams");
  const disabledRate = driver.getByRole("button", { name: "Rate →" }).first();
  const urlBefore = driver.url();
  await disabledRate.click();
  assert.equal(driver.url(), urlBefore, "disabled RateButton must not navigate");
  assert.equal(await disabledRate.getAttribute("aria-disabled"), "true");
  const reasonId = await disabledRate.getAttribute("aria-describedby");
  assert.ok(reasonId, "disabled RateButton must expose aria-describedby");
  const reason = driver.getByText("Finish this exam first");
  assert.equal(await reason.isVisible(), true);
}

/** (a, AC-026) logged-out: every RateButton is disabled with reason
 *  "Log in to rate", regardless of submitted-exam-id membership. */
export async function checkLoggedOutRateButtonsDisabled(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  const disabledRate = driver.getByRole("button", { name: "Rate →" }).first();
  assert.equal(await disabledRate.getAttribute("aria-disabled"), "true");
  const reason = driver.getByText("Log in to rate");
  assert.equal(await reason.isVisible(), true);
}

/** (b) DifficultyBadge shows "<Bucket> · <mean>" for every >=3-rating exam and
 *  literal "—" for every <3-rating exam, on the ExamCard Level cell AND the
 *  exam-detail Difficulty cell (AC-014/015/016). */
export async function checkDifficultyBadgeAcrossFixtures(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  for (const exam of FIXTURE_EXAMS) {
    const label = exam.communityDifficulty
      ? `${exam.communityDifficulty.bucket} · ${exam.communityDifficulty.mean.toFixed(1)}`
      : "—";
    assert.equal((await driver.getByText(label).first().count()) >= 1, true, exam.id);

    await driver.goto(`/exams/${exam.id}`);
    assert.equal((await driver.getByText(label).first().count()) >= 1, true, `${exam.id} detail`);
  }
}

/** (c) checking Hardest writes ?sort=hardest, de-selects Newest/Oldest, and
 *  sinks every below-threshold exam after every rated exam (AC-019/020;
 *  D002 regression guard — must NOT combine with Newest/Oldest). */
export async function checkHardestSortOrdering(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  await driver.getByRole("checkbox", { name: "Hardest" }).check();
  assert.match(driver.url(), /[?&]sort=hardest(&|$)/);

  const newest = driver.getByRole("checkbox", { name: "Newest" });
  const oldest = driver.getByRole("checkbox", { name: "Oldest" });
  assert.equal(await newest.isChecked(), false);
  assert.equal(await oldest.isChecked(), false);

  // ExamCard titles render as <h3> (ExamCard.tsx) in DOM order == render order.
  const renderedTitles = await driver.getByRole("heading", { level: 3 }).allTextContents();
  const ratedTitles = FIXTURE_EXAMS.filter((e) => e.communityDifficulty).map((e) => e.title);
  const belowThresholdTitles = FIXTURE_EXAMS.filter((e) => !e.communityDifficulty).map(
    (e) => e.title
  );
  for (const ratedTitle of ratedTitles) {
    for (const belowTitle of belowThresholdTitles) {
      assert.ok(
        renderedTitles.indexOf(ratedTitle) < renderedTitles.indexOf(belowTitle),
        `${ratedTitle} (rated) must sort before ${belowTitle} (below-threshold) under Hardest`
      );
    }
  }
}

/** (d) selecting Level=Hard shows only >=3-rating exams in the Hard bucket
 *  (AC-017/021) — excludes below-threshold and other-bucket exams. */
export async function checkLevelHardFilter(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  // The Level FilterRow only renders inside ExamFilters.tsx's `{open && (...)}`
  // overlay panel — open the master "Filters" toggle first (ExamFilters.tsx:113).
  await driver.getByRole("button", { name: "Filters" }).click();
  await driver.getByRole("button", { name: "Level" }).click();
  await driver.getByRole("button", { name: "Hard" }).click();
  assert.match(driver.url(), /[?&]level=hard(&|$)/);

  for (const exam of FIXTURE_EXAMS) {
    const shouldShow = exam.communityDifficulty?.bucket === "Hard";
    const count = await driver.getByText(exam.title).count();
    assert.equal(count > 0, shouldShow, exam.id);
  }
}

/** Orchestrator — runs FE2's four proof obligations against a supplied driver
 *  wired to a fixture-driven `/exams` session (see file header). */
export async function runFE2(driver: FE2Driver, loggedOutDriver: FE2Driver): Promise<void> {
  await checkCardBodyAndRateButtonIndependentTargets(driver);
  await checkLoggedOutRateButtonsDisabled(loggedOutDriver);
  await checkDifficultyBadgeAcrossFixtures(driver);
  await checkHardestSortOrdering(driver);
  await checkLevelHardFilter(driver);
}

// =============================================================================
// Test FE1 — Result-page reserved-slot journey: submit -> auto-open -> rate ->
// saved -> idempotent return (Rating System, frontend task 8)
// =============================================================================
// AC-004: "...the shared rating form auto-opens as a modal over the result
//   content..."
// AC-005: "...the modal does not re-pop disruptively (a user who has already
//   rated sees the 'already rated' state per R5, not a forced fresh rating)."
// AC-006: "...it shows an 'already rated' state that is editable (pre-filled
//   with the existing three scores) rather than an empty fresh form."
// AC-002/024: CircleScale keyboard model, integrated smoke check within the
//   modal (exhaustive matrix is Task 7's CircleScale.test.tsx).
// ROI: reserved regardless of score (this is the highest-ROI continuous-session
//   journey the whole feature exists to provide — work plan Phase 3 purpose).
// Behavior: a single continuous browser session — first arrival with
//   `?rate=auto` (fresh submit) -> rate all three parts via CircleScale
//   keyboard -> submit -> saved confirmation -> reload the same URL WITHOUT
//   the marker (simulating refresh/back/bookmark) -> the "already rated"
//   editable state, never a re-pop -> Esc/scrim/Close each close the
//   (re-opened) modal with focus returning to the inline entry-point trigger.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — getResult/getMyRating/rateExam
//   fixture-driven (same residual as FE2's header note: wiring fixture data
//   into a real running page has no existing mock-injection layer in this
//   repo; left for whoever stands up the Playwright harness).
// @complexity: high (multi-step continuous session)
// @real-dependency: none — this proves the browser-level DOM/routing/focus/
//   aria-live behavior; the underlying rateExam/getMyRating contracts are
//   proven by backend Task 6's tests, and the open-condition branching logic
//   in-process is proven by integration Test 3 (mocked next/navigation
//   router) in rating.int.test.ts.
// Primary failure mode: the modal blocks/hides the result content instead of
//   overlaying it; OR the modal context breaks CircleScale's keyboard model
//   (e.g., focus-trap interferes with roving tabindex); OR the success
//   announcement/Saved state doesn't occur; OR the reload shows a blank fresh
//   form or re-opens the modal instead of the pre-filled "already rated"
//   editable state; OR one of Esc/scrim/Close fails to close the modal or
//   loses/misplaces focus afterward.
// Proof obligation (FE1 (1)-(5), mirrors this task's Proof Obligations
//   claims 4-8):
//   (1) on first load with ?rate=auto, the modal is visible AND the result
//       content remains present in the DOM behind/around it, and the marker
//       is stripped from the URL (AC-004);
//   (2) all three CircleScale parts are keyboard-operable across 1-10 within
//       the modal, and the scale legend is visible (AC-002/024);
//   (3) after submitting three valid scores, a saved confirmation is
//       announced (aria-live) and the modal reaches its Saved state;
//   (4) reloading the same result URL WITHOUT ?rate=auto never auto-opens the
//       modal, and instead shows an "Edit your rating" inline entry point
//       pre-filled with the three just-saved scores (AC-005/006 — the
//       idempotency guarantee this feature exists to provide);
//   (5) Esc, scrim click, and the Close control each close the modal, and
//       focus returns to the inline entry-point trigger afterward.
//
// Implementation note: same `checkXxx(driver)` function-per-obligation style
// as FE2 (this file has no test-runner harness yet — see file header), run in
// order by `runFE1` as a single continuous session (the journey is inherently
// sequential: rate -> submit -> reload -> re-open -> close).

/** Fixture identifiers for this journey — a fresh submit of an exam not
 *  previously rated by the current fixture user (distinct from FE2's
 *  eligibility fixtures; FE1 exercises the result page, not /exams). */
export const FE1_EXAM_ID = "exam-fe1-fresh-submit";
export const FE1_ATTEMPT_ID = "attempt-fe1";
export const FE1_RESULT_PATH = `/exams/${FE1_EXAM_ID}/attempt/${FE1_ATTEMPT_ID}/result`;

// --- FE1 Driver (Playwright `Page`/`Locator` structural subset) ------------
// A separate, minimal interface from FE2Driver (not `extends`, to avoid
// interface-variance friction over the differing Locator return types) —
// a real Playwright Page/Locator satisfies both independently, same as FE2's
// own driver. Adds `press`/`isFocused`/`textContent`/`reload`/`getByTestId`,
// all real Playwright Page/Locator methods, needed for the keyboard
// interaction, focus-return, and aria-live assertions FE2 doesn't exercise.

export interface FE1Locator {
  click(): Promise<void>;
  /** Playwright Locator.press — focuses the element (if not already) then
   *  dispatches the given key. Used for CircleScale Arrow/End/Escape. */
  press(key: string): Promise<void>;
  isVisible(): Promise<boolean>;
  isFocused(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  textContent(): Promise<string | null>;
  count(): Promise<number>;
}

export interface FE1Driver {
  goto(url: string): Promise<void>;
  reload(): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): FE1Locator;
  getByText(text: string | RegExp): FE1Locator;
  getByTestId(testId: string): FE1Locator;
}

/** (1) On first arrival with ?rate=auto, the modal is visible AND the result
 *  content remains present in the DOM behind/around it; the marker is
 *  stripped from the URL (AC-004). */
export async function checkAutoOpenOverlaysResultContent(driver: FE1Driver): Promise<void> {
  await driver.goto(`${FE1_RESULT_PATH}?rate=auto`);

  const dialog = driver.getByRole("dialog");
  assert.equal(await dialog.isVisible(), true, "modal must auto-open on ?rate=auto arrival");

  // Result content (ScoreCard's "Result" eyebrow) stays in the DOM
  // behind/around the modal — never replaced/discarded (UI Spec AC-004
  // reconciliation note).
  const resultEyebrow = driver.getByText("Result");
  assert.equal(await resultEyebrow.isVisible(), true, "result content must remain in the DOM");

  assert.doesNotMatch(
    driver.url(),
    /[?&]rate=auto/,
    "router.replace must strip the marker from the URL on mount"
  );
}

/** (2) All three CircleScale parts are keyboard-operable across 1-10 within
 *  the modal, and the scale legend is visible (AC-002/024, integrated smoke
 *  check — the exhaustive keyboard matrix is Task 7's CircleScale.test.tsx).
 *  Ends each part committed at 10 (via End) — the exact value doesn't matter
 *  to obligations (3)/(4), only that it's the same value later assertions
 *  check for. */
export async function checkCircleScaleKeyboardOperableInModal(driver: FE1Driver): Promise<void> {
  for (const partName of ["Multiple Choice", "True / False", "Short Answer"]) {
    // Unanchored: PartCard's accessible name concatenates its eyebrow (UPPERCASE,
    // e.g. "PART I · MULTIPLE CHOICE") + score + this mixed-case name span +
    // "Rate →" — matching mixed case finds only the name span, not the eyebrow.
    await driver.getByRole("button", { name: new RegExp(partName) }).click();

    const legend = driver.getByText("RATE DIFFICULTY — 1 (EASIEST) TO 10 (HARDEST)");
    assert.equal(await legend.isVisible(), true, `${partName}: scale legend must be visible`);

    const circleOne = driver.getByRole("radio", { name: "1" });
    await circleOne.click();
    assert.equal(await circleOne.getAttribute("aria-checked"), "true");

    await circleOne.press("ArrowRight");
    const circleTwo = driver.getByRole("radio", { name: "2" });
    assert.equal(
      await circleTwo.getAttribute("aria-checked"),
      "true",
      `${partName}: ArrowRight must move checked+focus together (roving tabindex)`
    );

    await circleTwo.press("End");
    const circleTen = driver.getByRole("radio", { name: "10" });
    assert.equal(await circleTen.getAttribute("aria-checked"), "true", `${partName}: End -> 10`);

    // Commit this part's score and return to the overview for the next part.
    await driver.getByRole("button", { name: "SUBMIT RATING" }).click();
  }
}

/** (3) After submitting three valid scores, a saved confirmation is
 *  announced (aria-live) and the modal reaches its Saved state — RatingForm's
 *  "Sent" label swap, kept visible long enough by RatingModal's own
 *  SAVED_STATE_VISIBLE_MS window before it closes. */
export async function checkSubmitAnnouncesSavedState(driver: FE1Driver): Promise<void> {
  await driver.getByRole("button", { name: "SUBMIT" }).click();

  const sentLabel = driver.getByRole("button", { name: "Sent" });
  assert.equal(await sentLabel.isVisible(), true, "SUBMIT must swap to Sent on save success");

  const announcement = driver.getByText("Rating saved.");
  assert.equal(await announcement.textContent(), "Rating saved.");
}

/** (4) Reloading the same result URL WITHOUT ?rate=auto never auto-opens the
 *  modal, and instead shows an "Edit your rating" inline entry point
 *  pre-filled with the three just-saved scores (AC-005/006 — the idempotency
 *  guarantee this feature exists to provide). */
export async function checkReloadWithoutMarkerShowsEditableIdempotentState(
  driver: FE1Driver
): Promise<void> {
  await driver.goto(FE1_RESULT_PATH); // same URL, no ?rate=auto (simulates reload/back/bookmark)

  assert.equal(
    await driver.getByRole("dialog").count(),
    0,
    "the modal must stay closed on a reload without the marker"
  );

  const entryPoint = driver.getByRole("button", { name: "Edit your rating" });
  assert.equal(
    await entryPoint.isVisible(),
    true,
    "entry point must read 'Edit your rating', not a fresh empty-form prompt"
  );

  await entryPoint.click();
  assert.equal(await driver.getByRole("dialog").isVisible(), true);

  const savedScoreCount = await driver.getByText("10/10").count();
  assert.ok(savedScoreCount >= 3, "all three PartCards must show the just-saved score (10/10)");
}

/** (5) Esc, scrim click, and the Close control each close the modal, and
 *  focus returns to the inline entry-point trigger afterward. Runs against
 *  the modal (re-)opened by obligation (4) via the "Edit your rating" entry
 *  point. */
export async function checkCloseMethodsReturnFocusToTrigger(driver: FE1Driver): Promise<void> {
  const entryPoint = driver.getByRole("button", { name: "Edit your rating" });

  // Esc — modal is already open from obligation (4)'s click.
  await driver.getByRole("dialog").press("Escape");
  assert.equal(await driver.getByRole("dialog").count(), 0, "Esc must close the modal");
  assert.equal(await entryPoint.isFocused(), true, "focus must return to the trigger after Esc");

  // Scrim click.
  await entryPoint.click();
  await driver.getByTestId("rating-modal-scrim").click();
  assert.equal(await driver.getByRole("dialog").count(), 0, "scrim click must close the modal");
  assert.equal(
    await entryPoint.isFocused(),
    true,
    "focus must return to the trigger after scrim click"
  );

  // Close control.
  await entryPoint.click();
  await driver.getByRole("button", { name: "Close" }).click();
  assert.equal(await driver.getByRole("dialog").count(), 0, "Close must close the modal");
  assert.equal(await entryPoint.isFocused(), true, "focus must return to the trigger after Close");
}

/** Orchestrator — runs FE1's five proof obligations as a single continuous
 *  session (submit -> auto-open -> rate -> saved -> idempotent return ->
 *  close-method/focus-return checks) against a driver wired to a
 *  fixture-driven result-page session (see file header residual note). */
export async function runFE1(driver: FE1Driver): Promise<void> {
  await checkAutoOpenOverlaysResultContent(driver);
  await checkCircleScaleKeyboardOperableInModal(driver);
  await checkSubmitAnnouncesSavedState(driver);
  await checkReloadWithoutMarkerShowsEditableIdempotentState(driver);
  await checkCloseMethodsReturnFocusToTrigger(driver);
}
