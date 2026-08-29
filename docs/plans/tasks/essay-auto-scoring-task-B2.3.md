# Task B2.3 — `AttemptPdfData` gains `hasIncompleteEssay` and both construction sites fill it

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B2 (Read Path, vertical slice V2), Task B2.3**
Layer: **backend** (`SOURCE/lib/pdf/**`) with two call-site edits in route/component files

Metadata:
- Dependencies: **Task B2.1**, **Task B2.2**.
- Blocks: **Task F-B3** (the template line and the optional label).
- Provides: one shared field on the type that is the confluence of **both** PDF export routes.
- Size: Small (3 files)
- Verification level: **L3/L2** — `tsc` is the mechanism proving no site was missed.

## Change Category
`Change Category: boundary-change`

`AttemptPdfData` is the shared contract of both export routes. Adjacent cases swept (verified by repo-wide grep): **two** construction sites and **six** pass-through consumers — `ResultActions.tsx:16`, `ActionButton.tsx:45`, `HistoryRowMenu.tsx:49`, `usePdfAction.ts:40`, plus two test files. The six only forward and need no change; making the field **required** is what makes `tsc` name any site that forgot it.

## Implementation Content

- Add `hasIncompleteEssay: boolean` (**required**) to `AttemptPdfData` in `SOURCE/lib/pdf/generateAttemptPdf.ts:11-28`, and pass it through the function body to the template.
- Fill it at **both** construction sites, each from its own read path's **already-derived** field:
  - `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx:56` reads `ExamResult.hasIncompleteEssay`;
  - `SOURCE/app/(HM)/history/_components/HistoryRow.tsx:23` reads `MyHistoryEntry.hasIncompleteEssay`.
- **Neither site re-derives the RS-6 expression.**

### Why the field belongs on this type
`AttemptPdfData` is the confluence of both export routes (verified by repo-wide grep — two construction sites, six pass-through consumers). Putting the field here is what makes the two routes **structurally unable to disagree**. Making it **required** means `tsc` names any site that forgot it.

### Open Item I-3
The backend Design Doc's Interface Change Matrix gives `AttemptPdfData` exactly one new field, `hasIncompleteEssay: boolean`. The frontend Design Doc gives it **two**: that boolean **and** `essayIncompleteLabel?: string`. This plan lands the **boolean here (B2.3)** and the **optional label in Task F-B3** (frontend, alongside the template line and its English default, matching the pattern at `AttemptPdfTemplate.tsx:31-40`). **That split is a reading, not a stated decision.** *Owner: engineer, before Task F-B3.*

## Target Files
- [ ] `SOURCE/lib/pdf/generateAttemptPdf.ts`
- [ ] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx`
- [ ] `SOURCE/app/(HM)/history/_components/HistoryRow.tsx`

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Hai vị từ mức-mảng / D-13 — `AttemptPdfData` gains `hasIncompleteEssay: boolean`; both construction sites fill it from their own read path)
- `SOURCE/lib/pdf/generateAttemptPdf.ts` (`:11-28` `AttemptPdfData`; the function body that forwards to the template)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (`:56` — construction site 1)
- `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` (`:23` — construction site 2; `:23-31` the `pdfInput`)
- `SOURCE/app/(layer2)/_components/ResultActions.tsx` (`:16` — pass-through consumer, no change)
- `SOURCE/components/history/ActionButton.tsx` (`:45` — pass-through consumer, no change)
- `SOURCE/components/history/HistoryRowMenu.tsx` (`:49` — pass-through consumer, no change)
- `SOURCE/components/history/usePdfAction.ts` (`:40` — pass-through consumer, no change here; Task F-B2 adds its third parameter)
- `SOURCE/app/(layer2)/queries.ts` (Task B2.1 — `ExamResult.hasIncompleteEssay`)
- `SOURCE/app/(HM)/queries.ts` (Task B2.2 — `MyHistoryEntry.hasIncompleteEssay`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — EG-BE-036: the RS-6 expression lives **only** there)

## Reference Contracts

*(No Reference Contract Values row covers this task; the boolean's own contract is carried by B2.1/B2.2 and by the Failure Mode obligations below.)*

## Boundary Context

The two PDF export routes are the boundary this task closes. Both read a **published** field from their own read path; neither re-derives `state === "failed" && !retryAvailable`, which exists only in `SOURCE/lib/scoring/essayLifecycle.ts` (EG-BE-036).

## Investigation Notes
_(Record here: the repo-wide grep result confirming two construction sites and six pass-through consumers; confirmation that `tsc` named both sites when the field was first made required.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): re-run the repo-wide grep for `AttemptPdfData` and confirm the site list is still two constructions + six pass-throughs
- [ ] Add the **required** field first and observe `tsc` name both construction sites

### 2. Green Phase
- [ ] Fill the field at both construction sites from each read path's already-derived value
- [ ] Forward it through `generateAttemptPdf`'s body to the template
- [ ] Run `npx tsc --noEmit` and confirm zero missing sites

### 3. Refactor Phase
- [ ] Confirm **neither** construction site re-derives the RS-6 expression
- [ ] Confirm the six pass-through consumers were **not** modified

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: **the required field names any site that forgot it — this is the task's primary proof mechanism** — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | **this task's primary gate** — zero missing `hasIncompleteEssay` sites |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method**: make the field **required**, run `npx tsc --noEmit`, and confirm it names exactly the two construction sites; then fill both from their own read path and re-run.
- **Success criteria**: `tsc` green with zero missing `hasIncompleteEssay` sites; the six pass-through consumers unchanged; neither construction site contains the RS-6 expression.
- **Failure response**: if a site is tempted to re-derive RS-6 locally, stop — the published field exists precisely so the two routes cannot disagree; a local derivation reopens the F-06 defect (two different PDF files for one attempt).
- **Verification level**: **L3/L2** — `tsc` is the mechanism; behaviour is proven by INT-2 and by FE2E-3.

## Proof Obligations
- **Claim (EG-BE-035)**: the same attempt yields the **same** value at **both** construction sites.
  - **Primary failure mode** (Failure Mode Checklist: **shared-state dependency**): the two exits read different inputs, so one PDF carries the incomplete-essay line and the other does not, **for the same attempt**.
  - **Boundary to exercise**: the two construction sites, statically via `tsc` here and behaviourally via **INT-2(a)** (Task B2.4) and **FE2E-3** (Task F-C3).
  - **State assertion**: N/A at this level — both sites read an already-derived published field; the derivation's state semantics are B2.1/B2.2's.
  - **Mock boundary rationale**: none needed — the proof here is type-level.
  - **Residual**: proves the field reaches both sites. That both **agree in value** for one attempt is INT-2(a)'s, and that both **produce identical files** is F-B3's and FE2E-3's.
- **Claim**: the six pass-through consumers only forward and need no change.
  - **Primary failure mode**: a consumer quietly re-deriving or defaulting the field, creating a third source of truth. **Boundary**: repo-wide grep + diff review. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = type + both sites
- [ ] **Quality Complete** = `tsc` green — **which is the mechanism proving no site was missed**
- [ ] **Integration Complete** = proven by **INT-2** (Task B2.4) and by **FE2E-3** (Task F-C3)
- [ ] Both PDF construction sites read a **published** field; **no site re-derives** `state === "failed" && !retryAvailable` (EG-BE-036 source scan green)
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task F-B3 adds the template's `<p>` line and the optional `essayIncompleteLabel?` (I-3); FE2E-3 exercises both doors for one attempt.
- Scope boundary — preserve unchanged: the six pass-through consumers (`ResultActions.tsx:16`, `ActionButton.tsx:45`, `HistoryRowMenu.tsx:49`, `usePdfAction.ts:40`, and the two test files) — they forward only; `SOURCE/components/pdf/AttemptPdfTemplate.tsx` (Task F-B3 owns the new `<p>`).
- **Open Item I-3 is unresolved**: the `essayIncompleteLabel?` split between this task and F-B3 is a reading, not a stated decision. Resolve it before F-B3.
