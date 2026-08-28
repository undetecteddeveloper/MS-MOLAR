// Essay (Tự luận) Auto-Scoring — INTEGRATION lane skeleton
// Design Docs: docs/design/essay-auto-scoring-backend-design.md (v1.3, § Test
//                Boundaries :2181, § Output Comparison :2236, § Cờ tính năng :2011)
//              docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-001..AC-072)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted, D1..D6)
// Generated:   2026-08-29 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// ALL THREE CASES BELOW ARE SKELETONS. Nothing here executes an assertion yet.
// Each case is `it.todo(...)`, deliberately:
//   - `SOURCE/vitest.config.ts:19` collects `app/**/*.test.{ts,tsx}`, so this file
//     IS in the `npm test` CI gate from the moment it is committed. A file with
//     zero collected tasks makes vitest report "No test suite found in file" and
//     exit 1 — a red CI caused by the shape of a skeleton, not by any defect.
//     `it.todo` is collected, reports as todo, and keeps the gate green.
//   - There are no imports of not-yet-existing modules (`lib/scoring/essayLifecycle`,
//     `lib/essay/*`, `app/(layer2)/essayActions`), so `npx tsc --noEmit` and
//     `eslint --max-warnings 0` stay green too. NOTHING in this feature has been
//     implemented and NO DDL has been applied.
// The implementing task replaces one `it.todo` with a real `it` + mocks +
// assertions IN THE SAME COMMIT as the production code it covers (Red -> Green in
// one task), following the shipped precedent in this directory
// (`getResult.int.test.ts`, `submitExam.int.test.ts`, `rating.int.test.ts`).
//
// HOW THIS LANE RUNS: `npm test` (from `SOURCE/`). NOT `npm run test:integration`
// — that config collects `tests/integration/**` only and needs a real Supabase dev
// database. Every case in this file is DB-free by construction.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to all three cases
// -----------------------------------------------------------------------------
// Backend DD § Mock Boundary Decisions (:2183) is the authority; this file adopts
// it verbatim:
//   MOCKED  — the Supabase client at the `createClient()` boundary (the sanctioned
//             boundary of `getResult.int.test.ts` / `rating.int.test.ts` /
//             `history.int.test.ts`); `lib/supabase/service-role.ts` operations;
//             `after()` (replaced by a synchronous invocation, since the subject is
//             WHAT is registered and WHEN, not how Next schedules it); Redis;
//             `redirect()`.
//   MOCKED  — `fetch` to `api.groq.com`, at the fetch boundary and no deeper.
//             GRADING SHIPS DISABLED behind the AC-067 human gate (Zero Data
//             Retention in the Groq console) and NO GROQ ACCOUNT EXISTS YET, so
//             every case here runs with ZERO real provider calls. INT-1 asserts
//             that count is zero as its own subject; INT-2/INT-3 never reach the
//             write path at all.
//   REAL    — `computeScore()`, `lib/scoring/essayLifecycle.ts`
//             (`deriveEssayView`, `summariseEssays`, `isEssayIncomplete`,
//             `hasIncompleteEssay`, `hasUnresolvedEssay`), `lib/scoring/wrongTwice.ts`,
//             `lib/i18n` dictionaries. These are pure and they ARE the subject;
//             mocking them tests the wiring instead of the behaviour.
// @real-dependency: none — no case in this file touches Postgres. The three
//   properties a mocked client CANNOT prove (jsonb array order, the
//   `<> 'graded'` predicate matching zero rows, the real grants) are OUT of this
//   lane by design and live in the service lane —
//   `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts`.
//
// -----------------------------------------------------------------------------
// WHY THESE THREE, AND WHAT WAS PUSHED DOWN
// -----------------------------------------------------------------------------
// Ranked by ROI (BV x Freq + Legal x 10 + Defect), top 3 of 7 candidates:
//   INT-1  109  feature-off submit path                       <- selected
//   INT-2   81  hasIncompleteEssay agreement, both read paths <- selected
//   INT-3   71  graded essay stays out of Layer 3             <- selected
//   (I-E)   57  gradeEssays orchestration order (AC-072)      <- NOT selected, budget full
//   (I-D)   49  retryEssayGrading refusal matrix (EG-BE-022)  <- NOT selected, budget full
//   (I-F/G)  —  deriveEssayView deadline boundary (EG-BE-023),
//               parseGrade band/boolean validation (EG-BE-014/015)
//               <- PUSHED DOWN: pure functions with no collaborators; a unit test
//                  proves strictly more per second here. Backend DD § Correctness
//                  Proof Method row 1 and row 3 already assign them to the unit lane.
// I-E and I-D are the two the engineer should swap in first if any case below is
// judged unit-level; their annotations are preserved in the generation report.
//
// EXISTING COVERAGE CHECKED (dedup pass, 2026-08-29) — these already-shipped tests
// touch this feature's surface and must NOT be restated here:
//   `lib/scoring/__tests__/computeScore.test.ts`  — the current essay branch
//     ({ scored:false, isCorrect:false }) and the `essay()` fixture helper.
//   `lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140) — the
//     `scored: false` exclusion, on a fixture already named `Q-ESSAY`.
//   `app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` — the essay
//     footer string and the `maxLength` coupled site.
//   `app/(layer2)/__tests__/submitExam.int.test.ts` — the `essay_answer` key path.
// Where a case below overlaps one of them, the overlap is called out at the
// obligation itself with the narrower thing this lane adds.

import { describe, it } from "vitest";

// =============================================================================
// INT-1 — Feature-off is the SHIPPED state: no keys, no after(), zero Groq
// =============================================================================
// AC: EG-BE-002 — "When computeScore() runs with options.essayGrading === false
//   (the default), the system must emit the per_question element for an essay
//   question BYTE-FOR-BYTE as today: { questionId, selected, isCorrect: false,
//   scored: false } and NOT ONE essay* key."
// AC: EG-BE-032 — "submitExam() must emit 0 provider requests synchronously, and
//   the grading pass registration must sit BEFORE the redirect() call."
// AC: EG-BE-033 — "Any failure of the grading pass must not change submitExam()'s
//   observable outcome: the exam_results row is still written, record_skill_mastery()
//   is still called, and the redirect still happens."
// Also discharges: PRD AC-010, AC-013, AC-067; ADR-0018 R-12; backend DD § Cờ tính
//   năng :2011 read site (1); § Feature-Off Window (frontend DD :1605) backend half.
// ROI: 109 (BV:10 x Freq:10 + Legal:0 + Defect:9)
//   BV 10 — this is the state the feature SHIPS in. AC-067 is a human gate (Groq
//     Zero Data Retention, unverified, no account exists), and the users are
//     minors; "flag absent => zero requests" is the privacy promise itself.
//   Freq 10 — every single exam submission in production runs this path.
//   Legal false — treated as product/privacy policy rather than a statutory
//     requirement, deliberately conservative; note R-12 rates the impact "Cao".
//   Defect 9 — the failure is silent in both directions: an accidental default of
//     `true` leaks student prose to a third party with no ZDR guarantee, and an
//     accidental extra key changes what every downstream surface renders.
// Behavior: submitExam(attemptId, answers) is invoked with ESSAY_GRADING_ENABLED
//   unset -> computeScore runs with the flag threaded through as an OPTION (never
//   read from process.env inside the pure function, AC-013) -> the persisted
//   ScoreResult is byte-identical to today and no after() callback is registered ->
//   redirect still happens.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/actions.ts (submitExam) + real computeScore()
//   + mocked Supabase client + mocked service-role operations + mocked after() +
//   mocked redirect() + mocked global fetch
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the flag read defaults to ON when the env var is absent
//   (e.g. `process.env.ESSAY_GRADING_ENABLED !== "false"` instead of
//   `=== "true"`), so a build that ships before the AC-067 gate emits essay keys
//   and registers a grading pass that sends real student writing to Groq. The
//   second, quieter mode: the flag is respected but `after()` is registered AFTER
//   `redirect()` (`actions.ts:192`), which in Next means it is never registered at
//   all — grading silently never runs once the flag IS turned on, and nothing in
//   the flag-off state can reveal it.
// Proof obligation — what the implemented test must assert:
//   (a) FLAG ABSENT, exhaustive negative: with `ESSAY_GRADING_ENABLED` deleted from
//       the environment, the per_question payload handed to the mocked
//       `recordExamResult` toEqual an INDEPENDENTLY AUTHORED literal (not "whatever
//       computeScore returned"), and Object.keys of every essay element contains
//       NONE of essayState / essayEarned / essayMax / essayLowConfidence /
//       essayAttempts / essayGradedAt. Assert on the key SET, not on
//       `essayState === undefined` — a key present with value undefined
//       serialises differently into jsonb.
//       Overlap note: `computeScore.test.ts` owns the PURE half of this (the shape
//       computeScore returns). What this lane adds is that the shape SURVIVES the
//       call site — that `submitExam` passes the option through and persists that
//       exact payload — which a pure-function test cannot see.
//   (b) Zero provider calls, measured not assumed: global fetch is a counted mock;
//       the count is exactly 0. No `api.groq.com` request is constructed even to
//       be aborted.
//   (c) No pass registered: the `after()` mock records 0 registrations.
//   (d) Same three env spellings all mean OFF (fail-closed, backend DD :2015):
//       absent, "", "TRUE" (wrong case), "1". Each yields (a)+(b)+(c). "true"
//       with surrounding whitespace means ON (the value is trimmed) — include it
//       as the ONE positive control so this case cannot pass by the flag read
//       being dead code.
//   (e) Ordering, flag ON: with the trimmed "true" control, the `after()` mock is
//       called BEFORE the `redirect()` mock. Assert by comparing invocation order
//       on the two spies (`mock.invocationCallOrder`), not by asserting both were
//       called — "both were called" is true in the broken ordering too.
//   (f) Pass failure is contained: with the flag ON and the registered callback
//       forced to reject when invoked synchronously, `recordExamResult` and
//       `recordSkillMastery` were still both called and the redirect still
//       happened. This is EG-BE-033, and it is what keeps a provider outage from
//       becoming a lost submission.
//   Mockable boundaries and why: Supabase client / service-role / after / redirect /
//   fetch are all external or scheduler I/O. `computeScore()` runs REAL — it is the
//   subject of (a), and the backend DD names it explicitly as "Không — chạy thật".
describe("submitExam() — essay grading feature flag (INT-1)", () => {
  it.todo("emits no essay* keys, registers no grading pass and makes zero provider calls when ESSAY_GRADING_ENABLED is absent, and registers after() before redirect() when it is 'true'");
});

// =============================================================================
// INT-2 — The two PDF exits cannot disagree: hasIncompleteEssay is identical on
//         getResult() and listMyHistory() for the same attempt
// =============================================================================
// AC: EG-BE-035 — "When an attempt has at least one essay question at RS-6,
//   hasIncompleteEssay must be true on BOTH ExamResult and MyHistoryEntry for the
//   same attemptId; and when no question is at RS-6 it must be false on both —
//   including for an attempt with no essay questions at all and for a row written
//   before the feature shipped (NEVER undefined)."
// AC: EG-BE-034 — "For the same per_question array and the same created_at,
//   hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0."
// AC: EG-BE-031 — "When getResult() reads an exam_results row written before the
//   feature shipped, the output must be identical to today and essaySummary must
//   be undefined."
// Also discharges: PRD AC-012, AC-058 (data half), O-8; frontend DD MSA-F5,
//   CR-4, FE-AC-14 precondition; UI Spec UI-D11.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — a PDF is a permanent artifact a student shares; two exits producing
//     two different files for one attempt is the defect O-8 exists to prevent.
//   Freq 8 — every /history render and every /result render evaluates both fields.
//   Defect 9 — two call sites deriving "the same" truth by two routes is the
//     shape F-06 already caught once in this feature's own review history.
// Behavior: the SAME per_question fixture and the SAME created_at are fed to
//   getResult() and to listMyHistory() through their (separately mocked) Supabase
//   clients -> real essayLifecycle predicates run on both paths -> the two
//   booleans are compared to each other and to independently authored literals.
// @category: integration
// @lane: integration
// @dependency: SOURCE/app/(layer2)/queries.ts (getResult) +
//   SOURCE/app/(HM)/queries.ts (listMyHistory) + real
//   SOURCE/lib/scoring/essayLifecycle.ts + mocked Supabase client on both paths
// @complexity: medium
// @real-dependency: none — the sanctioned mock boundary of getResult.int.test.ts
//   and history.int.test.ts. What this case proves is AGREEMENT BETWEEN TWO
//   TypeScript derivations plus the query SHAPE; it deliberately does not claim to
//   prove Postgres semantics.
// Primary failure mode: one read path is extended and the other is not — most
//   likely `listMyHistory()`'s select gains `per_question` but not `created_at`
//   (backend DD § Implementation Path Mapping, `(HM)/queries.ts:64-66`), so its
//   deadline derivation runs against a missing/`undefined` timestamp and an
//   overdue pending question is classified as still-pending there while /result
//   classifies it as RS-6. The student then gets a PDF with the incomplete-essay
//   line from one button and without it from the other, for the same attempt.
//   The second mode: either field is left `undefined` for a legacy row instead of
//   `false`, and `undefined` is falsy — so the bug renders correctly today and
//   surfaces the first time anything does a strict comparison.
// Proof obligation — what the implemented test must assert:
//   (a) AGREEMENT, the point of the case: for ONE fixture attempt id, drive both
//       functions and assert
//       `examResult.hasIncompleteEssay === historyEntry.hasIncompleteEssay`
//       AND that the shared value equals an independently authored literal `true`.
//       Asserting only the equality is not enough — two paths that are both wrong
//       in the same direction are equal.
//   (b) Fixture must contain an RS-6 element specifically: essayState "failed"
//       with essayAttempts === ESSAY_MAX_ATTEMPTS (3), i.e. retryAvailable false.
//       RS-4 (failed, attempts < 3) must NOT set hasIncompleteEssay — include it
//       as a second element in the same fixture so the case distinguishes
//       "any failure" from "unrecoverable failure".
//   (c) NEGATIVE, three shapes, all yielding `false` on BOTH paths and all
//       `typeof === "boolean"` (never undefined): an attempt whose essays are all
//       graded; an attempt with no essay questions at all; a legacy row carrying
//       no essay* key whatsoever.
//   (d) EG-BE-034 equality, run on the SAME fixture in the same case:
//       `hasUnresolvedEssay(pq, createdAt, now) === ((summariseEssays(pq, createdAt, now)?.unresolvedCount ?? 0) > 0)`
//       for each of the fixtures in (b) and (c). This is the pin that stops the
//       two derivations of one truth from drifting.
//   (e) Query shape, both paths: getResult()'s select carries `created_at`
//       (backend DD :579-581) and listMyHistory()'s embedded select carries BOTH
//       `per_question` and `created_at` (:64-66). A missing column here is the
//       exact mechanism of the primary failure mode and it is invisible to any
//       assertion made on mapped output alone.
//   (f) Legacy-row Output Comparison (EG-BE-031 / backend DD đường ống 2 and 3):
//       for the legacy fixture, the whole ExamResult toEqual a hand-built literal
//       of the pre-change shape, with `essaySummary === undefined` and every
//       `PerQuestionResult.essay === undefined`; and the whole MyHistoryEntry[]
//       toEqual a literal carrying all nine pre-existing fields plus the two new
//       booleans as `false`, in unchanged submittedAt-descending order.
//   Time control: `now` must be injected/frozen, never `Date.now()` — the deadline
//   derivation (ESSAY_PENDING_DEADLINE_MS = 600_000) is time-dependent and a
//   real clock makes this case a time bomb rather than a test.
describe("getResult() / listMyHistory() — hasIncompleteEssay agreement (INT-2)", () => {
  it.todo("derives identical hasIncompleteEssay and hasUnresolvedEssay booleans on both read paths for the same attempt, and returns false (never undefined) for graded, essay-free and legacy rows");
});

// =============================================================================
// INT-3 — A graded essay is still scored:false / isCorrect:false, so Layer 3 and
//         the score triple never move because of it
// =============================================================================
// AC: EG-BE-004 — "In EVERY lifecycle state (pending, graded, failed) the stored
//   element must keep scored: false and isCorrect: false. A graded element
//   carrying scored: true, isCorrect: true, or MISSING the scored key, fails this
//   criterion."
// Also discharges: PRD AC-009 (exam_results.correct never moves because of an
//   essay), AC-014, AC-016 (wrongTwice), AC-017 (record_skill_mastery filter),
//   AC-011/AC-015 read-side arithmetic (EG-BE-027); ADR-0018 F1.
// ROI: 71 (BV:9 x Freq:7 + Legal:0 + Defect:8)
//   BV 9 — F1 is the single fact that lets this feature ship without editing
//     `schema.sql:1354` or `wrongTwice.ts:45`. If it breaks, essay questions start
//     feeding the mastery model and the wrong-twice set, which changes what Layer 3
//     recommends to the student — a wrong answer to a different question entirely.
//   Freq 7 — every result render of every attempt containing a graded essay.
//   Defect 8 — the natural instinct when a band lands is to set scored:true, and
//     nothing about that change looks wrong at the point it is written.
// Behavior: a per_question fixture containing a GRADED essay element (essayState
//   "graded", essayEarned 0.75, essayMax 1, scored false, isCorrect false) is read
//   through getResult() at the mocked Supabase boundary -> real essayLifecycle
//   summarises it -> the legacy score triple is untouched, the element still
//   reports scored:false, and the real wrongTwice derivation ignores it.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/queries.ts (getResult) + real
//   SOURCE/lib/scoring/essayLifecycle.ts + real SOURCE/lib/scoring/wrongTwice.ts +
//   mocked Supabase client
// @complexity: medium
// @real-dependency: none IN THIS LANE — but note the split, because this case
//   proves only the TypeScript half. `record_skill_mastery()`'s own exclusion
//   (`coalesce((pq->>'scored')::boolean, true)`, schema.sql:1354) is a Postgres
//   predicate; it is asserted on the real database by the existing
//   `recordSkillMastery.int.test.ts` and by the service lane, NOT here. Saying so
//   at the boundary is the point: a mock cannot prove a SQL filter.
// Primary failure mode: `record_essay_grade()` or a later refactor sets
//   `scored: true` on the element when the band lands ("it IS scored now"),
//   whereupon `record_skill_mastery()` stops excluding the row and the essay starts
//   contributing to skill mastery; and `computeWrongTwiceQuestionIds()`
//   (`wrongTwice.ts:45` skips only on `row.scored === false`) starts returning
//   essay question ids, so the tutor surfaces essay questions as "sai hai lần".
//   The adjacent mode: the essay's band leaks into `result.correct` / `result.total`
//   on the read path, which silently redefines what `ScoreCard`'s
//   `wrong = total - correct` derivation means.
// Proof obligation — what the implemented test must assert:
//   (a) The graded element as returned by getResult() has `scored === false` and
//       `isCorrect === false`, and the `scored` key is PRESENT (assert
//       `"scored" in element`, not just the value — a missing key hits the
//       `coalesce(..., true)` default in SQL and flips the filter).
//   (b) The score triple is untouched: `result.totalScore`, `result.correct` and
//       `result.total` toEqual independently authored literals computed from the
//       NON-essay questions only. Use a fixture where including the essay would
//       visibly change every one of the three (e.g. 4 MCQ, 3 correct, plus a
//       graded essay at band 0.75) — with a fixture where the numbers coincide,
//       this assertion proves nothing.
//   (c) Real `computeWrongTwiceQuestionIds()` over rows containing this graded
//       essay TWICE (two attempts, both "wrong") returns an array that does NOT
//       contain the essay's questionId, while still containing the id of a
//       genuinely twice-wrong MCQ in the same fixture — the positive control that
//       stops (c) from passing because the function returned nothing at all.
//       DEDUPLICATION, read before writing this obligation: the plain
//       `scored: false` exclusion is ALREADY covered at unit level by
//       `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140), whose
//       fixture is already named `Q-ESSAY`. Do not restate it. What is NEW here —
//       and the only thing justifying (c) in this lane — is that the element now
//       ALSO carries the six new keys (essayState/essayEarned/essayMax/
//       essayLowConfidence/essayAttempts/essayGradedAt) and arrives through the
//       real read path rather than a hand-built unit fixture: the obligation is
//       that the presence of those keys does not flip the predicate. If that
//       framing is dropped, (c) is duplicate coverage and should be deleted rather
//       than written.
//   (d) EG-BE-027 arithmetic: `essaySummary.earned` / `.max` count the graded
//       essay only. In a fixture with one graded (0.75), one pending and one
//       failed essay: earned === 0.75, max === 1, gradedCount === 1 — NOT max === 3.
//       A failed essay contributing 0 to earned and 1 to max is exactly the silent
//       zero AC-015 forbids.
//   (e) `essayLowConfidence: true` on the graded element changes NO number in
//       (b) or (d) — same fixture run twice, flag flipped, numeric output toEqual.
describe("Graded essay stays out of the score triple and Layer 3 (INT-3)", () => {
  it.todo("keeps scored:false/isCorrect:false on a graded essay element so the score triple, record_skill_mastery's filter input and computeWrongTwiceQuestionIds are all unaffected");
});
