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
- [x] `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (new — fixture module; name it to match the directory convention observed in the Investigation Targets)
- [x] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — **comment-only edit**, not an import. An `import` added now would be unused and `eslint --max-warnings 0` would fail it, and the file's own header declares it carries no imports until the implementing task adds them with the cases. The FIXTURE HYGIENE block now names the fixture module, its per-case options and where the `vi.hoisted` session holder must be created.

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
- [x] Read all Investigation Targets and record how the existing service-lane test obtains a session and tears down (§ Investigation Notes below)
- [x] Write the teardown-idempotency check first — **the check MECHANISM is written** (`countFixtureRows()`, reporting `payment_orders` / `subscriptions` / auth accounts separately so a non-zero says which scope leaked) and the exact two-runs procedure is stated in the module header. **EXECUTING it is blocked** by this task's own ⚠: the tables do not exist and gate B (backend-task-11) has not run. Teardown is idempotent **by construction** — predicate `delete()`s only, no read-modify-write, runnable before `setUp()` — which is structural, not observed.
### 2. Green Phase
- [x] Implement the fixture module: prefix (three scopes — accounts, owning `user_id`, reserved `order_code` block), two real sessions, counted adapter stub, teardown
- [x] Run `npm run test:localdb` — 0 executed cases, unchanged ("No test suite found in file"; the fixture module is not `*.test.ts` so the lane does not collect it as a suite). `npm test` unchanged at **914 passed / 10 skipped**, 89 files, 0 under `tests/`.
### 3. Refactor Phase
- [x] Confirm no fixture leaks across cases. The module has **no mutable module-level state**: accounts, sessions, order-code block, admin client and adapter stub all live inside `createSubscriptionServiceFixture()`. The one thing that cannot live here is the `vi.mock` session holder (hoisted above imports), so it is an **injected parameter**. Verified out of band that two instances get distinct adapters and non-overlapping order-code blocks.

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
- [x] The fixture module exists; its teardown is idempotent **by construction** (not yet executed — gate B)
- [x] Two distinct authenticated sessions (user A, user B) — `sessionFor(role)` / `useSession(role)`, each a real `signInWithPassword` client
- [x] The payOS adapter stub exposes an invocation counter — incremented on ENTRY, **verified out of band**: two held in-flight calls read 2, and a rejected call reads exactly 1 (SVC-1(f))
- [x] `npm run test:localdb` reports 0 executed cases; `npm test` unchanged (914 passed / 10 skipped)
- [x] `npm run lint` and `npx tsc --noEmit` pass (both exit 0)

## Notes
- Impact scope: the service-e2e lane only; no product code.
- Scope boundary: `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` case bodies stay comments-only until Phase 6.
- Execution against dev requires gate B green (plan Task 1.3); running this lane earlier produces failures that look like implementation defects and are not.

## Investigation Notes (backend-task-07 execution)

**`recordSkillMastery.int.test.ts` — how a session is obtained and how teardown runs.**
Loads `.env.local` by hand (`loadEnvLocal()`, vitest does not); derives `HAS_LIVE_DB`
from the three keys and `describe.skipIf(!HAS_LIVE_DB)`; builds a service-role
`admin` client for seeding; obtains the *user* session by `createClient(url, anonKey)`
+ `signInWithPassword`, then feeds that real client into `vi.mock("@/lib/supabase/server")`
through a `vi.hoisted` holder — i.e. only the cookie→client path is replaced, never
Postgres. Fixture ids all carry a `mastery-int-` prefix; `cleanupFixtures()` is a
sequence of predicate `delete()`s run **before and after** (idempotent), ordered by FK
(`exam_attempts` before `exams`, `questions` before `skill_nodes`). Auth users are
**not** deleted — `ensureStudent()` is create-or-update, so accounts persist across runs.

**`supabase/test-rls.ts` — fixture-prefix + phased blocks.** Same `loadEnv()` shape;
`ensureUser(admin, email)` create-or-update; `signInAs(url, anon, email)` returns a
signed-in anon client — that is the two-session mechanism (`EMAIL_A` / `EMAIL_B`).
Every phase owns an id prefix (`rls-ugc-`, `rls-rating-`, `rls-history-`, …) with its
own `setup*Fixtures` / `cleanup*Fixtures` pair. Where the table has **no text PK to
prefix** (`support_tickets.id` is a uuid) the file scopes cleanup **by owning `user_id`**
instead — the precedent this task reuses, because `payment_orders.order_code` is a
`bigint` and cannot carry the literal `sub-svc-` string either.

**`subscription.service.e2e.test.ts` — what the fixtures must make observable.**
SVC-1: before/after reads of `subscriptions.expires_at` / `period_anchor_at` and
`payment_orders.status` / `settled_at`; a seeded `pending` order for user A; a seeded
subscription with days remaining (early-purchase branch); a `getPaymentStatus()` stub
that can return not-paid **and reject**, whose invocation count must read exactly 1 on
the reject branch. SVC-2: two real sessions, a control on A, two refusal branches on B,
deep equality between them, and adapter count **0 asserted separately per branch** —
so the stub needs `reset()` between branches.

**Adapter shape — the contradiction was INTRA-DOCUMENT, and it is fixed at the source.**
The backend DD required the two-property `{ status, amount }` object in **three** places —
P-1 in § Security (*"`settleOrder()` reads only `status` and `amount`"*), the Field
Propagation Map's `transactions[]` row (*"carries `status` and `amount` and nothing else"*)
and P-1's verification mechanism (*"asserted to have exactly two properties"*) — while **one**
line, the signature block under § `lib/billing/payos/`, still declared the bare union
`Promise<"pending"|"paid"|"cancelled"|"unknown">`. The work plan's Connection Map,
backend-task-15 and backend-task-16 agree with the three, and the two-property object is the
only shape that lets `settleOrder()` step 3 compare the provider amount against the stored row.
Because the stale line sat in the block a backend-task-15 implementer copies from, it was
**corrected in the DD (v1.7)** rather than annotated in the fixture — plan Task 3.1 would
otherwise have been built from it. **Owner of the real declaration: backend-task-15**
(plan Task 3.1, `SOURCE/lib/billing/payos/`).

**Reconciliation owners for every value transcribed into the fixture module** (no compile-time
link exists to any of them yet, so drift is not detectable by `tsc`):
`FixturePaymentStatusResult` → backend-task-15 · `FIXTURE_AMOUNT_VND` (39000) and the 30-minute
window → backend-task-12 (plan Task 1.4, `lib/billing/pricing.ts`) · `FIXTURE_PERIOD_DAYS` (30)
and every table/column name → backend-task-09 (plan Task 1.1, `schema.sql`).
The column names differ from the type transcriptions in one respect worth stating: they cross
PostgREST as **strings**, so no compile-time link is even possible — but they *are* detectable at
run time, loudly, on the first insert after gate B is green.
**Naming the owners in prose does not make the reconciliation happen**, which is why each owner
task now carries an actionable Refactor-phase checklist line naming this module and the
transcription to delete — the convention plan Task 0.7's sibling module already set
(backend-task-17 / -19 / -16 / -18 each carry one).

**Revision after integration-test review (`needs_revision`, six required fixes).**
1. **`countFixtureRows()` could not fail.** Every scope it counted by was one teardown had just
   emptied, so all three numbers were *entailed*, not observed — the instrument's blind spot was
   the teardown's blind spot. A fourth, **teardown-independent** scope is unioned in: a
   `payment_orders` count matching `memo like 'sub-svc-<caseTag>%'`. It shares no predicate with
   any delete, and it stays **detection-only** — production `createOrder()` writes
   `MSMOLAR <code>`, which the marker can never match, so a memo-scoped *delete* would still miss
   exactly the rows the owning-`user_id` scope exists for.
2. **The entailment is now disclosed** in the module header: after teardown, `authUsers` is 0
   because `deleteUser` succeeded and `subscriptions` is 0 because the id list is empty (and the
   FK is `on delete cascade`) — **neither carries discriminating power**; only `paymentOrders`
   can fail for the right reason.
3. **`seedPendingOrder()` could escape the reserved block.** `overrides.orderCode` had no bound
   check, so a case could seed a row reachable by scope 1 alone — invisible once its account was
   deleted and the FK nulled the column, which falsified the header's scope-2 claim for that class
   of row. It now throws unless the code is an integer in `[blockStart, blockEnd)`, mirroring the
   allocator's exhaustion guard.
4. **Reconciliation is now mechanised, not prose** — see the owners note above.
5. **The DD contradiction was intra-document**; corrected at `docs/design/subscription-backend-design.md`
   (v1.7) and re-stated correctly here and in the module header.
6. **`setPaymentStatus(next)` now copies** (`{ ...next }`) instead of retaining the caller's
   object identity — the module already spread-copied `DEFAULT_PAYMENT_STATUS` on both paths.
Also taken (raised as optional): the two isolation rules — unique `caseTag`, unique
`orderCodeBlock` — were enforced by review only, and a duplicate `caseTag` would have had one
case's `setUp()` delete another case's accounts mid-run. An **append-only module registry**
now throws on reuse at construction time. It is never read by any fixture behaviour, so the
no-shared-state property is preserved; the header records what it does and does not cover
(one registry per test file; nothing across files).

**Verification of this revision** — typecheck exit 0, `eslint --max-warnings 0` exit 0, and an
out-of-band run of the pure logic only (no database, scratch file deleted): the caller-mutation
test proves the defensive copy, three out-of-block codes and one in-block code prove the bound
check fires before any network call, and duplicate `caseTag` / duplicate `orderCodeBlock` both
throw at construction. The `memo` scope itself is **not** executed — it is a PostgREST query and
the table does not exist.

**Execution status.** No case was executed and no database was contacted: the tables do not
exist on any environment and schema gate B (plan Task 1.3 / backend-task-11) has not run.
Teardown is idempotent **by construction** (predicate `delete()`s only, no read-modify-write,
runnable before setup) — that is a structural property, not an observed one.
