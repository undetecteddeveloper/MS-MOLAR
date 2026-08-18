# Task: Mount `TutorQuotaNote` beside both `ExplainStepAffordance` call sites (UI-D17), and retire the `formattedResetDate` prop

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.4**
Layer: **frontend** (`SOURCE/components/**`, `SOURCE/app/**` page file)

Metadata:
- Dependencies: **backend-task-03 (plan Task 0.3 — the CL-02 amendment, which must land first)**, frontend-task-02 (plan Task 2.2 — the `(layer2)` provider mount), frontend-task-03 (`formatDate`)
- Provides: the only surface that renders AC-042
- Size: Small (2 files)

`Change Category: boundary-change`

The `formattedResetDate?: string` prop is **retired** from a shipped component contract. Sweep the adjacent cases sharing that contract — both mount sites in `result/detail/page.tsx` and any other consumer of `TutorQuotaNote` — for a surviving prop pass.

## Implementation Content

Mount at `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx:177` **and** `:230`.

- **Per the plan Task 0.3 amendment: the mount passes no prop.** Inside the existing `tutor.state === "known"` branch the component formats its own `tutor.resetsAt` via `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`.
- **Retire the now-unreachable `formattedResetDate?: string` prop declaration** — the shipped component still declares it, and **no producer exists or may exist** (`code:02` forbids a second `readEntitlement()` path).
- The `unknown ⇒ return null` behaviour at `:30` is **unchanged**.

**Depends on plan Task 2.2.** Without the `(layer2)` provider this mount renders `null` on **every** render, for **every** user, forever — **and lint, build and the component own unit test all pass through that**.

## Target Files
- [ ] `SOURCE/components/billing/TutorQuotaNote.tsx` (prop retired; self-formatting inside the `known` branch)
- [ ] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230` — two mounts, **no props**)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TutorQuotaNote` — C-06 — verify default (`known`) + empty (`unknown` ⇒ `null`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D17 — **as amended by plan Task 0.3**)
- `docs/design/subscription-frontend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-frontend-design.md` (contradiction row X-13 added by plan Task 0.3; `code:02`, `code:04`)
- `SOURCE/components/billing/TutorQuotaNote.tsx` (`:30` the `unknown ⇒ null` branch; the `formattedResetDate?: string` declaration to retire)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230`) — **adjacent cases for the boundary sweep**
- `SOURCE/lib/format/datetime.ts` (plan Task 2.3 — `formatDate`)
- `SOURCE/lib/i18n/client.tsx` (`useLocale()`)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — `useEntitlement()` and the `known` narrowing)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-frontend-design.md` (§ Field Propagation Map, `resetsAt`) | state-lifecycle-negative | **Because the value exists only inside the provider subtree (client side), `formattedResetDate` is formatted there — `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()` — and the mount site passes no `formattedResetDate` prop.** | The component calls `formatDate(tutor.resetsAt, locale)` with `locale` from `useLocale()`, and neither mount site passes a `formattedResetDate` prop |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, **starting with the plan Task 0.3 amendment** — confirm it has landed before writing code
- [ ] **Boundary sweep**: grep for every `TutorQuotaNote` usage and every `formattedResetDate` reference; list them
- [ ] Write the failing unit test for the `unknown ⇒ null` branch (provider-wrapped)
### 2. Green Phase
- [ ] Retire the prop; format inside the `known` branch; mount at `:177` and `:230` with no props; run only the added tests
### 3. Refactor Phase
- [ ] Confirm `formattedResetDate` no longer appears anywhere in the repository

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: the provider-wrapped unit test for the `unknown ⇒ null` branch, plus FE-2 (plan Task 2.5) rendering the **real route tree**.
- **Success criteria**: `formattedResetDate` is no longer declared; both mounts pass **no** prop; the `unknown ⇒ null` branch is unchanged; the note renders a `<p>` with the remaining count and the reset date beside **both** call sites when `tutor.state === "known"`.
- **Failure response**: if the note renders `null` for a user whose quota is `known`, the `(layer2)` provider mount (plan Task 2.2) is missing or wrong — **fix the mount, do not add a prop**.
- **Verification level**: L2 in this task; L1 via FE-2 and the manual pass.

## Proof Obligations
- **Claim (AC-042)**: a signed-in user with a `known` tutor quota sees the note beside both affordance call sites.
- **Primary failure mode**: **the unit test is provider-wrapped, so it supplies the very thing production would be missing.** A permanently-`null` mount passes lint, build and this test.
- **Boundary to exercise**: in this task, the component with a provider wrapper (`unknown ⇒ null` branch only). **The real route tree is exercised by FE-2 (plan Task 2.5).**
- **State assertion**: N/A (pure render).
- **Mock boundary rationale**: the provider wrapper is acceptable **only** for the `unknown` branch; it is explicitly insufficient for AC-042.
- **Residual**: **this task cannot discharge AC-042.** FE-2 (plan Task 2.5) and the manual pass (plan Task 6.5, item iv) discharge it.

## Completion Criteria
- [ ] All added tests pass
- [ ] `formattedResetDate` no longer declared on `TutorQuotaNote`; **the mount passes no prop** at either site
- [ ] The `unknown ⇒ null` behaviour at `:30` is unchanged
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `TutorQuotaNote` and the result-detail page; downstream, FE-2 and the manual pass.
- Scope boundary (must remain unmodified): `SOURCE/components/tutor/ExplainStepAffordance.tsx`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/lib/billing/types.ts`.
- Ordering: plan Task 0.3 (document amendment) → **this task**. Implementing before the amendment reproduces the unbuildable server-computed-prop design.

## Investigation Notes
(Record the boundary sweep, the retired prop references, and the Compliance Check result here.)
