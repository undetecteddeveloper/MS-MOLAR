# Task B3.1 — Telemetry: one event type, three error codes, all seven coupled sites

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B3 (Retry, Telemetry and the Ceiling Ripple, vertical slice V3), Task B3.1**
Layer: **backend** (`SOURCE/lib/tutor/**`, `SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task H7** (the widened CHECKs must be live, or every grading telemetry write fails **silently**), **Task B1.4** (this task edits `gradeEssays.ts`, which B1.4 creates).
- Blocks: **Tasks B3.2, B3.3**.
- Provides: `'essay_grade'` plus three error codes, consistent across all seven coupled sites, and this feature's telemetry call sites in `gradeEssays.ts`.
- Size: Small (3 files)
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
- [ ] `SOURCE/lib/tutor/telemetry.ts`
- [ ] `SOURCE/lib/tutor/__tests__/telemetry.test.ts`
- [ ] `SOURCE/lib/essay/gradeEssays.ts`

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
_(Record here: the before/after of all three test pins; confirmation that `buildTelemetryPayload()`'s body and its `EXPECTED_COLUMNS` test are unchanged; the error-code mapping used for each `gradeEssays.ts` branch.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): enumerate all seven sites and confirm the two SQL ones already landed in H5/H7
- [ ] Update the three test pins **first** and observe the suite go red (6 ≠ 9; the allowlist missing `'essay_grade'`)

### 2. Green Phase
- [ ] Add `'essay_grade'` to `TelemetryEventType` and the three codes to `TELEMETRY_ERROR_CODES`
- [ ] Wire the telemetry call sites in **`gradeEssays.ts` only**, through the **student's** client
- [ ] Run only the affected tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm `buildTelemetryPayload()`'s body still assigns exactly six columns and its exhaustive test keeps its shape
- [ ] Confirm `telemetry_log` gained **no** column
- [ ] Confirm the resolution limit is recorded **both** in the work plan and in a code comment: `(user, question, day)`, **not** per attempt
- [ ] Confirm `essayActions.ts` was **not** touched

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
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |
| 7 | `npm run check:bundle` | | Gate E2 — this task edits `SOURCE/lib/essay/gradeEssays.ts` |

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
- [ ] **Implementation Complete** = seven sites consistent
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = a real `event_type = 'essay_grade'` row is accepted on dev (verified in **H7 step 5**)
- [ ] The telemetry resolution limit is stated in **this plan and in the code comment** — `(user, question, day)`, **not** per attempt
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B3.2 uses these codes for `essayActions.ts`'s own call sites (I007).
- Scope boundary — preserve unchanged: `buildTelemetryPayload()`'s body and its exhaustive six-column test; `telemetry_log`'s columns (**no new column** — Escalation 2); `SOURCE/app/(layer2)/essayActions.ts` (**does not exist yet** — Task B3.2 creates it and wires its own telemetry).
- The `service_role` cannot write this telemetry: `telemetry_insert_own` is `with check (user_id = auth.uid())`, so the write goes through the **student's** client.
