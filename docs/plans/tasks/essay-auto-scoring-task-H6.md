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
- [x] `SOURCE/supabase/verify-schema.ts`

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

### Investigation Targets — key observations (Step 2)
- `docs/design/essay-auto-scoring-backend-design.md` § Cổng trần ký tự — gives the P1/P2 table verbatim (P1 = `MAX_ATTEMPT_ANSWER` → expect `23503`; P2 = `+1` → expect `23514`) and the four properties that make the behavioural probe the right mechanism. § Assumed Behaviors line 197 records the CHECK-before-FK order as `Confirmed: No`.
- `docs/adr/ADR-0018` § Decision 1 — two-parameter signature for `claim_essay_grading_attempt()`, which is *why* the cap literal cannot be passed in and must be pinned. § Amendment to ADR-0010 — "no writer other than `service_role` exists".
- `SOURCE/supabase/schema.sql` — `schema_foreign_keys()` filters `c.contype = 'f'` (now at `:1489`, doc cites `:1233` — line drift, filter confirmed present and unchanged). **No CHECK-constraint read path exists.** Confirmed by reading the whole function body.
- `SOURCE/supabase/schema.sql:1085` — `if v_attempts >= 3 then`, the single occurrence of that shape in the file (`grep -c` = 1), so the pin regex is unambiguous.
- `SOURCE/lib/scoring/essayLifecycle.ts:74` — `ESSAY_MAX_ATTEMPTS = 3`. Only a type-only import (`@/types/result`), so importing it into a `tsx`-run script adds no runtime dependency.
- `SOURCE/lib/ugc/limits.ts:17` — `MAX_ATTEMPT_ANSWER: 500`, still 500 (moves in B3.3).
- `SOURCE/supabase/verify-schema.ts:373-388` — the `record_exam_result` grant template: `42501` vs `PGRST202` vs "reached the body", never `error !== null`.
- `SOURCE/supabase/test-rls.ts` — read only; **not modified**.

### R-04 — VERIFIED on dev (ref `hynwleaxtbtjzkvpjsug`), 2026-08-29
Standalone probe against `attempt_answers` via service_role, `attempt_id` and `question_id` both non-existent:

| Probe | `length(answer)` | HTTP | SQLSTATE |
|---|---|---|---|
| P1 | 500 (`= MAX_ATTEMPT_ANSWER`) | 409 | **`23503`** — passed CHECK, died at the FK |
| P2 | 501 (`+1`) | 400 | **`23514`** — CHECK fired first |
| control | 4000 | 400 | `23514` — dev ceiling is still 500 |

`select … where question_id = '__verify_schema_no_such_question__'` returned `[]` after all three: **no row landed**.

**Outcome: `23514` on the first attempt.** CHECK-before-FK holds as assumed, so **the simple probe shape was kept** — a non-existent `attempt_id`, no real `attempt_id` from the fixture set, no marker-based cleanup needed. The Assumed Behaviors entry can move to `Confirmed: Yes` when that doc is next touched (not touched here — out of scope).

### Probe shape decisions
- The ceiling probes use the **`admin` (service_role)** client, not the student JWT. `answers_insert_own` requires the attempt to belong to the caller, so a fake `attempt_id` would be stopped by RLS before CHECK or the FK could say anything — the probe would lose exactly what it measures. service_role bypasses RLS but not CHECK/FK.
- A residue check + conditional sweep by the probe's own `question_id` marker is folded into both ceiling assertions (mục 9's discipline: sweep before reporting). It is clean on every branch today because the FK makes a landing structurally impossible; it is measured rather than assumed.

### Pin gate — exact regex and message
```ts
const claimCap = /if v_attempts >= (\d+) then/.exec(schemaSql);
```
Green message: `Trần lượt chấm khớp: schema.sql nói 3, ESSAY_MAX_ATTEMPTS nói 3`.
Red message (names **both** values): `TRẦN LƯỢT LỆCH: schema.sql nói <N>, ESSAY_MAX_ATTEMPTS (lib/scoring/essayLifecycle.ts) nói <M> — UI và SQL đang đếm khác nhau`.
Shape-loss message: `Không tìm thấy trần lượt (…) trong claim_essay_grading_attempt() — schema.sql đã đổi hình dạng, cổng ghim đang KHÔNG ghim gì`.

### Binding Decisions / Reference Contracts — compliance evaluation
Planned and implemented approach, one sentence per axis:
- **placement**: the two grant assertions call `claim_essay_grading_attempt` and `record_essay_grade` by name via RPC and assert `service_role`-only EXECUTE; nothing asserts anything about a TypeScript `.update()` call site or an `essay_grades` table, neither of which exists.
- **dependency_direction**: the assertions observe the SQL-side privilege result (SQLSTATE from a live RPC under three different roles), not a call-site convention in `lib/supabase/service-role.ts`.

| Row | Axis | Evaluation | Rationale |
|---|---|---|---|
| ADR-0018 § Decision | placement | **Y** | `assertServiceRoleOnlyFunction()` is invoked for exactly those two function names; no other write path is asserted or introduced |
| ADR-0010 § Decision | dependency_direction | **Y** | The check is three live RPC calls under `authenticated` / `anon` / `service_role`; it reads no TypeScript call site |
| ADR-0018 § Amendment to ADR-0010 | state-lifecycle-negative | **Y** | Each assertion fails with a message naming the offending role and its SQLSTATE if the function is executable by `public`, `anon` or `authenticated` — `revoke … from public` is covered because Supabase's default privileges reach `anon`/`authenticated` through `public`, and both are probed by name |

No row evaluated `N` or `Unknown` at either the pre-implementation check or the Exit Gate.

### Boundary Context — roundtrip evidence
- `LIMITS.MAX_ATTEMPT_ANSWER` → `attempt_answers_answer_check`: the value the producer (TypeScript) emits is fed as a real `answer` of that exact length to the consumer (Postgres) and the consumer's verdict is read back as a SQLSTATE. Both directions of drift have their own assertion and their own message. Green today (both sides 500); goes red from H7 to B3.3 by design.
- `ESSAY_MAX_ATTEMPTS` → the cap literal in `claim_essay_grading_attempt()`: regex-extracted from `schema.sql` and compared to the imported constant. Green today (3 = 3).

### No fourth DDL object
`git diff --stat` shows exactly one file changed: `SOURCE/supabase/verify-schema.ts`. `schema.sql` untouched; no `schema_check_constraints()` was added (TD-005).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Confirm there is genuinely no CHECK-constraint read path (`schema_foreign_keys()` filters `contype = 'f'` at `:1233`) — the probe is behavioural because of this, not by preference
- [x] Write the three assertion groups and observe them fail against the current dev database (the DDL is not applied yet — that is H7)

### 2. Green Phase
- [x] Two grant assertions, following `:373-388`, distinguishing `42501` from an incidental failure
- [x] The two-probe ceiling gate discriminating by SQLSTATE
- [x] The `ESSAY_MAX_ATTEMPTS` pin gate, failing with a message naming **both** values
- [x] Run `npm run verify:schema` against dev; record which assertions pass and which are waiting on H7

### 3. Refactor Phase
- [x] Run the ceiling probe on **dev** and record the returned SQLSTATE (R-04); if `23503`, switch to a real `attempt_id` and clean by the probe's own marker
- [x] Confirm `SOURCE/supabase/test-rls.ts` is **untouched**
- [x] Confirm no fourth DDL object was added to support the gate

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
| 1 | `npx tsc --noEmit` | **0** | clean |
| 2 | `npx eslint --max-warnings 0` | **0** | clean |
| 3 | `npx vitest run` | **0** | 127 files passed / 2 skipped; 1714 tests passed |
| 4 | `npm run build` | **0** | clean |
| 5 | `npm run test:fixture` | **1** | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi`. **Confirmed exactly those 2, unchanged by this commit** |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo; see Open Item I-7 |
| 8 | `npm run verify:schema` | **1** | Gate E3 — run against **dev** (`hynwleaxtbtjzkvpjsug`, ref confirmed before running). **3 failing checks: (i)** the fingerprint (`DB 29931beeb950` vs `git 9979c9deea52`) — pre-existing since H5, **not** reverted; **(ii)+(iii)** the two new grant assertions, `PGRST202` = both functions absent. All three are the H7 window, exactly as this task file specifies. The ceiling gate and the pin gate are **GREEN** |

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
- [x] **Implementation Complete** = assertions written
- [ ] **Quality Complete** = six verify gates green
- [ ] **Integration Complete** = deferred to Task H7 (the gates cannot pass against a database that has not received the DDL)
- [x] R-04 recorded: the ceiling probe's actual SQLSTATE behaviour, and the probe shape adjusted if it was `23503`
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: H7 runs these gates against both databases; B3.3's completion evidence is the ceiling assertion turning **green**.
- Scope boundary — preserve unchanged: `SOURCE/supabase/test-rls.ts` (**not modified by this plan**; the `S-b` case at `:1314-1320` stays and is not duplicated); `SOURCE/supabase/schema.sql` (H5 owns it — **no fourth DDL object** is added to support this gate).
- H6 no longer carries any part of the `EG-a…EG-e` obligations — I-1 closed 2026-08-29, and they live in Task H8 only.
