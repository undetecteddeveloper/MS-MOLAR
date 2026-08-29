# Task B3.3 — Tutor prompt cap + character ceiling raise + the AC-048 coupled test site (ONE commit)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B3 (Retry, Telemetry and the Ceiling Ripple, vertical slice V3), Task B3.3**
Layer: **backend** (`SOURCE/lib/tutor/**`, `SOURCE/lib/ugc/**`) with one coupled frontend test site

Metadata:
- Dependencies: **Task H7 (hard)**, **Task B3.1**.
- Blocks: nothing; **this is the commit that closes H7's known-red window.**
- Provides: `TUTOR_MAX_STUDENT_ANSWER`, the raised `LIMITS.MAX_ATTEMPT_ANSWER`, and the moved `QuestionRenderer.test.tsx:119` pin.
- Size: Small (3 files, **one** commit)
- Verification level: **L2** + a fully green `verify:schema` on both databases.

## Change Category
`Change Category: boundary-change`

`LIMITS.MAX_ATTEMPT_ANSWER` is one half of a TypeScript ↔ Postgres contract duplicated in git and in each database. Adjacent cases swept: the DB ceiling (moved at H7), the `:119` `maxLength` pin and the `:116` comment (both move here), and the Gemini prompt path that the raise ripples into (closed by declaring `TUTOR_MAX_STUDENT_ANSWER` **separately** and enforcing it **inside** `buildTutorPrompt()`).

## Entry condition, corrected (I002)

**Task H7 complete** — the widened CHECK is live on **both** databases, and every `verify:schema` assertion **except the character-ceiling gate** is green on both.

**The ceiling gate is EXPECTED RED ON ENTRY**: H7 moved the database to 4000 while `LIMITS.MAX_ATTEMPT_ANSWER` still reads 500, and **this task is what moves the constant**. **The ceiling gate turning green is this task's completion evidence, not its precondition** — the earlier wording required the state only this task can create.

### This is the commit that closes H7's known-red window
Before starting, **confirm from the per-commit exit-code records (Gate E4) that the ceiling assertion has been the ONLY red `verify:schema` assertion throughout the window.** Any other red one is a regression that must be resolved first, because this task is about to **remove the signal that would have surfaced it**.

The **R-f** condition is unchanged and not negotiable: shipping the code ceiling **above** the database ceiling makes Postgres reject an **entire** submission. The window deliberately sits on the other side of that asymmetry — code below DB **truncates**, which is recoverable.

## Implementation Content — all in one commit

- **`SOURCE/lib/tutor/prompt.ts`**: declare `const TUTOR_MAX_STUDENT_ANSWER = 500;` **separately**, deliberately **not** importing `LIMITS.MAX_ATTEMPT_ANSWER`, and enforce the slice **inside** `buildTutorPrompt()` (`:100-107`) — never at a call site, **because a cap at a call site is a cap the second call site forgets**. Carry the reason in the comment: the DB ceiling is a decision about how much a student may write; this number is a decision about how many tokens we send to Gemini, **on a different budget key**. Fix the **reason** in the `:36` comment. The `questionType` union at `:37` stays **closed** (AC-071, enforced by `tsc`).
- **`SOURCE/lib/ugc/limits.ts`**: `MAX_ATTEMPT_ANSWER: 500 → 4000`, and fix the comment at `:12-16` which hard-codes `500`.
- **`SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx`**: `:119` `expect(textarea?.maxLength).toBe(500)` → `toBe(4000)`, and the `:116` comment that hard-codes `"CHECK length <= 500"`.

### Ordering rule (Gate H4)
The tutor cap lands **before or with** the raise, **never after**. In the window between them, a self-composed `short_answer` of 4000 characters flows straight into the Gemini prompt — essays never reach the tutor (the closed union excludes them), so the ripple travels through the **`short_answer`** path. The client input is capped at `LIMITS.MAX_SHORT_ANSWER = 100`, but **a client cap is not a server cap**: `submitExam` slices with `MAX_ATTEMPT_ANSWER` (`actions.ts:146`), so a hand-made request stores 4000 characters and they reach the prompt when the student presses "Giải thích bước này".

### `QuestionRenderer.tsx` itself needs no ceiling edit (D-04)
`:23` aliases the constant and both `:194` (`maxLength`) and `:202` (the `charsLeft` arithmetic) read the alias, so they move with the constant. Recorded so nobody hunts for two literals that do not exist.

### `:112` is NOT part of this commit
That line pins the English footnote string and is **AC-051**-coupled; it stays green while the flag is off and fails at a **different** time. Backend D-14 states plainly that treating `:112` and `:119` as one site is how the wrong one gets "fixed". See **Open Item I-6** — resolved at Task **F-D1**.

## Target Files
- [ ] `SOURCE/lib/tutor/prompt.ts`
- [ ] `SOURCE/lib/ugc/limits.ts`
- [ ] `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx`

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Ripple R11 vào đường Gemini — `TUTOR_MAX_STUDENT_ANSWER` declared separately and enforced inside `buildTutorPrompt()`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Trần ký tự / D-04 / D-14 — the coupled sites; `QuestionRenderer.tsx` needs no ceiling edit; `:112` vs `:119`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-09 — `prompt.ts:36` is this task's single reason-only site)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: QuestionRenderer (essay branch) — the `:119` maxLength coupled site)
- `SOURCE/lib/tutor/prompt.ts` (`:36` the stale comment; `:37` the closed `questionType` union; `:100-107` `buildTutorPrompt()`'s body — where the slice is enforced)
- `SOURCE/lib/ugc/limits.ts` (`:12-16` the comment hard-coding 500; `:17` `MAX_ATTEMPT_ANSWER`; `MAX_SHORT_ANSWER = 100`)
- `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` (`:112` the AC-051 footnote pin — **untouched**; `:116` the `"CHECK length <= 500"` comment; `:119` the `maxLength` pin)
- `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx` (`:23` the alias; `:194` `maxLength`; `:202` the `charsLeft` arithmetic — **no ceiling edit needed**)
- `SOURCE/app/(layer2)/actions.ts` (`:146` — `submitExam` slices with `MAX_ATTEMPT_ANSWER`; a client cap is not a server cap)
- `SOURCE/supabase/verify-schema.ts` (Task H6 — the ceiling gate whose red→green transition is this task's evidence)

## Boundary Context (from the work plan's Connection Map)

| Boundary | `LIMITS.MAX_ATTEMPT_ANSWER` (TypeScript) → `attempt_answers_answer_check` (Postgres) |
|---|---|
| Owner (left) | `SOURCE/lib/ugc/limits.ts:17` and `submitExam()`'s slice at `actions.ts:146` |
| Owner (right) | `public.attempt_answers.answer` CHECK |
| Serialized format | Integer ceiling, duplicated in two places (git and each database) |
| Consumer parse rule | `verify:schema` probes **behaviourally** and discriminates by SQLSTATE (`23514` check violation vs `23503` foreign-key violation), because **no CHECK-constraint read path exists** |
| Expected signal | `npm run verify:schema` is **red** when the two ceilings differ, on both databases; code ceiling above DB ceiling means Postgres rejects an entire submission. **This is exactly why H7→B3.3 is a known-red window**: H7 moves the DB, B3.3 moves the constant, and the gap deliberately sits on the truncating side |

Roundtrip check this task closes: after this commit the two ceilings are equal on **both** databases, and the gate goes green.

## Investigation Notes
_(Record here: the audit of the window's per-commit exit codes confirming the ceiling assertion was the only red one; the EG-BE-029 measurement (prompt answer region length given a 4000-character input); the `verify:schema` red→green transition on both databases.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] **Audit the known-red window**: walk the Gate E4 exit-code records from H7 to here and confirm the ceiling assertion was the **only** red `verify:schema` assertion. Resolve anything else **before** proceeding
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): the `:119` pin, the `:116` comment, the alias-reading sites at `:194`/`:202` (no edit needed), and `actions.ts:146`'s slice
- [ ] Write the EG-BE-029 case (a 4000-character `studentAnswer` ⇒ the prompt's answer region is ≤ 500 characters) and observe it fail

### 2. Green Phase
- [ ] `prompt.ts`: declare `TUTOR_MAX_STUDENT_ANSWER = 500` separately; enforce the slice **inside** `buildTutorPrompt()`; fix the `:36` reason; leave the union at `:37` closed
- [ ] `limits.ts`: `MAX_ATTEMPT_ANSWER` 500 → 4000; fix the `:12-16` comment
- [ ] `QuestionRenderer.test.tsx`: `:119` → `toBe(4000)`; fix the `:116` comment
- [ ] Run only the affected tests and confirm they pass

### 3. Refactor Phase
- [ ] Run `npm run verify:schema` against **both** databases and confirm the ceiling assertion goes **green** — this is the completion evidence
- [ ] Confirm `:112` is **untouched**
- [ ] Confirm `QuestionRenderer.tsx` needed **no** ceiling edit

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: **AC-071**, the closed `TutorPromptInput.questionType` union — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the moved `:119` pin and EG-BE-029 — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run verify:schema` — Enforces: the character ceiling read back from a real DB — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/lib/ugc/limits.ts`. **Its red→green transition is this task's completion evidence.**
- `attempt_answers_answer_check` — Enforces: the student answer length ceiling — Config: `schema.sql:472-474` (widened 500 → 4000 at H7)

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
| 8 | `npm run verify:schema` | | Gate E3 — this task's files match `SOURCE/lib/ugc/limits.ts`. **Run against BOTH databases. Expected: fully green, including the character-ceiling assertion — its red→green transition closes H7's known-red window and IS this task's completion evidence** |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run `npm run verify:schema` against **both** databases after the constant moves, and read the character-ceiling assertion's outcome; run the EG-BE-029 case (build a tutor prompt with a 4000-character `studentAnswer` and assert the answer region is ≤ 500 characters).
- **Success criteria**: `verify:schema` **fully green** on both databases — including the ceiling assertion; the tutor prompt's answer region stays ≤ 500 characters given a 4000-character input; `QuestionRenderer.test.tsx:119` green at `4000`; `:112` untouched and still green.
- **Failure response**: if the ceiling assertion is still red after this commit, the constant and the DB disagree — **do not** relax the gate; find which side is wrong. If a `verify:schema` assertion **other than** the ceiling was red anywhere in the window, that is a regression that was masked by the window and must be resolved before this commit removes the signal.
- **Verification level**: **L2** plus a real-database gate on both projects.

## Proof Obligations
- **Claim (EG-BE-028)**: `LIMITS.MAX_ATTEMPT_ANSWER` equals the DB ceiling on **both** databases, and `verify:schema` is red if they differ.
  - **Primary failure mode** (R-02): the ceiling moves in only one place. Code **above** DB means Postgres rejects a whole submission — **a student loses an entire attempt**; code **below** DB truncates real work. The window was deliberately kept on the truncating side.
  - **Boundary to exercise**: both real databases, through the behavioural SQLSTATE probe (Task H6's gate).
  - **State assertion**: before → DB 4000 / code 500 (gate red); action → constant moves; after → both 4000 (gate green).
  - **Mock boundary rationale**: none — a mocked database cannot answer what the ceiling actually is.
  - **Residual**: proves the two agree at this commit; drift afterwards is caught by the same gate on every later commit.
- **Claim (EG-BE-029 / Gate H4)**: a tutor prompt built with a 4000-character `studentAnswer` has an answer region **≤ 500 characters** — today a **provable no-op**, since nothing stored exceeds 500 under the old CHECK.
  - **Primary failure mode**: the cap enforced at a call site rather than inside `buildTutorPrompt()`, so the second call site forgets it and a self-composed 4000-character `short_answer` flows into the Gemini prompt on a different budget key. Essays never reach the tutor (the closed union excludes them), so the ripple travels through the `short_answer` path.
  - **Boundary to exercise**: in-process over the built prompt string.
  - **State assertion**: N/A. **Mock rationale**: none — `buildTutorPrompt()` is pure. **Residual**: the token-cost claim is structural, not measured against the live provider.
- **Claim (AC-049)**: the displayed characters-remaining equals the DB ceiling minus the typed length.
  - **Primary failure mode**: a second hard-coded literal in the renderer drifting from the constant — which cannot happen here, because both consumers read the alias at `QuestionRenderer.tsx:23` (D-04). **Boundary**: RTL over the renderer. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (AC-052)**: `player.essayPlaceholder`, `player.charsLeft`, the `<textarea>` and its handler are **untouched**.
  - **Primary failure mode**: an unnecessary edit to the input path riding along with the ceiling raise. **Boundary**: diff review + the existing RTL cases staying green. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (AC-071)**: `TutorPromptInput.questionType` remains the closed union `"mcq" | "true_false" | "short_answer"`.
  - **Primary failure mode**: widening the union to admit `essay`, which would route essay prose into the Gemini prompt. **Boundary**: `npx tsc --noEmit`. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = three files in **one** commit
- [ ] **Quality Complete** = six verify gates green **and** `npm run verify:schema` **fully green on both databases** — including the character-ceiling gate, **whose transition from red to green IS the evidence that this task worked and that H7's known-red window is closed**
- [ ] **Integration Complete** = the raised ceiling is enforced identically in code and in both databases, and Gemini's token cost has not moved (EG-BE-029 asserts the tutor prompt's answer region is still ≤ 500 characters given a 4000-character input)
- [ ] The tutor cap landed **before or with** the raise (Gate H4)
- [ ] `QuestionRenderer.test.tsx:119` moved in the **same commit** as the constant; **`:112` untouched**
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: closes the known-red window for every later commit; the Final Phase audits the whole window from H7 to here.
- Scope boundary — preserve unchanged: `QuestionRenderer.test.tsx:112` (**AC-051**-coupled; Open Item **I-6**, resolved at Task F-D1); `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx` (**no ceiling edit** — D-04); `player.essayPlaceholder`, `player.charsLeft`, the `<textarea>` and its handler (AC-052); the `questionType` union at `prompt.ts:37` (AC-071).
- **D-09 accounting**: `prompt.ts:36` is this task's **single** reason-only site (2 in B1.5, 1 here, 1 in B2.1, 7 in B4.1 = 11).
