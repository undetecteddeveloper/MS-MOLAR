# Task H5 — DDL authoring: three groups + fingerprint at both pin sites (one commit, nothing applied yet)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H5**
Layer: **backend** (`SOURCE/supabase/**`, `SOURCE/lib/schema/**`)

Metadata:
- Dependencies: **Task G0.2** (the real constraint names — Gate C, closed 2026-08-29), **Task G0.4** (baseline fingerprints — Gate B1, closed 2026-08-29), **Task H1** (key literals and the attempt cap must be settled before the function bodies are written).
- Blocks: **Task H6**, and through it H7 and everything downstream of H7.
- Provides: the three DDL groups in `schema.sql` and the new fingerprint literal at **both** pin sites. **Nothing is applied to any database by this task** — that is H7.
- Size: Medium (2 files, one commit)
- Verification level: **L3/L2** — the file type-checks and the suite is green; `verify:schema` is still red against the databases until H7, which is **expected and must be recorded, not worked around**.

## Change Category
`Change Category: boundary-change, state-change`

Three persisted boundaries move: the `attempt_answers` character ceiling, both `telemetry_log` CHECK constraints, and the `exam_results.per_question` write surface (two new privileged functions). Adjacent cases swept in the same commit: the inline `event_type` declaration, the inline `error_code` declaration, the existing `error_code` drop/add pair, the **new** `event_type` drop/add pair, and **both** fingerprint pin sites.

## Gate C — entry condition (CLOSED 2026-08-29)

The real constraint names are **`telemetry_log_event_type_check`** and **`telemetry_log_error_code_check`**, **identical on both projects** (prod `pebjdlbgbmizgfpuptjl`, dev `hynwleaxtbtjzkvpjsug`). Use them **verbatim**; do not re-predict them.

- The live `event_type` CHECK allows only `'adaptive_route'` and `'tutor_invoke'` — **two** values — so the **new pair must list three**.
- The live `error_code` CHECK allows **six** values (`gemini_unavailable, rate_limited, server, not_eligible, user_quota_exhausted, project_budget_exhausted`) — so the **new pair must list nine**, adding `groq_unavailable`, `invalid_output`, `duplicate_write`.

## Implementation Content

All of the following lands in **one commit**, in `SOURCE/supabase/schema.sql` unless stated otherwise.

### Group 1 — character ceiling (R11 / AC-048(1))
Edit the existing drop/add pair **in place** at `:472-474` to `check (answer is null or length(answer) <= 4000)`, keeping the explanatory comment and adding the recorded reason: no empirical basis — production has **0** submitted essays; chosen by argument; it **must** equal `LIMITS.MAX_ATTEMPT_ANSWER`, and `verify:schema` reads it back from a real DB. The inline `check (answer in ('A','B','C','D'))` at `:124` was already superseded by this pair and is **not** a second coupled site.

### Group 2 — `telemetry_log` (R13 / AC-055)
- Widen the inline `event_type` declaration at `:1383` to include `'essay_grade'`.
- Widen the inline `error_code` declaration at `:1390-1399` with `'groq_unavailable'`, `'invalid_output'`, `'duplicate_write'`.
- Extend the existing `error_code` drop/add pair at `:1818-1821`.
- **Write a new drop/add pair for `event_type`, which has never had one** — using the real constraint name recorded in Gate C, not a predicted one.

Editing only the inline declaration produces the exact TD-005 shape the comment at that site already names: correct in git, absent from every database (`create table if not exists` is a no-op on both live databases).

### Group 3 — two privileged functions (ADR-0018 Decision 1)
A new section placed **after §11** and cross-referenced from it, containing:
- `claim_essay_grading_attempt(p_attempt_id uuid, p_question_id text) returns table (claimed boolean, attempts int, reason text)`
- `record_essay_grade(p_attempt_id, p_question_id, p_state, p_earned, p_max, p_low_confidence)`

Both `language plpgsql`, `volatile`, `set search_path = public, pg_temp`, **`INVOKER` (never `SECURITY DEFINER`)**, **no `user_id` parameter**, with the §11b grant block mirrored **verbatim** (`revoke all on function … from public, anon, authenticated;` then `grant execute … to service_role;` — revoking only from `public` leaves both callable by students).

- The `UPDATE` is scoped to the `per_question` column and to **one** array element; `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds` appear **nowhere** in either body.
- The rebuild uses `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality`.
- **Neither function validates the band value** — that omission is deliberate (Decision 2).
- The settle carries `… and <element>.essayState <> 'graded'` **in the same statement** and returns **zero rows affected as a value, not a raise**.
- The claim **increments** `essayAttempts` and **never decrements** it.
- Carry the full explanatory comment block: it is the thing a reader of §11 finds instead of searching for the amendment.

### Fingerprint
Compute the new literal and move it at **both** pin sites — `schema.sql:1871` and `SOURCE/lib/schema/schemaFingerprint.ts:41` — **in this same commit** (D-08, Gate B8, Gate H6). Record the new literal in **Gate B2** of the work plan.

## Target Files
- [ ] `SOURCE/supabase/schema.sql`
- [ ] `SOURCE/lib/schema/schemaFingerprint.ts` (`:41`)
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate B2 (record the new literal)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 1 — the ceiling drop/add pair)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 2 / D-06 — all four telemetry SQL sites)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 3 — the two functions, placement after §11, the §11b grant block)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-08 — the fingerprint pinned at two sites)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decisions 1, 1b, 2, 3, 4)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — items #1 and #2: placement after §11, grant block mirrored verbatim)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — the append-only property that remains)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision — enforcement lives in SQL, not at the call site)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision — a second privileged operation is a **separate function**, not a mode parameter on the first)
- `SOURCE/supabase/schema.sql` (`:124` the superseded inline check; `:472-474` the ceiling pair; `:849` the client write revoke; `:1354` the MASTERY WRITE filter — **not modified**; `:1383` inline `event_type`; `:1390-1399` inline `error_code`; `:1818-1821` the `error_code` drop/add pair; §11 and §11b; `:1871` the fingerprint block — it must remain the **last** statement in the file)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`:41`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — the six key literals and `ESSAY_MAX_ATTEMPTS`, which the function bodies must match)
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate C — the two real constraint names; § Gate B — the baseline fingerprints)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | placement | The band is written in place into `exam_results.per_question` by **two** `service_role`-only `INVOKER` SQL functions — `claim_essay_grading_attempt` and `record_essay_grade` — never by a TypeScript `.update()` call site, and never into a separate `essay_grades` table | Both functions exist in `schema.sql` as `INVOKER`, and this commit adds no `essay_grades` table and no TypeScript `.update()` on `exam_results` |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | Neither function takes a `user_id` parameter; ownership is derived from the attempt inside SQL, and `status = 'submitted'` is required. Neither body may name `total_score`, `correct`, `total`, `topic_breakdown` or `overtime_seconds` | A source scan of both bodies finds no `user_id` parameter and none of the five column names |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The element rewrite preserves array order explicitly: `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality` | Both bodies use `jsonb_agg(… order by ord)` over `… with ordinality` |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | The closed band set `{0, 0.25, 0.5, 0.75, 1}` is declared **once, in TypeScript**; the SQL functions do not validate the band value at all, and that omission is deliberate | Neither function body compares the band against any set |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | First-write-wins is a `WHERE … <> 'graded'` predicate inside the settle statement — zero rows affected is a **distinct return value, not an exception** — never a read-then-write in TypeScript. `failed` is not protected by the predicate; `graded` is absorbing | The settle carries the predicate in the same statement and returns a boolean/zero-row value rather than raising |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time, before the provider is contacted, and is never decremented. The initial counter value is emitted by `computeScore()` at insert, so `record_exam_result()`'s signature does not change | The claim increments `essayAttempts`; no statement anywhere decrements it; `record_exam_result()` is untouched |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | placement | The two functions go in one new `schema.sql` section placed after §11 and cross-referenced from it, with ADR-0010's grant block mirrored verbatim (`revoke all on function … from public, anon, authenticated`, then `grant execute … to service_role`) | The new section sits after §11, §11 cross-references it, and the grant block is byte-equivalent to §11b's |
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision) | dependency_direction | Privileged operations are exposed as named operations from `lib/supabase/service-role.ts`; `serviceRoleClient()` stays private; enforcement lives in SQL, not at the call site; `import "server-only"`; the bundle scan stands | Enforcement (ownership, `status = 'submitted'`, the cap, first-write-wins) is inside the SQL bodies, not deferred to the caller |
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision) | placement | A second privileged operation is a **separate function**, not a mode parameter on the first — which is why claim and settle are two functions | Two independent functions exist; neither takes a mode/discriminator parameter |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| ADR-0018 (§ Amendment to ADR-0010) | state-lifecycle-negative | "The append-only property that remains, and that this ADR does not weaken: **no client can write to `exam_results` by any path, and no writer other than `service_role` exists.**" | The grant block revokes from `public, anon, authenticated` and grants only to `service_role`, and `schema.sql:849`'s client revoke is unchanged |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `record_essay_grade()` → `exam_results.per_question` (in-place element rewrite) | Left: `public.record_essay_grade()` (SQL). Right: the same jsonb array, read by four display surfaces. **Serialized format**: rebuilt array via `jsonb_agg(… order by ord)`; the target element gains `essayGradedAt` and updated `essayState`/`essayEarned`/`essayMax`/`essayLowConfidence`. **Consumer parse rule**: consumers re-read the array by index order; array order **is** the exam's question order. **Expected signal**: SVC-1(a) — the full `questionId` sequence is unchanged after grading the middle of three essays; SVC-1(b) — every other element is byte-identical. |
| TypeScript telemetry literals → `telemetry_log` CHECK constraints | Left: `SOURCE/lib/tutor/telemetry.ts`. Right: `public.telemetry_log` CHECKs. **Serialized format**: literal string sets duplicated across seven sites (two SQL inline, two SQL drop/add pairs, two TypeScript constants, three test pins). **Consumer parse rule**: Postgres rejects any value outside the CHECK. **Expected signal**: a `service_role` insert of `event_type = 'essay_grade'` on dev succeeds and is then deleted. |
| `LIMITS.MAX_ATTEMPT_ANSWER` (TypeScript) → `attempt_answers_answer_check` (Postgres) | **Serialized format**: integer ceiling, duplicated in two places (git and each database). **Consumer parse rule**: `verify:schema` probes behaviourally and discriminates by SQLSTATE (`23514` vs `23503`). **Expected signal**: `verify:schema` is **red** when the two ceilings differ — which is exactly why H7→B3.3 is a known-red window. |
| `ESSAY_MAX_ATTEMPTS` (TypeScript) → the cap literal inside `claim_essay_grading_attempt()` | **Consumer parse rule**: `verify-schema.ts` regex-extracts the literal from the function body and compares it to the imported constant. **Expected signal**: the pin gate fails with a message naming **both** values. |
| `SCHEMA_FINGERPRINT` (TypeScript) → `schema_version.fingerprint` | **Serialized format**: 12-character hex literal. **Expected signal**: both databases return the new literal **by real query** (Gate B6), not by a "success" message. |

Roundtrip checks this task owns: the cap literal written into the claim body equals `ESSAY_MAX_ATTEMPTS`; the fingerprint literal written at `schema.sql:1871` equals the one at `schemaFingerprint.ts:41`.

## Investigation Notes
_(Record here: the new fingerprint literal; the exact new `event_type` drop/add pair including the Gate C name; confirmation that the fingerprint block is still the last statement in `schema.sql`; the source-scan result for the five forbidden column names.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, including Gate C's two recorded names and Gate B1's baseline fingerprints
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change / state-change): all four telemetry SQL sites, the ceiling pair, the superseded inline check at `:124`, and both fingerprint pin sites — enumerate them before editing
- [ ] Confirm the current state of each site so a partially-applied edit is detectable

### 2. Green Phase
- [ ] Group 1: widen the ceiling drop/add pair at `:472-474` to 4000, keeping and extending the comment
- [ ] Group 2: widen both inline declarations, extend the `error_code` pair, and write the **new** `event_type` pair using `telemetry_log_event_type_check` verbatim
- [ ] Group 3: add the new section after §11 with both functions, the §11b grant block mirrored verbatim, and the full explanatory comment block; cross-reference it from §11
- [ ] Compute the new fingerprint and move it at **both** pin sites in this same commit; record it in Gate B2

### 3. Refactor Phase
- [ ] Source-scan both function bodies: no `user_id` parameter, none of `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds`
- [ ] Confirm `jsonb_agg(… order by ord)` over `… with ordinality` in both
- [ ] Confirm the fingerprint block is the **last** statement in `schema.sql`
- [ ] Confirm `SOURCE/supabase/test-rls.ts` is untouched, and `schema.sql:1354` (MASTERY WRITE), `record_exam_result()` and the `exam_results` column DDL are unchanged

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the moved fingerprint literal type-checks — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run verify:schema` — Enforces: grants on both new functions, the character ceiling read back from a real DB, the schema fingerprint, the `ESSAY_MAX_ATTEMPTS` pin — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/supabase/**`, `SOURCE/lib/schema/schemaFingerprint.ts`. **Expected red against the databases until H7 applies the DDL** — record it, do not work around it.
- `telemetry_log` CHECK constraints — Enforces: `event_type` / `error_code` accept closed literal sets only — Config: `schema.sql:1383`, `:1390-1399`, `:1818-1821` + the new `event_type` drop/add pair
- `attempt_answers_answer_check` — Enforces: student answer length ceiling — Config: `schema.sql:472-474` (widened 500 → 4000)

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
| 8 | `npm run verify:schema` | | Gate E3 — this task's files match `SOURCE/supabase/**` and `SOURCE/lib/schema/schemaFingerprint.ts`. **Expected red against both databases until Task H7 applies the DDL** — record the exit code rather than working around it |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: read the edited `schema.sql` against the Gate C names and the enumerated site list; source-scan both new function bodies for the forbidden parameter and column names; confirm both fingerprint pin sites carry the identical new literal.
- **Success criteria**: all three groups present in one commit; both fingerprint sites moved together; both new function bodies free of `user_id` and the five column names; `jsonb_agg(… order by ord)` present in both; the settle's predicate in the same statement; the grant block byte-equivalent to §11b's.
- **Failure response**: if the recorded Gate C name does not appear verbatim in the new `event_type` pair, stop — a predicted name makes `drop constraint if exists` a **silent no-op** and the migration will appear to succeed while `'essay_grade'` stays rejected. If `verify:schema` is red for any assertion **other** than the ones expected pre-application, resolve it before H7.
- **Verification level**: **L3/L2** — the file and the suite are green; database-side verification is deferred to H7 by design.

## Proof Obligations
Authored here, **proven** in H6/H8:
- **Claim (EG-BE-005 / Failure Mode Checklist: missing-sort-key ordering)**: the element rewrite leaves the `questionId` sequence unchanged.
  - **Primary failure mode**: a missing `order by ord` in `jsonb_agg` shuffles `per_question` the first time any essay is graded — every question on the review page pairs with the wrong answer, and **every "the band landed" assertion stays green**. **Boundary to exercise**: real Postgres (SVC-1(a), Task H8). **State assertion**: before → captured `questionId` literal; action → settle the second of three essays; after → identical sequence. **Mock boundary rationale**: none — a mocked client cannot prove `jsonb_agg` ordering. **Residual**: authored here, proven in H8.
- **Claim (EG-BE-006)**: a duplicate settle returns `false`/zero rows and does **not** raise. **Primary failure mode**: a read-then-write in TypeScript, or a raise where a value is required. **Boundary**: real Postgres (SVC-1(d)). **State assertion**: before → band from first write; action → settle with a **different** band; after → the stored band still equals the **first** write. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-007)**: `failed` is **not** absorbing; `graded` is. **Primary failure mode**: the predicate blocks everything, so a legitimate `failed → graded` retry can never land. **Boundary**: real Postgres (SVC-1(e)). **State assertion**: `failed` → settle → `graded`, then a further settle returns `false`. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-008)**: on a non-`submitted` attempt, the **claim** returns a row with `reason = 'not_submitted'` while the **settle raises `check_violation`** — the asymmetry is deliberate. **Primary failure mode**: collapsing the two into one behaviour. **Boundary**: real Postgres (SVC-1(f), SVC-2(f)); assert the **SQLSTATE**, not the message text. **State assertion**: N/A. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-009)**: no `user_id` parameter, no forbidden column names. **Primary failure mode**: ownership pushed to the call site, so a wrong caller can write another student's row. **Boundary**: a source-text scan of both bodies (SVC-1(g)). **State assertion**: N/A. **Mock rationale**: none. **Residual**: the scan proves the text; the grants are proven by SVC-2(g) and `verify:schema`.
- **Claim (EG-BE-010/011/012)**: claim-time cap, `exhausted`, `already_graded` — three **distinct** reasons. **Primary failure mode**: one generic refusal collapsing three branches. **Boundary**: real Postgres (SVC-2(a)(b)(e)). **State assertion**: `essayAttempts` increments by exactly 1 per successful claim and is never decremented. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (Failure Mode Checklist: no-op)**: this task's own primary failure mode — `drop constraint if exists` against a **wrongly predicted** name silently doing nothing while the migration reports success.
  - **Primary failure mode**: every grading telemetry write is rejected forever, silently, because the write is best-effort. **Boundary to exercise**: the live catalogue — closed by **Gate C being a prerequisite**, and confirmed at H7 step 5 by inserting one `event_type = 'essay_grade'` row on dev and deleting it. **State assertion**: N/A here. **Mock rationale**: none. **Residual**: authored here, confirmed at H7.

## Completion Criteria
- [ ] **Implementation Complete** = all three groups + **both** fingerprint sites in one commit
- [ ] **Quality Complete** = six verify gates green (`verify:schema` will still be red against the databases until H7 — **expected**, and must be **recorded**, not worked around)
- [ ] **Integration Complete** = deferred to Task H7
- [ ] The new fingerprint literal recorded in Gate B2 of the work plan
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: H6 writes the gates over these objects; H7 applies them to both databases; H8 proves them against real Postgres; B1.3b calls them from TypeScript.
- Scope boundary — preserve unchanged: `schema.sql:1354` (the MASTERY WRITE filter), `record_exam_result()`'s signature/body/grants, the `exam_results` column DDL, `schema.sql:849`'s client revoke, and `SOURCE/supabase/test-rls.ts` (**not modified by this plan** — I-1 closed in favour of the runnable service lane).
- Nothing is applied to any database by this task. Gate B items B3–B8 belong to Task H7.
