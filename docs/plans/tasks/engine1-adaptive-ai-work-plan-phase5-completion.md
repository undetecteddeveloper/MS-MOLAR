# Phase 5 Completion: Real-Content End-to-End Verification & Tone Tuning

Covers Work Plan Phase 5 (Tasks 16-21). **No individual task files were generated for this phase** — see `_overview-engine1-adaptive-ai-work-plan.md`'s "Decomposition Scope Decision — Phase 5 and Final-Phase Tasks 23-27" for the full reasoning (manual Playwright/keyboard/axe passes and a human-judgment tone evaluation produce no `Target Files`/commit unit; this file carries forward each task's exact procedure and pass bar so nothing is lost in the fold).

This entire phase is manual/human-in-the-loop verification work executed by the engineer (with Playwright MCP as an agent-driven tool where applicable) against the real, deployed stack — not agent-completable code implementation.

> **Tooling deviation (recorded, per this repo's own convention)**: the passes below were driven with **`SOURCE/scripts/pw/cli.mjs`** (the repo's Playwright CLI), not the Playwright MCP server named in the Work Plan. Same browser, same engine — the CLI is this project's established token-cheaper substitute. All observations below are from a real Chromium session against `npm run dev` + the **dev** Supabase project (`hynwleaxtbtjzkvpjsug`), 2026-08-15/16.

---

## Run log — 2026-08-15/16

### Task 16 — Seed manual-pass test data ✅ DONE

Landed as a durable, idempotent script: **`SOURCE/supabase/seedManualPassEngine1.ts`** (`npx tsx supabase/seedManualPassEngine1.ts`, `--cleanup` to tear down). It replays `submitExam()`'s steps 3→7 through the real RPCs (`claim_attempt_answer_key` → `attempt_answers` → real `computeScore()` → `record_exam_result` → `record_skill_mastery`); only the Server Action wrapper (rate-limit + redirect) is out of its path, and that wrapper is exercised by Tasks 17-18 in the browser anyway. Fixture exams point at **real** tagged Math questions from the dev corpus, not synthetic ones.

Shared password: `rls-test-password-123`.

| Scenario | Account | Data | Verified |
|---|---|---|---|
| (a) tutor | `smithnguyen247+e1tutor@gmail.com` | `e1mp-exam-tutor`, submitted **twice**, same 2 questions wrong both times, 1 correct as control | 2 questions `hasBeenWrongTwice`, 1 not |
| (b) cold start | `smithnguyen247+e1cold@gmail.com` | 0 submissions | `mastery.length === 0` |
| (c1) prerequisite-gate | `smithnguyen247+e1prereq@gmail.com` | `nguyen-ham` answered wrong | → **Hàm số bậc hai** `[prerequisite-gate]` |
| (c2) lowest-mastery | `smithnguyen247+e1lowest@gmail.com` | `ham-so-bac-hai` answered correct | → **Bất phương trình bậc hai một ẩn** `[lowest-mastery]` |
| (c3) recently-wrong | `smithnguyen247+e1recent@gmail.com` | `he-thuc-luong-tam-giac` answered wrong | → **Hệ thức lượng trong tam giác** `[recently-wrong]` |

The three `reasonCode` expectations are **derived by hand from the DAG** in the script's own `SCENARIOS` comment block (not read back out of `recommendNextSkill()`), then re-checked by the script against the real `skill_nodes`/`skill_prerequisites`/`user_skill_mastery` rows. A mismatch aborts the seed.

Dev corpus state at seed time: 20 skill nodes, 15 prerequisite edges, 35/47 Math questions tagged (**74%**, clears PRD Success Criteria #4's 70% bar).

### Task 17 — Tutor round trip (Verification Strategy's Second Verification Target) ✅ PASS

Route: `/exams/e1mp-exam-tutor/attempt/{attemptId}/result/detail`.

| Claim | Observed |
|---|---|
| Affordance mounts only on wrong-twice questions | Q1 + Q2 (wrong twice) show "Explain this step"; **Q3 (answered correctly) shows none** — AC-024 fail-closed, on real data |
| Busy state | `aria-busy="true"`, `aria-disabled="true"`, **`disabled` property `false`** (never native disabled), spinner icon, sr-only reason `"Getting a hint…"` |
| Hint replaces the button (UI Spec D5) | Button removed from the DOM entirely; no re-invoke control remains for that question in that render |
| Hint renders via `RichText` | LaTeX rendered to real `<math>` elements — proves the sanitized path, not a plain-text one |
| Hint content | Vietnamese, Socratic, never stated the answer (3 hints read in full — see Task 21) |
| **Argument order** (the flagged silent-swap risk) | Dev server log: `explainStep("c5a6ea39-…", "q-t10-3")` = `(attemptId, questionId)` ✔ |
| **AC-025 double-activation no-op** | Two **synchronous** `.click()` calls in one tick → dev server logged **exactly 1** `explainStep` invocation, and `telemetry_log` gained **exactly 1** row. Proven twice over, at two independent layers. |
| Error path (forced by a **real** Gemini 429) | Button re-labels to "Retry", stays focusable (`tabIndex 0`, not natively disabled); `role="alert"` paragraph reads the single generic copy `"Couldn't load a hint. Try again."` — does not disclose which of the 4 codes fired |
| Telemetry shape (AC-013) | Failure row carried `error_code = 'server'` — the closed enum — **not** the raw `"Retryable HTTP Error: Too Many Requests"` message. Real-data proof of the containment claim. |

Round-trip shape matched the frontend DD's Data Contracts assumption exactly — **no escalation needed**.

Latency observed: **7.3s, 7.3s, 22.0s, 23.0s**. See "Findings" below.

### Task 18 — Dashboard ✅ PASS

Route: `/me/dashboard`, one sign-in per fixture account.

| Account | Card label | Disclosure closed by default | Disclosure copy when opened |
|---|---|---|---|
| cold | *(no card body)* — `"Not enough data yet — practise a Math exam to get your first recommendation."` | n/a — **no `<details>` present at all** (populated-only elements provably absent, AC-028) | n/a |
| prereq | `Hàm số bậc hai` | ✔ | "A skill you haven't mastered yet comes before this one." |
| lowest | `Bất phương trình bậc hai một ẩn` | ✔ | "This is the skill you're weakest at right now." |
| recent | `Hệ thức lượng trong tam giác` | ✔ | "You got this one wrong recently." |

All 3 `reasonCode` copies verified **distinct and correct**; labels render verbatim from the DB, never re-derived (AC-031). `SkillRecommendationCard.test.tsx` did **not** need its documented fallback (3/3 green in Phase 4), so this pass is corroboration rather than the sole proof.

`telemetry_log` accumulated **6 × `adaptive_route`, success=true** across these loads — AC-012 on real data.

### Task 19 — Keyboard-only pass ⚠️ PASS, after one fix

| Claim | Observed |
|---|---|
| Tab reaches the affordance | ✔ — position 13 of 15 focusables; tabbing from the preceding link lands on it |
| Enter activates | ✔ → busy |
| Space activates | ✔ → busy |
| Focus retained during busy | ✔ — focus stays on the button (the native-`disabled` bug avoided) |
| Focus never traps | ✔ |
| `<summary>` toggles via Enter/Space | ✔ — natively focusable, Enter opens, Space closes |
| States distinguishable without color | ✔ — idle = lightbulb icon, busy = spinner + sr-only "Getting a hint…", error = **relabelled** "Retry" + alert text, hint-shown = "Hint" eyebrow + panel. All four differ by shape/text, not only by color (AC-026). |

**Defect found and fixed — focus loss on hint reveal.** UI Spec D5 requires the button to be *removed* when the hint appears. Measured on a real keyboard interaction: the removed button was the element holding focus, so the browser dropped focus to `<body>` — the next Tab restarted from the top of the document and a keyboard user could never reach the hint they had just asked for.

Fix (`SOURCE/components/tutor/ExplainStepAffordance.tsx`): the hint panel is wrapped in a `tabIndex={-1}` container that takes focus on mount. `-1` (not `0`) — it receives focus programmatically without adding a permanent stop to the page's Tab order. Locked in by a new assertion inside `ExplainStepAffordance.test.tsx`'s D5 test, so it cannot silently regress.

The wrapper is a plain `<div>` around `BentoCell` rather than a `ref` on `BentoCell` itself: `BentoCell` is polymorphic (`as` = `div|li|section`), so declaring a `ref` prop there makes TypeScript intersect all three elements' prop types and no ref type satisfies all of them. Changing a shared component's API for one local `.focus()` was the wrong trade.

### Task 20 — Manual axe-equivalent pass ✅ PASS — resolves UI Spec TBD-06

ESLint's bundled `jsx-a11y` rules: `npx eslint --max-warnings 0 .` → **clean**.

Contrast measured from **computed styles in the live browser** (not read off the token file), WCAG AA needs 4.5:1 for normal text:

| Surface / state | Element | Ratio |
|---|---|---|
| Affordance — idle | "Explain this step" button | **13.94** |
| Affordance — error | "Retry" button | **13.94** |
| Affordance — error | `role="alert"` paragraph | **6.60** |
| Affordance — hint-shown | "Hint" eyebrow | **5.26** |
| Card — populated | skill label (18px) | **13.94** |
| Card — populated | `<summary>` + reason copy | **5.26** |
| Card — cold start | eyebrow + honest message | **5.26** |

Focus indicator: a **3px ring** appears on the focused control and on it only (verified by comparing every button on the page while one held focus); `:focus-visible` matched on real Tab navigation, so the ring does not fire on mouse clicks.

ARIA semantics walk: `aria-disabled`/`aria-busy`/`aria-describedby` present and correct in every phase; native `disabled` never set; `role="alert"` mounts with the error; disclosure uses a native `<details>`/`<summary>`; the busy announcement rides the changing `aria-describedby` target rather than a competing live region.

**TBD-06 resolved**: no `axe-core`/`jest-axe` dependency added; the metric is this manual pass, following `rating-system-work-plan.md` Task 9's accepted precedent.

### Task 21 — 10-case Socratic-tone evaluation ✅ **10/10 judged**

Harness built and committed: **`SOURCE/lib/tutor/__tests__/toneEval.manual.test.ts`** — 10 fixed cases (5 mcq, 3 true_false, 2 short_answer) whose question text is copied verbatim from the real dev Math corpus, each with a plausible (not random) wrong student answer.

It is a vitest file rather than a `tsx` script because `generateHint()` sits behind `lib/ugc/gemini.ts`'s `import "server-only"`; `vi.mock("server-only")` is this repo's established way through that, already used by five `*.int.test.ts` files. Going that route means the eval calls the **real production function** — same prompt builder, same model (`gemini-3.5-flash`), same deadline, same retry — not a re-implementation.

Off by default; run with `TUTOR_TONE_EVAL=1 npx vitest run lib/tutor/__tests__/toneEval.manual.test.ts`. It writes every hint to `docs/plans/tasks/engine1-adaptive-ai-tone-eval-report.md` (overwritten each run) for the human grader.

**Status:**

- **Run 1 — all 10 cases returned a hint** and passed the machine-checkable gates (non-empty, Vietnamese diacritics present, contains at least one `?`). The report-writing step did not exist yet on that run, so the hint texts were not captured and **no human verdict can be recorded from it**.
- **Run 2 onward — Gemini returned `429 Too Many Requests`** on every call (fast-failing at ~3.3s, classified `server`).
- **2026-08-16, quota diagnosed properly** by reading the raw 429 body instead of the SDK's collapsed message: `quotaId = GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `quotaValue = **20**`, model `gemini-3.5-flash`, resetting at midnight Pacific. A first re-run that morning got 3 more cases through before exhausting the day again. **A 10-case run costs at least half the entire daily allowance**, more when `generateHint()` retries internally — so the eval cannot be run casually, and must not share a day with UGC extraction (same key, same model).
- **3 hints were read in full** during Task 17's browser pass (2 for the parabola-vertex mcq, 1 for the number-of-extrema mcq). All three: Vietnamese ✔, Socratic — led entirely with guiding questions ✔, stated the final answer ✘ (none did; one closed with *"Em hãy thử tính lại hoành độ đỉnh… xem ra kết quả bằng bao nhiêu nhé!"*).

**2026-08-17 run** (`TUTOR_TONE_EVAL=1 npx vitest run lib/tutor/__tests__/toneEval.manual.test.ts`, started 21:44 local / 14:44 UTC — well past the midnight-Pacific reset, so the day's 20-request budget was fresh going in): **7/10 cases returned a hint** and were judged from `engine1-adaptive-ai-tone-eval-report.md`'s captured text. The other 3 failed mid-run — case 03 at 30.0s (`Service Unavailable`, `classifiedAs: server`), cases 06 and 07 at 14.7s/3.4s (`Too Many Requests`) — i.e. the run itself exhausted the remaining daily quota partway through, the same failure shape as the 2026-08-16 runs. Case 03 already had a verdict from the Task 17 browser pass, so only **06 and 07 remain ungraded**.

**Closed 2026-08-18.** Two separate runs, same morning (fresh daily quota, ~15 min apart): the full 10-case run cleared case 06 before quota ran out again on 08-10 (already graded from the 2026-08-17 run); a second run filtered to just case 07 (`npx vitest run ... -t "07"`, one request instead of re-spending the other nine) cleared the last case. Passing bar met in full: 10/10 Vietnamese, 10/10 Socratic form, 0/10 state the final answer — no prompt retune was triggered.

| # | Case | Type | Vietnamese | Socratic | States final answer |
|---|---|---|---|---|---|
| 01 | tập xác định | mcq | Y | Y | N |
| 02 | phương trình bậc nhất | mcq | Y | Y | N |
| 03 | đỉnh parabol | mcq | Y | Y | N |
| 04 | số điểm cực trị | mcq | Y | Y | N |
| 05 | tập nghiệm bậc hai | mcq | Y | Y | N |
| 06 | khảo sát parabol | true_false | Y | Y | N |
| 07 | nguyên hàm | true_false | Y | Y | N |
| 08 | tính đơn điệu | true_false | Y | Y | N |
| 09 | đạo hàm tại một điểm | short_answer | Y | Y | N |
| 10 | diện tích hình chữ nhật | short_answer | Y | Y | N |

*(Row 03 filled from the Task 17 browser pass — the same code path, judged by eye on real output. Rows 01/02/04/05/08/09/10 filled 2026-08-17 from the harness's captured report text. Rows 06/07 filled 2026-08-18, same method, once the daily quota reset.)*

### Quality check (staged) ✅ ALL GREEN

```
npx vitest run          → 69 passed | 1 skipped (70 files); 657 passed | 10 skipped (667 tests)
npx tsc --noEmit        → clean
npx eslint --max-warnings 0 .  → clean
npm run build           → success
```

(The 1 skipped file / 10 skipped tests are the tone-eval harness, correctly gated off without `TUTOR_TONE_EVAL=1`.)

---

## Findings carried forward

1. **Tutor latency drifted 7s → 23s within one session** against a 30s `TUTOR_CALL_DEADLINE_MS`. Not a failure — every call completed — but the margin is 7s, not the 10× the deadline comment assumes when reasoning about the *platform* limit. Feed this into Task 24's risk walk rather than treating "Vercel duration" as closed on paper alone.
2. **🔴 The Gemini key allows 20 tutor calls per DAY, project-wide — this is a ship blocker, not a testing nuisance.** Measured from the 429 body: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `quotaValue = 20`, model `gemini-3.5-flash`. That ceiling is not scoped to the eval harness — it is the ceiling on the **Socratic tutor feature in production**: roughly 20 hints per day across *all* users, on the same key UGC extraction already draws from. Once spent, every student who clicks "Explain this step" gets the generic error state for the rest of the day, and `telemetry_log` fills with `error_code='server'` rows that look like an outage rather than a budget. Nothing in the PRD, either Design Doc, or `rateLimit.ts` accounts for this — `RATE_LIMITS.explainStep` is 20/hour *per user*, i.e. a single user can exhaust the entire project's daily allowance in one hour. **Needs an explicit decision before ship** (paid tier / different model / a project-wide budget guard / gate the feature), recorded at Task 24 as either a resolved item or a consciously accepted residual — not discovered in production.

   > **Decision taken 2026-08-16 — this finding is answered, do not re-open it as undecided.** Two parts. (a) `e8d91a4` moved `RATE_LIMITS.explainStep` to `{ limit: 3, windowMs: 24h }`, so the sentence above (`20/hour per user`) no longer describes the code. The substantive fix was the **unit**: an hourly window cannot bound a daily quota at any `limit`, since 3/hour is still 72/day for one person. `rateLimit.test.ts` now partitions `RATE_LIMITS` into DB-cost vs supplier-capped actions and asserts `windowMs === 24h` for the latter, so a future action added without classification turns the suite red. (b) The **aggregate** axis — no project-wide counter; 7 users × 3 still exceeds 20 — is consciously accepted and owned by the Subscription feature, where the ceiling becomes a per-plan entitlement (see `docs/prd/subscription-prd.md` R5/R7, which already cites this interim `3` as its starting point). Tracked as Finding Q-1 in `-phase6-completion.md`.
3. **Prod has the Engine 1 tables but none of the Engine 1 content.** `pebjdlbgbmizgfpuptjl` (MS-MOLAR-prod) reports `skill_nodes = 0`, `skill_prerequisites = 0`, tagged questions `= 0`. The 2026-08-15 schema migration created the tables; nobody ran `seedSkillTaxonomy.ts` or `tagQuestionSkills.ts --apply` against prod. **On prod today the dashboard card would show cold-start to every user, forever, and no mastery row could ever be written** (every question's `skill_node_id` is NULL). This belongs in Task 22 alongside the DDL apply — schema parity is necessary but not sufficient here.
4. **`telemetry_log.skill_node_id` is always NULL for `tutor_invoke`.** Verified deliberate, not a defect: `tutorActions.ts` explicitly does not read `skill_node_id` (AC-029 + the sprint invariant that the column never crosses the SQL→TS boundary). Recorded so Task 26's AC walk does not re-open it.

## Phase Completion Criteria (verbatim from Work Plan)

- [x] Both DDs' Early Verification Points passed on the real, deployed stack
- [x] PRD Success Criteria #9, #10, and UI Quality Metrics 1-2 satisfied with recorded evidence — **#9 closed 2026-08-18 (10/10 cases judged, all clean); UI Quality Metrics 1-2 satisfied (Tasks 19-20)**
- [x] UI Spec TBD-06 resolved (downgraded to manual pass, recorded here)

## Verification Commands

```
npm run dev   # local session for all manual/Playwright passes
cd SOURCE && npx tsx supabase/seedManualPassEngine1.ts      # Task 16 fixtures
cd SOURCE && node scripts/pw/cli.mjs goto <url>             # browse; `close` when done
cd SOURCE && TUTOR_TONE_EVAL=1 npx vitest run lib/tutor/__tests__/toneEval.manual.test.ts
cd SOURCE && npx vitest run
cd SOURCE && npx eslint --max-warnings 0 .
cd SOURCE && npx tsc --noEmit
```

## Next Phase Gate

Final Phase (backend-task-14 / Task 22) depends on this phase's Task 21 (10-case tone eval) per the work plan's own Task Dependency Diagram (`T21 --> T22`), in addition to Phase 1's `test-rls.ts` (Task 2) and `tagQuestionSkills.ts` (Task 6). **Task 21 closed 2026-08-18** — all 10 cases judged, all clean on the bar. Task 22 additionally inherits Finding 3 above: the prod apply is a *schema + content* step, not schema alone.
