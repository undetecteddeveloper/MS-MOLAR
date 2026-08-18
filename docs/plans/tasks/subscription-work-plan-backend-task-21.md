# Task: `quota.ts` — `consumeQuota(kind, userId, ent, geminiCalls)`

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.1**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: backend-task-12 (`periodStartEpoch()`, `PLAN_LIMITS`, `AI_BUDGET_*`), backend-task-14 (the read path this must agree with), frontend-task-02 (provider mounts — the quota values were proven in Phase 2 before they are enforced here)
- Provides: the enforcement primitive used by plan Tasks 5.3 (tutor gate) and 5.4 (upload gate)
- Size: Small (1 file + tests)

`Change Category: state-change`

This task writes the counters that gate paid capacity. Sweep the adjacent cases sharing that state — `SOURCE/lib/billing/readEntitlement.ts` (the read path building the same key) and `SOURCE/lib/security/rateLimitStore.ts` (the in-RAM fallback that must **not** be inherited) — for the same class of defect: a second key shape, or a per-instance counter standing in for a project-wide budget.

## Implementation Content

**The fourth parameter is required with no default** — a default of `1` silently reproduces the 2–3× undercount this design exists to fix, and requiring it makes the merge a **compile error** rather than a silent behaviour change.

**Two counters, two units:**
- `quota:{kind}:{userId}:{periodStartEpoch}` — **+1 per user-initiated operation** (the plan is sold in operations);
- `ai:budget:{pacificDayKey}` — **+`geminiCalls`**, as **one atomic `INCRBY` taken before any request is emitted** — a **reservation, not a per-call tick**, because a refusal arriving between the upload pipeline parallel calls would abandon a half-extracted upload having already spent both the supplier money and the user allowance.

The period start is **in the key**, so a reset is a **new key** and nothing runs at the boundary. **The `{periodStartEpoch}` segment comes from plan Task 1.4 exported `periodStartEpoch(plan, anchor, createdAt, now)` — the same function `readEntitlement()` imports.** This function is the key single owner; `quota.ts` builds the key string in **one** place, and neither `readEntitlement.ts` nor any caller assembles a second one.

**When the passed `Entitlement` quota state is `unknown`** (Redis was unreachable at *read* time, so `resetsAt` is unavailable to derive backwards from), the write path does **not** guess and does **not** fall back to a bare `quota:{kind}:{userId}` key: it calls `periodStartEpoch()` **directly** with the plan, the anchor and the profile creation timestamp it already has, producing exactly the key the read path would have produced had Redis answered. **`unknown` is a display state, never a key state** — a second key shape would silently split one period counter in two and hand the user a fresh allowance on every Redis blip.

`AI_BUDGET_FREE_SHARE` splits the day so Free traffic is refused once it has consumed its share while Premium continues to the full budget.

**Redis unreachable ⇒ `unavailable` ⇒ refuse.** It deliberately does **not** inherit `rateLimit.ts` in-RAM fallback, because a per-instance counter cannot bound a project-wide budget.

## Target Files
- [ ] `SOURCE/lib/billing/quota.ts` (`consumeQuota()` added beside `PLAN_LIMITS` / `periodStartEpoch()`)
- [ ] `SOURCE/lib/billing/__tests__/quota.test.ts` (added cases, incl. the read/write key-agreement case)

## Investigation Targets
- `SOURCE/lib/billing/quota.ts` (`PLAN_LIMITS`, `periodStartEpoch()` from plan Task 1.4)
- `SOURCE/lib/billing/readEntitlement.ts` (plan Task 2.1 — the **read path** whose key this must match byte for byte)
- `SOURCE/lib/security/rateLimitStore.ts` (the Redis client convention **and** the in-RAM fallback this must not inherit) — **adjacent case for the state sweep**
- `SOURCE/lib/billing/types.ts` (**frozen** — the three-valued `Quota` union)
- `SOURCE/lib/env/checkEnv.ts` (`AI_BUDGET_DAILY_LIMIT` fail-closed, `AI_BUDGET_FREE_SHARE` warn)
- `docs/design/subscription-backend-design.md` (§ `quota.ts`)
- `docs/design/subscription-backend-design.md` (§ The two counters count different things)
- `docs/design/subscription-backend-design.md` (§ Two counters (I004))

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ The two counters count different things) | derived-display | Per-user period quota: **+1**, regardless of how many Gemini requests that operation emits. Project daily budget: **+`geminiCalls`** — tutor `1`; upload `metaCall ? 3 : 2` | The per-user key advances by exactly 1 in both upload modes, and the budget key advances by exactly 3 (`automatic`) / 2 (otherwise) / 1 (tutor) |

## Boundary Context (from the plan Connection Map)

**Boundary — `consumeQuota()` → Upstash Redis.**
- **Serialized Format**: keys `quota:{kind}:{userId}:{periodStartEpoch}` and `ai:budget:{pacificDayKey}` where `pacificDayKey` is `YYYY-MM-DD` in `America/Los_Angeles`; increment `INCRBY ai:budget:{pacificDayKey} <geminiCalls>`.
- **Consumer Parse Rule**: compared against `AI_BUDGET_DAILY_LIMIT`; a non-response is `unavailable`, **never** zero. TTL 26 h on the budget key; period end + slack on the quota key.
- **Expected Signal**: two modes, two literal expectations — `automatic` ⇒ budget +3, otherwise +2, tutor ⇒ +1; the per-user key advances by exactly +1 in **both** upload modes.

**Boundary — Read path ↔ write path of the same per-user counter key.**
- Owners: `SOURCE/lib/billing/readEntitlement.ts` ↔ `SOURCE/lib/billing/quota.ts`.
- **Serialized Format**: `quota:{kind}:{userId}:{periodStartEpoch}` — `periodStartEpoch` is the **integer epoch** returned by the single exported `periodStartEpoch(plan, anchor, createdAt, now)`; no second derivation, no re-rounding, no ms/s conversion at either call site.
- **Consumer Parse Rule**: both sides **import** `periodStartEpoch()`; a repo-wide search for the key template must return **exactly one** construction site.
- **Expected Signal**: the key string produced on the read path and on the write path is **byte-identical** for the same user at the same instant — asserted for three fixtures: premium with an anchor; free at creation-day 15 / 29 / 31; a user inside grace (`periodStart` unchanged, AC-011). If they diverge, the screen says *n* remaining while the gate refuses and **nothing goes red**.
- **Roundtrip check this task must satisfy**: the key the gate increments parses to the key the display path reads — asserted as string byte-identity, in this task, now that both call sites exist.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the read-path key construction verbatim
- [ ] **State sweep**: confirm no bare `quota:{kind}:{userId}` key shape exists anywhere, and that the in-RAM fallback is not reachable from this module
- [ ] Write failing tests first with **hardcoded literal expectations**, never read back from the code under test
### 2. Green Phase
- [ ] Implement `consumeQuota()`; run only the added tests
### 3. Refactor Phase
- [ ] Run the repo-wide source scan asserting the `quota:` key template has **exactly one** construction site

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit` — Enforces: discriminated-union exhaustiveness on `Quota`; the required fourth parameter is a compile error when omitted — Config: `SOURCE/tsconfig.json`
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with the Redis client mocked at the I/O boundary, asserting **literal counter deltas**; plus a source scan for the key template.
- **Success criteria**: `automatic` ⇒ budget advances by exactly **3**; any other mode ⇒ exactly **2**; tutor ⇒ exactly **1**; the per-user upload key advances by exactly **1** in **both** upload modes; Redis throws ⇒ `unavailable` ⇒ **0** Gemini calls; at the threshold, Free refused / Premium served; the read-path and write-path key strings are **byte-identical** for all three fixtures; the key template has exactly one construction site.
- **Failure response**: if the write path builds a second key shape when the quota state is `unknown`, **stop** — a per-blip fresh allowance is a paid-capacity leak, and it is silent.
- **Verification level**: L2 here; L1 at the phase level (a Free user sixth tutor call is refused with a distinguishable reason and the row lands in `telemetry_log`).

## Proof Obligations
- **Claim (AC-020)**: every Gemini request the repository can emit is counted in the unit the supplier counts.
- **Primary failure mode**: asserting only the budget delta would let the plan quota silently follow the request count (a 2–3× over-consumption of the user allowance).
- **Boundary to exercise**: `consumeQuota()` public function with the Redis client mocked and its `INCRBY` arguments captured.
- **State assertion**: budget key before → action → after, compared against the hardcoded literals 3 / 2 / 1; per-user key before → after = **+1** in both upload modes.
- **Mock boundary rationale**: Upstash Redis is external I/O; `periodStartEpoch()` and `PLAN_LIMITS` stay real.
- **Residual**: real Gemini consumption under supplier retries is **recorded, not fixed** (plan Task 5.2 records the up-to-3× logical-vs-real gap).

- **Claim (I004 key agreement — the assertion that closes the silent divergence)**: the read path and the write path build the **same** key string.
- **Primary failure mode**: a rounding or ms-vs-s difference between two derivations; the screen reports remaining allowance while the gate refuses, and **nothing goes red**.
- **Boundary to exercise**: both modules public surfaces, compared as strings, in one test.
- **State assertion**: for (i) a premium user with a `period_anchor_at`; (ii) a free user at creation-days **15, 29 and 31**; (iii) a user **inside grace**, whose `periodStart` must be **unchanged** from before the boundary (AC-011) — the two key strings are byte-identical.
- **Mock boundary rationale**: none for the key computation — both real; only Redis I/O is mocked.
- **Residual**: none for the key; the rendered remaining count is proven by plan Task 3.7 / the manual pass.

- **Claim (unavailable boundary)**: the counter store unreachable ⇒ refuse, with **zero** downstream supplier calls.
- **Primary failure mode**: a non-response is treated as zero usage and traffic proceeds unbounded, or the in-RAM fallback is inherited and a per-instance counter is used to bound a project-wide budget.
- **Boundary to exercise**: `consumeQuota()` with the Redis client throwing.
- **State assertion**: Gemini adapter invocation count **0** after the refusal.
- **Mock boundary rationale**: Redis mocked to simulate unreachability.
- **Residual**: the end-to-end refusal path is proven at the gates (plan Tasks 5.3, 5.4 / INT-1).

- **Claim (shared-state dependency)**: the period boundary is embedded in the counter key, so a reset is a **new key** rather than a mutation.
- **Primary failure mode**: a boundary job or a mutation is introduced, and a missed run leaves a user without a reset.
- **Boundary to exercise**: key construction across a period boundary (in-process unit with an injected clock).
- **State assertion**: crossing the boundary produces a different key string; the old key is not written or deleted.
- **Mock boundary rationale**: clock injected.
- **Residual**: TTL expiry behaviour is not asserted beyond the configured values.

## Completion Criteria
- [ ] All added tests pass, with hardcoded literal expectations
- [ ] The fourth parameter is **required** (omitting it is a compile error)
- [ ] The read-path/write-path key strings are byte-identical for all three fixtures
- [ ] The repo-wide scan shows the `quota:` key template has **exactly one** construction site
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — and not before

## Notes
- Impact scope: `SOURCE/lib/billing/quota.ts`; downstream, plan Tasks 5.3, 5.4, 5.5.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; `SOURCE/lib/security/rateLimit.ts` in-RAM fallback is **not** inherited; `consumeQuota()` has no notion of a telemetry event type (the OK-04 mapping lives at the refusal sites — plan Task 5.5).

## Investigation Notes
(Record the state sweep, the three key-agreement fixtures with their byte-compared strings, and the Compliance Check result here.)
