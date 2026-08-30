# Task B3.1 — Telemetry call sites in `gradeEssays.ts` (the literals already landed in H5)

> ## ⚠️ SCOPE REDUCED 2026-08-29 — read this before doing anything
>
> **The telemetry LITERALS are already committed.** They moved into **Task H5** (commit `2448179`) — `TelemetryEventType += 'essay_grade'`, `TELEMETRY_ERROR_CODES` 6 → 9 (`groq_unavailable`, `invalid_output`, `duplicate_write`), and the pins in `telemetry.test.ts` (`:49`, `:265`) and `schemaFingerprint.test.ts` (`:133`).
>
> **Why they moved forward.** An **eighth** coupled site exists that no enumeration named: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` is the only test that actually **reads** `schema.sql` and parses its `error_code` lists, so widening the SQL lists 6 → 9 turned three of its assertions red **inside H5**. Its own failure message reads *"Sửa CẢ BA chỗ trong cùng một commit: hai danh sách SQL + `lib/tutor/telemetry.ts`"* — a guard shipped before this feature was already enforcing the one-commit rule, which this plan's H5/B3.1 split contradicted.
>
> **What this task still owns:** wiring the telemetry **call sites** in `gradeEssays.ts`. Nothing else.
>
> **Do NOT re-add the literals.** They are present and pinned. Re-adding produces a duplicate union member or a doubled array entry, and the exhaustive `toEqual` pins will go red.
>
> Backend Design Doc **v1.9** (§ D-06, now **eight** sites) and the work plan's **Gate H5** both record this.

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B3 (Retry, Telemetry and the Ceiling Ripple, vertical slice V3), Task B3.1**
Layer: **backend** (`SOURCE/lib/tutor/**`, `SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task H7** (the widened CHECKs must be live, or every grading telemetry write fails **silently**), **Task B1.4** (this task edits `gradeEssays.ts`, which B1.4 creates).
- Blocks: **Tasks B3.2, B3.3**.
- Provides: this feature's telemetry **call sites** in `gradeEssays.ts`. *(The `'essay_grade'` event type and the three error codes are already live — landed in Task H5, commit `2448179`.)*
- Size: **Very small (1 file)** — reduced from 3; two of the three landed in H5.
- Verification level: **L2**; a real `essay_grade` row was already accepted on dev during H7 step 5.

## Change Category
`Change Category: boundary-change`

The telemetry literal set is a contract duplicated across **seven** sites — two SQL inline declarations, two SQL drop/add pairs, two TypeScript constants and three test pins. Adjacent cases swept: the two SQL sites already landed in H5/H7; the three TypeScript sites move here.

## Implementation Content

- `SOURCE/lib/tutor/telemetry.ts`: add `'essay_grade'` to `TelemetryEventType` (`:40`); add `groq_unavailable`, `invalid_output`, `duplicate_write` to `TELEMETRY_ERROR_CODES` (`:35`, **6 → 9**).
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts`: update the **three** test pins — the hand-copied `SCHEMA_ERROR_CODES` (`:49`), the `event_type` allowlist in the "shape" case (`:265`), and the per-element equality (`:311`).
- `buildTelemetryPayload()`'s body is **unchanged** and still assigns exactly six columns (`:92-101`); its exhaustive `EXPECTED_COLUMNS` test keeps its shape. **`telemetry_log` gains no column** (ADR-0018 Escalation 2).
- Wire the call sites in **`gradeEssays.ts` only**, writing through the **student's** client. *(RLS: `telemetry_insert_own` is `with check (user_id = auth.uid())`, so a `service_role` write with a null `user_id` is rejected outright.)*

### `essayActions.ts` does not exist yet and is not touched here (I007, fixed 2026-08-29)
It is created in **Task B3.2**, which depends on this task; wiring it from here would be a forward reference into a file that has not been written. Its telemetry call sites are wired **inside B3.2**, using the codes this task adds.

### Record the resolution limit in the plan, not only in code
ADR-0018 Escalation 2 requires this **in prose**: `telemetry_log` has no `attempt_id`, and grading attempts are keyed `(attempt_id, question_id)`. A duplicate-write rejection is therefore attributable to **`(user, question, day)` and not to a specific attempt** — two rejections on the same question by the same student on the same day are indistinguishable. Recorded rather than hidden, because the failure mode is a future session reading a rejection count and inferring a per-attempt rate from it. Affordable because a refused duplicate is a **rare diagnostic signal, not a metric anyone counts** — it fires only in the AC-063 race.

## Target Files
- [x] `SOURCE/lib/tutor/telemetry.ts` — **comments only**; the literals were already present from H5. Two stale reasons fixed (see Investigation Notes)
- [x] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` — **unchanged**: all three pins already updated in H5 and already green
- [x] `SOURCE/lib/essay/gradeEssays.ts` — the telemetry call sites (this task's actual scope)
- [x] `SOURCE/lib/essay/__tests__/gradeEssays.test.ts` — **extra**: 26 new cases for the branch→code mapping, the write path and the best-effort guarantee
- [x] `SOURCE/app/(layer2)/actions.ts` — **extra, named by `tsc`**: passes `attempt.user_id` into the new required `GradePassInput.userId`. Reason in Investigation Notes

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `telemetry.ts`: `TelemetryEventType` gains `'essay_grade'`; `TELEMETRY_ERROR_CODES` gains three codes)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 2 / D-06 — the **seven** coupled sites)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Security Considerations — `telemetry_log` carries structured codes only; the three console-logging rules)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Error Handling — a refused duplicate is a **return value**, not an exception)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — Escalation 2, the degraded telemetry resolution this feature accepted)
- `SOURCE/lib/tutor/telemetry.ts` (`:35` `TELEMETRY_ERROR_CODES`; `:40` `TelemetryEventType`; `:75-79` the runtime filter; `:92-101` `buildTelemetryPayload()` — **unchanged**)
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49` `SCHEMA_ERROR_CODES`; `:265` the `event_type` allowlist; `:311` the per-element equality; the exhaustive `EXPECTED_COLUMNS` case)
- `SOURCE/supabase/schema.sql` (`:1383`, `:1390-1399`, `:1818-1821` and the new `event_type` pair — the two SQL sites already landed in H5/H7)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — the branch outcomes that map to each error code)

## Reference Contracts

*(No Reference Contract Values row is scoped to this task; the literal sets themselves are carried by Gate C's recorded definitions and by the Connection Map row below.)*

## Boundary Context (from the work plan's Connection Map)

| Boundary | TypeScript telemetry literals → `telemetry_log` CHECK constraints |
|---|---|
| Owner (left) | `SOURCE/lib/tutor/telemetry.ts` (`TelemetryEventType`, `TELEMETRY_ERROR_CODES`) |
| Owner (right) | `public.telemetry_log` CHECKs on `event_type` and `error_code` |
| Serialized format | Literal string sets duplicated across **seven** sites (two SQL inline, two SQL drop/add pairs, two TypeScript constants, three test pins) |
| Consumer parse rule | Postgres rejects any value outside the CHECK; the runtime filter in `buildTelemetryPayload()` reads the **same** TypeScript constant |
| Expected signal | A `service_role` insert of `event_type = 'essay_grade'` on dev succeeds and is then deleted (verified in H7 step 5); the exhaustive `toEqual` and per-element equality pins in `telemetry.test.ts` stay green |

Roundtrip check this task owns: every literal the TypeScript constant admits is a literal the live CHECK accepts — on **both** databases.

## Investigation Notes

### The three test pins were already updated — verified by reading, not by trusting the note
`telemetry.ts` already carried `'essay_grade'` in `TelemetryEventType` and all nine `TELEMETRY_ERROR_CODES`; `telemetry.test.ts` already carried all three pins. **Nothing was re-added** — doing so would have produced a duplicate union member and a doubled array entry, turning the exhaustive `toEqual` pins red. `buildTelemetryPayload()`'s body is untouched: still exactly six named column assignments, and `telemetry_log` gained no column (Escalation 2).

### Error-code mapping actually implemented (from § Error Handling + § Logging, not from the handoff note)

| `gradeEssays.ts` branch | `success` | `error_code` |
|---|---|---|
| blank answer, settle `graded` accepted | `true` | `null` |
| settle `graded` accepted | `true` | `null` |
| settle returns `written: false` (AC-063 race) | `false` | `duplicate_write` |
| **blank answer, settle returns `written: false`** | `false` | `duplicate_write` |
| budget refused `project_budget` | `false` | `project_budget_exhausted` |
| budget refused `unavailable` | `false` | `server` |
| provider `kind: rate_limited` | `false` | `rate_limited` |
| provider `kind: provider` / `timeout` / `transport` | `false` | `groq_unavailable` |
| `parseGrade()` returns `ok: false` | `false` | `invalid_output` |
| unexpected exception | `false` | `server` |
| **claim refused** | *(no telemetry row at all)* | — |

**One deviation from the handoff note, taken from the Design Doc.** The note listed the blank-answer branch as unconditionally `success true, no code`. The Design Doc defines `success` as *"`true` khi và chỉ khi settle được `graded`"*, and the blank branch calls the **same** `recordEssayGrade(… 'graded' …)` through the **same** first-write-wins predicate, so it can return `written: false` in the same AC-063 race — the pre-existing code already had an explicit `if (!blank.written)` log for it. Treating that as `success: true` would write a success row for a pass that wrote nothing. The uniform rule is implemented and pinned by its own test case.

`success` is **derived** from `errorCode === null` rather than passed as a second parameter — the two can only ever agree, and two independent parameters is where they would drift.

### `actions.ts` is a fourth file the Target Files list did not name
Telemetry needs `user_id`, and the Design Doc requires it come from the `exam_attempts` row **already read through RLS**, not a fresh `auth.getUser()`. So `GradePassInput` gains `userId: string` and `submitExam()` passes `attempt.user_id`. `submitExam()` had **already** read that column and already carried the written-out reason for preferring it over `auth.getUser()` (its own rate-limit key) — so this reuses an existing argument rather than introducing one. `npx tsc --noEmit` named the file. This is the **fourth** consecutive task needing one file beyond its list (B2.1, B2.2, B2.3, B3.1).

### Two stale comments in `telemetry.ts` — the reason fixed, not the value
1. `questionId`'s `"Chỉ có ở 'tutor_invoke'"` became false the moment `essay_grade` writes one. Restated by **criterion** ("event types that work on one specific question") so a future event type does not require re-editing the line.
2. The module header's "DÙNG CHUNG" rule named exactly **two** writers by name; there are now three. Restated as a criterion for the same reason — this is the comment whose whole job is to stop a fourth writer from hand-rolling an insert.

### Mutation testing — five mutants, and one found a real hole in a test
Nine of the 26 new cases passed during the Red phase (they assert *absence*, and nothing wrote telemetry yet), so mutation testing is the evidence for those.

| # | Mutation | Result |
|---|---|---|
| M1 | claim-refused branch emits a `not_eligible` row | **Killed** — 3 failed |
| M2 | `log(… error.message)` instead of `error.code` | **Killed** — 1 failed (the AC-056 leak case) |
| M3 | `recordGradeTelemetry` rethrows instead of swallowing | **SURVIVED**, then killed — see below |
| M4 | extra field added to the `buildTelemetryPayload()` argument | **Survived, correctly** — the builder assigns six named columns and drops unknown keys; that *is* the barrier, and M5 is the mutation that actually tests it |
| M5 | payload spread *around* the builder to smuggle a 7th column | **Killed** — 2 failed |

**M3 is the one worth recording.** The best-effort test as first written (`mockRejectedValueOnce`, **two** targets) could not fail, for two compounding reasons: two targets with `GROQ_MAX_CONCURRENCY = 2` gives each question its **own worker**, so one worker dying is invisible; and a one-shot rejection is absorbed by the second telemetry call inside `gradeOne`'s own `catch`. The test was rewritten to **four** targets with a **persistent** rejection, which exposes the real consequence: an escaping observability write kills its worker's `for(;;)` loop and the remaining questions in that worker's queue are **never graded** — a telemetry fault turning into lost marks. M3 then failed. The reasoning is recorded in the test body.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] **Sweep the adjacent cases** (Change Category: boundary-change): all seven sites enumerated; the two SQL sites and the three TypeScript sites confirmed already landed in H5/H7 by **reading the files**
- [x] Test pins already updated in H5 — nothing re-added. Red was produced instead by the **new call-site tests**: `18 failed / 35 passed`, exit **1**

### 2. Green Phase
- [x] **Not re-added** — already live from H5 (re-adding would double the array and redden the exhaustive pins)
- [x] Telemetry call sites wired in `gradeEssays.ts`, through the **student's** client; `GradePassInput` gained `userId`
- [x] `53 passed (53)`, exit **0**

### 3. Refactor Phase
- [x] `buildTelemetryPayload()` body untouched — six named assignments; its exhaustive test unchanged and green. A new test asserts the **written** payload's key set is exactly those six
- [x] `telemetry_log` gained **no** column
- [x] Resolution limit recorded in the work plan (line 298) **and** in the `recordGradeTelemetry()` doc comment: `(user_id, question_id, day)`, **not** per attempt
- [x] `essayActions.ts` **not** touched — it does not exist yet; Task B3.2 creates it

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the telemetry `satisfies` table — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the three test pins and the exhaustive column test — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**` (this task edits `gradeEssays.ts`)
- `telemetry_log` CHECK constraints — Enforces: `event_type` / `error_code` accept closed literal sets only — Config: `schema.sql:1383`, `:1390-1399`, `:1818-1821` + the new `event_type` pair

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | Named the missing `userId` at the `actions.ts` call site — the **fourth** consecutive task whose Target Files list was one file short (after B2.1, B2.2, B2.3) |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 134 files passed / 1 skipped; **1902 passed, 10 skipped, 0 todo** (was 1876 — **+26** net: 27 new cases in `gradeEssays.test.ts`, one pre-existing case rewritten in place), 46.4 s |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline ONLY**: exactly 2 failures, both `subscription.fixture.e2e.test.ts > FE-1 (e) … > locale en` and `locale vi`. Named individually from the run, not inferred from the count. Neither file imports anything this task touched. Left CRLF churn on `RichText.regression.test.tsx.snap` (content-identical, `git diff --numstat` empty) — reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — **Task H8**, still open) |
| 7 | `npm run check:bundle` | **0** | 8 server-only secrets confirmed absent from the client bundle |

`npm run verify:schema` was **not run** for this task — it touches no schema and no `LIMITS` constant. Its character-ceiling assertion remains red by design in the H7 → B3.3 window (Fix I002).

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method**: run the default vitest lane with all three pins updated; confirm `buildTelemetryPayload()`'s exhaustive column test is unchanged and green; confirm (from H7 step 5's record) that a real `event_type = 'essay_grade'` row is accepted on dev.
- **Success criteria**: all seven sites consistent; `TELEMETRY_ERROR_CODES` at nine values; the three pins green; the payload builder untouched; `telemetry_log` gains no column.
- **Failure response**: a missing **TypeScript** site turns CI red — loud, and fixable. A missing **SQL** site is the **TD-005 shape**: correct in git, absent from every database, and **silent**, because the telemetry write is best-effort. If a grading telemetry write is rejected on dev, return to Task H5/H7 rather than adding a client-side filter.
- **Verification level**: **L2**.

## Proof Obligations
- **Claim (AC-054)**: each grading attempt writes one `telemetry_log` row with `event_type = 'essay_grade'` and, on failure, a **structured** `error_code` from the closed set.
  - **Primary failure mode**: missing one TypeScript site ⇒ CI red (loud); **missing both SQL sites ⇒ the TD-005 shape with silent failure**, because the telemetry write is best-effort. **Boundary**: in-process for the constant sets; the live CHECK for the SQL half (verified at H7 step 5). **State assertion**: a row is written per attempt; on failure it carries a code. **Mock rationale**: the Supabase client is mocked at its sanctioned boundary for the unit assertions; the real acceptance was proven on dev in H7. **Residual**: this task does not re-apply DDL; if the CHECK were not widened, the write fails silently — which is why H7 is a dependency.
- **Claim (AC-056)**: telemetry carries **structured codes only** — never the student's essay text, never the model's prose, never an exception message.
  - **Primary failure mode**: a free-text field appearing on the event type, or the runtime filter drifting from the constant. **Boundary**: in-process — enforced **twice**: the `TelemetryEvent` type has **no field able to hold free text**, and the runtime filter at `:75-79` re-checks against the **same** constant. **State assertion**: the written payload's key set. **Mock rationale**: client mocked at its boundary. **Residual**: the `digest`-only rule at the Server Action boundary is B3.2's.
- **Claim (Gate H5)**: all seven sites move together; the two SQL sites already landed in H5/H7.
  - **Primary failure mode**: a partial move leaving git and the databases disagreeing. **Boundary**: enumeration + the live CHECK. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (the three console-logging rules)**: `gradeEssaysForAttempt` logs `questionId` + a structured code only.
  - **Primary failure mode**: a provider error message echoing the student's writing into a server log. **Boundary**: in-process with a spied `console.error`. **State assertion**: N/A. **Mock rationale**: `console.error` spied. **Residual**: none.
- **Claim (the recorded resolution limit)**: a duplicate-write rejection is attributable to `(user, question, day)` and **not** to a specific attempt.
  - **Primary failure mode**: a future session reading a rejection count and inferring a per-attempt rate from it. **Boundary**: documentation — recorded in the work plan **and** in a code comment. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the limit is accepted, not removed; `telemetry_log` gains no column (Escalation 2).

## Completion Criteria
- [x] **Implementation Complete** = seven sites consistent (two SQL + two TypeScript from H5/H7, three test pins already green, call sites landed here)
- [x] **Quality Complete** = all seven gates run **separately with real exit codes**; six at 0, `test:fixture` at 1 with the TD-030 baseline pair named individually
- [x] **Integration Complete** = a real `event_type = 'essay_grade'` row was accepted on dev in **H7 step 5**. *(This is inherited evidence, not a fresh run: no live grading pass has yet written a row through this code — that is the still-open L1 dev run, which also gates B1.5 and B2.1.)*
- [x] The telemetry resolution limit is stated in the work plan **and** in the code comment — `(user_id, question_id, day)`, **not** per attempt
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B3.2 uses these codes for `essayActions.ts`'s own call sites (I007).
- Scope boundary — preserve unchanged: `buildTelemetryPayload()`'s body and its exhaustive six-column test; `telemetry_log`'s columns (**no new column** — Escalation 2); `SOURCE/app/(layer2)/essayActions.ts` (**does not exist yet** — Task B3.2 creates it and wires its own telemetry).
- The `service_role` cannot write this telemetry: `telemetry_insert_own` is `with check (user_id = auth.uid())`, so the write goes through the **student's** client.
