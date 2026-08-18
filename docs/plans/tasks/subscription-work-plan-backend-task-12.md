# Task: Named values and environment registration (incl. the one `periodStartEpoch()`)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.4**
Layer: **backend** (`SOURCE/lib/billing/**`, `SOURCE/lib/env/**`, `SOURCE/.env.example`)

Metadata:
- Dependencies: none inside Phase 1 (independent of the DDL); ordered here because plan Tasks 2.1, 3.3, 3.4, 5.1 and 5.6 all consume its exports
- Provides: `PREMIUM_PRICE_VND`, `ORDER_PENDING_WINDOW_MS`, `PLAN_LIMITS`, **the single exported `periodStartEpoch()`**, and five registered environment variables
- Size: Medium (4–5 files)

## Implementation Content

**`SOURCE/lib/billing/pricing.ts` (new)**
- `PREMIUM_PRICE_VND = 39000`
- `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000` — the **one** constant that feeds `payment_orders.pending_until`, payOS `expiredAt`, **and** `createOrder()` step (0) reuse predicate.

**`SOURCE/lib/billing/quota.ts` (new)**
- `PLAN_LIMITS = { free: { tutor: 5, upload: 3 }, premium: { tutor: 500, upload: 15 } }` — declared here, **not** in the frozen `types.ts`.
- **The one period-start derivation (I004)**, beside `PLAN_LIMITS`:
  `export function periodStartEpoch(plan, anchor, createdAt, now): number`
  implementing the backend DD `:841-842` formula **exactly once** — premium ⇒ `subscriptions.period_anchor_at`; free ⇒ `user_profiles.created_at + 30d × floor((now − created_at) / 30d)`; **unchanged during grace** (AC-011: grace grants access, never allowance). It returns the integer epoch that forms the `{periodStartEpoch}` segment of `quota:{kind}:{userId}:{periodStartEpoch}`.
  **Both the read path (plan Task 2.1, which needs it for `used` and `resetsAt`) and the write path (plan Task 5.1, which increments the key) import this function; neither re-derives it.** Two independent derivations three phases apart is the same two-producers-of-one-contract class as CL-01, but **silent**: a rounding or ms-vs-s difference makes the screen say *n* remaining while the gate refuses, and nothing goes red.

**`SOURCE/lib/env/checkEnv.ts`** — add five branches in the same change that first reads them:
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (level matching `GEMINI_API_KEY` precedent)
- `AI_BUDGET_FREE_SHARE` (**warn**, default 50% stated)
- `AI_BUDGET_DAILY_LIMIT` (**fail-closed, no default** — a missing spend ceiling must not read as an unlimited one)

**`SOURCE/.env.example`** — all five, each with **the consequence of leaving it blank**.

## Target Files
- [ ] `SOURCE/lib/billing/pricing.ts` (new)
- [ ] `SOURCE/lib/billing/quota.ts` (new — `PLAN_LIMITS` + `periodStartEpoch()`; `consumeQuota()` arrives in plan Task 5.1)
- [ ] `SOURCE/lib/env/checkEnv.ts`
- [ ] `SOURCE/.env.example`
- [ ] `SOURCE/lib/billing/__tests__/quota.test.ts` and `SOURCE/lib/env/__tests__/checkEnv.test.ts` (added cases)

## Investigation Targets
- `SOURCE/lib/env/checkEnv.ts` (the existing per-variable branch shape and levels)
- `SOURCE/lib/billing/paidTier.ts` (`:26` — `GEMINI_PAID_TIER_ENABLED` fail-closed shape that `AI_BUDGET_DAILY_LIMIT` must match)
- `SOURCE/lib/billing/types.ts` (**frozen** — read to confirm what must *not* move there; `Quota`, `Entitlement`)
- `SOURCE/lib/billing/readEntitlement.ts` (`:34` — the future importer of `periodStartEpoch()`, plan Task 2.1)
- `SOURCE/.env.example` (existing entry style, incl. how consequences are worded)
- `SOURCE/lib/env/__tests__/` (existing env test shape)
- `docs/design/subscription-backend-design.md` (§ Named values (I012))
- `docs/design/subscription-backend-design.md` (§ Integration Point I5)
- `docs/design/subscription-backend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-backend-design.md` (§ The two counters count different things — the `:841-842` period-start formula)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance) | contract_schema | "Keep the pending-order window and the provider `expiredAt` **the same number**, set from one shared constant" | `ORDER_PENDING_WINDOW_MS` is declared once in `pricing.ts` and is the only source of the pending window and of payOS `expiredAt` |

## Boundary Context (from the plan Connection Map)

**Boundary**: *Read path ↔ write path of the same per-user counter key* (one serialized key string, two producers).
- **Owner (left)**: `SOURCE/lib/billing/readEntitlement.ts` (read: `used` and `resetsAt`)
- **Owner (right)**: `SOURCE/lib/billing/quota.ts` (write: `INCR` at the gate)
- **Serialized Format**: `quota:{kind}:{userId}:{periodStartEpoch}` — `periodStartEpoch` is the **integer epoch** returned by the single exported `periodStartEpoch(plan, anchor, createdAt, now)` in `SOURCE/lib/billing/quota.ts`; no second derivation, no re-rounding, no ms/s conversion at either call site.
- **Consumer Parse Rule**: Both sides **import** `periodStartEpoch()`; neither recomputes `period_anchor_at` or `created_at + 30d × floor(…)` locally. A repo-wide search for the key template must return **exactly one** construction site.
- **Expected Signal**: the key string produced on the read path and on the write path is **byte-identical** for the same user at the same instant — asserted for three fixtures: premium with an anchor; free at creation-day 15 / 29 / 31; a user inside grace (`periodStart` unchanged, AC-011). If they diverge, the screen says *n* remaining while the gate refuses and **nothing goes red**.
- **Roundtrip check this task must satisfy**: the epoch this function emits is the exact value both consumers will embed — this task ships the single producer; the byte-identity assertion across both call sites lands in plan Task 5.1, once both exist.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record `paidTier.ts:26` fail-closed shape verbatim
- [ ] Write failing tests first: one per environment variable **absent and present**; `periodStartEpoch()` with **hardcoded literal expected epochs** (never read back from the implementation) for premium-with-anchor, free at creation-days 15 / 29 / 31, and a user inside grace whose value is **unchanged** from before the grace boundary
### 2. Green Phase
- [ ] Implement `pricing.ts`, `quota.ts` (`PLAN_LIMITS` + `periodStartEpoch()`), the five `checkEnv.ts` branches and the five `.env.example` entries
- [ ] Run only the added tests and confirm they pass
### 3. Refactor Phase
- [ ] Confirm the free-user formula exists in exactly one place and no caller copies it

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: every unit and text-side gate in the Test Boundaries tables — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: discriminated-union exhaustiveness on `Quota` — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs`
- `npm run build` -> `next build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with mocked boundaries per the backend DD Test Boundaries table — each env variable exercised absent and present; `periodStartEpoch()` compared against hardcoded literal epochs.
- **Success criteria**: every variable has a passing absent-case and present-case; **`AI_BUDGET_DAILY_LIMIT` absent fails closed**, matching `paidTier.ts:26`; all `periodStartEpoch()` literal-epoch cases green, including the grace case where the value is unchanged.
- **Failure response**: if the absent case for `AI_BUDGET_DAILY_LIMIT` reads as unlimited, **stop** — a missing spend ceiling that reads as no ceiling is the failure this registration exists to prevent.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
- **Claim (missing config)**: each configuration variable behaves correctly absent and present, and the spend ceiling and release flag fail **closed** when absent.
- **Primary failure mode**: `AI_BUDGET_DAILY_LIMIT` missing is treated as unlimited spend.
- **Boundary to exercise**: `checkEnv.ts` against a stubbed `process.env` (in-process unit).
- **State assertion**: N/A.
- **Mock boundary rationale**: only `process.env` is stubbed; no I/O.
- **Residual**: does not prove the budget is enforced — plan Task 5.1 does.

- **Claim (shared-state dependency, I004)**: the period-start derivation has **exactly one** implementation, so the display path and the enforcement path cannot disagree.
- **Primary failure mode**: a second derivation (a rounding or ms-vs-s difference) makes the screen report remaining allowance while the gate refuses — **and nothing goes red**.
- **Boundary to exercise**: in-process unit now; the cross-path byte-identity comparison lands in plan Task 5.1.
- **State assertion**: for a user inside grace, `periodStartEpoch()` before the grace boundary === after it (AC-011: grace grants access, never allowance).
- **Mock boundary rationale**: none — the function is pure over its four arguments; the clock is passed in as `now`.
- **Residual**: single-site ownership is proven here; **byte-identity across the two call sites is proven in plan Task 5.1**, once the write path exists.

## Completion Criteria
- [ ] All added tests pass
- [ ] One unit test **per environment variable, absent and present**, all green
- [ ] `periodStartEpoch()` literal-epoch cases green (premium-with-anchor; free at days 15 / 29 / 31; grace unchanged)
- [ ] `PLAN_LIMITS` is `{ free: { tutor: 5, upload: 3 }, premium: { tutor: 500, upload: 15 } }` and is **not** in `types.ts`
- [ ] `PREMIUM_PRICE_VND = 39000` and `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000` declared once, in `pricing.ts`
- [ ] All five variables in `SOURCE/.env.example` with the consequence of leaving each blank
- [ ] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/**`, `SOURCE/lib/env/checkEnv.ts`, `SOURCE/.env.example`; downstream, plan Tasks 2.1, 3.3, 3.4, 5.1, 5.6.
- Scope boundary: `SOURCE/lib/billing/types.ts` is **frozen** and must not receive `PLAN_LIMITS` or anything else from this task.

## Investigation Notes
(Record the literal expected epochs used, the `paidTier.ts:26` shape, and the Binding Decision evidence here.)
