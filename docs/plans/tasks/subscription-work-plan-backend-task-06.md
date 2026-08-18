# Task: Documentation hygiene batch B — citation drift and state-set narrowing (ST-04, ST-05, CL-05, CL-06, LO-01, LO-02)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.6**
Layer: **backend** (documents under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none. Best run after backend-task-03/04/05 so their edits are included in the citation sweep.
- Provides: **one** source for C-13 Empty/Partial state sets — consumed by plan Task 4.3 (frontend-task-11)
- Size: Medium (3 documents)

## Implementation Content

- **ST-04, ST-05, CL-05, CL-06** — version and line-citation drift across all three documents. Apply the backend DD own v1.4 citation rule: **cite the identifier plus a quoted phrase** for artifacts under concurrent revision, rather than a bare line number that goes stale on the next edit.
- **LO-01 / LO-02** — UI Spec C-13 Empty and Partial states are **narrower** than the frontend DD, which is a **strict superset**. Record the **superset** as the implemented behaviour in the UI Spec, so plan Task 4.3 has one source. Concretely, C-13 Partial must cover `paid` / `expired` / `cancelled` **and an unrecognised status**, in all of which neither the QR nor the transfer block renders; C-13 Empty must cover no `?order=` param, an unparseable param, an unknown order and a **foreign** order — as one shared state.

## Target Files
- [ ] `docs/ui-spec/subscription-ui-spec.md` (C-13 Empty/Partial state sets; cross-document version references)
- [ ] `docs/design/subscription-frontend-design.md` (version + citation references)
- [ ] `docs/design/subscription-backend-design.md` (version + citation references)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — verify default (`pending`) + loading + empty + error + partial states)
- `docs/design/subscription-frontend-design.md` (§ Main Components — C-13 Empty/Partial description; the Status/version header)
- `docs/design/subscription-backend-design.md` (the v1.4 citation rule; the Status/version header)
- `docs/plans/subscription-work-plan.md` (§ Related Documents — the version numbers this sweep must leave consistent: backend DD v1.4, frontend DD v1.2, UI Spec v1.3, PRD v1.6)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; list every cross-document version/line citation and mark the stale ones
- [ ] Write out both C-13 state sets side by side and confirm the frontend DD set is a strict superset (if it is **not** a superset, stop: that is a contradiction, not a narrowing, and it needs an escalation row rather than a merge)
### 2. Green Phase
- [ ] Refresh the stale citations using identifier + quoted phrase
- [ ] Record the superset C-13 Empty/Partial sets in the UI Spec
### 3. Refactor Phase
- [ ] Re-read both C-13 descriptions and confirm they are now identical in content

## Operation Verification Methods
- **Verification method**: diff the two C-13 state descriptions clause by clause; then spot-check each refreshed citation by opening the cited document and confirming the quoted phrase exists.
- **Success criteria**: cross-document version references are current; **C-13 Empty/Partial state sets are identical in both documents**; every refreshed citation carries a quoted phrase that resolves.
- **Failure response**: if the two C-13 sets cannot be merged as superset/subset, record an escalation row instead of choosing — a state-set choice is a design decision this plan does not make.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: plan Task 4.3 has exactly one source for C-13 Empty and Partial behaviour.
- **Primary failure mode**: the implementer follows the narrower UI Spec set, and an unrecognised status renders the QR and transfer block on a non-payable order.
- **Boundary to exercise**: document-to-document consistency.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: does not verify the rendered states — plan Task 4.3 tests and FE-1 (plan Task 4.6) do.

## Completion Criteria
- [ ] Cross-document version references are current (backend DD v1.4, frontend DD v1.2, UI Spec v1.3, PRD v1.6)
- [ ] C-13 Empty/Partial state sets are identical in the UI Spec and the frontend Design Doc, recorded as the superset
- [ ] Every refreshed citation uses identifier + quoted phrase and resolves against the cited document

## Notes
- Impact scope: the three specification documents; downstream, plan Task 4.3.
- Scope boundary: no source file is edited; no C-13 behaviour is invented — only the existing superset is recorded.
