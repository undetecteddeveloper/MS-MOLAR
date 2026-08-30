# Task B1.3 — `lib/essay/budget.ts` — the Groq daily counter

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.3**
Layer: **backend** (`SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task H2**.
- Blocks: **Task B1.4**.
- Provides: `reserveGroqBudget()` — the **only** gate on Groq spend.
- Size: Small (2 files)
- Verification level: **L2**.

## Implementation Content

Create `SOURCE/lib/essay/budget.ts` with `import "server-only"` and

```
reserveGroqBudget(calls: number, now: Date):
  Promise<{ ok: true } | { ok: false; reason: "project_budget" | "unavailable" }>
```

- Exactly **one** `INCRBY` of the **worst case**, emitted **before the first request**, on `` `groq:budget:${pacificDay(now)}` `` — the key pattern is composed **inline here**, and only the day comes from `lib/billing/budgetDay.ts` (DD v1.7; the old `pacificDayKey(prefix, now)` shape was retired during Task H2 because it silently disabled the `ai:budget:` single-site source guard and made a trailing-colon prefix an unenforceable contract). `lib/billing/budgetDay.ts`, with TTL `BUDGET_TTL_SECONDS`.
- **No per-call accumulation. No refund** when the pass succeeds first try.
- **Fail closed** when the store is unreachable or `GROQ_BUDGET_DAILY_LIMIT` is missing or invalid.
- `calls` is **required** — no default value.

### Recorded trade-off, not a defect
Over-reservation on first-try successes puts effective daily throughput below the nominal request ceiling. That is `consumeQuota()`'s existing directional bias — **over-counting is the safe direction, under-counting is the incident** — and it is the only shape under which the counter actually bounds real spend.

## Target Files
- [x] `SOURCE/lib/essay/budget.ts` (new)
- [x] `SOURCE/lib/essay/__tests__/budget.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `budget.ts` line: one `INCRBY` on `groq:budget:{Pacific day}`, worst-case reservation, fail-closed)
- `docs/design/essay-auto-scoring-backend-design.md` (§ EG-BE-019 / EG-BE-020 / EG-BE-021)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 6: the worst case reserved in a single `INCRBY` before the first request, on a Groq-only daily key, never on the Gemini key; fail closed; ordering **claim → reserve → provider → settle**)
- `docs/adr/ADR-0006-gemini-extraction-protocol.md` (§ Decision — free-tier limits are **per project, not per user**)
- `SOURCE/lib/billing/budgetDay.ts` (Task H2 — `pacificDay()`, `BUDGET_TTL_SECONDS`; **import**, never re-derive)
- `SOURCE/lib/billing/quota.ts` (`:9-18` the header comment on the split-counter failure mode; `budgetKey()` — private, the Gemini side of the pair)
- `SOURCE/lib/billing/__tests__/quota.test.ts` (the Redis mock boundary this task reuses)
- `SOURCE/lib/env/checkEnv.ts` (Task H4 — `GROQ_BUDGET_DAILY_LIMIT`, registered fail-closed)
- `SOURCE/lib/essay/groqClient.ts` (Task B1.2 — `GROQ_MAX_IN_PASS_RETRIES`, the source of the worst-case number `1 + GROQ_MAX_IN_PASS_RETRIES`)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The Groq budget reserves the worst case (`1 + MAX_IN_PASS_RETRIES`) in a single `INCRBY` before the first request, on a Groq-only daily key, never on the Gemini `ai:budget:{Pacific day}` key; fail closed when the store is unreachable. Ordering **claim → reserve → provider → settle** is a requirement | One `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` is emitted on `groq:budget:{Pacific day}` before the first request, and the module refuses when the store is unreachable |
| `docs/adr/ADR-0006-gemini-extraction-protocol.md` (§ Decision) | placement | Free-tier limits are **per project, not per user**, and the model catalogue has broken once with a real key — which is why the model name is a constant under `lib/ai/models.ts` discipline | The counter is a **project-wide** daily counter, not per user, and this module declares no model name |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-019) | state-lifecycle-negative | "Bộ đếm ngân sách chấm **phải** dùng khoá `groq:budget:{ngày Pacific}`; chuỗi `ai:budget:` **phải không** xuất hiện ở bất kỳ đâu trong đường mã chấm tự luận." | The key is composed inline as `` `groq:budget:${pacificDay(now)}` `` (DD v1.7), and a repo scan finds no `ai:budget:` in the essay grading code path |
| backend DD (§ EG-BE-020) | derived-display | "**Khi** pass chấm cho một câu bắt đầu, hệ thống **phải** phát **đúng một** `INCRBY` bằng `1 + GROQ_MAX_IN_PASS_RETRIES` **trước** request đầu tiên, và **phải không** hoàn lại khi pass thành công ngay lần đầu." | Exactly one `INCRBY` with that argument value is emitted before the first request, and no decrement follows a first-try success |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `reserveGroqBudget()` → Upstash Redis |
|---|---|
| Owner (left) | `SOURCE/lib/essay/budget.ts` |
| Owner (right) | Upstash Redis via `KV_REST_API_URL` / `KV_REST_API_TOKEN` |
| Serialized format | Key string `groq:budget:{YYYY-MM-DD}` composed inline as `` `groq:budget:${pacificDay(now)}` `` (DD v1.7) from `lib/billing/budgetDay.ts`; **TTL 26 hours**; one `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` |
| Consumer parse rule | The same module reads back the incremented value and compares it against `GROQ_BUDGET_DAILY_LIMIT`; unreachable store or missing/invalid limit ⇒ **refuse** |
| Expected signal | The literal `ai:budget:` appears **nowhere** in the essay grading code path (prefixes differ at the first character, so a typo cannot turn one key into the other); `quota.ts`'s existing tests stay green with zero edits after the day-key move |

Roundtrip check this task owns: the key this module writes is the key it reads back, composed by the **one** shared declaration — never a second derivation.

## Investigation Notes

**Observed at the mocked Redis boundary** (the boundary `quota.test.ts:100-110` already uses):

- `INCRBY` called **exactly once**, with arguments `("groq:budget:2026-02-28", 3)`. The argument **value** is asserted, not merely that the call happened — a per-call `INCRBY 1` implementation passes a call-count check while reserving less than it may spend, which is precisely the under-count both counters exist to prevent. The `3` is asserted as `GROQ_CALLS_PER_ESSAY` imported from `groqClient.ts`, never as a typed literal.
- `EXPIRE` called with `("groq:budget:2026-02-28", 93600)` — `BUDGET_TTL_SECONDS`, 26 hours, asserted as `26 * 60 * 60`.
- **No `DECRBY`** on the under-ceiling path (EG-BE-020's no-refund half).
- Over ceiling: `DECRBY` with the **same** `calls` value, then `{ ok: false, reason: "project_budget" }`.
- Boundary is `>` not `>=`: a read-back of exactly `600` against a limit of `600` still returns `{ ok: true }`. A `>=` implementation would refuse the last request the budget paid for.

**Pacific-day key, verified against the trap `budgetDay.ts:20-24` names:** `2026-03-01T05:30:00Z` composes `groq:budget:2026-02-28`, because at 05:30Z the Pacific day is still the previous one. A `toISOString().slice(0,10)` re-derivation would produce `2026-03-01` and split the counter mid-day.

**Three fail-closed exits, each triggered separately:**

| Exit | How it was triggered | Result | Store touched? |
|---|---|---|---|
| store unreachable | `redis.incrby` mock rejects | `{ ok: false, reason: "unavailable" }` | attempted, threw |
| `KV_REST_API_*` missing | `delete process.env.KV_REST_API_URL` | `{ ok: false, reason: "unavailable" }` | **no** |
| limit missing | `delete process.env.GROQ_BUDGET_DAILY_LIMIT` | `{ ok: false, reason: "unavailable" }` | **no** |
| limit invalid | `"0"`, `"-5"`, `"abc"`, `"1.5"`, `""`, `"   "` — all six | `{ ok: false, reason: "unavailable" }` | **no** |

`unavailable` and `project_budget` are asserted to be **different** values in one test, because telemetry writes `project_budget_exhausted` for one and not the other.

**Repo scan for `ai:budget:` under `lib/essay/`: `[]`** — appears nowhere. Also added the symmetric single-site gate to mirror `quota.test.ts:868`: the repo has **exactly one** place composing the `groq:budget:` key pattern, and it is `lib/essay/budget.ts`.

**AC-066 preserved, verified rather than asserted:** `git status SOURCE/lib/billing/` is **empty** — `quota.ts`, `QuotaKind`, `PLAN_LIMITS` and every `consumeQuota()` call site are untouched, and `npx vitest run lib/billing/` is **10 files / 208 tests green with zero edits**. That is the H2 behaviour-preservation claim holding.

**Mutation testing — the three assertions that matter were checked for the ability to fail:**

| Mutation applied to `budget.ts` | Result |
|---|---|
| `catch` returns `{ ok: true }` (a Redis outage becomes unlimited spend — the incident direction) | **2 failed** / 18 passed |
| `incrby(key, 1)` instead of `incrby(key, calls)` (per-call accumulation) | **1 failed** / 19 passed |
| key composed as `ai:budget:` (Groq spend on the Gemini counter) | **6 failed** / 14 passed |

Each was caught, and the module was restored from backup after each.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write `budget.test.ts` asserting the `INCRBY` **argument value**, the TTL, and **all three** fail-closed exits; observe them fail because the module does not exist

### 2. Green Phase
- [x] Create `budget.ts`: `server-only`, one `INCRBY` of the worst case before the first request, TTL `BUDGET_TTL_SECONDS`, read-back compared against `GROQ_BUDGET_DAILY_LIMIT`, `calls` required
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Repo-scan the essay grading code path for `ai:budget:` — it must appear **nowhere**
- [x] Confirm the module imports `pacificDay` and `BUDGET_TTL_SECONDS` rather than re-deriving either
- [x] Confirm `QuotaKind`, `PLAN_LIMITS` and every `consumeQuota()` call site are untouched (AC-066)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: `server-only` does not leak into a client tree — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**`

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1781 passed / 10 skipped / 3 todo. +20 from this task. See the run-stability note below |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` › FE-1 (e) — `locale en` and `locale vi`. Case names captured |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo |
| 7 | `npm run check:bundle` | **0** | |

**Known-red window recorded (Gate E4 requires it at every commit inside it):** `npm run verify:schema` (dev) → exit **1**, exactly **1** failing assertion, the character-ceiling gate. Red by design from H7 until B3.3.

**Run-stability note, recorded because the evidence is incomplete and should not be dressed up.** The first full `npx vitest run` of this task reported **1 failure**, and my command only grepped the summary line, so **the failing case name was not captured** — the same evidence-handling mistake I made earlier in the session. What was then established: **six** subsequent full-lane runs are green at 1781 passed — three plain, plus three under `--sequence.shuffle` with seeds 1, 2, 3. The shuffle runs were chosen deliberately because this task's test file mutates `process.env` (`KV_REST_API_*`, `GROQ_BUDGET_DAILY_LIMIT`), which makes an ordering dependency the plausible mechanism; no seed reproduced it. So the honest conclusion is **"not reproducible across six runs including shuffled ordering"**, not "identified and ruled out". If this lane goes red again, capture the case name first.

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: with Redis mocked at the boundary `quota.test.ts` already uses, assert the **`INCRBY` argument value**, the TTL, and all three fail-closed exits (store unreachable; `GROQ_BUDGET_DAILY_LIMIT` missing; `GROQ_BUDGET_DAILY_LIMIT` invalid); repo-scan the essay path for `ai:budget:`.
- **Success criteria**: exactly one `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` on `groq:budget:{Pacific day}` with a 26-hour TTL, emitted **before** the first request; no refund on first-try success; all three fail-closed exits return `{ ok: false }` with the right reason; `ai:budget:` appears nowhere in the essay path.
- **Failure response**: if any exit passes **unmetered** when the store is unreachable, that is the incident direction — fix the module rather than relaxing the test. If the key composes to `ai:budget:…`, the module re-derived the day key instead of importing it.
- **Verification level**: **L2**.

## Proof Obligations
- **Claim (EG-BE-019 / AC-030)**: the key is `groq:budget:{Pacific day}`, and `ai:budget:` appears **nowhere** in the essay grading code path — AC-030 holds by **name structure** rather than by discipline (the prefixes differ at the first character).
  - **Primary failure mode**: a typo or a re-derivation putting Groq spend on the Gemini counter, so a day of heavy grading denies Gemini extraction to everyone. **Boundary**: in-process unit + repo scan. **State assertion**: the incremented key name observed at the mocked Redis boundary. **Mock rationale**: Redis mocked at the boundary `quota.test.ts` already uses — it is external I/O. **Residual**: none.
- **Claim (EG-BE-020)**: exactly **one** `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` **before** the first request, and **no refund** on a first-try success.
  - **Primary failure mode**: per-call accumulation, so a pass that retries twice reserves less than it may spend and the ceiling stops bounding real spend. **Boundary**: in-process unit; assert the argument value, not merely that `INCRBY` was called. **State assertion**: counter before → one increment → after; no decrement on success. **Mock rationale**: as above. **Residual**: that no **second** `INCRBY` is emitted on an in-pass retry is asserted in B1.4.
- **Claim (EG-BE-021 / Failure Mode Checklist: unavailable boundary, missing config)**: an unreachable store, or a missing/invalid `GROQ_BUDGET_DAILY_LIMIT`, ⇒ **refuse to grade**; the question settles `failed`; **never** pass unmetered.
  - **Primary failure mode**: a `catch` returning `{ ok: true }` so a Redis outage becomes unlimited spend. **Boundary**: in-process unit with the mocked store made to throw, and with the env variable absent and invalid. **State assertion**: no `INCRBY` is credited when the store is unreachable. **Mock rationale**: as above. **Residual**: the settle-to-`failed` half is B1.4's.
- **Claim (AC-066)**: `QuotaKind`, `PLAN_LIMITS` and every `consumeQuota()` call site are untouched — this counter is the **only** gate.
  - **Primary failure mode**: grading quietly consuming a student's Gemini quota. **Boundary**: repo diff review. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [x] **Implementation Complete** = module + tests
- [x] **Quality Complete** = six verify gates green (plus `check:bundle`); gate 5 red = TD-030 baseline only
- [x] **Integration Complete** = N/A until Task B1.4
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B1.4 calls this **after** the claim and **before** the provider (Gate G ordering); Task B3.2's retry drives the same path.
- Scope boundary — preserve unchanged: `SOURCE/lib/billing/quota.ts` (H2 owns it; **no new export**), `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and every `consumeQuota()` call site.
- `GROQ_BUDGET_DAILY_LIMIT`'s **value** (600) is confirmed in Phase E, Task E2 — this module reads it, it does not decide it.
