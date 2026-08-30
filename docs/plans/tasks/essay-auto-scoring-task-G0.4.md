# Task G0.4 — Phase 3.5 fingerprint baseline confirmation (HUMAN, read-only SQL)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase 0, Task G0.4**
Layer: **process gate** (read-only database observation; Gate B1 of the work plan is edited)
Status: ✅ **DISCHARGED 2026-08-29 (Gate B1).** Prod and dev fingerprints both still `29931beeb950`. **Gate B2 stays open by construction** — the new literal does not exist until Task H5 edits `schema.sql`. This file is the record of that discharge, not open work.

Metadata:
- Owner: **engineer** (read-only SQL, executed via Composio on 2026-08-29 — same call as Gate C).
- Dependencies: none.
- Blocks: **Task H5**.
- Provides: the confirmed baseline fingerprint on both projects, recorded in Gate B1.
- Size: documentation only (Gate B of the work plan).

## Implementation Content

Complete Gate B items **B1–B2** — read `schema_version.fingerprint` on both Supabase projects, confirm both still read the recorded baseline, and record them.

### Recorded result (2026-08-29)

- **B1 — DONE.** Prod `pebjdlbgbmizgfpuptjl`: **`29931beeb950`**. Dev `hynwleaxtbtjzkvpjsug`: **`29931beeb950`**. Read-only via Composio, both applied within 300 ms of each other. Both still match the recorded baseline — **nothing was hand-applied in the interim**, so the TD-005 shape this task watches for is **absent**.
- **B2 — still open by construction.** The new literal cannot exist until Task H5 edits `SOURCE/supabase/schema.sql` and recomputes it. H5 records it in Gate B2 and moves the pin at **both** declaration sites in the same commit (`schema.sql:1871` and `SOURCE/lib/schema/schemaFingerprint.ts:41`, D-08 / Gate B8 / Gate H6).

**Why this is a gate.** TD-005 (hand-applied schema) has fired **four times**. A baseline fingerprint that has moved since the last recorded read means something else was applied by hand in the interim — which is exactly the TD-005 shape, and it must be reconciled **before** any DDL is authored, not discovered afterwards.

## Target Files
- [x] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate B item B1 (both values recorded)
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate B item B2 (**filled by Task H5**, not here)

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate B — Phase 3.5, production DDL)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`:41` — the TypeScript pin site)
- `SOURCE/supabase/schema.sql` (`:1871` — the SQL pin site; the fingerprint block must be the **last** statement in the file)
- `SOURCE/supabase/verify-schema.ts` (how the fingerprint read from the DB is compared against the value computed from the file)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-08 — the fingerprint is pinned at two sites)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — item #9)
- `TECH-DEBT.md` (TD-005)

## Change Category
`Change Category: boundary-change`

The observation targets the `SCHEMA_FINGERPRINT` (TypeScript) → `schema_version.fingerprint` (both databases) boundary. Adjacent cases swept: both pin sites (`schema.sql:1871`, `schemaFingerprint.ts:41`) and both databases — all four agree on `29931beeb950`.

## Boundary Context (from the work plan's Connection Map)

| Boundary | `SCHEMA_FINGERPRINT` (TypeScript) → `schema_version.fingerprint` (both databases) |
|---|---|
| Owner (left) | `SOURCE/lib/schema/schemaFingerprint.ts:41` and `SOURCE/supabase/schema.sql:1871` |
| Owner (right) | `public.schema_version` on prod and dev |
| Serialized format | 12-character hex literal |
| Consumer parse rule | `verify-schema.ts` compares the value read from the DB with the value computed from the file |
| Expected signal | Both databases return the literal **by real query** (Gate B6), not by a "success" message |

Roundtrip check this task satisfies: the literal each database emits equals the literal the file declares — confirmed at `29931beeb950` on both, 2026-08-29.

## Investigation Notes
- Both reads were **read-only**, in the same Composio call that discharged Gate C, within 300 ms of each other. The two projects are in sync.
- Gate B2's slot is deliberately left empty here: filling it would require inventing a literal for a `schema.sql` that has not been edited yet.

## Implementation Steps
### 1. Observation (complete)
- [x] Read `schema_version.fingerprint` on **prod** (`pebjdlbgbmizgfpuptjl`)
- [x] Read `schema_version.fingerprint` on **dev** (`hynwleaxtbtjzkvpjsug`)
- [x] Compare both against the recorded baseline `29931beeb950`
- [x] Record both values in Gate B1
- [ ] Leave Gate B2 for Task H5 (the new literal computed from the edited `schema.sql`)

## Quality Assurance Mechanisms
- `npm run verify:schema` — Enforces: the fingerprint comparison between file and database — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/supabase/**`, `SOURCE/lib/schema/schemaFingerprint.ts` (not run by this read-only task; named because H5/H7 depend on the baseline recorded here)

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

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording Gate B1 still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: `select fingerprint from public.schema_version;` run against each project and the two returned values written into Gate B1 — never inferred from `schema.sql`, never accepted from a "success" message.
- **Success criteria**: both values are recorded and both equal `29931beeb950`.
- **Failure response**: if either has moved since 2026-08-29, **stop and reconcile before authoring DDL**. A moved baseline means something else was applied by hand in the interim, which is the TD-005 shape; that reconciliation is the engineer's, not an implementer's.
- **Verification level**: L1 (the live databases' own values are the answer).

## Proof Obligations
- **Claim**: both databases are at the recorded pre-feature baseline, so the new fingerprint Task H5 computes is a move from a known state.
- **Primary failure mode**: a hand-applied change has moved one database since the last read, and the new fingerprint is computed against a schema that does not match either live database — the TD-005 shape, which has already fired four times.
- **Boundary to exercise**: the live `public.schema_version` table on **both** projects — a real cross-process query.
- **State assertion**: N/A — read-only.
- **Mock boundary rationale**: none.
- **Residual**: proves the baseline as of 2026-08-29. Task H7 step 1 re-reads both fingerprints immediately before applying DDL, which is what covers the interval between this task and the application.

## Completion Criteria
- [x] **Implementation Complete** = both values recorded and matching
- [x] **Quality Complete** = the read was a real query on both projects, not a read of `schema.sql`
- [ ] **Integration Complete** = Task H5 computes the new literal from the edited `schema.sql` and records it in Gate B2
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks Task H5.
- Scope boundary: read-only. No DDL and no edit to `schema.sql` or `schemaFingerprint.ts` in this task.
- Gate B2, B3–B8 belong to Tasks H5 and H7, not here.
