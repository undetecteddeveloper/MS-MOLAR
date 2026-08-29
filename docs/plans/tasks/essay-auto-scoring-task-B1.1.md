# Task B1.1 — EARLY VERIFICATION POINT: `computeScore()` output-comparison tests — authored RED, landed GREEN inside Task B1.5 commit 1

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.1**
Layer: **backend** (`SOURCE/lib/scoring/**`)

Metadata:
- Dependencies: **Task H1**.
- Blocks: **Task B1.5** (this task's cases land inside B1.5 commit 1 and are what turn the EVP green).
- Provides: the backend **Early Verification Point** — the proof that adding a feature to a scoring function moves nobody's score.
- Size: Small (1 test file)
- Verification level: **L2**, evaluated on B1.5 commit 1.

## THIS IS NOT A STANDALONE COMMIT (I006, fixed 2026-08-29)

The cases call `computeScore(questions, answers, { essayGrading: false })`, but `computeScore.ts:93-96` takes **two** parameters — so a test-file-only commit would put verify gates **1 (`tsc`)** and **3 (`vitest`)** red on a commit that Gate E1 requires green. The plan's headline claim is that verification is not deferred; that claim must not rest on the one task that cannot be committed.

**Resolution: author the cases RED, observe the failure, then land them in the same commit as the `computeScore.ts` change — Task B1.5 commit 1 — with the RED observation recorded in that commit's message** (which fixture failed, and that it failed **because the third parameter did not yet exist**, not for some other reason). RED→GREEN happens inside one commit; the discipline is preserved in the commit message rather than in a broken commit.

## Implementation Content

In `SOURCE/lib/scoring/__tests__/computeScore.test.ts`, write the output-comparison cases **before** touching `computeScore.ts`, and confirm they fail for the right reason (**the third parameter does not exist yet**) **before staging anything**.

Extend the existing `essay()` fixture helper with a third parameter whose default is **`undefined`** — **not** a non-empty string. The short-answer slice was caught by exactly this trap: a non-empty default made an unrelated `topicBreakdown` fixture `scored: true` and broke that block's exact-2-entry assertion. `essay()`'s current shape (`:68-79`) does not set `essayAnswer`, so the existing block at `:131-139` stays green **without edits** — and **it must be verified to do so**.

## Target Files
- [ ] `SOURCE/lib/scoring/__tests__/computeScore.test.ts` — committed **together with** `SOURCE/lib/scoring/computeScore.ts` in **Task B1.5 commit 1**

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ `computeScore()` changes / D-01 — the third `options` parameter, the branch split at `:99-101`, `hasEssayGroundTruth()`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-10 — the `essay()` helper's third parameter defaults to **`undefined`**)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Verification Strategy / Output Comparison — three pipelines, hand-built literals, `toEqual`, **no snapshots**)
- `SOURCE/lib/scoring/computeScore.ts` (`:17-18` and `:35` the two stale comments; `:40-41` `isScored()`; `:93-96` the current two-parameter signature; `:99-101` the `if (!isScored(q))` early return in the `.map()` callback)
- `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (`:68-79` the `essay()` helper; `:93` the describe title carrying the D-12 date debt — **out of scope**; `:131-139` the `topicBreakdown` block that must stay green **without edits**)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `newEssayEntry()` and the six key literals)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-004) | state-lifecycle-negative | "**Ở mọi trạng thái vòng đời** (`pending`, `graded`, `failed`), phần tử được lưu **phải** giữ `scored: false` và `isCorrect: false`. Một phần tử `graded` mang `scored: true`, `isCorrect: true`, hoặc **thiếu** khoá `scored`, là **trượt** tiêu chí này." | Every emitted essay element carries `scored: false` and `isCorrect: false`, and the `scored` key is **present** |
| backend DD (§ EG-BE-002) | state-lifecycle-negative | "**Khi** `computeScore()` chạy với `options.essayGrading === false` (mặc định), hệ thống **phải** phát ra phần tử `per_question` cho câu `essay` **y hệt từng byte** như hôm nay: `{ questionId, selected, isCorrect: false, scored: false }` và **không một khoá `essay*` nào**." | With the flag off, the essay element's **key set** equals exactly those four keys |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `computeScore()` → `exam_results.per_question` (Supabase Postgres, separate process) |
|---|---|
| Owner (left) | `SOURCE/lib/scoring/computeScore.ts` via `recordExamResult()` |
| Owner (right) | `public.exam_results.per_question` (jsonb), later read by `getResult()` / `listMyHistory()` / `record_essay_grade()` |
| Serialized format | jsonb array elements carrying, for a gradeable essay: `essayState:"pending"`, `essayEarned:null`, `essayMax:null`, `essayLowConfidence:false`, `essayAttempts:0`, alongside `scored:false`, `isCorrect:false`. `JSON.stringify`d straight from TypeScript — **camelCase, no snake_case mapping layer** |
| Consumer parse rule | Readers branch on the **presence** of the `essayState` key (absent ⇒ RS-0, the shared not-scored branch), then on its value; an unrecognised value returns `null` and warns once |
| Expected signal | INT-1(a): the payload handed to the mocked `recordExamResult` equals an independently authored literal, and `Object.keys` of every essay element contains **none** of the six keys when the flag is off |

Roundtrip check this task owns: what `computeScore()` emits is exactly what a reader branching on **key presence** can interpret — hence assertions on the **key set**, never on `essayState === undefined` (a key present with value `undefined` serialises differently into jsonb).

## Investigation Notes
_(Record here: which fixture failed in the RED run and the exact reason (the third parameter does not exist); confirmation that the `topicBreakdown` block at `:131-139` stayed green without edits.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Extend the `essay()` helper with a third parameter defaulting to **`undefined`**
- [ ] Write cases (a)–(f) below
- [ ] Run them and **observe the failure**; confirm it is because the third parameter does not exist, **not** for another reason
- [ ] **Record that observation** — it goes into B1.5 commit 1's message

### 2. Green Phase (inside Task B1.5 commit 1)
- [ ] Land these cases in the same commit as the `computeScore.ts` change
- [ ] Confirm all six obligations pass

### 3. Refactor Phase
- [ ] Verify the existing block at `:131-139` is green **without edits**
- [ ] Confirm no assertion uses a snapshot

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the three-argument call type-checks only once the parameter exists — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the Early Verification Point itself — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

This task has **no separate commit**; the gates are evaluated on **Task B1.5 commit 1**. Record them here as well, so the EVP's evidence is legible from this file.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: B1.5 commit 1 sits between H7 and B3.3, so `verify:schema`'s character-ceiling assertion is red **by design**. Record it as expected; any **other** red `verify:schema` assertion is a regression.

## Operation Verification Methods
- **Verification method** (this is the backend Early Verification Point): run `computeScore(questions, answers)` and `computeScore(questions, answers, { essayGrading: false })` over the **same** fixture set covering all four question types and assert the two `ScoreResult` values are element-for-element equal with `toEqual`. Then run a third call with `{ essayGrading: true }` and assert the **only** difference is the five new keys on essay elements **that have ground truth** — `totalScore`, `correct`, `total`, `topicBreakdown` and every non-essay element byte-identical.
- **Success criteria**: the first two calls are **absolutely** equal — no tolerated differences; the third differs at exactly the expected key set and nowhere else.
- **Failure response** (the EVP's stop condition): if (a) fails, the parameter default is wrong and **everything else in the feature stands on that proposition — stop.** If (b) differs outside the expected key set, the branch split is catching the wrong questions; the likeliest cause is a dropped `q.questionType === "essay"` condition, so ground-truth-less `true_false`/`short_answer` also receive keys.
- **Verification level**: **L2** — evaluated on B1.5 commit 1. It is the smallest unit that proves the riskiest thing in the whole change: no DB, no network, no key.

## Proof Obligations
- **(a)** `computeScore(questions, answers)` and `computeScore(questions, answers, { essayGrading: false })` over the **same** fixture set covering all four question types produce `ScoreResult` values that are element-for-element equal (`toEqual`). **Absolute equality — no tolerated differences.**
  - **Primary failure mode**: the parameter default is wrong, so today's callers get different output. **Boundary**: in-process unit. **State assertion**: N/A (pure function). **Mock rationale**: none — no I/O exists in this function (AC-013). **Residual**: proves the pure half; that the shape **survives the call site** is INT-1's (Task B1.6).
- **(b)** A third call with `{ essayGrading: true }` differs **only** by the five new keys on essay elements **that have ground truth**. `totalScore`, `correct`, `total`, `topicBreakdown` and every non-essay element are byte-identical.
  - **Primary failure mode**: the branch split catches the wrong questions — most likely a dropped `q.questionType === "essay"` condition. **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(c) EG-BE-001**: with the flag on and a non-empty, non-whitespace `essayAnswer`, the element carries **all five** keys — `essayState:"pending"`, `essayEarned:null`, `essayMax:null`, `essayLowConfidence:false`, `essayAttempts:0` — **plus** `scored:false` and `isCorrect:false`.
  - **Primary failure mode**: a key emitted with the wrong insert value (e.g. `essayEarned: 0` instead of `null`). **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(d) EG-BE-002**: with the flag off (the default), the essay element is byte-for-byte `{ questionId, selected, isCorrect: false, scored: false }` and carries **not one** `essay*` key. **Assert on the key set**, not on `essayState === undefined` — a key present with value `undefined` serialises differently into jsonb.
  - **Primary failure mode**: keys emitted as `undefined` rather than omitted, which passes an `=== undefined` assertion and still changes the stored jsonb. **Boundary**: in-process unit over `Object.keys`. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(e) EG-BE-003**: an essay whose `essayAnswer` is null, empty or whitespace-only emits **no** `essay*` key regardless of the flag — the same ground-truth-presence guard `isScored()` already applies to `true_false` and `short_answer`.
  - **Primary failure mode**: an ungradeable question receives keys and shows "Đang chấm" forever. **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: none. **Residual**: that no provider call is made for such a question is B1.4's (AC-038).
- **(f) EG-BE-030**: every existing fixture block (`mcq`, `true_false`, `short_answer`, `essay`, `topicBreakdown`) produces identical output. `toEqual` against literals, **never snapshots** — a snapshot gets updated when it goes red, which records the very drift it exists to catch.
  - **Primary failure mode**: the `essay()` helper's new parameter defaults to a non-empty string, making an unrelated `topicBreakdown` fixture `scored: true` and breaking that block's exact-2-entry assertion — the trap that caught the short-answer slice. **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = cases written, **observed failing for the right reason**, and landed green inside B1.5 commit 1 with the RED observation in that commit message
- [ ] **Quality Complete** = all six verify gates green **on B1.5 commit 1** (this task has no separate commit to gate)
- [ ] **Integration Complete** = the EVP's stop condition was **evaluated against a real run**, not assumed
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled (from B1.5 commit 1's run)

## Notes
- Impact scope: this is the gate on the whole feature. If (a) fails, stop the feature rather than continuing.
- Scope boundary — preserve unchanged: `SOURCE/lib/scoring/__tests__/computeScore.test.ts:131-139` (must stay green **without edits**); `:93`'s describe title carrying the D-12 date debt (`2026-07-21` where git says `2026-07-27`) — **explicitly out of scope**, owned by the short-answer slice.
- The header at `:4` and the describe title at `:131` are **D-09 reason-only** sites owned by **Task B4.1**, not by this task.
