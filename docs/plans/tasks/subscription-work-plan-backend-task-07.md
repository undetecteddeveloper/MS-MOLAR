# Task: service-integration-e2e fixture hygiene and the two-session auth fixture

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.8**
Layer: **backend** (real-Postgres service-lane test fixtures under `SOURCE/tests/e2e/service/**`)

Metadata:
- Dependencies: backend-task-02 (plan Task 0.2 — the `test:localdb` config that collects this lane)
- Provides: the service-lane fixture module + the two-session auth fixture consumed by plan Tasks 6.1 (SVC-1) and 6.2 (SVC-2)
- Size: Small (1–2 files)
- `@category: e2e-setup` · `@lane: service-integration-e2e`
- ⚠ **Execution of any case is blocked until schema gate B is green on dev (plan Task 1.3 / backend-task-11).** Writing the fixture module now is in scope; running a case is not.

## Implementation Content

Build the service-lane fixture module following `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (this repository only existing service-lane test) and `SOURCE/supabase/test-rls.ts`:

- an **isolated id prefix per case** (`sub-svc-`) so setup and teardown are idempotent;
- each case creates its **own** users and orders and deletes them in teardown, so a case passes twice in a row and in isolation;
- the **two distinct authenticated sessions** (user A and user B) that SVC-2 requires — two real sessions against one database, because a mocked Supabase client would assert the mock `null` rather than the RLS policy;
- a **counted** payOS adapter stub (invocation count is an assertion target in both SVC cases, so the stub must expose a counter).

**No case is executed in this task.** The skeleton at `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` stays comments-only until Phase 6.

## Target Files
- [ ] `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (new — fixture module; name it to match the directory convention observed in the Investigation Targets)
- [ ] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (imports only; **cases stay comments-only in this task**)

## Investigation Targets
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (the id-prefix + teardown pattern this lane copies)
- `SOURCE/supabase/test-rls.ts` (the fixture-prefix + phased-block pattern, and how a user JWT session is obtained here)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (SVC-1 and SVC-2 `Proof obligation:` / `Primary failure mode:` annotation blocks — the source of what the fixtures must make observable)
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (the shipped fixture-data convention in the sibling lane)
- `SOURCE/lib/supabase/service-role.ts` (the client SVC-1 leaves **real**)
- `SOURCE/vitest.localdb.config.ts` (from backend-task-02 — the config that must collect this file)
- `docs/design/subscription-backend-design.md` (§ Test Boundaries)

## Quality Assurance Mechanisms
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: `greatest()`, `on conflict do update`, the `status='pending'` guard, the row lock, RLS visibility — Config: `SOURCE/vitest.localdb.config.ts`
- `npx tsc --noEmit` — Enforces: the fixture module type-checks — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs`

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record how the existing service-lane test obtains a session and tears down
- [ ] Write the teardown-idempotency check first (run setup + teardown twice; the second run must leave zero `sub-svc-` rows)
### 2. Green Phase
- [ ] Implement the fixture module: prefix, two sessions, counted adapter stub, teardown
- [ ] Run `npm run test:localdb` and confirm it still reports 0 executed cases
### 3. Refactor Phase
- [ ] Confirm no fixture leaks across cases (no module-level mutable state shared between cases)

## Operation Verification Methods
- **Verification method**: run the fixture setup and teardown twice in a row against dev **after** gate B is green; count remaining `sub-svc-`-prefixed rows in `payment_orders`, `subscriptions` and the auth users table.
- **Success criteria**: **the fixture module exists and its teardown is idempotent**; remaining `sub-svc-` row count is 0 after each teardown; two distinct authenticated sessions are obtainable; the adapter stub exposes an invocation count. **No case is executed yet.**
- **Failure response**: if the fixture cannot be torn down idempotently, fix the prefix scoping before Phase 6 — a leaking fixture makes SVC-1 replay counts unreadable.
- **Verification level**: L3 now (module resolves, lane still reports 0 tests); L2 at Phase 6 when SVC-1/SVC-2 execute.

## Proof Obligations
- **Claim**: SVC-1 and SVC-2 can be run repeatedly and in isolation against dev without cross-contamination.
- **Primary failure mode**: leftover fixture rows make a replay-count or row-count assertion pass (or fail) for the wrong reason — the exact hollow-test shape the plan Proof Strategy names.
- **Boundary to exercise**: the real dev Postgres database via the Supabase client (no mock).
- **State assertion**: `sub-svc-` row count 0 → setup → rows present → teardown → count 0 again, twice in a row.
- **Mock boundary rationale**: only the payOS adapter is stubbed, and it is counted; `service-role.ts` and the database stay real, because SVC-1 claim is about the write.
- **Residual**: proves fixture hygiene only; the settlement and ownership claims are proven in plan Tasks 6.1 and 6.2.

## Completion Criteria
- [ ] The fixture module exists and its teardown is idempotent
- [ ] Two distinct authenticated sessions (user A, user B) are obtainable from the fixture
- [ ] The payOS adapter stub exposes an invocation counter
- [ ] `npm run test:localdb` reports 0 executed cases; `npm test` is unchanged
- [ ] `npm run lint` and `npx tsc --noEmit` pass

## Notes
- Impact scope: the service-e2e lane only; no product code.
- Scope boundary: `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` case bodies stay comments-only until Phase 6.
- Execution against dev requires gate B green (plan Task 1.3); running this lane earlier produces failures that look like implementation defects and are not.
