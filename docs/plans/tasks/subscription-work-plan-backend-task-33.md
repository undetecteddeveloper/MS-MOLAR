# Task: Documentation close-out and acceptance-criteria sweep

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.6**
Layer: **backend** (documents under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: backend-task-31 and backend-task-32 (results to record), frontend-task-15 (manual pass results)
- Provides: the closing record of gaps, ratios and open items
- Size: Medium (3 documents + this plan)

## Implementation Content

- Verify **every AC in both Design Docs ownership tables is achieved or explicitly deferred with an owner**.
- **Re-measure the i18n identical-string ratio** (`identical.length / enKeys.length < 0.1`). `payOS`, `VietQR` and bare numerals are the natural byte-identical offenders, so **write the surrounding sentence per locale** rather than shipping a bare brand token as a whole value. **This task owns the re-measurement** (not plan Task 6.5, the manual browser pass).
- Update the three source documents status lines.
- Record which of the **five** justified traceability gaps remain open and why: **TBD-05, TBD-08, TBD-09, ADR-0018/BU-2, and E-01/BU-3**. **Five, not four** — E-01/BU-3 own traceability row states it "requires engineer confirmation before plan approval", so it belongs in this sweep on the same footing as the other four.
- Also confirm **BU-6** (the undesigned usage sink): **either** the backend DD revision landed and plan Task 1.6 shipped, **or** it is recorded as still open with **U2 / BU-4 named as what it holds**.

## Target Files
- [ ] `docs/design/subscription-backend-design.md` (status line; AC ownership sweep; BU-6 state)
- [ ] `docs/design/subscription-frontend-design.md` (status line; AC ownership sweep)
- [ ] `docs/ui-spec/subscription-ui-spec.md` (status line)
- [ ] `docs/plans/subscription-work-plan.md` (Progress Tracking + Completion Criteria checkboxes)

## Investigation Targets
- `docs/design/subscription-backend-design.md` (§ AC ownership tables)
- `docs/design/subscription-frontend-design.md` (§ AC ownership tables)
- `docs/ui-spec/subscription-ui-spec.md` (status line; the S-07 deferral at `:404`)
- `docs/plans/subscription-work-plan.md` (§ Design-to-Plan Traceability — the five `gap` rows; § Engineer-owned open items — BU-1…BU-6)
- `SOURCE/lib/i18n/__tests__/i18n.test.ts` (`:55-59` — the identical-string budget assertion to re-measure)
- `SOURCE/lib/i18n/dictionaries/en.ts` and `SOURCE/lib/i18n/dictionaries/vi.ts` (the ~30 new `billing.*` keys)

## Quality Assurance Mechanisms
- `i18n.test.ts:55-59` identical-string budget — Enforces: identical-key ratio stays `< 0.1` across ~30 new keys — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts` — Covered: `SOURCE/lib/i18n/dictionaries/{en,vi}.ts`
- `npx tsc --noEmit` — Enforces: i18n key parity (an `en.ts` key missing from `vi.ts` is a compile error)

## Implementation Steps
### 1. Read
- [ ] Read all Investigation Targets; build the AC list with its current disposition
### 2. Measure
- [ ] Run `npm test` and read the i18n identical-string ratio from `i18n.test.ts`; if it is at or above `0.1`, rewrite the offending values as full sentences per locale rather than relaxing the threshold
### 3. Record
- [ ] Update the three status lines; record the five gaps and BU-6 state; tick the plan Completion Criteria

## Operation Verification Methods
- **Verification method**: walk both AC ownership tables; run the i18n test; re-read the five gap rows and the BU rows.
- **Success criteria**: every AC achieved or deferred **with an owner**; identical-string ratio `< 0.1`; the **five** gaps recorded with their reasons; BU-6 recorded as resolved **or** as open with U2/BU-4 named as what it holds.
- **Failure response**: if the ratio is at or above `0.1`, **write the surrounding sentence per locale** — do not relax the assertion and do not ship a bare brand token as a whole value.
- **Verification level**: L2 for the ratio (a real test), L3 for the document sweep.

## Proof Obligations
- **Claim**: no acceptance criterion is left unowned, and every justified gap is visibly open with a reason.
- **Primary failure mode**: a gap silently disappears at close-out and is later re-opened as an unowned Must — the same shape CL-03 fixed for AC-041 and AC-050.
- **Boundary to exercise**: the documents themselves, plus the real i18n test.
- **State assertion**: N/A for documents; for i18n, the measured ratio before and after any copy rewrite.
- **Mock boundary rationale**: none.
- **Residual**: engineer confirmation of the five gaps and of BU-2 / BU-3 is an **engineer action**; this task records the request and the state, it cannot supply the confirmation.

## Completion Criteria
- [ ] Every AC achieved or explicitly deferred with a named owner
- [ ] i18n identical-string ratio re-measured and `< 0.1`
- [ ] The **five** justified gaps — TBD-05, TBD-08, TBD-09, ADR-0018/BU-2, E-01/BU-3 — recorded with their current state
- [ ] BU-6 recorded: DD revision landed and plan Task 1.6 shipped, **or** still open with U2/BU-4 named
- [ ] The three source documents status lines updated

## Notes
- Impact scope: documentation and the plan record.
- Scope boundary: no source file is edited except dictionary **values**, and only if the ratio requires it.
