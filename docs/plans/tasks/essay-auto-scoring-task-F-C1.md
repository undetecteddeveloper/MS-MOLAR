# Task F-C1 — `EssayRegradeControl` + RTL test

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-C (Interaction and fixture-e2e, frontend slices V4 + V5), Task F-C1**
Layer: **frontend** (`SOURCE/app/(layer2)/_components/**`)

Metadata:
- Dependencies: **Task F-B1**, **Task B3.2**.
- Blocks: nothing.
- Provides: the retry affordance — a real focusable button that is **never** natively `disabled`.
- Size: Small (2 files)
- Verification level: **L1**.

## ENTRY CONDITION: Gate A5b ticked

**A1 + A2 + A5** — a Groq account, the key in `SOURCE/.env.local`, and **Zero Data Retention ON** — are the precondition for **ANY** Groq request, **including dev**. **A5b is currently BLOCKED on A2.** No task may set `ESSAY_GRADING_ENABLED=true` anywhere until A5b ticks; the `L1` evidence below reaches `api.groq.com` through `retryEssayGrading()`, so dev runs use **SEEDED data only — never a real student attempt**.

## Implementation Content

Create `SOURCE/app/(layer2)/_components/EssayRegradeControl.tsx` as a `"use client"` component, rendered **only on S-02, inside `EssayReviewBlock`, at RS-4 / RS-5 / RS-6**.

### Seven-step handler, copied from `RecheckOrderControl`'s documented shape
1. `if (exhausted) return;` **before** the busy latch — at RS-6 there is nothing to send: **no action call, no busy phase, no outcome node**.
2. `if (busyRef.current) return;` **before** any `setState` and **before** any `await`.
3. Set the busy flag, **then** `setState` → `aria-busy` boolean, `aria-disabled` string, the `sr-only` reason element changes text.
4. `await retryEssayGrading(...)`.
5. Store the outcome → a `role="alert"` node **appears** (inserted on outcome, **not** a pre-inserted region — this **is** a user-initiated action, the exact opposite of the poller's `polite` region).
6. `router.refresh()` — **never** a local state patch, because the server decides the band (first-write-wins) and a local patch would let `EssayScoreLine` above say one thing while the question card says another.
7. Release the latch in `finally`.

### `REFUSAL_KEY` is a `Record<RetryRefusal, MessageKey>`, not a `switch` with a `default`
That is the whole point: **adding a reason becomes a compile error right here** rather than a silent fall-through into another reason's sentence. The five entries are fixed (see Reference Contracts).

`not_failed` maps to "Câu này đã có điểm rồi." because under **AC-063** a retry on a graded question is a **normal** outcome, not an error — it is the real race where the poller lands a band while the student is pressing.

A `threw` exception reuses `profile.error.generic` — the same truth told to the same person, so there is no second sentence to drift from the first; **this is the only exception to one-reason-one-sentence**, and it is because those two inputs are one reason arriving by two routes.

### Logging
`console.error` logs **`digest` only** (`RecheckOrderControl.tsx:181-184` states why: a Postgres error message crossing a Server Action boundary can echo the student's answer back, and `Error#message` is **non-enumerable** so such a leak does **not** show under `JSON.stringify` — it shows only at a real console, i.e. late).

### Never a native `disabled`, including at RS-6
The control stays in the tree, stays focusable, and carries `aria-disabled="true"` with `aria-describedby` pointing at `result.essay.retryExhausted`. `min-h-11` touch target (see FE-OQ-5).

## Target Files
- [x] `SOURCE/app/(layer2)/_components/EssayRegradeControl.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/__tests__/EssayRegradeControl.test.tsx` (new) — 16 cases
- [x] `SOURCE/app/(layer2)/_components/EssayReviewBlock.tsx` — **extra**: the control slots in at RS-4/5/6 (F-B1 recorded this as F-C1's work)
- [x] `SOURCE/app/(layer2)/_components/__tests__/EssayReviewBlock.test.tsx` — **extra, named by `tsc`**: two new props + a router stub
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` — **extra**: passes `attemptId`/`questionId` down

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayRegradeControl — verify Idle + Busy + Done-refused (all five reasons) + Done-success + Threw + Exhausted states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayReviewBlock — RS table: RS-6's retry control "Có mặt, `aria-disabled`")
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Agreement Checklist Scope — `EssayRegradeControl`: seven-step handler, `REFUSAL_KEY` record over all five refusal reasons, never a native `disabled`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Accessibility Requirements — four role-based assertions + one manual screen-reader pass)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Security Considerations — `console.error` logs `digest` only)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (the seven-step shape; `:22-26` the counter-example on pre-inserted live regions; `:181-184` the `digest`-only rule and why)
- `SOURCE/components/billing/__tests__/RecheckOrderControl.test.tsx` (`:55` the counted `refresh` mock; `:56` the mocked Server Action)
- `SOURCE/app/(layer2)/essayActions.ts` (Task B3.2 — the five-reason refusal union this control maps)
- `SOURCE/app/(layer2)/_components/EssayReviewBlock.tsx` (Task F-B1 — where this control is rendered, at RS-4/RS-5/RS-6)
- `SOURCE/lib/tutor/useTutorAction.ts` (`:26-31` — why the latch must be a synchronous `ref`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| frontend DD (§ EssayRegradeControl — REFUSAL_KEY) | column/label set and order | `not_found` → `profile.error.sessionExpired` (reused); `not_failed` → `result.essay.retryAlreadyGraded`; `exhausted` → `result.essay.retryExhausted`; `budget` → `result.essay.retryBudgetOut`; `server` → `profile.error.generic` (reused). Declared as `Record<RetryRefusal, MessageKey>`, **not** a `switch` with `default` | The map is a `Record` with exactly those five entries, and no `switch`/`default` is used |
| UI Spec (§ Component: EssayReviewBlock — RS table) | column/label set and order | RS-2 `◌ Đang chấm`; RS-3 `✓ Đã chấm`; RS-4 `✕ Chấm thất bại`; RS-5 `✕ Chấm thất bại` — "Giống RS-4 **từng chữ một** (UI-D6)"; RS-6 `✕ Chấm thất bại` + *"Câu này đã dùng hết lượt chấm. Hệ thống sẽ không tự chấm lại."*, retry control "Có mặt, `aria-disabled`" | At RS-6 the control is **present** and `aria-disabled`, never removed and never natively disabled |
| frontend DD (§ FE-AC-21) | state-lifecycle-negative | "Ở **mọi** trạng thái của tính năng, **PHẢI KHÔNG** có phần tử nào trong cây tự luận mang thuộc tính `disabled`, và **PHẢI KHÔNG** có chuỗi hiển thị nào chứa một con số lượt chấm còn lại." | `hasAttribute("disabled") === false` for every element in every one of the six states, and no rendered string contains a remaining-attempts number |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayRegradeControl — verify Idle + Busy + Done-refused + Done-success + Threw + Exhausted states)

## Investigation Notes

### `REFUSAL_KEY` is a `Record`, and that is the point
A `switch` with a `default` lets a sixth reason fall silently into another reason's sentence — telling a student something untrue about their own situation. As a `Record<RetryRefusal, MessageKey>`, adding a reason is a **compile error right here**. Five entries, five sentences, and a case asserts all five are **distinct**: if two collapsed, the per-reason cases would all still pass while the student could no longer tell which situation they were in.

Two keys are **reused**, not duplicated (`not_found` → `profile.error.sessionExpired`, `server` → `profile.error.generic`), per the convention at `en.ts:5-6`.

### The `threw` branch reuses `server`'s sentence — the only exception to one-reason-one-sentence
A thrown exception and a `server` refusal are **one truth arriving by two routes**, told to the same person. Giving them separate strings would create a second sentence to drift from the first. Recorded because it looks like a shortcut and is not.

### Two ordering rules, both asserted rather than assumed
1. `if (exhausted) return` sits **above** the busy latch. At RS-6 there is nothing to send, so a press must produce **no action call, no busy phase, no outcome node** — all three asserted in one case.
2. `busyRef` is a **synchronous ref**, checked before any `setState` and before any `await`. A state-based latch reads the *previous* render's value, so a second click in the same tick gets through. Asserted by firing two clicks and expecting exactly one call.

### `router.refresh()`, never a local state patch
The server decides the band (first-write-wins). A local patch would let `EssayScoreLine` above say one thing while the question card below says another — on the same screen, about the same attempt. Asserted directly.

### The alert node appears on outcome; it is not a pre-inserted live region
`role="alert"` with **no** `aria-live`, inserted when the outcome arrives. This is a user-initiated action — the exact opposite of the poller's `polite` region, where what changes is something the student did not press. Idle and success states assert **no** alert node exists.

### Never a native `disabled`, including at RS-6
Asserted three ways: `hasAttribute("disabled") === false`, `aria-disabled === "true"`, and the button **still takes focus** (`document.activeElement`). Plus a subtree `querySelector("[disabled]")` returning null in both states (FE-AC-21). The reason is reachable through `aria-describedby`.

### One test-harness correction, and one in the block that hosts it
`vi.mock` factories are hoisted above `const` declarations, so the first draft failed with `Cannot access 'retryMock' before initialization`. Fixed with `vi.hoisted`, the same shape `gradeEssays.test.ts` uses.

Slotting the control into `EssayReviewBlock` then broke that block's tests: the client child calls `useRouter()`, which throws `invariant expected app router to be mounted` inside a bare `renderToReadableStream`. Stubbed with the one-method shape `OrderRow.test.tsx` already runs — **the control itself stays real**, only the router is stubbed.

### Still owed: the L1 check
Pressing retry on a seeded `failed` question on dev and receiving a band reaches `api.groq.com` through `retryEssayGrading()`. It needs the same engineer-owned grading run as F-A3 and F-B3. Every state is covered at unit level, including all five refusal reasons.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write the six-state test covering all five `REFUSAL_KEY` entries, with `useT()` **real**; observe failure

### 2. Green Phase
- [ ] Implement the seven-step handler in the stated order, with the `exhausted` early return **before** the busy latch
- [ ] Declare `REFUSAL_KEY` as a `Record<RetryRefusal, MessageKey>`
- [ ] `console.error` logs `digest` only; `min-h-11`; never a native `disabled`
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Sweep every state: `hasAttribute("disabled") === false` for every element
- [ ] Confirm no rendered string contains a remaining-attempts number
- [ ] Confirm no two refusal reasons share a string

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the `Record<RetryRefusal, MessageKey>` — adding a reason is a compile error here — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Enforces: `react-hooks/refs` and `react-hooks/set-state-in-effect` — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers all client components
- Manual/Playwright MCP visual verification — Enforces: IV-5 — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`; dev with seeded data

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | The `Record<RetryRefusal, MessageKey>` is the gate: a sixth reason is a compile error here |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 2011 passed / 10 skipped / 0 todo (was 1995 — **+16**) |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | Expected red, TD-030 baseline only. Snapshot CRLF churn reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL with `next/navigation` (`useRouter().refresh`) mocked so refreshes are **counted** (`RecheckOrderControl.test.tsx:55`), the Server Action mocked (`:56`), and `useT()` **real** — so cases assert the right **key resolved to the right string** rather than "some string". Then **L1** on dev.
- **Success criteria**: six states covered; all five refusal reasons produce **exactly one** `role="alert"` node each with the mapped string and no two share a string; at RS-6 the button remains in the tree, focusable, `aria-disabled="true"`, with `aria-describedby` resolving to `result.essay.retryExhausted`; pressing it in the exhausted state produces **zero** action calls, **no** busy phase and **no** alert node.
- **Failure response**: if a native `disabled` appears in any state, replace it with the focusable + `aria-disabled` idiom — the repo has fixed this exact bug twice. If a local state patch is used instead of `router.refresh()`, remove it: the server decides the band, and a local patch lets `EssayScoreLine` above say one thing while the question card says another.
- **Verification level**: **L1** — pressing retry on a `failed` question on dev enters the busy phase, calls the action, refreshes, and shows either a band or **exactly one** alert.

## Proof Obligations
- **Claim (FE-AC-06)**: RS-4 shows a focusable `<button>` named "Chấm lại".
  - **Primary failure mode**: a native `disabled` control. **Boundary**: RTL by role. **State assertion**: N/A. **Mock rationale**: `next/navigation` and the Server Action mocked; `useT()` real. **Residual**: none.
- **Claim (FE-AC-07)**: at RS-6 the button **remains in the tree**, is focusable, has `aria-disabled="true"`, and its `aria-describedby` resolves to an element containing `result.essay.retryExhausted`.
  - **Primary failure mode**: removing the control at the cap, so the student has no explanation of why they cannot retry. **Boundary**: RTL; `.focus()` then `document.activeElement`; `aria-describedby` resolution. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: real-browser focus behaviour is FE-OQ-4 (Final Phase).
- **Claim (FE-AC-08)**: pressing it in the exhausted state produces **zero** `retryEssayGrading` calls, **no** busy phase, and **no** `role="alert"` node.
  - **Primary failure mode**: the `exhausted` check placed after the busy latch, so a blocked press still flickers busy and inserts an alert. **Boundary**: RTL with a counted action mock. **State assertion**: the busy phase never enters. **Mock rationale**: as above. **Residual**: the server-side cap is B3.2's and H8's.
- **Claim (FE-AC-09)**: a `{ ok: false, reason }` result produces **exactly one** `role="alert"` node with the mapped string, and **no two reasons share a string** — all five covered.
  - **Primary failure mode**: a `switch` with a `default` silently mapping a new reason into another reason's sentence. **Boundary**: RTL, five cases, real dictionary. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: `threw` deliberately reuses `profile.error.generic` — one reason arriving by two routes, and the **only** exception.
- **Claim (FE-AC-21)**: no element in the essay tree carries `disabled`, in **any** of the six states, and no rendered string contains a remaining-attempts number.
  - **Primary failure mode**: one state using the native attribute, or an "n lượt còn lại" string leaking the count the client is not given (AC-044/MSA-2). **Boundary**: RTL subtree sweep per state. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (the `digest`-only logging rule)**: `console.error` logs `digest` only.
  - **Primary failure mode**: a Postgres error message echoing the student's answer back — and `Error#message` is non-enumerable, so the leak does **not** show under `JSON.stringify`. **Boundary**: RTL with a spied `console.error`, asserting the payload's key set. **State assertion**: N/A. **Mock rationale**: `console.error` spied. **Residual**: none.

## Completion Criteria
- [ ] **Entry condition**: Gate A5b ticked before the dev `L1` run
- [ ] **Implementation Complete** = component + six-state test covering **all five** refusal reasons
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = **L1** — pressing retry on a `failed` question on dev enters the busy phase, calls the action, refreshes, and shows either a band or **exactly one** alert
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: rendered inside `EssayReviewBlock` (Task F-B1) at RS-4/RS-5/RS-6; drives `retryEssayGrading()` (Task B3.2).
- Scope boundary — preserve unchanged: `SOURCE/components/billing/RecheckOrderControl.tsx` (its **shape** is copied, not edited); `SOURCE/app/(layer2)/_components/EssayReviewBlock.tsx`'s other branches.
- `router.refresh()`, **never** a local state patch: the server decides the band (first-write-wins).
