# Task B4.1 — The remaining seven D-09 sites

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B4 (Reason-Only Documentation Corrections), Task B4.1**
Layer: **backend** (test files, one Server Action file and one route file — comments and titles only)

Metadata:
- Dependencies: **Task B1.5**.
- Blocks: nothing.
- Provides: the last seven of eleven D-09 reason corrections.
- Size: Medium (5 files, comments/titles only)
- Verification level: **L3/L2** — six verify gates green; **a behaviour change here would show as a test failure**.

## Purpose

Eleven comments and test titles in the tree assert the **old** rule — *"an essay is never scored"*. The new truth is *"the band is written **outside** `computeScore`, and the row deliberately stays `scored:false`"*. **Fix the reason; never the value, never the behaviour.**

## Site accounting, stated once so nothing is double-assigned or dropped (I015)

AC-051 names four; D-09 found **eleven**. They are distributed as **2 + 1 + 1 + 7 = 11**:

| Count | Owner | Sites |
|---|---|---|
| 2 | **Task B1.5 commit 1** | `computeScore.ts:17-18`, `computeScore.ts:35` |
| 1 | **Task B3.3** | `prompt.ts:36` |
| 1 | **Task B2.1** | `types/result.ts:14-17` — that task already edits the file for the `essay?` field; a type and the comment describing it should not move in two commits |
| **7** | **this task** | listed below |

## Implementation Content

Correct the reason text at:
1. `SOURCE/lib/scoring/__tests__/computeScore.test.ts:4` (header)
2. `SOURCE/lib/scoring/__tests__/computeScore.test.ts:131` (describe title)
3. `SOURCE/lib/tutor/__tests__/prompt.test.ts:238`
4. `SOURCE/lib/tutor/__tests__/prompt.test.ts:251`
5. `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts:112`
6. `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts:132`
7. `SOURCE/app/(layer2)/tutorActions.ts:269-272`
8. `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx:6`

*(Eight line references across five files; they are the seven remaining D-09 **sites**, two of which sit in the same file at two line ranges.)*

**`types/result.ts` is NOT touched here** — it belongs to Task B2.1 (I015).

### Explicitly out of scope, recorded so it is not swept in
`computeScore.test.ts:93`'s describe title still reads `2026-07-21` where git says `2026-07-27` (**D-12**). That is a **pre-existing documentation debt already owned by the short-answer slice**, and this feature does not touch that block. Noted so the next header edit clears it.

### Also out of scope
`upload.essayStored` (`vi.ts:271`, `en.ts:334`), which tells the **exam author** essays are not auto-scored and becomes false once Gate A passes — see **OQ-5**, carried into **Phase E, Task E4**.

## Target Files
- [x] `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (header + describe title)
- [x] `SOURCE/lib/tutor/__tests__/prompt.test.ts` (the Test 3 intent block + the `@ts-expect-error` reason)
- [x] `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (the Behavior block + the `Q-ESSAY` fixture comment)
- [x] `SOURCE/app/(layer2)/tutorActions.ts` (the essay-exclusion branch comment)
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (file header)
- [x] `SOURCE/lib/scoring/computeScore.ts` — **extra, reassigned**: the two sites this file credits to B1.5 were never actually corrected (see Investigation Notes)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-09 — eleven comments/test titles asserting the old rule; **fix the reason, never the value or the behaviour**)
- `SOURCE/lib/scoring/computeScore.ts` (`:17-18`, `:35` — the two sites **Task B1.5** already corrected; match their new wording)
- `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (`:4`, `:93` — **out of scope**, D-12 — and `:131`)
- `SOURCE/lib/tutor/__tests__/prompt.test.ts` (`:238`, `:251`)
- `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (`:112`, `:132`)
- `SOURCE/app/(layer2)/tutorActions.ts` (`:269-272`)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:6`; the **scored branch at `:133` onward is untouched**)

## Investigation Notes

### The D-09 accounting had a hole: B1.5's two sites were never corrected
This task file says the two `computeScore.ts` sites were corrected by **Task B1.5** and instructs "match their new wording". They were **not**. Verified by reading the file and by `git show 3a34c9c`: B1.5 added correct new reasoning *inside the function body* ("Nó vẫn `scored: false` ... và đó là chủ đích"), but left both assigned sites intact —

- `computeScore.ts:17-18` still read *"essay vẫn 'stored, not auto-scored' (không có UI nhập cho player, không có gì để chấm)"*
- `computeScore.ts:35-36` still read *"essay không bao giờ chấm"*

Both are now false, and the second is the more misleading: it reads as a claim about the world when it is only a claim about this function.

**Corrected here, and the reassignment is recorded rather than left silent.** Three reasons this is the right place rather than a follow-up ticket: (a) they are the same class of edit as the other seven — reason-only, zero behaviour; (b) this task's own Refactor step orders a repo scan for *"any remaining assertion that an essay is 'never auto-scored' in code this feature makes false"*, and that scan lands squarely on them; (c) the Completion Criterion "all eleven D-09 sites carry the corrected reason" is untickable while two still carry the old one. So the split is **9 here + 1 (B3.3) + 1 (B2.1) = 11**, not 7 + 2 + 1 + 1.

### The corrected reason, stated once and reused
The old rule was *"an essay is never scored"*. The new truth has two halves, and different sites need different halves:

- **In the scoring path** (`computeScore.ts`, `computeScore.test.ts`): the band is written **outside** `computeScore()` by the async path via `record_essay_grade()`; the row deliberately stays `scored: false` so the question stays out of the score denominator until something actually grades it. `scored: false` now means *"not scored **here**, **yet**"* — not *"never"*.
- **In the tutor path** (`prompt.test.ts`, `tutorActions.ts`, `wrongTwice.test.ts`): essays are still excluded, but **not** because they go ungraded. Wrong-twice eligibility is computed from `isCorrect`, a **binary** predicate. An essay has no `isCorrect` — it has a continuous band — so "wrong twice" is not statable for it. This matters: the old reason would have been *repealed* by ADR-0018, which invites a future maintainer to widen the union. The new reason survives it.

### The diff is comments plus exactly one title
`git diff -U0` filtered to non-comment lines returns **exactly one** line across all of `SOURCE/`: the `describe` title at `computeScore.test.ts`, which is site 2 on this task's own list ("describe title"). The describe's grouping is unchanged — same block, same `it`s, same assertions.

Old: `computeScore — essay vẫn KHÔNG auto-scored (SA-BE-010)`
New: `computeScore — essay KHÔNG được chấm Ở ĐÂY, band tới từ đường bất đồng bộ (SA-BE-010)`

### Repo scan came back clean
Scanning for `essay không bao giờ chấm` / `never scored` / `essay vẫn KHÔNG auto-scored` / `essay/ungraded` returns only the **corrections themselves**, which quote the old wording in order to mark it false ("the old text read X — after ADR-0018 that is false"). Those are citations, not assertions. No site still asserts the repealed rule.

### Out of scope, confirmed untouched by `git status`
- `SOURCE/types/result.ts` — Task B2.1's site (I015). Clean.
- `computeScore.test.ts`'s D-12 date debt — `2026-07-21` still present at both the header and the `true_false` describe. Untouched, still owed by the short-answer slice.
- `upload.essayStored` in `vi.ts` / `en.ts` — OQ-5, Phase E Task E4. Both dictionaries clean.
- The scored branch of `result/detail/page.tsx` — only the file header changed; TBD-02's deferral holds.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets. **B1.5 had no new wording to match** — its two sites still carried the old rule; verified by reading the file and `git show 3a34c9c`
- [x] Baseline recorded: **1950 passed / 10 skipped / 0 todo** on this exact tree before the change

### 2. Green Phase
- [x] Reason corrected at all **nine** sites (the seven owned + B1.5's two orphans), using the two-halved reason recorded in Investigation Notes
- [x] Suite re-run: **1950 passed / 10 skipped** — identical to baseline, nothing edited to keep it green

### 3. Refactor Phase
- [x] Repo scan clean — remaining hits are the corrections quoting the old wording to mark it false
- [x] `git diff -U0` minus comment lines yields **exactly one** line repo-wide: the authorised `describe` title
- [x] `types/result.ts`, the D-12 date, and both i18n dictionaries confirmed untouched via `git status`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: **a behaviour change here would show as a test failure** — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | **1950 passed / 10 skipped / 0 todo — byte-identical to the pre-change baseline.** That equality *is* the proof obligation for a reason-only task: not one test was edited, and not one changed result |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline ONLY**: 2 failures, both `subscription.fixture.e2e.test.ts > FE-1 (e) ... > locale en` and `locale vi`. CRLF churn on `RichText.regression.test.tsx.snap` reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — **Task H8**, still open) |

**Baseline**: the same lane reported **1950 passed / 10 skipped** on this exact tree immediately before the change (recorded at B3.3's Gate 3). No lane moved.

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run the full default lane before and after; inspect `git diff` and confirm every changed line is a comment or a describe title.
- **Success criteria**: **zero behavioural diffs** — every test that was green stays green **without being edited**; a repo scan finds no remaining assertion that an essay is "never auto-scored" in code this feature makes false.
- **Failure response**: if a test goes red, the change was not reason-only — revert that site and re-read D-09. If a site's **value** looks wrong, that is a different task; D-09 is explicitly reason-only.
- **Verification level**: **L3/L2**.

## Proof Obligations
- **Claim (AC-051 / D-09)**: all eleven D-09 sites carry the corrected reason, and the seven owned here are corrected **without any value or behaviour change**.
  - **Primary failure mode**: a "reason" edit that quietly changes an assertion's value or a describe's grouping, so a behaviour change ships disguised as a comment fix.
  - **Boundary to exercise**: the full default vitest lane before and after, plus a `git diff` review restricted to comment and title lines.
  - **State assertion**: N/A — no state, no behaviour.
  - **Mock boundary rationale**: none — the suite runs as it ships.
  - **Residual**: proves nothing broke. It does **not** cover `upload.essayStored` (OQ-5, Phase E Task E4) or `computeScore.test.ts:93`'s D-12 date debt, both explicitly out of scope.

## Completion Criteria
- [x] **Implementation Complete** = nine reasons corrected (seven owned + two reassigned), **zero** values or behaviours changed
- [x] **Quality Complete** = six gates run separately with real exit codes; five at 0, `test:fixture` at the TD-030 baseline
- [x] **Integration Complete** = N/A
- [x] All eleven D-09 sites carry the corrected reason — **but the split is 9 + 1 + 1, not 2 + 1 + 1 + 7**, because B1.5 never corrected its two
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: documentation only.
- Scope boundary — preserve unchanged: `SOURCE/types/result.ts` (**Task B2.1**, I015); `SOURCE/lib/scoring/__tests__/computeScore.test.ts:93` (**D-12**, owned by the short-answer slice); `SOURCE/lib/i18n/dictionaries/{vi,en}.ts`'s `upload.essayStored` (**OQ-5**, Phase E Task E4); the scored branch of `result/detail/page.tsx` (`:133` onward).
- Fix the **reason**. Never the value, never the behaviour.
