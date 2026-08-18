# Task: CL-02 — amend UI Spec UI-D17 and the C-06 delta, correct frontend `ui:06`, add escalation X-13

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.3**
Layer: **backend** (documents under `docs/**` — deterministic layer rule; `task-executor-frontend` is the wrong executor for a document edit)

Metadata:
- Dependencies: none
- Provides: the corrected `TutorQuotaNote` mount contract that **plan Task 2.4 (frontend-task-04) implements**
- Size: Small (2 documents)
- ⚠ **Ordering constraint, load-bearing: this task must precede any `TutorQuotaNote` implementation (plan Task 2.4).** The UI Spec is authoritative for UI and is amended first (UI Spec Phase Inversion clause).

## Implementation Content

Deliverable is a **document change, not code.**

In `docs/ui-spec/subscription-ui-spec.md`: UI-D17 and the C-06 "Delta in v1.2" both say the component is mounted "receiving `formattedResetDate` computed server-side". **No such producer can exist** — the mount site (`result/detail/page.tsx`) is an async server component with no entitlement value, and the frontend Design Doc `code:02` forbids a second `readEntitlement()` path. Amend both to state: **the mount passes no prop; the component formats its own `resetsAt` from provider context inside the existing `tutor.state === "known"` branch.**

In `docs/design/subscription-frontend-design.md`: correct fact row `ui:06` (it currently agrees with the wrong version, contradicting its own `code:04`) and add contradiction row **X-13** recording the escalation.

Note in **both** documents that the shipped component still declares `formattedResetDate?: string` and that the prop is **retired by plan Task 2.4**.

## Target Files
- [ ] `docs/ui-spec/subscription-ui-spec.md` (UI-D17; the C-06 "Delta in v1.2" block)
- [ ] `docs/design/subscription-frontend-design.md` (fact row `ui:06`; new contradiction row X-13)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TutorQuotaNote` — C-06 — verify default (`known`) + empty (`unknown` ⇒ `null`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D17)
- `docs/design/subscription-frontend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-frontend-design.md` (fact rows `ui:06` and `code:04`; `code:02`)
- `SOURCE/components/billing/TutorQuotaNote.tsx` (the shipped `formattedResetDate?: string` declaration and the `unknown ⇒ return null` branch at `:30`)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (the two `ExplainStepAffordance` call sites at `:177` and `:230` — confirm the page is an async server component with no entitlement value)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (case FE-2 — already written against this correction; it must need **no** edit after this amendment)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-frontend-design.md` (§ Field Propagation Map, `resetsAt`) | state-lifecycle-negative | **Because the value exists only inside the provider subtree (client side), `formattedResetDate` is formatted there — `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` — and the mount site passes no `formattedResetDate` prop.** | Both amended documents state that the mount site passes no `formattedResetDate` prop and that the component formats `formatDate(tutor.resetsAt, locale)` itself with `locale` from `useLocale()` |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record, verbatim, the current wording of UI-D17, the C-06 delta and fact row `ui:06`
- [ ] Record why no server-side producer can exist (async server component + `code:02`) — this reasoning goes into X-13
### 2. Green Phase
- [ ] Amend UI-D17 and the C-06 delta; correct `ui:06`; add X-13; note the prop retirement and its owning task (plan Task 2.4)
### 3. Refactor Phase
- [ ] Re-read all three documents end to end and confirm no remaining sentence describes a server-computed `formattedResetDate`

## Operation Verification Methods
- **Verification method**: read UI Spec UI-D17, UI Spec C-06, frontend DD `ui:06`, `code:04` and X-13 in sequence and check they state one contract; then re-read FE-2 in `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` and confirm the skeleton needs no edit.
- **Success criteria**: the three document locations agree that the mount passes **no** prop and the component formats its own `resetsAt` from provider context; X-13 exists and names the escalation; the prop retirement is attributed to plan Task 2.4; FE-2 is unchanged.
- **Failure response**: if a fourth location still asserts a server-computed prop, amend it in this same task — a partially amended contract is the defect this task exists to remove.
- **Verification level**: L3 (document consistency; no code path is exercised).

## Proof Obligations
- **Claim**: the `TutorQuotaNote` mount contract is stated identically in all three documents, so plan Task 2.4 cannot implement the unbuildable version.
- **Primary failure mode**: an implementer reads the un-amended UI-D17, adds a `formattedResetDate` prop with no producer, and the note renders `null` for every user forever while lint, build and its own unit test pass.
- **Boundary to exercise**: document-to-document consistency (no runtime boundary).
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: the amendment does not retire the prop in code — plan Task 2.4 does; and it cannot discharge AC-042, which FE-2 (plan Task 2.5) and the manual pass (plan Task 6.5) discharge.

## Completion Criteria
- [ ] The three document locations agree; the mount passes no prop
- [ ] X-13 recorded in `docs/design/subscription-frontend-design.md`
- [ ] Both documents note that the shipped component still declares `formattedResetDate?: string` and that plan Task 2.4 retires it
- [ ] FE-2 in the fixture-e2e skeleton needs **no** edit
- [ ] The Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: the two documents; downstream, plan Task 2.4 and FE-2.
- Scope boundary: no source file is edited in this task — `SOURCE/components/billing/TutorQuotaNote.tsx` stays as shipped until plan Task 2.4.

## Investigation Notes
(Record the current wording, the amended wording, and the Reference Contract Compliance Check result here.)
