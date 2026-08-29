# Task H2 — `lib/billing/budgetDay.ts` + behaviour-preserving move out of `quota.ts`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H2**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: **none** (can run in parallel with H1).
- Blocks: **Task B1.3** (`lib/essay/budget.ts` composes its key from this module).
- Provides: `SOURCE/lib/billing/budgetDay.ts` — the **single** declaration of the Pacific day key and the TTL, imported back by `quota.ts`.
- Size: Small (2 files)
- Verification level: **L2**.

## Implementation Content

Create `SOURCE/lib/billing/budgetDay.ts` holding the **single** declaration of:
- `BUDGET_TIME_ZONE = "America/Los_Angeles"`
- the `PACIFIC_DAY` formatter
- `BUDGET_TTL_SECONDS = 26 * 60 * 60`
- `pacificDayKey(prefix, now)` composed from `formatToParts` — **not** from a locale-formatted string.

Then edit `SOURCE/lib/billing/quota.ts`: delete `BUDGET_TTL_SECONDS` (`:132`), `BUDGET_TIME_ZONE` (`:141`) and `PACIFIC_DAY` (`:179-184`), and reduce `budgetKey()` (`:186-191`) to `return pacificDayKey("ai:budget", now);`.

### Scope boundary
`budgetKey()` stays **private**. `quota.ts` gains **no** new export. `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and **every** `consumeQuota()` call site are untouched (AC-066). The new module knows about **days and TTL only** — it does not know spending ceilings, which env var holds them, or plan shares; those differ between the two providers and stay with the consumers.

## Target Files
- [ ] `SOURCE/lib/billing/budgetDay.ts` (new)
- [ ] `SOURCE/lib/billing/quota.ts` (modified — four deletions and one reduced function body)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Forced choice / MSA-3 — shared `budgetDay.ts` rather than duplicating or exporting five helpers)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Minimal Surface Alternatives — MSA-3, MSA-4)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 6: the Groq budget key is never the Gemini `ai:budget:{Pacific day}` key)
- `SOURCE/lib/billing/quota.ts` (`:9-18` the header comment warning about exactly this failure mode for the read/write pair; `:132` `BUDGET_TTL_SECONDS`; `:141` `BUDGET_TIME_ZONE`; `:179-184` `PACIFIC_DAY`; `:186-191` `budgetKey()`)
- `SOURCE/lib/billing/__tests__/quota.test.ts` (the existing suite — it must stay green with **not one line edited**, and it is the proof that the move preserves behaviour)

## Boundary Context (from the work plan's Connection Map)

| Boundary | `reserveGroqBudget()` → Upstash Redis |
|---|---|
| Owner (left) | `SOURCE/lib/essay/budget.ts` (Task B1.3) |
| Owner (right) | Upstash Redis via `KV_REST_API_URL` / `KV_REST_API_TOKEN` |
| Serialized format | Key string `groq:budget:{YYYY-MM-DD}` composed by `pacificDayKey("groq:budget", now)` **from this module**; TTL 26 hours; one `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` |
| Consumer parse rule | The same module reads back the incremented value and compares against `GROQ_BUDGET_DAILY_LIMIT`; unreachable store or missing/invalid limit ⇒ refuse |
| Expected signal | The literal `ai:budget:` appears nowhere in the essay grading code path (the prefixes differ at the first character, so a typo cannot turn one key into the other); **`quota.ts`'s existing tests stay green with zero edits after the day-key move** |

Roundtrip check this task must satisfy: `pacificDayKey("ai:budget", now)` returns the **identical string** `budgetKey()` returned before the move, for the same input.

## Investigation Notes
_(Record here: the exact string `budgetKey()` returned for a fixed `now` before the move, and the same string after; confirmation that `git diff` on `quota.test.ts` is empty.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Record the **current** output of `budgetKey()` for a fixed `now`, from a baseline run, before making any change
- [ ] Write `SOURCE/lib/billing/__tests__/budgetDay.test.ts` (or extend an equivalent) asserting `pacificDayKey(prefix, now)` composes from `formatToParts` and returns that recorded literal for the recorded input; confirm it fails (the module does not exist)

### 2. Green Phase
- [ ] Create `budgetDay.ts` with the four declarations
- [ ] Reduce `quota.ts`: delete the three moved declarations and rewrite `budgetKey()` to one line
- [ ] Run the existing `quota` suite **without editing it** and confirm it is green

### 3. Refactor Phase
- [ ] Confirm `quota.ts` gained **no** new export and `budgetKey()` is still private
- [ ] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: static types — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit correctness; **the untouched `quota` suite is the whole proof of this task** — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Enforces: lint; unused declarations after the deletions — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: production build — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: compare `budgetKey()`'s output before and after the move for the same fixed `now`, and run the **existing** `quota` test suite with **zero** edits to it.
- **Success criteria**: `budgetKey()` returns the identical string for the same input; the `quota` suite is green and `git diff` on its file is empty.
- **Failure response**: a red `quota` run after this change has exactly **one** possible cause — the move did not preserve behaviour. Fix `budgetDay.ts`; do **not** edit the test to match. That is why this task is scheduled before anything new depends on the module.
- **Verification level**: **L2** — the existing suite passing unedited is the proof.

## Proof Obligations
- **Claim**: the Pacific-day derivation has exactly **one** declaration, imported by both consumers, and moving it preserved behaviour byte-for-byte.
  - **Primary failure mode** (Failure Mode Checklist: **shared-state dependency**): duplicating the Pacific-day derivation in the Groq module instead (MSA-3 rejected option (a)) — a second clock whose failure mode is **silent**, splitting one counter across two runtimes with nothing red anywhere. `quota.ts:9-18` was written to warn about exactly this for the read/write pair; the two-provider pair has the same failure mode, so it uses the same declaration.
  - **Boundary to exercise**: in-process unit. The existing `quota` suite exercises the composed key through its own call sites.
  - **State assertion**: N/A — the key string is derived, not stored. (The Redis TTL is exercised by B1.3.)
  - **Mock boundary rationale**: Redis stays mocked at the boundary `quota.test.ts` already uses; the day derivation itself runs real code with an injected `now`.
  - **Residual**: proves the derivation moved without changing output. It does not prove B1.3 uses the module rather than re-deriving — that obligation is B1.3's (`ai:budget:` appears nowhere in the essay path).

## Completion Criteria
- [ ] **Implementation Complete** = module created, `quota.ts` reduced
- [ ] **Quality Complete** = six verify gates green; `quota` tests **untouched** and passing
- [ ] **Integration Complete** = `budgetKey()` still returns the identical string for the same input
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: `SOURCE/lib/essay/budget.ts` (Task B1.3) will import `pacificDayKey` and `BUDGET_TTL_SECONDS` from here.
- Scope boundary — preserve unchanged: `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and every `consumeQuota()` call site (AC-066); `SOURCE/lib/billing/__tests__/quota.test.ts` (**zero edits** — it is the proof).
- The two prefixes differ at the **first character** (`ai:` vs `groq:`), so a typo cannot silently turn one counter's key into the other's.
