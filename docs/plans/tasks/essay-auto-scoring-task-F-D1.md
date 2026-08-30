# Task F-D1 — Flag-selected footnote key + prop chain + segment read

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-D (Player Footnote, frontend slice V6), Task F-D1**
Layer: **frontend** (`SOURCE/app/(layer2)/**`)

Metadata:
- Dependencies: **Task B1.5** (the flag must be readable on the server), **Task F-C3**.
- Blocks: nothing.
- Provides: the exam player's essay footnote telling the truth in **both** phases.
- Size: Medium (4 files)
- Verification level: **L1** — with the flag off, the player shows today's sentence; with it on, the new one.

## Why the chosen approach
Approach (a) — **two i18n keys plus a server-read flag** — is correct **regardless of commit order**, which is exactly why it was chosen over one key plus ship-ordering: with one engineer and no staging (C-F6), correctness that depends on commit sequencing is not worth betting. Scheduled last anyway; there is no reason to land the copy early.

## Implementation Content

### `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/page.tsx`
Read `ESSAY_GRADING_ENABLED` on the server (**read site 3 of 3** — the **copy** gate; the other two are behaviour gates in `submitExam()` and `retryEssayGrading()`) and pass it down as `essayGradingEnabled` (`:23-31`). All three read **one** variable so they flip together in a single deploy. **Never `NEXT_PUBLIC_*`** (UI-D7): a second copy of one truth on both sides of a boundary drifts, and **the client side is the side that lies to the student**.

### `SOURCE/app/(layer2)/_components/ExamPlayer.tsx`
Accept the **optional** prop `essayGradingEnabled?: boolean` (`:28-41`) and forward it **unchanged** to `QuestionRenderer` (`:265`). **State, handlers and layout are untouched.**

### `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx`
Accept the same optional prop (`:45-53`) and select the footnote key at `:199` — on ⇒ `player.essayScored` ("Tự luận — chấm tự động sau khi bạn nộp bài."), off ⇒ `player.essayNotScored` (today's wording, **verbatim**). Fix the **reason** in the comment at `:179-180`.

**Do not touch** `player.essayPlaceholder` (`:195`), the `player.charsLeft` structure (`:201-203`), the `<textarea>`, its classes, or its `onChange` handler (AC-052). The character ceiling needs **no** edit here — both consumers read the alias at `:23` (D-04).

### The prop is optional with default `false`, and that carries weight rather than being a convenience
A **required** prop would make every existing construction site fail `tsc` and would force `ExamPlayer.test.tsx` to change. Because it is **optional**, `QuestionRenderer.test.tsx` — which builds the component **without** passing it — receives `false`, renders `player.essayNotScored`, and **its pinned string at `:112` stays green**. That is why `:112` is not part of Task B3.3.

### Open Item I-6 — resolve it explicitly here, before writing the commit
The frontend DD's Implementation Path Mapping says `:112` and `:119` "must both change together", while backend **D-14** says `:112` stays green until a test exercises the enabled branch. **D-14's analysis is the one confirmed against the shipped prop shape** (optional, default `false`) — but **resolve this explicitly before writing the commit**, and **if a new case is added here that exercises the enabled branch, `:112` becomes coupled at that moment.** If the prop were ever made **required**, or its default changed to `true`, `:112` goes red immediately and becomes coupled earlier than planned. *Owner: engineer, at this task.*

## Target Files
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/page.tsx` — read site 3 of 3 (the copy gate)
- [x] `SOURCE/app/(layer2)/_components/ExamPlayer.tsx` — accepts and forwards unchanged
- [x] `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx` — optional prop + flag-selected key + the corrected reason
- [x] `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` — 3 new cases + a trailing optional helper parameter

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: QuestionRenderer (essay branch) — verify default-with-flag-on and default-with-flag-off states)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ S-04 / MSA-F2 — optional `essayGradingEnabled?: boolean` default `false`; `ExamPlayer` forwards it; the player route segment reads the server-only flag; **Option (a): correct regardless of commit order**)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Security Considerations — the flag crosses the boundary as a pre-read boolean, **no `NEXT_PUBLIC_*`**)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/page.tsx` (`:23-31` — where the prop is passed down; Task B1.5 added `maxDuration` here)
- `SOURCE/app/(layer2)/_components/ExamPlayer.tsx` (`:28-41` the props; `:265` the forward to `QuestionRenderer`)
- `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx` (`:23` the ceiling alias; `:45-53` the props; `:179-180` the comment to fix; `:194` `maxLength`; `:195` `player.essayPlaceholder`; `:199` the footnote key; `:201-203` the `charsLeft` structure)
- `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` (`:112` the AC-051 footnote pin — **the I-6 decision point**; `:116`/`:119` the ceiling sites moved by Task B3.3)
- `SOURCE/app/(layer2)/_components/__tests__/ExamPlayer.test.tsx` (must stay **green without edits** — the proof the prop is genuinely optional)
- `SOURCE/lib/i18n/dictionaries/vi.ts` and `en.ts` (Task F-A1 — `player.essayScored` new, `player.essayNotScored` kept verbatim)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| frontend DD (§ FE-AC-20) | derived-display | "KHI cờ AC-067 **tắt**, chân trang ô nhập tự luận **PHẢI** giữ nguyên văn `player.essayNotScored`; KHI **bật**, nó **PHẢI** là `player.essayScored`." | With the prop absent/`false` the footnote is `player.essayNotScored` **verbatim**; with it `true` it is `player.essayScored` |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop |
|---|---|
| Owner (left) | Vercel / `.env.local` |
| Owner (right) | `submitExam()` (behaviour gate), `retryEssayGrading()` (behaviour gate), **the player route segment (copy gate) → `ExamPlayer` → `QuestionRenderer`** |
| Serialized format | Env string; **only** `"true"` (trimmed) means on. Crosses the server/client boundary as a **pre-read boolean prop** `essayGradingEnabled?: boolean`, optional, defaulting to `false`. **Never** `NEXT_PUBLIC_*` (UI-D7) |
| Consumer parse rule | **The client component treats an absent prop as `false` and selects `player.essayNotScored`**; `checkEnv.ts` registers the variable at level `warn` with the operator-visible consequence spelled out |
| Expected signal | INT-1(d): four spellings (absent, `""`, `"TRUE"`, `"1"`) all mean off with a trimmed `"true"` as the single positive control; FE2E-1: no essay node, no timer, zero refreshes |

Roundtrip check this task owns: the boolean the segment reads is the boolean the renderer receives — **no second copy of the truth crosses the boundary**.

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: QuestionRenderer (essay branch) — verify default-with-flag-on + default-with-flag-off states)

## Investigation Notes

### Open Item I-6 — resolved here, with the coupling moment named
The frontend DD says the footnote pin and the `maxLength` pin "must both change together"; backend **D-14** says the footnote pin stays green until a test exercises the **enabled** branch. **D-14 is right**, and the reason is the shipped prop shape: `essayGradingEnabled` is **optional, default `false`**, so every pre-existing construction site receives `false`, renders `player.essayNotScored`, and its pinned string does not move. That is exactly why the footnote pin was **not** part of Task B3.3.

**But the coupling begins now.** The first case that exercises the enabled branch is the one added in this commit, so from here the two are coupled — precisely as D-14 predicted. The breaking condition is recorded next to the test: if the prop is ever made **required**, or its default flipped to `true`, the footnote pin goes red immediately and the coupling arrives earlier than planned.

### The optional prop earns its keep; it is not a convenience
A **required** prop would fail `tsc` at every existing construction site and force `ExamPlayer.test.tsx` to change — pulling an unrelated file into this commit and turning a copy change into a mechanical sweep. Optional keeps the blast radius to the three files that actually carry the decision.

The test helper gained a **third, optional, trailing** parameter for the same reason: every existing caller keeps its old signature and therefore keeps receiving `undefined`.

### Read site 3 of 3, and it is the only one that is a copy gate
`submitExam()` and `retryEssayGrading()` are **behaviour** gates — they decide whether lifecycle keys are emitted and whether a retry can reach the provider. This one decides **only** which of two i18n keys is printed. All three read **one** variable, so they flip together in a single deploy.

**Never `NEXT_PUBLIC_*`** (UI-D7): a second copy of one truth on both sides of a boundary drifts, and the client side is the side that lies to the student. The flag is read on the server and crosses as a settled boolean. The read rule is fail-closed and identical at all three sites: only the trimmed string `"true"` is on.

### Two keys, not one replaced
AC-051 reads as though the old string disappears. It must not: AC-067 creates a real interval in which the old sentence is **true** — the feature ships disabled, the work is saved, and it is not auto-scored. Deleting it in the same commit would force shipping a **false** sentence for that whole interval. The old string is kept **verbatim** and selected by the flag (UI-D8).

### AC-052 asserted, not assumed
A dedicated case renders both flag states and compares the `<textarea>`'s `placeholder` and `maxLength` across them. The flag selects **one sentence** and touches nothing else in the input the student is typing into. It also re-confirms the ceiling is now **4000** (B3.3), read through the alias — no second literal.

### One correction
The first draft of the AC-052 case called `cleanup()`, which this file does not import (it deliberately has no auto-cleanup). Rewritten to read from each render's own `container` instead of `screen`, which is the right shape for a file without cleanup anyway.


## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Resolve Open Item I-6 explicitly** and record the decision: does `:112` move in this commit? (D-14's analysis is the one confirmed against the shipped prop shape — but if the new case exercises the **enabled** branch, `:112` becomes coupled at that moment)
- [ ] Write the new RTL case **flag off ⇒ old string** and observe it fail

### 2. Green Phase
- [ ] Segment: read the flag on the server and pass `essayGradingEnabled` down
- [ ] `ExamPlayer`: accept the optional prop and forward it unchanged
- [ ] `QuestionRenderer`: accept the optional prop, select the footnote key at `:199`, fix the `:179-180` reason
- [ ] Run only the added case and confirm it passes

### 3. Refactor Phase
- [ ] Confirm `ExamPlayer.test.tsx` is green **without edits**
- [ ] Confirm `player.essayPlaceholder`, the `charsLeft` structure, the `<textarea>`, its classes and its handler are untouched (AC-052)
- [ ] Confirm **no `NEXT_PUBLIC_*`** exists anywhere for this flag
- [ ] Confirm all three read sites read **one** variable

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the optional prop does not break existing construction sites — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the new case and the untouched `ExamPlayer.test.tsx` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: the server-only flag read does not leak into the client tree — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers all client components (`ExamPlayer.tsx` and `QuestionRenderer.tsx` are `"use client"`)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 2025 passed / 10 skipped / 0 todo (was 2022 — **+3**) |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | TD-030 baseline only; the essay fixture file stays 3/3 with 0 todo |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL — a **new** case asserting **flag off ⇒ old string**; then **L1** on dev — toggle the env var and confirm the footnote changes **and nothing else does**.
- **Success criteria**: with the flag off the footnote is `player.essayNotScored` **verbatim**; with it on, `player.essayScored`; `ExamPlayer.test.tsx` green **without edits** (the proof the prop is genuinely optional); the placeholder, character counter, textarea and handler unchanged.
- **Failure response**: if `ExamPlayer.test.tsx` needs an edit, the prop was made **required** — make it optional. If a `NEXT_PUBLIC_*` variable appears, remove it: a second copy of one truth on both sides of a boundary drifts, and the client side is the side that lies to the student.
- **Verification level**: **L1** — toggling the env var on dev changes the footnote **and nothing else**.

## Proof Obligations
- **Claim (FE-AC-20)**: flag **off** ⇒ the footnote is `player.essayNotScored` **verbatim**; flag **on** ⇒ `player.essayScored`.
  - **Primary failure mode (R-F10 residual)**: a forgotten prop wiring somewhere in the chain, so the copy never changes when the flag flips — **which is exactly what the new "flag off ⇒ old string" case catches**, because the default path is the one that silently keeps working.
  - **Boundary to exercise**: RTL over `QuestionRenderer` with the real dictionary, plus the server-read at the segment (covered by the `L1` toggle).
  - **State assertion**: N/A (copy selection, not state).
  - **Mock boundary rationale**: none in RTL — the dictionary is real; the flag is a prop.
  - **Residual**: the segment's own read is verified by the `L1` toggle, not by RTL.
- **Claim (AC-052)**: placeholder, character counter, textarea and handler **unchanged** — the existing RTL cases stay green.
  - **Primary failure mode**: an edit riding along with the copy change into the input path students use during an exam. **Boundary**: the existing RTL cases + diff review. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (AC-049)**: characters remaining = ceiling − length, unchanged behaviour at the **raised** ceiling.
  - **Primary failure mode**: a second hard-coded literal — which cannot exist here, because both consumers read the alias at `:23` (D-04). **Boundary**: RTL. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the ceiling itself moved in Task B3.3.
- **Claim (the optional prop's weight)**: `ExamPlayer.test.tsx` is green **without edits**, and `QuestionRenderer.test.tsx:112` stays green because the test builds the component **without** the prop and therefore receives `false`.
  - **Primary failure mode**: making the prop required, which breaks every existing construction site and pulls `:112` into coupling **earlier than planned** (Open Item I-6). **Boundary**: `tsc` + both suites. **State assertion**: N/A. **Mock rationale**: none. **Residual**: **if a new case here exercises the enabled branch, `:112` becomes coupled at that moment** — resolve I-6 explicitly before writing the commit.
- **Claim (no `NEXT_PUBLIC_*`, UI-D7)**: the flag crosses the boundary as a **pre-read boolean prop**.
  - **Primary failure mode**: a second copy of one truth on both sides of a boundary drifting — and the client side is the side that lies to the student. **Boundary**: repo scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = three production files + the **new** RTL case
- [ ] **Quality Complete** = six verify gates green, **`ExamPlayer.test.tsx` unchanged and green**
- [ ] **Integration Complete** = **L1** — toggling the env var on dev changes the footnote **and nothing else**
- [ ] **Open Item I-6 resolved and the decision recorded**: whether `:112` moves in this commit
- [ ] All three flag read sites read **one** variable and flip together in a single deploy; **no `NEXT_PUBLIC_*` exists**
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: the player screen's footnote only; Phase E's Task E6 confirms all three read sites flipped in one deploy.
- Scope boundary — preserve unchanged: `SOURCE/app/(layer2)/_components/__tests__/ExamPlayer.test.tsx` (**green without edits** — that is the proof the prop is optional); `player.essayPlaceholder` (`:195`), the `player.charsLeft` structure (`:201-203`), the `<textarea>`, its classes and its `onChange` handler (AC-052); the ceiling alias at `:23` (**no edit** — D-04); `QuestionRenderer.test.tsx:116`/`:119` (Task B3.3).
- `player.essayNotScored` is **kept**, not replaced — the old key and the new one are selected by the flag (UI-D8, one of the four deliberate AC restatements confirmed in the Final Phase).
