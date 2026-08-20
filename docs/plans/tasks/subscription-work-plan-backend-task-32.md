# Task: Security review — walk ADR-0014 end to end against the shipped code

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.4**
Layer: **backend** (review across schema, server modules, routes and scripts)

Metadata:
- Dependencies: backend-task-31 (full regression green)
- Provides: the security sign-off in the plan Completion Criteria
- Size: Small (no source file changed unless a finding requires it)

## Implementation Content

Walk ADR-0014 end to end against the shipped code and confirm, each as a Y/N answer with evidence:

- **zero client write paths** to either new table (RLS + explicit revokes + no write policy);
- **identity is never a parameter** — `record_payment_settlement` takes an `order_code`, the beneficiary comes from the row;
- **exactly one** unauthenticated write path;
- **P-1 holds** — no `transactions[]` field persisted or logged; `getPaymentStatus()` return carries exactly two properties; the `payment_orders` column set is exactly eleven;
- **no enumeration oracle** on either the read or the action path;
- refusal reasons are a **closed set of codes**, and **no raw payload or bank identifier reaches any log**;
- `npm run check:bundle` covers the **checksum key**, the **API key** and the **`record_payment_settlement` marker**;
- both new routes are **private and dot-free**, and **no CSP change shipped**.

## Target Files
- [x] (none — no finding required a fix; nothing outside this file and the work plan was written)
- [x] Record each confirmation with file:line or command evidence in the plan Phase 6 Notes

## Investigation Targets
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Architecture Impact)
- `SOURCE/supabase/schema.sql` (the RLS policies, the revokes, the grants, the eleven-column allowlist)
- `SOURCE/supabase/test-rls.ts` (Phần 8 results)
- `SOURCE/lib/billing/settleOrder.ts`, `SOURCE/lib/billing/orderActions.ts`, `SOURCE/lib/billing/payos/`
- `SOURCE/app/api/payments/payos/webhook/route.ts`, `SOURCE/lib/supabase/middleware.ts`
- `SOURCE/scripts/check-ai-key-bundle.mjs`
- `SOURCE/lib/security/csp.ts` (**frozen** — confirm unmodified)
- `docs/design/subscription-backend-design.md` (§ Security Considerations)
- `docs/design/subscription-frontend-design.md` (§ Security Considerations)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1) | state-lifecycle-negative | **P-1 (normative).** No field of the provider `transactions[]` may be persisted to any column or reach any log. `settleOrder()` reads exactly **two** values from the provider response — the order `status` and its `amount` | No column, log line or persisted record in the shipped code carries a `transactions[]`-derived field, and `getPaymentStatus()` return has exactly two properties |

## Implementation Steps
### 1. Read
- [x] Read every Investigation Target and record the current state per checklist item
### 2. Verify
- [x] Answer each checklist item Y/N with file:line or command evidence
### 3. Route
- [x] Any `N` is routed to the owning task as a defect, with the ADR clause it violates named — **no `N` occurred**; two residuals (OP-11 a/b) and three non-blocking findings are recorded in the plan's Task 6.4 block instead

## Operation Verification Methods
- **Verification method**: a document-driven code walk with evidence per item, plus re-reading the `test-rls.ts` Phần 8 and `check:bundle` outputs.
- **Success criteria**: every checklist item answers `Y` with evidence; `SOURCE/lib/security/csp.ts` unmodified; both new routes private and dot-free.
- **Failure response**: an `N` on a client write path, on identity-as-parameter, or on P-1 blocks the pre-sale gate — route it back rather than accepting it with a note.
- **Verification level**: L3 (review), backed by the L1 evidence from `test-rls.ts` and gate B.

## Proof Obligations
- **Claim**: the shipped implementation matches ADR-0014 trust boundary in every clause.
- **Primary failure mode**: a clause is assumed satisfied because a test with a similar name passes — for example assuming P-1 holds because the adapter test passed, without checking the persisted column set and the log lines.
- **Boundary to exercise**: the shipped code and the live policies, read directly.
- **State assertion**: N/A (review).
- **Mock boundary rationale**: none.
- **Residual**: a genuine payOS delivery is only exercised in plan Task 6.7.

## Completion Criteria
- [x] Every checklist item answered `Y` with file:line or command evidence
- [x] The Reference Contracts Compliance Check evaluates to `Y`
- [x] `SOURCE/lib/security/csp.ts` unmodified; no CSP change shipped

## Investigation Notes

Recorded during the Task 6.4 walk at `a7d3038`. The full evidence table lives in
`docs/plans/subscription-work-plan.md` § "Task 6.4 — security review"; this section
records only what the walk learned about the targets themselves.

**Corrections to this task file, found while executing it.** The Operation
Verification section says to re-read `test-rls.ts` **"Phần 8"**. Phần 8 is the User
Support System block (`ST-a…ST-e`, `test-rls.ts:1729`); the subscription block is
**Phần 9** (`:1965`), and it carries **20** checks, not the 16 that
`backend-task-13.md`'s pre-revision "Exit-gate evidence" section lists — the final
set is in that file's "Revision after integration-test-reviewer" section. Observed
this run: `PO-a…PO-f` (8) + `SB-a…SB-g` (8) + `PS-a`/`PS-b` incl. the service_role
callability control (3) + the teardown post-check (1) = **20**, all green.

**Investigation Targets, as found.**

- `ADR-0014` § Decision / Implementation Guidance / Architecture Impact — four
  decisions plus the "write-path count 0 → 1" clause from ADR-0017. Every clause maps
  to a shipped construct; none is aspirational.
- `supabase/schema.sql:1603-1791` — the two tables, four revokes, two select-only
  policies, and `record_payment_settlement`. The function is **`INVOKER`**, so the
  table-level revokes sit underneath it as a second gate.
- `supabase/test-rls.ts` — Phần 9, re-run this session against dev
  (`hynwleaxtbtjzkvpjsug`), exit 0. Prod never contacted.
- `lib/billing/settleOrder.ts` — four steps, provider query at step 2 strictly before
  the write at step 4; five refusal literals, all values, never exceptions.
- `lib/billing/orderActions.ts:267-294` — `recheckOrder()` is where ownership scoping
  lives; `settleOrder()` deliberately has no caller identity because its other trigger
  (the webhook) has none.
- `lib/billing/payos/` — `index.ts:209-227` `getPaymentStatus()` returns exactly
  `{status, amount}`; `signature.ts` contains **no log call at all**, and takes
  `rawBody: string`, parsing it exactly once.
- `app/api/payments/payos/webhook/route.ts` — a shell with no business logic: read
  text, verify, forward one number. 200 on every reached decision; the only non-2xx
  path is an uncaught internal incident, deliberately not wrapped.
- `lib/supabase/middleware.ts:43-89, :161-163` — segment-wise matching; the webhook
  entry opens no sibling under `/api`.
- `scripts/check-ai-key-bundle.mjs:85-124` — covers all three payOS credentials and
  the `record_payment_settlement` marker. Mechanism verified by an isolated
  positive/negative control run.
- `lib/security/csp.ts` — **frozen and unmodified**: byte-identical to `5a77912`
  (2026-08-09), before subscription work began.
- Both Design Docs § Security Considerations — consistent with the code, with the
  single exception of **OP-4** (`subscription-backend-design.md:988` "raw bytes" vs the
  Serialized Format cell on the same row). Re-confirmed: the **code is right, the prose
  is wrong**; owned by a documentation-hygiene pass, not touched here.

**Reference Contracts — Compliance Check evaluation.**

| Row | Planned/actual approach | Evaluation | Rationale |
|---|---|---|---|
| P-1 (state-lifecycle-negative) | Verify by three independent observations: repo-wide grep for `transactions[]`-derived names outside tests; enumeration of every `console.*` on the payment path; live column count from dev PostgREST | **Y** | No column, log line or persisted record carries a `transactions[]`-derived field (grep returns only comments; live `payment_orders` = 11 columns), and `getPaymentStatus()`'s return is asserted by property **count** (`adapter.test.ts:155-158`), against a fixture that does contain the forbidden fields |

**Scope.** Review only. No source file changed; the only writes were this file and
`docs/plans/subscription-work-plan.md`.

## Notes
- Impact scope: review only.
- Scope boundary: findings are routed to the owning task; this task does not patch other modules.
