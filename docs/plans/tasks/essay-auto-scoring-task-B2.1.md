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
- [ ] `SOURCE/app/(layer2)/queries.ts`
- [ ] `SOURCE/types/result.ts`

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
_(Record here: the confirmed absence of `created_at` in today's select; the hand-built legacy-shape literal used for the Output Comparison; the frozen `now` used in the boundary cases.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): `listMyHistory()`'s select (B2.2) and both PDF construction sites (B2.3) — a column added on one read path and not the other is the primary failure mode INT-2 guards
- [ ] Write the tests: the three deadline boundary cases, the missing/unrecognised-key cases, the arithmetic case, and the legacy-row Output Comparison against a **hand-built literal**; observe them fail

### 2. Green Phase
- [ ] Add `created_at` to the select **and** to `ResultRow`
- [ ] Attach `essay?`, `essaySummary?` and the **required** `hasIncompleteEssay`
- [ ] Add `essay?: EssayView` to `PerQuestionResult` and fix the reason at `types/result.ts:14-17`
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm `now` is injected and frozen in every time-dependent case
- [ ] Confirm nothing re-derives `state === "failed" && !retryAvailable` locally (EG-BE-036 — it lives only in `essayLifecycle.ts`)
- [ ] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the required `hasIncompleteEssay` names any site that forgot it — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

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
- [ ] **Implementation Complete** = select, type and three attachments
- [ ] **Quality Complete** = six verify gates green
- [ ] **Integration Complete** = **L1** on dev — the result page's data layer carries correct lifecycle values for a seeded graded attempt
- [ ] Output Comparison pipeline 2 green against a hand-built literal (**no snapshots**)
- [ ] `types/result.ts:14-17`'s reason corrected — **no value or behaviour change**
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: B2.2 (the sibling read path), B2.3 (the PDF data contract), B2.4 (INT-2/INT-3), B3.2 (the retry action reads through this), F-A1 (the string parameters are wired to `EssaySummary`'s field names), F-A3/F-B1 (the display surfaces).
- Scope boundary — preserve unchanged: `SOURCE/app/(HM)/queries.ts` (Task B2.2); the `queries.ts:633-657` model-answer branch (already permitted after submission — AC-043 constrains the **in-progress** path, not the review screen); `SOURCE/lib/scoring/essayLifecycle.ts` (H1 owns the derivations — this task **calls** them and never re-derives).
- **`types/result.ts` is NOT touched by Task B4.1** (I015).
