# Task: Documentation hygiene batch A — ownership and stale-open items (CL-03, CL-04, ST-02, ST-03)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.5**
Layer: **backend** (documents under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none
- Provides: an AC ownership table with no unowned and no doubly-owned criterion — read by plan Task 6.6 close-out sweep
- Size: Medium (3 documents)

## Implementation Content

**CL-03 — AC-041 and AC-050 are owned by *neither* document; each assigns them to the other. Record the owner and the current disposition together — ownership alone is not the whole item.**

- **AC-041** (the quota case must stop looking like a generic failure): assign the **error-path half to the backend document**, which is where it is decided. UI Spec UI-D3 (`:116`) already states *"it cannot be closed in this phase … the **error-path** half of AC-041 is backend work"*, and the pre-emptive display half is shipped. The binding constraint that comes with it — the four collapsed codes stay indistinguishable — is enforced by **plan Task 5.3 (backend-task-23)**, not by this documentation task.
- **AC-050** (≤3 days left ⇒ reminder in `SiteHeader`): assign ownership **and record that it is already deferred by the authoritative UI Spec** — `docs/ui-spec/subscription-ui-spec.md:404` maps it to screen **S-07, marked "deferred (P2)"**, and PRD R15 is **Should Have**. **No task in this plan implements it.** Write the deferral and its two sources into whichever document takes ownership, so a later reader does not re-open it as an unowned Must.

**CL-04** — AC-026, AC-027, AC-035, AC-036, AC-037 are claimed by both documents. Apply the split notation the backend DD **already uses for AC-028** (`FE (display) / BE (supply)`) to all five.

**ST-02** — close UI Spec TBD-07: `createOrder()` now returns the full eight-field `CheckoutOrder`.

**ST-03** — X-10, X-11 and X-12 are **already satisfied** by UI Spec v1.3 text. The frontend DD still lists them live with "text to amend" instructions that would **re-edit already-corrected text**. The fix is to **close them** (marking each "satisfied by UI Spec v1.3, no amendment outstanding"), **not** to apply them.

## Target Files
- [ ] `docs/design/subscription-backend-design.md` (AC ownership table — AC-041 error-path half; the AC-026/027/035/036/037 split notation)
- [ ] `docs/design/subscription-frontend-design.md` (AC ownership table; X-10 / X-11 / X-12 closure)
- [ ] `docs/ui-spec/subscription-ui-spec.md` (TBD-07 closure; the AC-050 deferral cross-reference)

## Investigation Targets
- `docs/design/subscription-backend-design.md` (§ AC ownership — the existing AC-028 `FE (display) / BE (supply)` split notation is the pattern to copy)
- `docs/design/subscription-frontend-design.md` (§ AC ownership; contradiction rows X-10, X-11, X-12)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 at `:114-116`; the S-07 mapping at `:404`; TBD-07)
- `docs/prd/subscription-prd.md` (R15 — Should Have; AC-041, AC-050, AC-026, AC-027, AC-035, AC-036, AC-037)
- `SOURCE/app/(layer2)/tutorActions.ts` (`:51` — the four-literal client-visible `ExplainStepError` union AC-041 constraint protects)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes) | state-lifecycle-negative | **"When the backend later introduces a distinct quota code, the split must preserve `not_eligible`, `server` and `gemini_unavailable` as one indistinguishable group — that constraint is recorded for the backend phase, not resolved here."** With its rationale: *"distinguishing the codes would leak that the server re-runs an eligibility check (`not_eligible`)"* — `ExplainStepAffordance.tsx:96-99`. The client-visible union stays exactly `"not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server"` (`tutorActions.ts:51`) and all four keep rendering **one** message | The document that takes AC-041 ownership restates this constraint verbatim and names plan Task 5.3 as its enforcer, without weakening it to an implementation preference |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; tabulate, per AC, which document currently claims it and which disclaims it
- [ ] Quote UI-D3 `:116` and UI Spec `:404` verbatim for reuse in the amendment
### 2. Green Phase
- [ ] Apply CL-03 (owner + disposition for AC-041 and AC-050), CL-04 (the five split notations), ST-02 (TBD-07 closed), ST-03 (X-10/X-11/X-12 marked satisfied, **not** applied)
### 3. Refactor Phase
- [ ] Re-walk the three ownership tables and confirm every AC has exactly one owner or an explicit split

## Operation Verification Methods
- **Verification method**: walk both Design Docs AC ownership tables side by side and check each AC appears with exactly one owner or an explicit `FE (display) / BE (supply)` split; then grep for `X-10`, `X-11`, `X-12`, `TBD-07`.
- **Success criteria**: **no AC is unowned or doubly owned; no closed item is still listed as actionable**; AC-050 carries its deferral and both sources (UI Spec `:404` S-07 P2, PRD R15 Should Have); no already-corrected UI Spec text was re-edited.
- **Failure response**: if applying an X-1x instruction would change UI Spec v1.3 text, **stop and close the item instead** — re-editing corrected text is the specific defect ST-03 records.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: every acceptance criterion in this feature has exactly one accountable owner, and no already-satisfied item remains actionable.
- **Primary failure mode**: AC-050 is re-opened later as an unowned Must and someone implements a deferred P2 screen; or an X-1x "text to amend" instruction is applied and corrupts corrected UI Spec text.
- **Boundary to exercise**: document-to-document consistency across the three specification documents.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: AC-041 anti-disclosure constraint is **not** enforced here — plan Task 5.3 enforces it in code; this task only records the ownership and the constraint.

## Completion Criteria
- [ ] No AC is unowned or doubly owned; the five CL-04 ACs carry the AC-028 split notation
- [ ] AC-041 error-path half owned by the backend DD, with the UI-D3 constraint restated and plan Task 5.3 named as enforcer
- [ ] AC-050 records its owner **and** its deferral, citing UI Spec `:404` (S-07, deferred P2) and PRD R15 (Should Have); no task claims to implement it
- [ ] TBD-07 closed; X-10, X-11, X-12 marked satisfied by UI Spec v1.3 with no amendment applied
- [ ] The Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: the three specification documents; downstream, plan Tasks 5.3 and 6.6.
- Scope boundary: no source file is edited; UI Spec v1.3 corrected text is **preserved verbatim**.

## Investigation Notes
(Record the per-AC ownership table before/after and the Reference Contract Compliance Check result here.)
