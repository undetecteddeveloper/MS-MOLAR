# Task: Mount `EntitlementProvider` in `(layer2)/layout.tsx` and `(layer4)/layout.tsx` (D005 / I1)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.2**
Layer: **frontend** (`SOURCE/app/**` layout files)

Metadata:
- Dependencies: backend-task-14 (plan Task 2.1 — `readEntitlement()` returning real values)
- Provides: real entitlement context for every gated component — the precondition for plan Tasks 2.4, 2.5 and 5.1
- Size: Small (2 files + tests)

## Implementation Content

Mirror `(billing)/layout.tsx:27,33` **line for line**. Both layouts already `await getCurrentUserProfile()` (`(layer2)/layout.tsx:18`, `(layer4)/layout.tsx:12`), so the change is **one `await readEntitlement(user?.id ?? null)` plus one wrapping element per file**.

- **No `React.cache()`** and **no extra round trip**: route groups are siblings, so **exactly one `readEntitlement()` call happens per request**.
- **Discipline this task must also record**: **no page or component below these layouts may call `readEntitlement()`** — they read context.
- `SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/billing/entitlement.tsx` and `SOURCE/lib/billing/types.ts` are **not** edited.

## Target Files
- [ ] `SOURCE/app/(layer2)/layout.tsx`
- [ ] `SOURCE/app/(layer4)/layout.tsx`
- [ ] `SOURCE/app/(layer2)/__tests__/layout.test.tsx` and `SOURCE/app/(layer4)/__tests__/layout.test.tsx` (one render test per route group)

## Investigation Targets
- `SOURCE/app/(billing)/layout.tsx` (`:27`, `:33` — the shipped mount to mirror line for line; **not edited**)
- `SOURCE/app/(layer2)/layout.tsx` (`:18` — the existing `await getCurrentUserProfile()`)
- `SOURCE/app/(layer4)/layout.tsx` (`:12` — the existing `await getCurrentUserProfile()`)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — `EntitlementProvider` and `useEntitlement`)
- `SOURCE/lib/billing/types.ts` (**frozen** — `FREE_FALLBACK`, the value a gated child must **not** receive)
- `SOURCE/lib/billing/readEntitlement.ts` (plan Task 2.1)
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (a gated child under `(layer2)`; **read only**)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `EntitlementProvider` / `useEntitlement` — C-01 — verify default + error (degrades to `FREE_FALLBACK`) + partial (`plan` known, quotas `unknown`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PlanComparison` — C-02 — verify default + partial (current plan marked, CTA suppressed) states)
- `docs/design/subscription-backend-design.md` (§ Provider coverage / MSA-3 / I1)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact) | dependency_direction | "One entitlement calculation, used by everything … defined once and consumed through the frozen-contract `useEntitlement()` hook" — no second read path | Both layouts consume `readEntitlement()` and pass its value through `EntitlementProvider`; no page or component below them calls `readEntitlement()` |

## Boundary Context (from the plan Connection Map)

**Boundary — Server render → RSC payload → client context.**
- Owners: `SOURCE/lib/billing/readEntitlement.ts` + the three route-group layouts ↔ `useEntitlement()` consumers (`PlanSummary`, `TutorQuotaNote`, `ExplainStepAffordance`, `PlanComparison`).
- **Serialized Format**: the frozen `Entitlement` object; `expiresAt` as ISO 8601 string or `null`; `tutor`/`upload` as the three-valued `Quota` union.
- **Consumer Parse Rule**: the discriminant must be narrowed — reading `resetsAt` outside the `known` branch is a compile error.
- **Expected Signal**: **a gated child does not receive `FREE_FALLBACK`; exactly one `readEntitlement()` call per request.**
- **Roundtrip check**: the object the layout serialises into the RSC payload is the object the consumer hook reads — asserted by rendering the **real** layout tree, not a wrapped unit.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the `(billing)` mount lines verbatim
- [ ] Write **one render test per route group**, rendering the **real layout tree** (a mocked provider would assert the mock), asserting a gated child does **not** receive `FREE_FALLBACK`; confirm both fail first
### 2. Green Phase
- [ ] Add one `await readEntitlement(user?.id ?? null)` and one wrapping element per layout; run only the added tests
### 3. Refactor Phase
- [ ] Confirm exactly one `readEntitlement()` call per request and that no `React.cache()` was introduced

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: one render test per route group against the **real layout tree**, plus the ★ early verification observation (a seeded Premium row makes a gated component render a real plan and a real remaining count).
- **Success criteria**: a gated child does **not** receive `FREE_FALLBACK` in either route group; a new account reads `free`; a seeded Premium row reads `premium`.
- **Failure response**: if `PlanSummary` (or any gated component) shows Free for a Premium user, **stop** — the route group or the provider mount is wrong and **every downstream test would pass while the screen lied**. This is not a defect to work around.
- **Verification level**: L1 (the ★ early verification point for the whole feature).

## Proof Obligations
- **Claim (shared-state dependency)**: a consumer that renders outside the provider subtree silently receives the fail-closed default — and after this task, no gated consumer does.
- **Primary failure mode**: **nothing fails to compile, no test goes red, and the UI simply keeps saying "Free"**. The same shape one layer down makes `TutorQuotaNote` a permanent no-op.
- **Boundary to exercise**: the **real** route-group layout tree — rendering the actual layout, not a test wrapper that supplies the provider.
- **State assertion**: the gated child receives an `Entitlement` that is **not** `FREE_FALLBACK`; `readEntitlement()` invocation count per request is exactly 1.
- **Mock boundary rationale**: `readEntitlement()` data sources may be stubbed; **the provider itself must not be mocked** — a mocked provider would assert the mock.
- **Residual**: AC-042 (the `TutorQuotaNote` render) is discharged by FE-2 (plan Task 2.5) and the manual pass (plan Task 6.5), not by these render tests.

## Completion Criteria
- [ ] One render test per route group asserting a gated child does **not** receive `FREE_FALLBACK`, both green
- [ ] Exactly one `readEntitlement()` call per request; no `React.cache()` added
- [ ] The discipline is recorded in both layouts: no page or component below may call `readEntitlement()`
- [ ] `SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/billing/entitlement.tsx` and `SOURCE/lib/billing/types.ts` unmodified
- [ ] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred** — this code reads `subscriptions`, which production does not have until plan Task 5.8

## Notes
- Impact scope: two layouts; downstream, every gated component in `(layer2)` and `(layer4)`.
- Scope boundary (must remain unmodified): `SOURCE/lib/billing/types.ts`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/app/(billing)/layout.tsx`, `SOURCE/components/tutor/ExplainStepAffordance.tsx`.
- `PlanComparison` (C-02) is **shipped and unchanged**; its `useEntitlement()` read at `:57` first sees a real plan after this task. It is **verified by the provider render test, not re-implemented**.

## Investigation Notes
(Record the mirrored mount lines, the render-test results and the Compliance Check result here.)
