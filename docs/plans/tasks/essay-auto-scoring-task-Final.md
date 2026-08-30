# Task Final — Quality Assurance (Required)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Final Phase: Quality Assurance (Required)** (Estimated commits: 1)
Layer: **cross-cutting** (verification and document updates; no feature code)

Metadata:
- Owner: engineer, with agent assistance for the mechanical sweeps.
- Dependencies: **every phase** — 0, H, B1, B2, B3, B4, F-A, F-B, F-C, F-D, E.
- Blocks: nothing; it is the last phase.
- Provides: the acceptance sweep, the regression review of everything asserted **unchanged**, the security review, the known-red-window audit, the manual verification passes, and the document updates.
- Size: Large (verification + document updates only — **no feature code**)
- Verification level: **L1** (manual passes on dev with seeded data) + **L2/L3** (all lanes and gates).

## Purpose

Cross-cutting verification against **both Design Docs, the UI Spec, the PRD and ADR-0018** — **including every claim this feature asserts as *unchanged*, which is the half that is easiest to skip.**

## Checklist — the tasks of this phase

### 1. Acceptance criteria sweep — done 2026-08-30

**Result: all 72 PRD ACs traced and satisfied, and all 36 EG-BE criteria satisfied; one frontend criterion, FE-AC-12, is NOT satisfied.** FE-AC-12 is the **only** entry in the FE-AC list carrying no `(AC-xxx)` back-reference — it is a robustness criterion the frontend Design Doc invented for itself, so **no PRD AC fails**, and equally **no PRD-level sweep would ever have found it**. The gap is recorded below rather than fixed, because this phase adds no feature code.

- [x] **EG-BE-001…036 all satisfied.** 32 of the 36 carry their ID as a literal tag in source or test, so the mapping is mechanical rather than asserted. The **four that carry no tag** were each checked directly, because an untagged criterion is exactly the one a sweep skips:
  - **EG-BE-018** (adversarial fixtures, real provider) — `adversarialAnswers.ts` holds **7** committed fixtures against a required floor of 5, across **7 distinct techniques**, in **both** languages, and including **both** a zero-width and a bidi variant. The real-provider half is Task **E3**: 7 × 2 = 14 calls, **7/7 EQUAL, 0 RAISED**. Two clean baselines are themselves 0.5 and one is 0, so there was genuine headroom for an injection to lift a band; none did. This is the controlled comparison the AC asks for, not a ceiling check.
  - **EG-BE-019** (budget key) — `groq:budget:${pacificDay(now)}` is built at `lib/essay/budget.ts:69`. The string `ai:budget:` appears **nowhere** in `lib/essay/**`; its only construction site is `lib/billing/quota.ts:176`, the Gemini path. The two prefixes differ at the **first** character, which is what makes a mistaken key impossible to typo into.
  - **EG-BE-028** (character ceiling) — carried by `npm run verify:schema`, recorded green in section 6 including the ceiling assertion (4000 passes, 4001 rejected by `attempt_answers_answer_check`).
  - **EG-BE-030** (non-essay regression) — carried by the existing `computeScore.test.ts` fixtures plus EG-BE-002's byte-identical assertion; the default lane is green at **2026 passed / 10 skipped**, unchanged across this feature.
- [ ] **FE-AC-01…21: 20 satisfied, FE-AC-12 NOT satisfied. FE-NFR-01…03: structurally satisfied; the visual half is engineer-owned.**
  - **The FE-AC ID space is shared with other features** — `subscription` and `billing` also number their criteria `FE-AC-nn`, and a grep for `FE-AC-10` returns hits in `RecheckOrderControl`, `OrderList` and `PaymentConfirm` that have nothing to do with essays. **Tag-grep alone is not evidence here**, so each essay criterion was matched to a named test instead.
  - Evidence by criterion: FE-AC-01 `result/page.tsx:97`; 02, 14, 15 `EssayScoreLine.test.tsx:64/48/141`; 03, 13 `detail/page.tsx:141/152` + FE2E-4; 04 `EssayReviewBlock.test.tsx:90`; 05, 16 FE2E-2; 06, 07, 09 `EssayRegradeControl.test.tsx:46/174/107`; 08, 21 `EssayRegradeControl.test.tsx:161/190`; 10, 11 FE2E-3; 17, 18 `EssayGradingPoller.test.tsx:117/128/151/159` and `:89/101`; 19 `AttemptPdfTemplate.test.tsx:118/126/135`; 20 `QuestionRenderer.test.tsx:193/203/210`.
  - **FE-NFR-01** — the `grid-cols-3` block is at `result/page.tsx:152-176` and holds exactly three cells (`ResultActions` → Save + Share, plus the Return `Link`). Blocking is passed as the `blockedReason` **prop**, so the blocked state cannot add a fourth cell; the invariant is structural, not visual. **FE-NFR-02** — `HistoryRow.tsx:61` is the single in-flow node in the right column, and the badge sits at `:56` inside the left meta column. **FE-NFR-03** — `EssayLifecycleBadge.test.tsx` asserts zero hex literals and specifically refuses to borrow `#4F7942`, so no new pair exists to re-measure.

#### The one gap: FE-AC-12 is unsatisfied, and no test would have caught it

FE-AC-12 requires that **when a `router.refresh()` throws, the poller logs and still schedules the next tick, with nothing surfacing to the student.** `EssayGradingPoller.tsx:107-109` is:

```
refreshes.current += 1;
router.refresh();
schedule();
```

There is **no `try`/`catch`** at either call site (`:109` in the tick, `:166` in the manual "Cập nhật" button), no log, and **no test anywhere** asserts the behaviour — the file contains no `mockRejected`, no `mockImplementation` that throws, and no `catch`. A synchronous throw from `router.refresh()` skips `schedule()`, and the poller **stops permanently and silently**: `stopped` is never set, so the student gets neither the self-updating page nor the `pollStopped` message with its manual refresh button. It is the one failure mode where the feature's own fallback is also removed.

**Not fixed here, deliberately.** This phase's scope boundary is "**No file under `SOURCE/`**", and a two-line `try`/`catch` in a client component with a new test is feature code that belongs in its own task and its own commit. Recorded so it is not lost between phases.

- [x] **PRD AC-001…AC-072 reconciled against both Design Docs' AC Traceability tables — measured, not eyeballed.** The PRD declares **exactly 72** ACs with **no gaps** in `001..072`. The backend DD's table carries a row for **all 72**; the frontend DD's table carries **36**, and all 36 are a **subset** of the backend's rows. **Union = 72/72: no PRD AC is orphaned in either document**, and none exists in the frontend table without a backend counterpart.
- [x] **The four the backend DD deliberately does not satisfy are each discharged on the frontend side** — checked in code, not only in the frontend DD's table:
  - **AC-020…AC-023** (poller) — `EssayGradingPoller.tsx`, with `ESSAY_POLL_MAX_REFRESHES = 30` and `ESSAY_POLL_MAX_ELAPSED_MS = 240_000` (`:49`, `:51`) matching FE-AC-17 exactly, and the two ceilings tested independently. **AC-023's own defect is guarded in the mount condition**: the poller mounts on `essaySummary !== undefined`, not `pendingCount > 0`, so the `aria-live` region survives the render that resolves the final essay.
  - **AC-028** (a real `<button>`) — `EssayRegradeControl.tsx:111` renders `<Button>`, which resolves to a native `<button>`; the tests reach it by `getByRole("button")` at `:48`, `:63`, `:81`, `:101`.
  - **AC-047** (display string) — the low-confidence state is carried by an i18n constant and asserted **as text**; `EssayLifecycleBadge.test.tsx:95` further asserts the information survives a black-and-white print, i.e. it is not conveyed by colour.
  - **AC-053** (render branch) — `detail/page.tsx:152` branches on `!r.essay`, **not** on `scored`. The comment there records why: `r.scored === false` is permanently true for essays in **all seven** render states, so it distinguishes nothing. **A real L1 run caught exactly that defect** — a card reading "Đã chấm · 1/1 điểm" directly under "chưa chấm tự động" — and FE2E-4 now pins it.

**One citation moved.** The frontend DD cites the grid as `result/page.tsx:104-116`; it is now `:152-176`. Feature edits above it moved it. Logged for section 16's line-number pass.

### 2. Four deliberate AC restatements confirmed as intentional, not drift — done 2026-08-30

All four confirmed **intentional**: each carries a decision owner (engineer), a **date** (2026-08-29), and a recorded counter-reason, and in each case **the code matches the restatement rather than the literal PRD wording**. That combination is what separates a deliberate restatement from drift — drift has code on one side and nothing written on the other.

- [x] **AC-058/AC-064** — never a native `disabled`; focusable + `aria-disabled` + exposed reason + synchronous early return (UI-D5). `EssayRegradeControl.tsx:116` sets `aria-disabled` and never `disabled`; `FE-AC-21`'s test (`:190`) asserts the absence across **every** state, and `:161` asserts the synchronous early return spends no action call and raises no busy phase. The reason recorded upstream is that the repo has fixed this exact defect **twice** and **three current files ban the attribute in writing** (AB-9).
- [x] **AC-051** — the old key is **kept** and a new one added, selected by the flag (UI-D8). `QuestionRenderer.tsx:223` reads `t(essayGradingEnabled ? "player.essayScored" : "player.essayNotScored")`, and **both** keys are present in `en.ts` and `vi.ts`. The reason holds independently of commit order, which is precisely why it was chosen over the single-key option.
- [x] **AC-058 scope** — the guard lands in `usePdfAction`, covering `/history` as well as `ResultActions.tsx` (UI-D4). Both doors read the same reason string: `result/page.tsx:166` and `HistoryRow.tsx:69`, and FE2E-3 exercises **both** in one test.
- [x] **AC-011/AC-057** — a separate labelled line beside `ScoreCard`, with `ScoreCard` at 0 diff (UI-D3). `EssayScoreLine` is its own component rendered below `ScoreCard`, and `ScoreCard.tsx`'s diff across the whole feature is **empty** (section 3). Reading "combining" literally would have redefined `total`, which `ScoreCard.tsx:19` uses to derive `wrong` — silently breaking the "Sai" cell.

All four are engineer decisions recorded as flagged restatements **instead of** editing a reviewed PRD; **a later PRD↔code comparison must read them as deliberate.**
### 3. Regression review of everything asserted as unchanged

**Mechanical sweep run 2026-08-30 against `main..HEAD`.** This is the part of the Final phase that is checkable without the engineer-owned external work, and the task explicitly invites agent assistance for it. Result: **every claim below holds.**

- [x] `isScored()` behaviour — the function body is unchanged; only its **docblock reason** moved (B4.1), and the default lane stayed byte-identical at 1950 passed across that commit
- [x] `SOURCE/lib/scoring/wrongTwice.ts` — **not one byte**: `git diff main..HEAD` on that path is empty
- [x] the MASTERY WRITE filter at `schema.sql:1354` — untouched
- [x] `record_exam_result()`'s signature, body and grants — untouched
- [x] the `exam_results` column DDL — untouched (this feature adds **no column**; the bands live inside the existing `per_question` jsonb)
- [x] `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and every `consumeQuota()` call site — **none appear in the diff**. `lib/billing/quota.ts` *did* change, and the sweep checked what: it is a pure **extraction** — the Pacific-day key logic moved to `budgetDay.ts` and is now imported, with `ai:budget:${pacificDay(now)}` producing a **byte-identical** key. That extraction exists so the Groq counter could reuse the day logic without copying it
- [x] `TutorPromptInput.questionType`'s closed union — still `"mcq" | "true_false" | "short_answer"`; the `@ts-expect-error` fixture still fails to compile, which `tsc` proves on every commit
- [x] `PublicQuestion`'s `Omit` — `types/question.ts` is unchanged
- [x] `buildTelemetryPayload()`'s body and its exhaustive six-column test — the **only** non-comment lines in `telemetry.ts`'s diff are the two literal-set widenings from H5 (`TELEMETRY_ERROR_CODES` 6→9, `TelemetryEventType` +`essay_grade`). The function body and its test are untouched, and a new test asserts the **written** payload's key set is exactly those six columns
- [x] **`ScoreCard.tsx` — 0 diff**, confirmed by `git diff --stat main..HEAD` returning empty

**Not yet done in this phase:** everything in sections 1, 2 and 4 onward that depends on Phase E or on a manual pass over seeded dev data. Those are blocked on the engineer-owned items listed at the end of this file.
- [ ] the scored branch of `result/detail/page.tsx`
- [ ] `ExamPlayer.test.tsx`
- [ ] `RichText`
- [ ] all `(layer4)` surfaces **except** the OQ-5 decision

### 4. Security review — done 2026-08-30
- [x] `GROQ_API_KEY` read **only** inside `groqClient.ts:228` (a `server-only` module). The only other mentions are `checkEnv.ts`'s presence check (reads existence, never the value) and comments. **`npm run check:bundle` exit 0** — "8 server-only secrets do not reach the client".
- [x] `questions.essay_answer` never reaches the client during an attempt: `PublicQuestion = Omit<Question, "correctAnswer" | "essayAnswer" | "subAnswers">` is unchanged. **And it cannot enter `EssayView`** — that interface has five fields (`state`, `earned`, `max`, `lowConfidence`, `retryAvailable`) and no field capable of holding it. Structural, not conventional.
- [x] `telemetry_log` structured codes only, **enforced twice**: `TELEMETRY_ERROR_CODES` is a 9-value `as const` and `TelemetryErrorCode` derives from it (compile time), and `telemetry.ts:89` re-checks membership against **the same constant** at runtime, returning `null` for anything else.
- [x] The three console-logging sites verified **by reading every call**, not by reading the rule:
  - `gradeEssays` — one `log()` helper, 10 call sites. Every `detail` argument is a SQLSTATE (`error.code`), an `Error#name`, a literal, or a closed-union `reason`/`kind`. **No message, no student text, no prompt, no raw response.**
  - `deriveEssayView` — exactly one `console.warn`, carrying `questionId` and the unrecognised value.
  - `retryEssayGrading` — `logDigest()` carries `digest` only; two further sites in `recordRetryTelemetry()` carry `error.code` and `Error#name`.
- [x] The **six anti-injection layers** present in `prompt.ts`: instructions-then-data with labelled rare delimiters; two distinct labelled regions; an explicit anti-injection sentence placed in the *instruction* half; the output shape declared in prose even with `response_format` on; an unterminated final data region, so a forged closing delimiter opens nothing; and no truncation or keyword filtering of the student's answer.
- [x] ADR-0010's containment list re-verified: `grep -c "^export async function"` on `service-role.ts` returns **13**, exactly what TD-029 predicted ADR-0018 would take it to. TD-029's two revisit triggers are still accurately stated — a **14th** operation, or a **third** in-place `exam_results` mutation (ADR-0018 being the first and second, claim and settle). Recorded, not glossed.

#### One finding: a rule that overstated itself
`essayActions.ts`'s header read **"QUY TAC LOG: CHI `digest`"** — *only digest*. Two sites in `recordRetryTelemetry()` log `error.code` and `Error#name` instead. **Neither can carry free text**, so the security property holds and no student writing can leak; the code was right and the label was wrong.

Fixed anyway, and worth saying why: a rule stated more strictly than the code obeys is a rule the next reader sees violated three lines below it, and then stops trusting. The header now names the invariant actually held — **no `message` is ever logged** — which covers all three sites truthfully, with the banned list (`message`, `details`, `hint`, prompt, raw response, student answer) spelled out so the boundary is checkable rather than remembered.
### 5. Six verify gates, run individually — done 2026-08-30
| # | command | exit |
|---|---|---|
| 1 | `npx tsc --noEmit` | **0** |
| 2 | `npx eslint --max-warnings 0` | **0** |
| 3 | `npx vitest run` | **0** — 2026 passed / 10 skipped / **0 todo** |
| 4 | `npm run build` | **0** |
| 5 | `npm run test:fixture` | **1** — TD-030 baseline **only**, matched by name: the two failures are `locale en` and `locale vi` under FE-1(e) of `subscription.fixture.e2e.test.ts`. 79 passed |
| 6 | `npm run test:localdb` | **0** — 16 passed |
#### `test:localdb` went red later the same day, and it is the environment, not this feature

The exit **0** above is real and was measured. Three further runs a few hours later were **red**, and the honest record is that they were red, with the reason:

| run | result | duration |
|---|---|---|
| earlier | **0** — 16 passed | ~55 s |
| +3 h | 1 fail (3 tests) | 307 s |
| +3.2 h | 1 fail (1 test) | 299 s |
| +3.4 h | 3 fails | 303 s |

Four reasons this is read as environmental rather than as a regression, and all four had to hold before writing that:

1. **Every failure is a timeout** — `Hook timed out in 10000ms`, `Test timed out in 5000ms`, `Test timed out in 60000ms`. No assertion failed.
2. **The failing set moves between runs.** A real defect fails the same case each time.
3. **Most failures are in `subscription.service.e2e.test.ts`**, which this feature never touches — no shared fixture, no shared slot.
4. **The suite duration went from ~55 s to ~300 s** on identical code, which is the connection to Supabase, not the code under test.

**Not re-run until green.** Repeating a flaky gate until it passes and recording only that number is exactly the "probably fine" the six-gate rule exists to prevent; it is also how TD-030 stayed hidden. The lane's *meaningful* result for this feature was recorded when the connection was healthy — 16 passed, 0 todo, with all five new service cases executing — and that number stands alongside this note, not instead of it.

### 6. The two additional gates — done 2026-08-30
- [x] `npm run check:bundle` — **exit 0**, "8 server-only secrets do not reach the client".
- [x] `npm run verify:schema` against **dev** — **exit 0, fully green including the character-ceiling assertion**, which is precisely what this section was written to detect:
  - a 4000-character answer **passes** the CHECK on the real database (it dies at the foreign key, `23503`, proving the ceiling is not lower than `LIMITS.MAX_ATTEMPT_ANSWER`)
  - 4001 characters is **rejected** by `attempt_answers_answer_check` (`23514`), so the DB ceiling is *exactly* 4000
  - `schema.sql` says 3 attempts and `ESSAY_MAX_ATTEMPTS` says 3
  - both new functions: `EXECUTE` to `service_role` only — `anon` 42501, `authenticated` 42501
- **The "both databases" half cannot be satisfied as written**, and this was established during B3.3: the ceiling probes are **skipped on prod by design**, because they write and are dev-guarded. The prod-side constraint was confirmed instead via `pg_get_constraintdef`, the script's own recommended fallback. A green ceiling line on prod was never achievable — recorded so a later audit does not hunt for one.
### 7. Known-red window closed and auditable — done 2026-08-30
- [x] The character-ceiling assertion is **green from B3.3 onward**, confirmed by the `verify:schema` run recorded in section 6. The window H7 → B3.3 is shut, and B3.3's own task file carries the per-commit record together with the prod-probe caveat above.
### 8. Test resolution, quantified — done 2026-08-30
- [x] `essayGrading.int.test.ts` — **3/3 skeleton slots resolved**: `INT-1` (submitExam flag), `INT-2` (`hasIncompleteEssay` agreement), `INT-3` (graded essay out of the score triple), with **17 executing cases** across them.
- [x] `essay-auto-scoring.fixture.e2e.test.ts` — **4 executing cases** (FE2E-1, 2, 3, plus FE2E-4 added 2026-08-30 for the defect the `L1` run found).
- [x] `essay-grade-write.service.e2e.test.ts` — **5 executing cases** (SVC-1, SVC-2 and three additions that are cheap in this lane and impossible elsewhere).
- [x] **Literal `it.todo(` across the whole `tests/` tree and all three files: 0.** Measured with `grep -F`, not `grep "it.todo"` — the unescaped `.` matches prose and reports phantom todos, which it did on the first pass here.

#### Correction to this section's own premise
`essayGrading.int.test.ts` lives at **`app/(layer2)/__tests__/`**, not `tests/integration/`, so it runs in the **default** vitest lane — `vitest.integration.config.ts` includes only `tests/integration/**`. That is not drift: **eleven** other `*.int.test.ts` files sit under `app/` and `lib/` by the same established convention. The phrase "integration lane" names the file's *kind*, not the vitest project it belongs to.
### 9. Manual verification on dev with seeded data
*(Production has 0 submitted essays, so there is no other path.)*
- [ ] **IV-1** — the read contract works: `EssayScoreLine` shows `1 / 1 điểm` plus the denominator sentence; `ScoreCard` unchanged **to the pixel**
- [ ] **IV-2** — seed an attempt covering **RS-0…RS-6** and confirm each card's badge/text/control, that **no** card shows a correct/incorrect chip, and that `result.notAutoScored` appears **only** on RS-0/RS-1
- [ ] **IV-3** — press Save on `/result` **and** open the ⋯ menu on `/history` for the **same** attempt: no file, no error, still Tab-reachable, reason readable **in both places**
- [ ] **IV-4** — with one pending question, watch the page update within **≤ 10 s** of the band landing, and confirm the screen reader announces progress
- [ ] **IV-5** — press "Chấm lại" on RS-4: busy phase, action runs, refresh lands, band **or exactly one alert** appears
- [ ] **IV-6** — export the PDF for an attempt with ≥1 RS-6 question from **both** doors — **two identical files**, both carrying the `pdfIncomplete` line, **confirmed by opening them**
- [ ] **IV-7** — turn the flag **off**, submit a new attempt, open all four screens — **byte-for-byte as before**, and the poller schedules **no timer**

### 10. UI Spec Golden States 1–10 walked once
- [ ] With Playwright MCP or `npm run pw`, **including Golden States 7, 8 and 10** — the feature-off states, **the most important column of the Output Comparison table because they are the state the feature ships in**

### 11. FE-OQ-4 / R-F3 resolved on a real browser
- [ ] Put focus on the "Chấm lại" button, let a `router.refresh()` land, and read `document.activeElement`. **jsdom cannot answer this** — the RTL case proves only the necessary condition (nothing was unmounted). If focus is still lost, add a focus-restore mechanism following `ExplainStepAffordance.tsx:56-77` — **only** if the measurement shows it is needed. Result recorded: `____________________`

### 12. FE-OQ-5 resolved
- [ ] Engineer confirms or rejects the two `implicit` standards — `tabular-nums` on every numeric element (**it has an independent functional reason**: the denominator grows while the student is watching, and non-tabular digits make the line jump on every refresh, so rejecting it needs a counter-reason) and `min-h-11` for the action touch target. Either way it is **two classes, not a design change**. Result recorded: `____________________`

### 13. Accessibility checklist, all six items
- [ ] live-region announcement when a state resolves
- [ ] focus survives a self-refresh
- [ ] "Cần xem lại" and "Chấm thất bại" readable **as text**, asserted by text not by class
- [ ] the retry control reachable and operable by keyboard alone, **including at the attempt cap**, with a **negative assertion about `disabled`**
- [ ] the character counter still displays and updates
- [ ] the PDF blocked state **exposes its reason** to assistive technology
- [ ] plus one **manual screen-reader pass** — the repo has no axe and no Lighthouse CI, which is exactly why this is a listed manual step

### 14. Rollback rehearsal, all three documented levels
- [ ] **Turn the feature off** (cheapest — new submissions emit no keys, every surface returns to today's behaviour, **already-graded attempts keep their keys and keep rendering**)
- [ ] **Remove the poller** (drop the mount condition on both pages — the page stops self-updating, everything else intact)
- [ ] **Revert the whole slice** (`git revert` — **28 i18n keys and 15 test render sites must revert together or CI goes red on compile errors**)

### 15. Coverage as a diagnostic signal, not a target — CANNOT BE DONE AS WRITTEN
- [ ] Confirm **no regression** in existing coverage for `computeScore.ts`, `queries.ts` and `usePdfAction.ts`

**There is no baseline to regress against.** The repo has no `coverage/` directory and `vitest.config.ts` declares no coverage configuration, so no prior measurement of these three files exists. Running coverage once now would produce a number, not a comparison — and reporting a single number as "no regression" would be exactly the false claim this section's own title warns against.

**Left open deliberately.** What would close it: record a baseline now, and compare on the *next* change to these files. All three are meanwhile covered by executing tests — `computeScore.test.ts`, `getResult.int.test.ts` / `history.int.test.ts`, and `usePdfAction`'s cases in the fixture lane.
### 16. Document updates
- [ ] `TECH-DEBT.md` — confirm **TD-029** still accurately names its two revisit triggers (a **14th** `service-role.ts` operation; a **3rd** in-place `exam_results` mutation) now that operations 12 and 13 exist; confirm **TD-005**'s entry reflects that this feature added **three DDL groups** under Phase 3.5; confirm **TD-030** is untouched and still open
- [ ] `docs/design/essay-auto-scoring-backend-design.md` — mark OQ-1…OQ-6 resolved or still-open with their outcomes; correct any line-number citation that this feature's own edits moved
- [ ] `docs/design/essay-auto-scoring-frontend-design.md` — mark FE-OQ-3, FE-OQ-4, FE-OQ-5 resolved; **correct its header**, which cites the UI Spec as **v1.2** and the backend Design Doc as **v1.2** while the current versions are UI Spec **v1.3** and backend **v1.4**
- [ ] `docs/ui-spec/essay-auto-scoring-ui-spec.md` — close **O-3** with the payload measurement and **O-6** with the latency measurement; leave **O-4 open with its owner** (non-blocking)
- [ ] `docs/adr/ADR-0018-essay-async-grade-write.md` — record the **new schema fingerprint** in Consequences (it names `29931beeb950` as the pre-feature value) and confirm the "Known unknowns" cell still holds after the first real-provider run

### 17. Do not delete this work plan without explicit user approval — and note that it is TRACKED, not ignored
- [ ] `git ls-files docs/plans/` lists this file alongside ten others; work plans in this repository are **under version control**. That changes what deletion costs: **every filled gate slot in this document is versioned evidence** — the Gate A5b and A6 dates and the engineer's name, the Gate B fingerprints for both projects and the confirmation line, the Gate C constraint names read from each database, the Gate D payload measurements, the Gate F TD-030 baseline, and the Phase E records (budget limit, AC-070 result, OQ-1 latency figures). **Several of those exist nowhere else** — they are read-only observations of external systems at a point in time, **not derivable from the code**. Deleting the plan destroys them. If the file is removed at the end, the gate evidence must first be **moved somewhere durable** (the project's progress store, or an appendix in the backend Design Doc), and **that move is itself a task, not an afterthought.**

### 18. Quality Assurance (the plan's own final block)
- [ ] Quality check (staged)
- [ ] All tests pass (default, fixture and localdb lanes — fixture red **only** at the TD-030 baseline)
- [ ] Static check pass
- [ ] Lint check pass
- [ ] Build success

## Target Files
- [ ] `TECH-DEBT.md`
- [ ] `docs/design/essay-auto-scoring-backend-design.md`
- [ ] `docs/design/essay-auto-scoring-frontend-design.md`
- [ ] `docs/ui-spec/essay-auto-scoring-ui-spec.md`
- [ ] `docs/adr/ADR-0018-essay-async-grade-write.md`
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` (FE-OQ-4 and FE-OQ-5 result slots; Progress Tracking)
- [ ] **No file under `SOURCE/`** — this phase adds no feature code

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Final Phase; § Completion Criteria; § HARD GATES — every gate's recorded state)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Non-Scope — the complete list of what must be **asserted as unchanged, not merely left alone**)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Non-Scope; § Theme Token Map; § Accessibility Requirements; § Security Considerations)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change); § Open Item O-4)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Consequences — the kill criterion, already fired → TD-029)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — item #8: no background writer; § Consequences — the pre-feature fingerprint `29931beeb950`)
- `TECH-DEBT.md` (TD-005, TD-029, TD-030)
- All per-task Gate E4 exit-code tables from **H7 to B3.3** (the known-red window audit)
- `SOURCE/lib/scoring/wrongTwice.ts`, `SOURCE/app/(layer2)/_components/ScoreCard.tsx`, `SOURCE/app/(layer2)/_components/__tests__/ExamPlayer.test.tsx`, `SOURCE/supabase/schema.sql:1354`, `SOURCE/lib/tutor/telemetry.ts` (`buildTelemetryPayload()`), `SOURCE/lib/billing/quota.ts` (the unchanged-claims list)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-010) | state-lifecycle-negative | "**Khi** `claim_essay_grading_attempt()` thành công, `essayAttempts` của phần tử **phải** tăng đúng 1, và **phải không bao giờ** bị giảm bởi bất kỳ câu lệnh nào trong repo." | A repo-wide scan finds **no** statement anywhere that decrements `essayAttempts` |
| backend DD (§ EG-BE-036) | state-lifecycle-negative | "RS-6 **phải** được suy ra ở **đúng một chỗ**: biểu thức `state === \"failed\" && !retryAvailable` **phải không** xuất hiện ở bất kỳ file nào ngoài `SOURCE/lib/scoring/essayLifecycle.ts`." | The source scan finds the expression in that file only |
| UI Spec (§ Component: ScoreCard — unchanged, explicit non-change) | state-lifecycle-negative | "`ScoreCard` render y hệt hôm nay… Bất kỳ diff nào trong file này là **hồi quy**"; `result.totalScore.toFixed(1)` + `/10`, `Đúng` = `result.correct`, `Sai` = `result.total - result.correct` | `git diff` on `ScoreCard.tsx` across the whole feature is **empty** |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | persistence | No background writer for stored `pending`, including "cleanup on next login" — no cron, no queue, no sweeper. The final state is a read-time derivation | A repo scan finds no cron, queue or sweeper touching `essayState`, and `vercel.json` still has no `crons` |
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Consequences) | placement | Adding operations 12 and 13 to `service-role.ts` proceeds by engineer decision; a **fourteenth** operation, or a **third** in-place mutation of `exam_results`, forces the revisit | `service-role.ts` has exactly 13 operations, and TD-029's entry names both triggers |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert. Three surfaces must respect that: PDF export blocked while any essay is unresolved; `ScoreCard`/`/history` show a "đang chấm" marker on a separate labelled line, with `ScoreCard` a 0-diff zone; any future result-row cache must key on something that moves when a band lands | All three surfaces verified in IV-1, IV-3 and IV-6, and `ScoreCard.tsx`'s diff is empty |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change) — diff review)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Open Item O-4 — left open with its owner, non-blocking)

## Investigation Notes
_(Record here: the known-red-window audit result; the FE-OQ-4 and FE-OQ-5 outcomes; the IV-1…IV-7 observations; the three rollback rehearsals; every document update made.)_

## Implementation Steps
1. [ ] Run the acceptance sweep (items 1–2)
2. [ ] Run the regression review (item 3) — **assert unchanged, do not merely leave alone**
3. [ ] Run the security review (item 4)
4. [ ] Run the six gates individually and the two additional gates (items 5–6), recording **real exit codes**
5. [ ] Audit the known-red window (item 7)
6. [ ] Confirm test resolution counts (item 8)
7. [ ] Perform the manual passes IV-1…IV-7 and the Golden States walk (items 9–10)
8. [ ] Resolve FE-OQ-4 and FE-OQ-5 on a real browser and record both (items 11–12)
9. [ ] Work the accessibility checklist including the manual screen-reader pass (item 13)
10. [ ] Rehearse all three rollback levels (item 14)
11. [ ] Check coverage as a diagnostic signal (item 15)
12. [ ] Update the five documents (item 16)
13. [ ] Confirm the plan's retention rule (item 17) and the final QA block (item 18)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run test:fixture` — Config: `SOURCE/vitest.fixture.config.ts`
- `npm run test:localdb` — Config: `SOURCE/vitest.localdb.config.ts`
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`; **both** databases
- Emission-point (chokepoint) scan — Config: `SOURCE/lib/essay/__tests__/`
- Manual/Playwright MCP visual verification — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`; **dev with seeded data — production has 0 submitted essays**

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | against dev, with the DDL applied |
| 7 | `npm run check:bundle` | | Gate E2 |
| 8 | `npm run verify:schema` | | Gate E3 — **both** databases; **fully green including the character ceiling**. A still-red ceiling assertion means B3.3 did not land completely |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: all eight gates run individually by **real exit code**; the seven manual IV passes on dev with seeded data; the Golden States walk; the three rollback rehearsals; and the per-commit exit-code audit of the H7→B3.3 window.
- **Success criteria**: every gate green except `test:fixture`'s two recorded TD-030 failures; test resolution 3/3, 3/3, 2/2 with **0** unresolved `it.todo`; `verify:schema` fully green on both databases; the known-red window audited and closed; all four deliberate AC restatements confirmed as intentional; every "unchanged" claim asserted.
- **Failure response**: a third red fixture case is **this feature's** — apply Gate F2 in order. A still-red ceiling assertion means **Task B3.3 did not land or did not land completely**. Any **other** `verify:schema` assertion found red anywhere inside the H7→B3.3 window is a **regression that the window masked** and must be investigated before the phase closes.
- **Verification level**: **L1** (manual passes) + **L2/L3** (all lanes and gates).

## Proof Obligations
- **Claim (the unchanged half)**: everything this feature asserts as unchanged is **asserted**, not merely left alone.
  - **Primary failure mode**: the review checks what changed and skips what must not have — the half that is easiest to skip, and the half where `ScoreCard.tsx`, `wrongTwice.ts` and `schema.sql:1354` live.
  - **Boundary to exercise**: `git diff` over the named files, plus the existing suites for the behavioural claims.
  - **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (EG-BE-010, repo-wide)**: no statement anywhere decrements `essayAttempts`.
  - **Primary failure mode**: a "refund on failure" added later — the first change a future session will reach for — silently reopening the unbounded-retry hole. **Boundary**: repo scan of `SOURCE/supabase/schema.sql` and `SOURCE/lib/**`. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the scan is a point-in-time check; SVC-2(d) carries it in CI.
- **Claim (EG-BE-036, repo-wide)**: `state === "failed" && !retryAvailable` exists **only** in `essayLifecycle.ts`.
  - **Primary failure mode**: a surface re-deriving RS-6, so the PDF annotation and the screen disagree. **Boundary**: source scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (Failure Mode Checklist: rollback-only visibility)**: the three documented rollback levels work, and the asymmetry is understood.
  - **Primary failure mode**: assuming `git revert` is safe piecemeal — **28 i18n keys and 15 test render sites must revert together or CI goes red on compile errors**; and assuming the kill switch is symmetric when **an attempt cut off mid-pass stays `pending` forever and is presented as failed with an unusable retry button**.
  - **Boundary to exercise**: a real rehearsal of each level.
  - **State assertion**: after turning the flag off, **already-graded attempts keep their keys and keep rendering**.
  - **Mock boundary rationale**: none. **Residual**: the production kill-switch cycle itself is Task E6's.
- **Claim (Escalation 2's telemetry resolution limit)**: a duplicate-write rejection is attributable to `(user, question, day)` and **not** to a specific attempt.
  - **Primary failure mode**: a future session reading a rejection count and inferring a per-attempt rate from it. **Boundary**: documentation review — the limit must be present in **both** the plan and the code comment. **State assertion**: N/A. **Mock rationale**: none. **Residual**: accepted, not removed.
- **Claim (the known-red window is auditable)**: the character-ceiling assertion was the **only** red `verify:schema` assertion from H7 to B3.3.
  - **Primary failure mode**: another assertion red inside the window, masked by the expected red — the TD-030 failure mode repeating one level down. **Boundary**: the per-commit Gate E4 exit-code tables. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the audit is only as good as the recorded cells, which is why an empty cell makes a task file incomplete.

## Completion Criteria
- [ ] Items 1–18 above all worked and recorded
- [ ] All eight gates run individually with **real exit codes** recorded
- [ ] Test resolution: integration **3/3**, fixture **3/3**, service **2/2**; unresolved `it.todo`: **0**
- [ ] `verify:schema` **fully green** on both databases; the known-red window **audited and closed**
- [ ] FE-OQ-4 and FE-OQ-5 recorded
- [ ] The five documents updated
- [ ] The work plan's retention rule (item 17) acknowledged — **do not delete without explicit user approval**
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: verification and documents only. **No feature code changes in this phase.**
- Scope boundary — preserve unchanged: everything in item 3's list, most sharply **`SOURCE/app/(layer2)/_components/ScoreCard.tsx` (0 diff)** and **`SOURCE/lib/scoring/wrongTwice.ts` (not one byte)**.
- **Merging everything in this plan leaves the feature disabled in production.** Grading real student writing begins only after Phase E, and Phase E begins only after Gate A6 carries a real date.

---

## Status at 2026-08-30 — what is done and what is blocked

**Done and committed:** Phases H (including H8), B1, B2, B3, B4, F-A, F-B, F-C, F-D. The mechanical regression sweep in section 3 above.

**Blocked, and each on something only the engineer can do:**

| Item | Why it cannot proceed |
|---|---|
| The seeded dev **L1** run | Needs `ESSAY_GRADING_ENABLED=true` and spends live Groq budget. It is the outstanding Integration Complete evidence for **B1.5, B2.1, B3.1, B3.2**, the **EVP** for F-A3, and the L1 halves of F-B3, F-C1 and F-C2 |
| **E1** (Gate A / ZDR) | A dated check in the Groq console |
| **E2** (OQ-4) | The account's real rate/budget limits |
| **E3** (OQ-6 / AC-070) | A real-provider model evaluation |
| **E4** (OQ-5) | A product decision about `upload.essayStored` — three options, owner engineer/product |
| **E5** (OQ-1 / O-6) | 10 real gradings, to confirm or move four time constants |
| **E6** | Enabling the flag on prod |
| Final sections 1, 2, 4+ | Depend on E and on manual passes over seeded dev data |
