// Rating System [fixture-e2e] Test Skeleton
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// UI Spec: docs/design/rating-system-ui-spec.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
// Generated: 2026-07-24 | Budget Used: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// test-runner syntax yet. This project has no Playwright harness/config committed yet;
// per the frontend Design Doc's Test Boundaries ("Playwright MCP / manual pass (no
// CI)"), this lane is implemented and run as a Playwright (or Playwright MCP) script
// against `npm run dev` with a mocked/fixture-driven backend (rateExam/getMyRating/
// listMySubmittedExamIds/listExams return fixture data — no live Supabase). Add the
// Playwright config/harness as part of the implementing task if not already present.

// =============================================================================
// Test FE1 [RESERVED SLOT — user-facing multi-step journey] —
//   Rate from the result page: auto-open, submit, idempotent on refresh
// =============================================================================
// Use Case 1: "Rate from the result page (auto-open modal)"
// Use Case 2: "Already rated (editable) on the result page"
// AC-004, AC-005, AC-006, AC-009 (UI side), AC-012 (UI side), AC-024, AC-025 (UI side)
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9) — reserved regardless of score: this is
//   the feature's highest-value user-facing multi-step journey (submit -> result page
//   -> auto-open modal -> rate -> saved -> return later to an editable state).
// Behavior: a fixture user with a submitted attempt lands on
//   /exams/[id]/attempt/[attemptId]/result?rate=auto (fresh-submit redirect fixture)
//   -> the rating modal auto-opens over the readable result content -> the user rates
//   all three parts via CircleScale -> submits -> sees the saved confirmation -> the
//   page is reloaded at the same URL without the ?rate=auto marker -> the "already
//   rated" editable state renders instead of a fresh auto-open.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — rateExam/getMyRating fixture-driven; real
//   browser DOM and real Next.js client-side routing
// @complexity: high
// Primary failure mode: the modal blocks/hides the result content instead of
//   overlaying it (AC-004 violated); OR the modal fails to auto-open on the fresh
//   ?rate=auto arrival; OR the modal re-opens/re-pops on a plain reload with no
//   marker (AC-005 violated — the idempotency guarantee this feature exists to
//   provide); OR the reload shows a blank fresh form instead of the pre-filled
//   "already rated" editable state (AC-006 violated).
// Proof obligation, within one continuous browser session:
//   (1) on first load with ?rate=auto, the modal is visible AND the result content
//       remains present in the DOM behind/around it (AC-004);
//   (2) all three CircleScale parts are keyboard-operable across 1-10 and the
//       "extremely easy -> extremely hard" scale legend is visible (AC-002/024);
//   (3) after submitting three valid scores, a saved confirmation is announced
//       (aria-live) and the modal reaches its Saved state;
//   (4) reloading the same result URL WITHOUT ?rate=auto never auto-opens the modal,
//       and instead shows an "Edit your rating" inline entry point pre-filled with the
//       three just-saved scores (AC-005/006);
//   (5) Esc, scrim click, and the Close control each close the modal, and focus
//       returns to the inline entry-point trigger afterward.

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
