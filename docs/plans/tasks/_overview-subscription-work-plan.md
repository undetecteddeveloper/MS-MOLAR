# Overall Design Document: Subscription (payOS prepaid period)

Generation Date: 2026-08-18
Target Plan Document: `docs/plans/subscription-work-plan.md` (**v1.2**, approved — `approved_with_conditions`, all conditions applied)
Branch: `feat/subscription`
App root: **`SOURCE/`, not the repository root.** Every `npm` script runs from `SOURCE/`.

## Project Overview

### Purpose and Goals

Replace the fail-closed entitlement stub with a working paid tier: sell a 30-day prepaid Premium period through payOS, derive entitlement from **one timestamp at read time**, put both AI cost paths behind per-plan period quotas plus a project-wide daily budget (closing TD-022), and draw the two user surfaces that make purchase and recovery reachable (`/me/orders`, `/pricing/checkout`).

### Background and Context

The UI phase shipped first (S-01…S-04, `EntitlementProvider`, the frozen `lib/billing/types.ts`), leaving one deliberate seam — `readEntitlement()` body — and one deliberate gap: the provider is mounted in `(billing)` only, while every gated component renders in `(layer2)` / `(layer4)`. There is **no payment code of any kind** and no `payment_orders` / `subscriptions` table. Both Design Docs select **Hybrid** (a thin horizontal foundation, then vertical slices) with the schema as a hard gate in front of everything.

## Task Division Design

### Division Policy

- **Structure: Option A — Vertical Slice**, with **one horizontal foundation phase in front** (the schema gate), per both Design Docs Hybrid selection. Each phase from 2 onward contains both backend and frontend work for the same feature area.
- **Granularity: 1 plan task = 1 task file = 1 commit.** The plan states this 1:1 rule inline for Phase 0 and uses it throughout, so no plan task was merged or split for size.
- **Layer assignment is factual, from Target files**, not inferred:
  - `SOURCE/components/**`, `SOURCE/app/**` page/layout/component files, `SOURCE/lib/format/**`, `SOURCE/lib/i18n/**` → **frontend**
  - `SOURCE/lib/billing/**`, `SOURCE/lib/security/**`, `SOURCE/lib/ugc/**`, `SOURCE/lib/tutor/**`, `SOURCE/supabase/**`, `SOURCE/app/api/**` → **backend**
  - documents (`docs/**`) and repo build config (`SOURCE/vitest*.config.ts`, `SOURCE/package.json`, `SOURCE/.env.example`, `SOURCE/scripts/**`) → **backend** (deterministic rule)
  - test lanes follow what they exercise: `SOURCE/tests/e2e/fixture/**` renders React route trees → **frontend**; `SOURCE/tests/integration/**` and `SOURCE/tests/e2e/service/**` hit real Postgres → **backend**
- **Verification level distribution**: L1 at the two ★ early verification points (plan Tasks 2.2/2.5 and 3.8), at gate B (plan Tasks 1.3, 5.8), at the service lane (plan Tasks 6.1, 6.2) and at the manual passes (plan Tasks 6.5, 6.7); L2 for the mocked-boundary unit and integration work; L3 for the Phase 0 configuration and document tasks.

### Task counts

| Layer | Files | Numbers |
|---|---|---|
| backend | **35** | `subscription-work-plan-backend-task-01.md` … `-35.md` |
| frontend | **15** | `subscription-work-plan-frontend-task-01.md` … `-15.md` |
| **Total executable tasks** | **50** | |
| Phase completion checklists | 7 | `subscription-work-plan-phase{0..6}-completion.md` |
| **Not emitted (blocked)** | 1 | ⛔ plan Task 1.6 — see below |

### Plan task → task file map

| Phase | Plan task | Task file | Layer |
|---|---|---|---|
| 0 | 0.1 | backend-task-01 | backend |
| 0 | 0.2 | backend-task-02 | backend |
| 0 | 0.3 | backend-task-03 | backend |
| 0 | 0.4 | backend-task-04 | backend |
| 0 | 0.5 | backend-task-05 | backend |
| 0 | 0.6 | backend-task-06 | backend |
| 0 | 0.7 | **frontend-task-01** | frontend |
| 0 | 0.8 | backend-task-07 | backend |
| 0 | 0.9 | backend-task-08 | backend |
| 1 | 1.1 | backend-task-09 | backend |
| 1 | 1.2 | backend-task-10 | backend |
| 1 | 1.3 ⚠ manual | backend-task-11 | backend |
| 1 | 1.4 | backend-task-12 | backend |
| 1 | 1.5 | backend-task-13 | backend |
| 1 | ⛔ 1.6 | **not emitted** | — |
| 2 | 2.1 | backend-task-14 | backend |
| 2 | 2.2 | frontend-task-02 | frontend |
| 2 | 2.3 | frontend-task-03 | frontend |
| 2 | 2.4 | frontend-task-04 | frontend |
| 2 | 2.5 | frontend-task-05 | frontend |
| 3 | 3.1 | backend-task-15 | backend |
| 3 | 3.2 | backend-task-16 | backend |
| 3 | 3.3 | backend-task-17 | backend |
| 3 | 3.4 | backend-task-18 | backend |
| 3 | 3.5 | backend-task-19 | backend |
| 3 | 3.6 | frontend-task-06 | frontend |
| 3 | 3.7 | frontend-task-07 | frontend |
| 3 | 3.8 ★ | frontend-task-08 | frontend |
| 3 | 3.9 | frontend-task-09 | frontend |
| 4 | 4.1 | backend-task-20 | backend |
| 4 | 4.2 | frontend-task-10 | frontend |
| 4 | 4.3 | frontend-task-11 | frontend |
| 4 | 4.4 | frontend-task-12 | frontend |
| 4 | 4.5 | frontend-task-13 | frontend |
| 4 | 4.6 | frontend-task-14 | frontend |
| 5 | 5.1 | backend-task-21 | backend |
| 5 | 5.2 | backend-task-22 | backend |
| 5 | 5.3 | backend-task-23 | backend |
| 5 | 5.4 | backend-task-24 | backend |
| 5 | 5.5 | backend-task-25 | backend |
| 5 | 5.6 | backend-task-26 | backend |
| 5 | 5.7 | backend-task-27 | backend |
| 5 | 5.8 ⚠ manual | backend-task-28 | backend |
| 6 | 6.1 | backend-task-29 | backend |
| 6 | 6.2 | backend-task-30 | backend |
| 6 | 6.3 | backend-task-31 | backend |
| 6 | 6.4 | backend-task-32 | backend |
| 6 | 6.5 ⚠ manual | frontend-task-15 | frontend |
| 6 | 6.6 | backend-task-33 | backend |
| 6 | 6.7 ⚠ manual, blocked BU-1 | backend-task-34 | backend |
| 6 | 6.8 ⚠ manual, blocked BU-1/BU-4/BU-5 | backend-task-35 | backend |

## ⛔ Blocked and not schedulable: plan Task 1.6 (durable AI usage-log sink)

**No executable task file was generated for plan Task 1.6.** It is deliberately quarantined.

| Field | Value |
|---|---|
| Blocked by | **BU-6** — the backend Design Doc contradicts itself (`:79` lists the sink under Non-scope; `:145` says it is that document business) and **no Design Doc schema section designs the table** |
| Owner of the unblocking action | **The backend Design Doc owner** — this is a **design revision**, not an engineer input decision and not an implementation choice |
| Unblocking condition | A backend DD revision that **designs** the sink: table name, full column list (input/output token split incl. `thoughtsTokenCount`, plus the `role` dimension), the FK and its `on delete` (TD-011), RLS policies, the explicit revokes/grants, and the §17 fingerprint impact |
| Raised by | Plan Task 0.9 → `subscription-work-plan-backend-task-08.md` (**this task is schedulable and is emitted normally**) |
| Prohibition | **No task in this plan may choose the sink.** Deciding between a dedicated `ai_usage_log` table and extending `telemetry_log` — or choosing its columns — is a schema design decision this plan does not make |
| When it lands | Ship it as its **own** DDL block with its own traceability row, its own gate-A allowlist coverage, its own plan Task 1.5 denial group, and its own hand-apply — **not smuggled into plan Task 1.1** |
| Downstream chain | **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Nothing in Phases 1–5 depends on it; **Phase 1 completes without it** |

## Inter-task Relationship Map

```
Phase 0 (docs + build config; no product code)
  backend-01 (test:integration) ─────────────────────────────► backend-18 (INT-3)
  backend-02 (test:localdb) ──► backend-11 (gate B) ──► backend-29/30 (SVC-1/2)
  backend-03 (CL-02 amendment) ─── MUST PRECEDE ──► frontend-04 (TutorQuotaNote)
  backend-04 (ST-01) ──────────────────────────────► frontend-10 (S-06 route)
  backend-05, backend-06 (doc hygiene) ────────────► frontend-11 (C-13 superset)
  frontend-01 (fixture harness) ───────────────────► frontend-05/09/14 (FE-2/3/1)
  backend-07 (service fixtures) ───────────────────► backend-29/30
  backend-08 (BU-6 escalation) ⋯⋯ blocks ⋯⋯► [plan Task 1.6 — NOT EMITTED]

Phase 1 (backend + DB, horizontal foundation)
  backend-09 (DDL) ─► backend-10 (gate A) ─► backend-11 (⚠ dev apply + gate B)
                                                  ├─► backend-13 (test-rls Phần 8)
                                                  └─► backend-14 (readEntitlement)
  backend-12 (named values + periodStartEpoch) ─► backend-14, backend-17, backend-21, backend-26

Phase 2 (★ early verification point)
  backend-14 ─► frontend-02 (provider mounts) ─► frontend-04 ─► frontend-05 (FE-2)
  frontend-03 (formatters + C-09 + keys) ─► frontend-06

Phase 3
  backend-11 ─► backend-15 (adapter) ─► backend-16 (settleOrder) ─► backend-18
  backend-12 ─► backend-17 (toCheckoutOrder) ─► backend-18 ─► backend-19 (CL-01, INT-2)
  backend-19 ─► frontend-06 (S-05) ─► frontend-07 (C-10/C-11) ─► frontend-08 (★) 
  frontend-07 ─► frontend-09 (FE-3)

Phase 4
  backend-16 ─► backend-20 (webhook + PUBLIC_PATHS + bundle markers)
  backend-18 ─► frontend-10 (S-06) ─► frontend-11 (C-12..C-15) ─► frontend-12 (PurchaseCta)
  frontend-11 ─► frontend-13 (legal-gate test);  frontend-12 ─► frontend-14 (FE-1)

Phase 5
  backend-12 ─► backend-21 (quota.ts) ─► backend-22 (chokepoint) ─► backend-23 (tutor gate)
  frontend-02 ─► backend-21
  backend-22 ─► backend-24 (upload gate + INT-1)
  backend-21 ─► backend-25 (telemetry + OK-04) ─► backend-27 (AC-047), backend-28 (⚠ prod apply)
  backend-12 ─► backend-26 (B-01)

Phase 6
  backend-29 (SVC-1), backend-30 (SVC-2 — gate for S-05) ─► backend-31 (regression)
  ─► backend-32 (security review), frontend-15 (⚠ manual), backend-33 (close-out)
  ─► backend-34 (⚠ real money, blocked BU-1), backend-35 (⚠ pre-sale gate, blocked BU-1/4/5)
```

## Interface Change Impact Analysis

| Existing interface | New interface | Conversion required | Covering task |
|---|---|---|---|
| `readEntitlement(userId)` returning `FREE_FALLBACK` | same signature, real value | **No** — body only, signature unchanged so `(billing)/layout.tsx:27` keeps working | backend-14 |
| `getMyOrder(row)` inline camelCase mapping | `toCheckoutOrder(row)` | **Yes** — CL-01; only the mapping step changes | backend-17 → backend-19 |
| `TutorQuotaNote({ formattedResetDate? })` | `TutorQuotaNote()` — no props | **Yes** — prop retired; component self-formats from context | backend-03 (docs) → frontend-04 |
| `consumeQuota` — did not exist | `consumeQuota(kind, userId, ent, geminiCalls)` — 4th param **required, no default** | n/a (new) — omission is a **compile error**, deliberately | backend-21 |
| four direct `client.models.generateContent` call sites | one exported wrapper + `GEMINI_CALLS_PER_OPERATION` | **Yes** — four call sites converted; `GEMINI_REQUESTS_PER_CALL` becomes a consumer | backend-22 |
| `LIMITS.MAX_UPLOADS_PER_DAY` DB-count check at `actions.ts:331-343` | `consumeQuota("upload", …)` ahead of `:268` | **Yes** — old check **deleted**, not run in parallel; output comparison on refusal reason + counter delta | backend-24 |
| `TELEMETRY_ERROR_CODES` (4 literals) | 6 literals | **Yes** — SQL side in backend-09, code side in backend-25; `telemetry.test.ts:261` must pass **unmodified** | backend-09 + backend-25 |
| `RATE_LIMITS.explainStep.limit = 3` | tier-conditional 3 / 50, `windowMs` 24h both | **Yes** — plain conditional at the definition site; four existing assertion blocks unmodified | backend-26 |

## Common Processing Points

- **One period-start derivation**: `periodStartEpoch(plan, anchor, createdAt, now)` declared **once** in `SOURCE/lib/billing/quota.ts` (backend-12), **imported** by the read path (backend-14) and the write path (backend-21). A repo-wide search for the `quota:` key template must return **exactly one** construction site; the byte-identity assertion across both paths lands in backend-21.
- **One mapper**: `toCheckoutOrder(row)` in `SOURCE/lib/billing/checkoutOrder.ts` (backend-17), used by `createOrder()` (backend-18) and `getMyOrder()` (backend-19). `pendingUntil` is always `new Date(row.pending_until).toISOString()` — the `…Z` form with milliseconds.
- **One window constant**: `ORDER_PENDING_WINDOW_MS` (backend-12) feeds `payment_orders.pending_until`, payOS `expiredAt`, **and** `createOrder()` step (0) reuse predicate.
- **One settlement path**: `settleOrder(orderCode)` (backend-16), invoked from exactly two triggers — `recheckOrder()` (backend-18) and the webhook (backend-20).
- **One provider boundary**: `SOURCE/lib/billing/payos/**` (backend-15). No payOS vocabulary escapes it.
- **One badge**: `OrderStatusBadge` (frontend-03) — three consumers across both screens.
- **Shared formatters**: `SOURCE/lib/format/{datetime,number}.ts` (frontend-03), consumed by frontend-04, 06, 07, 11.

## Test skeleton ownership (fill instructions and their owning task)

The three skeleton files **already exist on disk** and are comments-only until their owning task fills them.

| Case | Skeleton file | Filled in | Task file |
|---|---|---|---|
| **INT-3** | `SOURCE/tests/integration/subscription.int.test.ts` | the **same commit** as plan Task 3.4 (`createOrder()` reuse branch) | backend-task-18 |
| **INT-2** | same file | the **same commit** as plan Task 3.5 (`getMyOrder()` mapping change) | backend-task-19 |
| **INT-1** | same file | plan Task 5.4 (upload gate) | backend-task-24 |
| **FE-2** | `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` | **Phase 2** | frontend-task-05 |
| **FE-3** | same file | **Phase 3** | frontend-task-09 |
| **FE-1** | same file | **Phase 4** | frontend-task-14 |
| **SVC-1** | `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` | **executes in Phase 6 only** | backend-task-29 |
| **SVC-2** | same file | **executes in Phase 6 only** | backend-task-30 |

Cumulative resolution by phase: Phase 2 → fixture 1/3; Phase 3 → integration 2/3, fixture 2/3; Phase 4 → fixture 3/3; Phase 5 → integration 3/3; Phase 6 → service 2/2, **unresolved tests: 0**.

## Manual, blocking and blocked checkpoints

| Task file | Plan task | Kind | Note |
|---|---|---|---|
| backend-task-11 | 1.3 | ⚠ **BLOCKING MANUAL** | Hand-apply DDL to **dev**, then gate B. Engineer-performed. **Failure stops the phase.** Has failed silently three times in this repository |
| backend-task-28 | 5.8 | ⚠ **MANUAL** | Apply identical DDL to **prod**, gate B on prod, content verified by a **real counting query, not a fingerprint comparison**. Failure: **stop, do not deploy the AI gates** |
| frontend-task-15 | 6.5 | ⚠ **MANUAL** | Requires a human, `npm run pw` and a real mid-range Android. **A green unit test does not discharge FE-AC-26** |
| backend-task-34 | 6.7 | ⚠ **MANUAL, REAL MONEY — blocked on BU-1** | Cannot execute until legal content exists and the purchase control is enabled |
| backend-task-35 | 6.8 | ⚠ **MANUAL — blocked on BU-1, BU-4, BU-5** | BU-4 is itself blocked through **BU-6 → Task 1.6 → BU-4 → Task 6.8** |
| — | ⛔ 1.6 | **BLOCKED-ON-DESIGN, not emitted** | See the BU-6 section above |

## Deployment Sequencing (readable without opening a task body)

| End of phase | Production deploy permitted? | What must be green first |
|---|---|---|
| Phase 0 | **No** (nothing to deploy) | — |
| Phase 1 | **No** | Dev-only apply. Prod still has neither new table |
| Phase 2 | **No** — the code reads `subscriptions` | Plan Task 5.8 |
| Phase 3 | **No** — reads `payment_orders`, renders S-05 | Plan Task 5.8; **and** plan Task 6.2 (SVC-2) before S-05 is reachable by real users |
| Phase 4 | **No** — reads `payment_orders`, admits the webhook path | Plan Task 5.8; **and** plan Task 6.2 |
| **Phase 5** | **Yes — earliest permitted production deploy**, only after **plan Task 5.8** | Identical DDL on prod, gate B green on prod, widened CHECK present, verified by a real query |
| Phase 6 | Yes, with two further gates | Plan Task 6.2 before S-05 reaches real users; plan Task 6.8 before the purchase control is enabled |

Every task whose phase carries the negative check keeps the line **"No production deploy of this branch has occurred"** in its Completion Criteria.

## Implementation Considerations

### Principles to Maintain Throughout

1. **The schema is a phase, not a step.** Gate A (text-side, `readFileSync`, no DB) then gate B (DB-side, per environment) are its exit criteria. A matching fingerprint proves **which build** the database is running, **not** that its content is present.
2. **Assert on values and on row counts, never on "a call happened."** The recurring hollow-test shapes this feature must guard against are named in the backend DD `:1141`: asserting that `settleOrder` was called does not prove the amount was compared; asserting settlement succeeded does not prove the second replay wrote nothing.
3. **One producer per contract.** Period start, checkout mapping, pending window, settlement path, provider boundary — each has exactly one owner (see Common Processing Points).
4. **`npm run verify:schema` and `npm run check:bundle` are two distinct scripts.** Neither pipes into the other; both must be run separately.
5. **The frozen set is frozen**: `SOURCE/lib/billing/types.ts`, `entitlement.tsx`, `app/(billing)/layout.tsx`, `lib/security/csp.ts`, `lib/nav/items.ts`, `app/(layer4)/_components/StatusBadge.tsx`, `components/tutor/ExplainStepAffordance.tsx`.

### Risks and Countermeasures (carried from the plan)

- **Risk**: DDL correct in git and absent from a database (TD-005) — for a money table the failure shape is "payment taken, nothing written". **Countermeasure**: backend-09 / -10 / -11 and backend-28; the prod check is a **real counting query**, not a fingerprint comparison.
- **Risk**: the `telemetry_log` alter reaches git but not a database — **silent**, because telemetry writes are best-effort. **Countermeasure**: ships as **both** an inline edit and a drop/add pair (backend-09); backend-28 gates the AI-gate deploy; backend-27 asserts the inserts are **accepted**, not merely attempted.
- **Risk**: green-but-hollow tests. **Countermeasure**: every task carries its skeleton Proof obligations verbatim — invocation counts, byte-identity, deep equality, row counts.
- **Risk**: the provider is never mounted above the gated components — nothing fails to compile, no test goes red, and the UI simply keeps saying "Free". **Countermeasure**: frontend-02 render test **per layout** against the real tree, plus FE-2 (frontend-05).
- **Risk**: two mappings for one contract (CL-01). **Countermeasure**: backend-17 creates the single mapper; backend-19 makes `getMyOrder()` use it; INT-2 asserts deep equality plus the literal string form.
- **Risk**: a later reader "simplifies" step (0), the ownership pre-read, `period_anchor_at`, the four transfer columns, or `consumeQuota` fourth parameter — **none of them fails to compile**. **Countermeasure**: reasons written into column comments and contract clauses; tests assert invocation counts, deep equality and literal deltas.
- **Risk**: `npm test` goes red in CI for a missing database credential. **Countermeasure**: backend-01 and backend-02 create two **separate** configs scoped to their own directories; `npm test` stays untouched and green.

### Impact Scope Management

- **Allowed change scope**: exactly the Review Scope paths listed in the work plan header (backend, frontend, tests/config).
- **Preserved areas (no task may edit)**: `SOURCE/lib/billing/types.ts`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/security/csp.ts`, `SOURCE/lib/nav/items.ts`, `SOURCE/app/(layer4)/_components/StatusBadge.tsx`, `SOURCE/components/tutor/ExplainStepAffordance.tsx`.
- **Assertions that must pass unmodified**: `telemetry.test.ts:261`; `rateLimit.test.ts:127-135`, `:137-142`, `:166-171`, `:186-192`.

## Baseline measured this session

`vitest` **914 pass / 10 skip**; `npx tsc --noEmit` exit 0; `eslint` exit 0. One tutor test can exceed the 5000 ms default under cold-cache parallel load and passes in 684 ms alone — **a load flake, not a regression**; no task chases it.

## Task registration note

`TaskCreate` / `TaskUpdate` are **not available in this environment**. Registration tool calls were skipped; progress is tracked by the checkboxes in the work plan and in the seven phase-completion files in this directory.
