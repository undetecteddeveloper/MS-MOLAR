# Task: Fill the body of the existing `readEntitlement(userId)` (backend step 3)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.1**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: backend-task-11 (gate B green on dev — this reads `subscriptions`), backend-task-12 (`PLAN_LIMITS` + `periodStartEpoch()`)
- Provides: real entitlement values for plan Task 2.2 provider mounts and, through them, ★ the early verification point
- Size: Small (1 file + its test)

## Implementation Content

`SOURCE/lib/billing/readEntitlement.ts:34` — **body only**. **No new module, no new export, no rename; `getEntitlement` must not be created.** The signature is unchanged, so `(billing)/layout.tsx:27` keeps working through the change.

Implement exactly the three steps the file own header specifies:
1. read `subscriptions`;
2. derive `plan` / `inGracePeriod` **at read time** against `now()` + a 3-day grace;
3. move `tutor` / `upload` from `unknown` to `known` off the Redis period counters, with `limit` from `PLAN_LIMITS[plan][kind]` and `resetsAt = periodStart + 30d`.

**Import `periodStartEpoch()` from `SOURCE/lib/billing/quota.ts` (plan Task 1.4) — do not re-derive the period start here.** It is the same value the enforcement path keys its counter on, and this file is the *display* half; the free-user formula `user_profiles.created_at + 30d × floor((now − created_at)/30d)` (A6) lives in that one function and is **called, never copied**. Read `quota:{kind}:{user}:{periodStartEpoch}` with the segment that function returns, and compute `resetsAt` as `periodStartEpoch() + 30d`.

**Grace grants access, never allowance**: `periodStart` is unchanged during grace — a property of that function, asserted there.

**Redis unreachable during the *read*** ⇒ the quota fields degrade to `{ state: "unknown" }` and the layout still renders (UI-D2 deliberate fail-**open on display**, which is not in tension with the enforcement path fail-closed).

## Target Files
- [ ] `SOURCE/lib/billing/readEntitlement.ts` (body of the existing export only)
- [ ] `SOURCE/lib/billing/__tests__/readEntitlement.test.ts` (added cases)

## Investigation Targets
- `SOURCE/lib/billing/readEntitlement.ts` (`:34` — the existing signature and the three-step header comment)
- `SOURCE/lib/billing/types.ts` (**frozen** — `Entitlement`, the three-valued `Quota` union, `FREE_FALLBACK`)
- `SOURCE/lib/billing/quota.ts` (`periodStartEpoch()` and `PLAN_LIMITS` from plan Task 1.4 — the functions this file imports)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — the provider/consumer contract this value flows into)
- `SOURCE/app/(billing)/layout.tsx` (`:27`, `:33` — the shipped call site that must keep working)
- `SOURCE/supabase/schema.sql` (the `subscriptions` block: `expires_at`, `period_anchor_at`)
- `SOURCE/lib/security/rateLimitStore.ts` (how Redis is reached in this repository, and what an unreachable store looks like)
- `docs/design/subscription-backend-design.md` (§ Design — `readEntitlement.ts`)
- `docs/design/subscription-backend-design.md` (§ Field Propagation Map)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `EntitlementProvider` / `useEntitlement` — C-01 — verify default + error (degrades to `FREE_FALLBACK`) + partial (`plan` known, quotas `unknown`) states)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Decision)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Decision) | persistence | Entitlement only stored state is one `expires_at` timestamp in a dedicated `subscriptions` table, evaluated at every read — no boolean, no status enum, no provider-pushed lifecycle | `readEntitlement()` derives `plan` from `expires_at` and `now()` at read time and reads no cached flag |
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact) | dependency_direction | "One entitlement calculation, used by everything … defined once and consumed through the frozen-contract `useEntitlement()` hook" — no second read path | `readEntitlement()` remains the single entitlement calculation; no second read path or alternative export is introduced |

## Boundary Context (from the plan Connection Map)

**Boundary 1 — Read path ↔ write path of the same per-user counter key.**
- Owners: `SOURCE/lib/billing/readEntitlement.ts` (read: `used`, `resetsAt`) ↔ `SOURCE/lib/billing/quota.ts` (write: `INCR` at the gate).
- **Serialized Format**: `quota:{kind}:{userId}:{periodStartEpoch}` — `periodStartEpoch` is the **integer epoch** returned by the single exported `periodStartEpoch(plan, anchor, createdAt, now)`; no second derivation, no re-rounding, no ms/s conversion at either call site.
- **Consumer Parse Rule**: both sides **import** `periodStartEpoch()`; neither recomputes `period_anchor_at` or `created_at + 30d × floor(…)` locally. A repo-wide search for the key template must return **exactly one** construction site.
- **Expected Signal**: the key string produced on the read path and on the write path is **byte-identical** for the same user at the same instant. If they diverge, the screen says *n* remaining while the gate refuses and **nothing goes red**.
- **Roundtrip check for this task**: the key this file reads is the key the gate will increment — this task must add **no** key template of its own; the byte-identity assertion itself lands in plan Task 5.1.

**Boundary 2 — Server render → RSC payload → client context.**
- Owners: `SOURCE/lib/billing/readEntitlement.ts` + the three route-group layouts ↔ `useEntitlement()` consumers (`PlanSummary`, `TutorQuotaNote`, `ExplainStepAffordance`, `PlanComparison`).
- **Serialized Format**: the frozen `Entitlement` object; `expiresAt` as ISO 8601 string or `null`; `tutor`/`upload` as the three-valued `Quota` union.
- **Consumer Parse Rule**: the discriminant must be narrowed — reading `resetsAt` outside the `known` branch is a compile error.
- **Expected Signal**: a gated child does **not** receive `FREE_FALLBACK`; **exactly one** `readEntitlement()` call per request.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the frozen `Entitlement` / `Quota` shapes verbatim
- [ ] Write failing tests: AC-005, AC-010, AC-011, AC-016 read half, AC-052 (creation days 15, 29, 31), and the Redis-unreachable degrade-to-`unknown` case
### 2. Green Phase
- [ ] Fill the body; run only the added tests and confirm they pass
### 3. Refactor Phase
- [ ] Grep this file for a literal `quota:` template and for any second period-start formula — both must be absent

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: every unit gate in the backend Test Boundaries table — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: discriminated-union exhaustiveness on `Quota` — Config: `SOURCE/tsconfig.json`
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with the Supabase and Redis boundaries mocked per the backend DD Test Boundaries table, plus the seeded-row observation that plan Task 2.2 render test consumes.
- **Success criteria**: a seeded Premium row reads `premium`; a new account reads `free`; past grace reads `free` with **zero writes** between the two reads; Redis unreachable degrades the quota fields to `{ state: "unknown" }` while the value still renders.
- **Failure response**: if a gated component still shows Free for a seeded Premium user, **stop** — the route group or the provider mount is wrong and every downstream test would pass while the screen lied.
- **Verification level**: L2 here; L1 is reached with plan Task 2.2 / the Phase 2 early verification point.
- **No output comparison is required**: the value replaced is the constant `FREE_FALLBACK`, and a comparison against a constant is not informative. The substitute is plan Task 2.2 render assertion.

## Proof Obligations
- **Claim**: entitlement is a pure function of one timestamp and the clock.
- **Primary failure mode**: a scheduled job or a cached flag creeps in, so expiry depends on something having run.
- **Boundary to exercise**: `readEntitlement()` public signature, with Supabase and Redis mocked at the I/O edge.
- **State assertion**: AC-005 — read before `expires_at + 3d` ⇒ `premium`; read after ⇒ `free`; **zero writes between the two reads**, and no scheduled job anywhere in the repository.
- **Mock boundary rationale**: Supabase and Redis are external I/O; `periodStartEpoch()` and `PLAN_LIMITS` are internal and stay real.
- **Residual**: does not prove any component receives the value — plan Task 2.2 does.

- **Claim**: the grace boundary is exact and grace grants access, never allowance.
- **Primary failure mode**: an off-by-one-day boundary, or grace silently resetting the period counter.
- **Boundary to exercise**: in-process unit with an injected clock.
- **State assertion**: AC-010 — one second before the day-3 boundary ⇒ `premium`; one second after ⇒ `free`. AC-011 — inside grace with allowance spent ⇒ refused for **quota**, not for **expiry** (two distinct reasons).
- **Mock boundary rationale**: clock injected; no real time dependence.
- **Residual**: enforcement-side behaviour is plan Task 5.1.

- **Claim (shared-state dependency)**: this file contains **no** literal `quota:` key template of its own and **no** second period-start formula.
- **Primary failure mode**: a display path and an enforcement path deriving the key independently disagree silently — the screen reports remaining allowance while the gate refuses.
- **Boundary to exercise**: a repo-wide source scan asserting the key template has exactly one construction site.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — source text is read directly.
- **Residual**: the read/write **byte-identity** assertion lands in plan Task 5.1, once the write path exists.

## Completion Criteria
- [ ] All added tests pass (AC-005, AC-010, AC-011, AC-016 read half, AC-052 days 15/29/31, Redis-unreachable degrade)
- [ ] `readEntitlement()` signature unchanged; no new module, no rename, **no `getEntitlement`**
- [ ] `periodStartEpoch()` is **imported**, not re-derived; the repo-wide key-template scan returns exactly one construction site
- [ ] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred** — this code reads `subscriptions`, which production does not have until plan Task 5.8

## Notes
- Impact scope: `SOURCE/lib/billing/readEntitlement.ts`; downstream, every `useEntitlement()` consumer.
- Scope boundary (must remain unmodified): `SOURCE/lib/billing/types.ts`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/app/(billing)/layout.tsx`, `SOURCE/components/tutor/ExplainStepAffordance.tsx`.
- No page or component below the layouts may call `readEntitlement()` — they read context (recorded in plan Task 2.2).

## Investigation Notes
(Record the frozen shapes, the key-template scan result, and each Compliance Check result here.)
