# Task: B-01 — tier-conditional `RATE_LIMITS.explainStep.limit`

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.6**
Layer: **backend** (`SOURCE/lib/security/**`)

Metadata:
- Dependencies: backend-task-12 (plan Task 1.4)
- Provides: the ceiling that plan Task 6.8 flag flip raises
- Size: Small (1 file + one added test case)

## Implementation Content

Derive `RATE_LIMITS.explainStep.limit` from `isPaidTierEnabled()` (`paidTier.ts:28`): **`3`/24h while the paid tier is off, `50`/24h once it is on**; `windowMs` stays **24h on both branches**.

- The derivation stays **at the definition site** as a plain conditional with a comment naming **both ceilings and B-01** — never behind a helper, a lookup table or a wrapper.
- The value must remain readable as `RATE_LIMITS.explainStep.limit`, a `number`.
- `explainStep` **stays** in `SUPPLIER_CAPPED_ACTIONS`.
- Read the flag through `isPaidTierEnabled()`, **never** by re-reading `process.env` in `rateLimit.ts` — a second copy of the affirmative set would be a second source of truth for a fail-closed release gate.

### Constraint, checkable

`rateLimit.test.ts` existing assertions at **`:127-135`, `:137-142`, `:166-171` and `:186-192` stay byte-for-byte as they are and must pass unmodified.** A change that requires editing any of them is the signal that the implementation took the rejected flat-50 branch; **the correct response is to revert to the tier-conditional derivation, not to rewrite the assertion.**

**One added case** builds the paid-tier variant (`vi.resetModules()` + re-import after stubbing the env, because `RATE_LIMITS` is evaluated once at module load) and asserts `limit >= 50` and `windowMs === 24h` — and must **not** apply the `SUPPLIER_DAILY_QUOTA` invariants to that variant, since `20` is a free-tier fact.

## Target Files
- [x] `SOURCE/lib/security/rateLimit.ts`
- [x] `SOURCE/lib/security/rateLimit.test.ts` (**one added case only**; four existing blocks untouched)

## Investigation Targets
- `SOURCE/lib/security/rateLimit.ts` (the `RATE_LIMITS` definition site and `SUPPLIER_CAPPED_ACTIONS`)
- `SOURCE/lib/security/rateLimit.test.ts` (`:127-135`, `:137-142`, `:166-171`, `:186-192` — the four blocks that must pass unmodified; `:181-184` `GEMINI_REQUESTS_PER_CALL` as changed by plan Task 5.2)
- `SOURCE/lib/billing/paidTier.ts` (`:26`, `:28` — `isPaidTierEnabled()` and its fail-closed shape)
- `docs/design/subscription-backend-design.md` (§ Recorded Decision B-01)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Recorded Decision B-01) | derived-display | **paid tier enabled ⇒ 50/day** … **paid tier disabled ⇒ 3/day, unchanged**. `windowMs` stays 24h in both branches | `RATE_LIMITS.explainStep.limit` reads 3 with the flag off and >= 50 with it on, `windowMs` 24h in both |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record the four protected assertion blocks verbatim
- [x] Write the one added paid-tier case (with `vi.resetModules()` + re-import) and confirm it fails first
### 2. Green Phase
- [x] Add the plain conditional at the definition site with the B-01 comment; run the added case
### 3. Refactor Phase
- [x] Diff `rateLimit.test.ts` and confirm the four existing blocks are byte-for-byte unchanged

## Quality Assurance Mechanisms
- `rateLimit.test.ts` three-family partition — Enforces: every `RATE_LIMITS` key is classified in exactly one family and its family invariants hold — Config: `SOURCE/lib/security/rateLimit.test.ts:93-99, :107-110, :118-121, :127-135`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: run `npm test`, then diff `rateLimit.test.ts` against its pre-task state.
- **Success criteria**: the four existing assertion blocks pass **unmodified**; the one added paid-tier case is green (`limit >= 50`, `windowMs === 24h`, no `SUPPLIER_DAILY_QUOTA` invariant applied); `explainStep` still in `SUPPLIER_CAPPED_ACTIONS`.
- **Failure response**: if any of the four blocks needs editing, **revert to the tier-conditional derivation** — the edit is the signal that the rejected flat-50 branch was taken.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: the tutor ceiling follows the release flag, in one place, with no second source of truth.
- **Primary failure mode**: `process.env` is re-read inside `rateLimit.ts`, creating a second affirmative set for a fail-closed release gate; or the derivation is hidden behind a helper and stops being readable at the definition site.
- **Boundary to exercise**: module-load evaluation of `RATE_LIMITS`, exercised through `vi.resetModules()` + re-import.
- **State assertion**: flag off ⇒ `limit` 3; flag on ⇒ `limit >= 50`; `windowMs` 24h in both.
- **Mock boundary rationale**: only `process.env` is stubbed; `isPaidTierEnabled()` stays real, because reading the flag through it is the decision under test.
- **Residual**: the operational consequence of turning the flag **off** after subscriptions exist (live Premium holders drop to 3/day while holding a 500/period entitlement) is recorded in plan Task 6.8 as an **incident action, not a routine toggle**.

## Completion Criteria
- [x] The one added case passes; the four existing assertion blocks pass **unmodified**
- [x] The derivation is a plain conditional at the definition site with a comment naming both ceilings and B-01
- [x] `isPaidTierEnabled()` is the only flag reader; no `process.env` read in `rateLimit.ts`
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — still open by design: Task 5.8 is not green, and **no production deployment of this branch has occurred**. This task ships the derivation only; the flag flip stays with plan Task 6.8.

## Investigation Notes

### Investigation Targets, as read
- **`SOURCE/lib/security/rateLimit.ts`** — `RATE_LIMITS` is a single module-scope `as const` object literal evaluated **once at module load** (`:107` … `:203` before this task). `explainStep` was `{ limit: 3, windowMs: 24 * 60 * 60 * 1000 }`. Two consumers of the table live in the same file: `LONGEST_WINDOW_MS = Math.max(...map(c => c.windowMs))` (feeds `pruneOldest()`) and `guard()`, which destructures `{ limit, windowMs }` and passes both to `checkRateLimit()` and `hitSharedStore()`. Side effect of raising `limit`: none beyond a wider ceiling — `LONGEST_WINDOW_MS` depends on `windowMs` only, which this task leaves alone on both branches.
- **`SOURCE/lib/security/rateLimit.test.ts`** — the three-family partition (`DB_COST_ACTIONS`, `SUPPLIER_CAPPED_ACTIONS`, `ABUSE_CAPPED_ACTIONS`) plus five invariant cases. `GEMINI_REQUESTS_PER_CALL` now **imports** `GEMINI_CALLS_PER_OPERATION` from `@/lib/ugc/gemini` (plan Task 5.2, commit `14616b6`), so the supplier-budget invariant reads `3×tutor(1) + 5×uploadAutomatic(3) = 18 ≤ 20`. `vi.mock("server-only", () => ({}))` is already at `:13` — the header comment predicted exactly this task's import.
- **`SOURCE/lib/billing/paidTier.ts`** — `isPaidTierEnabled()` (`:28`) reads `process.env.GEMINI_PAID_TIER_ENABLED ?? ""` and returns `AFFIRMATIVE.has(raw.trim().toLowerCase())` with `AFFIRMATIVE = new Set(["1", "true"])`; module carries `import "server-only"`. Fail-closed: anything else, including unset, is OFF.
- **Plan Task 5.6 / DD § Recorded Decision B-01** — 3/day flag off, 50/day flag on, `windowMs` 24h in both.
- **The four protected assertion blocks: the plan's line numbers are stale.** They were pinned to commit `eed6003`; two later commits (`0ebf47d`, `14616b6`) shifted them. Located by content and verified byte-identical to the `eed6003` bytes (376 / 279 / 299 / 330 bytes):

| Plan cites (`eed6003`) | Case | True line numbers now |
|---|---|---|
| `:127-135` | `classifies every configured action into exactly one category` | **`:148-156`** |
| `:137-142` | `keeps every DB-cost limit generous enough not to hit a real user` | **`:158-163`** |
| `:166-171` | `keeps every supplier-capped limit under the supplier quota, on its day unit` | **`:187-192`** |
| `:186-192` | `keeps ONE account's whole daily Gemini budget under the project quota` | **`:214-220`** |

### Planned approach (recorded before implementation)
A plain conditional at the definition site: `explainStep: { limit: isPaidTierEnabled() ? 50 : 3, windowMs: 24 * 60 * 60 * 1000 }`, with a comment naming both ceilings and B-01, and `isPaidTierEnabled()` imported from `@/lib/billing/paidTier` as the only flag reader. `windowMs` stays a single expression outside the conditional. `explainStep` stays in `SUPPLIER_CAPPED_ACTIONS`.

### Reference Contracts — Compliance Check
| Source | Compliance Check | Evaluation | Evidence |
|---|---|---|---|
| backend DD § Recorded Decision B-01 | `RATE_LIMITS.explainStep.limit` reads 3 with the flag off and >= 50 with it on, `windowMs` 24h in both | **Y** | Flag off: the four protected blocks pass unmodified and the added case asserts `toBe(3)` on the flag-off table. Flag on: the added case re-imports after `vi.stubEnv` + `vi.resetModules()` and asserts `>= 50` and `windowMs === 86_400_000`. Both branches proven RED under collapse-to-`3` and collapse-to-`50` mutations. |

### What bounds the paid tier (why `SUPPLIER_DAILY_QUOTA` is not applied to it)
`20` is the **free-tier** Gemini quota. The flag is only turned on after Google billing is verified live (AC-048), at which point 20/day is no longer the binding constraint. What bounds a paid user instead: the **per-plan quota** in `lib/billing/quota.ts` (Premium 500 calls / 30-day period ≈ 16.7/day, enforced per user through `consumeQuota()`), and the **project AI budget** (`ai:budget:` daily ceiling in the same module). `50/day` sits deliberately **above** 16.7 so this guard never cuts into what was sold — it stays what it always was, a loop-stopper, while the entitlement does the metering. Applying the `18 ≤ 20` arithmetic to the paid variant would read `50×1 + 5×3 = 65 ≤ 20` and be false; that is a statement about the free tier, not a defect in the paid branch.

### Adjacent residual, recorded not fixed
`uploadExam` (5/day × 3 requests) is the *other* consumer of the same Gemini quota and stays free-tier-shaped on both branches. Turning the flag on therefore raises the tutor ceiling while leaving the upload ceiling where it is — deliberate (B-01 speaks only about the tutor ceiling), but it means the "one account's whole daily budget" invariant has no paid-tier counterpart. TD-019 (a project-level budget) is the real answer and is already recorded there.

## Notes
- Impact scope: `SOURCE/lib/security/rateLimit.ts`; downstream, plan Task 6.8.
- Scope boundary: no helper, lookup table or wrapper; `explainStep` stays in `SUPPLIER_CAPPED_ACTIONS`.
