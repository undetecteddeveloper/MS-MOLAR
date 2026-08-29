# Task F-B3 — `HistoryRowMenu` + `HistoryRow` badge + the PDF annotation line + 2 coupled test sites (one commit)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-B (Detail Surface and the PDF Guard, frontend slices V2 + V3), Task F-B3**
Layer: **frontend** (`SOURCE/components/history/**`, `SOURCE/app/(HM)/**`, `SOURCE/components/pdf/**`, `SOURCE/lib/pdf/**`)

Metadata:
- Dependencies: **Task F-B2**, **Task B2.3**.
- Blocks: **Task F-C3**.
- Provides: the `/history` door's guard, the `◌ Đang chấm` meta-line badge, and the PDF's incomplete-essay line.
- Size: Medium (5 files, **one** commit)
- Verification level: **L1** — both doors block for the same attempt with the same sentence, and a real exported PDF carries the annotation.

## Change Category
`Change Category: boundary-change`

`HistoryRowMenu`'s required `blockedReason`, `MenuAction`'s two new fields and `AttemptPdfTemplate`'s two new props are published component contracts. Adjacent cases swept: **both** `usePdfAction` calls inside `HistoryRowMenu` (`:116-117`) — wiring one and not the other is the single most likely mistake in this slice, **and each door looks correct when tested alone** — plus the **2** coupled test render sites at `HistoryRowMenu.test.tsx:65` and `:91` (Gate H7; 13 more moved in F-B2).

## Implementation Content

### `SOURCE/components/history/HistoryRowMenu.tsx`
Required `blockedReason` prop threaded into **both** `usePdfAction` calls (`:116-117`). `MenuAction` gains `blockedReason` and `blockedText`. **"Xem chi tiết" is NOT blocked** — blocking it would lock the student away from the retry control that clears the block. A blocked press does **not** auto-close the menu (the menu closes only on a **successful** export).

### `SOURCE/app/(HM)/history/_components/HistoryRow.tsx`
`EssayLifecycleBadge state="pending"` appended to the **end** of the meta line (`:37-40`) when `entry.hasUnresolvedEssay === true`. **At the end, not beside the score**: `{score}/10 · {date} · {duration}` is one reading unit and inserting a badge mid-string breaks it; at the end it reads as an annotation on the whole line, which is what it is. The `{totalScore}/10` number **does not move** (AC-057 + D5) — the badge is what says the number is not final. Pass `blockedReason` and `hasIncompleteEssay` down (`:44-48`), and `hasIncompleteEssay` into `pdfInput` (`:23-31`).

### `SOURCE/components/pdf/AttemptPdfTemplate.tsx`
Add `hasIncompleteEssay: boolean` and `essayIncompleteLabel?: string` props, and **one new `<p>` after `totalQuestionsLabel` (`:125`)** printing `result.essay.pdfIncomplete`, styled with the **hex literal `#605a52`** — the same value `EYEBROW` (`:44-49`) already uses. **This is the single named exception to the no-hard-coded-hex rule and it is an ADR-0009 hard constraint, not a violation**: html2canvas throws or renders wrongly if any style in that tree resolves through `oklch()`/`color-mix()`. **No Tailwind classes, no `components/ui`, no new colour.**

### `SOURCE/lib/pdf/generateAttemptPdf.ts`
Forward both new fields to the template.

### `SOURCE/components/history/HistoryRowMenu.test.tsx`
Add `blockedReason={null}` at `:65` and `:91` in the **same commit** (Gate H7).

### Note on `HistoryRowMenu.test.tsx`
It is **time-sensitive** (uses `waitFor`, not fake timers) and has flaked **once** under parallel load. A single red run in this file does **not** by itself prove a defect — **re-run it single-threaded before concluding** (R-F6). **Do not** convert it to fake timers inside this change: changing a green file's time model inside an unrelated change adds a variable exactly where the fewest are wanted (F-11).

### Open Item I-3
`essayIncompleteLabel?: string` lands **here** (frontend, alongside the template line and its English default, matching the pattern at `AttemptPdfTemplate.tsx:31-40`) while the boolean landed in Task B2.3. **That split is a reading, not a stated decision.** *Owner: engineer, before this task.*

## Target Files
- [ ] `SOURCE/components/history/HistoryRowMenu.tsx`
- [ ] `SOURCE/app/(HM)/history/_components/HistoryRow.tsx`
- [ ] `SOURCE/components/pdf/AttemptPdfTemplate.tsx`
- [ ] `SOURCE/lib/pdf/generateAttemptPdf.ts`
- [ ] `SOURCE/components/history/HistoryRowMenu.test.tsx` (`:65`, `:91`)

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRowMenu (PDF blocked state) — verify default + blocked states; both PDF items blocked, "Xem chi tiết" **not** blocked, menu does not auto-close on a blocked click)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRow (đang chấm marker) — verify default + partial states)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Đường ống PDF — the guard in one hook, two doors)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ AttemptPdfTemplate — one new `<p>` after `totalQuestionsLabel` (`:125`), hex literal `#605a52`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ S-03 — the badge at the end of the meta line; the `{totalScore}/10` number does not move)
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance — `AttemptPdfTemplate` uses **hex/rgb literals only**; no Tailwind classes, no `components/ui`, nothing resolving through `oklch()`/`color-mix()`; the generator loads dynamically inside the handler)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010)
- `SOURCE/components/history/HistoryRowMenu.tsx` (`:49` the `pdfInput`; `:116-117` — **both** `usePdfAction` calls)
- `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` (`:23-31` the `pdfInput`; `:37-40` the meta line; `:44-48` the props passed down)
- `SOURCE/components/pdf/AttemptPdfTemplate.tsx` (`:31-40` the optional-label pattern; `:44-49` `EYEBROW`'s `#605a52`; `:125` `totalQuestionsLabel`)
- `SOURCE/components/history/HistoryRowMenu.test.tsx` (`:65`, `:91` — the 2 coupled render sites; **time-sensitive, uses `waitFor`**)
- `SOURCE/components/essay/EssayLifecycleBadge.tsx` (Task F-A2)
- `SOURCE/app/(HM)/queries.ts` (Task B2.2 — `hasUnresolvedEssay`, `hasIncompleteEssay`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| frontend DD (§ FE-AC-19) | derived-display | "KHI tệp PDF được xuất cho một lượt thi có ≥1 câu ở RS-6, tệp **PHẢI** chứa chuỗi `result.essay.pdfIncomplete`; KHI không có câu nào ở RS-6, tệp **PHẢI KHÔNG** chứa chuỗi đó." | The exported file contains the string when ≥1 question is at RS-6 and does not when none is — confirmed by **opening the file** |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | contract_schema | `AttemptPdfTemplate` uses **hex/rgb literals only** — no Tailwind classes, no `components/ui`, nothing resolving through `oklch()`/`color-mix()`; the generator loads dynamically inside the handler | The new `<p>` is styled with the hex literal `#605a52` and carries no Tailwind class, no `components/ui` import and no token reference |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert. Three surfaces must respect that: PDF export is blocked while any essay is unresolved; `ScoreCard`/`/history` show a "đang chấm" marker instead of a number about to change — on a separate labelled line, with `ScoreCard` a 0-diff zone; any future result-row cache must key on something that moves when a band lands | `/history` shows the `◌ Đang chấm` badge when `hasUnresolvedEssay === true`, and both menu PDF items are blocked |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRowMenu (PDF blocked state) — verify default + blocked states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRow (đang chấm marker) — verify default + partial states)

## Investigation Notes
_(Record here: confirmation that **both** `usePdfAction` calls at `:116-117` received the prop; the opened-PDF evidence for FE-AC-19 in both directions; whether `HistoryRowMenu.test.tsx` needed a single-threaded re-run.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): **both** `usePdfAction` calls at `:116-117` (each door looks correct when tested alone), and the 2 coupled render sites at `:65`/`:91`
- [ ] Write the blocked-menu cases, the badge case and the exact-once unblocked case; observe failure

### 2. Green Phase
- [ ] `HistoryRowMenu.tsx`: required `blockedReason` into **both** `usePdfAction` calls; `MenuAction` gains `blockedReason` and `blockedText`; "Xem chi tiết" stays unblocked; a blocked press does not auto-close the menu
- [ ] `HistoryRow.tsx`: badge at the **end** of the meta line when `hasUnresolvedEssay === true`; pass `blockedReason` and `hasIncompleteEssay` down and into `pdfInput`
- [ ] `AttemptPdfTemplate.tsx`: two new props and one new `<p>` after `:125`, styled `#605a52`
- [ ] `generateAttemptPdf.ts`: forward both fields
- [ ] `HistoryRowMenu.test.tsx`: `blockedReason={null}` at `:65` and `:91` **in this commit**
- [ ] Run only the affected tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm the `{totalScore}/10` number **did not move**
- [ ] Confirm the new `<p>` carries **no** Tailwind class and no token
- [ ] Open a **real** exported PDF from both doors for the same attempt and compare

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the 2 coupled render sites — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers all client components (`HistoryRowMenu.tsx` is `"use client"`)
- Manual visual verification — Enforces: IV-6, the two exported files — **html2canvas does not run in jsdom**, so the file must be **opened**

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | if `HistoryRowMenu.test.tsx` is red, **re-run it single-threaded before concluding** (R-F6) |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |
| 7 | `npm run check:bundle` | | Gate E2 — this task edits a client component (`HistoryRowMenu.tsx`) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL for the menu's blocked state and the row's badge; then **L1** — export a real PDF from **both** doors for the **same** attempt and **open the files**.
- **Success criteria**: both doors block with the **same sentence**; a real exported PDF carries the annotation when ≥1 question is at RS-6 and does **not** when none is; "Xem chi tiết" is never blocked; the menu does not auto-close on a blocked click; the `{totalScore}/10` number did not move.
- **Failure response**: if only one door blocks, one of the two `usePdfAction` calls at `:116-117` was missed — **each door looks correct when tested alone**, which is why both are asserted. If `HistoryRowMenu.test.tsx` is red, re-run it **single-threaded** before concluding a defect (R-F6), and **do not** convert it to fake timers inside this change (F-11).
- **Verification level**: **L1**.

## Proof Obligations
- **Claim (FE-AC-19)**: the exported file contains `result.essay.pdfIncomplete` when ≥1 question is at RS-6, and does **not** when none is.
  - **Primary failure mode**: the annotation decided from a re-derived predicate rather than the published field, so the two doors disagree. **Boundary**: a **real exported PDF, opened** — html2canvas does not run in jsdom. **State assertion**: N/A. **Mock rationale**: none for the file check; the RTL half mocks `generateAttemptPdfFile`. **Residual**: jsdom cannot render the PDF, so the file check is manual by necessity.
- **Claim (FE-AC-05)**: once everything is resolved, both `/result` buttons and both menu items carry `aria-disabled="false"` and one click calls `generateAttemptPdfFile` **exactly once** — **not "at least once"**; the exact count is what the dogpile latch is for.
  - **Primary failure mode**: a double-fire from a state-based latch reading the previous render's value. **Boundary**: RTL with a counted mock. **State assertion**: N/A. **Mock rationale**: the generator is the external boundary. **Residual**: the transition version is FE2E-2(e) (Task F-C4).
- **Claim (FE-NFR-02)**: `HistoryRow` keeps exactly **one** in-flow node in the right column; the badge goes in the **left** column's meta line and may wrap.
  - **Primary failure mode**: the badge inserted beside the score, breaking `{score}/10 · {date} · {duration}` as one reading unit and shifting the number the student looks for. **Boundary**: RTL structure assertion plus a visual check. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (Failure Mode Checklist: shared-state dependency)**: both PDF exits read **one field on one shared type**, so they cannot disagree.
  - **Primary failure mode**: `blockedReason` threaded into `ActionButton` on `/result` but **not into both** `usePdfAction` calls inside `HistoryRowMenu`, so `/history` silently exports a PDF for an attempt whose score has not settled. **Boundary**: RTL on both doors here; the same-attempt version is FE2E-3 (Task F-C3). **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the cross-path value agreement is INT-2(a)'s.
- **Claim ("Xem chi tiết" is not blocked)**: it stays operable.
  - **Primary failure mode**: blocking it along with the rest, **locking the student away from the retry control that clears the block**. **Boundary**: RTL. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (AC-057 + D5)**: the `{totalScore}/10` number **does not move**; the badge is what says the number is not final.
  - **Primary failure mode**: replacing or hiding the number, which changes the meaning of a value the student already trusts. **Boundary**: RTL text comparison against the pre-change rendering. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = five files in **one** commit
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = **L1** — both doors block for the same attempt with the same sentence, and a **real exported PDF carries the annotation (verified by opening the file** — html2canvas does not run in jsdom)
- [ ] Both `usePdfAction` calls at `:116-117` received the prop
- [ ] The 2 coupled render sites at `:65` and `:91` moved in this commit (Gate H7 — 15 total with F-B2's 13)
- [ ] Every Reference Contract and Binding Decision Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-C3's FE2E-3 automates the two-door claim; the Final Phase's IV-6 opens both files.
- Scope boundary — preserve unchanged: `SOURCE/components/history/HistoryRowMenu.test.tsx`'s **time model** (it uses `waitFor`, not fake timers — **do not** convert it here, F-11); the `{totalScore}/10` rendering; every other style in `AttemptPdfTemplate.tsx`; `SOURCE/components/history/usePdfAction.ts` and `ActionButton.tsx` (Task F-B2).
- `#605a52` is the **single named exception** to the no-hard-coded-hex rule, and it is an **ADR-0009 hard constraint**, not a violation.
