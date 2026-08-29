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

- Exactly **one** `INCRBY` of the **worst case**, emitted **before the first request**, on `pacificDayKey("groq:budget", now)` from `lib/billing/budgetDay.ts`, with TTL `BUDGET_TTL_SECONDS`.
- **No per-call accumulation. No refund** when the pass succeeds first try.
- **Fail closed** when the store is unreachable or `GROQ_BUDGET_DAILY_LIMIT` is missing or invalid.
- `calls` is **required** — no default value.

### Recorded trade-off, not a defect
Over-reservation on first-try successes puts effective daily throughput below the nominal request ceiling. That is `consumeQuota()`'s existing directional bias — **over-counting is the safe direction, under-counting is the incident** — and it is the only shape under which the counter actually bounds real spend.

## Target Files
- [ ] `SOURCE/lib/essay/budget.ts` (new)
- [ ] `SOURCE/lib/essay/__tests__/budget.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `budget.ts` line: one `INCRBY` on `groq:budget:{Pacific day}`, worst-case reservation, fail-closed)
- `docs/design/essay-auto-scoring-backend-design.md` (§ EG-BE-019 / EG-BE-020 / EG-BE-021)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 6: the worst case reserved in a single `INCRBY` before the first request, on a Groq-only daily key, never on the Gemini key; fail closed; ordering **claim → reserve → provider → settle**)
- `docs/adr/ADR-0006-gemini-extraction-protocol.md` (§ Decision — free-tier limits are **per project, not per user**)
- `SOURCE/lib/billing/budgetDay.ts` (Task H2 — `pacificDayKey()`, `BUDGET_TTL_SECONDS`; **import**, never re-derive)
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
| backend DD (§ EG-BE-019) | state-lifecycle-negative | "Bộ đếm ngân sách chấm **phải** dùng khoá `groq:budget:{ngày Pacific}`; chuỗi `ai:budget:` **phải không** xuất hiện ở bất kỳ đâu trong đường mã chấm tự luận." | The key is composed by `pacificDayKey("groq:budget", now)`, and a repo scan finds no `ai:budget:` in the essay grading code path |
| backend DD (§ EG-BE-020) | derived-display | "**Khi** pass chấm cho một câu bắt đầu, hệ thống **phải** phát **đúng một** `INCRBY` bằng `1 + GROQ_MAX_IN_PASS_RETRIES` **trước** request đầu tiên, và **phải không** hoàn lại khi pass thành công ngay lần đầu." | Exactly one `INCRBY` with that argument value is emitted before the first request, and no decrement follows a first-try success |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `reserveGroqBudget()` → Upstash Redis |
|---|---|
| Owner (left) | `SOURCE/lib/essay/budget.ts` |
| Owner (right) | Upstash Redis via `KV_REST_API_URL` / `KV_REST_API_TOKEN` |
| Serialized format | Key string `groq:budget:{YYYY-MM-DD}` composed by `pacificDayKey("groq:budget", now)` from `lib/billing/budgetDay.ts`; **TTL 26 hours**; one `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES` |
| Consumer parse rule | The same module reads back the incremented value and compares it against `GROQ_BUDGET_DAILY_LIMIT`; unreachable store or missing/invalid limit ⇒ **refuse** |
| Expected signal | The literal `ai:budget:` appears **nowhere** in the essay grading code path (prefixes differ at the first character, so a typo cannot turn one key into the other); `quota.ts`'s existing tests stay green with zero edits after the day-key move |

Roundtrip check this task owns: the key this module writes is the key it reads back, composed by the **one** shared declaration — never a second derivation.

## Investigation Notes
_(Record here: the observed `INCRBY` argument value and TTL in the mock; the three fail-closed exits and how each was triggered; the repo-scan result for `ai:budget:` in the essay path.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write `budget.test.ts` asserting the `INCRBY` **argument value**, the TTL, and **all three** fail-closed exits; observe them fail because the module does not exist

### 2. Green Phase
- [ ] Create `budget.ts`: `server-only`, one `INCRBY` of the worst case before the first request, TTL `BUDGET_TTL_SECONDS`, read-back compared against `GROQ_BUDGET_DAILY_LIMIT`, `calls` required
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Repo-scan the essay grading code path for `ai:budget:` — it must appear **nowhere**
- [ ] Confirm the module imports `pacificDayKey` and `BUDGET_TTL_SECONDS` rather than re-deriving either
- [ ] Confirm `QuotaKind`, `PLAN_LIMITS` and every `consumeQuota()` call site are untouched (AC-066)

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
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |
| 7 | `npm run check:bundle` | | Gate E2 — this task's files match `SOURCE/lib/essay/**` |

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
- [ ] **Implementation Complete** = module + tests
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = N/A until Task B1.4
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B1.4 calls this **after** the claim and **before** the provider (Gate G ordering); Task B3.2's retry drives the same path.
- Scope boundary — preserve unchanged: `SOURCE/lib/billing/quota.ts` (H2 owns it; **no new export**), `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and every `consumeQuota()` call site.
- `GROQ_BUDGET_DAILY_LIMIT`'s **value** (600) is confirmed in Phase E, Task E2 — this module reads it, it does not decide it.
