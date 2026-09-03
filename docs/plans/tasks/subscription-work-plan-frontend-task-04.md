# Task: Mount `TutorQuotaNote` beside both `ExplainStepAffordance` call sites (UI-D17), and retire the `formattedResetDate` prop

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.4**
Layer: **frontend** (`SOURCE/components/**`, `SOURCE/app/**` page file)

Metadata:
- Dependencies: **backend-task-03 (plan Task 0.3 — the CL-02 amendment, which must land first)**, frontend-task-02 (plan Task 2.2 — the `(exams)` provider mount), frontend-task-03 (`formatDate`)
- Provides: the only surface that renders AC-042
- Size: Small (2 files)

`Change Category: boundary-change`

The `formattedResetDate?: string` prop is **retired** from a shipped component contract. Sweep the adjacent cases sharing that contract — both mount sites in `result/detail/page.tsx` and any other consumer of `TutorQuotaNote` — for a surviving prop pass.

## Implementation Content

Mount at `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx:177` **and** `:230`.

- **Per the plan Task 0.3 amendment: the mount passes no prop.** Inside the existing `tutor.state === "known"` branch the component formats its own `tutor.resetsAt` via `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`.
- **Retire the now-unreachable `formattedResetDate?: string` prop declaration** — the shipped component still declares it, and **no producer exists or may exist** (`code:02` forbids a second `readEntitlement()` path).
- The `unknown ⇒ return null` behaviour at `:30` is **unchanged**.

**Depends on plan Task 2.2.** Without the `(exams)` provider this mount renders `null` on **every** render, for **every** user, forever — **and lint, build and the component own unit test all pass through that**.

## Target Files
- [x] `SOURCE/components/billing/TutorQuotaNote.tsx` (prop retired; self-formatting inside the `known` branch)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (now `:180`, `:234` — two mounts, **no props**)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TutorQuotaNote` — C-06 — verify default (`known`) + empty (`unknown` ⇒ `null`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D17 — **as amended by plan Task 0.3**)
- `docs/design/subscription-frontend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-frontend-design.md` (contradiction row X-13 added by plan Task 0.3; `code:02`, `code:04`)
- `SOURCE/components/billing/TutorQuotaNote.tsx` (`:30` the `unknown ⇒ null` branch; the `formattedResetDate?: string` declaration to retire)
- `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230`) — **adjacent cases for the boundary sweep**
- `SOURCE/lib/format/datetime.ts` (plan Task 2.3 — `formatDate`)
- `SOURCE/lib/i18n/client.tsx` (`useLocale()`)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — `useEntitlement()` and the `known` narrowing)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-frontend-design.md` (§ Field Propagation Map, `resetsAt`) | state-lifecycle-negative | **Because the value exists only inside the provider subtree (client side), `formattedResetDate` is formatted there — `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` — and the mount site passes no `formattedResetDate` prop.** | The component calls `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`, and neither mount site passes a `formattedResetDate` prop |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, **starting with the plan Task 0.3 amendment** — confirm it has landed before writing code
- [x] **Boundary sweep**: grep for every `TutorQuotaNote` usage and every `formattedResetDate` reference; list them
- [x] Write the failing unit test for the `unknown ⇒ null` branch (provider-wrapped)
### 2. Green Phase
- [x] Retire the prop; format inside the `known` branch; mount at `:177` and `:230` with no props; run only the added tests
### 3. Refactor Phase
- [x] Confirm `formattedResetDate` no longer appears in `SOURCE/components/**` or `SOURCE/app/**` (see Investigation Notes for the three deliberate, out-of-scope survivals)

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: the provider-wrapped unit test for the `unknown ⇒ null` branch, plus FE-2 (plan Task 2.5) rendering the **real route tree**.
- **Success criteria**: `formattedResetDate` is no longer declared; both mounts pass **no** prop; the `unknown ⇒ null` branch is unchanged; the note renders a `<p>` with the remaining count and the reset date beside **both** call sites when `tutor.state === "known"`.
- **Failure response**: if the note renders `null` for a user whose quota is `known`, the `(exams)` provider mount (plan Task 2.2) is missing or wrong — **fix the mount, do not add a prop**.
- **Verification level**: L2 in this task; L1 via FE-2 and the manual pass.

## Proof Obligations
- **Claim (AC-042)**: a signed-in user with a `known` tutor quota sees the note beside both affordance call sites.
- **Primary failure mode**: **the unit test is provider-wrapped, so it supplies the very thing production would be missing.** A permanently-`null` mount passes lint, build and this test.
- **Boundary to exercise**: in this task, the component with a provider wrapper (`unknown ⇒ null` branch only). **The real route tree is exercised by FE-2 (plan Task 2.5).**
- **State assertion**: N/A (pure render).
- **Mock boundary rationale**: the provider wrapper is acceptable **only** for the `unknown` branch; it is explicitly insufficient for AC-042.
- **Residual**: **this task cannot discharge AC-042.** FE-2 (plan Task 2.5) and the manual pass (plan Task 6.5, item iv) discharge it.

## Completion Criteria
- [x] All added tests pass (16/16 in `TutorQuotaNote.test.tsx`); full suite **1078 pass / 10 skip across 97 files**
- [x] `formattedResetDate` no longer declared on `TutorQuotaNote`; **the mount passes no prop** at either site
- [x] The `unknown ⇒ null` behaviour is unchanged (now `:39`; asserted for both locales)
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `TutorQuotaNote` and the result-detail page; downstream, FE-2 and the manual pass.
- Scope boundary (must remain unmodified): `SOURCE/components/tutor/ExplainStepAffordance.tsx`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/lib/billing/types.ts`.
- Ordering: plan Task 0.3 (document amendment) → **this task**. Implementing before the amendment reproduces the unbuildable server-computed-prop design.

## Investigation Notes

### plan Task 0.3 amendment — CONFIRMED landed (checked before any code was written)

- `docs/ui-spec/subscription-ui-spec.md` § UI-D17 now reads: "**The mount passes no prop.** The component formats its own `resetsAt` from **provider context** — `formatDate(tutor.resetsAt, locale)` (UI-D12), with `locale` from `useLocale()` — inside the existing `tutor.state === \"known\"` branch", plus the "*Corrected in v1.4 — the server-side producer this decision named cannot exist*" paragraph.
- § C-06 delta retitled "mounted, and the reset date is formatted inside the component (corrected in v1.4)".
- `docs/design/subscription-frontend-design.md` `ui:06` (`:370`) and X-13 (`:1208`) both state the no-prop mount.
- Conclusion: implementing against the amended (v1.4) text, not the pre-amendment server-computed-prop design.

### Boundary sweep — BEFORE

`TutorQuotaNote` usages (code):
| Location | Form |
|---|---|
| `SOURCE/components/billing/TutorQuotaNote.tsx` | definition, `({ formattedResetDate }: { formattedResetDate?: string })` |
| `SOURCE/app/(exams)/__tests__/layout.test.tsx:76,201` | `<TutorQuotaNote />` — already no props (Task 2.2) |
| `SOURCE/app/(authoring)/__tests__/layout.test.tsx:61,181` | `<TutorQuotaNote />` — already no props (Task 2.2) |
| `result/detail/page.tsx` | **no mount** — the gap this task closes |

No other consumer exists anywhere in `SOURCE/`.

`formattedResetDate` references (code):
| Location | Form |
|---|---|
| `SOURCE/components/billing/TutorQuotaNote.tsx:23` | prop declaration (retired here) |
| `SOURCE/components/billing/TutorQuotaNote.tsx:35` | tolerant ternary around the reset-date clause (retired here) |
| `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts:76,85,231` | **comments forbidding** any assertion on the prop |

No call site ever passed the prop — it had no producer, exactly as X-13 records.

### Boundary sweep — AFTER

- **Zero** occurrences of `formattedResetDate` in `SOURCE/components/**` and `SOURCE/app/**` (production code and page mounts).
- Deliberately surviving, and each is out of this task's Target Files:
  - `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts:76,85,231` — prohibition comments. Deleting them would remove the guardrail that tells FE-2 never to assert the prop.
  - `docs/**` — the v1.4 amendment record (UI-D17, C-06, `ui:06`, X-13). This text must survive; it is the record of the correction.
  - `SOURCE/components/billing/TutorQuotaNote.test.tsx` — names the retired prop inside the assertions that prove it is gone.
- `TutorQuotaNote` after: definition + its own test + the two Task 2.2 layout tests + **two** mounts at `page.tsx:180` and `:234`.

### Reference Contracts — Compliance Check

| Row | Result | Evidence |
|---|---|---|
| Field Propagation Map (`resetsAt`), state-lifecycle-negative | **Y** | `TutorQuotaNote.tsx` calls `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` inside the `tutor.state === "known"` branch; the component takes **no** parameters (`TutorQuotaNote.length === 0`, asserted); both mounts are the bare tag `<TutorQuotaNote />` (asserted, exactly 2 occurrences). |

### Mount placement

Both mounts sit **outside** the `r.hasBeenWrongTwice === true && (...)` gate, as siblings of it. Placing them inside would mean a Free user who never got the same question wrong twice never sees the allowance — the exact failure C-06's own header comment (`:8-12`) exists to prevent, and what AC-042 forbids. Asserted by the "mount nằm NGOÀI cổng `hasBeenWrongTwice`" case.

### What these tests do NOT prove

The unit test is **provider-wrapped**, so it supplies the very thing production could be missing. It does **not** discharge AC-042. FE-2 (plan Task 2.5, real route tree) and the manual pass (plan Task 6.5 item iv) discharge it.

### Resolved — stale `EXPECTED_NOTE` in the two plan Task 2.2 layout tests

Adding the reset date to the `known` branch turned two **pre-existing** assertions red:
`SOURCE/app/(exams)/__tests__/layout.test.tsx:128,280` and `SOURCE/app/(authoring)/__tests__/layout.test.tsx:106,266`.

**What was stale.** Both defined `EXPECTED_NOTE` as the count sentence only, carrying the comment *"Không truyền prop nào, nên không có vế 'Resets on …'"* ("no prop is passed, so there is no 'Resets on …' clause"). That is the **pre-amendment** inference. Plan Task 0.3 overturned it: under UI Spec v1.4 § UI-D17 and frontend DD X-13, the no-prop mount renders the reset date **from context**. The landed mounts were already correct (both are the bare `<TutorQuotaNote />`); only the expected *value* was wrong. `getByText` matches the whole text node, so the added clause made it miss.

**Escalated, then authorised.** This was escalated rather than fixed silently, because bending either side would have been wrong. The orchestrator authorised the correction (option 1) and clarified that the "must remain unmodified" freeze over commit `cef31e7` came from the invocation prompt, not from this task file — whose scope boundary names only `ExplainStepAffordance.tsx`, `entitlement.tsx` and `types.ts`. Decision precedence: the design artifacts settle it.

**What changed** — only the constant and its docblock in each file. Mounts, fixtures, probe helpers, the SkipLink stub and every assertion structure are untouched. Each value was re-derived from that file's **own** fixture `resetsAt`, one file at a time, never pasted:

| File | fixture `resetsAt` | `EXPECTED_NOTE` |
|---|---|---|
| `(exams)` | `2026-08-26T12:00:00.000Z` | `7/500 tutor hints used this period. Resets on 26/08/2026.` |
| `(authoring)` | `2026-08-24T06:30:00.000Z` | `11/500 tutor hints used this period. Resets on 24/08/2026.` |

The date is written as a **literal**, not as `formatDate(EXPECTED_RESETS_AT, …)`: a expected value derived from the formatter under test moves in the same direction as the formatter and proves nothing. The per-file divergence that `cef31e7` deliberately built in survives — verified by observing `(authoring)` **still red** after `(exams)` alone was corrected.

**The correction did not weaken the assertion — verified, not assumed.**

| Mutation | Result |
|---|---|
| `EntitlementProvider` removed from `(exams)/layout.tsx` only | **CAUGHT** — `(exams)` 3 failed, `(authoring)` stayed green |
| `EntitlementProvider` removed from `(authoring)/layout.tsx` only | **CAUGHT** — `(authoring)` 4 failed, `(exams)` stayed green |
| Provider kept, counts correct, **only `resetsAt` corrupted** | **CAUGHT** by the corrected assertion |
| Same corruption against the **pre-amendment pair** (old component + old count-only constant) | **SURVIVED — 1 passed.** The old assertion was blind to `resetsAt` |

The last two rows together are the evidence for the "strictly more discriminating" claim: the rendered date now proves the value travelled **through context**, where before the assertion could only show the quota was non-fallback. A first attempt to show this by swapping only the constant was inconclusive (the old constant fails on any date under exact `getByText` matching), so the decisive experiment restored the whole pre-amendment pair instead.

Both layouts were restored byte-clean after each mutation (`git diff` on both `layout.tsx` files is empty).
