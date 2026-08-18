# Task: fixture-e2e harness and fixture data for the subscription lane

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.7**
Layer: **frontend** (browser-driver harness that renders React route trees; consumed only by the three FE cases)

Metadata:
- Dependencies: none
- Provides: the harness and fixtures consumed by plan Tasks 2.5 (FE-2), 3.9 (FE-3), 4.6 (FE-1)
- Size: Small (1–2 files)
- `@category: e2e-setup` · `@lane: fixture-e2e`

## Implementation Content

Follow the **shipped convention in the same directory** — a driver-based script written against the structural subset of Playwright that `supportFixtureData.ts` declares (`support-widget-visibility.fixture.e2e.test.ts:9-17`, `history.fixture.e2e.test.ts`, `rating.fixture.e2e.test.ts`).

Provide:
- **entitlement fixtures**: `known` (with `used` / `limit` / `resetsAt`), `unknown`, and exhausted;
- **order fixtures**: `pending` **with and without** `qrPayload`, `paid`, `expired`, `cancelled`, and **an unrecognised status**;
- an **action-module stub layer** for `createOrder` / `recheckOrder` (the FE cases assert invocation **counts**, so the stubs must expose counters).

**Do not introduce MSW** — the frontend Design Doc states it is not used and is not introduced. **No live payOS connection, no real money movement in this lane.**

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (new — name to match the sibling `supportFixtureData.ts` / `supportAdminFixtureData.ts` convention)
- [ ] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (imports only; **the three cases stay comments-only in this task**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (the declared structural subset of Playwright and the fixture-data shape to copy)
- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` (`:9-17` — the driver-based script convention)
- `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` and `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (two further shipped examples)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (FE-1, FE-2, FE-3 annotation blocks — what the fixtures must make observable)
- `SOURCE/lib/billing/types.ts` (**frozen** — the `Entitlement` / `Quota` shapes the entitlement fixtures must match)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — how the provider supplies context in the real route tree)
- `SOURCE/supabase/schema.sql` (the four permitted `payment_orders.status` literals the order fixtures must cover, plus one deliberately unrecognised value)
- `docs/design/subscription-frontend-design.md` (§ Test Boundaries)

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the CI gate stays green; this lane is **not** collected by it — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the declared Playwright structural subset verbatim
- [ ] Confirm a smoke render of an existing fixture-e2e script currently passes (the baseline)
### 2. Green Phase
- [ ] Add the fixture module and the stub layer with counters; keep the three subscription cases comments-only
### 3. Refactor Phase
- [ ] Re-run the existing fixture-e2e smoke script and confirm it still passes

## Operation Verification Methods
- **Verification method**: load the harness and run a smoke render of an existing fixture-e2e script.
- **Success criteria**: **the harness loads and a smoke render of an existing fixture-e2e script still passes**; the entitlement, order and stub fixtures are all present; **no MSW dependency was added**.
- **Failure response**: if the shipped convention cannot express a needed fixture, extend the fixture module rather than introducing a new mocking library.
- **Verification level**: L3 now; L1 when the three FE cases run in Phases 2–4.

## Proof Obligations
- **Claim**: the three FE cases can render the **real route tree** with controllable entitlement and order state, and can count action invocations.
- **Primary failure mode**: fixtures that wrap the unit in a provider instead of letting the provider come from where production puts it — which supplies the very thing production would be missing and makes FE-2 unable to discharge AC-042.
- **Boundary to exercise**: the browser harness against the real route tree.
- **State assertion**: N/A in this task (no case executes).
- **Mock boundary rationale**: only the action modules (`createOrder` / `recheckOrder`) are stubbed, and they are counted; the route tree, layouts and provider stay real.
- **Residual**: proves the harness loads; the three journeys are proven in plan Tasks 2.5, 3.9, 4.6.

## Completion Criteria
- [ ] The harness loads; a smoke render of an existing fixture-e2e script still passes
- [ ] Entitlement fixtures (`known` / `unknown` / exhausted), order fixtures (`pending` with and without `qrPayload`, `paid`, `expired`, `cancelled`, unrecognised) and the counted action stubs all exist
- [ ] **No MSW** and no live payOS connection introduced
- [ ] `npm test` unchanged and green

## Notes
- Impact scope: the fixture-e2e lane only; no product code.
- Scope boundary: the three subscription cases stay comments-only until their owning phases.
