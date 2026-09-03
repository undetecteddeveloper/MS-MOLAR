# Task B2.2 — `listMyHistory()`: two required booleans (Gate D CLOSED — unblocked)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B2 (Read Path, vertical slice V2), Task B2.2**
Layer: **backend** (`SOURCE/app/(history)/**`)

Metadata:
- Dependencies: **Task G0.3 (Gate D — CLOSED 2026-08-29)**, **Task B2.1**.
- Blocks: **Tasks B2.3, B2.4**.
- Provides: `hasUnresolvedEssay` and `hasIncompleteEssay` on `MyHistoryEntry` — **two** required booleans.
- Size: Small (1 file)
- Verification level: **L2**; proven by INT-2 in Task B2.4.

## ⛔ ENTRY GATE — BLOCKED ON GATE D, WHICH IS **NOT YET DONE**

**Task G0.3 / Gate D must be closed before this task starts. Status as of 2026-08-29: CLOSED — this task is unblocked.**

Gate D required the payload measured **without** the two fields (D1) and **with** them (D2), plus the engineer's recorded accept/escalate decision (D3). All three are recorded. The measured result, so this task does not have to go looking for it:

- **without** `per_question, created_at`: **375 B/row** (prod-shaped exams) → ~183 KB at the 500-row ceiling
- **with** them: **3 401 B/row** → ~1 661 KB at the ceiling — **≈9.1×**, largest single row measured 5 385 B
- **D3 = ACCEPT.** 500 is a ceiling three orders of magnitude above today's data (prod holds 9 result rows in total); reaching it is the documented trigger for **pagination**, not a bigger number. **D4 not applicable** — ADR-0018 **Escalation 2 stays closed** and hand-applied schema changes stay at **two**.

**What that means for this task: implement the select as designed — add `per_question, created_at`.** Do **not** reach for the RPC alternative; it was considered and rejected, and choosing it would be DDL that reopens a closed escalation.

The escalation path (an RPC returning both booleans pre-derived) is **DDL**. It is a **scope escalation requiring an engineer decision**, not a technical fallback an implementer may pick.

## Change Category
`Change Category: boundary-change`

`MyHistoryEntry` and `EmbeddedRow` are published read contracts consumed by `/history` and by the PDF pipeline. Adjacent cases swept: the sibling read path `getResult()` (Task B2.1) — **both** paths must gain `created_at`, and a column added to one and not the other is INT-2's primary failure mode — and both PDF construction sites (Task B2.3).

## Implementation Content

In `SOURCE/features/history/queries.ts`:

- Add `per_question, created_at` to the embedded select (`:64-66`). The function needs **both**, and today it fetches **neither**.
- Add both fields to `EmbeddedRow` (`:23-34`).
- Add **two** required booleans to `MyHistoryEntry` (`:8-18`):
  - `hasUnresolvedEssay` — still-running ⇒ **PDF export block** (AC-058);
  - `hasIncompleteEssay` — at least one question at RS-6 ⇒ **the PDF annotation condition** (O-8).
- Derive both through the shared predicates in `essayLifecycle.ts` — **never re-derive locally**.
- Raw `per_question` data does **not** cross the component boundary (UI-D11).

### Two, not one
The v1.0 contract said one; **D-13 overturned it** because RS-6 cannot be derived from a "still unresolved" boolean. With one field, the two PDF exits produce **two different files for one attempt** — the defect O-8 exists to prevent, and the one this feature's own review history already caught once (**F-06**). Both are **required** and always computable (`false` when no key is present), so no consumer has an `undefined` case to handle.

## Target Files
- [x] `SOURCE/features/history/queries.ts`
- [x] `SOURCE/features/history/__tests__/history.int.test.ts` — the tests the Implementation Steps call for, added to the existing file at the sanctioned `createClient()` boundary. **One pre-existing case also changed**: obligation (d)'s exhaustive `toEqual` on the whole entry now carries the two new booleans. That case failing was the boundary-change guard working, not a nuisance — it is precisely what an exhaustive comparison is for.
- [x] `SOURCE/lib/history/filterEntries.test.ts` — **found by `tsc`**, exactly as this task's Quality Assurance section predicted ("both booleans are required, so no consumer has an `undefined` case"). Its `entry()` helper builds a literal `MyHistoryEntry`; both booleans are `false` there, which is correct — none of that file's fixtures has an essay.

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate D — the recorded payload measurement and decision this task's select shape must match)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope / D-03 / D-13 — `listMyHistory()` adds `per_question, created_at`; **two** required booleans)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Open Item O-3 — the payload measurement as a hard entry gate; § Open Item O-8 — the PDF annotation condition)
- `SOURCE/features/history/queries.ts` (`:8-18` `MyHistoryEntry`; `:23-34` `EmbeddedRow`; `:64-66` the embedded select; the `submittedAt` descending ordering)
- `SOURCE/lib/supabase/boundedRead.ts` (`:74` `LIST_ROW_CEILING = 500` — unchanged by this task)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `hasUnresolvedEssay`, `hasIncompleteEssay`, `summariseEssays`; **the shared predicates, never re-derived here**)
- `SOURCE/features/exams/queries.ts` (Task B2.1 — the sibling read path; both must carry `created_at`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-034) | derived-display | "`hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`" | The equality holds over the same fixtures, asserted in one case |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `computeScore()` → `exam_results.per_question` |
|---|---|
| Owner (right) | `public.exam_results.per_question` (jsonb), read by `getResult()` / **`listMyHistory()`** / `record_essay_grade()` |
| Consumer parse rule | Readers branch on the **presence** of the `essayState` key (absent ⇒ RS-0), then on its value |
| Expected signal | Both booleans are real booleans, **never `undefined`**, including for an attempt with no essays and for a legacy row (EG-BE-035) |

Roundtrip check this task owns: the same attempt yields the **same** `hasIncompleteEssay` here and in `getResult()` — asserted by INT-2(a) in Task B2.4.

## Investigation Notes

**The Gate D decision this select shape implements** — `per_question, created_at` added to the top-level `exam_results` projection (both are columns of `exam_results`, not of the embed). Gate D priced exactly this shape: **375 B/row without**, **3 401 B/row with** (≈**9.1×**, largest single row 5 385 B), ~183 KB → ~1 661 KB at the 500-row ceiling, **D3 = ACCEPT**, with the ceiling recorded as the trigger for **pagination** rather than for a bigger number. The RPC alternative was **not** reached for: it is DDL, and picking it here would reopen a closed escalation.

**The hand-built `MyHistoryEntry[]` literal used in the Output Comparison** — two legacy rows, all nine pre-existing fields plus the two new booleans as `false`, newest first. The mock is fed the rows **out of order** on purpose, so the ordering assertion cannot be satisfied by the fixture's own arrangement. Backed by an exhaustive `Object.keys(...).sort()` on the first entry, which is the only assertion that catches `per_question` being passed through by a spread someone adds later for convenience (UI-D11) — mutation P6 confirms it fires.

**`readBounded` / `LIST_ROW_CEILING` and the ordering are unchanged** — asserted, not assumed: `LIST_ROW_CEILING` is imported into the test and pinned at **500**, and the recorded `.limit()` argument is **501** (`ceiling + 1`, which is how `readBounded` DETECTS an overflow instead of silently truncating). The `submittedAt`-descending sort is pinned by the ordering case; mutation P5 confirms it fires.

### The same derive-once defect as the sibling read path, avoided here rather than found here

`hasUnresolvedEssay()` and `hasIncompleteEssay()` each fold the array internally, so the naive call site runs `deriveEssayView()` **twice** per element — and for an unrecognised `essayState`, EG-BE-025's "exactly one `console.warn`" becomes two, **per history row, on every render**. Task B2.1 hit this on `getResult()` and it was found by a failing test; here the same shape was applied from the start and pinned by its own case. Mutation P4 confirms the case is load-bearing rather than decorative.

**One drift risk created and recorded rather than hidden**: the derive-once-then-filter idiom now exists in **two** places — `features/exams/queries.ts` and `features/history/queries.ts` — because `essayLifecycle.ts` is Task H1's file and this task's scope boundary says to leave it unchanged. The two paths agreeing is exactly what **INT-2** (Task B2.4) exists to assert, so the risk is covered rather than merely noted; folding the idiom into `essayLifecycle` is a candidate for a later cleanup, not for this commit.

### Mutation testing: 7 mutations, 7 caught

| # | Mutation | Caught by |
|---|---|---|
| P1 | `created_at` dropped from the select | the select-shape case |
| P2 | `per_question` dropped from the select | select shape, plus EG-BE-034's positive control and EG-BE-035 |
| P3 | the two booleans collapsed into one (D-13 reverted) | EG-BE-035, the RS-6 row |
| P4 | the derive-once shape reverted | the warn-once case |
| P5 | the `submittedAt`-descending sort removed | AC-012 pipeline 3, plus a pre-existing Test 1 obligation |
| P6 | the raw row spread into the entry (`per_question` leaks past UI-D11) | the exhaustive key-set assertion, plus a pre-existing Test 1 obligation |
| P7 | `hasUnresolvedEssay` hardcoded `false` | EG-BE-034's positive control |

P1 deserves its own note: dropping `created_at` leaves both booleans still computable — they simply compute against `undefined`, and an overdue pending question is then classified as still-pending here while `/result` calls it RS-6. That is INT-2's primary failure mode, and it is invisible to any assertion made on mapped output alone, which is why the case asserts on the **select string**.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] **Confirm Gate D is closed** and read its recorded decision — closed 2026-08-29, D3 = ACCEPT, figures reproduced in the Investigation Notes above
- [x] Read all Investigation Targets and record key observations
- [x] **Sweep the adjacent cases** (Change Category: boundary-change): `getResult()`'s select **does** now carry `created_at` — landed in Task B2.1 (`5ab7a4b`), one commit before this one, so the two read paths never sat in an inconsistent state on this branch. Both PDF construction sites are Task B2.3 and remain untouched.
- [x] Write the tests: EG-BE-034's equality, EG-BE-035's real-boolean cases, the ordering non-regression, and the legacy-row Output Comparison; observe failure — one **pre-existing** case did fail (obligation (d)'s exhaustive comparison), which is the boundary-change guard doing its job. The new cases were green on first run, so they are backed by mutation testing instead.

### 2. Green Phase
- [x] Add `per_question, created_at` to the embedded select and to `EmbeddedRow` — `per_question` typed `PerQuestionResult[] | null`, because the column is nullable and a `null` there must mean "no essays", not a crash
- [x] Add both required booleans to `MyHistoryEntry`, derived through the shared predicates
- [x] Run only the added tests and confirm they pass — **12 passed** in that file (7 pre-existing + 5 new)

### 3. Refactor Phase
- [x] Confirm raw `per_question` does **not** cross the component boundary (UI-D11) — by an exhaustive key set on the returned entry, not by inspection; P6 confirms it fires
- [x] Confirm `readBounded` / `LIST_ROW_CEILING = 500` and the `submittedAt` descending ordering are unchanged — both asserted in the test, and `LIST_ROW_CEILING` is imported rather than retyped
- [x] Confirm nothing re-derives `state === "failed" && !retryAvailable` locally (EG-BE-036) — the file calls `hasIncompleteEssay()` and `hasUnresolvedEssay()` and states neither predicate itself; P3 confirms the two calls are not interchangeable

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: both booleans are required, so no consumer has an `undefined` case — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | first run was **2**, and that was the gate working: it named `lib/history/filterEntries.test.ts` as the one consumer building a literal `MyHistoryEntry` without the new required fields |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1863 passed / 10 skipped / 2 todo (**+5** from this task) |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` FE-1 (e) — `locale en` and `locale vi` |
| 6 | `npm run test:localdb` | **0** | on the second attempt. The first exited 1 with `Unknown Error: TypeError: fetch failed` in `subscription.service.e2e.test.ts` — the same network signature seen throughout this session, in a file that imports none of the modules this task touches. The retry passed 11/11 with **zero** timeouts |

**Known-red window:** `npm run verify:schema` (dev) exits **1** with exactly **one** failing assertion, the character ceiling (`LIMITS.MAX_ATTEMPT_ANSWER = 500` against a DB ceiling of 4000). Red by design from H7 until B3.3.

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method** — **Output Comparison, pipeline 3**: for legacy embedded rows, assert the whole `MyHistoryEntry[]` equals a **hand-built literal** carrying all nine pre-existing fields plus the two new booleans as `false`, **in unchanged order** (`toEqual`, no snapshots).
- **Success criteria**: both booleans are real booleans in every case, including an attempt with no essays and a legacy row; the ordering by `submittedAt` descending is unchanged; `LIST_ROW_CEILING = 500` is unchanged; EG-BE-034's equality holds.
- **Failure response**: if either boolean can be `undefined`, a consumer will have to handle a case that should not exist — make it required and always computable rather than adding a guard downstream. If the select shape does not match Gate D's recorded decision, return to the gate rather than deciding here.
- **Verification level**: **L2**; **Integration Complete** is proven by INT-2 in Task B2.4.

## Proof Obligations
- **Claim (EG-BE-034)**: `hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`.
  - **Primary failure mode**: a locally re-derived predicate that disagrees with the shared one on the empty case. **Boundary**: in-process with the Supabase client mocked at its sanctioned boundary. **State assertion**: N/A (read-time derivation). **Mock rationale**: `createClient()` is the external boundary. **Residual**: the cross-path agreement is INT-2's.
- **Claim (EG-BE-035)**: both booleans are **real booleans, never `undefined`** — including for an attempt with no essays and for a legacy row.
  - **Primary failure mode**: an `undefined` reaching the PDF pipeline, where the annotation's content then cannot be decided. **Boundary**: in-process, asserting `typeof === "boolean"`. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (D-13 / O-8 / F-06)**: **two** fields, not one — RS-6 cannot be derived from a "still unresolved" boolean.
  - **Primary failure mode** (Failure Mode Checklist: **shared-state dependency**): collapsing them, so the two PDF exits produce **two different files for one attempt**. **Boundary**: in-process; the cross-path proof is INT-2(a)–(b). **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the two-door agreement is proven by INT-2 and FE2E-3.
- **Claim (Failure Mode Checklist: missing-sort-key ordering)**: ordering by `submittedAt` descending is **unchanged**.
  - **Primary failure mode**: the widened select or the added derivation perturbing row order, so `/history` silently reorders. **Boundary**: in-process over the returned array. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (AC-012, pipeline 3)**: for legacy embedded rows the whole `MyHistoryEntry[]` equals a hand-built literal of the pre-change shape plus the two booleans as `false`, in unchanged order.
  - **Primary failure mode**: an old attempt growing a populated field on the read path. **Boundary**: in-process against a hand-built literal. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.

## Completion Criteria
- [x] **Entry gate**: Gate D closed, and this select shape matches its recorded decision
- [x] **Implementation Complete** = select, two types, two derived fields
- [x] **Quality Complete** = six verify gates green (gate 5 red at the TD-030 baseline, by definition)
- [ ] **Integration Complete** = proven by **INT-2** in Task B2.4 — **open by design**, and it is the next task
- [x] Output Comparison pipeline 3 green against a hand-built literal (**no snapshots**)
- [x] Every Reference Contract Compliance Check evaluates to `Y` — EG-BE-034's equality is asserted over five fixtures with a positive control, and mutation P7 confirms the control fires
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: B2.3 (the PDF data contract reads `MyHistoryEntry.hasIncompleteEssay`), F-B3 (`HistoryRow` reads both booleans), F-C3 (FE2E-3 renders the real `/history` row).
- Scope boundary — preserve unchanged: `SOURCE/lib/supabase/boundedRead.ts` (`LIST_ROW_CEILING = 500`); the `submittedAt` descending ordering; the nine pre-existing `MyHistoryEntry` fields; `SOURCE/features/exams/queries.ts` (Task B2.1).
- Raw `per_question` stays server-side — it does **not** cross the component boundary (UI-D11).
