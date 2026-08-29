# Task F-B1 — `EssayReviewBlock` + the essay sub-branch inside `notScored`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-B (Detail Surface and the PDF Guard, frontend slices V2 + V3), Task F-B1**
Layer: **frontend** (`SOURCE/app/(layer2)/_components/**`, one route page)

Metadata:
- Dependencies: **Task F-A3**.
- Blocks: **Task F-C1** (`EssayRegradeControl` renders inside this block).
- Provides: the seven render states on `/result/detail`.
- Size: Small (3 files)
- Verification level: **L1**.

## Implementation Content

Create `SOURCE/app/(layer2)/_components/EssayReviewBlock.tsx` as an **async Server Component**, called from **inside** the existing `notScored` branch of `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` at `:75`.

Under W1 an essay **always** lands in that branch, in all three lifecycle states — so essay presentation is a **sub-branch inside** the not-scored branch, dispatching on `essayState` (UI-D1), **never a new branch beside it and never a modification of the scored branch**.

### The Hard Rule
Every branch dispatches on `EssayView.state`, **never** on `scored` or `isCorrect`. Both of those are `false` for an essay in **all seven** render states, so neither distinguishes anything — while both sit right there in the same object the render code is holding. Enforcement is **structural**: `EssayReviewBlock`'s props do **not carry those two fields**, so reading them is a **compile error** (MSA-F6). **It is not a discipline rule.**

### Seven states
| State | Rendering |
|---|---|
| RS-0 / RS-1 | shared not-scored branch, **unchanged** — "Bạn trả lời:" / "Đáp án đã lưu:" / `result.notAutoScored` |
| RS-2 | `◌ Đang chấm` with the student's answer shown and the **model answer withheld** |
| RS-3 | `✓ Đã chấm` with `{band} / 1 điểm`, the student's answer and the model answer, and — when `essayLowConfidence` — the words "Cần xem lại" with **no number changed** |
| RS-4 | `✕ Chấm thất bại` + `result.essay.failedBody` + `result.essay.attemptsNote` + a retry control |
| RS-5 | identical to RS-4 **word for word** (UI-D6) |
| RS-6 | same badge plus *"Câu này đã dùng hết lượt chấm. Hệ thống sẽ không tự chấm lại."* with the retry control **present and `aria-disabled`** |

### RS-2 withholds the model answer deliberately
Presented **before** a band exists, it invites the student to self-grade and then be contradicted by the number that lands. This is a decision about the **reading experience, not about security** — `getResult()` is already permitted to return the model answer after submission (`queries.ts:633-657`), and **AC-043 constrains the in-progress path, not the review screen**.

### Student prose renders as a text node
`whitespace-pre-wrap break-words` — **not** through `RichText` (ADR-0002 read in reverse: opening a markdown/KaTeX path for student-authored text is a new surface nobody is missing today; the current not-scored branch at `:120` already renders plain text).

### Three things never to mount
- **Never** mount `ExplainStepAffordance` for an essay in any state (AC-016) — the current branch does not, and `EssayReviewBlock` does **not receive `hasBeenWrongTwice`**, so mounting it is a compile error.
- **Never** pull `TutorQuotaNote` across from the scored branch.
- **Never** render the correct/incorrect chip.

### Render technique
`renderServerTree()` (async child).

## Target Files
- [ ] `SOURCE/app/(layer2)/_components/EssayReviewBlock.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/__tests__/EssayReviewBlock.test.tsx` (new)
- [ ] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx`

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayReviewBlock — verify RS-0/RS-1 + RS-2 + RS-3 (+ low-confidence variant) + RS-4 + RS-5 + RS-6 states)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ S-02 — a sub-branch **inside** the existing `notScored` branch at `:75`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Non-Scope — the scored branch of `result/detail/page.tsx` is untouched; `ExplainStepAffordance` never mounts for essays; `TutorQuotaNote`; `RichText`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Theme Token Map; § Security Considerations — student prose renders as a text node, not through `RichText`)
- `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md` (§ Decision, **read in reverse** — student prose is not routed through `RichText`; it renders as a text node with `whitespace-pre-wrap`, opening no new markdown/KaTeX surface)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:75` the `notScored` branch; `:120` the existing plain-text rendering; `:133` onward the **scored branch — untouched**)
- `SOURCE/app/(layer2)/queries.ts` (`:633-657` — the model answer is already returned after submission)
- `SOURCE/components/essay/EssayLifecycleBadge.tsx` (Task F-A2 — the async child)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `EssayView`, `retryAvailable`, RS-0…RS-6)
- `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx` (`:25` — the helper; **`SOURCE/lib/test/renderServerTree.tsx` does not exist**)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| UI Spec (§ Component: EssayReviewBlock — RS table) | column/label set and order | RS-2 `◌ Đang chấm`; RS-3 `✓ Đã chấm`; RS-4 `✕ Chấm thất bại`; RS-5 `✕ Chấm thất bại` — "Giống RS-4 **từng chữ một** (UI-D6)"; RS-6 `✕ Chấm thất bại` + *"Câu này đã dùng hết lượt chấm. Hệ thống sẽ không tự chấm lại."*, retry control "Có mặt, `aria-disabled`" | Each RS row renders exactly those strings, and RS-4 and RS-5 are asserted **word-for-word identical** |
| UI Spec (§ Component: EssayReviewBlock) | state-lifecycle-negative | "**Vì sao RS-2 không hiện đáp án mẫu.**" — the model answer is withheld at RS-2 and shown at RS-3/RS-4/RS-5/RS-6 | RS-2's rendered tree does **not** contain the model answer; RS-3…RS-6 do |
| backend DD (§ EG-BE-026) | state-lifecycle-negative | "Giá trị `retryAvailable` mà client nhận **phải** là một boolean, và payload gửi xuống client **phải không** chứa `essayAttempts` dưới bất kỳ tên nào." | The component reads the boolean `retryAvailable` and no attempt count under any name |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md` (§ Decision (read in reverse)) | data_flow | Student prose is **not** routed through `RichText`; it renders as a text node with `whitespace-pre-wrap`, opening no new markdown/KaTeX surface | Student prose renders as a text node with `whitespace-pre-wrap break-words`, and `RichText` is not imported |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayReviewBlock — verify RS-0/RS-1 + RS-2 + RS-3 + RS-4 + RS-5 + RS-6 states)

## Investigation Notes
_(Record here: the word-for-word comparison of RS-4 and RS-5; confirmation that the props type carries neither `scored` nor `isCorrect`; confirmation that the scored branch's diff is empty.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write one case **per matrix row** through `renderServerTree()`, each with at least one positive assertion; add the RS-4 ≡ RS-5 word-for-word case and the FE-AC-13 legacy case; observe failure

### 2. Green Phase
- [ ] Create `EssayReviewBlock.tsx` with props that carry **neither** `scored` **nor** `isCorrect` **nor** `hasBeenWrongTwice`
- [ ] Call it from **inside** the existing `notScored` branch at `:75`
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm the **scored branch** (`:133` onward) has an empty diff — TBD-02's deferral holds
- [ ] Confirm `RichText`, `TutorQuotaNote`, `ExplainStepAffordance` and the correct/incorrect chip are absent from this tree
- [ ] Confirm every case carries at least one positive assertion

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: **the Hard Rule structurally** — the props do not carry `scored`/`isCorrect`, so reading them is a compile error (MSA-F6) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- Manual/Playwright MCP visual verification — Enforces: the Golden States; IV-2 — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`; dev with seeded data

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
- **Verification method**: RTL through `renderServerTree()`, one case per matrix row with the **real** dictionary; then **L1** on dev — `/result/detail` shows the right state per question.
- **Success criteria**: each row renders its exact strings; RS-4 and RS-5 are word-for-word identical; RS-2 withholds the model answer while RS-3…RS-6 show it; a missing `essayState` renders byte-for-byte as before; the scored branch is untouched.
- **Failure response**: if a branch needs `scored` or `isCorrect` to distinguish anything, the dispatch is wrong — both are `false` in all seven states. If the rendered tree is empty, use `renderServerTree()` **and** add a positive assertion to every case.
- **Verification level**: **L1** — on dev, `/result/detail` shows the right state per question and the scored branch is untouched (TBD-02 deferral intact).

## Proof Obligations
- **Claim (FE-AC-03)**: RS-3 shows the badge "Đã chấm", `{band} / 1 điểm`, the student's answer and the model answer, and **does not** show `result.notAutoScored`.
  - **Primary failure mode (R-F1)**: a render branch reads `scored`/`isCorrect` and prints "Chưa chấm tự động" **beside a freshly computed score** — no crash, and no existing test catches it. **Boundary**: `renderServerTree()` with the real dictionary. **State assertion**: N/A. **Mock rationale**: the data source is stubbed; the tree is real. **Residual**: the structural enforcement (props do not carry the two fields) is what makes the defect a compile error; the diff-review rule covers pre-existing occurrences.
- **Claim (FE-AC-04)**: low confidence adds **text** and changes **no** number — the same card rendered twice with the flag flipped, numeric output identical.
  - **Primary failure mode**: the display-only flag leaking into arithmetic (AC-046). **Boundary**: RTL, two renders compared. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the backend half is INT-3(e) (Task B2.4).
- **Claim (FE-AC-06)**: RS-4 shows the badge, the failure sentence, the attempts note, and a **focusable `<button>`** named "Chấm lại".
  - **Primary failure mode**: a native `disabled` control, which removes it from the tab order and puts the reason out of a screen-reader user's reach. **Boundary**: RTL by role. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the control's behaviour is Task F-C1's.
- **Claim (FE-AC-13)**: a missing `essayState` renders **byte-for-byte as before**.
  - **Primary failure mode**: a legacy row gaining a wrapper node or losing `result.notAutoScored`. **Boundary**: `renderServerTree()` against the pre-change shape, with a positive assertion so the case is not vacuous. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the whole-page version is FE2E-1 (Task F-C3).
- **Claim (RS-4 ≡ RS-5, UI-D6)**: word-for-word identical.
  - **Primary failure mode**: RS-5 (stuck-pending, derived at read time) drifting into its own wording, so the same situation reads as two different failures. **Boundary**: RTL text comparison between the two rendered states. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (RS-2 withholds the model answer)**: shown at RS-3/RS-4/RS-5/RS-6, withheld at RS-2.
  - **Primary failure mode**: showing it before a band exists, inviting the student to self-grade and then be contradicted by the number that lands. **Boundary**: RTL. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: this is a reading-experience decision, **not** a security control — AC-043 constrains the in-progress path.
- **Claim (AC-016 / the three never-mounts)**: `ExplainStepAffordance` never mounts for an essay; `TutorQuotaNote` is not pulled across; no correct/incorrect chip renders.
  - **Primary failure mode**: the tutor affordance appearing on a question that can never be "wrong twice". **Boundary**: `tsc` (the prop is not received) plus RTL absence assertions accompanied by positive ones. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = component + sub-branch
- [ ] **Quality Complete** = six verify gates green
- [ ] **Integration Complete** = **L1** — `/result/detail` on dev shows the right state per question, and the **scored branch is untouched** (TBD-02 deferral intact)
- [ ] Every case carries at least one positive assertion
- [ ] Every Reference Contract and Binding Decision Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-C1 renders `EssayRegradeControl` inside RS-4/RS-5/RS-6 of this block.
- Scope boundary — preserve unchanged: the **scored branch** of `result/detail/page.tsx` (`:133` onward — TBD-02 stays deferred; O-7); `RichText`; `TutorQuotaNote`; `ExplainStepAffordance`; the correct/incorrect chip; `ScoreCard.tsx`.
- The Hard Rule is **structural**, not disciplinary: the props do not carry `scored`/`isCorrect`, so reading them does not compile.
