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
- [x] `SOURCE/lib/billing/quota.ts` (`consumeQuota()` added beside `PLAN_LIMITS` / `periodStartEpoch()`)
- [x] `SOURCE/lib/billing/__tests__/quota.test.ts` (added cases, incl. the read/write key-agreement case)

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
- [x] Read all Investigation Targets and record the read-path key construction verbatim
- [x] **State sweep**: confirm no bare `quota:{kind}:{userId}` key shape exists anywhere, and that the in-RAM fallback is not reachable from this module
- [x] Write failing tests first with **hardcoded literal expectations**, never read back from the code under test
### 2. Green Phase
- [x] Implement `consumeQuota()`; run only the added tests
### 3. Refactor Phase
- [x] Run the repo-wide source scan asserting the `quota:` key template has **exactly one** construction site

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
- [x] All added tests pass, with hardcoded literal expectations
- [x] The fourth parameter is **required** (omitting it is a compile error)
- [x] The read-path/write-path key strings are byte-identical for all three fixtures
- [x] The repo-wide scan shows the `quota:` key template has **exactly one** construction site
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — and not before

## Notes
- Impact scope: `SOURCE/lib/billing/quota.ts`; downstream, plan Tasks 5.3, 5.4, 5.5.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; `SOURCE/lib/security/rateLimit.ts` in-RAM fallback is **not** inherited; `consumeQuota()` has no notion of a telemetry event type (the OK-04 mapping lives at the refusal sites — plan Task 5.5).

## Investigation Notes
(Record the state sweep, the three key-agreement fixtures with their byte-compared strings, and the Compliance Check result here.)

### Read-path key construction, verbatim (`readEntitlement.ts:167-176`)

```ts
const periodStart = periodStartEpoch(plan, account.anchor, account.createdAt, now);
const resetsAt = new Date(periodStart + PERIOD_MS).toISOString();
const redis = new Redis({ url, token });
const [tutorUsed, uploadUsed] = await redis.mget<(number | null)[]>(
  quotaKey("tutor", userId, periodStart),
  quotaKey("upload", userId, periodStart)
);
```

`quotaKey()` (`quota.ts:57-63`) is the only template: `` `quota:${kind}:${userId}:${periodStartEpochMs}` ``.
`periodStartEpoch()` returns **milliseconds**. `resetsAt = periodStart + PERIOD_MS`, ISO with ms precision,
so `Date.parse(resetsAt) - PERIOD_MS` is an **exact** inverse of the read path's own derivation.

### State sweep (`Change Category: state-change`)

- **No bare `quota:{kind}:{userId}` shape exists anywhere.** Repo-wide scan already shipped in
  `readEntitlement.test.ts:494-500` — every non-comment line matching `["'`]quota:` lives in
  `lib/billing/quota.ts` and nowhere else. `consumeQuota()` adds **no** second template: it calls
  `quotaKey()`.
- **In-RAM fallback is not reachable from this module.** `rateLimit.ts:240-247` is the only thing that
  falls back to the process-local `hits` Map, and it is reached only through `guard()`. `quota.ts`
  imports neither `rateLimit` nor `rateLimitStore`; a new test case asserts that as source text, so a
  later "reuse the store" refactor goes red instead of silently bounding a project budget with a
  per-instance counter.
- **Adjacent residual, outside this task's Target Files (recorded, not fixed).** `consumeQuota()` builds
  the **third** `new Redis({ url, token })` from `KV_REST_API_URL`/`KV_REST_API_TOKEN` in the repo
  (`rateLimitStore.ts:71-77`, `readEntitlement.ts:200-204`). Task 2.1's completion note hands "the
  extraction" to this task, but the extraction cannot land here: it requires editing
  `readEntitlement.ts` and/or adding a module, both outside the Target Files list, and
  `readEntitlement.ts` already imports `quota.ts` so the shared owner cannot be `quota.ts` without a
  cycle. Handoff: one `lib/billing/redisClient.ts` (or `lib/security/`), consumed by all three.

### Where `unknown` gets its key inputs

The frozen `Entitlement` carries neither `period_anchor_at` nor `user_profiles.created_at`, and the
signature is fixed at four parameters. So the two branches are:

- quota state **`known`** ⇒ `periodStart = Date.parse(resetsAt) - PERIOD_MS`. Exact inverse (above),
  zero I/O on the hot path.
- quota state **`unknown`** (or an unparseable `resetsAt`) ⇒ read `subscriptions.period_anchor_at` +
  `user_profiles.created_at` for this user and call `periodStartEpoch(ent.plan, anchor, createdAt, now)`
  — the same single owner the read path calls. Not a second key shape; not a bare key; not a guess.
  Read fails or `periodStartEpoch()` throws (premium with no anchor) ⇒ **refuse `unavailable`**.

That read is deliberately **not** `readEntitlement.readAccount()`'s shape: it selects only the two
key-derivation columns (no `expires_at`), and its failure direction is the opposite one (fail-closed
refusal, not `FREE_FALLBACK`). Same domain and same directory, different output and different failure
contract — below the duplication threshold, recorded here so it is a decision rather than an oversight.

### Reference Contracts — planned approach (recorded before implementation)

| Row | Planned approach | Check | Result |
|---|---|---|---|
| § The two counters count different things | `redis.incr(quotaKey(kind, userId, periodStart))` — one call, no `geminiCalls` term anywhere near it; `redis.incrby(budgetKey(now), geminiCalls)` — the parameter used verbatim, never re-derived from `kind` | per-user key +1 in both upload modes; budget +3 / +2 / +1 | **Y** |

### `AI_BUDGET_FREE_SHARE` — the open handoff this task owned, decided

**Decision: a FRACTION.** `0.5` = 50%. Valid range `(0, 1]`; anything outside (including a
non-number, `0`, or a negative) falls back to `0.5`. The full reasoning is recorded at the
definition site in `quota.ts` beside `FREE_SHARE_DEFAULT`, so the question cannot be reopened
by reading the code alone.

*(An earlier draft of these notes recorded the opposite — percent, clamped to `(0, 100]`. It was
written before the operator-typo directions were compared and is superseded by what follows.)*

The deciding argument is the **direction of failure when an operator types the other encoding**,
not preference. `checkEnv.ts` deliberately accepts any finite number `> 0`, and
`checkEnv.test.ts` enumerates exactly `"0.5"` and `"50"` as the two silent values — so both
strings will be typed in production:

| Encoding read here | Operator types `0.5` | Operator types `50` |
|---|---|---|
| **percent** | 0,5% of the day ⇒ `floor(20 × 0.005) = 0` ⇒ **every Free request refused**, from the day's first one. `0.5` is a *valid* percent, so nothing catches it | 50% ⇒ correct |
| **fraction (chosen)** | 50% ⇒ correct | out of `(0, 1]` ⇒ falls back to `0.5` = **the number they meant** |

Fraction plus a validity range makes *both* plausible spellings of "50%" resolve to 50%. Percent
makes one of them a total, silent outage for the majority of users. Out-of-range falls back
rather than throwing, because a bad reservation share degrades a **policy**; it does not remove a
spend ceiling (that is `AI_BUDGET_DAILY_LIMIT`, which fails the opposite way — absent ⇒ refuse).

Two cases pin the contract, and each rejects one wrong reading: `"0.5"` with an empty budget must
be **served** (a percent reading refuses it), and `"50"` with the budget at 10 must be **refused**
(an unclamped fraction reading would allow up to 1000).

### Key agreement — the five fixtures, byte-compared

Each row was asserted three ways against **one hand-written literal string**: the key the read
path passes to `mget`, the key the write path increments via the `known` branch (period start
derived backwards from `resetsAt`), and the key the write path increments via the `unknown`
branch (period start derived forwards through `periodStartEpoch()` from Supabase). Building the
expectation with `quotaKey()` — the helper *both* sides call — would prove nothing, so no
expectation below comes from the code under test.

| Fixture | `now` | Byte-identical key string |
|---|---|---|
| premium with `period_anchor_at` | anchor + 5 d | `quota:tutor:7c9e6679-7425-40de-944b-e07fc1f90ae7:1772549110500` |
| free, creation-day 15 | created + 15 d | `quota:tutor:7c9e6679-7425-40de-944b-e07fc1f90ae7:1768468653123` |
| free, creation-day 29 (floor, not round) | created + 29 d | `quota:tutor:7c9e6679-7425-40de-944b-e07fc1f90ae7:1768468653123` |
| free, creation-day 31 (second period) | created + 31 d | `quota:tutor:7c9e6679-7425-40de-944b-e07fc1f90ae7:1771060653123` |
| inside grace (AC-011 — unchanged) | expiry + 1 d | `quota:tutor:7c9e6679-7425-40de-944b-e07fc1f90ae7:1772549110500` |

The grace row is the same string as the premium row **by requirement**: grace grants access, never
allowance, so the counter keeps counting into the period already paid for.

### What the implementation does, in the two places a reader would otherwise have to guess

- **Where the period start comes from.** `known` ⇒ `Date.parse(resetsAt) − PERIOD_MS`, the exact
  inverse of the read path's own `resetsAt = periodStart + PERIOD_MS`, at the same millisecond
  precision and with zero I/O on the hot path. `unknown` (or an unparseable `resetsAt`) ⇒ read
  `subscriptions.period_anchor_at` + `user_profiles.created_at` and call `periodStartEpoch()`, the
  single owner the read path calls. Either read failing — or `periodStartEpoch()` throwing on a
  premium row with no anchor — refuses with `unavailable`. No branch guesses; no branch produces a
  bare key.
- **Order of operations, and why refusals roll back.** `INCR` the period key → `PEXPIRE` it →
  refuse `user_quota` if it now exceeds `PLAN_LIMITS[plan][kind]` → one `INCRBY budget geminiCalls`
  → `EXPIRE` 26 h → refuse `project_budget` if it now exceeds the ceiling. Both refusals restore
  both counters: a user must not lose an allowance to a project-wide refusal, and a request that
  was never emitted must not spend supplier budget. A refusal for `user_quota` therefore issues
  **zero** budget commands at all — asserted by call count, not by the returned value.
- **Ceiling by plan, one key.** There is one `ai:budget:{pacificDay}` counter; what differs by plan
  is the threshold compared against it — `dailyLimit` for premium, `floor(dailyLimit × share)` for
  free. That is the stricter of the two available readings of AC-023 and the only one a single key
  supports.
- **Config failures refuse before any write.** A missing or non-integer `AI_BUDGET_DAILY_LIMIT`
  returns `unavailable` with **zero** Redis commands issued, so a deployment that forgot the
  variable cannot burn user allowances while refusing to serve them.

### Verification actually performed

- 41 added cases, all green. 39 of them were observed RED against the absent function; the two
  source-scan guards (`quota:` single site, no `rateLimit` import) were already true, so their
  discriminating power was established by mutation instead of by absence.
- **24 mutations, each with its anchor verified to match exactly once, 0 survivors.** The
  `geminiCalls = 1` mutation is caught twice over: `consumeQuota.length` at runtime, and
  `TS2578 Unused '@ts-expect-error'` under `tsc --noEmit`.
- Gates: `npm test` **1455 pass / 10 skip** (118 files), `npx tsc --noEmit` 0, `npm run lint`
  clean, `npm run build` 24/24 pages. **No production deployment of this branch has occurred.**

### Reference Contracts — Exit Gate re-evaluation against the final implementation

| Row | Evidence in the final code | Result |
|---|---|---|
| § The two counters count different things | `redis.incr(quotaKey(...))` — one call, no `geminiCalls` term near it; `redis.incrby(budgetKey(now), geminiCalls)` — the parameter used verbatim, never re-derived from `kind`. Asserted as real store deltas: per-user key **+1** in both upload modes, budget **+3** (`automatic`) / **+2** (otherwise) / **+1** (tutor), plus a full call-log equality proving one `INCRBY` rather than *n* `INCR` ticks | **Y** |
