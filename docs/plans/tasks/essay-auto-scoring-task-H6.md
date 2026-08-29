# Task H6 — `verify-schema.ts` assertions, written BEFORE anything is relied on

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H6**
Layer: **backend** (`SOURCE/supabase/**`)

Metadata:
- Dependencies: **Task H5**.
- Blocks: **Task H7** (the gates must exist before the DDL is applied — AC-050 asserts the gate's **result**).
- Provides: the two grant assertions, the character-ceiling behavioural probe, and the `ESSAY_MAX_ATTEMPTS` pin gate.
- Size: Small (1 file)
- Verification level: **L2/L3** — the assertions are written and the file runs; they cannot pass against a database that has not received the DDL, which is H7.

## Implementation Content

**Only** `SOURCE/supabase/verify-schema.ts` is modified.

- **Two grant assertions** for the new functions (template: the `record_exam_result` assertions at `:373-388`), distinguishing `42501` from an incidental failure.
- **The character-ceiling gate** as a **two-probe behavioural check discriminating by SQLSTATE**. There is **no** CHECK-constraint read path — `schema_foreign_keys()` filters `contype = 'f'` at `:1233`, and adding a `schema_check_constraints()` function would be a **fourth** DDL, which is exactly what TD-005 warns against.
- **The `ESSAY_MAX_ATTEMPTS` pin gate**: regex-extract the cap literal from the claim function's body in `schema.sql` and compare it to the TypeScript constant, failing with a message **naming both values**.

### `SOURCE/supabase/test-rls.ts` is NOT modified by this plan
**I-1 closed on 2026-08-29** in favour of the runnable service lane, and backend Design Doc **v1.4** records that in three places. The `EG-a…EG-e` obligations live in **Task H8**'s SVC-1/SVC-2 conversion and nowhere else — two homes drift, and the duplicate becomes the one nobody runs. The shipped `S-b` case (`test-rls.ts:1314-1320`, a student JWT cannot `UPDATE exam_results`) stays exactly where it is and is **not** duplicated into the service lane either.

### Hard sequencing rule
AC-050 asserts the **result** of the ceiling gate, so it can only be satisfied after the gate exists. The mandatory order is: **write the assertions → apply the schema to both projects → run the gate → only then ship code that depends on the raised ceiling.** That is why H6 precedes H7 and H7 precedes B3.3.

### Verification of an unverified assumption (R-04)
While running the ceiling probe on **dev**, check the returned SQLSTATE is `23514`. If it is `23503`, switch the probe to a real `attempt_id` from the fixture set and clean up by the probe's own marker — the pattern `verify-schema.ts:40-49` already uses. **Record which shape was needed.** The gate is achievable under either outcome; only the probe's shape changes.

## Target Files
- [ ] `SOURCE/supabase/verify-schema.ts`

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Cổng trần ký tự / D-05 — the two grant assertions, the behavioural probe, the pin gate)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Assumed Behaviors — R-04: the CHECK-before-FK evaluation order is **unverified**, `Confirmed: No`)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 1: the two `service_role`-only functions this gate asserts grants for)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision — enforcement lives in SQL; the bundle scan stands)
- `SOURCE/supabase/verify-schema.ts` (`:40-49` the marker-based cleanup pattern; `:373-388` the `record_exam_result` grant assertions; `:1233` `schema_foreign_keys()` filtering `contype = 'f'`)
- `SOURCE/supabase/schema.sql` (the claim function's body as authored in H5 — the cap literal the pin gate extracts; `:472-474` the widened ceiling pair)
- `SOURCE/lib/scoring/essayLifecycle.ts` (`ESSAY_MAX_ATTEMPTS` — the TypeScript side of the pin)
- `SOURCE/lib/ugc/limits.ts` (`MAX_ATTEMPT_ANSWER` at `:17` — still 500 at this point; it moves in B3.3)
- `SOURCE/supabase/test-rls.ts` (`:1314-1320` — the shipped `S-b` case that **stays where it is** and is not duplicated)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | placement | The band is written in place into `exam_results.per_question` by **two** `service_role`-only `INVOKER` SQL functions — never by a TypeScript `.update()` call site, and never into a separate `essay_grades` table | The two grant assertions target exactly those two functions and assert `service_role`-only execution |
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision) | dependency_direction | Privileged operations are exposed as named operations from `lib/supabase/service-role.ts`; `serviceRoleClient()` stays private; enforcement lives in SQL, not at the call site; `import "server-only"`; the bundle scan stands | The grant assertions verify the SQL-side enforcement rather than a call-site convention |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| ADR-0018 (§ Amendment to ADR-0010) | state-lifecycle-negative | "The append-only property that remains, and that this ADR does not weaken: **no client can write to `exam_results` by any path, and no writer other than `service_role` exists.**" | The two grant assertions fail with a readable message if either function is executable by `public`, `anon` or `authenticated` |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `LIMITS.MAX_ATTEMPT_ANSWER` (TypeScript) → `attempt_answers_answer_check` (Postgres) | **Consumer parse rule**: `verify:schema` probes **behaviourally** and discriminates by SQLSTATE (`23514` check violation vs `23503` foreign-key violation), because no CHECK-constraint read path exists. **Expected signal**: `npm run verify:schema` is **red** when the two ceilings differ, on both databases; code ceiling above DB ceiling means Postgres rejects an entire submission. **This is exactly why H7→B3.3 is a known-red window.** |
| `ESSAY_MAX_ATTEMPTS` (TypeScript) → the cap literal inside `claim_essay_grading_attempt()` | **Consumer parse rule**: `verify-schema.ts` regex-extracts the literal from the function body and compares it to the imported constant. **Expected signal**: the pin gate fails with a message **naming both values**; SVC-2(c) uses the imported constant, never a typed `3`, so this does not become a third copy. |

## Investigation Notes
_(Record here: **which probe shape was needed** (R-04) — `23514` on the first attempt, or `23503` requiring a real `attempt_id` and marker-based cleanup; the exact regex used by the pin gate and the message it produces.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Confirm there is genuinely no CHECK-constraint read path (`schema_foreign_keys()` filters `contype = 'f'` at `:1233`) — the probe is behavioural because of this, not by preference
- [ ] Write the three assertion groups and observe them fail against the current dev database (the DDL is not applied yet — that is H7)

### 2. Green Phase
- [ ] Two grant assertions, following `:373-388`, distinguishing `42501` from an incidental failure
- [ ] The two-probe ceiling gate discriminating by SQLSTATE
- [ ] The `ESSAY_MAX_ATTEMPTS` pin gate, failing with a message naming **both** values
- [ ] Run `npm run verify:schema` against dev; record which assertions pass and which are waiting on H7

### 3. Refactor Phase
- [ ] Run the ceiling probe on **dev** and record the returned SQLSTATE (R-04); if `23503`, switch to a real `attempt_id` and clean by the probe's own marker
- [ ] Confirm `SOURCE/supabase/test-rls.ts` is **untouched**
- [ ] Confirm no fourth DDL object was added to support the gate

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run verify:schema` — Enforces: grants on both new functions; the character ceiling read back from a real DB; the schema fingerprint; the `ESSAY_MAX_ATTEMPTS` pin — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/supabase/**`. **This task is what makes the ceiling assertion exist at all** — today the script asserts nothing about the ceiling.

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
| 8 | `npm run verify:schema` | | Gate E3 — this task's file matches `SOURCE/supabase/**`. Cannot pass against a database that has not received the DDL; that is Task H7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run `npm run verify:schema` against **dev** and read each assertion's outcome individually; run the ceiling probe and record the returned SQLSTATE.
- **Success criteria**: the two grant assertions and the ceiling gate exist and fail **for the stated reason** before H7 (functions absent / ceiling not yet moved), not for an incidental one; the pin gate's failure message names both the SQL literal and the TypeScript constant; the R-04 SQLSTATE outcome is recorded.
- **Failure response**: if the probe returns `23503` rather than `23514`, switch to a real `attempt_id` from the fixture set and clean up by the probe's own marker (the `verify-schema.ts:40-49` pattern) — **do not** add a `schema_check_constraints()` function; that would be a fourth DDL, exactly what TD-005 warns against.
- **Verification level**: **L2/L3** — the assertions are written and run; passing them requires H7.

## Proof Obligations
- **Claim (EG-BE-028)**: `LIMITS.MAX_ATTEMPT_ANSWER` equals the DB ceiling on **both** databases, and `verify:schema` is **red** when they differ.
  - **Primary failure mode** (Failure Mode Checklist: **no-op**): the ceiling gate does not exist before the ceiling moves, so AC-050 — which asserts the gate's **result** — is unsatisfiable, and a code-above-DB mismatch ships unnoticed, making Postgres reject an entire submission.
  - **Boundary to exercise**: the real dev/prod databases, through a **behavioural probe** discriminating by SQLSTATE — there is no read path for CHECK constraints.
  - **State assertion**: the probe inserts a row that must be rejected and, if a real `attempt_id` shape is needed, deletes it by its own marker. Before → no probe row; after → no probe row.
  - **Mock boundary rationale**: none. A mocked database is precisely what cannot answer "what is the ceiling actually stored as".
  - **Residual**: EG-BE-013 (a student JWT refused on **both** functions) is **not** discharged here — it is Task H8's SVC-2(g).
- **Claim (the pin gate)**: the SQL cap literal and `ESSAY_MAX_ATTEMPTS` are the same number, and the gate says so by naming both.
  - **Primary failure mode** (Failure Mode Checklist: **shared-state dependency**): the one unavoidable double declaration drifts, and the cap enforced in SQL differs from the cap the UI and tests assume — with no third copy to notice.
  - **Boundary to exercise**: a regex extraction from `schema.sql` compared against the imported TypeScript constant.
  - **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: proves the two agree; SVC-2(c) additionally asserts the test itself imports the constant rather than typing `3`.

## Completion Criteria
- [ ] **Implementation Complete** = assertions written
- [ ] **Quality Complete** = six verify gates green
- [ ] **Integration Complete** = deferred to Task H7 (the gates cannot pass against a database that has not received the DDL)
- [ ] R-04 recorded: the ceiling probe's actual SQLSTATE behaviour, and the probe shape adjusted if it was `23503`
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: H7 runs these gates against both databases; B3.3's completion evidence is the ceiling assertion turning **green**.
- Scope boundary — preserve unchanged: `SOURCE/supabase/test-rls.ts` (**not modified by this plan**; the `S-b` case at `:1314-1320` stays and is not duplicated); `SOURCE/supabase/schema.sql` (H5 owns it — **no fourth DDL object** is added to support this gate).
- H6 no longer carries any part of the `EG-a…EG-e` obligations — I-1 closed 2026-08-29, and they live in Task H8 only.
