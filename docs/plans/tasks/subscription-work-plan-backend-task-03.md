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
- [x] `docs/ui-spec/subscription-ui-spec.md` (UI-D17; the C-06 "Delta in v1.2" block)
- [x] `docs/design/subscription-frontend-design.md` (fact row `ui:06`; new contradiction row X-13)

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
- [x] Read all Investigation Targets and record, verbatim, the current wording of UI-D17, the C-06 delta and fact row `ui:06`
- [x] Record why no server-side producer can exist (async server component + `code:02`) — this reasoning goes into X-13
### 2. Green Phase
- [x] Amend UI-D17 and the C-06 delta; correct `ui:06`; add X-13; note the prop retirement and its owning task (plan Task 2.4)
### 3. Refactor Phase
- [x] Re-read all three documents end to end and confirm no remaining sentence describes a server-computed `formattedResetDate`

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
- [x] The three document locations agree; the mount passes no prop
- [x] X-13 recorded in `docs/design/subscription-frontend-design.md`
- [x] Both documents note that the shipped component still declares `formattedResetDate?: string` and that plan Task 2.4 retires it
- [x] FE-2 in the fixture-e2e skeleton needs **no** edit
- [x] The Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: the two documents; downstream, plan Task 2.4 and FE-2.
- Scope boundary: no source file is edited in this task — `SOURCE/components/billing/TutorQuotaNote.tsx` stays as shipped until plan Task 2.4.

## Investigation Notes

### Red phase — current wording recorded verbatim (before amendment)

**UI Spec `docs/ui-spec/subscription-ui-spec.md` v1.3, UI-D17 (`:330`)**
> **Decision.** `SOURCE/components/billing/TutorQuotaNote.tsx` is **mounted** on the result-detail page in the same change that ships S-05, beside the two existing `ExplainStepAffordance` call sites (`result/detail/page.tsx:176,229`), receiving `formattedResetDate` computed server-side via UI-D12. Its props and its tutor-only scope are unchanged.

**UI Spec, UI-D17 closing paragraph (`:336`)**
> Its existing `formattedResetDate?: string` prop shape — an **already-formatted string**, not a `Date` — stops being a wart and becomes the precedent: UI-D12 formats where the locale is known and passes strings across the boundary.

**UI Spec, C-06 “Delta in v1.2” (`:774-776`)**
> #### Delta in v1.2 — mounted, and the reset date now has a formatter
>
> UI-D17 mounts this component; UI-D12 supplies `formattedResetDate` (server-side, pinned timezone, user's locale). Its `unknown ⇒ render null` behaviour is unchanged and is still correct **on this surface specifically**: …

**Frontend Design Doc `docs/design/subscription-frontend-design.md` v1.2, fact row `ui:06` (`:349`)**
> | `ui:06` | UI-D17 — `TutorQuotaNote` mounted as-is | **preserve** | Mounted with `formattedResetDate` from `formatDate()` | UI Spec `:294-302` |

**Unchanged states verified in C-06 (both survive the amendment).** Default = “N/M left · resets {date}” when `tutor.state === "known"`; Empty = renders `null` when `state === "unknown"`. Neither is touched by this task.

### Red phase — why no server-side producer can exist (the reasoning X-13 records)

1. The mount site `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` is an **async server component** — `export default async function ResultDetailPage` at `:19` — whose only entitlement-adjacent import is `ExplainStepAffordance` (`:17`), used at `:177` and `:230`. It calls `getResult()` and `getTranslate()` and holds **no entitlement value**. (Verified this session by grep; the UI Spec's `:176,229` citation is one line stale, matching the class of drift the frontend DD records as X-5.)
2. Producing `formattedResetDate` there would require a second `readEntitlement()` call at the page. Frontend DD fact row `code:02` fixes `readEntitlement` as **the one server read seam** and forbids a parallel read (`lib/billing/readEntitlement.ts:34`).
3. `resetsAt` therefore exists **only inside the provider subtree** — carried inside `Quota`'s `known` variant in the `Entitlement` object that crosses the RSC boundary as `EntitlementProvider`'s `value`, i.e. **context, not a prop** (Field Propagation Map). That subtree is client-side, which is exactly where `useLocale()` is available.
4. Consequence of the un-amended text: an implementer either invents a forbidden read path, or mounts `<TutorQuotaNote />` with the prop unfed — and `:35`'s ternary then renders the count with **no reset date, for every user, forever**, while lint, build and a provider-wrapped unit test all pass.

**Shipped code confirms the props are safe to leave alone**: `TutorQuotaNote.tsx:23` declares `formattedResetDate?: string` (optional), `:25` reads `useEntitlement()`, `:30` returns `null` unless `tutor.state === "known"`, `:35` is a ternary that already tolerates the prop's absence. No source file is edited in this task; plan Task 2.4 retires the declaration.

**FE-2 needs no edit**: `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts:58-62` already states the corrected behaviour (“the mount passes NO prop; `TutorQuotaNote` formats its own `resetsAt` from PROVIDER CONTEXT, inside the existing `tutor.state === "known"` branch”) and forbids any assertion on a `formattedResetDate` prop.

### Reference Contract check — planned approach (pre-implementation)

**Planned approach (row 1, `resetsAt` / state-lifecycle-negative)**: both amended locations in the UI Spec (UI-D17's decision sentence and closing paragraph; C-06's delta) and both amended locations in the frontend DD (`ui:06`; new X-13) will state in words that **the mount site passes no `formattedResetDate` prop** and that the component formats **`formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`** inside the existing `tutor.state === "known"` branch, with the reason (async server component + `code:02`) attached.

**Pre-implementation evaluation: `Y`** — the planned wording carries both required halves (no prop passed; `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`) in each amended location. Re-evaluated against the final text at the Exit Gate below.

### Green phase — amended wording

**UI Spec bumped 1.3 → 1.4** (Version cell, Status cell, new Revision History row), per the document's own conventions and the Phase Inversion clause's “amend, in a version bump with a reason” requirement. Three edits:

1. **UI-D17 decision sentence** now reads: mounted beside the two `ExplainStepAffordance` call sites (`result/detail/page.tsx:177,230`) — **the mount passes no prop**; the component formats its own `resetsAt` from provider context, `formatDate(tutor.resetsAt, locale)` (UI-D12) with `locale` from `useLocale()`, inside the existing `tutor.state === "known"` branch (`TutorQuotaNote.tsx:30`). Followed by a **“Corrected in v1.4”** paragraph quoting the superseded text and giving both grounds (async server component at `:19`; `code:02`'s single read seam) plus the silent failure mode. Stale call-site citation `:176,229` corrected to the verified `:177,230` in the same sentence.
2. **UI-D17 closing paragraph** replaced: the shipped `formattedResetDate?: string` declaration (`:23`) and `:35`'s tolerant ternary are recorded, the declaration is named unreachable and **retired by plan Task 2.4**, and UI-D12's “format where the locale is known” rule is kept — relocated one layer lower, to the component itself.
3. **C-06 delta** retitled “mounted, and the reset date is formatted inside the component (corrected in v1.4)”, body rewritten to the no-prop mount, plus a *Corrected in v1.4* note quoting the old “UI-D12 supplies `formattedResetDate` (server-side…)” sentence, stating the output (pinned timezone, user locale) is unchanged and that plan Task 2.4 retires the prop. `unknown ⇒ null` untouched.

**Frontend Design Doc bumped 1.2 → 1.3** (Version cell + Update History row). Four edits:

4. **`ui:06`** corrected: mounted as-is, **no prop passed**, component self-formats `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` in the `known` branch; records that through v1.2 the row read “Mounted with `formattedResetDate` from `formatDate()`” and therefore contradicted `code:04` and the Field Propagation Map; names plan Task 2.4 as the prop's retirer and X-13 as the escalation. Its UI Spec citation moved from the line number `:294-302` to a **section reference**, matching the document's own reading-note convention.
5. **X-13 added** to Contradictions Found (after X-12): both quoted UI Spec sentences, both impossibility grounds, the fact that v1.2 corrected three of its own places **without escalating** while `ui:06` still agreed with the UI Spec, the Phase Inversion escalation and its outcome (UI Spec v1.4), the silent-failure class shared with FE-I8/R-12, and the residual owned by plan Task 2.4 (no code changes here; mount still a no-op until the `(layer2)` provider exists — A10 / R-12).
6. **Overview divergence paragraph** extended: three divergences becomes four, X-13 named as the one that had already bitten.
7. **Reading note** for X-10/X-11/X-12 extended to cover X-13 (cited by section, quoted verbatim, text amended in UI Spec v1.4).

### Refactor phase — end-to-end sweep

`grep` for every `formattedResetDate` occurrence across both documents: **no sentence asserts a server-computed producer**. Every surviving “server-side” mention is either (a) a verbatim quote of the superseded text explicitly labelled *Corrected in v1.4* / *Corrected at v1.2* / *Corrected at v1.3*, or (b) the negative statement (“has **no** server-side producer here”). No fourth location was found needing amendment — checked the AC-042 traceability row, the component tree annotation, UI-D12 itself, `code:04`, the Field Propagation Map, the Interface Change Impact row, FE-I8 and the plan documents; all already state the corrected contract.

**Machine-checked**: 23 assertions over the four locations (UI-D17, C-06 delta, `ui:06`, X-13) — each contains “no prop”, `formatDate(tutor.resetsAt, locale)`, `useLocale()`, the `tutor.state === "known"` branch and the plan Task 2.4 attribution; plus the no-surviving-claim check. Exit 0.

### Reference Contract check — Exit Gate re-evaluation against the final text

| Source | Compliance Check | Result | Evidence |
|---|---|---|---|
| frontend DD § Field Propagation Map (`resetsAt`) | Both amended documents state the mount passes no `formattedResetDate` prop **and** that the component formats `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` | **Y** | UI Spec UI-D17 (“**The mount passes no prop.** … `formatDate(tutor.resetsAt, locale)` (UI-D12), with `locale` from `useLocale()`”) and C-06 delta (“**the mount passes no prop**: … `formatDate(tutor.resetsAt, locale)` (UI-D12, pinned timezone), with `locale` from `useLocale()`”); frontend DD `ui:06` and X-13 both carry the same two halves. All four verified by the 23-assertion script (exit 0) |

### Operation verification (L3)

Read in sequence: UI Spec UI-D17 → UI Spec C-06 delta → frontend DD `ui:06` → `code:04` → X-13. **One contract, stated identically**: the mount passes no prop; the note formats its own `resetsAt` from provider context inside the existing `known` branch; the shipped `formattedResetDate?: string` prop stays declared until plan Task 2.4 retires it; the mount is a no-op until the `(layer2)` provider exists.

**FE-2 unchanged**: `git status --porcelain SOURCE/` is empty — no source file was touched. FE-2's contract banner (`:58-62`) already matches the amended documents, so the skeleton needs no edit.

**Residual (not edited — out of this task's scope, `SOURCE/**` is excluded by the task's own scope boundary)**: the fixture-e2e header comment at `subscription.fixture.e2e.test.ts:56` still says “The spec text is pending amendment”, which is now stale provenance. It affects no assertion. It belongs to plan Task 2.5, which writes FE-2's body.

### Tooling note

`TaskCreate` / `TaskUpdate` are unavailable in this environment; step registration was skipped. The underlying work — skill→rule mapping, Red/Green/Refactor, and the pre-final verification of the mapped rules — was performed and is recorded above.
