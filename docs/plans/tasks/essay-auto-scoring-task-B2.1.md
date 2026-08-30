# Task B2.1 — `getResult()`: `created_at` in the select, plus the three derived fields

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B2 (Read Path, vertical slice V2), Task B2.1**
Layer: **backend** (`SOURCE/app/(layer2)/**`, `SOURCE/types/**`)

Metadata:
- Dependencies: **Task B1.5**.
- Blocks: **Tasks B2.2, B2.3, B2.4, B3.2, F-A1** (the `EssaySummary` field names must be fixed before strings are wired to them).
- Provides: `essay?: EssayView` per row, `essaySummary?: EssaySummary` per attempt, `hasIncompleteEssay: boolean` per attempt.
- Size: Small (2 files)
- Verification level: **L1** on dev.

## Change Category
`Change Category: boundary-change`

`ExamResult` / `PerQuestionResult` are published read contracts consumed by four display surfaces and by the PDF pipeline. Adjacent cases swept: the other read path (`listMyHistory()`, Task B2.2 — it must gain **both** `per_question` and `created_at`, and a missing column there is the exact mechanism INT-2's primary failure mode describes), and both PDF construction sites (Task B2.3).

**V1 before V2 is a hard rule**: V1 creates the data, V2 reads it. Reversed, V2 could only be checked against hand-typed jsonb — a fixture the author invented rather than what `record_essay_grade()` actually writes, and that divergence is the hardest-to-see failure mode in the feature.

## Implementation Content

In `SOURCE/app/(layer2)/queries.ts`:

- Add `created_at` to `getResult()`'s **select string** (`:577-579`) **and** to the `ResultRow` type (`:469-475`) — it is **absent today** (D-02). `exam_attempts.submitted_at` is **not** a substitute: AC-026 names `exam_results.created_at` specifically, and the two timestamps differ by however long `record_exam_result()` took.
- Beside where `hasBeenWrongTwice` is attached (`:606-610`), attach:
  - `essay?: EssayView` to each `PerQuestionResult` via `deriveEssayView(entry, createdAt, now)`;
  - `essaySummary?: EssaySummary` to the attempt via `summariseEssays(...)`;
  - `hasIncompleteEssay: boolean` — **required**, always computable, `false` when no key is present. *A PDF annotation cannot be decided by an `undefined`.*

In `SOURCE/types/result.ts`: add `essay?: EssayView` to `PerQuestionResult`, following the `hasBeenWrongTwice` precedent at `:19-24`.

### D-09 site owned by this task, exclusively
`SOURCE/types/result.ts:14-17`'s stale `scored` comment — **reason only, no value change**. It lands here rather than in Task B4.1 because this task already edits that file for the `essay?` field, and a type and the comment describing it should not change in two different commits. **Task B4.1 does not touch it** (I015 — it was double-assigned).

### Open Item I-4
The backend Design Doc's Agreement Checklist line for `getResult()` names only `essay?` and `essaySummary?`, while its **Interface Change Matrix** additionally requires `hasIncompleteEssay: boolean` as a **required** field. This plan follows the **Interface Change Matrix**, because the field is the PDF annotation's decision input and an `undefined` there is a PDF whose content cannot be decided. Recorded because two sections of one document disagree. *Owner: engineer, before this task.*

### Time control
`now` is **injected and frozen**. `ESSAY_PENDING_DEADLINE_MS` is 600 000; a real clock makes these cases a time bomb.

## Target Files
- [x] `SOURCE/app/(layer2)/queries.ts`
- [x] `SOURCE/types/result.ts`
- [x] `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` — **not in the original list**; the task's own Implementation Steps say "write the tests" and its Operation Verification Method is an Output Comparison, so a test file was always required. It lands in the existing `getResult()` integration file, at the sanctioned `createClient()` boundary, rather than in a new one.
- [x] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — **not in the original list, and found by `tsc`, exactly as this task's Quality Assurance section predicted** ("the required `hasIncompleteEssay` names any site that forgot it"). One call site constructs a literal `ExamResult`; it gained `hasIncompleteEssay: false`, which is the correct value there — the fixture has no essay question, so it cannot have an RS-6.

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `getResult()` adds `created_at` to the select and to `ResultRow`; attaches `essay?`, `essaySummary?`, `hasIncompleteEssay`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Interface Change Matrix — `hasIncompleteEssay: boolean` as a **required** field; see Open Item I-4)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Field Propagation Map — the six keys across `computeScore` → jsonb → `deriveEssayView` → four surfaces)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-02 — the select does **not** carry `created_at` today; `exam_attempts.submitted_at` is not a substitute)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-09 — `types/result.ts:14-17` is this task's site)
- `SOURCE/app/(layer2)/queries.ts` (`:469-475` `ResultRow`; `:577-579` `getResult()`'s select; `:606-610` where `hasBeenWrongTwice` is attached; `:633-657` the model answer already returned after submission)
- `SOURCE/types/result.ts` (`:14-17` the stale `scored` comment — **reason only**; `:19-24` the `hasBeenWrongTwice` precedent)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `deriveEssayView`, `summariseEssays`, `hasIncompleteEssay`, `EssayView`, `EssaySummary`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-027) | derived-display | "**Trong khi** tính tổng điểm tự luận, chỉ câu ở `graded` **phải** đóng góp vào **cả hai** vế earned và max; `pending`, `failed` và câu không chấm được đóng góp **0 vào cả hai**." | The attached `essaySummary` adds to `earned` and `max` only for `graded` elements |
| backend DD (§ EG-BE-026) | state-lifecycle-negative | "Giá trị `retryAvailable` mà client nhận **phải** là một boolean, và payload gửi xuống client **phải không** chứa `essayAttempts` dưới bất kỳ tên nào." | The attached `essay?: EssayView` carries a boolean `retryAvailable` and no attempt count under any name |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `computeScore()` → `exam_results.per_question` (Supabase Postgres, separate process) |
|---|---|
| Owner (left) | `SOURCE/lib/scoring/computeScore.ts` via `recordExamResult()` |
| Owner (right) | `public.exam_results.per_question` (jsonb), **later read by `getResult()`** / `listMyHistory()` / `record_essay_grade()` |
| Serialized format | jsonb array elements carrying the five insert keys alongside `scored:false`, `isCorrect:false`. camelCase, no snake_case mapping layer |
| Consumer parse rule | **Readers branch on the presence of the `essayState` key** (absent ⇒ RS-0, the shared not-scored branch), then on its value; an unrecognised value returns `null` and warns once |
| Expected signal | INT-1(a): the payload equals an independently authored literal, and `Object.keys` of every essay element contains none of the six keys when the flag is off |

Roundtrip check this task owns: a legacy row (no essay keys) reads out **identically to today**, with `essaySummary === undefined` and every `PerQuestionResult.essay === undefined`.

## Investigation Notes

**The confirmed absence of `created_at` in today's select** — confirmed by reading, not by trusting D-02: the select string was `"total_score, correct, total, per_question, topic_breakdown, overtime_seconds, exam_attempts!inner(started_at, submitted_at, exams_with_difficulty!inner(id, title, subject))"`, and `ResultRow` declared five fields, none of them a timestamp. Both now carry `created_at`. No DDL — the column already exists on `exam_results`.

**The hand-built legacy-shape literal used for the Output Comparison** — the whole `ExamResult` for a row whose single `per_question` element carries no `essay*` key: `{ examId, examTitle, subject, result: { totalScore, correct, total, perQuestion: [the four-key element], topicBreakdown }, questions: {}, startedAt, submittedAt, overtimeSeconds: 0, hasIncompleteEssay: false }`. Two assertions sit **outside** that comparison on purpose: `toEqual` treats a key holding `undefined` as absent, so `essaySummary === undefined` and `every(r => r.essay === undefined)` are asserted separately, plus `typeof hasIncompleteEssay === "boolean"`.

**The frozen `now` used in the boundary cases** — `2026-08-29T12:00:00.000Z`, set through `vi.setSystemTime`, with each `created_at` written as an offset from it (`now − 599 999`, `now − 600 000`, `now − 600 001`) so the relationship each case is about is visible at the call site instead of hidden inside two ISO strings the reader has to subtract.

`getResult()`'s **signature is unchanged** and `now` is **not** a parameter — the backend DD's Interface Change Matrix says "cùng chữ ký". So `now` is read once inside the function and injected into all three derivations; the test freezes the clock rather than passing a value.

### The red phase found a real defect — in this task's own first draft

The EG-BE-025 case failed on the first run: **`expected "warn" to be called 1 times, but got 3 times`**.

The cause was in the call site, not in `essayLifecycle`. `summariseEssays()` and `hasIncompleteEssay()` each fold the array themselves, so calling all three helpers on `row.per_question` runs `deriveEssayView()` **three times per element** — and for an unrecognised `essayState`, EG-BE-025 promises exactly one `console.warn` while the page emitted three, on every render.

Fixed at the cause rather than by relaxing the assertion: each element is derived **once**, and only the elements that actually produced a view are handed to the two aggregate helpers. The output is provably unchanged — `essayLifecycle` already discards every element that derives to `null`, so filtering before the fold and filtering inside it yield the same view list. A second case (`EG-BE-025 second half`) pins that the filtering did not also drop a **good** element from the aggregates, which is what separates "warned once" from "warned once because it stopped looking".

### Mutation testing: 7 mutations, 7 caught

| # | Mutation | Caught by |
|---|---|---|
| N1 | deadline boundary becomes inclusive (`>=`) | EG-BE-023, the **middle** case |
| N2 | `created_at` dropped from the joined select | the select-shape case |
| N3 | deadline measured from `exam_attempts.submitted_at` | EG-BE-023 boundary cases |
| N4 | the derive-once fix reverted (three folds again) | both EG-BE-025 cases |
| N5 | `null` kept instead of `undefined` on the read contract | EG-BE-031, plus two **pre-existing** Test 2 obligations |
| N6 | `hasIncompleteEssay` hardcoded `false` | EG-BE-027, RS-6 half |
| N7 | summary `max` counts every essay, not only `graded` | EG-BE-027 arithmetic |

N3 is worth its own line: it is the mutation a mocked client normally cannot catch, because a mock hands back whatever it is asked for. It is caught only because the fixture's `created_at` and `submitted_at` are deliberately **different** timestamps.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] **Sweep the adjacent cases** (Change Category: boundary-change): `listMyHistory()`'s select and both PDF construction sites are **deliberately untouched here** — they are Tasks B2.2 and B2.3, and INT-2 (Task B2.4) is the case that will hold the two read paths against each other. Recorded so the sweep is visibly a decision rather than an omission.
- [x] Write the tests: the three deadline boundary cases, the missing/unrecognised-key cases, the arithmetic case, and the legacy-row Output Comparison against a **hand-built literal**; observe them fail — **one of them did fail, on a real defect** (see Investigation Notes). The others were green on first run because the implementation landed in the same commit, so they are backed by mutation testing instead.

### 2. Green Phase
- [x] Add `created_at` to the select **and** to `ResultRow`
- [x] Attach `essay?`, `essaySummary?` and the **required** `hasIncompleteEssay`
- [x] Add `essay?: EssayView` to `PerQuestionResult` and fix the reason at `types/result.ts:14-17` — the value and behaviour are unchanged; only the *reason* moved from "there is nothing to grade" to "the band is written **outside** `computeScore()` and the row deliberately stays out of the denominator in every lifecycle state"
- [x] Run only the added tests and confirm they pass — **17 passed** in that file — 7 pre-existing plus 10 new, matching the full lane's +10

### 3. Refactor Phase
- [x] Confirm `now` is injected and frozen in every time-dependent case — `vi.setSystemTime` in the block's `beforeEach`, `vi.useRealTimers()` in `afterEach`; no case reads the real clock
- [x] Confirm nothing re-derives `state === "failed" && !retryAvailable` locally (EG-BE-036 — it lives only in `essayLifecycle.ts`) — `queries.ts` calls `hasIncompleteEssay()` and never restates the predicate; N6 confirms the call is load-bearing
- [x] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the required `hasIncompleteEssay` names any site that forgot it — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | first run was **2**, and that was the gate doing its job: it named the one `ExamResult` construction site that had not been given the new required field |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1858 passed / 10 skipped / 2 todo (**+10** from this task). See the network note below — the first attempt exited 1 on a 5 s timeout in `recordSkillMastery.int.test.ts` |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` FE-1 (e) — `locale en` and `locale vi`. This task **edits that file**, so the count matching the baseline exactly is the thing worth noting |
| 6 | `npm run test:localdb` | **0** | on the fourth attempt, with **zero** timeouts. See the network note |

**Known-red window:** `npm run verify:schema` (dev) exits **1** with exactly **one** failing assertion, the character ceiling. Its own first attempt exited 1 with **zero** failing assertions and `❌ Schema verify lỗi: fetch failed` — the network signature again, and the cleanest single piece of evidence for it.

### Network conditions during this task, stated with evidence rather than as an excuse

Two gates went red for infrastructure reasons and were **discriminated, not dismissed**:

- **Gate 3, first attempt** — `recordSkillMastery.int.test.ts` timed out at 5 000 ms on a test that makes a real dev-Postgres round trip. Run alone with the change in the tree: **2 passed**. Re-run of the full lane: **0**, 1858 passed.
- **Gate 6** — `subscription.service.e2e.test.ts` failed on attempts 1, 2 and 3 and passed on attempt 4. Four independent reasons it is not this change: (i) the three failures were a `TypeError: fetch failed`, a 60 s test timeout and a suite-level hook failure — **three different shapes, zero assertion failures**; (ii) each run failed a **different** case; (iii) the file imports **none** of the four modules this task touches (checked, not assumed); (iv) the same lane exited 0 twice earlier in this session and again on attempt 4 here, with zero timeouts.

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method** — **Output Comparison, pipeline 2**: for a legacy-shaped row mocked at the Supabase client boundary, assert the **whole** `ExamResult` equals a **hand-built literal** of the pre-change shape (`toEqual`, **no snapshots**). Then assert the three deadline boundary cases with a frozen injected `now`. Then **L1** on dev: the result page's data layer carries correct lifecycle values for a seeded graded attempt.
- **Success criteria**: the legacy `ExamResult` is byte-equal to the pre-change literal, with `essaySummary === undefined` and every `PerQuestionResult.essay === undefined`; the three boundary cases return `pending`, `pending`, `failed`; `hasIncompleteEssay` is a real boolean in every case.
- **Failure response**: this is **AC-012's sharpest edge** — if an old row grows a populated field, "no backfill" broke on the **read** path, which is the harder place to see it. Fix the derivation's guard rather than adjusting the literal.
- **Verification level**: **L1** — on dev, the result page's data layer carries correct lifecycle values for a seeded graded attempt.

## Proof Obligations
- **Claim (EG-BE-023)**: deadline boundary, three cases, **exclusive `>`**.
  - **Primary failure mode**: `>=` at the boundary, flipping the `deadline` case. **Boundary**: in-process with the Supabase client mocked and `now` injected. **State assertion**: N/A (read-time derivation over stored state). **Mock rationale**: `createClient()` is the external boundary. **Residual**: the derivation itself is proven in H1; this proves the query layer passes the right `createdAt`.
- **Claim (EG-BE-024 / EG-BE-025)**: a missing key ⇒ `null` and **no** log; an unrecognised value ⇒ `null` **and exactly one** warning carrying only `questionId` and the strange value.
  - **Primary failure mode**: a legacy row producing a warning per question per render, or a warning carrying the student's answer. **Boundary**: in-process with a spied `console.warn`. **State assertion**: N/A. **Mock rationale**: `console.warn` spied. **Residual**: none.
- **Claim (EG-BE-026)**: `retryAvailable` reaches the client as a **boolean**, and the payload contains **no** attempt count under any name.
  - **Primary failure mode**: an attempt count leaking to the client, which AC-044 forbids and which the UI would then be tempted to display. **Boundary**: in-process over the returned object's key set. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (EG-BE-027)**: only `graded` contributes to earned and max.
  - **Primary failure mode**: a failed essay contributing 0 to earned and 1 to max — the silent zero AC-015 forbids. **Boundary**: in-process. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: re-proven end to end by INT-3(d) (Task B2.4).
- **Claim (EG-BE-031 / AC-012)**: a row written before the feature shipped reads out **identically to today**, with `essaySummary === undefined` and every `PerQuestionResult.essay === undefined`.
  - **Primary failure mode**: an old row growing a populated field — "no backfill" broken on the **read** path. **Boundary**: in-process against a hand-built literal of the pre-change shape. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the `/history` pipeline's equivalent is Task B2.2's.

## Completion Criteria
- [x] **Implementation Complete** = select, type and three attachments
- [x] **Quality Complete** = six verify gates green (gate 5 red at the TD-030 baseline, by definition)
- [ ] **Integration Complete** = **L1** on dev — the result page's data layer carries correct lifecycle values for a seeded graded attempt
  - **OPEN, and blocked on the same decision as Task B1.5's L1**: there is no seeded *graded* attempt on dev until grading has actually run once, which needs `ESSAY_GRADING_ENABLED=true` and a real call to `api.groq.com`. Not something to start unasked.
- [x] Output Comparison pipeline 2 green against a hand-built literal (**no snapshots**)
- [x] `types/result.ts:14-17`'s reason corrected — **no value or behaviour change**
- [x] Every Reference Contract Compliance Check evaluates to `Y` — EG-BE-027 by the arithmetic case under mutations N7 and N6; EG-BE-026 by the exhaustive key-set assertion on the returned `EssayView`
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: B2.2 (the sibling read path), B2.3 (the PDF data contract), B2.4 (INT-2/INT-3), B3.2 (the retry action reads through this), F-A1 (the string parameters are wired to `EssaySummary`'s field names), F-A3/F-B1 (the display surfaces).
- Scope boundary — preserve unchanged: `SOURCE/app/(HM)/queries.ts` (Task B2.2); the `queries.ts:633-657` model-answer branch (already permitted after submission — AC-043 constrains the **in-progress** path, not the review screen); `SOURCE/lib/scoring/essayLifecycle.ts` (H1 owns the derivations — this task **calls** them and never re-derives).
- **`types/result.ts` is NOT touched by Task B4.1** (I015).
