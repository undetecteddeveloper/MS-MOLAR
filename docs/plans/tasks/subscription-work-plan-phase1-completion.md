# Phase 1 Completion: Schema foundation and named values

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 1** (estimated 5 commits, +1 when Task 1.6 is unblocked)
Layer mix: **backend + database only.** Deliberately horizontal — the schema is a shared foundation with a hard external gate in front of it.

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 1.1 DDL — the four designed blocks + fingerprint | `subscription-work-plan-backend-task-09.md` | backend | [ ] |
| 1.2 Gate A — text-side assertions incl. the two new ones | `subscription-work-plan-backend-task-10.md` | backend | [ ] |
| 1.3 ⚠ **BLOCKING MANUAL** — hand-apply to dev, then gate B | `subscription-work-plan-backend-task-11.md` | backend | [ ] |
| 1.4 Named values + env registration (incl. `periodStartEpoch()`) | `subscription-work-plan-backend-task-12.md` | backend | [ ] |
| 1.5 `test-rls.ts` Phần 8 — three denial groups | `subscription-work-plan-backend-task-13.md` | backend | [ ] |
| ⛔ 1.6 durable AI usage sink | **NOT EMITTED — BLOCKED-ON-DESIGN (BU-6)** | — | n/a |

### ⛔ Task 1.6 — blocked-on-design, deliberately not schedulable

**No executable task file exists for plan Task 1.6.** It is blocked behind **BU-6**: the backend Design Doc contradicts itself (`:79` Non-scope vs `:145` "this document business") and **no Design Doc schema section designs the sink**.

- **Owner of the unblocking action**: the **backend Design Doc owner** (a design revision, not an engineer input decision).
- **Unblocking condition**: a backend DD revision that designs the sink — table name, full column list (input/output token split incl. `thoughtsTokenCount`, plus the `role` dimension), the FK and its `on delete` (TD-011), RLS policies, the explicit revokes/grants, and the §17 fingerprint impact.
- **When it lands**: add its traceability row; ship its DDL as its **own** block behind gate A and gate B; add its denial group to plan Task 1.5; then implement.
- **Do not start it, and do not choose a sink to unblock it.**
- **Downstream chain**: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Nothing in Phases 1–5 depends on it; **Phase 1 completes without it.**

## Test skeleton files to verify (paths)

- `SOURCE/tests/integration/subscription.int.test.ts` (still comments-only; runnable via `npm run test:integration` after gate B)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (fixtures from plan Task 0.8 become executable once gate B is green)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (unaffected in this phase)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] Gate A green (`npm test`), including both new text-side assertions
- [ ] ⚠ Gate B green on **dev** (`npm run verify:schema` from `SOURCE/`), fingerprint matching git
- [ ] `schema.sql` gained **exactly four** new/edited DDL blocks — the number in the header and in the traceability rows; no block was added that lacks a Design Doc **schema** section
- [ ] `test-rls.ts` Phần 8 passes, with one denial group per table plan Task 1.1 created (two tables + the function ⇒ three groups)
- [ ] One unit test per environment variable, absent and present, all green; `periodStartEpoch()` literal-epoch cases green
- [ ] Task 1.6 remains **blocked-on-design** (BU-6 open) and no sink DDL shipped — **or**, if the DD revision landed mid-phase, the sink shipped as its own block with its own traceability row, allowlist coverage and denial group
- [ ] **No production deploy of this branch has occurred** (see Deployment Sequencing)
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`, `npm test`

## Failure response

A failure in **either** gate **stops the phase.** Do not proceed to implementation.

## Deployment Sequencing

- **Production deploy permitted at end of Phase 1: No.** Dev-only apply; **prod still has neither new table** until plan Task 5.8.
