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
- [x] `docs/design/subscription-backend-design.md` (status line; AC ownership sweep; BU-6 state) — **v1.10**
- [x] `docs/design/subscription-frontend-design.md` (status line; AC ownership sweep) — **v1.8**
- [x] `docs/ui-spec/subscription-ui-spec.md` (status line) — **v1.8**
- [x] `docs/plans/subscription-work-plan.md` (Progress Tracking + Completion Criteria checkboxes) — **v1.4**

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
- [x] Read all Investigation Targets; build the AC list with its current disposition
### 2. Measure
- [x] Measured the i18n identical-string ratio directly and confirmed it with the real test — **4/557 = 0.00718 < 0.1**, no rewrite needed. (Original text: run `npm test` and read the i18n identical-string ratio from `i18n.test.ts`; if it is at or above `0.1`, rewrite the offending values as full sentences per locale rather than relaxing the threshold.)
### 3. Record
- [x] Update the three status lines; record the five gaps and BU-6 state; tick the plan Completion Criteria

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
- [x] Every AC achieved or explicitly deferred with a named owner — **57/57 owned, 50 achieved, 7 deferred with an owner**
- [x] i18n identical-string ratio re-measured and `< 0.1` — **0.00718** (4 identical of 557 keys); `i18n.test.ts` 12 passed
- [x] The **five** justified gaps — TBD-05, TBD-08, TBD-09, ADR-0018/BU-2, E-01/BU-3 — recorded with their current state (**all five still open**; work plan § Task 6.6 evidence block)
- [x] BU-6 recorded: **still open**, with Task 1.6 and BU-4 (U2) named as what it holds — backend DD v1.10 § "BU-6 — state at close-out"
- [x] The three source documents status lines updated — backend DD **v1.10**, frontend DD **v1.8**, UI Spec **v1.8**

## Notes
- Impact scope: documentation and the plan record.
- Scope boundary: no source file is edited except dictionary **values**, and only if the ratio requires it.

## Investigation Notes (recorded during execution, 2026-08-20)

**Investigation Targets — what each one contributed.**

- `docs/design/subscription-backend-design.md` § Acceptance Criteria Ownership — the table is per-AC (not ranges) since v1.4 / I008, and carries **57 rows for 57 distinct ACs**, verified by counting unique `AC-0NN` identifiers across the table range. Owner values in use: BE / FE / Shipped / Ops / Content / `FE (display) / BE (supply)`. The split notation states the *seam*; it is not a co-claim, which is what CL-04 fixed.
- `docs/design/subscription-frontend-design.md` § Acceptance Criteria Ownership — prose lists rather than a table: 7 split ACs, 7 owned outright, the remainder disclaimed to the backend, plus a sixth list, "Already shipped, not re-owned". **Defect found**: AC-040 sat in that last list although nothing about it is shipped — the refund-policy text is drafted but is not wired into the dictionaries, so `/refund-policy` still renders `LegalContentPending`. Corrected at v1.8 to a deferral with the engineer named.
- `docs/ui-spec/subscription-ui-spec.md` § Open Items — TBD-02 is still the only blocking item; TBD-05 / TBD-06 / TBD-08 / TBD-09 are all still open and all non-blocking. The S-07 deferral this task file cites at `:404` sits at **`:408`** from v1.5 onward and was matched on quoted text, per the backend DD citation rule. **Defect found**: the Update History table has **no rows for v1.1, v1.4 or v1.7** — recorded, not back-filled, because reconstructing what those revisions did is a judgement that belongs to the engineer.
- `docs/plans/subscription-work-plan.md` § Design-to-Plan Traceability — exactly **five** `gap` rows (TBD-05, TBD-08, TBD-09, ADR-0018/BU-2, E-01/BU-3), matching the count the plan has asserted everywhere since v1.1 / I007. § Engineer-owned open items — BU-1…BU-6, every row carrying a non-empty Blocks value; BU-6 is the only design-revision escalation and its chain is BU-6 → Task 1.6 → BU-4 → Task 6.8.
- `SOURCE/lib/i18n/__tests__/i18n.test.ts` — the budget assertion is at **`:54-59`**: `expect(identical.length / enKeys.length).toBeLessThan(0.1)`, where `identical` is an exact `===` comparison of values over the **en** key set.
- `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` — 557 keys in `en`, **77** of them `billing.*`. Measured identical set: **4** keys, exactly one of them `billing.*` (`billing.plan.premium.name` = "Premium").

**Control flow and dependency shape that mattered to the sweep.** The AC dispositions are not free-standing. AC-042 and AC-043 depend on plan Task 6.5, which needs a human on real hardware; AC-045 depends on Task 5.8's prod gate B; AC-048 and AC-055 depend on Task 6.8, which sits behind BU-1 / BU-4 / BU-5, and BU-4 behind BU-6. That dependency shape is why the seven deferrals could not be reduced by anything this task does — every one of them terminates in a human action or a design decision.

**Scope decisions taken.** Documentation debt outside the four Target Files was **recorded with a named owner rather than fixed**: editing a file this task does not own is the defect, not the fix. Two categories were left alone even inside owned files — **Update History rows are never re-edited** (the backend DD's v1.4 row deliberately still cites `:261`), and Task 6.3's dated evidence block in the plan was **appended to** rather than rewritten where this pass invalidated one of its sentences.

**Verification level.** L2 for the ratio — a real test was executed (`npx vitest run lib/i18n/__tests__/i18n.test.ts` → 12 passed, exit 0), preceded by a direct measurement off the two dictionaries (4 / 557 = 0.00718). L3 for the document sweep. **No file under `SOURCE/` was modified**, so the code gates were deliberately not re-run.
