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
- [x] `SOURCE/lib/tutor/prompt.ts` — `TUTOR_MAX_STUDENT_ANSWER` declared separately, slice enforced inside `buildTutorPrompt()`, the `:36` reason corrected
- [x] `SOURCE/lib/ugc/limits.ts` — `MAX_ATTEMPT_ANSWER` 500 to 4000, comment rewritten with the asymmetry
- [x] `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` — `maxLength` pin to 4000, comment corrected; **`:112` untouched**
- [x] `SOURCE/lib/tutor/__tests__/prompt.test.ts` — **extra, required by this task's own Red phase** ("write the EG-BE-029 case and observe it fail"); the case has to live somewhere and the Target Files list omitted it

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

### Audit of the known-red window — the ceiling was the only red assertion, throughout
Required before this commit removes the signal. Walked the Gate E4 records from H7 to here:

| Task | `verify:schema` record |
|---|---|
| H7 | Window opened. Every assertion green **except** the ceiling gate |
| B1.5 | exit 1, exactly 1 failing assertion: the ceiling |
| B1.6 | exit 1, exactly 1 — named in full: *"TRẦN DB CAO HƠN TRẦN TRONG MÃ ... = 500"* |
| B2.1 | exit 1, exactly 1: the ceiling |
| B2.2 | exit 1, exactly 1: the ceiling (`500` vs a DB ceiling of `4000`) |
| B2.3 | exit 1, exactly 1: the ceiling |
| B2.4 | exit 1, exactly 1: the ceiling |
| B3.1 | not run — touches no schema and no `LIMITS` constant |
| B3.2 | not run — same reason |

**No assertion other than the ceiling was ever red**, so nothing was being masked. Two runs in the window exited 1 with **zero** failing assertions and `fetch failed` (B1.5, B2.1) — the documented network signature on this machine, not a schema regression; both were re-run.

Confirmed live immediately before the change: dev exited **1** with that one assertion and nothing else.

### The completion evidence, and one assertion that could not run until now
After the constant moved, dev `verify:schema` exits **0**, fully green. Two lines changed together, and the second is the more interesting one:

- *"Bài làm dài đúng trần (4000 ký tự) QUA được CHECK"* — was `(500 ký tự)`, still green.
- *"Bài làm quá trần một ký tự (4001) bị `attempt_answers_answer_check` TỪ CHỐI (23514)"* — **this assertion could not pass at all during the window.** With code at 500 and the DB at 4000, the probe at 501 sailed through the CHECK and died on the foreign key (`23503`), which is precisely what the gate reported as failure. It now probes at 4001 and gets the real `23514`. So the gate is not merely quiet — it is exercising the constraint again.

### CORRECTION — this task's prod requirement was never achievable as written
The task asks for *"`verify:schema` fully green on **both** databases, including the character-ceiling assertion"*. **On prod that is impossible by design, and the script says so itself.** The engineer ran it on 2026-08-30; the output:

```
Target: pebjdlbgbmizgfpuptjl — KHÔNG phải dev. Chạy PHẦN: chỉ các khẳng định ĐỌC.
  ⊘ BỎ QUA (target không phải dev): hai probe trần ký tự (4000 và 4001 ký tự)
    — cả hai PHÁT lệnh INSERT vào attempt_answers
```

The ceiling gate is a **behavioural** probe: it INSERTs at the ceiling and one character past it and discriminates by SQLSTATE, because no CHECK-constraint *read* path is used. `BEHAVIOURAL_PROBE_ALLOWED_REFS` is an allowlist containing dev only, so every write-probe is skipped on prod — deliberately, since these probes write to a production table. **No amount of running the script on prod will ever turn that assertion green.**

The script names the correct substitute in its own closing line: *"hoặc kiểm bằng truy vấn catalog trực tiếp"* ("or check by direct catalog query"). That is exactly what was done: `pg_get_constraintdef` on `attempt_answers_answer_check` returns

```
CHECK (((answer IS NULL) OR (length(answer) <= 4000)))
```

**byte-identical on prod (`pebjdlbgbmizgfpuptjl`) and dev (`hynwleaxtbtjzkvpjsug`)**. EG-BE-028's actual claim — the two ceilings are equal on both databases — is therefore **settled**, by the route the tooling itself prescribes rather than by a workaround.

What the prod run *did* confirm, all green: column classification, all 27 foreign keys and their `on delete`, **the schema fingerprint `9979c9deea52` matching git and dev** (TD-005 satisfied on prod), subject canonicalisation, the `ESSAY_MAX_ATTEMPTS = 3` pin, and anon `EXECUTE` denial on both answer-key functions.

**Consequence for the plan**: any later task or gate that says "verify:schema fully green on both databases" should read "fully green on dev; read-assertions green on prod, ceiling confirmed by catalog query". The Final Phase audit should not go looking for a green prod ceiling line that cannot exist.

### EG-BE-029 measured, not asserted in the abstract
Uncapped, a `short_answer` prompt built from a 4000-character answer measured **4807 characters** (observed in the Red run). Capped, the answer region is exactly `TUTOR_MAX_STUDENT_ANSWER` = 500 characters, counted on the prompt string itself. Five cases: the cap, the cap living *inside* `buildTutorPrompt()` (the caller passes raw DB text and still cannot exceed it), passthrough for a normal answer, passthrough at exactly the boundary, and the decoupling assertion.

### The decoupling is what the test pins — not the number
`prompt.ts` deliberately does **not** import `LIMITS.MAX_ATTEMPT_ANSWER`. The two constants answer different questions owned by different budgets: one is *how much a student may write* (must match Postgres), the other is *how many tokens we send to Gemini* (`ai:budget:`, not `groq:budget:`). They were coincidentally equal until today. The last EG-BE-029 case asserts `TUTOR_MAX_STUDENT_ANSWER !== LIMITS.MAX_ATTEMPT_ANSWER`, so a future "cleanup" that makes `prompt.ts` import the DB ceiling turns red — which is exactly when a deliberate review is wanted, because the next ceiling raise would otherwise land straight on the Gemini bill. This raise alone would have been **8×**.

### The ripple travels through `short_answer`, never `essay`
The `questionType` union excludes `essay` at the type level, so essay prose never reaches the tutor. The exposed path is `short_answer`: its input is capped at `LIMITS.MAX_SHORT_ANSWER = 100` **on the client**, but `submitExam` slices with `MAX_ATTEMPT_ANSWER` (`actions.ts:146`), so a hand-made request stores 4000 characters that reach the prompt when the student presses "Giải thích bước này". A client cap is not a server cap. The EG-BE-029 fixtures use `short_answer` for that reason.

### `prompt.ts:36` — the reason was false, the value was right (D-09)
The comment read *"essay bị loại: không bao giờ được chấm"* ("never graded"). After ADR-0018 that is simply untrue — essays are auto-graded and carry a band. The **exclusion still stands**, on a different and now-correct reason: the tutor opens only for wrong-twice questions, and `wrongTwice` reads `isCorrect`, a **binary** predicate. An essay has no `isCorrect` — it has a continuous band and a lifecycle state — so "wrong twice" is not statable for it. Widening the union would also route a student's prose into Gemini, a second provider on a second budget key, for work Groq has already graded.

### D-04 confirmed by inspection, not assumed
`QuestionRenderer.tsx` needed **no** ceiling edit and has **no** diff: `:23` aliases the constant and both `:194` (`maxLength`) and `:202` (the `charsLeft` arithmetic) read the alias. There is no second literal to drift, so AC-049 holds by construction.

### `:112` untouched (I-6)
The diff on `QuestionRenderer.test.tsx` starts at line 113 and touches only the comment and the `maxLength` pin. The AC-051 footnote-string pin is unchanged — it fails at a different time, for a different reason, and is resolved at Task F-D1.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] **Window audited** — table in Investigation Notes. The ceiling was the only red assertion at every commit; nothing was masked. Confirmed live before the change: dev exit **1**, exactly one failing assertion
- [x] Read all Investigation Targets and recorded key observations
- [x] **Adjacent cases swept**: the `maxLength` pin and its comment (both moved), `:194`/`:202` reading the `:23` alias (no edit needed — verified by an empty diff on the renderer), and `actions.ts:146`'s server-side slice (the reason the ripple is real)
- [x] EG-BE-029 written first and **observed red**: `3 failed | 5 passed`, including *"expected 4807 to be less than 4000"* — the uncapped prompt length, measured

### 2. Green Phase
- [x] `prompt.ts`: constant declared separately (**no import of `LIMITS`**), slice enforced inside `buildTutorPrompt()`, the `:36` reason corrected, union left closed
- [x] `limits.ts`: 500 to 4000, comment rewritten to carry the **asymmetry** (code below DB truncates and is recoverable; code above DB makes Postgres reject an entire submission)
- [x] `QuestionRenderer.test.tsx`: pin at 4000, comment corrected
- [x] `13 passed (13)` across both affected files, exit **0**

### 3. Refactor Phase
- [x] dev `verify:schema` **fully green, exit 0** — window closed on dev. Prod ceiling confirmed byte-identical read-only; the full prod script run is still owed (see Gate row 8b)
- [x] `:112` **untouched** — the diff begins at line 113
- [x] `QuestionRenderer.tsx` needed **no** edit and has **no** diff

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
| 1 | `npx tsc --noEmit` | **0** | Also the AC-071 gate: the `@ts-expect-error` fixture for `questionType: "essay"` still errors, so the union stayed closed |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 135 files passed / 1 skipped; **1950 passed, 10 skipped, 0 todo** (was 1945 — **+5** EG-BE-029 cases), 45.7 s |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline ONLY**: exactly 2 failures, both `subscription.fixture.e2e.test.ts > FE-1 (e) ... > locale en` and `locale vi`, named individually from the run. CRLF churn on `RichText.regression.test.tsx.snap` reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — **Task H8**, still open) |
| 8a | `npm run verify:schema` (dev) | **0** | **FULLY GREEN — this is the completion evidence.** The ceiling assertion flipped red to green, and a *second* assertion that could not run before now runs and passes: *"Bài làm quá trần một ký tự (4001) bị attempt_answers_answer_check TỪ CHỐI (23514)"*. H7's known-red window is **closed on dev** |
| 8b | `verify:schema` (prod) | **0 — PARTIAL PASS** | Run by the engineer 2026-08-30. **The ceiling assertion cannot be run on prod at all, by design** — see the correction below |

**Pre-change state captured before the signal was removed** (required by this task's own entry condition): `npm run verify:schema` on dev exited **1** with **exactly one** failing assertion — *"TRẦN DB CAO HƠN TRẦN TRONG MÃ ... LIMITS.MAX_ATTEMPT_ANSWER = 500"*. Every other assertion green, including both grant assertions, the fingerprint comparison (`9979c9deea52`), and the two new essay functions.

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
- [x] **Implementation Complete** = the three files (plus the test file the Red phase requires) in **one** commit
- [x] **Quality Complete** = six gates green, `test:fixture` at the TD-030 baseline, and `verify:schema` **fully green on dev** — the ceiling gate's red-to-green transition is recorded, and a second assertion that could not run during the window now runs and passes. Prod run completed by the engineer: **PARTIAL PASS, all read assertions green**; the ceiling probe is skipped on prod **by design** and was closed by catalog query instead (see the correction in Investigation Notes)
- [x] **Integration Complete** = the ceiling is 4000 in code and 4000 on **both** databases (`pg_get_constraintdef`, byte-identical), and Gemini's token cost has **not** moved — EG-BE-029 holds the answer region at 500 characters given a 4000-character input
- [x] The tutor cap landed **with** the raise, in this one commit (Gate H4)
- [x] The `maxLength` pin moved in the **same commit** as the constant; **`:112` untouched**
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: closes the known-red window for every later commit; the Final Phase audits the whole window from H7 to here.
- Scope boundary — preserve unchanged: `QuestionRenderer.test.tsx:112` (**AC-051**-coupled; Open Item **I-6**, resolved at Task F-D1); `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx` (**no ceiling edit** — D-04); `player.essayPlaceholder`, `player.charsLeft`, the `<textarea>` and its handler (AC-052); the `questionType` union at `prompt.ts:37` (AC-071).
- **D-09 accounting**: `prompt.ts:36` is this task's **single** reason-only site (2 in B1.5, 1 here, 1 in B2.1, 7 in B4.1 = 11).
