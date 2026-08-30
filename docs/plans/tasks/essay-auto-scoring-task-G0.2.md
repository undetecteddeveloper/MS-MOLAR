# Task G0.2 — OQ-2: read the real CHECK constraint names (HUMAN, read-only SQL)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase 0, Task G0.2**
Layer: **process gate** (read-only database observation; Gate C of the work plan is edited)
Status: ✅ **DISCHARGED 2026-08-29. Gate C is CLOSED (C1–C5 all ticked).** This file is the record of that discharge, not open work. Do not re-open it; re-read the values below into Task H5 instead.

Metadata:
- Owner: **engineer** (read-only SQL, executed via Composio on 2026-08-29).
- Dependencies: none.
- Blocks: **Task H5** and therefore **Gate B**. H5 may now write the DDL using the two recorded names verbatim.
- Provides: the real constraint names in Gate C — `telemetry_log_event_type_check` and `telemetry_log_error_code_check`, on **both** projects.
- Size: documentation only (Gate C of the work plan).

## Implementation Content

Complete Gate C items C1–C5 — one read-only `pg_constraint` query per project, recording the real `event_type` and `error_code` CHECK constraint names for **both** Supabase projects: prod `pebjdlbgbmizgfpuptjl` and dev `hynwleaxtbtjzkvpjsug`.

**Why it was a blocking gate.** The auto-generated CHECK constraint name on `telemetry_log.event_type` was **predicted, not verified**. If the prediction is wrong, `drop constraint if exists` silently does nothing, `add constraint` either collides or leaves two live CHECKs, and the migration *appears* to succeed while `'essay_grade'` stays rejected — a **silent** failure, because the telemetry write is best-effort (risk R-07).

### Recorded result (2026-08-29)

- **C1 — prod `pebjdlbgbmizgfpuptjl`**: `event_type` constraint is **`telemetry_log_event_type_check`**. Live definition: `CHECK ((event_type = ANY (ARRAY['adaptive_route'::text, 'tutor_invoke'::text])))` — **two** values, so the new drop/add pair must list **three**.
- **C2 — dev `hynwleaxtbtjzkvpjsug`**: **`telemetry_log_event_type_check`** — identical name **and** identical definition to prod.
- **C3 — divergence check**: **the names do NOT differ.** No TD-005 symptom; the drop/add pair handles **one** name. (The prediction that motivated Gate C turned out correct — but it was worth verifying: had it been wrong, `drop constraint if exists` would have silently done nothing and the migration would have looked successful while `'essay_grade'` stayed rejected.)
- **C4 — `error_code` constraint**: **`telemetry_log_error_code_check` on both projects** — matches the drop/add pair already in `schema.sql:1818-1821`. Live definition carries the **six** values `gemini_unavailable, rate_limited, server, not_eligible, user_quota_exhausted, project_budget_exhausted`, byte-identical on prod and dev and identical to the inline declaration at `schema.sql:1390-1399`; the new pair must list **nine** (adding `groq_unavailable`, `invalid_output`, `duplicate_write`).
- **C5 — GATE C CLOSED 2026-08-29.** Both names verified by real read-only query on both live databases, both definitions captured, names identical across projects.

## Target Files
- [x] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate C items C1–C5 (all recorded)
- [ ] `TECH-DEBT.md` — **not** edited: a TD-005 symptom entry was only required if the two names differed, and they do not.

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate C — OQ-2, the real CHECK constraint name)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 2 / D-06) — the seven coupled telemetry sites
- `SOURCE/supabase/schema.sql` (`:1383` inline `event_type`; `:1390-1399` inline `error_code`; `:1818-1821` the existing `error_code` drop/add pair)
- `SOURCE/lib/tutor/telemetry.ts` (`TelemetryEventType` at `:40`, `TELEMETRY_ERROR_CODES` at `:35`)
- `TECH-DEBT.md` (TD-005 — hand-applied schema, has fired four times)

## Change Category
`Change Category: boundary-change`

The observation targets a persisted boundary (the `telemetry_log` CHECK constraints) whose TypeScript and SQL sides are duplicated across seven sites. The adjacent cases swept while reading: the inline `error_code` declaration, the existing `error_code` drop/add pair, and the two TypeScript constants — all confirmed byte-identical to the live definitions.

## Investigation Notes
- Both queries were **read-only** against `pg_constraint`, executed via Composio on 2026-08-29 in the same call that read the Gate B fingerprints.
- The `error_code` live definition on both databases is identical to the inline declaration at `schema.sql:1390-1399` — i.e. no drift has accumulated on that pair.
- `event_type` has **never** had a drop/add pair; Task H5 writes the first one.

## Implementation Steps
### 1. Observation (complete)
- [x] Run a read-only `pg_constraint` query on **prod** for CHECK constraints on `public.telemetry_log`; record the `event_type` constraint name and definition
- [x] Same on **dev**; record both
- [x] Compare the two names; if they differ, file a TD-005 symptom in `TECH-DEBT.md` **before** proceeding (they do not differ)
- [x] Confirm the `error_code` constraint name against the pair already in `schema.sql`
- [x] Tick C5 and record the closure date

## Quality Assurance Mechanisms
- `npm run verify:schema` — Enforces: the schema gates that Task H5's DDL will later have to pass — Config: `SOURCE/supabase/verify-schema.ts` (not run by this task; named because H5 depends on the values recorded here)

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

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording Gate C still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: the two (or four) constraint names are written into Gate C of the work plan, each with the live CHECK definition captured beside it, read by a real query against `pg_constraint` on each project — never inferred from `schema.sql`.
- **Success criteria**: Gate C carries a real name per project for both constraints; the definitions are captured; C5 is ticked with a date.
- **Failure response**: if the two projects report **different** names, that divergence is itself a TD-005 symptom — record it in `TECH-DEBT.md` before proceeding, and instruct Task H5 to write the drop/add pair to handle **both** names.
- **Verification level**: L1 (the live database's own catalogue is the answer).

## Proof Obligations
- **Claim**: Task H5's drop/add pairs name constraints that actually exist on both live databases.
- **Primary failure mode** (Failure Mode Checklist: **no-op**): `drop constraint if exists` against a wrongly predicted name is a **silent no-op** — the migration reports success, the old two-value CHECK stays live, and every `event_type = 'essay_grade'` telemetry write is rejected without anyone noticing, because the telemetry write is best-effort.
- **Boundary to exercise**: the live Postgres catalogue on **both** projects (`pg_constraint`) — a real cross-process query, not a read of `schema.sql`.
- **State assertion**: N/A — the observation is read-only and changes nothing.
- **Mock boundary rationale**: none — a mocked catalogue would prove exactly the thing this gate exists to stop being assumed.
- **Residual**: proves the names as of 2026-08-29. It does not prove nothing is hand-applied between now and Task H7; Gate B1's fingerprint re-read at H7 is what covers that interval.

## Completion Criteria
- [x] **Implementation Complete** = names recorded for both projects in Gate C
- [x] **Quality Complete** = the definitions captured, not just the names
- [ ] **Integration Complete** = Task H5's drop/add pairs use the recorded names **verbatim** (checked at H5, not here)
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks Task H5 and therefore Gate B.
- Scope boundary: read-only. No DDL, no write, no `TECH-DEBT.md` entry (the divergence condition did not fire).
- Recorded so it is not re-derived: the new `event_type` pair must list **three** values and the new `error_code` pair **nine**.
