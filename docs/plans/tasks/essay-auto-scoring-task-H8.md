# Task H8 — Convert SVC-1 and SVC-2 from `it.todo` to executing tests (real Postgres)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H8**
Layer: **backend** (`SOURCE/tests/e2e/service/**` — the lane hits real Postgres)

Metadata:
- Dependencies: **Task H7**.
- Blocks: nothing directly, but it is the only proof of three properties a mocked client cannot establish.
- Provides: service lane resolution **2/2** — SVC-1 and SVC-2 executing; unresolved `it.todo` in that file: **0**.
- Size: Small (1 file, many cases)
- Verification level: **L1/L2** — real Postgres via `npm run test:localdb`.

## Blocking preconditions (from the skeleton itself)

- The two functions and their grant block exist in `schema.sql` (Task H5).
- The DDL is applied to **dev** and `verify:schema` is green there **for every assertion except the character-ceiling gate** — that one is inside H7's known-red window and is **unrelated** to these two functions.
- Phase 3.5 has been observed for **prod**.

Running this file against a database that has not received the DDL produces `PGRST202` failures that **look exactly like implementation defects and are not**. **If this file is red and the dev database is not green: fix the database, do not fix the test.**

## Implementation Content

Convert `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts`. **Nothing is mocked** — that is the lane's entire reason for existing.

Fixture hygiene follows `SOURCE/supabase/test-rls.ts` Part 7 (`:133-153`) and `recordSkillMastery.int.test.ts`: an isolated id prefix (`"eg-svc-"`) per case, idempotent setup and teardown, each case creating and deleting its own user + exam + attempt + `exam_results` row.

**Order independence must be measured, not assumed** — run the file under `--sequence.shuffle.tests` with several seeds, and run each case alone with `-t`, before claiming it. The shipped claim in `subscription.service.e2e.test.ts` was once written from assumption and was wrong in the most dangerous direction: it read as a guarantee.

### I-1 closed 2026-08-29
Fill the skeleton in `SOURCE/tests/e2e/service/`. Do **not** add a second copy to `test-rls.ts` Part 10 — two homes drift and the duplicate becomes the one nobody runs. The shipped `S-b` case at `test-rls.ts:1314-1320` stays exactly where it is.

### Honest seam — do not let a case name claim otherwise
SVC-2 proves the claim **refuses**; it does **not** prove "with zero provider calls", because no provider is reachable from SQL. That half of AC-064 belongs to the orchestrator (**Task B1.4**).

## Target Files
- [x] `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts` — SVC-1 and SVC-2 converted (5 executing cases)
- [x] `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` — **new**: the lane's own fixture helper, following `test-rls.ts` Part 7. Kept out of the test file for the same reason `subscriptionServiceFixtures.ts` is separate

## Investigation Targets
- `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts` (the committed skeleton — its `Primary failure mode` / `Proof obligation` annotations for SVC-1 and SVC-2, and its stated blocking preconditions)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Integration Verification Points — cases `EG-a…EG-e`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ State Transitions and Invariants — EG-BE-007; `graded` is absorbing, `failed` is not)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Error Handling — a refused duplicate is a **return value**, not an exception)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decisions 1, 1b, 3, 4)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010)
- `SOURCE/supabase/schema.sql` (the two function bodies as authored in H5 — the source text SVC-1(g) and SVC-2(d) scan)
- `SOURCE/lib/scoring/essayLifecycle.ts` (`ESSAY_MAX_ATTEMPTS` — **imported**, never typed as a literal `3`)
- `SOURCE/supabase/test-rls.ts` (Part 7 at `:133-153` — the fixture-hygiene pattern; `:1314-1320` — the `S-b` case that stays where it is)
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (the repo's existing real-database test — setup/teardown precedent)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (the order-independence claim that was written from assumption and was wrong — the reason this task **measures** it)
- `SOURCE/vitest.localdb.config.ts` (the lane's config and glob)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | placement | The band is written in place into `exam_results.per_question` by **two** `service_role`-only `INVOKER` SQL functions — never by a TypeScript `.update()` call site, and never into a separate `essay_grades` table | The cases drive the two functions directly as `service_role` and assert the band landed in `per_question`, with no `essay_grades` table involved |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | Neither function takes a `user_id` parameter; ownership is derived from the attempt inside SQL, and `status = 'submitted'` is required. Neither body may name `total_score`, `correct`, `total`, `topic_breakdown` or `overtime_seconds` | SVC-1(g)'s source-text scan finds neither the parameter nor the five column names |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The element rewrite preserves array order explicitly: `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality` | SVC-1(a) asserts the **full** `questionId` sequence is unchanged after grading the middle of three |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | First-write-wins is a `WHERE … <> 'graded'` predicate inside the settle statement — zero rows affected is a **distinct return value, not an exception** — never a read-then-write in TypeScript. `failed` is not protected by the predicate; `graded` is absorbing | SVC-1(d) asserts a `false` return and **no raise**; SVC-1(e) asserts `failed → graded` succeeds |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time, before the provider is contacted, and is never decremented | SVC-2(a)(b) assert the stored count after each claim; SVC-2(d)'s scan finds no decrement anywhere |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert; the append-only property that remains is that no client can write by any path and no writer other than `service_role` exists | SVC-2(g) asserts a real student JWT gets `42501` on **both** functions |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ Hợp đồng khoá jsonb) | column/label set and order | `essayState` (`"pending" \| "graded" \| "failed"`, insert value `"pending"`), `essayEarned` (`number \| null`, insert `null`), `essayMax` (`number \| null`, insert `null`), `essayLowConfidence` (`boolean`, insert `false`), `essayAttempts` (`number` int, insert `0`), plus the sixth key `essayGradedAt` (`string` ISO 8601, **absent** at insert) | The fixture rows carry exactly this shape, and after a settle the target element differs only in the five stated keys |
| backend DD (§ EG-BE-005) | missing-sort-key ordering | "**Khi** `record_essay_grade()` chạy trên một lượt thi có ba câu tự luận và ghi band cho câu **thứ hai**, hệ thống **phải** để lại mảng `per_question` có **dãy `questionId` không đổi** so với trước lượt ghi." | SVC-1(a) compares the full sequence against a literal captured before the write |
| backend DD (§ EG-BE-010) | state-lifecycle-negative | "**Khi** `claim_essay_grading_attempt()` thành công, `essayAttempts` của phần tử **phải** tăng đúng 1, và **phải không bao giờ** bị giảm bởi bất kỳ câu lệnh nào trong repo." | SVC-2(a) reads the stored count back after each claim; SVC-2(d) scans for any decrement |
| ADR-0018 (§ Amendment to ADR-0010) | state-lifecycle-negative | "The append-only property that remains, and that this ADR does not weaken: **no client can write to `exam_results` by any path, and no writer other than `service_role` exists.**" | SVC-2(g) gets `42501` on both functions with a real student JWT, with `PGRST202` explicitly distinguished |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `record_essay_grade()` → `exam_results.per_question` (in-place element rewrite) | **Serialized format**: rebuilt array via `jsonb_agg(… order by ord)`; the target element gains `essayGradedAt` and updated `essayState`/`essayEarned`/`essayMax`/`essayLowConfidence`. **Consumer parse rule**: consumers re-read the array by index order; array order **is** the exam's question order. **Expected signal**: SVC-1(a) — the full `questionId` sequence unchanged after grading the middle of three; SVC-1(b) — every other element byte-identical. |
| `service-role.ts` operations → SQL function parameters | **Serialized format**: `.rpc()` argument object keyed by the SQL parameter names (`p_*`), positional order fixed by ADR-0018 Decision 1. **Consumer parse rule**: Postgres binds by name; a mismatched key is a runtime `PGRST202`-family failure, **not** a type error. **Expected signal**: SVC-1 and SVC-2 drive the functions directly as `service_role` and read the row back by real query; a student JWT gets `42501` on both, **discriminated from `PGRST202`** (schema never applied). |
| `ESSAY_MAX_ATTEMPTS` (TypeScript) → the cap literal inside `claim_essay_grading_attempt()` | **Expected signal**: SVC-2(c) uses the **imported constant**, never a typed `3`, so this does not become a third copy. |

## Investigation Notes

### Service lane resolution: 2/2, unresolved `it.todo`: 0
`essay-grade-write.service.e2e.test.ts` went from 2 `it.todo` to **5 executing cases**; the lane reports **16 passed, 0 todo** (was 11 passed / 2 todo).

### Order independence was measured, because the precedent for assuming it was wrong
The task file records that `subscription.service.e2e.test.ts` once *claimed* order independence from assumption and was wrong "in the most dangerous direction: it read as a guarantee". So this was measured two ways:
- `--sequence.shuffle.tests` at seeds **11, 29, 77** — 16 passed each time.
- Each of the five new cases run **alone** with `-t` — one passed, fifteen skipped, every time.

Each `describe` owns an isolated slot (`eg-svc-svc1`, `eg-svc-svc2`) so the two never share a row.

### The database was reachable and correct; my fixture was not
The first run failed with `Could not find the 'created_by' column of 'exams'` — **not** `PGRST202`. That distinction is the one the skeleton warns about: `PGRST202` would have meant the DDL was missing and the instruction is "fix the database, do not fix the test". This was the opposite — the functions were there and my fixture had guessed three columns wrong:

- `exams` has no `created_by` and no `status`.
- `questions.correct_answer` is **NOT NULL** with `CHECK in ('A'..'D')` — an essay question does not use it, but the schema still demands a valid value. Recorded in the fixture so nobody reads `"A"` as a meaningful answer.
- `exam_attempts.id` is **`uuid`**, not `text`, so a prefixed string id is rejected at the type layer. The id is now generated by the database and read back.

Teardown deletes the **user first**: `exam_attempts.user_id` and `exam_results.user_id` are both `on delete cascade`, so one delete takes both.

### What these five cases prove that no mocked client can
1. **jsonb array order.** Grading the *second* of three essays leaves `questionId` order identical and the other two elements **byte-identical** (`toEqual` against the pre-read rows). If the `order by ord` were dropped from the `jsonb_agg`, Postgres would be free to return another order and the student's questions would swap places on screen.
2. **The `<> 'graded'` predicate matching zero rows.** The duplicate settle returns `written: false` as a **value, not an exception** (ADR-0018 Decision 3), and the **first** band survives — asserted by reading `essayEarned` back and finding `0.75`, not the `0.25` the second call tried to write.
3. **The real grants.** A **real student JWT** gets `42501` on **both** functions, and no row changes as a result. A `revoke` that only removed `public` would leave both callable by students, and no mocked test could see it.

Two cases beyond the skeleton's two headline claims were added because they are cheap here and impossible elsewhere: `failed` is **not** absorbing (a `failed` question can still settle to `graded` — this is what makes the retry button meaningful, EG-BE-007), and `already_graded` is distinguished from `no_element`.

### Honest seam, kept honest
SVC-2 proves the claim **refuses** at the cap. It does **not** prove "with zero provider calls" — no provider is reachable from SQL. That half of AC-064 belongs to the orchestrator (Task B1.4), and the case name does not claim it.

`ESSAY_MAX_ATTEMPTS` is **imported**, never typed as a literal `3`: the cap is a contract between SQL and TypeScript that `verify:schema` already pins, and retyping the number here would create a third declaration.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, especially the skeleton's own annotations and blocking preconditions
- [ ] Confirm the dev database is green on every `verify:schema` assertion **except** the character ceiling (H7's known-red window) — if it is not, **fix the database, not the test**
- [ ] Convert the `it.todo`s to executing cases with all obligations asserted; observe each fail before its behaviour exists or its fixture is seeded

### 2. Green Phase
- [ ] Implement fixture setup/teardown with the `"eg-svc-"` id prefix, idempotent, per case
- [ ] Bring SVC-1 (a)–(g) and SVC-2 (a)–(h) green against dev via `npm run test:localdb`

### 3. Refactor Phase
- [ ] **Measure** order independence: run under `--sequence.shuffle.tests` with several seeds, and run each case alone with `-t`; record the results
- [ ] Confirm `test-rls.ts` was not modified and no case was duplicated into it
- [ ] Confirm SVC-2(c) imports `ESSAY_MAX_ATTEMPTS` rather than typing `3`

## Quality Assurance Mechanisms
- `npm run test:localdb` — Enforces: service-integration-e2e lane against real Supabase dev Postgres; a student JWT can call neither new function and cannot `UPDATE exam_results` — Config: `SOURCE/vitest.localdb.config.ts`; covers `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts`, cases `EG-a…EG-e`
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 2025 passed / 10 skipped / 0 todo — unchanged; this lane is not in the default config |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | TD-030 baseline only |
| 6 | `npm run test:localdb` | **0** | **16 passed, 0 todo** (was 11 passed / 2 todo). **Service lane resolution 2/2** |
| 6b | `test:localdb --sequence.shuffle.tests` seeds 11 / 29 / 77 | **0, 0, 0** | Order independence **measured**, not assumed |
| 6c | `test:localdb -t "<each case>"` ×5 | **0** each | Every new case also passes **alone** |

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3, so `npm run verify:schema`'s character-ceiling assertion is red **by design**. It is not run as a row here (this task's files do not match Gate E3's globs), but if it is run, record the expected red rather than resolving it.

## Operation Verification Methods
- **Verification method**: `npm run test:localdb` against the real Supabase dev database, with the DDL applied; then re-run under `--sequence.shuffle.tests` with several seeds and each case alone with `-t`.
- **Success criteria**: SVC-1 and SVC-2 executing with every obligation asserted; the lane green; order independence **measured**, not claimed.
- **Failure response**: a `PGRST202`-family failure means the schema was never applied — return to Task H7; **fix the database, do not fix the test.** A failure that only appears under a shuffled order is a fixture-hygiene defect in this file, not a defect in the functions.
- **Verification level**: **L1/L2** — real Postgres, real grants, real `jsonb_agg` ordering.

## Proof Obligations — SVC-1 (`record_essay_grade`)
- **(a)** The **full** `questionId` sequence, including non-essay elements, equals a literal captured **before** the write, after grading the **second** of three essays.
  - **Primary failure mode** (Failure Mode Checklist: **missing-sort-key ordering**): a missing `order by ord` shuffles `per_question` on the first graded essay — every question pairs with the wrong answer while **every "the band landed" assertion stays green**. **Boundary**: real Postgres. **State assertion**: before → captured sequence; action → settle the middle essay; after → identical sequence. **Mock rationale**: none. **Residual**: proves ordering for this shape; the read surfaces' index assumption is proven separately.
- **(b)** Every other element is deep-equal to its pre-write value, and the target element differs **only** in `essayState`/`essayEarned`/`essayMax`/`essayLowConfidence`/`essayGradedAt` — `essayAttempts` must **not** be touched by a settle.
  - **Primary failure mode**: the settle re-writes the whole array from a re-derived source and quietly resets counters. **Boundary**: real Postgres. **State assertion**: full before/after element-by-element diff. **Mock rationale**: none. **Residual**: none.
- **(c)** `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds` are unchanged on the row — **AC-009 proven against the database**, not against the function's source text.
  - **Primary failure mode**: a broad `update exam_results set …` touching the score triple. **Boundary**: real Postgres. **State assertion**: the five columns before → after. **Mock rationale**: none. **Residual**: none.
- **(d)** A second call with a **different** band returns `false`/zero rows, does **not** raise (wrap so a raise fails with a message saying "raised instead of returning false"), and the stored band equals the **first** write with `essayState` still `graded`.
  - **Primary failure mode** (Failure Mode Checklist: **same-value**): a same-value fixture would pass for an implementation that overwrites — hence the **different** band. **Boundary**: real Postgres. **State assertion**: band after first write → settle with a different band → band unchanged. **Mock rationale**: none. **Residual**: none.
- **(e)** `failed → graded` returns `true` and the band lands, then a further settle returns `false` — distinguishing "the predicate blocks everything" from "the predicate blocks only `graded`".
  - **Primary failure mode**: an over-broad predicate that makes a legitimate retry impossible. **Boundary**: real Postgres. **State assertion**: `failed` → settle → `graded` → settle → unchanged. **Mock rationale**: none. **Residual**: none.
- **(f)** A settle on a non-`submitted` attempt raises `check_violation` — assert the **SQLSTATE**, not the message text.
  - **Primary failure mode**: asserting on message text, which changes with a Postgres upgrade. **Boundary**: real Postgres. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(g)** A source-text scan of the two function bodies in `schema.sql` asserting neither takes `user_id` nor names any of the five forbidden columns.
  - **Primary failure mode**: ownership pushed to the call site. **Boundary**: file scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: proves the text, not the runtime grant — that is SVC-2(g).

## Proof Obligations — SVC-2 (`claim_essay_grading_attempt`)
- **(a)** Three consecutive claims with **no settle between them** return `claimed = true` with counts 1, 2, 3, and the **stored** `essayAttempts` is read back after each and equals the returned count. *(Asserting the return value alone would pass for a function that computes and never persists.)* **Boundary**: real Postgres. **State assertion**: stored count after each claim. **Mock rationale**: none. **Residual**: none.
- **(b)** The fourth returns `claimed = false, reason === 'exhausted'` **exactly** — the three refusal reasons are three different branches and a single generic refusal collapses them — and the stored count is **still 3**. **Primary failure mode**: one generic refusal. **Boundary**: real Postgres. **State assertion**: count 3 → claim → still 3. **Mock rationale**: none. **Residual**: none.
- **(c)** The number of successful claims equals `ESSAY_MAX_ATTEMPTS` **imported** from `lib/scoring/essayLifecycle.ts`, never a literal `3` typed into the file. **Primary failure mode** (Failure Mode Checklist: **shared-state dependency**): the test becomes a **third** copy of the cap and drifts silently. **Boundary**: in-process import + real Postgres. **State assertion**: N/A. **Mock rationale**: none. **Residual**: `verify:schema` carries the pin gate for the SQL↔TS pair.
- **(d)** A scan of `SOURCE/supabase/schema.sql` and `SOURCE/lib/**` asserting **no statement decrements** `essayAttempts`. **Primary failure mode**: a "refund on failure" — the first change a future session will reach for — silently reopening the unbounded-retry hole. **Boundary**: repo scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(e)** A claim on a `graded` element returns `already_graded` and does **not** move the counter. **Boundary**: real Postgres. **State assertion**: counter before → after unchanged. **Mock rationale**: none. **Residual**: none.
- **(f)** A claim on a non-`submitted` attempt returns **one row** with `not_submitted` — a returned row, **not** an empty result set and **not** a raise. **Primary failure mode**: collapsing the deliberate claim/settle asymmetry (EG-BE-008). **Boundary**: real Postgres. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **(g)** A real student JWT gets `42501` on **both** functions, with `PGRST202` explicitly distinguished (schema never applied — a **precondition failure**, not a security finding) and any other code read as a missing or partial `revoke`. **Boundary**: real Postgres with a student JWT. **State assertion**: N/A. **Mock rationale**: none — a mocked client cannot prove a grant. **Residual**: none. *(This discharges EG-BE-013, which Task H6 does **not** carry.)*
- **(h)** Ownership is derived in SQL — with `service_role`, a claim naming another student's attempt still behaves correctly because there is **no `user_id` parameter to pass**. **Boundary**: real Postgres. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = both cases executing with **all** obligations asserted
- [ ] **Quality Complete** = `npm run test:localdb` green against dev, and order independence **measured** (shuffle seeds + `-t` runs recorded)
- [ ] **Integration Complete** = the three properties a mocked client cannot prove — array order, the zero-row predicate, the real grants — are now proven
- [ ] Service lane test resolution: **2/2**; unresolved `it.todo` in that file: **0**
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: this is the only place the two SQL functions' semantics are proven. B1.3b's unit tests prove the argument keys reach them; nothing else proves what they do.
- Scope boundary — preserve unchanged: `SOURCE/supabase/test-rls.ts` (no second copy of `EG-a…EG-e`; the `S-b` case at `:1314-1320` stays and is not duplicated), `SOURCE/supabase/schema.sql` (H5 owns it).
- Honest seam, restated: SVC-2 proves the claim **refuses**; the "with zero provider calls" half of AC-064 belongs to Task B1.4.
