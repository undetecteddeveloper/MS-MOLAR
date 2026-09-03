// History — Full Journey [fixture-e2e] Driver Script
// Design Docs: docs/design/history-backend-design.md (v1.2), docs/design/history-frontend-design.md (v1.3)
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1)
// PRD: docs/prd/history-prd.md (v1.3, AC-001..AC-019)
// Generated (skeleton): 2026-07-30 | Filled in: Task 15 (Work Plan Phase 4.3)
//
// This repo has no @playwright/test dependency and no playwright.config.ts —
// only the Playwright MCP browser-automation server is configured (`.mcp.json`)
// for interactive/manual sessions (see the frontend Design Doc's Test
// Boundaries: "Playwright MCP / manual pass (no CI)"). Following the exact
// precedent SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts already
// established, this script is written against a minimal `HistoryDriver`
// interface that is a structural SUBSET of Playwright's real `Page`/`Locator`
// API (`goto`, `url`, `getByRole`, `getByText`, `.click`, `.getAttribute`,
// `.textContent`, `.first`, `.count`, `.allTextContents`, plus
// `waitForDownload`/`networkRequestCount` for the download/no-extra-fetch
// obligations) — a real Playwright `Page` (extended with a thin
// download/network-count helper) satisfies this interface, so once a harness
// exists this script runs unchanged, either wrapped in a `@playwright/test`
// `test()` block or driven directly via the Playwright MCP tool. Assertions
// use Node's built-in `node:assert/strict` (no new dependency).
//
// Fixture-data residual (Task 01 gap — recorded in this task's Investigation
// Notes): Task 01 (`history-work-plan-task-01.md`) was supposed to deliver
// `SOURCE/tests/e2e/fixture/historyFixtureData.ts` — a separate fixture-data
// module plus the chosen mock/override-boundary mechanism for wiring
// `listMyHistory()`/`getResult()`/`getCurrentUser()` to fixture data against a
// real `npm run dev` session. That file was never authored (confirmed absent
// from both the working tree and `git log --all` at the time this task ran).
// Rather than importing from a file that doesn't exist (out of this task's own
// Target Files — creating a new fixture module is not listed), the four
// fixture-data profiles (empty-list, null-user, error-throwing, valid
// multi-row) are defined directly in this file instead, mirroring the
// convention `rating.fixture.e2e.test.ts` already established for its own
// FIXTURE_EXAMS/FIXTURE_SUBMITTED_EXAM_IDS/FIXTURE_USER (defined inline, not in
// a separate module). This is a local, reversible construct: nothing here
// depends on a nonexistent module, and if `historyFixtureData.ts` is authored
// later, the profiles below can be swapped for an import unchanged in shape.
// The `FixtureBackend` interface below documents the exact override-boundary
// contract (call-count spies + reconfigurable throw/reject behavior) a real
// harness must expose over `listMyHistory()`/`getCurrentUser()`/
// `generateAttemptPdfFile()`; `createInMemoryFixtureBackend()` is a
// deterministic reference implementation of that contract.
//
// Sequencing note (task file's own explicit decision, not resolved by the Work
// Plan itself): the Work Plan's Task Dependency Diagram places this task (4.3)
// *before* Phase 5 (nav wiring, Tasks 16/17). At the point this task runs,
// SiteHeader's "History" nav item still has `href="#"` (confirmed:
// SOURCE/features/exams/components/SiteHeader.tsx:27) — clicking it would not
// navigate anywhere. Every navigation step below (including the "return to
// History" step) uses `driver.goto("/history")` directly instead of clicking
// the nav item. HE1 obligation (f) (nav active-highlight) is recorded as
// expected-pending here, not silently marked passing or dropped — see
// `checkHE1NavActiveHighlightExpectedPending` below.
//
// Cross-surface consistency finding (HE1 obligation (e)): the Result page's
// `ScoreCard` (SOURCE/features/exams/components/ScoreCard.tsx) renders score
// (`{totalScore}/10`) and completion time, but — unlike HistoryRow — never
// renders the submitted date; `submittedAt` is used only for
// `formatCompletionTime`'s diff calc and the PDF's own content, never as a
// visible date string on the Result page itself. This is a fact about the
// already-shipped Task 12 UI (ScoreCard.tsx is out of this task's Target
// Files), not a scope reduction chosen here — so the cross-surface comparison
// below checks the two fields both surfaces actually render (score +
// completion time), not date.

import assert from "node:assert/strict";
import { formatCompletionTime } from "@/lib/history/format";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface HistoryLocator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  textContent(): Promise<string | null>;
  first(): HistoryLocator;
  count(): Promise<number>;
  allTextContents(): Promise<string[]>;
}

export interface HistoryDriver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): HistoryLocator;
  getByText(text: string | RegExp): HistoryLocator;
  /** Structural analogue of Playwright's `page.waitForEvent("download")` —
   *  resolves with the observed download once `action` triggers one; `null`
   *  if none fires within the harness's own timeout. */
  waitForDownload(action: () => Promise<void>): Promise<{ filename: string } | null>;
  /** Cumulative count of fetch/XHR requests the harness has observed since
   *  the current page's navigation started. */
  networkRequestCount(): Promise<number>;
}

// --- Fixture data -----------------------------------------------------------
// See the "Fixture-data residual" header note above — these profiles stand in
// for Task 01's undelivered historyFixtureData.ts, matching MyHistoryEntry's
// exact field shape (SOURCE/app/(HM)/queries.ts).

export interface FixtureHistoryEntry {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string;
}

/** Valid multi-row profile — newest-first order, spanning distinct
 *  submitted_at values (AC-001/003/004). */
export const FIXTURE_HISTORY_VALID: readonly FixtureHistoryEntry[] = [
  {
    attemptId: "attempt-fixture-2",
    examId: "exam-fixture-geometry",
    examTitle: "Geometry Intro",
    subject: "Toán",
    totalScore: 9.0,
    startedAt: "2026-07-20T09:00:00.000Z",
    submittedAt: "2026-07-20T09:15:00.000Z",
  },
  {
    attemptId: "attempt-fixture-1",
    examId: "exam-fixture-algebra",
    examTitle: "Algebra Basics",
    subject: "Toán",
    totalScore: 7.5,
    startedAt: "2026-07-15T08:00:00.000Z",
    submittedAt: "2026-07-15T08:32:00.000Z",
  },
];

/** Empty-list profile (AC-002). */
export const FIXTURE_HISTORY_EMPTY: readonly FixtureHistoryEntry[] = [];

/** Logged-in fixture user (null-user profile is simply `setCurrentUser(null)`, AC-016). */
export const FIXTURE_USER = { id: "user-history-fixture-1", email: "fixture-history@example.com" };

/** Documents the override-boundary contract a real harness must expose over
 *  listMyHistory()/getCurrentUser()/generateAttemptPdfFile() — call-count
 *  spies (HE2(b)/HE3(a) require observing exact call counts) plus
 *  reconfigurable throw/reject behavior (HE3(a)/(b)'s error-throwing
 *  profile). This is the same shape Task 01 was meant to hand off. */
export interface FixtureBackend {
  listMyHistoryCallCount: number;
  generateAttemptPdfCallCount: number;
  setCurrentUser(user: typeof FIXTURE_USER | null): void;
  setHistoryEntries(entries: readonly FixtureHistoryEntry[]): void;
  configureListMyHistoryToThrow(shouldThrow: boolean): void;
  configureGenerateAttemptPdfToReject(shouldReject: boolean): void;
  /** Called by the real harness's request-interception layer in place of the
   *  real getCurrentUser() call — returns the currently configured fixture user. */
  simulateGetCurrentUser(): typeof FIXTURE_USER | null;
  /** Called by the real harness's interception layer in place of the real
   *  listMyHistory() call — increments the call-count spy, then returns the
   *  configured entries or throws, per the currently configured profile. */
  simulateListMyHistory(): FixtureHistoryEntry[];
  /** Called by the real harness's interception layer in place of the real
   *  generateAttemptPdfFile() call — increments the call-count spy, then
   *  resolves or rejects per the currently configured profile. */
  simulateGenerateAttemptPdf(): void;
}

/** Deterministic in-memory reference implementation of FixtureBackend — no
 *  real-clock timing, fixed fixture data only (Refactor Phase requirement).
 *  A real harness wires these same counters/flags to the actual
 *  listMyHistory()/getCurrentUser()/generateAttemptPdfFile() call sites (each
 *  intercepted call delegates to the matching `simulateXxx` method here,
 *  which is what actually reads the configured user/entries/throw-reject
 *  state and increments the corresponding call-count spy). */
export function createInMemoryFixtureBackend(): FixtureBackend {
  let currentUser: typeof FIXTURE_USER | null = FIXTURE_USER;
  let entries: readonly FixtureHistoryEntry[] = FIXTURE_HISTORY_VALID;
  let shouldThrowOnList = false;
  let shouldRejectOnGenerate = false;

  const backend: FixtureBackend = {
    listMyHistoryCallCount: 0,
    generateAttemptPdfCallCount: 0,
    setCurrentUser(user) {
      currentUser = user;
    },
    setHistoryEntries(next) {
      entries = next;
    },
    configureListMyHistoryToThrow(shouldThrow) {
      shouldThrowOnList = shouldThrow;
    },
    configureGenerateAttemptPdfToReject(shouldReject) {
      shouldRejectOnGenerate = shouldReject;
    },
    simulateGetCurrentUser() {
      return currentUser;
    },
    simulateListMyHistory() {
      backend.listMyHistoryCallCount += 1;
      if (shouldThrowOnList) throw new Error("fixture: simulated list-read failure");
      return [...entries];
    },
    simulateGenerateAttemptPdf() {
      backend.generateAttemptPdfCallCount += 1;
      if (shouldRejectOnGenerate) throw new Error("fixture: simulated PDF-generation failure");
    },
  };
  return backend;
}

// =============================================================================
// Obligation group HE1 (reserved fixture-e2e slot) — History list -> Save/
// Share on a row -> View details -> Result page -> Save/Share on Result page,
// cross-surface consistency
// =============================================================================
// See file header for the full journey narrative, ROI, and ADR-scale context
// (unchanged from the skeleton — ROI 105, ADR/PRD references there).

export interface HE1Context {
  selectedRow: { examId: string; attemptId: string };
  historyRowScoreText: string;
  historyRowTimeText: string;
}

/** (a) AC-001/003/004 — /history renders N rows in fixture (newest-first)
 *  order, each with exam title, X/10 score, and a non-placeholder completion
 *  time (computed via the shared lib/history/format.ts formatter, not
 *  reimplemented here — Reference Contract). */
export async function checkHE1RendersRowsNewestFirst(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<HE1Context> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(false);

  await driver.goto("/history");

  const rows = driver.getByRole("listitem");
  assert.equal(
    await rows.count(),
    FIXTURE_HISTORY_VALID.length,
    "rendered row count must equal fixture entry count"
  );

  const rowTexts = await rows.allTextContents();
  FIXTURE_HISTORY_VALID.forEach((entry, i) => {
    const text = rowTexts[i];
    const scoreText = `${entry.totalScore.toFixed(1)}/10`;
    const timeText = formatCompletionTime(entry.startedAt, entry.submittedAt);
    assert.ok(text.includes(entry.examTitle), `row ${i} must show exam title "${entry.examTitle}"`);
    assert.ok(text.includes(scoreText), `row ${i} must show score "${scoreText}"`);
    assert.ok(text.includes(timeText), `row ${i} must show completion time "${timeText}"`);
    assert.ok(
      !text.includes("—"),
      `row ${i} must not show the placeholder em-dash for a complete fixture row`
    );
  });

  const firstEntry = FIXTURE_HISTORY_VALID[0];
  return {
    selectedRow: { examId: firstEntry.examId, attemptId: firstEntry.attemptId },
    historyRowScoreText: `${firstEntry.totalScore.toFixed(1)}/10`,
    historyRowTimeText: formatCompletionTime(firstEntry.startedAt, firstEntry.submittedAt),
  };
}

/** (b) AC-009 — clicking Save (inside the row's ⋯ menu, front-adjust:
 *  HistoryRow now consolidates Save/Share/View details behind a single
 *  HistoryRowMenu trigger) triggers a download built only from that row's
 *  already-rendered data; no extra network call fires. */
export async function checkHE1SaveTriggersDownloadNoExtraFetch(
  driver: HistoryDriver
): Promise<void> {
  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const saveItem = driver.getByRole("menuitem", { name: "Save" }).first();
  const requestsBefore = await driver.networkRequestCount();

  const download = await driver.waitForDownload(() => saveItem.click());
  assert.ok(download, "clicking Save must trigger an observable download");

  const requestsAfter = await driver.networkRequestCount();
  assert.equal(
    requestsAfter,
    requestsBefore,
    "Save must not trigger any network/fetch call beyond what the page already loaded"
  );
}

/** (c) AC-005 — "View details" (inside the row's ⋯ menu) on a specific row
 *  navigates to that EXACT attempt's Result page, not merely any Result
 *  page. The menu closed itself after (b)'s successful Save (auto-close on
 *  success), so it is reopened here. */
export async function checkHE1ViewDetailsNavigatesToExactAttempt(
  driver: HistoryDriver,
  ctx: HE1Context
): Promise<void> {
  const expectedPath = `/exams/${ctx.selectedRow.examId}/attempt/${ctx.selectedRow.attemptId}/result`;
  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const viewDetailsLink = driver.getByRole("menuitem", { name: "View details" }).first();
  assert.equal(await viewDetailsLink.getAttribute("href"), expectedPath);

  await viewDetailsLink.click();
  assert.equal(driver.url(), expectedPath, "post-click URL must match the exact attempt clicked");
}

/** (d) AC-014 — on the landed Result page, ResultActions' Save/Share are
 *  enabled <button>s (aria-disabled="false", no native disabled attribute),
 *  with no "coming soon" text anywhere. */
export async function checkHE1ResultActionsNoComingSoon(driver: HistoryDriver): Promise<void> {
  const saveButton = driver.getByRole("button", { name: "Save" }).first();
  const shareButton = driver.getByRole("button", { name: "Share" }).first();

  assert.equal(await saveButton.getAttribute("aria-disabled"), "false");
  assert.equal(await shareButton.getAttribute("aria-disabled"), "false");
  assert.equal(
    await saveButton.getAttribute("disabled"),
    null,
    "Save must never carry a native disabled attribute"
  );
  assert.equal(
    await shareButton.getAttribute("disabled"),
    null,
    "Share must never carry a native disabled attribute"
  );
  assert.equal(await driver.getByText(/coming soon/i).count(), 0);
}

/** (e) Cross-surface consistency (AC-007's spirit) — the score/completion-time
 *  text the Result page's ScoreCard shows for this attempt is textually
 *  identical to what the History row showed for the same attempt. Submitted
 *  date is excluded from this comparison — ScoreCard has no date cell (see
 *  file header finding); this reflects the two surfaces' actual rendered
 *  content, not a narrowed check. */
export async function checkHE1CrossSurfaceConsistency(
  driver: HistoryDriver,
  ctx: HE1Context
): Promise<void> {
  const scoreOnResultPage = driver.getByText(ctx.historyRowScoreText);
  assert.ok(
    (await scoreOnResultPage.count()) >= 1,
    `Result page ScoreCard must show the identical score text "${ctx.historyRowScoreText}" the History row showed`
  );

  const timeOnResultPage = driver.getByText(ctx.historyRowTimeText);
  assert.ok(
    (await timeOnResultPage.count()) >= 1,
    `Result page ScoreCard must show the identical completion-time text "${ctx.historyRowTimeText}" the History row showed`
  );
}

/** (f) AC-015 — closed by Task 18 (Final QA sweep). Phase 5 (Tasks 16/17)
 *  landed: SiteHeader.tsx:27/HomeSidebar.tsx:22 both now carry
 *  `href: "/history"` (confirmed absent of any remaining `href === "#"` for
 *  the History nav item), so SiteHeader.tsx:64's `item.href !== "#"` guard no
 *  longer suppresses the active-highlight signal on `/history*` routes. This
 *  was previously "expected-pending" (Task 15, pre-Phase-5) — now asserted
 *  for real, closing that deferred obligation. */
export async function checkHE1NavActiveHighlight(driver: HistoryDriver): Promise<void> {
  await driver.goto("/history");
  const historyNav = driver.getByRole("link", { name: "History" });
  assert.equal(
    await historyNav.getAttribute("aria-current"),
    "page",
    'History nav item must carry aria-current="page" while on /history (AC-015)'
  );
}

/** Orchestrator — runs HE1's full journey in sequence, threading the selected
 *  row's identity across steps. */
export async function runHE1(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  const ctx = await checkHE1RendersRowsNewestFirst(driver, backend); // (a)
  await checkHE1SaveTriggersDownloadNoExtraFetch(driver); // (b)
  await checkHE1ViewDetailsNavigatesToExactAttempt(driver, ctx); // (c)
  await checkHE1ResultActionsNoComingSoon(driver); // (d)
  await checkHE1CrossSurfaceConsistency(driver, ctx); // (e)
  await checkHE1NavActiveHighlight(driver); // (f) — closed, Phase 5 landed
}

// =============================================================================
// Obligation group HE2 — Empty state + guest access guard
// =============================================================================
// AC-002/AC-016 — see file header / skeleton comments preserved in git history
// for full ROI and behavior narrative.

/** (a) AC-002 — with an empty fixture, /history shows "No results yet" text
 *  and a "Browse exams" link to /exams, with zero role="alert" elements. */
export async function checkHE2EmptyStateRendersCallToAction(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_EMPTY);
  backend.configureListMyHistoryToThrow(false);

  await driver.goto("/history");

  const emptyStateText = driver.getByText("No results yet");
  assert.equal(await emptyStateText.isVisible(), true);

  const browseLink = driver.getByRole("link", { name: "Browse exams" });
  assert.equal(await browseLink.getAttribute("href"), "/exams");
  assert.equal(await driver.getByRole("alert").count(), 0);
}

/** (b) AC-016 — with no fixture session, /history redirects to
 *  /?auth=signin before any attempt-row read fires (call-count spy stays 0). */
export async function checkHE2GuestRedirectsWithZeroListReads(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(null);
  const callsBefore = backend.listMyHistoryCallCount;

  await driver.goto("/history");

  assert.equal(driver.url(), "/?auth=signin");
  assert.equal(
    backend.listMyHistoryCallCount,
    callsBefore,
    "no attempt-row read may fire before the guest guard redirects"
  );
  assert.equal(backend.listMyHistoryCallCount, 0);
}

export async function runHE2(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  await checkHE2EmptyStateRendersCallToAction(driver, backend);
  await checkHE2GuestRedirectsWithZeroListReads(driver, backend);
}

// =============================================================================
// Obligation group HE3 — List-read error state + PDF-generation error state,
// both retryable
// =============================================================================
// AC-018/AC-019 — see file header / skeleton comments preserved in git history
// for full ROI and behavior narrative.

/** (a) AC-019 — a simulated list-read failure renders (HM)/history/error.tsx's
 *  role="alert" + "Retry"; clicking Retry re-attempts the read (call-count
 *  spy increments by exactly 1). */
export async function checkHE3ListReadFailureRendersErrorAndRetries(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(true);

  await driver.goto("/history");

  const alert = driver.getByRole("alert");
  assert.equal(await alert.isVisible(), true);
  assert.equal(await alert.textContent(), "Couldn't load your history right now.");

  const callsBefore = backend.listMyHistoryCallCount;
  // AC-019 says the failure is retryable — reconfigure to succeed before the
  // click so Retry's re-attempt is observable via the call-count spy alone.
  backend.configureListMyHistoryToThrow(false);
  const retryButton = driver.getByRole("button", { name: "Retry" });
  await retryButton.click();

  assert.equal(backend.listMyHistoryCallCount, callsBefore + 1);
}

/** (b) AC-018 — a simulated PDF-generation failure renders role="alert"
 *  inside the row's ⋯ menu (front-adjust: HistoryRowMenu keeps the menu open
 *  on error rather than auto-closing, so the item stays reachable), stays
 *  retryable (aria-disabled="false"), and a follow-up click (fixture
 *  reconfigured to succeed) completes normally. */
export async function checkHE3PdfGenerationFailureRetryable(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(false);
  backend.configureGenerateAttemptPdfToReject(true);

  await driver.goto("/history");

  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const saveItem = driver.getByRole("menuitem", { name: "Save" }).first();
  await saveItem.click();

  const alert = driver.getByRole("alert").first();
  assert.equal(await alert.textContent(), "Couldn't generate the PDF. Try again.");
  assert.equal(await saveItem.getAttribute("aria-disabled"), "false");

  backend.configureGenerateAttemptPdfToReject(false);
  const download = await driver.waitForDownload(() => saveItem.click());
  assert.ok(download, "the retry click (fixture reconfigured to succeed) must complete normally");
}

export async function runHE3(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  await checkHE3ListReadFailureRendersErrorAndRetries(driver, backend);
  await checkHE3PdfGenerationFailureRetryable(driver, backend);
}

// =============================================================================
// AC-007 structural tripwire cross-file half (deferred from Task 10)
// =============================================================================
// Completed as an in-process unit check inside
// SOURCE/components/history/ActionButton.test.tsx (Task 15) rather than here —
// its own Boundary to exercise is "in-process unit (static source-text
// search)", not fixture-e2e, per this task's Proof Obligations. Not
// duplicated in this file.
