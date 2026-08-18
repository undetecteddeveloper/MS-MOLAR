# Task: ST-01 — reconcile FE-B-01 and FE-B-02 as closed, and unblock slice S2

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.4**
Layer: **backend** (document under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none. **Scheduled early because it unblocks work** — the frontend Design Doc currently documents slice S2 (`/pricing/checkout`, plan Task 4.2) as un-startable.
- Provides: an accurate frontend DD Implementation Order that plan Task 4.2 (frontend-task-10) can start against
- Size: Small (1 document, four locations)

## Implementation Content

Backend Design Doc v1.4 **closes** FE-B-01 and FE-B-02. `docs/design/subscription-frontend-design.md` still carries them as blocking in **four** locations, so slice S2 reads as un-startable when it is in fact startable:

1. its Status line,
2. its "Blocking Unresolved Items" section,
3. its FE-I5 row,
4. its Implementation Order step 5.

Update all four to "closed in backend v1.4", **naming the resolution** in each, and remove the serialisation of S2 behind them.

**Leave FE-B-02 shipping condition intact as a *verification* requirement**: SVC-2 (plan Task 6.2) must pass before S-05 reaches real users. That is a genuine gate, not a design gap, and the Deployment Sequencing table depends on it.

## Target Files
- [ ] `docs/design/subscription-frontend-design.md` (Status line; Blocking Unresolved Items; FE-I5 row; Implementation Order step 5)

## Investigation Targets
- `docs/design/subscription-frontend-design.md` (§ Status; § Blocking Unresolved Items; the FE-I5 integration row; § Implementation Order step 5)
- `docs/design/subscription-backend-design.md` (the v1.4 statements that close FE-B-01 and FE-B-02 — quote the resolution, do not paraphrase it)
- `docs/plans/subscription-work-plan.md` (§ Deployment Sequencing — the Phase 3 and Phase 6 rows that keep FE-B-02 as a verification gate)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (SVC-2 — the case that discharges the retained verification gate)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; list the four locations with their current wording
- [ ] Record the exact backend v1.4 resolution sentence for each of FE-B-01 and FE-B-02
### 2. Green Phase
- [ ] Update all four locations to "closed in backend v1.4" with the named resolution; de-serialise S2
- [ ] Restate FE-B-02 shipping condition as a verification gate pointing at SVC-2 / plan Task 6.2
### 3. Refactor Phase
- [ ] Re-read the document end to end; confirm no location still describes either item as open or blocking

## Operation Verification Methods
- **Verification method**: grep the frontend Design Doc for `FE-B-01` and `FE-B-02` and read every hit in context.
- **Success criteria**: the frontend DD Implementation Order lists S2 as startable once `createOrder()` exists (plan Task 3.4); **no document still describes either item as open**; FE-B-02 survives only as a verification gate naming SVC-2.
- **Failure response**: if a fifth location is found, amend it here — leaving one open occurrence reproduces exactly the "startable slice reads as blocked" defect this task removes.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: slice S2 is documented as startable, and FE-B-02 survives only as a shipping-time verification gate.
- **Primary failure mode**: Phase 4 is deferred (or S-06 ships unverified) because a stale "blocking" line is read as authoritative.
- **Boundary to exercise**: document-to-document consistency.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: does not verify owner-scoping itself — SVC-2 (plan Task 6.2) does.

## Completion Criteria
- [ ] All four locations updated with the named backend v1.4 resolution
- [ ] The frontend DD Implementation Order lists S2 as startable once `createOrder()` exists
- [ ] No document still describes FE-B-01 or FE-B-02 as open
- [ ] FE-B-02 shipping condition is retained as a verification requirement pointing at SVC-2 (plan Task 6.2)

## Notes
- Impact scope: `docs/design/subscription-frontend-design.md`; downstream, the Phase 4 start decision.
- Scope boundary: no source file, no UI Spec change (UI Spec is not the source of these two items).
