# Task E6 — Enable the flag, and confirm the enabled state on prod

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E6**
Layer: **deployment configuration** (no repository file)

Metadata:
- Owner: **engineer**.
- Dependencies: **Tasks E1, E2, E3, E4, E5** — and every implementation phase merged.
- Blocks: the **Final Phase**'s post-enable checks.
- Provides: the feature actually grading real student writing, plus a **verified** kill-switch cycle.
- Size: configuration only.
- Verification level: **L1** — one real graded attempt on prod, end to end.

## Change Category
`Change Category: state-change`

Turning the flag on changes what `submitExam()` **persists** for **new** submissions. Adjacent cases swept: all three read sites (they read **one** variable and must flip in the **same deploy**), and the already-graded attempts whose keys must keep rendering after the switch is turned off again.

## Implementation Content

Set `ESSAY_GRADING_ENABLED=true` (**trimmed**) in the Vercel **Production** scope and redeploy.

Confirm **all three read sites flipped in that one deploy**:
1. `submitExam()` emits keys and registers the pass;
2. `retryEssayGrading()` reaches the provider;
3. the player footnote shows `player.essayScored`.

Then submit **one real attempt containing at least one essay** and confirm end to end: the result page shows "Đang chấm", the band lands, the score line updates, the PDF unblocks, and `telemetry_log` carries an `essay_grade` row.

### Kill switch, verified rather than assumed
Set the variable to anything other than `"true"` (or delete it) and redeploy. Confirm **every consequence is "do nothing"**:
- `computeScore()` stops emitting keys for **new** submissions (essays fall into RS-0, the existing shared branch, printing `result.notAutoScored` — **byte-identical to today**);
- `after()` is **not** registered (0 Groq requests, 0 budget reservations);
- the player footnote reverts to `player.essayNotScored`;
- the poller does **not** mount;
- the PDF block never closes;
- `/history` shows no marker;
- **attempts already graded keep their keys and continue rendering normally** — the flag controls emitting **new** keys, not reading **old** ones, which is what makes the switch safe: **turning it off deletes nobody's result.**

### The one asymmetry, and it is not a bug
An attempt submitted **while enabled** whose pass is cut off before finishing leaves questions `pending` **forever**, and the read-time deadline presents them as "Chấm thất bại" with an **unusable** retry button. That is correct behaviour under W6 (no background writer cleans it), and it is one more reason turning the flag off is **a deliberate decision rather than a hurried config edit**.

## Execution log — 2026-08-30

### Done
- **Merged to `main`.** PR #1 (`https://github.com/undetecteddeveloper/MS-MOLAR/pull/1`), 74 commits, 144 files, merge commit **`e0f4faf`**. Merged with the head SHA pinned, so a drifted head would have failed loudly rather than merging something unreviewed.
- **Production deploy `dpl_5YDSEvfBCZcVamCbz5GpMUyu5xSD` reached `READY`**, target `production`, region `sin1`, aliased to `ms-molar.vercel.app`.
- **Verified `main` actually carries the feature**, rather than assuming the merge did what it said: `player.essayScored` and `upload.essayScored` are both present in `en.ts`, `QuestionRenderer.tsx` references `essayGradingEnabled` three times, and `origin/main..branch` is **0 commits**.
- The engineer had set `ESSAY_GRADING_ENABLED` and `GROQ_BUDGET_DAILY_LIMIT` in the **Production** scope before this deploy, so this build carries both.

### Why the earlier attempt appeared to do nothing
The engineer set both variables and redeployed **before** the merge. That deploy built `main`, which at the time did not contain the feature at all — its `en.ts` had only `player.essayNotScored` and its `QuestionRenderer` had no flag prop. **Setting the variables changed nothing because there was no code reading them.** Worth recording as the shape of the design working: production was *structurally* incapable of grading, not merely configured not to.

### Steps 3 and 4 — CONFIRMED 2026-08-30

**Step 3 (three read sites flipped): confirmed by the engineer** on the live site after the merge deploy — the player footnote reads the flag-on string. The earlier appearance of "nothing happened" was the pre-merge deploy, explained below.

**Step 4 (one real attempt end to end): confirmed by READ-ONLY QUERY against production**, not by report — the distinction matters, because "it looks like it's working" and "a band was written correctly" are different claims:

| probe (prod `pebjdlbgbmizgfpuptjl`) | result |
|---|---|
| `telemetry_log` rows with `event_type = 'essay_grade'` | **2**, `success` on both, **0** failed |
| latest grade | 2026-08-30 12:44:54 UTC |
| `exam_results` rows carrying essay lifecycle keys | **1** |

Both essay elements settled **`graded`** — terminal, so both contribute to earned and max (EG-BE-027).

**An apparent anomaly that turned out to be the design working.** The two elements carry a *different number of keys* — 10 and 9 — and different attempt counts:

- `…-p2q1`: 10 keys, `essayAttempts: 1`, `selected` present (5 chars). A real answer, one provider call, band 0.
- `…-p2q2`: **9 keys**, **`essayAttempts: 0`**, **`selected` absent**.

The missing key is `selected`, and its absence means the question was **skipped**. `essayAttempts: 0` is then exactly right: the empty-answer path settles band 0 **with no claim and no provider call** (Task B1.4), so no attempt is consumed. Nothing is malformed — a skipped question has always lacked `selected`, and that is not essay-specific. Recorded because a future reader running this same probe will see 9-vs-10 and needs to know it is not drift in the W1 shape.

### Step 5 — NOT done
The kill-switch rehearsal has not been performed. It is the one part of E6 still open, and it is the part that proves turning the feature **off** is safe — specifically that **already-graded attempts keep rendering their bands**, because the flag gates emitting *new* keys, not reading *old* ones.

### Superseded — the block that stopped the first attempt
Steps 3 (three read sites flipped), 4 (one real attempt end to end) and 5 (kill-switch rehearsal) are **not done**, and must not be recorded as done.

The attempt to verify the footnote on production failed at sign-in: the test account `smithnguyen247+rlstesta@gmail.com` returns **"User is banned"** on the production project. It exists on dev, where the whole `L1` run was performed, but is not usable on prod. No other account was tried — the two real accounts are the engineer's own and are explicitly not to be touched.

**So what is proven is that the CODE is deployed, not that the FLAG took effect.** Those are different claims and the difference is exactly the one E6 exists to check.

**To finish, the engineer needs to either** un-ban the test account on the production Supabase project, or perform steps 3-5 personally with an account they control. The tell for step 3 is the player footnote reading *"Essay — auto-scored after you submit."*; if it still reads the old sentence, the variable is not reaching the build, and the thing to check is that `ESSAY_GRADING_ENABLED` is exactly lowercase `true` with no trailing space — `"TRUE"` and `"1"` both read as **off** with an identical symptom.

### Carried into this task from E5, still undecided
TPM 8 000 puts a 50-essay exam at ~5.5 minutes against `ESSAY_PASS_BUDGET_MS` of 4 minutes, so one full essay exam cannot finish in a single pass on the `on_demand` tier. The lifecycle handles it correctly (unresolved becomes retryable, never a wrong band), but the feature is now **live for real students** with that property in place.

## Target Files
- [ ] Vercel **Production** environment: `ESSAY_GRADING_ENABLED` (engineer-owned; no tracked file)
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Phase E progress notes and the kill-switch confirmation

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate A; § Phase E, Task E6; § Notes — "What 'done' does not mean")
- `SOURCE/app/(layer2)/actions.ts` (Task B1.5 — read site 1, `submitExam()`)
- `SOURCE/app/(layer2)/essayActions.ts` (Task B3.2 — read site 2, `retryEssayGrading()`)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/page.tsx` (Task F-D1 — read site 3, the copy gate)
- `SOURCE/lib/env/checkEnv.ts` (Task H4 — the variable registered at level `warn`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `deriveEssayView()`, which is what makes an interrupted pass present as failed rather than pending forever)
- `SOURCE/lib/tutor/telemetry.ts` (Task B3.1 — the `essay_grade` event type to look for in `telemetry_log`)

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop |
|---|---|
| Owner (left) | **Vercel** / `.env.local` |
| Owner (right) | `submitExam()` (behaviour gate), `retryEssayGrading()` (behaviour gate), the player route segment (copy gate) → `ExamPlayer` → `QuestionRenderer` |
| Serialized format | Env string; **only** `"true"` (trimmed) means on. Crosses the server/client boundary as a pre-read boolean prop, **never** `NEXT_PUBLIC_*` (UI-D7) |
| Consumer parse rule | The client component treats an absent prop as `false` and selects `player.essayNotScored` |
| Expected signal | **All three read sites flip in one deploy** |

## Investigation Notes
_(Record here: the deploy id and date; the three read sites' observed behaviour after the flip; the real attempt's end-to-end trace; the kill-switch cycle's observed consequences.)_

## Implementation Steps
### 1. Enable
- [ ] Confirm Tasks E1–E5 are all discharged and recorded
- [ ] Set `ESSAY_GRADING_ENABLED=true` (**trimmed**) in the Vercel **Production** scope and redeploy
- [ ] Confirm **all three** read sites flipped in that one deploy

### 2. Confirm end to end on prod
- [ ] Submit one real attempt containing ≥1 essay
- [ ] Observe: "Đang chấm" → the band lands → the score line updates → the PDF unblocks
- [ ] Confirm `telemetry_log` carries an `essay_grade` row

### 3. Verify the kill switch
- [ ] Set the variable to anything other than `"true"` (or delete it) and redeploy
- [ ] Confirm **each** of the seven consequences listed above, including that **already-graded attempts keep their keys and continue rendering**

## Quality Assurance Mechanisms
- `checkEnv.ts` startup validation — Enforces: the variable is registered at level `warn`; an environment with grading off is a **fully valid** environment — Config: `SOURCE/lib/env/checkEnv.ts`
- `telemetry_log` CHECK constraints — Enforces: `event_type = 'essay_grade'` is accepted only because H5/H7 widened the CHECK — Config: `schema.sql:1383` + the new `event_type` drop/add pair
- Manual/Playwright MCP visual verification — Enforces: the enabled and disabled states on the four affected screens — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`

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

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording the enablement evidence still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: one **real** attempt on prod, traced end to end; then a **full kill-switch cycle** with each consequence confirmed individually.
- **Success criteria**: all three read sites flipped in one deploy; the real attempt shows "Đang chấm", lands a band, updates the score line, unblocks the PDF, and writes an `essay_grade` telemetry row; the kill-switch cycle confirms all seven "do nothing" consequences, **including that already-graded attempts keep rendering**.
- **Failure response**: if only some read sites flipped, they are not reading one variable — check for a stray `NEXT_PUBLIC_*` copy (UI-D7 forbids it). If the telemetry row is rejected, the `event_type` CHECK was not widened on prod — return to Task H7; the write is best-effort, so **the failure is silent** and must be checked deliberately.
- **Verification level**: **L1** — one real graded attempt on prod plus one verified kill-switch cycle.

## Proof Obligations
- **Claim (AC-001 confirmed on prod)**: `submitExam()` emits **zero** grading requests synchronously.
  - **Primary failure mode**: reading this task as where AC-001 is *built* — it is not; **B1.5 is the code and B1.6 is the assertion**. Here it is only **confirmed**.
  - **Boundary to exercise**: the real production request path. **State assertion**: the attempt's `per_question` after submit carries the five keys with `essayState: "pending"`. **Mock rationale**: none. **Residual**: the automated claim lives in INT-1.
- **Claim (the kill switch, Failure Mode Checklist: rollback-only visibility)**: clearing the flag stops **new** key emission but **never removes keys already written**, so already-graded attempts keep rendering.
  - **Primary failure mode**: assuming the switch is symmetric. It is not: **an attempt submitted while enabled and cut off before the pass finishes stays `pending` forever and is presented as failed with an unusable retry button.** That asymmetry is correct under W6 and is why turning the flag off is a deliberate decision, not a hurried config edit.
  - **Boundary to exercise**: a real deploy cycle on prod, with each of the seven consequences observed.
  - **State assertion**: before → graded attempts render bands; action → flag cleared and redeployed; after → **the same attempts still render bands**, while new submissions emit no keys.
  - **Mock boundary rationale**: none — this is the real deployment.
  - **Residual**: the rehearsal of the other two rollback levels (remove the poller; revert the whole slice) is the **Final Phase**'s.
- **Claim (AC-061, AC-023, AC-028, AC-047, AC-057, AC-064, AC-072 — confirmed here, built elsewhere)**: each is observed in the enabled state on prod.
  - **Primary failure mode**: treating this task as where any of them is implemented. The PRD-AC traceability table's `corrected` rows exist precisely because a mechanical inversion put AC-001, AC-011, AC-020, AC-028 and AC-053 on this task. **The task text wins; this is confirmation, not construction.**
  - **Boundary to exercise**: the four affected screens plus `telemetry_log` on prod. **State assertion**: N/A beyond the above. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] `ESSAY_GRADING_ENABLED=true` set in the Vercel **Production** scope and redeployed
- [ ] All three read sites confirmed flipped **in that one deploy**
- [ ] One real graded attempt end to end on prod, with an `essay_grade` telemetry row
- [ ] One **verified** kill-switch cycle, with all seven consequences confirmed — including that already-graded attempts keep rendering
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: production behaviour for every new submission containing an essay.
- Scope boundary: no code change. The kill switch is a configuration change, and the safety property it relies on — the flag controls emitting **new** keys, not reading **old** ones — is structural, not remembered.
- **The one asymmetry is not a bug**: an interrupted pass leaves questions `pending` forever, presented as failed with an unusable retry button (W6 — no background writer).
