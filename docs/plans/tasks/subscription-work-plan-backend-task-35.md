# Task: ⚠ MANUAL / BLOCKED — pre-sale gate: enable selling

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.8**
Layer: **backend** (operational flag flip + engineer confirmations)

Metadata:
- Dependencies: **BU-1, BU-4 and BU-5** — and BU-4 is itself blocked through **BU-6 → plan Task 1.6 → BU-4 → this task**
- Provides: the enabled purchase control that makes plan Task 6.7 reachable at all
- Size: Small (no source file changed; one environment flag)

## ⚠ MANUAL and BLOCKED — engineer-owned confirmations, not agent-completable

**All three items below are engineer inputs.** An agent may assemble the evidence and report the state; it may not declare any of them satisfied.

## Implementation Content

Confirm **all** of the following before flipping `GEMINI_PAID_TIER_ENABLED` on:

- **BU-1** — both legal pages carry real content: `billing.terms.body` and `billing.refund.body` exist; the refund policy **names a legal selling entity** and has **no `[điền…]` placeholders**; and **a Terms of Service document exists** (none exists today, and R11 requires two pages).
- **BU-4** — U2 measurement complete **against the durable sink from plan Task 1.6**, under **933 VNĐ/extraction** and **58,5 VNĐ/tutor**. ⛔ **Plan Task 1.6 is blocked-on-design behind BU-6**, so this item is not satisfiable until the backend DD revision designs the sink. Sequence: **BU-6 → Task 1.6 → BU-4 → this task**.
- **BU-5** — the **14-day metric #9 baseline** measured **before** sales are enabled, not after, counting **`success = false` overall** (per AC-047 baseline caveat: a real 429 records as `server` today, so counting `gemini_unavailable` alone reads as an improvement that did not happen).

Then AC-048 operational verification (a real >20-request call) and the flag flip.

### Consequence of the flag, recorded

It is **the same flag** that raises `explainStep` ceiling (B-01). Turning it back **off** after subscriptions exist drops live Premium holders to **3/day** while they still hold a **500/period** entitlement — the correct direction, but an **incident action, not a routine toggle**.

## Target Files
- [ ] (none — an environment flag and three engineer confirmations; record the outcome in the plan Phase 6 Notes and Completion Criteria)

## Investigation Targets
- `docs/plans/subscription-work-plan.md` (§ Engineer-owned open items — BU-1, BU-4, BU-5, BU-6)
- `docs/legal/refund-policy.md` (the three `[điền…]` placeholders and the missing legal selling entity)
- `SOURCE/lib/i18n/dictionaries/en.ts` (whether `billing.terms.body` and `billing.refund.body` exist — the C-15 legal gate predicate)
- `SOURCE/app/(billing)/terms/page.tsx` and `SOURCE/app/(billing)/refund-policy/page.tsx` (the `LegalContentPending` render while the gate is closed)
- `SOURCE/lib/billing/paidTier.ts` (`:26`, `:28` — the flag and its fail-closed shape)
- `SOURCE/lib/security/rateLimit.ts` (the B-01 tier-conditional ceiling this flag also raises)
- `SOURCE/lib/ugc/quotaTracker.ts` (the process-temp-file sink BU-4 cannot measure against)

## Implementation Steps
### 1. Assemble
- [ ] Read all Investigation Targets and record, per item, the current evidence and what is missing
### 2. Confirm (engineer-performed)
- [ ] BU-1 confirmed; BU-4 confirmed (requires plan Task 1.6, which requires the BU-6 DD revision); BU-5 confirmed
### 3. Enable
- [ ] AC-048 operational verification (a real >20-request call), then flip `GEMINI_PAID_TIER_ENABLED`

## Operation Verification Methods
- **Verification method**: evidence review per item, then AC-048 operational verification after the flip.
- **Success criteria**: all three confirmations recorded with evidence; AC-048 verification passes; the ceiling reads `50`/24h after the flip (B-01).
- **Failure response**: **the sale date moves rather than two blank legal pages shipping.** If BU-4 cannot be satisfied because plan Task 1.6 is still blocked, record the chain BU-6 → Task 1.6 → BU-4 → this task and leave selling disabled.
- **Verification level**: L1 (a real user can complete a purchase once enabled).

## Proof Obligations
- **Claim**: selling is enabled only when the legal, cost and baseline preconditions are all satisfied.
- **Primary failure mode**: the flag is flipped because the code is finished, shipping an enabled purchase control beside a legal page that renders `LegalContentPending`.
- **Boundary to exercise**: the production environment flag and the rendered legal pages.
- **State assertion**: before — `legalContentReady === false`, control `aria-disabled`; after — real legal content, control enabled, `explainStep` ceiling 50/24h.
- **Mock boundary rationale**: none.
- **Residual**: BU-4 remains unsatisfiable while BU-6 is open; that is a **design-revision** dependency, not an implementation one.

## Completion Criteria
- [ ] BU-1, BU-4 and BU-5 each confirmed with evidence — **or** selling explicitly **not** enabled, with the open items named
- [ ] AC-048 operational verification recorded
- [ ] The off-switch consequence recorded as an **incident action, not a routine toggle**
- [ ] The BU-6 → Task 1.6 → BU-4 → Task 6.8 chain recorded in the plan close-out (plan Task 6.6)

## Notes
- Impact scope: production sales enablement.
- Scope boundary: this task makes no code change; the legal **content** is TBD-02 / BU-1 and is engineer-owned.
