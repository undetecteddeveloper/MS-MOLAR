# Task B2.4 — Convert INT-2 and INT-3

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B2 (Read Path, vertical slice V2), Task B2.4**
Layer: **backend** (`SOURCE/app/(exams)/__tests__/**` — the integration lane)

Metadata:
- Dependencies: **Task B2.1**, **Task B2.2**.
- Blocks: nothing.
- Provides: integration lane resolution **3/3**; unresolved `it.todo` in `essayGrading.int.test.ts`: **0**.
- Size: Small (1 file)
- Verification level: **L2**.

## Implementation Content

Convert the remaining two cases in `SOURCE/features/exams/__tests__/essayGrading.int.test.ts`.

### INT-2 — the two PDF exits cannot disagree
### INT-3 — a graded essay stays out of the score triple and Layer 3

Both are specified obligation-by-obligation under **Proof Obligations** below.

### Honest seam (INT-3)
INT-3 proves only the **TypeScript** half. `record_skill_mastery()`'s own exclusion (`coalesce((pq->>'scored')::boolean, true)`, `schema.sql:1354`) is a **Postgres predicate**, asserted by the existing `recordSkillMastery.int.test.ts` and the service lane — **not** here. **A mock cannot prove a SQL filter.**

### Deduplication note, read before writing INT-3(c)
The plain `scored: false` exclusion is **already covered at unit level** by `wrongTwice.test.ts` Test 2 (`:105-140`), whose fixture is already named `Q-ESSAY`. **Do not restate it.** What is new — and the only thing justifying (c) here — is that the element now **also** carries the six new keys and arrives through the **real read path** rather than a hand-built unit fixture: the obligation is that the presence of those keys does not flip the predicate. **If that framing is dropped, (c) is duplicate coverage and should be deleted rather than written.**

## Target Files
- [x] `SOURCE/features/exams/__tests__/essayGrading.int.test.ts` — including its **FILE STATUS header**, which still said "ALL THREE CASES BELOW ARE SKELETONS. Nothing here executes an assertion yet." That sentence became false with this commit. It was rewritten rather than deleted: the *reason* it gave still governs anyone adding a case here (a file with zero collected tasks makes vitest exit 1 with "No test suite found in file"), so the reason is kept and the false status is replaced.

## Investigation Targets
- `SOURCE/features/exams/__tests__/essayGrading.int.test.ts` (the skeleton's INT-2 and INT-3 annotations — `Primary failure mode` / `Proof obligation`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Verification Strategy / Output Comparison — three pipelines, hand-built literals, `toEqual`, **no snapshots**)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Non-Scope — `isScored()`, `wrongTwice.ts`, the MASTERY WRITE block at `schema.sql:1354`, `record_exam_result()`, `QuotaKind`/`PLAN_LIMITS`/every `consumeQuota()` call site, `PublicQuestion`, `telemetry_log` columns, backfill, any background writer, TBD-02 — **asserted as unchanged, not merely left alone**)
- `SOURCE/features/exams/queries.ts` (Task B2.1 — `getResult()`'s select must carry `created_at`)
- `SOURCE/features/history/queries.ts` (Task B2.2 — the embedded select must carry **both** `per_question` and `created_at`)
- `SOURCE/lib/scoring/wrongTwice.ts` and `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (`:105-140` Test 2, fixture `Q-ESSAY` — **already covers the plain exclusion; do not restate it**)
- `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts` (where the SQL-side mastery exclusion is actually asserted)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `ESSAY_MAX_ATTEMPTS`, `summariseEssays`, `hasUnresolvedEssay`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-004) | state-lifecycle-negative | "**Ở mọi trạng thái vòng đời** (`pending`, `graded`, `failed`), phần tử được lưu **phải** giữ `scored: false` và `isCorrect: false`. Một phần tử `graded` mang `scored: true`, `isCorrect: true`, hoặc **thiếu** khoá `scored`, là **trượt** tiêu chí này." | INT-3(a) asserts `"scored" in element`, not just its value |
| backend DD (§ EG-BE-027) | derived-display | "**Trong khi** tính tổng điểm tự luận, chỉ câu ở `graded` **phải** đóng góp vào **cả hai** vế earned và max; `pending`, `failed` và câu không chấm được đóng góp **0 vào cả hai**." | INT-3(d): one graded (0.75), one pending, one failed ⇒ `earned === 0.75`, `max === 1`, `gradedCount === 1` — **not** `max === 3` |
| backend DD (§ EG-BE-034) | derived-display | "`hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`" | INT-2(d) runs the equality on the same fixtures |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `computeScore()` → `exam_results.per_question` |
|---|---|
| Owner (right) | the jsonb array read by **`getResult()` and `listMyHistory()`** |
| Consumer parse rule | Readers branch on the **presence** of the `essayState` key, then on its value |
| Expected signal | INT-2(e): the **query shape** on both paths — `getResult()`'s select carries `created_at` and `listMyHistory()`'s embedded select carries **both** `per_question` and `created_at`. A missing column here is the exact mechanism of the primary failure mode and is **invisible to any assertion on mapped output alone** |

## Investigation Notes

**The independently authored literal in INT-2(a)** — `true`, authored from the fixture by hand: the attempt holds one `failed` essay with `essayAttempts === ESSAY_MAX_ATTEMPTS` (RS-6, `retryAvailable` false). Agreement alone is asserted **and** the shared value is held against that literal, because two paths wrong in the same direction are equal.

**The independently authored literals in INT-3(b)** — `total: 4`, `correct: 3`, `totalScore: 7.5`, hand-computed from the **four MCQs only**. The fixture is chosen so that counting the essay would move **all three**: 5 / 3.75 / 6.75. With a fixture where the numbers coincide, (b) would prove nothing. A fourth assertion pins `total − correct === 1`, because `ScoreCard` derives `wrong` that way and a leaked essay would silently redefine what that number means on a live surface.

**The fixture shapes for RS-6 and RS-4 in INT-2(b)** — both in **one** attempt: `q-rs6` (`failed`, `essayAttempts: ESSAY_MAX_ATTEMPTS` ⇒ `retryAvailable: false`) and `q-rs4` (`failed`, `essayAttempts: 1` ⇒ `retryAvailable: true`). Their `EssayView`s are asserted individually, so the `true` in (a) is attributable to `q-rs6` alone. A **second** case then runs RS-4 *by itself* and requires `hasIncompleteEssay === false` on both paths while `hasUnresolvedEssay === true` — that is the case that separates "any failure" from "unrecoverable failure", and mutation **Q3** confirms it fires.

**INT-3(c)'s framing, checked against the deduplication note before writing it** — the case asserts that the six lifecycle keys, arriving through the **real read path**, do not flip the wrong-twice predicate. It does **not** restate the plain `scored: false` exclusion, which `wrongTwice.test.ts` Test 2 (`:105-140`, fixture `Q-ESSAY`) already owns. Concretely: the graded essay is fed **twice**, on two distinct attempts, through `getResult()`'s real cross-attempt history read; the assertion is that its `hasBeenWrongTwice` stays `undefined` **while the six keys are present on the element**, alongside a genuinely twice-wrong MCQ as the positive control. Mutation **Q7** confirms the case fires; without the positive control it would also pass for a predicate that returned nothing at all.

**One overlap declared rather than hidden**: EG-BE-027's arithmetic is also asserted in Task B2.1's `getResult` tests. INT-3(d) is not a copy — it runs the arithmetic **in the same attempt as the score triple** and asserts that adding two more essays moved neither ledger. That combination is what B2.1's version cannot see.

### Mutation testing: 7 mutations, 7 caught

| # | Mutation | Caught by |
|---|---|---|
| Q1 | `getResult` publishes *unresolved* as `hasIncompleteEssay` — the two doors disagree | INT-2(a), plus (b) and two (c) shapes |
| Q2 | `listMyHistory` loses `created_at` — one path extended, the other not | INT-2(e), the query-shape case |
| Q3 | RS-6 collapses to "any failure" | INT-2(b), the negative half |
| Q4 | summary `max` counts every essay, not only `graded` | INT-3(d) |
| Q5 | the essay band leaks into the score triple on the read path | INT-3(b) and (d) |
| Q6 | `lowConfidence` dropped on the way out | INT-3(e)'s positive control |
| Q7 | wrong-twice gating stops excluding unscored rows | INT-3(c), plus INT-2(f) |

Q1 is the one worth naming: it is the exact shape of defect **F-06** — two derivations of one truth drifting apart — and it is caught because INT-2(a) drives **one** fixture through **both** doors rather than checking each in isolation.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, especially the skeleton's annotations and `wrongTwice.test.ts:105-140`
- [x] Author the literals **independently** — never captured from the implementation's output
- [x] Write INT-2 (a)–(f) and INT-3 (a)–(e); observe them fail — they were **green on first run**, because B2.1/B2.2/B2.3 landed the read paths in the three commits before this one. As in B1.6, the evidence is mutation testing instead: 7 mutations, 7 caught, listed above.

### 2. Green Phase
- [x] Bring both cases green against the real read paths with the Supabase client mocked at its sanctioned boundary — one `driveBothReadPaths()` helper feeds **one** fixture to `getResult()` and then to `listMyHistory()`, re-pointing the shared `createClient()` mock between them. That is what lets a single fixture reach both doors, which is the whole subject of INT-2.
- [x] Confirm integration lane resolution is **3/3** — 24 executing cases in the file, and the default lane now reports **no `todo` at all** (it reported 2 before this commit)

### 3. Refactor Phase
- [x] Re-read INT-3(c): if it is not framed as "the six new keys arriving through the real read path do not flip the predicate", **delete it** rather than shipping duplicate coverage — re-read and kept; the framing is written into the case itself, above the assertions
- [x] Confirm no snapshot is used anywhere — `toEqual` against hand-built literals throughout; no `toMatchSnapshot` in the file
- [x] Confirm the added cases still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit/integration correctness — Config: `SOURCE/vitest.config.ts`; covers `SOURCE/features/exams/__tests__/essayGrading.int.test.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | **primary gate** — 1876 passed / 10 skipped / **0 todo** (+13). The todo count reaching zero is this task's deliverable, not a side effect |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` FE-1 (e) — `locale en` and `locale vi` |
| 6 | `npm run test:localdb` | **0** | first attempt, 11 passed / 2 todo |

**Known-red window:** `npm run verify:schema` (dev) exits **1** with exactly **one** failing assertion, the character ceiling. Red by design from H7 until B3.3.

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method**: run the default vitest lane; read each obligation individually; confirm both read paths are driven for **one** fixture attempt id in INT-2(a).
- **Success criteria**: integration lane resolution **3/3**, unresolved `it.todo`: **0**; every obligation below asserted with independently authored literals and no snapshots.
- **Failure response**: if the two paths agree but disagree with the independently authored literal, **both** are wrong in the same direction — fix the derivation, not the literal. If INT-2(e)'s query-shape assertion fails, a column is missing on one read path; that is the exact mechanism of the primary failure mode and is invisible to output assertions.
- **Verification level**: **L2**.

## Proof Obligations — INT-2 (the two PDF exits cannot disagree)
- **(a)** For **one** fixture attempt id, drive **both** `getResult()` and `listMyHistory()` and assert `examResult.hasIncompleteEssay === historyEntry.hasIncompleteEssay` **and** that the shared value equals an **independently authored literal `true`** — equality alone is not enough, since two paths wrong in the same direction are equal.
  - **Primary failure mode** (Failure Mode Checklist: **same-value**): both paths wrong identically, passing an equality-only assertion. **Boundary**: both read paths in-process, Supabase mocked at `createClient()`. **State assertion**: N/A. **Mock rationale**: `createClient()` is the sanctioned boundary of this lane. **Residual**: that the two doors produce **identical files** is F-B3's and FE2E-3's.
- **(b)** The fixture contains an **RS-6** element specifically (`essayState: "failed"` with `essayAttempts === ESSAY_MAX_ATTEMPTS`, i.e. `retryAvailable` false) **and** an **RS-4** element (failed, attempts < 3) that must **not** set `hasIncompleteEssay` — so the case distinguishes "any failure" from "unrecoverable failure".
  - **Primary failure mode**: treating any `failed` as incomplete, so a retryable question triggers the PDF annotation. **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(c)** Three negative shapes all yielding `false` on both paths and all `typeof === "boolean"`: all essays graded; no essay questions at all; a legacy row with no `essay*` key.
  - **Primary failure mode**: `undefined` reaching the PDF pipeline. **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(d)** EG-BE-034's equality run on the same fixtures. **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(e)** **Query shape on both paths** — `getResult()`'s select carries `created_at` and `listMyHistory()`'s embedded select carries **both** `per_question` and `created_at`.
  - **Primary failure mode**: one read path extended and the other not — most likely `listMyHistory()` gains `per_question` but not `created_at`, so its deadline derivation runs against a missing timestamp and an overdue pending question is "still pending" there while `/result` calls it RS-6. **The student then gets a PDF *with* the incomplete-essay line from one button and *without* it from the other, for the same attempt.** **Boundary**: assertion on the select string itself — invisible to any assertion on mapped output alone. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(f)** The legacy-row Output Comparison for **both** pipelines. **Boundary**: as above, against hand-built literals. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.

## Proof Obligations — INT-3 (a graded essay stays out of the score triple and Layer 3)
- **(a)** The graded element from `getResult()` has `scored === false` and `isCorrect === false`, and the `scored` key is **present** — assert `"scored" in element`, not just the value, because a missing key hits SQL's `coalesce(..., true)` default and **flips the mastery filter**.
  - **Primary failure mode**: an omitted key silently enrolling graded essays into mastery. **Boundary**: in-process over the returned element. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the SQL predicate itself is **not** proven here — see the honest seam.
- **(b)** `totalScore`, `correct` and `total` equal **independently authored literals** computed from the **non-essay** questions only, using a fixture where including the essay would **visibly change all three** (e.g. 4 MCQ, 3 correct, plus a graded essay at band 0.75).
  - **Primary failure mode** (Failure Mode Checklist: **same-value**): coinciding numbers, where the assertion proves nothing. **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(c)** Real `computeWrongTwiceQuestionIds()` over rows containing this graded essay **twice** returns an array that does **not** contain the essay's `questionId` while still containing a genuinely twice-wrong MCQ's id (the **positive control**).
  - **Framing that justifies this case at all**: the element now **also carries the six new keys** and arrives through the **real read path** — the obligation is that their presence does not flip the predicate. `wrongTwice.test.ts` Test 2 (`:105-140`, fixture `Q-ESSAY`) already covers the plain exclusion; **if this framing is dropped, delete (c) rather than writing duplicate coverage.**
  - **Primary failure mode**: the new keys changing the predicate's behaviour through the real path. **Boundary**: real `wrongTwice.ts` over the real read path's output. **State assertion**: N/A. **Mock rationale**: `wrongTwice.ts` is **real**, not mocked. **Residual**: none.
- **(d)** EG-BE-027 arithmetic: in a fixture with one graded (0.75), one pending and one failed essay, `earned === 0.75`, `max === 1`, `gradedCount === 1` — **not** `max === 3`.
  - **Primary failure mode**: a failed essay contributing 0 to earned and 1 to max — **exactly the silent zero AC-015 forbids**. **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(e)** `essayLowConfidence: true` changes **no** number in (b) or (d) — the same fixture run twice with the flag flipped, numeric output `toEqual`.
  - **Primary failure mode**: the display-only flag leaking into arithmetic (AC-046). **Boundary**: as above. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the display half is F-B1's (FE-AC-04).

## Completion Criteria
- [x] **Implementation Complete** = INT-2 and INT-3 executing
- [x] **Quality Complete** = `npx vitest run` green
- [x] **Integration Complete** = integration lane resolution **3/3**, unresolved `it.todo`: **0** — verified two ways: the lane summary reports no todo, and `grep "it\.todo("` matches nothing in the file (the four remaining textual hits are all inside comments)
- [x] Every Reference Contract Compliance Check evaluates to `Y` — EG-BE-004 by INT-3(a)'s `"scored" in element`; EG-BE-027 by INT-3(d) under mutation Q4; EG-BE-034 by INT-2(d) with both a positive and a negative control
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: none in production code.
- Scope boundary — preserve unchanged: `SOURCE/lib/scoring/wrongTwice.ts` (**not one byte**), `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts:105-140` (already covers the plain exclusion — do **not** restate it), `schema.sql:1354` (the MASTERY WRITE filter — asserted as unchanged in the Final Phase's regression review).
- **Honest seam**: a mock cannot prove a SQL filter. `record_skill_mastery()`'s exclusion is proven by `recordSkillMastery.int.test.ts` and the service lane, not here.
