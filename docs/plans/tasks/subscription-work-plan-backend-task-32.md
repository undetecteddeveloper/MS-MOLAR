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
- [ ] (none — unless a finding requires a fix, which is routed to the owning task)
- [ ] Record each confirmation with file:line or command evidence in the plan Phase 6 Notes

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
- [ ] Read every Investigation Target and record the current state per checklist item
### 2. Verify
- [ ] Answer each checklist item Y/N with file:line or command evidence
### 3. Route
- [ ] Any `N` is routed to the owning task as a defect, with the ADR clause it violates named

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
- [ ] Every checklist item answered `Y` with file:line or command evidence
- [ ] The Reference Contracts Compliance Check evaluates to `Y`
- [ ] `SOURCE/lib/security/csp.ts` unmodified; no CSP change shipped

## Notes
- Impact scope: review only.
- Scope boundary: findings are routed to the owning task; this task does not patch other modules.
