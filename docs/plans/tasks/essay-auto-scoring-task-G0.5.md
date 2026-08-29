# Task G0.5 — TD-030 baseline capture

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase 0, Task G0.5**
Layer: **process gate** (test-lane baseline; Gate F1 of the work plan is edited)
Status: ✅ **DISCHARGED 2026-08-29 (Gate F1).** TD-030 baseline is exactly **2 failures**, both `subscription.fixture.e2e.test.ts` FE-1(e) (`en`, `vi`). Anything beyond those two belongs to this feature. This file is the record of that discharge, not open work.

Metadata:
- Owner: engineer / any executor — this one **is** agent-executable (it is a command run, not an external-system decision).
- Dependencies: none.
- Blocks: nothing formally, **but it must be done before the first commit or Gate E5's exit code is uninterpretable.** Task H1 names it as a dependency for exactly that reason.
- Provides: the exact failing case names and failure count in Gate F1, against which every later run of the fixture lane is compared.
- Size: documentation only (Gate F of the work plan).

## Implementation Content

Run `npm run test:fixture` on the current tree; record the exact failing case names and the failure count in Gate F1; confirm the two failures are the `subscription.fixture.e2e.test.ts` FE-1(e) `en`/`vi` cases **and nothing else**.

### Recorded baseline (2026-08-29, from the run that gated commit `3c66df1`)

`npm run test:fixture` on the current tree: **exit code 1**, `Test Files 1 failed | 1 skipped (2)`, `Tests 2 failed | 75 passed | 3 todo (80)`.

The **exact** two failing cases, both in `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts`, both under the describe `FE-1 (e) legalContentReady === false leaves an inert but reachable confirm control`:

1. `locale en — aria-disabled, no native disabled, Tab-reachable, no action`
2. `locale vi — aria-disabled, no native disabled, Tab-reachable, no action`

Both assert `aria-describedby` points at the Confirm control's reason box and receive the Recheck control's reason box instead (`…:3017`). Logged as **TD-030**; unrelated to essay grading. **Nothing else is red in this lane. Any third failing case is this feature's.**

### F2 — how to tell a new failure from TD-030, in order
1. Remove your new/changed fixture file from the tree and re-run the lane. If the same two `subscription.fixture.e2e.test.ts` cases are still red and nothing else is, it is TD-030.
2. `git checkout main` (**stash first** — `git status` before any destructive command) and re-run the lane. Two red cases there confirms the baseline.
3. Anything red **beyond** those two cases is yours.

### F3 — two things this feature must not do
- Do **not** "fix" TD-030 inside this feature's commits.
- Do **not** add `essay-auto-scoring.fixture.e2e.test.ts` to `vitest.fixture.config.ts:45-52`'s exclude list — being excluded is how a case gets written, reviewed and merged without ever executing.

## Target Files
- [x] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate F item F1 (count and exact case names recorded)
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate F item F2 (tick once the discrimination procedure has been walked once, so it is known to work)

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate F — `npm run test:fixture` is RED on `main` before this feature starts)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (the describe `FE-1 (e) …`, and the assertion at `:3017`)
- `SOURCE/vitest.fixture.config.ts` (the lane's directory glob; the exclude list at `:45-52` — **not** to be extended)
- `SOURCE/package.json` (the `test:fixture` script)
- `TECH-DEBT.md` (TD-030)

## Investigation Notes
- The baseline was captured from the run that gated commit `3c66df1`.
- `Tests 2 failed | 75 passed | 3 todo (80)` — the 3 `todo` are the essay fixture skeleton's FE2E-1…FE2E-3, which Tasks F-C3 and F-C4 convert. They are `it.todo` on purpose: without them the lane reports "No test suite found in file" and exits 1.

## Implementation Steps
### 1. Capture (complete)
- [x] Run `npm run test:fixture` from `SOURCE/` on the current tree and read its **real exit code**
- [x] Record the exit code, the file/test counts and the two exact case names in Gate F1
- [x] Confirm nothing else in the lane is red

### 2. Walk the discrimination procedure once (F2)
- [ ] Walk F2 steps 1–2 once so the procedure is known to work, and tick F2

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: the fixture-e2e lane (in-process real route tree, stubbed data sources) — Config: `SOURCE/vitest.fixture.config.ts`; covers `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` — **lane already red, see Gate F**

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer — a chain that "looked green" is how TD-030 stayed hidden.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording Gate F1 still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: run `npm run test:fixture` from `SOURCE/` and read its **real exit code** and its case-level output; compare the recorded baseline against every later run of the lane.
- **Success criteria**: Gate F1 carries the exit code, the counts and the two exact case names; a later run showing exactly those two failures is TD-030, and anything red **beyond** them is this feature's.
- **Failure response**: if the current tree shows more or fewer than the two recorded failures, the baseline has moved — re-capture it and record the change before the first feature commit, because Gate E5's exit code is otherwise uninterpretable.
- **Verification level**: L2 (a real test-lane run, read by exit code).

## Proof Obligations
- **Claim**: the fixture lane's red state before this feature starts is exactly two known cases, so any third red case during the feature is attributable.
- **Primary failure mode**: an implementer reads the pre-existing red lane as their own breakage and "fixes" TD-030 inside a feature commit — or, worse, reads a genuinely new failure as "the lane was already red" and ships it.
- **Boundary to exercise**: the `npm run test:fixture` process boundary — a real lane run, read by exit code, not inferred from an `&&` chain.
- **State assertion**: N/A (no persisted state).
- **Mock boundary rationale**: none — the lane runs as it ships.
- **Residual**: proves the baseline on this tree at this commit. It does not prove the two cases stay the only failures; that is why F2's discrimination procedure exists and is walked per suspicious run.

## Completion Criteria
- [x] **Implementation Complete** = Gate F1 filled in (exit code, counts, both exact case names)
- [ ] **Quality Complete** = the discrimination procedure in F2 has been walked once so it is known to work
- [ ] **Integration Complete** = N/A
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: makes Gate E5's exit code interpretable for every commit in this feature.
- Scope boundary: `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` and `SOURCE/vitest.fixture.config.ts` are **not** modified by this feature (Gate F3).
- The 6-command verify gate exists because `npx vitest run` collects only the default config's `lib/**`, `components/**`, `app/**` — three other lanes can stay red indefinitely while every commit "passes the gates". That is exactly what TD-030 was.
