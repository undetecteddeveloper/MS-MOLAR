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

### 1. Acceptance criteria sweep
- [ ] EG-BE-001…036 all satisfied
- [ ] FE-AC-01…21 and FE-NFR-01…03 all satisfied
- [ ] PRD AC-001…AC-072 reconciled against both Design Docs' AC Traceability tables
- [ ] Note the **four** PRD ACs the backend DD deliberately does **not** satisfy (AC-020…AC-023 poller, AC-028 real `<button>`, AC-047 display string, AC-053 render branch) and confirm each is **discharged on the frontend side**, so nobody hunts for them in the wrong document

### 2. Four deliberate AC restatements confirmed as intentional, not drift
- [ ] **AC-058/AC-064** — never a native `disabled`; focusable + `aria-disabled` + exposed reason + synchronous early return (UI-D5)
- [ ] **AC-051** — the old key is **kept** and a new one added, selected by the flag (UI-D8)
- [ ] **AC-058 scope** — the guard lands in `usePdfAction`, covering `/history` as well as `ResultActions.tsx` (UI-D4)
- [ ] **AC-011/AC-057** — a separate labelled line beside `ScoreCard`, with `ScoreCard` at 0 diff (UI-D3)

All four are engineer decisions recorded as flagged restatements **instead of** editing a reviewed PRD; **a later PRD↔code comparison must read them as deliberate.**

### 3. Regression review of everything asserted as unchanged
- [ ] `isScored()` behaviour
- [ ] `SOURCE/lib/scoring/wrongTwice.ts` (**not one byte**)
- [ ] the MASTERY WRITE filter at `schema.sql:1354`
- [ ] `record_exam_result()`'s signature, body and grants
- [ ] the `exam_results` column DDL
- [ ] `QuotaKind`, `PLAN_LIMITS`, `Entitlement`, `budgetCeiling()`, `freeShare()` and **every** `consumeQuota()` call site
- [ ] `TutorPromptInput.questionType`'s closed union
- [ ] `PublicQuestion`'s `Omit`
- [ ] `buildTelemetryPayload()`'s body and its exhaustive six-column test
- [ ] **`ScoreCard.tsx` — 0 diff; any diff is a regression**
- [ ] the scored branch of `result/detail/page.tsx`
- [ ] `ExamPlayer.test.tsx`
- [ ] `RichText`
- [ ] all `(layer4)` surfaces **except** the OQ-5 decision

### 4. Security review
- [ ] `GROQ_API_KEY` read **only** inside `groqClient.ts` (a `server-only` module) and `npm run check:bundle` green
- [ ] `questions.essay_answer` never reaches the client **during an attempt** (`PublicQuestion` `Omit` unchanged) and **never enters `EssayView`**
- [ ] `telemetry_log` carries structured codes only, **enforced twice** (the type has no field able to hold free text; the runtime filter re-checks against the same constant)
- [ ] the **three console-logging rules** honoured at all three sites: `gradeEssaysForAttempt` → `questionId` + structured code; `retryEssayGrading` → **`digest` only**; `deriveEssayView` → `questionId` + the strange value only
- [ ] the **six anti-injection layers** present
- [ ] ADR-0010's containment list re-verified **item by item**, with the one item that is **no longer true** (a narrow privileged surface, now **13** operations) recorded against **TD-029** rather than glossed

### 5. Run all six verify gates individually, recording real exit codes
- [ ] `npx tsc --noEmit`
- [ ] `npx eslint --max-warnings 0`
- [ ] `npx vitest run`
- [ ] `npm run build`
- [ ] `npm run test:fixture` — expected: **only** the two TD-030 failures recorded in Gate F1; anything else is this feature's
- [ ] `npm run test:localdb` — against dev, with the DDL applied

### 6. Run the two additional gates
- [ ] `npm run check:bundle`
- [ ] `npm run verify:schema` against **both** databases — by this point **fully green including the character-ceiling assertion**, because Task B3.3 closed H7's known-red window. **A still-red ceiling assertion here means B3.3 did not land or did not land completely.**

### 7. Known-red window closed and auditable
- [ ] Walk the per-commit exit-code records (Gate E4) **from H7 to B3.3** and confirm the character-ceiling assertion was the **only** red `verify:schema` assertion for the whole window, and that it is **green from B3.3 onward**

### 8. Test resolution, quantified
- [ ] integration lane `essayGrading.int.test.ts` — **3/3**
- [ ] fixture lane `essay-auto-scoring.fixture.e2e.test.ts` — **3/3**
- [ ] service lane `essay-grade-write.service.e2e.test.ts` — **2/2**
- [ ] **Unresolved `it.todo` across the three skeleton files: 0 (all resolved)**

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

### 15. Coverage as a diagnostic signal, not a target
- [ ] Confirm **no regression** in existing coverage for `computeScore.ts`, `queries.ts` and `usePdfAction.ts`

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
