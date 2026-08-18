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
- [ ] `SOURCE/lib/security/rateLimit.ts`
- [ ] `SOURCE/lib/security/rateLimit.test.ts` (**one added case only**; four existing blocks untouched)

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
- [ ] Read all Investigation Targets and record the four protected assertion blocks verbatim
- [ ] Write the one added paid-tier case (with `vi.resetModules()` + re-import) and confirm it fails first
### 2. Green Phase
- [ ] Add the plain conditional at the definition site with the B-01 comment; run the added case
### 3. Refactor Phase
- [ ] Diff `rateLimit.test.ts` and confirm the four existing blocks are byte-for-byte unchanged

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
- [ ] The one added case passes; the four existing assertion blocks pass **unmodified**
- [ ] The derivation is a plain conditional at the definition site with a comment naming both ceilings and B-01
- [ ] `isPaidTierEnabled()` is the only flag reader; no `process.env` read in `rateLimit.ts`
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: `SOURCE/lib/security/rateLimit.ts`; downstream, plan Task 6.8.
- Scope boundary: no helper, lookup table or wrapper; `explainStep` stays in `SUPPLIER_CAPPED_ACTIONS`.
