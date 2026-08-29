# Task H7 — Phase 3.5: apply the DDL to dev and prod (HUMAN-CONFIRMED)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H7**
Layer: **backend / database operation** (no source file changes; **Gate B of the work plan is edited**, and that commit is the task's artefact)

Metadata:
- Owner: **engineer** — step 2 requires an explicit human confirmation before any DDL touches prod.
- Dependencies: **Task H5**, **Task H6**.
- Blocks: **Tasks H8, B1.3b, B1.5, B3.1, B3.3.**
- Provides: the DDL live on **both** Supabase projects, verified by real query, and Gate B items B3–B7 filled in.
- Size: documentation only in the repo (Gate B); three DDL groups applied by hand to two databases.
- Verification level: **L1** — six real query results on two live databases.

## Change Category
`Change Category: boundary-change, state-change`

Persisted boundaries move on two live databases: the `attempt_answers` character ceiling, both `telemetry_log` CHECK constraints, and the `exam_results.per_question` write surface. Adjacent cases swept: both projects (prod **and** dev — a change applied to one and not the other is the TD-005 shape), and both fingerprint pin sites (already moved in H5's commit).

## Gate B — the checklist this task discharges

- **B1** ✅ recorded 2026-08-29 by Task G0.4: prod `29931beeb950`, dev `29931beeb950`.
- **B2** — the new literal computed by Task H5 from the edited `schema.sql`.
- **B3** — explicit engineer confirmation obtained **before any DDL touches prod**, recorded with a name and a date.
- **B4** — DDL applied to **dev** (`hynwleaxtbtjzkvpjsug`).
- **B5** — DDL applied to **prod** (`pebjdlbgbmizgfpuptjl`).
- **B6** — verified **by real query**, not by a "success" message, on **both** projects: `select fingerprint from public.schema_version;` returns the new literal; `select proname from pg_proc where proname in ('claim_essay_grading_attempt','record_essay_grade');` returns **two rows**.
- **B7** — `npm run verify:schema` green against dev **and** prod, **except the character-ceiling assertion** (see the known-red window below). Every other assertion must be green, **including both grant assertions and the fingerprint comparison**.
- **B8** — the fingerprint pin moved in the **same commit** at both declaration sites (discharged by Task H5).

## Implementation Content — work in order and without shortcuts

1. Re-read `schema_version.fingerprint` on **both** projects and compare against Gate B1's recorded values **and** against the new literal from Gate B2.
2. Obtain the engineer's **explicit confirmation before any DDL touches prod** and record it in Gate B3 with a name and a date.
3. Apply all three DDL groups to **dev** (`hynwleaxtbtjzkvpjsug`).
4. Apply all three DDL groups to **prod** (`pebjdlbgbmizgfpuptjl`).
5. Verify **by real query** on both:
   - the fingerprint equals the new literal;
   - `pg_proc` returns both function names;
   - the `attempt_answers_answer_check` ceiling is **4000**;
   - a `service_role` insert of `event_type = 'essay_grade'` into `telemetry_log` **succeeds** and is then deleted. *(This is the concrete check for R-07, and it is the only thing that distinguishes "the drop/add ran" from "the drop/add silently did nothing".)*
6. Run `npm run verify:schema` against dev and against prod. Expect **one** assertion to fail — see the known-red window.

**Never** accept a "success" message as verification. The fingerprint block must be the **last statement** in `schema.sql`; a paste cut off midway leaves the fingerprint unwritten while everything before it applied.

## KNOWN-RED WINDOW — `verify:schema`'s ceiling gate, from this task until Task B3.3 completes (~12 commits)

Task H6 added a gate asserting `LIMITS.MAX_ATTEMPT_ANSWER` equals the database ceiling. **This task moves the database to 4000. The constant does not move until B3.3.** So from the moment the DDL lands until B3.3 lands, that one assertion is **red by design, on both databases**.

- **Do NOT resolve it by moving `limits.ts` earlier.** `TUTOR_MAX_STUDENT_ANSWER` is not declared until B3.3, and raising the constant before that slice opens exactly the Gemini-prompt ripple Gate H4 exists to close: a self-composed 4000-character `short_answer` flowing into `buildTutorPrompt()` on a different budget key.
- **This is the safe direction of the two.** Code ceiling **below** DB ceiling truncates a long answer; code ceiling **above** DB ceiling makes Postgres reject an **entire** submission (R-02/R-f). The window is deliberately on the truncating side.
- **Record the red gate at every commit in the window.** Gate E4's per-task-file exit-code table is what makes this legible. A red ceiling assertion **inside** the window is expected; a red ceiling assertion **outside** it, or **any other** `verify:schema` assertion red at any time, is a **regression**.
- The window closes as a **result** of Task B3.3 — the ceiling gate turning green is B3.3's own completion evidence, not its precondition.

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate B items B3, B4, B5, B6, B7 (and the six real query results)
- [ ] **No file in `SOURCE/`** — this is a database operation. H7's commit records the Gate B evidence into this tracked plan document.

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate B — Phase 3.5, production DDL)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Implementation Order — step 4: DDL applied by hand to **both** Supabase projects under Phase 3.5 / TD-005)
- `SOURCE/supabase/schema.sql` (the three groups as authored in Task H5; the fingerprint block at `:1871` — it must be the **last** statement)
- `SOURCE/supabase/verify-schema.ts` (the gates written in Task H6 — which assertion is expected red and which must be green)
- `TECH-DEBT.md` (TD-005 — hand-applied schema, has fired **four** times)

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `SCHEMA_FINGERPRINT` (TypeScript) → `schema_version.fingerprint` (both databases) | **Serialized format**: 12-character hex literal. **Consumer parse rule**: `verify-schema.ts` compares the value read from the DB with the value computed from the file. **Expected signal**: both databases return the new literal **by real query** (Gate B6), not by a "success" message. |
| `LIMITS.MAX_ATTEMPT_ANSWER` (TypeScript) → `attempt_answers_answer_check` (Postgres) | **Expected signal**: `verify:schema` is **red** when the two ceilings differ. **This task creates that difference deliberately** and B3.3 closes it. |

## Investigation Notes
_(Record here: the re-read fingerprints from step 1; the engineer's name and date from step 2; the six real query results from step 5; which `verify:schema` assertions were green and which single one was red on each database.)_

## Implementation Steps
### 1. Pre-flight
- [ ] Re-read `schema_version.fingerprint` on **both** projects; compare against Gate B1 **and** Gate B2
- [ ] If either has moved since 2026-08-29 — **stop and reconcile.** A moved baseline means something else was applied by hand in the interim (the TD-005 shape)
- [ ] Obtain and record the engineer's explicit confirmation in Gate B3 (name + date) **before any DDL touches prod**

### 2. Apply
- [ ] Apply all three DDL groups to **dev** (`hynwleaxtbtjzkvpjsug`) — tick B4
- [ ] Apply all three DDL groups to **prod** (`pebjdlbgbmizgfpuptjl`) — tick B5

### 3. Verify by real query (both projects)
- [ ] `select fingerprint from public.schema_version;` returns the new literal
- [ ] `select proname from pg_proc where proname in ('claim_essay_grading_attempt','record_essay_grade');` returns **two rows**
- [ ] The `attempt_answers_answer_check` ceiling is **4000**
- [ ] A `service_role` insert of `event_type = 'essay_grade'` into `telemetry_log` **succeeds**, then delete the row (R-07's concrete check)
- [ ] Run `npm run verify:schema` against dev and against prod; record every assertion's outcome — tick B6, B7

## Quality Assurance Mechanisms
- `npm run verify:schema` — Enforces: grants on both new functions, the character ceiling read back from a real DB, the schema fingerprint, the `ESSAY_MAX_ATTEMPTS` pin — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/supabase/**`. **The ceiling assertion is expected RED from this task until Task B3.3.**
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
| 8 | `npm run verify:schema` | | Gate E3 — run against **dev and prod separately**. **Expected: exactly one red assertion — the character ceiling** (known-red window opens here, closes at B3.3). Any other red assertion is a regression |

**A task file with any exit-code cell left empty is not complete** (Gate E4). From this commit until Task B3.3, every commit's row 8 is the record that distinguishes the expected red from a regression.

## Operation Verification Methods
- **Verification method**: six real query results on **both** live projects (fingerprint, two function names, the 4000 ceiling, the accepted-then-deleted `essay_grade` telemetry row), plus `npm run verify:schema` run separately against dev and against prod.
- **Success criteria**: Gate B items B3–B7 filled in; both projects return the new fingerprint literal and both function names by real query; the `essay_grade` insert is accepted on dev; every `verify:schema` assertion green on both databases **except** the character-ceiling assertion.
- **Failure response**: **never** accept a "success" message as verification. If the fingerprint is missing while other objects exist, the paste was cut off midway — re-apply from the point of truncation and re-verify. If the `essay_grade` insert is **rejected**, the `event_type` drop/add pair did not take effect (the R-07 silent no-op) — return to Task H5 and check the constraint name against Gate C.
- **Verification level**: **L1** — the live databases' own answers.

## Proof Obligations
- **Claim**: all three DDL groups are live and identical on **both** projects, verified by real query.
  - **Primary failure mode** (Failure Mode Checklist: **no-op**): a `drop constraint if exists` silently doing nothing, or DDL applied to one database and not the other, while the operation reports success — the TD-005 shape, which has fired four times.
  - **Boundary to exercise**: both live Postgres databases, by real query — never by a client's success message.
  - **State assertion**: before → fingerprint `29931beeb950`, no `claim_essay_grading_attempt`/`record_essay_grade` in `pg_proc`, ceiling 500, `event_type = 'essay_grade'` rejected. After → new fingerprint literal, two rows in `pg_proc`, ceiling 4000, `essay_grade` accepted (then deleted).
  - **Mock boundary rationale**: none. Every check is against the real databases; that is the entire point of Phase 3.5.
  - **Residual**: proves the objects exist and behave at the constraint level. It does **not** prove the functions' semantics (array order, first-write-wins, the claim cap, the grants under a student JWT) — that is Task H8 against real Postgres.
- **Claim (the known-red window is legible)**: the character-ceiling assertion is the **only** red `verify:schema` assertion between this task and B3.3.
  - **Primary failure mode**: an unrecorded red run makes an expected red indistinguishable from a regression — the TD-030 failure mode repeating one level down.
  - **Boundary to exercise**: the per-commit Gate E4 exit-code tables from H7 to B3.3.
  - **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: the audit is performed in the Final Phase, which walks the whole window.

## Completion Criteria
- [ ] **Implementation Complete** = DDL live on **both** projects
- [ ] **Quality Complete** = `verify:schema` green on both **except the character-ceiling assertion**, which is expected red until B3.3 — every other assertion, **including both grant assertions and the fingerprint comparison**, must be green
- [ ] **Integration Complete** = both functions callable as `service_role` and refused (`42501`) with a student JWT
- [ ] Gate B items B3–B7 filled in; six real query results recorded
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks H8, B1.3b, B1.5, B3.1, B3.3. Opens the known-red window that B3.3 closes.
- Scope boundary: **no source file changes.** H7's commit edits Gate B in the tracked work plan and nothing else.
- The Gate B slots are versioned evidence — the two fingerprints, the confirmation name and date, and the six query results exist nowhere else and are not derivable from code.
