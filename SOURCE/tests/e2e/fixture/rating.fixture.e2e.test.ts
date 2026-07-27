// Rating System [fixture-e2e]
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// UI Spec: docs/design/rating-system-ui-spec.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
//
// Test FE1 (result-page rating entry) is converted below — see the FE1
// section further down this file for its own driver interface and header
// note. 2026-07-27: FE1 used to prove an auto-open-modal journey
// (RatingModal/RatingModalController, later RatingEntry); the Result page's
// rating entry now navigates straight to the standalone /exams/[id]/rate page
// instead, so that whole dialog/auto-open surface (and the ?rate=auto marker
// that drove it) no longer exists — FE1 was rewritten to match.
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
// Test FE1 — Result-page rating entry navigates directly to the Rating page
// (2026-07-27 rewrite — replaces the old auto-open-modal journey. The Result
// page's rating entry no longer opens a popup at all: RatingModal/
// RatingModalController/RatingEntry, the ?rate=auto marker, and the dialog
// they drove are all deleted. The PRD's AC-004/005 ("...auto-opens as a
// modal...") describe that removed behavior — superseded by this product
// decision, see result/page.tsx's own 2026-07-27 comment.)
// =============================================================================
// AC-006: "...it shows an 'already rated' state that is editable..." — still
//   true in spirit: the entry point's LABEL still reflects prior-rating
//   state, it's just a plain navigation link now instead of a pre-filled
//   dialog trigger (the /rate page itself reads the prior scores server-side
//   — proven by rate/page.tsx's own getMyRating/mapFromMyRating call, not by
//   this test).
// ROI: 40 (BV:6 x Freq:6 + Legal:0 + Defect:6) — down from the old modal
//   journey's 57 now that there's no dialog/focus-trap/aria-live surface left
//   to prove at the browser level; what remains is a plain link + label.
// Behavior: on the result page, the rating entry point's label reflects
//   whether the current user already rated this exam, and clicking it
//   navigates to /exams/[id]/rate — a real page transition, never a dialog.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — getResult/getMyRating fixture-driven
//   (same residual as FE2's header note: wiring fixture data into a real
//   running page has no existing mock-injection layer in this repo).
// @complexity: low
// @real-dependency: none — this proves only the browser-level link/label
//   behavior; rateExam/getMyRating's own contracts are proven by backend
//   Task 6's tests.
// Primary failure mode: the entry point still opens an overlay/dialog instead
//   of navigating; OR the label doesn't reflect prior-rating state; OR the
//   link target is wrong (e.g. still points at the exam detail page instead
//   of the rate page).
// Proof obligation:
//   (1) with no prior rating, the entry point reads "Rate this exam", is a
//       real link (not a button) targeting /exams/[id]/rate, and clicking it
//       navigates there directly with no role="dialog" ever appearing;
//   (2) with a prior rating, the entry point reads "Edit your rating" and
//       targets the same /exams/[id]/rate URL (AC-006 contrast case).

/** Fixture identifiers for this journey (distinct from FE2's eligibility
 *  fixtures; FE1 exercises the result page, not /exams). */
export const FE1_EXAM_ID = "exam-fe1-fresh-submit";
export const FE1_ATTEMPT_ID = "attempt-fe1";
export const FE1_RESULT_PATH = `/exams/${FE1_EXAM_ID}/attempt/${FE1_ATTEMPT_ID}/result`;

// --- FE1 Driver (Playwright `Page`/`Locator` structural subset) ------------
// Much smaller than the old dialog-journey driver (no press/isFocused/reload/
// getByTestId needed — nothing left to page through, focus-trap, or reload
// idempotently; it's a link with a label and an href).

export interface FE1Locator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  count(): Promise<number>;
}

export interface FE1Driver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): FE1Locator;
}

/** (1) No prior rating -> entry point reads "Rate this exam", is a real link
 *  targeting /exams/[id]/rate, and clicking it navigates there directly with
 *  no role="dialog" ever appearing (AC-006 fresh case). */
export async function checkFreshEntryNavigatesToRatePage(driver: FE1Driver): Promise<void> {
  await driver.goto(FE1_RESULT_PATH);

  const entry = driver.getByRole("link", { name: "Rate this exam" });
  assert.equal(await entry.isVisible(), true, "fresh entry point must read 'Rate this exam'");
  assert.equal(await entry.getAttribute("href"), `/exams/${FE1_EXAM_ID}/rate`);

  await entry.click();
  assert.match(driver.url(), new RegExp(`/exams/${FE1_EXAM_ID}/rate$`));
  assert.equal(
    await driver.getByRole("dialog").count(),
    0,
    "rating must never open as a popup on the result page"
  );
}

/** (2) A prior rating -> entry point reads "Edit your rating" and still
 *  targets the same /exams/[id]/rate URL (AC-006 contrast case). */
export async function checkRatedEntryReadsEditYourRating(driver: FE1Driver): Promise<void> {
  await driver.goto(FE1_RESULT_PATH);

  const entry = driver.getByRole("link", { name: "Edit your rating" });
  assert.equal(
    await entry.isVisible(),
    true,
    "already-rated entry point must read 'Edit your rating'"
  );
  assert.equal(await entry.getAttribute("href"), `/exams/${FE1_EXAM_ID}/rate`);
}

/** Orchestrator — runs FE1's two obligations against two driver sessions: one
 *  for a user who hasn't rated this exam yet, one for a user who already has
 *  (mirrors FE2's fresh vs. logged-out dual-driver pattern). */
export async function runFE1(freshDriver: FE1Driver, ratedDriver: FE1Driver): Promise<void> {
  await checkFreshEntryNavigatesToRatePage(freshDriver);
  await checkRatedEntryReadsEditYourRating(ratedDriver);
}
