# Task: ⚠ ESCALATION — the durable AI usage-log sink is undesigned (raises BU-6)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.9**
Layer: **backend** (document under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none. ⚠ **Raise before Phase 1 writes any DDL** (plan Task 1.1 / backend-task-09), so the requested revision has maximum lead time.
- Provides: the BU-6 escalation record that keeps **plan Task 1.6 blocked-on-design** (Task 1.6 is deliberately **not** emitted as a schedulable task file) and that BU-4 depends on. Sequence: **BU-6 → Task 1.6 → BU-4 → Task 6.8**.
- Size: Small (1 document)

## Implementation Content

**Deliverable of this task is a document change, not code.**

The backend Design Doc **contradicts itself** about the durable write target for `quotaTracker.recordUsage()`:
- `:79` lists it under **Non-scope** — *"U2 measurement infrastructure. `quotaTracker.ts` durable write target is named as remaining work, not built here"*;
- `:145` says *"the write target is still a process temp file … Measuring on production needs a durable target — a schema change, therefore this document business, not a patch."*

Neither statement **designs** it: there is **no DD schema section** naming a table, a column list, an FK with `on delete`, an RLS policy or a grant/revoke set for it, and the only traceability source available was an *analysis* section.

Do all three of:

**(a)** Record the contradiction as an **escalation row** in `docs/design/subscription-backend-design.md`, in the same shape as its existing escalation rows, **stating which of `:79` and `:145` is withdrawn**.

**(b)** **Request** a backend DD revision that **designs** the sink: table name; full column list (the input/output token split including `thoughtsTokenCount` billed at the output rate, and the `role` dimension `recordUsage()` already records); the FK and its `on delete` (TD-011); RLS policies; the explicit `revoke`/`grant` set; and the §17 fingerprint impact.

**(c)** Record the consequence: until that revision exists, **plan Task 1.6 is blocked-on-design** and **BU-4 measurement has no durable target**.

### Prohibition — binding on this task and on every task in this plan

**No task in this plan may choose the sink.** Deciding between a dedicated `ai_usage_log` table and extending `telemetry_log` — and choosing its columns — is a **schema design decision**, and this plan does not make schema design decisions. A chosen-in-passing table would ship with three unplanned consequences: **no RLS negative test** (plan Task 1.5 `test-rls.ts` Phần 8 covers `payment_orders`, `subscriptions` and `record_payment_settlement` only), **no gate-A allowlist coverage** (plan Task 1.2 allowlist is `payment_orders`), and **no stated grants, retention or FK target**.

## Target Files
- [ ] `docs/design/subscription-backend-design.md` (new escalation row + the withdrawal statement + the requested-revision block)

## Investigation Targets
- `docs/design/subscription-backend-design.md` (`:79` Non-scope entry; `:145` Existing Codebase Analysis entry; the existing escalation rows E-01/E-02 — copy their shape)
- `SOURCE/lib/ugc/quotaTracker.ts` (`recordUsage()` — the process temp file write target, the token split it already records, and the `role` dimension)
- `SOURCE/lib/supabase/service-role.ts` (the write path a designed sink would use)
- `SOURCE/supabase/schema.sql` (§ 17 fingerprint insert at `:1597` — the fingerprint impact any new table would carry)
- `docs/plans/subscription-work-plan.md` (§ Engineer-owned open items — rows BU-4 and BU-6)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and quote `:79` and `:145` verbatim
- [ ] Confirm by search that **no** backend DD schema section designs the sink (record the search performed and its result)
### 2. Green Phase
- [ ] Add the escalation row naming which statement is withdrawn; add the requested-revision content list; record the Task 1.6 / BU-4 consequence
### 3. Refactor Phase
- [ ] Re-read the amended document and confirm it contains **no instruction to choose a schema alternative**

## Operation Verification Methods
- **Verification method**: read the new escalation row against the two quoted statements; then grep the plan and the backend DD for any surviving instruction that would have an implementer pick `ai_usage_log` or extend `telemetry_log`.
- **Success criteria**: **BU-6 is recorded in the plan and the escalation row exists in the backend DD**; the DD revision is **requested, not assumed**; the search returns **zero** instructions to choose a schema alternative.
- **Failure response**: if any surviving text asks an implementer to choose a sink or its columns, remove it in this task — that instruction is the defect BU-6 exists to prevent.
- **Verification level**: L3 (document consistency; no code path is exercised).

## Proof Obligations
- **Claim**: the undesigned sink is visibly escalated, and no downstream task is authorised to design it in passing.
- **Primary failure mode**: an implementer resolves the `:79`/`:145` contradiction by inventing a table, shipping a money-adjacent table with no RLS negative test, no allowlist coverage and no stated grants.
- **Boundary to exercise**: document-to-document consistency (the DD escalation row and the plan BU-6 row must name the same withdrawal and the same downstream chain).
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: does not unblock plan Task 1.6 — **this task is complete when the escalation is raised**; Task 1.6 stays blocked until the requested revision lands.

## Completion Criteria
- [ ] The escalation row exists in `docs/design/subscription-backend-design.md`, stating which of `:79` / `:145` is withdrawn
- [ ] The requested revision lists all six required design elements (table name, column list incl. token split + `role`, FK + `on delete`, RLS policies, revokes/grants, §17 fingerprint impact)
- [ ] BU-6 downstream chain is recorded as **BU-6 → Task 1.6 → BU-4 → Task 6.8**
- [ ] **No task instructs an implementer to choose a schema alternative** — verified by search
- [ ] Plan Task 1.6 remains blocked-on-design; no sink DDL is written in this task or in plan Task 1.1

## Notes
- Impact scope: `docs/design/subscription-backend-design.md`; downstream, plan Tasks 1.1, 1.5, 1.6, 6.6, 6.8.
- Scope boundary: **no DDL, no schema edit, no code.** `SOURCE/supabase/schema.sql` is untouched by this task.
- Owner of the unblocking action: **the backend Design Doc owner** (a design revision, not an engineer input decision).
