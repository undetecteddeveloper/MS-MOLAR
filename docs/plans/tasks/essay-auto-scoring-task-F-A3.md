# Task F-A3 — `EssayScoreLine` + insertion into `result/page.tsx` (FRONTEND EARLY VERIFICATION POINT)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-A (Display Foundation, frontend slices V0 + V1), Task F-A3**
Layer: **frontend** (`SOURCE/app/(layer2)/_components/**`, one route page)

Metadata:
- Dependencies: **Task F-A2**, **Task B2.1**.
- Blocks: **Tasks F-B1, F-B2, F-C2**.
- Provides: the first slice that joins all three tiers — backend contract → `getResult()` → server component tree → pixels.
- Size: Small (3 files)
- Verification level: **L1** — the frontend Early Verification Point.

## Implementation Content

Create `SOURCE/app/(layer2)/_components/EssayScoreLine.tsx` as an **async Server Component** and insert it in `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` **between** `ScoreCard` (`:86`) and the overtime block (`:92`).

Visual shape borrows the overtime warning already on this page (`border-border bg-card rounded-lg border border-dashed px-4 py-3 text-sm`) — the in-place precedent for "a sentence qualifying the number above", **tokens only, no shadow, no gradient**. The component adds **no margin of its own**; vertical rhythm belongs to the page's `gap-5`.

### Returns `null` when no essay carries a lifecycle key (RS-0 / RS-1 / feature off)
That is what makes **AC-012 true byte-for-byte** for a legacy row: **no new node enters the tree**.

### Five matrix rows
| Row | Rendering |
|---|---|
| **not-rendered** | returns `null` |
| **default** (all resolved, ≥1 graded) | `Tự luận` · `{earned} / {max} điểm` · *"Tính trên {n} câu tự luận đã chấm xong."* |
| **loading** (≥1 pending) | `◌ Đang chấm` badge + the score **if** ≥1 is already graded, else `—`, plus *"Còn {k} câu đang chấm — điểm tự luận sẽ tự cập nhật."* |
| **partial** (no pending; ≥1 graded and ≥1 failed) | score + denominator line + *"{k} câu chấm thất bại — mở Chi tiết để chấm lại."* with "Chi tiết" linking to S-02 |
| **empty** (none graded) | `Tự luận` · **`—`** plus *"Chưa có câu tự luận nào chấm xong. Mở Chi tiết để chấm lại."* |

There is **no** separate error state — every grading error is already a lifecycle state, and a read error redirects before the list renders.

### `—`, never `0 / 0 điểm` in the empty state
`0 / 0` reads as *"you scored zero"* on precisely the writing the student just did — **reproducing the exact defect this whole feature exists to end** (an all-essay attempt showing `total_score = 0.00`). `—` says *nothing to add yet*, not *adds to nothing*.

### Typography
`font-serif text-2xl tabular-nums` for the score — **visibly smaller** than `ScoreCard`'s `text-6xl`, so the hierarchy says this is a supplementary number. `tabular-nums` is **functional, not aesthetic**: the denominator **grows while the student is looking at it** (W7), and non-tabular digits make the line jump on every `router.refresh()`. `.eyebrow` for the "Tự luận" label.

### `ScoreCard.tsx` is a 0-diff zone
No new prop, no changed render line. `result.totalScore.toFixed(1)` + `/10`, `Đúng` = `result.correct`, `Sai` = `result.total - result.correct` keep today's exact basis, so the `wrong = total − correct` derivation stays valid (AC-057). **Any diff in that file is a regression.**

### Render technique
**`renderServerTree(<EssayScoreLine … />)`** from `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx:25`. This component is async **and has an async child** (`EssayLifecycleBadge`), so `render(await …)` returns an **empty tree** and every negative assertion passes against nothing (AB-2, R-F2).

**`SOURCE/lib/test/renderServerTree.tsx` does not exist** — import from the existing path. This slice is the helper's **second** consumer; **Rule of Three is not met, so do not extract it.** The forced-revisit condition is a **third** consumer, at which point it moves to `SOURCE/lib/test/renderServerTree.tsx` (a name without a `.test.tsx` suffix, so `vitest.config.ts:20` does not collect it).

## Target Files
- [x] `SOURCE/app/(layer2)/_components/EssayScoreLine.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/__tests__/EssayScoreLine.test.tsx` (new) — 10 cases
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` — import + insertion only

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayScoreLine — verify not-rendered + default + loading + partial + empty states; **no separate error state**)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change) — all states "Như hôm nay")
- `docs/design/essay-auto-scoring-frontend-design.md` (§ S-01 — inserted between `ScoreCard` and the overtime block; test through `renderServerTree()`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Non-Scope — `ScoreCard.tsx` is a **0-diff zone**)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Theme Token Map — zero new tokens, zero hard-coded hex, `#4F7942` deliberately not used)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — `ScoreCard`/`/history` show a "đang chấm" marker instead of a number about to change, on a **separate labelled line**, with `ScoreCard` a 0-diff zone)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (`:86` `ScoreCard`; `:92` the overtime block; the page's `gap-5`)
- `SOURCE/app/(layer2)/_components/ScoreCard.tsx` (**0-diff zone** — read, never edit)
- `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx` (`:4-10` the empty-tree failure mode it documents; `:25` the helper to import)
- `SOURCE/components/essay/EssayLifecycleBadge.tsx` (Task F-A2 — the async child that forces `renderServerTree()`)
- `SOURCE/app/(layer2)/queries.ts` (Task B2.1 — `essaySummary`, `earned`, `max`, `gradedCount`, `pendingCount`, `failedCount`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| UI Spec (§ Component: EssayScoreLine — State × Display Matrix) | derived-display | Empty state: "`Tự luận` · **`—`** (không phải `0 / 0`) + *\"Chưa có câu tự luận nào chấm xong. Mở Chi tiết để chấm lại.\"*" | The empty state renders `—` and the exact sentence, and **never** `0 / 0 điểm` |
| UI Spec (§ Component: EssayScoreLine) | derived-display | Default state sub-line: *"Tính trên {n} câu tự luận đã chấm xong."* where `{n}` = `EssaySummary.gradedCount` — **không phải** tổng số câu tự luận của đề | The sub-line's `{n}` is bound to `gradedCount` |
| UI Spec (§ Component: ScoreCard — unchanged, explicit non-change) | state-lifecycle-negative | "`ScoreCard` render y hệt hôm nay… Bất kỳ diff nào trong file này là **hồi quy**"; `result.totalScore.toFixed(1)` + `/10`, `Đúng` = `result.correct`, `Sai` = `result.total - result.correct` | `git diff` on `ScoreCard.tsx` is empty, and its three rendered values are unchanged |
| backend DD (§ EG-BE-027) | derived-display | "**Trong khi** tính tổng điểm tự luận, chỉ câu ở `graded` **phải** đóng góp vào **cả hai** vế earned và max; `pending`, `failed` và câu không chấm được đóng góp **0 vào cả hai**." | The rendered `{earned} / {max}` reflects only `graded` elements |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert. Three surfaces must respect that: PDF export is blocked while any essay is unresolved; `ScoreCard`/`/history` show a "đang chấm" marker instead of a number about to change — on a **separate labelled line**, with `ScoreCard` a 0-diff zone; any future result-row cache must key on something that moves when a band lands | The essay score is rendered on a **separate labelled line** beside `ScoreCard`, and `ScoreCard.tsx` has **zero** diff |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayScoreLine — verify not-rendered + default + loading + partial + empty states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change) — verify all states render as today)

## Investigation Notes

### `essaySummary` lives on `ExamResult`, not on `ScoreResult` — `tsc` caught the wiring
The first insertion wired `result.essaySummary` and `tsc` exited **2**: `Property 'essaySummary' does not exist on type 'ScoreResult'`. The page destructures `const { examTitle, subject, result } = data`, and `result` is the **score** object; `essaySummary` hangs off the `getResult()` return (`ExamResult`, `queries.ts:521`). Corrected to `data.essaySummary`.

Worth recording because the two names are close enough to look right in review: `result` is what the student scored, `data` is everything the page read. The essay summary is not part of the score — it is deliberately **beside** it, which is the same distinction the separate labelled line exists to make.

### `renderServerTree()` was mandatory here, and the not-rendered case proves it
This component has an async child (`EssayLifecycleBadge`), so `render(await …)` would return an empty tree and every negative assertion would pass against nothing. The not-rendered case is the one that would have been silently vacuous, so it carries its positive control **inline**: it renders a populated summary through the *same* helper and asserts a node exists, then asserts `innerHTML === ""` for `undefined`. Without that pairing, "no node" and "the helper is broken" are indistinguishable.

### `ScoreCard.tsx` is a 0-diff zone — verified, not assumed
`git diff --stat` and `git status` on that file are both **empty**. Its three rendered values are untouched, so the `wrong = total − correct` derivation stays valid (AC-057).

### Insertion position verified by line order
`ScoreCard` at `:88`, `EssayScoreLine` at `:106`, the overtime block at `:111`. The component carries **no margin of its own** and is not wrapped in an extra `div` — vertical rhythm belongs to the page's `gap-5` (FE-AC-01).

### Branch order is a correctness decision, not a formatting one
`pending` wins over `failed`. While any question is still being scored, both `earned` and the denominator are **unsettled**, so saying "{k} questions could not be scored" is a conclusion drawn on a run that has not finished. Mutation **M5** (inverting that order) is killed.

### Mutation testing — the tests were green on the first run
The component was written before its tests, so no Red was observed for `EssayScoreLine` itself. Six mutants, **all six killed**:

| # | Mutation | Result |
|---|---|---|
| M1 | return an empty wrapper `<div>` instead of `null` (breaks FE-AC-14) | **Killed** |
| M2 | render `0 / 0` instead of `—` (breaks FE-AC-15) | **Killed** |
| M3 | denominator counts `gradedCount + failedCount` instead of `gradedCount` (breaks AC-059) | **Killed** |
| M4 | drop `tabular-nums` | **Killed** |
| M5 | `failed` branch placed before `pending` | **Killed** |
| M6 | remove the link to Details | **Killed** |

M3 is the one worth naming: it is the exact defect the Reference Contract calls out — a denominator that claims the score was computed over more essays than were actually scored.

### `—` versus `0 / 0`, held by two cases
`0 / 0` reads as *"you scored zero"* on precisely the writing the student just did — reproducing the defect this whole feature exists to end. Asserted in both the empty row and the loading-with-nothing-scored row, and pinned by M2.

### Still owed: the L1 dev check
Everything above is L2. The **Early Verification Point** — opening a seeded attempt on dev and comparing `ScoreCard` before/after to the pixel — has **not** been performed; it needs a seeded dev attempt with a graded essay, which depends on the L1 grading run that is still awaiting the engineer. The automated half of the `ScoreCard` claim (FE2E-1(f)) lands in Task F-C3.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and recorded key observations
- [~] Tests were written **after** the component, so no Red was observed for `EssayScoreLine`. **Mutation testing substitutes** — six mutants, all killed (table above). A real Red *was* observed on the page wiring: `tsc` exit 2 on `result.essaySummary`

### 2. Green Phase
- [x] `EssayScoreLine.tsx` created with all five matrix rows; `null` in the not-rendered case
- [x] Inserted between `ScoreCard` (`:88`) and the overtime block (`:111`), no margin of its own, no extra wrapper
- [x] `10 passed (10)`, exit **0**

### 3. Refactor Phase
- [x] `git diff` on `ScoreCard.tsx` is **empty**
- [x] No hard-coded hex, no new token, no shadow, no gradient — asserted by a comment-stripped source scan
- [ ] **EVP on dev NOT performed** — needs a seeded attempt carrying a graded essay, which depends on the L1 grading run still awaiting the engineer

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- Manual/Playwright MCP visual verification — Enforces: the UI Spec Golden States; IV-1 — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`. **Production has 0 submitted essays, so all visual checks run on dev with seeded data.**

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | Was **2** first: `Property 'essaySummary' does not exist on type 'ScoreResult'` — see Investigation Notes |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1971 passed / 10 skipped / 0 todo (was 1961 — **+10**), 46.6 s |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | Expected red, TD-030 baseline only. Snapshot CRLF churn reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods — FRONTEND EARLY VERIFICATION POINT
- **Verification method**: on dev, open `/result` for a **seeded** attempt with ≥1 `graded` essay. `EssayScoreLine` must render with correct `earned`/`max`, `tabular-nums` applied, positioned **exactly** between `ScoreCard` and the overtime block; `ScoreCard` unchanged **to the pixel** (before/after screenshots); `EssayScoreLine.test.tsx` green **through `renderServerTree()`** — which simultaneously confirms AB-2 on this feature's own component tree.
- **Success criteria**: all four of the above hold.
- **Failure response**:
  - `essaySummary` **undefined despite banded data** ⇒ **blocked**, return to backend (B-3 / Task B2.1); the frontend does **not** patch around it.
  - **Empty tree with vacuously passing negative assertions** ⇒ switch to `renderServerTree()` **and** add a positive assertion to every case.
  - **Block inserted in the wrong place or broken rhythm** ⇒ remove the component's own margin; vertical rhythm belongs to the page's `gap-5`.
- **Verification level**: **L1** — this is the first slice that joins all three tiers, so it is the first slice that can fail for an unexpected reason. (Not V0: V0 proves strings exist and a badge renders, but touches no real data.)

## Proof Obligations
- **Claim (FE-AC-01)**: rendered **between** `ScoreCard` and the overtime block.
  - **Primary failure mode**: inserted inside `ScoreCard`'s subtree or after the overtime block, breaking the reading order and the page's rhythm. **Boundary**: `renderServerTree()` over the real page tree. **State assertion**: N/A. **Mock rationale**: the data source is stubbed; the route tree is real. **Residual**: pixel placement is confirmed by the dev screenshot pair.
- **Claim (FE-AC-02)**: `{earned} / {max} điểm` plus a denominator sentence **naming what it counts** — `gradedCount`.
  - **Primary failure mode**: the denominator naming the exam's total essay count, so the sentence claims more than was graded. **Boundary**: RTL with the real dictionary. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (FE-AC-14)**: no essay keys ⇒ **no new node at all**.
  - **Primary failure mode**: an empty wrapper `<div>` entering the tree for a legacy row, breaking AC-012's byte-for-byte promise. **Boundary**: `renderServerTree()`; assert the component returns `null` **and** carry a positive assertion elsewhere in the case so it is not vacuous. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the whole-page version of this claim is FE2E-1 (Task F-C3).
- **Claim (FE-AC-15 / Failure Mode Checklist: empty input)**: all failed/exhausted with none graded ⇒ **`—`**, never `0 / 0 điểm`.
  - **Primary failure mode**: `0 / 0` reading as "you scored zero" on precisely the writing the student just did — **reproducing the exact defect this feature exists to end**. **Boundary**: RTL with the real dictionary. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (the `ScoreCard` 0-diff assertion)**: `ScoreCard` renders exactly as today.
  - **Primary failure mode**: a prop or a render line added "while we are here", so the number the student trusts moves. **Boundary**: `git diff` on the file **plus** FE2E-1(f)'s automated text comparison (Task F-C3) **plus** the dev screenshot pair. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the automated half is FE2E-1(f); the pixel half is the manual screenshot comparison.
- **Claim (`tabular-nums`)**: present on every numeric element.
  - **Primary failure mode**: the line **jumping on every `router.refresh()`** as the denominator grows while the student watches (W7) — a functional defect, not an aesthetic one. **Boundary**: RTL class assertion. **State assertion**: N/A. **Mock rationale**: none. **Residual**: FE-OQ-5 asks the engineer to confirm the implicit `tabular-nums` standard; rejecting it needs a counter-reason.

## Completion Criteria
- [x] **Implementation Complete** = component + insertion
- [x] **Quality Complete** = six gates run separately; five at 0, `test:fixture` at the TD-030 baseline; tests pass via `renderServerTree()`
- [ ] **Integration Complete** = **NOT MET.** The L1 dev check and the `ScoreCard` pixel comparison both need a seeded graded attempt on dev — blocked on the same engineer-owned grading run
- [x] Every case carries at least one positive assertion
- [x] Reference Contracts and the Binding Decision all evaluate to `Y`: empty state renders `—` and never `0 / 0`; the denominator binds to `gradedCount`; `ScoreCard.tsx` has zero diff; the essay score sits on a separate labelled line
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-B1 (the detail surface), F-B2 (the PDF guard), F-C2 (the poller mounts on this page).
- Scope boundary — preserve unchanged: **`SOURCE/app/(layer2)/_components/ScoreCard.tsx` — 0-diff zone; any diff is a regression.** Also `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx` (**imported, not moved** — this is its second consumer; Rule of Three is not met).
- `SOURCE/lib/test/renderServerTree.tsx` **does not exist**. Do not import from that path.
