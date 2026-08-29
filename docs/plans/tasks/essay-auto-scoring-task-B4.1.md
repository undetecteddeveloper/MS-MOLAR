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
- [ ] `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (`:4`, `:131`)
- [ ] `SOURCE/lib/tutor/__tests__/prompt.test.ts` (`:238`, `:251`)
- [ ] `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (`:112`, `:132`)
- [ ] `SOURCE/app/(layer2)/tutorActions.ts` (`:269-272`)
- [ ] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:6`)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-09 — eleven comments/test titles asserting the old rule; **fix the reason, never the value or the behaviour**)
- `SOURCE/lib/scoring/computeScore.ts` (`:17-18`, `:35` — the two sites **Task B1.5** already corrected; match their new wording)
- `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (`:4`, `:93` — **out of scope**, D-12 — and `:131`)
- `SOURCE/lib/tutor/__tests__/prompt.test.ts` (`:238`, `:251`)
- `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (`:112`, `:132`)
- `SOURCE/app/(layer2)/tutorActions.ts` (`:269-272`)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:6`; the **scored branch at `:133` onward is untouched**)

## Investigation Notes
_(Record here: the corrected wording used, matched against B1.5's `computeScore.ts` comments; confirmation that `git diff` shows only comment/title lines; confirmation that `types/result.ts` and `computeScore.test.ts:93` were not touched.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, including the wording B1.5 already used at `computeScore.ts:17-18` and `:35`
- [ ] Record the current test-suite result as a baseline — every test green **before** the change

### 2. Green Phase
- [ ] Correct the reason at each of the seven sites, matching B1.5's wording
- [ ] Re-run the suite; every test that was green stays green **without being edited**

### 3. Refactor Phase
- [ ] Repo-scan for any remaining assertion that an essay is "never auto-scored" **in code this feature makes false**
- [ ] Confirm `git diff` contains **no** value or behaviour change
- [ ] Confirm `types/result.ts` (B2.1) and `computeScore.test.ts:93` (D-12) were **not** touched

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: **a behaviour change here would show as a test failure** — Config: `SOURCE/vitest.config.ts`
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
- [ ] **Implementation Complete** = seven reasons corrected, **zero** values or behaviours changed
- [ ] **Quality Complete** = six verify gates green (a behaviour change here would show as a test failure)
- [ ] **Integration Complete** = N/A
- [ ] All eleven D-09 sites carry the corrected reason across the four owning tasks (2 B1.5 + 1 B3.3 + 1 B2.1 + 7 here)
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: documentation only.
- Scope boundary — preserve unchanged: `SOURCE/types/result.ts` (**Task B2.1**, I015); `SOURCE/lib/scoring/__tests__/computeScore.test.ts:93` (**D-12**, owned by the short-answer slice); `SOURCE/lib/i18n/dictionaries/{vi,en}.ts`'s `upload.essayStored` (**OQ-5**, Phase E Task E4); the scored branch of `result/detail/page.tsx` (`:133` onward).
- Fix the **reason**. Never the value, never the behaviour.
