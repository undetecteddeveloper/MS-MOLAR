# Task B1.5 — GREEN: `computeScore()` options + branch split, then `submitExam()` + `maxDuration` — TWO COMMITS WITH AN EXPLICIT BOUNDARY

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.5**
Layer: **backend** (`SOURCE/lib/scoring/**`, `SOURCE/app/(exams)/**`)
*(I-2 closed 2026-08-29; boundary fixed by I004)*

Metadata:
- Dependencies: **Task B1.1** (folded into commit 1), **Task B1.4** (commit 2 registers `gradeEssaysForAttempt`), **Task H7** (the SQL functions must exist on dev for the `L1` run).
- Blocks: **Tasks B1.6, B2.1, B4.1, F-D1**.
- Provides: the emitted lifecycle keys and the registered `after()` pass — the first place the whole system works.
- Size: Medium (4 files across **two** commits)
- Verification level: **L1** — submit an essay attempt on dev, watch a band land, read `per_question` back with SQL.

## Change Category
`Change Category: state-change, boundary-change`

Commit 1 changes what is **persisted** into `exam_results.per_question`; commit 2 changes the submit path's registered work. Adjacent cases swept: every existing `computeScore()` caller (the default must preserve today's behaviour byte-for-byte), and the two other `ESSAY_GRADING_ENABLED` read sites (`retryEssayGrading()` in B3.2, the player segment in F-D1) — all three read **one** variable so they flip together in a single deploy.

## ENTRY CONDITION: Gate A5b ticked

**A1 + A2 + A5** — a Groq account, the key in `SOURCE/.env.local`, and **Zero Data Retention ON** — are the precondition for **ANY** Groq request, **including dev**. **A5b is currently BLOCKED on A2.**

**No task may set `ESSAY_GRADING_ENABLED=true` anywhere until A5b ticks.** After A5b, dev runs use **SEEDED data only — never a real student attempt.** The `L1` completion evidence below sends real text to `api.groq.com`.

## DEPLOYMENT RULE — repeat VERBATIM in BOTH commit messages

> **Neither commit is deployed with `ESSAY_GRADING_ENABLED` on until both have landed.**

The Design Doc's one-commit hazard (step 7 emitting `pending` keys with nothing to grade them) **cannot occur while the flag is off**, and the flag is off in both Vercel scopes until Gate A stage 2 passes.

## The boundary — stated rather than left to judgement, because it decides whether commit 1 typechecks

### Commit 1 (Design Doc step 7) — `SOURCE/lib/scoring/computeScore.ts` and `SOURCE/lib/scoring/__tests__/computeScore.test.ts` ONLY

- Add the optional third parameter `options` defaulting to `{ essayGrading: false }`.
- Split the `if (!isScored(q))` early return in the `.map()` callback at `:99-101` so a gradeable essay emits the five keys via `newEssayEntry()`.
- Extract `hasEssayGroundTruth()` and share it with `isScored()`'s `:40` expression. **`isScored()` keeps its behaviour — essay still returns `false`.**
- Fix the **reason** in the two comment blocks at `:17-18` and `:35`: the truth is no longer "essay is never scored" but "the band is written **outside** `computeScore`, and the row deliberately stays `scored:false`". These are **2 of the eleven D-09 sites**; the rest are Tasks B2.1 (1), B3.3 (1) and B4.1 (7).
- The function stays **pure**: no I/O, no `process.env`, no async (AC-013) — **the flag is passed in, never read inside**.
- **Task B1.1's test file lands in this commit** (I006). Author the cases RED first, observe the failure, **record that observation in this commit's message**, then land tests and implementation together. This commit is what turns the Early Verification Point **green**.
- This commit imports nothing that does not already exist, so it typechecks and its whole test suite passes **on its own**.

### Commit 2 (Design Doc step 9) — `SOURCE/features/exams/actions.ts` and the player route segment

- **`actions.ts`**: `submitExam()` reads `ESSAY_GRADING_ENABLED` (**only a trimmed `"true"` means on**), passes it into `computeScore()` as an option, and registers `after(() => gradeEssaysForAttempt(...))` **before** `redirect()` at `:192`. Registering **after** `redirect()` means, in Next, **never registering at all** — grading would silently never run once the flag was turned on, and nothing in the flag-off state could reveal it. Precedent and the rule in writing: `lib/support/actions.ts:122-127`. The Supabase client already built in `submitExam()` is **captured in the closure before** `after()` is registered, so the telemetry path carries a JWT-bearing instance (**R-05** — the alternative assumption is unverified and the design does not depend on it).
- **`SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/page.tsx`**: `export const maxDuration` — a route-segment config that **cannot** be declared inside a `"use server"` file. Precedent: `app/(authoring)/upload/page.tsx:18`.

### `SOURCE/lib/supabase/service-role.ts` is in NEITHER commit
It moved to **Task B1.3b** (I003), because `gradeEssays.ts` calls those operations and B1.5 depends on `gradeEssays.ts`, so leaving them here formed a genuine dependency cycle.

### Why the Design Doc's "same change set" wording is satisfied by two commits
Step 7 alone emits `pending` keys with nothing to grade them — every essay reading "Đang chấm" and then "Chấm thất bại" ten minutes later, the screen that lies twice UI-D7 exists to prevent. That hazard is a **deployment** hazard, not a commit hazard, and it is closed by the deployment rule above rather than by commit size. See **Open Item I-2**.

## Target Files
**Commit 1**
- [x] `SOURCE/lib/scoring/computeScore.ts`
- [x] `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (Task B1.1's cases)

**Commit 2**
- [x] `SOURCE/features/exams/actions.ts`
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/page.tsx`

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ `computeScore()` changes / D-01 — the third parameter, the branch split, `hasEssayGroundTruth()`, the two comment reasons)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `submitExam()` reads the flag, threads `options`, registers `after()` **before** `redirect()`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Ba chỗ đọc phía server / D-15 — `maxDuration` cannot be declared in a `"use server"` file)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-09 — eleven comment sites; **two** belong to this commit)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Field Propagation Map)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 1 placement; Decision 4: the initial counter value is emitted by `computeScore()` at insert, so `record_exam_result()`'s signature does not change)
- `docs/adr/ADR-0005-multi-part-national-exam-format.md` (§ Decision — `questions.essay_answer` is the essay ground truth)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance — the grading pass runs after `recordExamResult` and `recordSkillMastery`; every exit is swallowed)
- `SOURCE/lib/scoring/computeScore.ts` (`:17-18`, `:35` the two D-09 comments; `:40-41` `isScored()`; `:93-96` the signature; `:99-101` the branch)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `newEssayEntry()`)
- `SOURCE/features/exams/actions.ts` (`:146` the `MAX_ATTEMPT_ANSWER` slice; `:192` the `redirect()` this registration must precede)
- `SOURCE/lib/support/actions.ts` (`:122-127` — the `after()`-before-`redirect()` precedent and the rule in writing)
- `SOURCE/app/(authoring)/upload/page.tsx` (`:18` — the `maxDuration` precedent)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — `gradeEssaysForAttempt`)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | placement | The band is written in place into `exam_results.per_question` by **two** `service_role`-only `INVOKER` SQL functions — never by a TypeScript `.update()` call site, and never into a separate `essay_grades` table | Neither commit adds a `.update()` on `exam_results`; `computeScore()` only **emits** the insert-time keys |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time and is never decremented. The initial counter value is emitted by `computeScore()` at insert, so `record_exam_result()`'s signature does not change | `computeScore()` emits `essayAttempts: 0`; `record_exam_result()`'s signature is untouched |
| `docs/adr/ADR-0005-multi-part-national-exam-format.md` (§ Decision) | persistence | `questions.essay_answer` is the essay ground truth; `question_type` already includes `'essay'` — no enum widening | `hasEssayGroundTruth()` reads `essay_answer`, and neither commit widens an enum |
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance) | data_flow | The score-write path is load-bearing; everything attached to it is allowed to fail. The grading pass runs after `recordExamResult` and `recordSkillMastery`, and every exit is swallowed and logged | A failing pass leaves `submitExam()`'s observable outcome unchanged |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ Hợp đồng khoá jsonb) | column/label set and order | `essayState` (`"pending" \| "graded" \| "failed"`, insert value `"pending"`), `essayEarned` (`number \| null`, insert `null`), `essayMax` (`number \| null`, insert `null`), `essayLowConfidence` (`boolean`, insert `false`), `essayAttempts` (`number` int, insert `0`), plus the sixth key `essayGradedAt` (`string` ISO 8601, **absent** at insert) | The emitted element carries exactly those five keys with those values, and no `essayGradedAt` |
| backend DD (§ Hợp đồng khoá jsonb) | state-lifecycle-negative | "`essayGradedAt` **cố ý không** có mặt lúc insert: nó là dấu thời gian của một sự kiện chưa xảy ra, và một `null` ở đó sẽ ngụ ý 'đã chấm, không rõ lúc nào'." | `Object.keys` of the emitted element does not include `essayGradedAt` |
| backend DD (§ EG-BE-004) | state-lifecycle-negative | "**Ở mọi trạng thái vòng đời** (`pending`, `graded`, `failed`), phần tử được lưu **phải** giữ `scored: false` và `isCorrect: false`. Một phần tử `graded` mang `scored: true`, `isCorrect: true`, hoặc **thiếu** khoá `scored`, là **trượt** tiêu chí này." | Every emitted essay element carries `scored: false`, `isCorrect: false`, and the `scored` key is present |
| backend DD (§ EG-BE-002) | state-lifecycle-negative | "**Khi** `computeScore()` chạy với `options.essayGrading === false` (mặc định), hệ thống **phải** phát ra phần tử `per_question` cho câu `essay` **y hệt từng byte** như hôm nay: `{ questionId, selected, isCorrect: false, scored: false }` và **không một khoá `essay*` nào**." | With the default options, the essay element's key set is exactly those four keys |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `computeScore()` → `exam_results.per_question` (Supabase Postgres, separate process) | **Serialized format**: jsonb array elements carrying, for a gradeable essay, the five insert keys alongside `scored:false`, `isCorrect:false`. `JSON.stringify`d straight from TypeScript — **camelCase, no snake_case mapping layer**. **Consumer parse rule**: readers branch on the **presence** of the `essayState` key (absent ⇒ RS-0), then on its value; an unrecognised value returns `null` and warns once. **Expected signal**: INT-1(a) — the payload handed to the mocked `recordExamResult` equals an independently authored literal, and `Object.keys` of every essay element contains none of the six keys when the flag is off. |
| `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop | **Serialized format**: env string; **only** `"true"` (trimmed) means on. **Consumer parse rule**: this is **read site 1 of 3** (behaviour gate). **Expected signal**: INT-1(d) — four spellings (absent, `""`, `"TRUE"`, `"1"`) all mean off, with a trimmed `"true"` as the single positive control. |

Roundtrip check this task owns: the element `computeScore()` emits is exactly what a presence-branching reader interprets — and, with the flag off, it is byte-identical to today's.

## Investigation Notes
_(Record here: the RED observation from Task B1.1 (which fixture failed and why) as it will appear in commit 1's message; the invocation-order evidence that `after()` precedes `redirect()`; the `L1` dev run's SQL read-back of `per_question`.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase (commit 1)
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category): every existing `computeScore()` caller, and the other two flag read sites
- [ ] Author Task B1.1's cases **RED**, observe the failure, and confirm it is because the third parameter does not exist yet
- [ ] Record that observation for commit 1's message

### 2. Green Phase (commit 1)
- [ ] Add the third `options` parameter defaulting to `{ essayGrading: false }`
- [ ] Split the `:99-101` branch; extract `hasEssayGroundTruth()` and share it with `isScored()`'s `:40` expression, leaving `isScored()`'s **behaviour** unchanged
- [ ] Fix the reason in the comments at `:17-18` and `:35`
- [ ] Land the tests and the implementation together; the EVP turns green
- [ ] Run all six verify gates on **commit 1 alone**

### 3. Green Phase (commit 2)
- [ ] `submitExam()` reads the flag (**trimmed `"true"` only**), threads it into `computeScore()`, captures the Supabase client in the closure, and registers `after(...)` **before** `redirect()` at `:192`
- [ ] Add `export const maxDuration` to the player route segment
- [ ] Run all six verify gates on **commit 2 alone**

### 4. Refactor Phase
- [ ] Confirm `computeScore()` is still pure — no I/O, no `process.env`, no async (AC-013)
- [ ] Confirm `service-role.ts` is in **neither** commit
- [x] Perform the `L1` dev run (Gate A5b ticked, seeded attempts only) and read `per_question` back with SQL — **DONE 2026-08-30**, attempt `d9008d0a-6421-40ad-8624-f1c45d84a8c1` on dev `hynwleaxtbtjzkvpjsug`. See § Investigation Notes.

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: the Early Verification Point and the `computeScore` suite — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: the route segment config and the server/client boundary — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, **per commit** (fill in at execution time)

Each commit must be **independently green**. Record two sets of exit codes.

**Commit 1 — `computeScore.ts` + its test file** (`3a34c9c`)

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1837 passed / 10 skipped / 3 todo. +8 from this commit |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` FE-1 (e) — `locale en` and `locale vi` |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo — second attempt; the first was a network timeout |

**Commit 2 — `actions.ts` + the player route segment** (`<commit 2>`)

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1837 passed / 10 skipped / 3 todo |
| 4 | `npm run build` | **0** | `maxDuration` accepted as a route-segment export; `server-only` still contained |
| 5 | `npm run test:fixture` | **1** | Same TD-030 baseline, both case names captured |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo |

**Known-red window recorded for both commits:** `npm run verify:schema` (dev) exits **1** with exactly **1** failing assertion, the character-ceiling gate. Red by design from H7 until B3.3.

### Red-phase observation for commit 1, recorded as the task requires

With the cases written and the implementation absent: **`Tests 1 failed | 27 passed (28)`**, and the single red case was **EG-BE-001** (flag ON + ground truth ⇒ five keys). The other seven were **green from the start**, which is the correct outcome and worth stating: they pin **today's** behaviour (flag off ⇒ element identical byte-for-byte, no ground truth ⇒ no keys emitted). A suite where everything went red could not tell "not implemented yet" apart from "implemented in the wrong direction" — and the direction that must not move here is the default path every submission already takes.

### Network conditions during this task, stated once with direct evidence

One `verify:schema` run exited 1 with **zero** failing assertions:

```
[TypeError: fetch failed] ConnectTimeoutError: Connect Timeout Error
(attempted addresses: 104.18.38.10:443, 172.64.149.246:443, timeout: 10000ms)
```

An immediate re-run produced the familiar single ceiling assertion. The same degraded connectivity accounts for the other transient reds seen while completing this task — gate 3 once at `recordSkillMastery.int.test.ts` (a 60 s `beforeAll` timeout) and gate 6 once at `subscription.service.e2e.test.ts` (120 s hook + 60 s test).

**One of those was discriminated rather than dismissed**, because it mattered: `recordSkillMastery.int.test.ts` runs through `submitExam()` → `computeScore()`, the exact function commit 1 changes. Run alone with the change in the tree: **2 passed**. Combined with a clean full-lane run immediately after (1837 passed), the change is not implicated.

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: both commits sit between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected. Any **other** red `verify:schema` assertion is a regression.

## Operation Verification Methods
- **Verification method**: commit 1 — the Early Verification Point's three-call `toEqual` comparison (Task B1.1). Commit 2 — assert `after()` is registered **before** `redirect()` by comparing `mock.invocationCallOrder` on the two spies, and that `submitExam()` emits **zero** synchronous provider requests. Then the **L1** run: on a **seeded** dev attempt with the flag on (Gate A5b ticked), submit three essays, watch bands land, and read `per_question` back with SQL.
- **Success criteria**: the two default-equivalent `computeScore()` calls are absolutely equal; the third differs at exactly the expected key set; `after()` precedes `redirect()`; `per_question` read back with SQL matches the W1 shape and the `questionId` sequence is unchanged.
- **Failure response**: if the EVP's first comparison fails, the parameter default is wrong and everything else in the feature stands on that proposition — **stop**. If `after()` is registered after `redirect()`, grading silently never runs once the flag is on, and nothing in the flag-off state reveals it — fix the ordering, not the assertion.
- **Verification level**: **L1** — a real submission on dev produces a real band.

## Proof Obligations
**Commit 1**
- **Claim**: Task B1.1's cases turn **GREEN**; EG-BE-001…004; EG-BE-030 (no existing scoring output moves).
  - **Primary failure mode** (Failure Mode Checklist: **no-op**): emitting keys with nothing to grade them — a screen that lies twice. Closed at **deployment** by the rule above, not by commit size.
  - **Boundary to exercise**: in-process unit; the serialized boundary is asserted on the **key set**, never on `=== undefined`.
  - **State assertion**: with the flag off, the emitted element is byte-identical to today's; with it on and ground truth present, it gains exactly the five keys.
  - **Mock boundary rationale**: none — `computeScore()` is pure (AC-013).
  - **Residual**: that the shape **survives the call site** is INT-1's (Task B1.6).

**Commit 2**
- **Claim (EG-BE-032)**: `submitExam()` emits **0** synchronous provider requests, and registration precedes `redirect()`.
  - **Primary failure mode**: registering `after()` after `redirect()` — in Next, never registering at all; grading silently never runs once the flag is on. **Boundary**: in-process with `after()`, `redirect()` and `fetch` mocked and **counted**; ordering asserted by `mock.invocationCallOrder`. **State assertion**: N/A. **Mock rationale**: `after()` is replaced by a synchronous invocation because the subject is *what* is registered and *when*, not how Next schedules it. **Residual**: proven again end to end by INT-1 (Task B1.6).
- **Claim (EG-BE-033)**: any pass failure leaves `submitExam()`'s observable outcome unchanged — the `exam_results` row is still written, `record_skill_mastery()` is still called, the redirect still happens.
  - **Primary failure mode**: a grading failure propagating into the load-bearing score-write path, so a provider outage costs the student their whole attempt. **Boundary**: in-process, with the registered callback forced to reject. **State assertion**: `recordExamResult` and `recordSkillMastery` both called; the redirect occurred. **Mock rationale**: as above. **Residual**: INT-1(f) re-proves it through the real call site.
- **Claim (Failure Mode Checklist: missing config)**: `ESSAY_GRADING_ENABLED` absent ⇒ **off**.
  - **Primary failure mode**: a loose truthiness read, so `"0"` or `"TRUE"` turns grading on in an environment nobody intended. **Boundary**: in-process env read. **State assertion**: N/A. **Mock rationale**: env read directly. **Residual**: the four-spelling matrix plus the trimmed-`"true"` positive control is **INT-1(d)** (Task B1.6) — it is what stops the flag read being dead code.

## Completion Criteria
- [ ] **Implementation Complete** = both commits landed with the stated boundary
- [ ] **Quality Complete** = **each commit independently green on all six verify gates** (with H7's known-red ceiling assertion recorded as expected), and the `computeScore` suite green with **zero regressions** on commit 1
- [x] **Integration Complete** = **L1** — on a **seeded** dev attempt with the flag on (Gate A5b ticked), submitting three essays produces bands, and `per_question` read back with SQL matches the W1 shape. **SATISFIED 2026-08-30.** Three essays, three DISTINCT bands (1.0 / 0.5 / 0.0), `essayAttempts: 1` on each (every one graded on the first pass, no retry), `essayLowConfidence: false`, `essayGradedAt` set. Every essay element carries exactly the ten W1 keys; the two MCQ elements keep their old five-key shape untouched (AC-012, no backfill), and the jsonb array order matches `question_ids`.
- [ ] The deployment rule appears **verbatim in both commit messages**
- [ ] Commit 1's message records the **RED observation** from Task B1.1
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in **both** Gate E4 tables above is filled

## Notes
- Impact scope: B1.6 (INT-1), B2.1 (the read path), B4.1 (the remaining D-09 sites), F-D1 (the flag's third read site).
- Scope boundary — preserve unchanged: `SOURCE/lib/supabase/service-role.ts` (**Task B1.3b**), `isScored()`'s **behaviour** (essay still returns `false`), `record_exam_result()`'s signature, `SOURCE/lib/scoring/wrongTwice.ts`, and the nine D-09 sites owned by B2.1, B3.3 and B4.1.
- **D-09 accounting**: 2 sites here (`computeScore.ts:17-18`, `:35`) + 1 in B3.3 (`prompt.ts:36`) + 1 in B2.1 (`types/result.ts:14-17`) + 7 in B4.1 = **11**.
