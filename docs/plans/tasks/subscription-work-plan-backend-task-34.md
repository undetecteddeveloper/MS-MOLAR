# Task: ⚠ MANUAL, REAL MONEY (U1 consequence) — one production transaction, blocked on BU-1

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.7**
Layer: **backend** (production operation)

Metadata:
- Dependencies: backend-task-28 (prod gate B), backend-task-31, backend-task-32; **and BU-1 cleared**
- Provides: the only evidence for signature verification against a genuine payOS delivery, and the measurement that resolves Assumed Behavior **A-6**
- Size: Small (no source file changed)

## ⚠ MANUAL and BLOCKED — do not execute as an agent

**This task moves real money on production and is engineer-performed and engineer-approved in advance.**

**Cannot execute until BU-1 (TBD-02, legal content) is cleared**, because a real transaction requires a user to reach an **enabled purchase control**, and C-15 keeps that control `aria-disabled` while `legalContentReady === false`. **Everything else in the Verification Strategy runs without it.**

## Implementation Content

- One **small-value** transaction on the **production** domain, engineer-approved in advance.
- **Register the webhook against production only** (Preview URLs change per build; Preview deployments verify through the authenticated R10 path instead).
- It verifies only what nothing else can reach: **signature verification against a genuine payOS delivery**, and **the registered webhook URL resolving**.
- **Instrument it** to record **every delivery of that `orderCode` with its timestamp** — this is the named method that resolves Assumed Behavior **A-6** (payOS retry policy, `Confirmed: No`).
- If the measurement shows **no retry at all**, the 200-for-refusals rule **stands unchanged**: its purpose is to avoid a retry storm, and no retries is the same outcome.

## Target Files
- [ ] (none — production operation; record the measurement in the plan Phase 6 Notes)

## Investigation Targets
- `SOURCE/app/api/payments/payos/webhook/route.ts` (the handler that will receive the genuine delivery)
- `SOURCE/lib/billing/payos/signature.ts` (`verifyWebhookSignature` — verified here against a real delivery for the first time)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)
- `docs/design/subscription-backend-design.md` (§ Assumed Behavior A-6)
- `docs/plans/subscription-work-plan.md` (§ Engineer-owned open items — BU-1)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | placement | "Register the webhook against the **production domain only**; Preview deployments verify through the authenticated R10 path instead" | The webhook is registered against the production domain and against no Preview URL |

## Implementation Steps
### 1. Pre-conditions
- [ ] Confirm BU-1 is cleared and the purchase control is enabled (plan Task 6.8)
- [ ] Confirm prod gate B is green (plan Task 5.8) and the full regression passed
- [ ] Obtain explicit engineer approval for a real-money transaction
### 2. Execute (engineer-performed)
- [ ] Register the webhook against production only; run one small-value transaction
- [ ] Record every delivery of that `orderCode` with its timestamp
### 3. Record
- [ ] Record the A-6 measurement result (retries observed, or none) in the plan Phase 6 Notes

## Operation Verification Methods
- **Verification method**: one real transaction on the production domain, with delivery instrumentation.
- **Success criteria**: the signature verifies against a genuine delivery; the registered webhook URL resolves; the delivery timeline for that `orderCode` is recorded.
- **Failure response**: if the signature fails against a genuine delivery, the adapter HMAC input construction is wrong — **stop and fix plan Task 3.1**, do not relax the verification.
- **Verification level**: L1 (production, real money).

## Proof Obligations
- **Claim**: signature verification works against a genuine payOS delivery, and the retry policy is measured rather than assumed.
- **Primary failure mode**: the HMAC verifies only for values that survive a JSON round trip, which no fixture-based test can reveal; and A-6 stays `Confirmed: No` while the 200-for-refusals rule is justified by an assumption.
- **Boundary to exercise**: the real payOS service against the production webhook route.
- **State assertion**: the order transitions `pending → paid` exactly once; `subscriptions.expires_at` advances by exactly one period.
- **Mock boundary rationale**: none — nothing is mocked; that is the point of this task.
- **Residual**: a single transaction measures one delivery pattern, not the provider full retry policy; record the observation as evidence, not as a guarantee.

## Completion Criteria
- [ ] BU-1 confirmed cleared before execution
- [ ] One production transaction completed with engineer approval
- [ ] Webhook registered against **production only**
- [ ] Every delivery of that `orderCode` recorded with its timestamp; A-6 updated with the measurement
- [ ] The Binding Decisions Compliance Check evaluates to `Y`
- [ ] **Or**: explicitly deferred, with BU-1 recorded as the reason (permitted by the plan Completion Criteria)

## Notes
- Impact scope: production; real money.
- Scope boundary: no Preview URL is registered as a webhook target.
