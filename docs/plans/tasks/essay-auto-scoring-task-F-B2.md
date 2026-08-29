# Task F-B2 — `usePdfAction` guard + `ActionButton` + `ResultActions` + 13 coupled test sites (one commit)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-B (Detail Surface and the PDF Guard, frontend slices V2 + V3), Task F-B2**
Layer: **frontend** (`SOURCE/components/history/**`, `SOURCE/app/(layer2)/_components/**`)

Metadata:
- Dependencies: **Task F-A3**.
- Blocks: **Tasks F-B3, F-C4**.
- Provides: the PDF export guard in **one hook serving two doors**, plus the `/result` door's blocked state.
- Size: Medium (4 files, **one** commit)
- Verification level: **L1** for the `/result` door; **L2** for the 13 coupled test render sites.

## Change Category
`Change Category: boundary-change`

`usePdfAction`'s third parameter is **required**, and `ActionButton`'s new prop is required — a published component contract with **13 coupled test render sites**. Adjacent cases swept: all 13 `<ActionButton …>` render sites in `ActionButton.test.tsx` (moved here), and the **2** sites in `HistoryRowMenu.test.tsx` (moved in Task F-B3) — 15 in total per Gate H7.

## Implementation Content

- Add a **required** third parameter `blockedReason` to `usePdfAction(action, pdfInput, blockedReason)` (`SOURCE/components/history/usePdfAction.ts:40`) and an **early return at the top of `run()`** (`:46`) — **before** the `busyRef` latch, so a blocked press produces **no busy phase and no error node**.
- Thread the prop through `ActionButton` (**required**) so `aria-disabled` (`:62`), the `sr-only` reason element (`:95-97`) and `TooltipContent` (`:99`) all take the blocked branch.
- Thread it through `ResultActions` (`:19-20`) to **both** buttons.
- Update the **13** `<ActionButton …>` render sites in `SOURCE/components/history/ActionButton.test.tsx` with `blockedReason={null}` in the **same commit** (Gate H7).

### Never a native `disabled` attribute, in any state (UI-D5)
The repo has fixed this exact bug **twice** (`ExplainStepAffordance.tsx:11-14` names `RateButton` then `ActionButton`), and **three currently shipping files forbid it in writing**. `disabled` removes the element from the tab order **and** puts the *reason* out of a screen-reader user's reach — the two things AC-058 and AC-064 actually want.

**The idiom is**: focusable + `aria-disabled="true"` (string) + `aria-busy` (boolean) + `aria-describedby` → an `sr-only` reason element + a **synchronous `ref` latch** in the handler (`aria-disabled` does **not** block DOM click events; a state-based latch reads the *previous* render's value, so a second click in the same tick gets through — `useTutorAction.ts:26-31`).

### The guard lives in one hook serving two doors (UI-D4)
This **widens AC-058's stated scope**, which names only `ResultActions.tsx`, to `/history` as well — **deliberately**, because `/history` is where a student returns days later and therefore where a PDF is **most** likely to be exported.

## Target Files
- [ ] `SOURCE/components/history/usePdfAction.ts`
- [ ] `SOURCE/components/history/ActionButton.tsx`
- [ ] `SOURCE/app/(layer2)/_components/ResultActions.tsx`
- [ ] `SOURCE/components/history/ActionButton.test.tsx` (13 render sites)

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: usePdfAction (PDF export guard) — verify idle-open + blocked + busy + error states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ActionButton (PDF blocked state) — verify default + blocked + busy + error states)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Đường ống PDF — one hook, two doors; the third required parameter; the early return before the busy latch; 15 coupled test render sites)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — PDF export is blocked while any essay is unresolved)
- `SOURCE/components/history/usePdfAction.ts` (`:40` the signature; `:46` `run()` — the early return goes at the top, before the `busyRef` latch)
- `SOURCE/components/history/ActionButton.tsx` (`:45` the `pdfInput` prop; `:62` `aria-disabled`; `:95-97` the `sr-only` reason element; `:99` `TooltipContent`)
- `SOURCE/app/(layer2)/_components/ResultActions.tsx` (`:16` the `pdfInput`; `:19-20` both buttons)
- `SOURCE/components/history/ActionButton.test.tsx` (the **13** `<ActionButton …>` render sites)
- `SOURCE/app/(layer2)/_components/ExplainStepAffordance.tsx` (`:11-14` — the two prior fixes of this exact bug, naming `RateButton` then `ActionButton`)
- `SOURCE/lib/tutor/useTutorAction.ts` (`:26-31` — why the latch must be a synchronous `ref`, not state)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| frontend DD (§ FE-AC-21) | state-lifecycle-negative | "Ở **mọi** trạng thái của tính năng, **PHẢI KHÔNG** có phần tử nào trong cây tự luận mang thuộc tính `disabled`, và **PHẢI KHÔNG** có chuỗi hiển thị nào chứa một con số lượt chấm còn lại." | `hasAttribute("disabled") === false` for **every** element in the subtree, in every state, and no rendered string contains a remaining-attempts number |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert. Three surfaces must respect that: PDF export is blocked while any essay is unresolved; `ScoreCard`/`/history` show a "đang chấm" marker instead of a number about to change — on a separate labelled line, with `ScoreCard` a 0-diff zone; any future result-row cache must key on something that moves when a band lands | With ≥1 unresolved essay, both `/result` PDF controls are blocked and produce zero `generateAttemptPdfFile` calls |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: usePdfAction (PDF export guard) — verify idle-open + blocked + busy + error states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ActionButton (PDF blocked state) — verify default + blocked + busy + error states)

## Investigation Notes
_(Record here: the 13 render sites' locations and that all moved in this commit; confirmation that the early return precedes the `busyRef` latch; the `hasAttribute("disabled")` sweep result.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): enumerate the 13 `ActionButton.test.tsx` render sites here and note the 2 `HistoryRowMenu.test.tsx` sites owned by Task F-B3 (15 total, Gate H7)
- [ ] Make the third parameter required **first** and observe the 13 sites go red
- [ ] Write the blocked-state cases (zero calls, no busy phase, no error node, focusable, reason exposed) and observe failure

### 2. Green Phase
- [ ] Add the required `blockedReason` parameter and the early return at the top of `run()` — **before** the `busyRef` latch
- [ ] Thread the prop through `ActionButton` (`aria-disabled`, `sr-only` reason, `TooltipContent`) and `ResultActions` (both buttons)
- [ ] Update all **13** render sites with `blockedReason={null}` **in this commit**
- [ ] Run only the affected tests and confirm they pass

### 3. Refactor Phase
- [ ] Sweep the subtree: `hasAttribute("disabled") === false` for **every** element, in every state
- [ ] Confirm the latch is a synchronous `ref`, not state
- [ ] Confirm no rendered string contains a remaining-attempts number

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the required parameter names every site that forgot it — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the 13 coupled render sites — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Enforces: `react-hooks/refs` and `react-hooks/set-state-in-effect` — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers all **client components** (`usePdfAction.ts` and `ActionButton.tsx` are `"use client"`)

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
| 7 | `npm run check:bundle` | | Gate E2 — this task edits client components (`usePdfAction.ts`, `ActionButton.tsx`) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL — with ≥1 unresolved question, press **Save** and **Share** and assert **zero** `generateAttemptPdfFile` calls, `phase` still `"idle"`, and **no** error node; then assert both controls stay focusable with their reason reachable through `aria-describedby`. Then **L1** on dev for the `/result` door.
- **Success criteria**: zero calls, no busy phase, no error node on a blocked press; both controls focusable and their accessible names accompanied by `result.essay.pdfBlocked`; `hasAttribute("disabled") === false` for every element in the subtree; all 13 coupled sites green.
- **Failure response**: if a blocked press produces a busy phase or an error node, the early return is **after** the latch — move it to the top of `run()`. **A blocked press is a published rule applying, not something breaking**; an error node tells the student something broke when nothing did.
- **Verification level**: **L1** for the `/result` door; **L2** for the coupled sites.

## Proof Obligations
- **Claim (FE-AC-10)**: with ≥1 unresolved question, pressing Save or Share produces **zero** `generateAttemptPdfFile` calls, `phase` stays `"idle"`, and **no** error node appears.
  - **Primary failure mode**: an error node on a blocked press — telling the student something broke when a published rule simply applied. **Boundary**: RTL over the real hook and components, with `generateAttemptPdfFile` mocked and **counted**. **State assertion**: `phase` before → press → still `"idle"`. **Mock rationale**: the PDF generator is the external boundary (html2canvas does not run in jsdom); the hook's latch and guard run real code. **Residual**: the two-door version is FE2E-3 (Task F-C3).
- **Claim (FE-AC-11)**: both controls stay **focusable** and their accessible names are accompanied by `result.essay.pdfBlocked` through `aria-describedby`.
  - **Primary failure mode**: a native `disabled`, which removes the element from the tab order **and** puts the reason out of a screen-reader user's reach — the two things AC-058 and AC-064 actually want. The repo has fixed this exact bug **twice**. **Boundary**: RTL by role, `.focus()` then `document.activeElement`, and `aria-describedby` resolution. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the real-browser focus behaviour after a refresh is FE-OQ-4 (Final Phase).
- **Claim (FE-AC-21)**: **no** element in the essay tree carries `disabled` — assert `hasAttribute("disabled") === false` for **every** element in the subtree.
  - **Primary failure mode**: one state (busy, error) quietly using the native attribute while the others use `aria-disabled`. **Boundary**: RTL subtree sweep in every state. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (Gate H7)**: the required third parameter lands with its coupled test render sites — **13 here**, 2 in Task F-B3 (15 total).
  - **Primary failure mode**: the parameter made required without moving the sites, turning the suite red for a reason unrelated to behaviour. **Boundary**: `tsc` + the suite. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the 2 `HistoryRowMenu.test.tsx` sites are F-B3's.
- **Claim (the synchronous latch)**: a second click in the same tick does not get through.
  - **Primary failure mode**: a state-based latch reading the **previous** render's value (`useTutorAction.ts:26-31`), so a double click fires twice — and `aria-disabled` does **not** block DOM click events. **Boundary**: RTL, two clicks in one tick, counted calls. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the exact-once claim on the unblocked path is FE-AC-05 (Task F-B3).

## Completion Criteria
- [ ] **Implementation Complete** = hook + two components + **13** test sites in **one** commit
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = the `/result` door blocks correctly and stays keyboard-reachable
- [ ] Every Reference Contract and Binding Decision Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-B3 threads the same prop into `HistoryRowMenu`'s **two** `usePdfAction` calls and moves its 2 coupled sites; F-C3's FE2E-3 proves both doors give the same answer; F-C4 asserts the unblock-in-place transition.
- Scope boundary — preserve unchanged: `SOURCE/components/history/HistoryRowMenu.tsx` and `HistoryRowMenu.test.tsx` (**Task F-B3**); `SOURCE/lib/pdf/generateAttemptPdf.ts` (Task B2.3).
- **Never a native `disabled`.** Focusable + `aria-disabled="true"` + `aria-busy` + `aria-describedby` + a synchronous `ref` latch.
