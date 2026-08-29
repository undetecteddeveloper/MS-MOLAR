// @vitest-environment jsdom

// Essay (Tự luận) Auto-Scoring — FIXTURE-E2E lane skeleton
// Design Docs: docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134, § Feature-Off Window :1605, § EssayGradingPoller
//                mount condition F-05 :1383)
//              docs/design/essay-auto-scoring-backend-design.md (v1.3, § Cờ tính
//                năng :2011)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3, RS-0..RS-6 :333,
//                usePdfAction :643, ActionButton :681, HistoryRowMenu :708,
//                Copy Inventory :822, Golden States :966)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-012, AC-023, AC-057,
//                AC-058, AC-064, AC-067)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted; Amendment
//                to ADR-0010 — the three surfaces that must respect a moving score)
// Generated:   2026-08-29 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// ALL THREE CASES BELOW ARE SKELETONS (`it.todo`). Nothing here renders anything
// yet, and no component in this feature exists.
//
// HOW THIS LANE RUNS: `npm run test:fixture` (from `SOURCE/`), i.e.
// `vitest run --config vitest.fixture.config.ts`. That config globs the whole
// directory (`tests/e2e/fixture/**/*.test.{ts,tsx}`), so THIS FILE IS COLLECTED
// FROM THE MOMENT IT IS COMMITTED and needs no config edit. That is exactly why
// the cases are `it.todo` and not bare comments: a collected file with zero tasks
// makes vitest report "No test suite found in file" and exit 1 — which is the
// failure mode the six DRIVER SCRIPTS in this directory are excluded by name to
// avoid (`vitest.fixture.config.ts:45-52`). Do NOT add this file to that exclude
// list; `it.todo` already keeps the lane green, and being excluded is how a case
// gets written, reviewed and merged without ever executing.
//
// WHY THIS LANE AND NOT A PLAYWRIGHT DRIVER SCRIPT. The six shipped siblings here
// (`history.`, `rating.`, `short-answer-scoring.`, three `support-*.`) are written
// against a structural subset of Playwright's API and NOTHING EXECUTES THEM — the
// repo has no `@playwright/test` and no `playwright.config.ts`. The one case shape
// in this directory that actually runs is `subscription.fixture.e2e.test.ts`: an
// IN-PROCESS render of the REAL route tree (RootLayout -> route-group layout ->
// page), with only the action module and the data sources stubbed, real
// dictionaries, no MSW, no database, no network. All three cases below take that
// shape. It is the only shape in this repo that can discharge the claims below,
// because every one of them is a claim about what the PAGE composes — not about
// what a component renders when handed props by a test.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to all three cases
// -----------------------------------------------------------------------------
// Frontend DD § Mock Boundary Decisions (:2136) is the authority:
//   MOCKED  — `next/navigation` (`useRouter().refresh`), so refreshes are COUNTED
//             exactly (precedent `RecheckOrderControl.test.tsx:55`);
//             `retryEssayGrading()` Server Action; `lib/pdf/generateAttemptPdf`
//             (jsPDF + html2canvas do not run in jsdom); the two data sources the
//             page/row read (`getResult()`, `listMyHistory()`), stubbed to return
//             hand-built `ExamResult` / `MyHistoryEntry[]` fixtures.
//   STUBBED — `document.visibilityState` via `Object.defineProperty`.
//   REAL    — `deriveEssayView()`, `summariseEssays()`, `isEssayIncomplete()`;
//             `useT()`/`getTranslate()` and BOTH dictionaries (so cases assert the
//             right KEY resolved to the right string, not "some string");
//             `EssayLifecycleBadge`; the layouts, providers and formatters.
//   ZERO PROVIDER CALLS — grading ships DISABLED behind the AC-067 human gate
//             (Groq Zero Data Retention) and NO GROQ ACCOUNT EXISTS. No case in
//             this file has a network boundary at all: the band is a FIXTURE VALUE
//             in the stubbed `ExamResult`. FE2E-1 additionally asserts the count of
//             `router.refresh()` calls is zero, which is the client-side half of
//             "flag off => nothing is set in motion".
// @real-dependency: none. This lane needs no database and no credentials.
//
// -----------------------------------------------------------------------------
// TWO HAZARDS THAT MAKE A GREEN CASE MEANINGLESS — read before writing assertions
// -----------------------------------------------------------------------------
// (1) EMPTY-TREE VACUOUS PASS. `render(await Component())` returns an EMPTY TREE
//     when the awaited server component has an async child, and every
//     `expect(queryBy…).toBeNull()` written against it PASSES AGAINST NOTHING.
//     `EssayScoreLine` and `EssayReviewBlock` are both async AND have an async
//     child (`EssayLifecycleBadge`), so they land squarely in it. Any case
//     rendering either MUST use `renderServerTree()` AND carry at least one
//     POSITIVE assertion (`getByText`/`getByRole` that succeeds), so an empty tree
//     is always red. Frontend DD § Early Verification Point makes this a rule for
//     the whole slice, not advice.
//     PATH CORRECTION, verified in the tree on 2026-08-29: the helper is at
//     `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`.
//     `SOURCE/lib/test/renderServerTree.tsx` DOES NOT EXIST — frontend DD :2158
//     names it as the destination on the THIRD consumer, and this slice is the
//     second. Import from the existing path, or move the helper and update the
//     orders test in the same commit; do not import a path that is not there.
// (2) FAKE-TIMER / REAL-TIMER COLLISION IN ONE FILE. FE2E-2 requires
//     `vi.useFakeTimers()` (the poller is a nested-setTimeout loop; frontend DD
//     :2160 pins the harness and forbids `waitFor` there). FE2E-3 must NOT use
//     fake timers. Scope the fake clock to FE2E-2's own `describe` with
//     `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => { cleanup();
//     vi.useRealTimers(); })` — a file-level fake clock would hang FE2E-3's menu
//     interactions.
//
// -----------------------------------------------------------------------------
// SELECTION — why these three
// -----------------------------------------------------------------------------
//   FE2E-1  108  feature-off byte-for-byte across S-01 + S-02  <- selected (rank 1)
//   FE2E-2   81  last essay resolves: announcement + unblock    <- selected, RESERVED
//                 (highest-ROI user-facing multi-step journey)
//   FE2E-3   72  PDF guard at BOTH exits, one attempt           <- selected (rank 3)
//   (F-4)    40  RS-6 retry control aria-disabled + click no-op <- NOT selected here;
//                 PUSHED DOWN to the component lane
//                 (`EssayRegradeControl.test.tsx`, `npm test`), which proves the
//                 whole aria-disabled idiom more cheaply. The ONE part a component
//                 test cannot prove — the control survives a `router.refresh()`
//                 without unmounting — is folded into FE2E-2 obligation (f).
//   (F-5)    64  RS-0..RS-6 render matrix on /result/detail     <- NOT selected;
//                 it is one component's state x display table, owned by the
//                 component lane per frontend DD § Phân tầng.

import { describe, it } from "vitest";

// =============================================================================
// FE2E-1 — The shipped state: flag off, four surfaces byte-for-byte as today
// =============================================================================
// AC: FE-AC-14 — "When NO element of the attempt carries the essayState key, the
//   result page MUST NOT insert any new node: no EssayScoreLine, no running
//   poller, no change to ScoreCard." (AC-012)
// AC: FE-AC-13 — "When a per_question element does not carry essayState (legacy
//   row, feature off, or a question with no model answer), the question card MUST
//   render BYTE-FOR-BYTE as before this change: 'Bạn trả lời:' / 'Đáp án đã lưu:' /
//   the result.notAutoScored label." (AC-012/AC-018)
// Also discharges: PRD AC-067; UI Spec Golden States 7, 8, 10; frontend DD
//   § Feature-Off Window (S-01, S-02, PDF file) and its testable promise F-09:
//   "poller does not mount, schedules no timer, calls router.refresh() zero times";
//   frontend DD § Output Comparison column "tính năng tắt".
// ROI: 108 (BV:10 x Freq:10 + Legal:0 + Defect:8)
//   BV 10 — this is the state the feature SHIPS in, and it may ship in it for a
//     long time: AC-067 is a human gate on a Groq account that does not exist yet.
//     Everything else in this file describes a state no user has reached.
//   Freq 10 — every student opening any result page, today and for the whole
//     feature-off window.
//   Defect 8 — a regression here is a regression to a SHIPPED, working page,
//     caused by a feature that is supposed to be switched off. It is also the one
//     defect class a reviewer is least likely to look for.
// Behavior: the real route tree for /result and /result/detail is composed with a
//   stubbed `getResult()` returning a LEGACY ExamResult (no essay* keys anywhere,
//   `essaySummary === undefined`, every `PerQuestionResult.essay === undefined`) ->
//   the page renders -> no essay node exists, no timer is scheduled, and the essay
//   card is the unchanged not-auto-scored branch.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-UI in-process (RootLayout -> (layer2) layout -> result/page.tsx
//   and result/detail/page.tsx), mocked backend (getResult stub), mocked
//   next/navigation, mocked generateAttemptPdf
// @complexity: medium
// @real-dependency: none
// Primary failure mode: `EssayGradingPoller` is mounted unconditionally (or on a
//   predicate that is true for `undefined`), so every legacy result page in
//   production starts a `router.refresh()` loop that re-renders the page 30 times
//   for no reason — invisible on screen, expensive in RSC requests, and reported by
//   nobody because nothing looks wrong. The second mode: `EssayScoreLine` returns
//   an empty fragment rather than `null`, inserting a node into the `gap-5` column
//   and shifting the vertical rhythm of a shipped page.
// Proof obligation — what the implemented test must assert:
//   (a) POSITIVE FIRST (hazard 1): assert the page actually rendered — the
//       ScoreCard's score text and the essay card's `result.notAutoScored` string
//       are both found by `getByText`. Every negative assertion below is only
//       meaningful after this one passes.
//   (b) No essay node: none of the badge strings resolved from the REAL dictionary
//       (`result.essay.state.pending` = "Đang chấm", `.graded` = "Đã chấm",
//       `.failed` = "Chấm thất bại") and none of `result.essay.label`,
//       `result.essay.points`, `result.essay.denominator` appear anywhere in the
//       container. Assert on the resolved strings via the real dictionary, not on
//       component names or test ids.
//   (c) Zero timers, zero refreshes — the three-part promise F-09 states as
//       testable: `vi.getTimerCount()` is 0 immediately after render, advancing the
//       clock by 200_000 ms schedules nothing, and the counted `refresh` mock has
//       been called 0 times. (This is the one place FE2E-1 needs a fake clock; keep
//       it inside this describe.)
//   (d) The essay card is the UNCHANGED shared branch: "Bạn trả lời:" and
//       "Đáp án đã lưu:" are both present, `result.notAutoScored` is present, and
//       NO correct/incorrect chip is rendered on it.
//   (e) PDF controls are open, not blocked: both PDF controls carry
//       `aria-disabled="false"` and the sr-only reason element they point at does
//       NOT contain `result.essay.pdfBlocked`.
//   (f) ScoreCard 0-diff (ADR-0018 Amendment, UI-D3): the ScoreCard subtree's
//       rendered text is toEqual an independently authored literal — score to one
//       decimal + "/10", "Đúng" = correct, "Sai" = total - correct — computed from
//       the fixture by hand. `ScoreCard.tsx` is declared a 0-diff zone; this is the
//       automated half of that declaration.
describe("Feature off — /result and /result/detail render as today (FE2E-1)", () => {
  it.todo("inserts no essay node, mounts no poller, schedules no timer and calls router.refresh() zero times for an attempt with no essayState keys, while the not-auto-scored branch and ScoreCard render unchanged");
});

// =============================================================================
// FE2E-2 — RESERVED SLOT (journey). The render where the LAST essay resolves:
//          the aria-live region is still mounted, and the PDF controls unblock
//          in place without moving focus
// =============================================================================
// AC: FE-AC-16 — "When the number of unresolved questions DECREASES between two
//   renders, the poller's aria-live='polite' region MUST receive exactly one
//   sentence; when it does not decrease, that region MUST be empty." (AC-023)
// AC: PRD AC-023 — the landing band is announced, and focus is neither stolen nor
//   lost.
// AC: FE-AC-05 — "When every essay question is resolved, both Save and Share
//   (S-01) and both PDF items in the ⋯ menu (S-03) MUST carry aria-disabled='false'
//   and one click MUST call generateAttemptPdfFile exactly once." (AC-058)
// Also discharges: frontend DD F-05 (the mount predicate is
//   `essaySummary !== undefined`, NOT `pendingCount > 0`), the poller cases P-1/P-6,
//   the three aria-live cases, UI-D5's "never removed from the tree" rule.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — this is the feature's whole promise to a student who cannot see the
//     screen: the score arrived. If the region is unmounted on the render that
//     resolves the last essay, the announcement has nowhere to land and is never
//     read; the visual user is unaffected, so nothing reports it.
//   Freq 8 — every graded attempt passes through this exact transition once.
//   Defect 9 — the UI Spec's own first formulation of the mount predicate
//     (`pendingCount > 0`) CAUSES this defect; it was caught in review (F-05) and
//     corrected. A test written against the natural-looking predicate is how it
//     comes back.
//   RESERVED-SLOT JUSTIFICATION: highest-ROI user-facing multi-step journey in the
//   feature — /result renders with pending essays, state carries across a
//   router.refresh() boundary, and the journey has a completion point (all essays
//   resolved, PDF unblocked). Emitted regardless of threshold; it also clears it.
//   WHY IT IS NOT service-integration-e2e: nothing here needs a real DB write, a
//   real event or a real external call. The band's arrival is modelled by the
//   stubbed `getResult()` returning a DIFFERENT fixture on the second call — which
//   is also the only way to hit the transition deterministically.
// Behavior: the real /result route tree renders with `essaySummary.pendingCount`
//   = 1 -> the fake clock advances one poll interval -> the counted `refresh` mock
//   fires and the stubbed `getResult()` now returns the all-resolved fixture ->
//   the page re-renders IN PLACE -> the still-mounted aria-live region receives
//   `result.essay.announceAllDone`, and the PDF controls flip to unblocked without
//   any control being unmounted.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-UI in-process (result/page.tsx composing EssayScoreLine +
//   EssayGradingPoller), mocked next/navigation (counted refresh), mocked
//   getResult (two-phase fixture), mocked generateAttemptPdf, fake timers
// @complexity: high
// @real-dependency: none
// Primary failure mode: the poller's mount condition is written as
//   `pendingCount > 0` (the shape the UI Spec first published), so on the render
//   where the last essay resolves the component unmounts, the `aria-live` region
//   leaves the DOM in the same commit as the sentence would have been inserted,
//   and the completion is never announced. A test that renders the resolved state
//   DIRECTLY passes — the region is absent in both the correct and the broken
//   implementation at that instant; only the TRANSITION distinguishes them, which
//   is why this case must drive the page through the transition rather than assert
//   on the end state.
// Proof obligation — what the implemented test must assert:
//   (a) BEFORE: with pendingCount 1, the aria-live region exists
//       (`container.querySelector('[aria-live="polite"]')` is non-null) and is
//       EMPTY. Assert emptiness on textContent, not on absence of the node.
//   (b) TRANSITION, driven not asserted-around: advance exactly one interval inside
//       `act()` (frontend DD :2160 — nested setTimeout means each tick needs its
//       own advance; a single long advance leaves React no commit point), let the
//       second `getResult()` fixture render.
//   (c) AFTER: the SAME aria-live node is still in the document (compare node
//       identity with the reference captured in (a) — a remount that happens to
//       re-add an equivalent node is the defect, and a selector-based re-query
//       cannot tell the two apart), and its textContent now equals
//       `result.essay.announceAllDone` = "Đã chấm xong toàn bộ câu tự luận."
//       resolved through the REAL dictionary.
//   (d) NEGATIVE CONTROL in the same case: a refresh where pendingCount does NOT
//       decrease leaves the region empty. Without this, (c) passes for an
//       implementation that announces on every tick — which is the AC-023 defect
//       from the other direction (a screen reader interrupting on every poll).
//   (e) UNBLOCK IN PLACE: after the transition both PDF controls carry
//       `aria-disabled="false"`, and one click calls the mocked
//       `generateAttemptPdfFile` EXACTLY ONCE (not "at least once" — the dogpile
//       guard is the reason for the exact count).
//   (f) NO CONTROL WAS UNMOUNTED across the transition (this is the folded-in part
//       of the pushed-down F-4, and the automatable half of AB-5/R-F3): capture
//       the DOM nodes of the PDF control and of any retry control before the
//       refresh and assert the same node objects are still connected
//       (`node.isConnected === true`) afterwards. RECORDED LIMIT, state it at the
//       assertion: jsdom has no real `router.refresh()` and no painted focus ring,
//       so this proves the NECESSARY condition (nothing was unmounted) and not the
//       SUFFICIENT one (focus actually survived in a browser). The sufficient half
//       stays with the manual browser pass; do not let this case's name claim it.
//   Determinism: fake timers only, no `waitFor` anywhere in this describe
//   (`waitFor` + fake timers is the standing hang in this repo), all clock movement
//   through `vi.advanceTimersByTime` inside `act()`.
describe("Last essay resolves — announcement lands and PDF unblocks in place (FE2E-2)", () => {
  it.todo("keeps the aria-live region mounted across the render that resolves the final essay, inserts announceAllDone exactly once, stays silent on a refresh that resolves nothing, and unblocks both PDF controls without unmounting them");
});

// =============================================================================
// FE2E-3 — One attempt, two PDF exits, one answer: both blocked, both readable,
//          zero generator calls, and the way out stays open
// =============================================================================
// AC: FE-AC-10 — "When the attempt still has >= 1 unresolved question and the
//   student presses Save or Share, there MUST BE NO call to generateAttemptPdfFile,
//   `phase` MUST stay 'idle', and NO error node may appear." (AC-058)
// AC: FE-AC-11 — "When the attempt still has >= 1 unresolved question, both PDF
//   controls MUST still be focusable and their accessible names MUST be accompanied
//   by result.essay.pdfBlocked through aria-describedby." (AC-058, UI-D5)
// AC: FE-AC-21 — "In EVERY state of this feature, NO element in the essay tree may
//   carry the `disabled` attribute, and no displayed string may contain a number of
//   remaining grading attempts." (UI-D5, UI-D9/AC-044)
// Also discharges: UI Spec IV-3 (the two-door PDF guard), AC-057 (the /history
//   "Đang chấm" marker), HistoryRowMenu's "Xem chi tiết is NOT blocked" rule.
// ROI: 72 (BV:9 x Freq:7 + Legal:0 + Defect:9)
//   BV 9 — the artifact is permanent and shareable; ADR-0018's Amendment makes
//     blocking it the price of letting a result row mutate after insert. A PDF
//     exported mid-grading carries a score that is about to change.
//   Freq 7 — both exits are on the two screens every student uses after an exam.
//   Defect 9 — the guard lives in ONE hook (`usePdfAction`, UI-D4) but has TWO
//     entry points on TWO screens with different surrounding markup; wiring
//     `blockedReason` into one and not the other is the single most likely mistake
//     in this slice, and each exit looks correct when tested alone.
//   JOURNEY: /result (press Save, nothing happens, read why) -> /history (open the
//     ⋯ menu for the SAME attempt, same answer, same sentence) -> "Xem chi tiết"
//     still open, which is the only route to the retry control.
// Behavior: the real /result tree and the real /history row are rendered from
//   fixtures describing ONE attempt with an unresolved essay -> both PDF exits
//   expose the same blocked contract -> clicking either produces no file, no busy
//   phase and no alert -> the detail link stays operable.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-UI in-process (result/page.tsx ActionButton pair; (HM)/history
//   HistoryRow + HistoryRowMenu), mocked listMyHistory/getResult, mocked
//   generateAttemptPdf (counted), mocked next/navigation
// @complexity: high
// @real-dependency: none
// Primary failure mode: `blockedReason` is threaded to `ActionButton` on /result
//   but not into BOTH `usePdfAction` calls inside `HistoryRowMenu`, so /history
//   silently exports a PDF for an attempt whose score has not settled — the exact
//   two-door disagreement O-8 and MSA-F5 exist to prevent. The near-miss variants,
//   each of which must be excluded by its own assertion: the control gets a real
//   `disabled` attribute (removing it from the keyboard order, the pattern UI-D5
//   forbids); the reason is conveyed only by class/opacity so a screen-reader user
//   hears a plain "Lưu"; a `role="alert"` fires on the blocked click, telling the
//   student something broke when a published rule simply applied; "Xem chi tiết" is
//   blocked along with the other two, locking the student away from the retry
//   button that would clear the block.
// Proof obligation — what the implemented test must assert:
//   (a) POSITIVE FIRST: both screens actually rendered — the attempt's score text is
//       found on /result and the row's meta line is found on /history.
//   (b) SAME ANSWER, BOTH DOORS: on /result AND on /history, each PDF control has
//       `aria-disabled="true"`, has NO `disabled` attribute (assert
//       `hasAttribute("disabled") === false`, and assert it for EVERY element in
//       the essay subtree per FE-AC-21), is reachable by keyboard (assert focus
//       lands on it after `.focus()`, i.e. `document.activeElement` is that node),
//       and its `aria-describedby` resolves to an element whose textContent is
//       `result.essay.pdfBlocked` = "Đang chấm tự luận. Lưu và chia sẻ PDF sẽ mở
//       lại khi chấm xong." — ASSERT THE REASON TEXT, resolved through the real
//       dictionary. Do not assert a class name: a class is not what a screen reader
//       reads, and it is the assertion that lets `disabled:opacity-50` masquerade
//       as an accessible explanation.
//   (c) ZERO GENERATION, BOTH DOORS: click each of the four controls (Save + Share
//       on /result, Save + Share in the menu); the counted `generateAttemptPdfFile`
//       mock has been called 0 times in total, no node with `role="alert"` exists,
//       and no busy indicator appeared. The count is the decisive assertion — an
//       attribute can be right while `run()` still executes.
//   (d) THE WAY OUT STAYS OPEN: the menu's "Xem chi tiết" item is NOT blocked
//       (`aria-disabled="false"`) and remains activatable, and the menu did NOT
//       close on the blocked clicks (it closes only on a SUCCESSFUL export).
//   (e) /history marker (AC-057): the row shows the `result.essay.state.pending`
//       badge ("Đang chấm") at the END of the meta line, and the `{score}/10`
//       number is unchanged from the fixture — the badge is what says the number
//       is not final; the number itself must not move.
//   (f) RESOLVED CONTROL: the same two screens rendered from an all-resolved
//       fixture give `aria-disabled="false"` on all four controls, an
//       aria-describedby target that does NOT contain `pdfBlocked`, and exactly ONE
//       generator call per click. Without this control, (b) and (c) pass for an
//       implementation that blocks PDF export permanently.
//   DETERMINISM — required, because this case lands on the one timing-sensitive
//   file in the area. `HistoryRowMenu.test.tsx` uses `waitFor` on real timers and
//   flaked ONCE under parallel load; a clean single-threaded rerun contradicted it,
//   and frontend DD F-11 deliberately does NOT convert that file to fake timers
//   (changing a green file's time model inside an unrelated change adds a variable
//   where fewest are wanted). This case therefore: (i) uses REAL timers and does
//   NOT import fake ones; (ii) makes every decisive assertion a CALL COUNT on the
//   mocked generator or a static attribute read AFTER an awaited interaction —
//   never a value that only becomes true once a timeout elapses; (iii) uses
//   `findBy*` (bounded, awaited) for the menu-open step only, and nowhere else;
//   (iv) mounts no poller (by design `/history` has none, frontend DD Data Flow
//   point 4), so no clock runs on that half at all. If it ever goes red: rerun
//   single-threaded BEFORE concluding "flaky" — and equally, before concluding
//   "defect".
describe("PDF export guard — both exits agree for one attempt (FE2E-3)", () => {
  it.todo("blocks Save and Share on both /result and the /history row menu with the same readable reason, generates zero files, keeps every control focusable and free of the disabled attribute, leaves 'Xem chi tiết' open, and unblocks all four once the attempt resolves");
});
