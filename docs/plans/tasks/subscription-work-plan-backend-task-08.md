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
- [x] `docs/design/subscription-backend-design.md` (new escalation row + the withdrawal statement + the requested-revision block)

## Investigation Targets
- `docs/design/subscription-backend-design.md` (`:79` Non-scope entry; `:145` Existing Codebase Analysis entry; the existing escalation rows E-01/E-02 — copy their shape)
- `SOURCE/lib/ugc/quotaTracker.ts` (`recordUsage()` — the process temp file write target, the token split it already records, and the `role` dimension)
- `SOURCE/lib/supabase/service-role.ts` (the write path a designed sink would use)
- `SOURCE/supabase/schema.sql` (§ 17 fingerprint insert at `:1597` — the fingerprint impact any new table would carry)
- `docs/plans/subscription-work-plan.md` (§ Engineer-owned open items — rows BU-4 and BU-6)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and quote `:79` and `:145` verbatim
- [x] Confirm by search that **no** backend DD schema section designs the sink (record the search performed and its result)
### 2. Green Phase
- [x] Add the escalation row naming which statement is withdrawn; add the requested-revision content list; record the Task 1.6 / BU-4 consequence
### 3. Refactor Phase
- [x] Re-read the amended document and confirm it contains **no instruction to choose a schema alternative**

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
- [x] The escalation row exists in `docs/design/subscription-backend-design.md`, stating which of `:79` / `:145` is withdrawn
- [x] The requested revision lists all six required design elements (table name, column list incl. token split + `role`, FK + `on delete`, RLS policies, revokes/grants, §17 fingerprint impact)
- [x] BU-6 downstream chain is recorded as **BU-6 → Task 1.6 → BU-4 → Task 6.8**
- [x] **No task instructs an implementer to choose a schema alternative** — verified by search. **Qualified, deliberately**: zero in the active plan, its task files and every Design Doc. **One survives outside that set**, in the *superseded* `docs/plans/subscription-backend-work-plan.md:50`; it is outside this task's Target Files and is reported rather than silently edited — see Investigation Notes
- [x] Plan Task 1.6 remains blocked-on-design; no sink DDL is written in this task or in plan Task 1.1

## Notes
- Impact scope: `docs/design/subscription-backend-design.md`; downstream, plan Tasks 1.1, 1.5, 1.6, 6.6, 6.8.
- Scope boundary: **no DDL, no schema edit, no code.** `SOURCE/supabase/schema.sql` is untouched by this task.
- Owner of the unblocking action: **the backend Design Doc owner** (a design revision, not an engineer input decision).

## Investigation Notes

### Line-number drift found in the plan's citations (recorded, not silently followed)

The plan and this task file cite the two contradicting statements as `:79` and `:145`. On disk in `docs/design/subscription-backend-design.md` (v1.7) they are at **`:81`** and **`:147`**. The plan's own v1.3 changelog predicted this and named BU-6's pair as *"Task 0.9's escalation subject"*. Per the backend DD's own v1.4 citation rule (*cite the identifier plus a quoted phrase for artifacts under concurrent revision*), the escalation row cites both statements **by section name plus verbatim quote**, and does not re-pin a line number that will rot again.

Verbatim, as they stand:

- `:81`, § Agreement Checklist → Non-scope: *"**U2's measurement infrastructure.** `quotaTracker.ts`'s durable write target is named as remaining work, not built here."*
- `:147`, § The one PRD claim this document had to correct before designing against it: *"**What remains, and why it lands here**: the write target is still a process temp file, which does not survive across Vercel serverless instances. Measuring on production needs a durable target — a schema change, therefore this document's business, not a patch's."*

### Which statement is withdrawn, and why that direction

`:147` is withdrawn **as a statement of this document's current scope**; the Non-scope entry at `:81` **stands**. The direction is decided by what the document actually contains, not by preference: its schema sections design `payment_orders` (`:345`), `subscriptions` (`:405`), `record_payment_settlement()` and the `telemetry_log.error_code` alter — four blocks, none of them a usage sink. A document that does not design the sink cannot claim the sink is already its business. The correct half of `:147` — that a durable target requires a schema change, therefore a design decision rather than a patch — is preserved and re-issued as a **request for a future revision**.

### Investigation Targets read

- `SOURCE/lib/ugc/quotaTracker.ts` — `recordUsage(role, model, usage)` at `:84`. Writes `writeFileSync(QUOTA_FILE_PATH, …)` at `:106`, where `QUOTA_FILE_PATH = path.join(tmpdir(), "ms-molar-ugc-quota.json")` (`:23`) — the process temp file. The record shape it already produces is exactly what a designed sink must carry: `ts`, `role`, `model`, `totalTokens`, `inputTokens` (`promptTokenCount`), `outputTokens` (`candidatesTokenCount + thoughtsTokenCount`, `:92` — thinking tokens billed at output rate). `QuotaRole` is a closed set of four: `"questions" | "answers" | "metadata" | "tutor"` (`:33`). The file's own header comment (`:8-14`) already states the defect and the required resolution: *"Muốn đo thật trên production thì phải đổi đích ghi sang DB; đó là quyết định có DDL nên thuộc Design Doc"*.
- `SOURCE/lib/supabase/service-role.ts` — the write path a designed sink would use. Every export is a **narrow named operation**; `serviceRoleClient()` is deliberately private (`:29`) and the file's header forbids exporting a general admin client. So the sink's write is not "insert a row from anywhere": it is one more named operation here, and the design must say whether enforcement lives in a SQL function (the `record_exam_result` / `record_skill_mastery` precedent) or in a direct insert.
- `SOURCE/supabase/schema.sql` — § 17 at `:1597`, `schema_version` at `:1615`, fingerprint insert at `:1635` (`'d714c313fe1d'`), between the `@schema-fingerprint-begin/end` markers, and the file states the block **must remain the file's last statement**. The same literal is mirrored in `SOURCE/lib/schema/schemaFingerprint.ts:41`. Any new table therefore carries a recomputation of **two** values in one commit — that is the §17 fingerprint impact the requested revision must state.
- `docs/plans/subscription-work-plan.md` — BU-4 (`:307`) and BU-6 (`:309`) already exist, and `:311` already records the chain **BU-6 → Task 1.6 → BU-4 → Task 6.8**. So the plan half of this escalation was already in place; what was missing was the backend DD half.

### Search performed for "no DD schema section designs the sink" — with positive controls

The searches below are constructed so they **can** return a non-zero result; each is paired with a positive control proving the pattern finds real design sections in the same file.

**Positive control A** — `grep -nic "create table" docs/design/subscription-backend-design.md` → **5** hits; `:345 create table if not exists public.payment_orders`, `:405 create table if not exists public.subscriptions`, plus three prose mentions. The pattern finds designed tables.

**Positive control B** — `grep -nic "create policy\|row level security\|grant \|revoke "` → **22** hits; `:387` / `:420` enable RLS, `:399 create policy "orders_select_own"`, `:426 create policy "subscriptions_select_own"`. The pattern finds designed RLS.

**Search 1** — `grep -rn "ai_usage_log\|usage_log\|ai_usage\|token_usage\|usage_record" docs/ SOURCE/ --include=*.md --include=*.sql --include=*.ts --include=*.tsx` → **8** hits, **zero** in `docs/design/subscription-backend-design.md` and **zero** in `SOURCE/supabase/schema.sql`. Seven of the eight are prohibitions or records in the current plan and its task files. The eighth is the residual recorded below.

**Search 2** — `grep -ni "quotatracker\|recordusage\|usagemetadata\|durable" docs/design/subscription-backend-design.md` → **5** hits: `:81` (Non-scope), `:143`, `:145`, `:147` (all § analysis prose) and `:1402` (a changelog row). **No hit falls inside a schema block.** Confirms the traceability finding: the only source was an *analysis* section, and an analysis section is not a design element.

**Search 5** — `grep -rn "sink" docs/ --include=*.md` → every occurrence in the repository's documentation, classified. All are prohibitions, records, blocked-task markers or unrelated ("Hardest sort", "sink below") **except one**, below.

### ⚠ Residual found — one surviving instruction to choose a schema alternative, in a **superseded** plan

`docs/plans/subscription-backend-work-plan.md:50` reads: *"Decide the sink **before** writing DDL — a dedicated `ai_usage_log` table, or extending `telemetry_log`. Prefer a dedicated table: `telemetry_log` is CHECK-constrained to two `event_type`s and deliberately carries no numeric columns."* That is precisely the defect BU-6 exists to prevent — an implementer told to choose the sink and given a preference.

It is **not edited by this task**, for a stated reason rather than an oversight: that file is `subscription-backend-work-plan.md` **v1.0**, explicitly superseded (`docs/plans/subscription-work-plan.md:9`, `docs/plans/subscription-HANDOFF.md:39` — *"backend-only and superseded"*), it is outside this task's Target Files, and it is a historical record whose *whole* body is stale (three DDL sections against the current plan's four, backend DD v1.0 against the current v1.7). Editing one bullet of a superseded plan would leave the rest equally misleading while damaging the audit trail. **Reported to the orchestrator for a scope decision.** The claim this task makes is therefore the exact one the evidence supports: **zero surviving instructions to choose a schema alternative in the active plan, its task files, or any Design Doc** — not "zero anywhere".
