# Task F-A1 — 29 display strings: `en.ts` first, then `vi.ts`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-A (Display Foundation, frontend slices V0 + V1), Task F-A1**
Layer: **frontend** (`SOURCE/lib/i18n/**`)

Metadata:
- Dependencies: **Task B2.1** (the `EssaySummary` field names must be fixed before strings are wired to them).
- Blocks: **Task F-A2**, and through it every frontend surface.
- Provides: 28 new keys in both dictionaries; `player.essayNotScored` kept verbatim as the 29th.
- Size: Small (2 files)
- Verification level: **L2/L3** — `npx tsc --noEmit` is the key-coverage gate.

## Implementation Content

Add the 28 new keys to `SOURCE/lib/i18n/dictionaries/en.ts`, **then** to `SOURCE/lib/i18n/dictionaries/vi.ts`.

`player.essayNotScored` (`vi.ts:139`) is **kept verbatim** — it is the 29th and it is **not new**.

**`en.ts` first**: the `Dictionary` type is derived from it (`lib/i18n/translate.ts:4`), so reversing the order makes `vi.ts` fail to compile (AB-12).

### Two keys are reused, not created — a decision, not an omission
Following the convention recorded at `en.ts:5-6` (shared strings are reused, not duplicated):
- `not_found` → `profile.error.sessionExpired` (`vi.ts:653`)
- `server` → `profile.error.generic` (`vi.ts:655`)

Reusing them keeps the inventory at exactly **29 keys, 28 new**.

### Six parameterised strings and where each parameter comes from
| Key | Parameters | Source |
|---|---|---|
| `result.essay.points` | `{earned}` / `{max}` | `EssaySummary.earned` (two decimals, trailing zeros trimmed) and `.max` (integer) |
| `result.essay.denominator` | `{n}` | `EssaySummary.gradedCount` — **not** the exam's total essay count |
| `result.essay.stillGrading` | `{k}` | `pendingCount` |
| `result.essay.someFailed` | `{k}` | `failedCount` |
| `result.essay.band` | `{band}` | a **five-entry lookup table** (UI-D12), **not** `toFixed()` |
| `result.essay.announceProgress` | `{done}` / `{pending}` | the poller's two props |

`createTranslate()` (`translate.ts:25-28`) leaves an unmatched `{name}` **on screen verbatim**, which makes a wiring mistake **visible** rather than silent — no extra mechanism needed.

## Target Files
- [x] `SOURCE/lib/i18n/dictionaries/en.ts` — 28 keys, added **first** (source of the `Dictionary` type)
- [x] `SOURCE/lib/i18n/dictionaries/vi.ts` — the same 28 keys

*(Exactly two files changed; `git status` shows nothing else.)*

## Investigation Targets
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Agreement Checklist Scope — 29 display strings, 28 new + `player.essayNotScored` kept verbatim)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Copy Inventory — the 29 strings)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayScoreLine — the denominator sub-line's exact wording)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ EssayRegradeControl — REFUSAL_KEY: the five mappings, two of which reuse existing keys)
- `SOURCE/lib/i18n/dictionaries/en.ts` (`:5-6` the reuse convention; `:334` `upload.essayStored` — **out of scope**, OQ-5)
- `SOURCE/lib/i18n/dictionaries/vi.ts` (`:139` `player.essayNotScored` — **kept verbatim**; `:271` `upload.essayStored` — out of scope; `:653` `profile.error.sessionExpired`; `:655` `profile.error.generic`)
- `SOURCE/lib/i18n/translate.ts` (`:4` the `Dictionary` type derived from `en.ts`; `:22-24` a missing key returns the key itself; `:25-28` an unmatched `{name}` renders verbatim)
- `SOURCE/app/(layer2)/queries.ts` (Task B2.1 — `EssaySummary`'s field names, which the parameterised strings are wired to)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| UI Spec (§ Component: EssayScoreLine) | derived-display | Default state sub-line: *"Tính trên {n} câu tự luận đã chấm xong."* where `{n}` = `EssaySummary.gradedCount` — **không phải** tổng số câu tự luận của đề | `result.essay.denominator`'s `{n}` is documented and wired to `gradedCount`, not to the exam's essay count |
| frontend DD (§ EssayRegradeControl — REFUSAL_KEY) | column/label set and order | `not_found` → `profile.error.sessionExpired` (reused); `not_failed` → `result.essay.retryAlreadyGraded`; `exhausted` → `result.essay.retryExhausted`; `budget` → `result.essay.retryBudgetOut`; `server` → `profile.error.generic` (reused). Declared as `Record<RetryRefusal, MessageKey>`, **not** a `switch` with `default` | The three new refusal keys exist in both dictionaries and the two reused keys are **not** duplicated |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Copy Inventory) — the 29-string inventory this task lands.

## Investigation Notes

### The Red phase produced a real failure, and it named the mechanism exactly
The task asks for a scratch run adding the keys to `vi.ts` **first**, to confirm the `Dictionary` derivation direction. Done, and `tsc` exited **2**:

```
lib/i18n/dictionaries/vi.ts(140,3): error TS2353: Object literal may only specify
known properties, and '"player.essayScored"' does not exist in type 'Dictionary'.
```

That is AB-12 stated by the compiler: `MessageKey = keyof typeof en` and `Dictionary = Record<MessageKey, string>`, so `en.ts` is the source of the key set and a key living only in `vi.ts` is an **excess property**, not a missing translation. The scratch was reverted (`git checkout -- vi.ts`) before the real edit.

Worth noting which direction each failure mode takes: a key in `en.ts` but missing from `vi.ts` fails as a **missing property** (the Vietnamese dictionary no longer satisfies `Dictionary`); a key only in `vi.ts` fails as an **excess property**. Both are compile errors, which is the whole point — neither can reach a user as a raw key name.

### Inventory: 28 new + 1 kept = 29, and the count is a decision
27 `result.essay.*` keys plus `player.essayScored` = **28 new**, verified by `grep -c` in both dictionaries. `player.essayNotScored` is the 29th and is **not new**.

The inventory is 29 rather than 31 because two refusal reasons **reuse** existing keys rather than duplicating them, per the convention written at `en.ts:5-6`:
- `not_found` → `profile.error.sessionExpired`
- `server` → `profile.error.generic`

Confirmed by `grep -c`: each appears **exactly once** in each dictionary — reused, not duplicated.

### English wording follows the repo's existing vocabulary, not a fresh one
The Vietnamese is verbatim from the UI Spec's Copy Inventory. For English there was a real choice — "marking" reads more naturally for essay work, but the repo has already settled on the **"auto-scored"** family (`player.tfNotScored`, `player.shortAnswerScored`, `result.notAutoScored`, `upload.storedNotScored`). Mixing "marked" into essay strings would give one product two vocabularies for one idea, so the new strings say *scored* throughout: `Scoring` / `Scored` / `Scoring failed`, `Score again`.

`player.essayScored` is deliberately the exact parallel of the sibling that already exists:
- `player.shortAnswerScored`: "Short answer — auto-scored after you submit."
- `player.essayScored`: "Essay — auto-scored after you submit."

### Three strings deliberately absent, carried into the dictionary as a comment
The UI Spec names three strings that must **not** exist, and the reason each is absent is now recorded at the insertion point in both files, not only in the spec:
1. No string states the **remaining** retry count (UI-D9) — that number drops for reasons the student did not cause, so showing it is a false promise.
2. No separate string for "stuck pending" (UI-D6) — it reuses `failedBody`.
3. No string explains **why** a band is what it is — a second model-written output is a second injection surface (R9).

### Parameter wiring recorded where it can be checked later
Six parameterised strings. The one worth naming is `result.essay.denominator`: `{n}` is `EssaySummary.gradedCount` — the number of essays **already scored** — **not** the exam's total essay count. Wiring it to the total would make the sentence claim the score was computed over more essays than were actually scored (AC-059). The consumers land in F-A3 and F-C2; `createTranslate()` renders an unmatched `{name}` **verbatim on screen**, so a wiring mistake shows up rather than failing silently — that is the mechanism, and no second one was added.

### Scope boundaries verified by diff, not by intent
- `player.essayNotScored` — **byte-identical**; `git diff` produces no line touching it. It is selected against `player.essayScored` by the AC-067 flag in Task F-D1, and it stays **true** while the feature ships disabled (UI-D8).
- `upload.essayStored` (`vi.ts`, `en.ts`) — untouched; OQ-5, Phase E Task E4.
- `profile.error.sessionExpired`, `profile.error.generic` — reused, single occurrence each.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, including the UI Spec Copy Inventory (29 rows) and the `EssaySummary` field names
- [x] Scratch run done: `vi.ts` first ⇒ `tsc` exit **2**, `TS2353 ... '"player.essayScored"' does not exist in type 'Dictionary'`. Reverted with `git checkout -- vi.ts` before the real edit

### 2. Green Phase
- [x] 28 keys added to `en.ts` first
- [x] The same 28 added to `vi.ts`
- [x] `npx tsc --noEmit` exit **0** — coverage proven across both dictionaries

### 3. Refactor Phase
- [x] `player.essayNotScored` byte-identical — no diff line mentions it
- [x] `profile.error.sessionExpired` and `profile.error.generic` appear **exactly once** in each dictionary — reused, not duplicated
- [x] `upload.essayStored` untouched in both dictionaries

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: **i18n key coverage across both dictionaries (AB-12) — this is the coverage gate for this task** — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | **The coverage gate.** It was **2** during the Red phase, with the exact message that proves AB-12 — see Investigation Notes |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1950 passed / 10 skipped / 0 todo — unchanged; no consumer exists yet, so no test result should move, and none did |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline ONLY**: 2 failures, both `subscription.fixture.e2e.test.ts > FE-1 (e) ... > locale en` and `locale vi`. CRLF churn on `RichText.regression.test.tsx.snap` reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — **Task H8**, still open) |

`npm run verify:schema` not run — no schema and no `LIMITS` constant touched.

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: `npx tsc --noEmit` after both dictionaries are edited — the `Dictionary` type derived from `en.ts` makes any missing `vi.ts` key a compile error.
- **Success criteria**: 28 keys present in **both** dictionaries; `player.essayNotScored` untouched; `tsc` green.
- **Failure response**: if `vi.ts` fails to compile because a key is missing from `en.ts`, the order was reversed — `en.ts` is the source of the type (AB-12).
- **Verification level**: **L2/L3** — no consumer exists yet; Integration Complete is N/A until F-A2/F-A3.

## Proof Obligations
- **Claim (AC-044 / AC-047)**: every string is an **application-owned i18n constant**; **no** string is model-generated.
  - **Primary failure mode**: a band's explanation or a failure sentence rendered from the model's prose, so provider output reaches the screen. **Boundary**: the dictionaries themselves — a review that every new key's value is a literal. **State assertion**: N/A. **Mock rationale**: none. **Residual**: that no surface renders model text is enforced structurally by `EssayView` carrying no prose field (Task H1) and by the display tasks.
- **Claim (AB-12 key coverage)**: `tsc` proves full key coverage across both dictionaries.
  - **Primary failure mode**: a key added to `en.ts` and forgotten in `vi.ts`, so a Vietnamese user sees the key name. **Boundary**: `npx tsc --noEmit`. **State assertion**: N/A. **Mock rationale**: none. **Residual**: `t()` returns the key itself when a key is missing at runtime (`translate.ts:22-24`), so a gap is visible rather than blank.
- **Claim (the six parameterised strings)**: each `{parameter}` is wired to the named source; in particular `result.essay.denominator`'s `{n}` is `gradedCount`, **not** the exam's total essay count.
  - **Primary failure mode**: the denominator naming the wrong quantity, so the sentence claims the score is computed over more essays than were graded. **Boundary**: the consuming components (F-A3, F-C2). **State assertion**: N/A. **Mock rationale**: none. **Residual**: an unmatched `{name}` renders **verbatim on screen** (`translate.ts:25-28`), which makes a wiring mistake visible rather than silent — that is the mechanism, and no extra one is added.

## Completion Criteria
- [x] **Implementation Complete** = 28 keys in both dictionaries (27 `result.essay.*` + `player.essayScored`, counted by `grep -c`); `player.essayNotScored` untouched
- [x] **Quality Complete** = `npx tsc --noEmit` exit **0**
- [x] **Integration Complete** = N/A until consumers exist (F-A2, F-A3)
- [x] Every Reference Contract Compliance Check = `Y`: `denominator`'s `{n}` is documented as `gradedCount` not the exam essay total; the three new refusal keys exist in both dictionaries and the two reused keys are not duplicated
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: every frontend surface in Phases F-A…F-D reads these keys.
- Scope boundary — preserve unchanged: `player.essayNotScored` (`vi.ts:139` — **kept verbatim**, it is selected against `player.essayScored` by the flag in Task F-D1); `upload.essayStored` (`vi.ts:271`, `en.ts:334` — **OQ-5**, Phase E Task E4); `profile.error.sessionExpired` and `profile.error.generic` (**reused**, not duplicated).
- The inventory is exactly **29** because two refusal reasons reuse existing keys — a decision, not an omission.
