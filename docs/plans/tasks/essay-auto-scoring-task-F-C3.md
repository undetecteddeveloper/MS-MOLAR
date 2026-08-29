# Task F-C3 — Convert FE2E-1 and FE2E-3

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-C (Interaction and fixture-e2e, frontend slices V4 + V5), Task F-C3**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**` — the fixture-e2e lane renders React route trees)

Metadata:
- Dependencies: **Task F-B3**, **Task F-C2**.
- Blocks: **Task F-C4** (same file, shared fake-clock harness) and **Task F-D1**.
- Provides: the shipped-state journey and the two-door PDF guard as automated claims, plus **the per-`describe` fake-clock scoping F-C4 depends on**.
- Size: Small (1 file, two describes)
- Verification level: **L2** — the fixture lane green apart from the recorded TD-030 baseline.

## Implementation Content

Convert two of the three cases in `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts`.

Both take the shape of the only case in that directory that **actually executes** (`subscription.fixture.e2e.test.ts`): an **in-process render of the real route tree** (RootLayout → route-group layout → page), with only the **action module and the data sources stubbed** — **real dictionaries, no MSW, no database, no network**.

*(The six sibling driver scripts in that directory are written against a structural subset of Playwright's API and **nothing executes them**; the repo has no `@playwright/test` and no `playwright.config.ts`.)*

### Two hazards, handled explicitly
1. **The empty-tree vacuous pass** — every case rendering `EssayScoreLine` or `EssayReviewBlock` must use `renderServerTree()` from `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx` (**not** `SOURCE/lib/test/renderServerTree.tsx`, which **does not exist**) **and** carry at least one **positive** assertion.
2. **Fake/real timer collision in one file** — FE2E-2 needs fake timers, FE2E-3 must **not** have them; a file-level fake clock **hangs** FE2E-3's menu interactions.

### Deliverable of this task, not a note for later (I009)
**The per-`describe` fake-clock scoping is established here.** This task writes both the FE2E-1 describe (which needs a fake clock for its zero-timers assertion) and the FE2E-3 describe (which must run on **real** timers), each with its **own** `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => { cleanup(); vi.useRealTimers(); })` where applicable, and **no file-level clock setup**. Task F-C4 then **adds** the FE2E-2 describe into that already-correct structure rather than having to introduce it — which is why F-C4 depends on this task even though the two convert different cases.

### Ordering with F-C4 (I009)
This task and F-C4 rewrite the **same file** and share the fake-clock hazard. **This one goes first** and establishes the scoping; F-C4 depends on it. Working them in parallel means two edits to one file with a shared, order-sensitive harness concern.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (FE2E-1 and FE2E-3 describes)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (the committed skeleton — FE2E-1 and FE2E-3's `Primary failure mode` / `Proof obligation` annotations)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (the **only** executing case in that directory — the shape to copy; also the file carrying the two TD-030 failures)
- `SOURCE/vitest.fixture.config.ts` (the lane's glob; the exclude list at `:45-52` — **must not be extended**, Gate F3)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayScoreLine — verify the not-rendered state)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change) — FE2E-1(f) automates the 0-diff declaration)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRowMenu (PDF blocked state) — verify default + blocked states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRow (đang chấm marker) — verify default + partial states)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — the three surfaces that must respect mutable result rows)
- `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx` (`:4-10` the empty-tree failure mode; `:25` the helper)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` and `…/result/detail/page.tsx` (the real route trees this lane renders)
- `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` and `SOURCE/components/history/HistoryRowMenu.tsx` (Task F-B3 — the `/history` door)
- `SOURCE/lib/i18n/dictionaries/vi.ts` (Task F-A1 — the **real** dictionary these cases resolve strings from)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| frontend DD (§ FE-AC-21) | state-lifecycle-negative | "Ở **mọi** trạng thái của tính năng, **PHẢI KHÔNG** có phần tử nào trong cây tự luận mang thuộc tính `disabled`, và **PHẢI KHÔNG** có chuỗi hiển thị nào chứa một con số lượt chấm còn lại." | FE2E-3(b) asserts `hasAttribute("disabled") === false` for **every** element in the essay subtree |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010) | persistence | `exam_results` rows are no longer immutable after insert. Three surfaces must respect that: PDF export is blocked while any essay is unresolved; `ScoreCard`/`/history` show a "đang chấm" marker instead of a number about to change — on a separate labelled line, with `ScoreCard` a 0-diff zone; any future result-row cache must key on something that moves when a band lands | FE2E-3 asserts both doors blocked and the `/history` badge present; FE2E-1(f) asserts `ScoreCard`'s 0-diff |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop |
|---|---|
| Consumer parse rule | The client component treats an absent prop as `false` and selects `player.essayNotScored` |
| Expected signal | **FE2E-1: no essay node, no timer, zero refreshes** |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayScoreLine — verify the not-rendered state)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: ScoreCard (unchanged — explicit non-change) — verify all states render as today)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRowMenu (PDF blocked state) — verify default + blocked states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: HistoryRow (đang chấm marker) — verify default + partial states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: usePdfAction (PDF export guard) — verify the blocked state on both doors)

## Investigation Notes
_(Record here: the per-`describe` clock setup as written, and the confirmation that there is **no** file-level `vi.useFakeTimers()`; the independently authored ScoreCard literal used in FE2E-1(f); the fixture lane's post-change result.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, especially the skeleton's annotations and `subscription.fixture.e2e.test.ts`'s shape
- [ ] Establish the **per-`describe`** clock scoping: FE2E-1's describe gets its own fake clock; FE2E-3's describe runs on **real** timers; **no file-level setup**
- [ ] Write FE2E-1 (a)–(f) and FE2E-3 (a)–(e); observe failure

### 2. Green Phase
- [ ] Bring both describes green with `renderServerTree()` where an async child exists and a positive assertion in every case
- [ ] Run `npm run test:fixture` and confirm **only** the two recorded TD-030 failures remain

### 3. Refactor Phase
- [ ] Confirm there is **no** file-level `vi.useFakeTimers()` — F-C4 will add its describe into this structure
- [ ] Confirm `essay-auto-scoring.fixture.e2e.test.ts` was **not** added to `vitest.fixture.config.ts:45-52`'s exclude list (Gate F3)
- [ ] Confirm every case carries at least one positive assertion

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: the fixture-e2e lane (in-process real route tree, stubbed data sources) — Config: `SOURCE/vitest.fixture.config.ts`; covers `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` — **lane already red, see Gate F**
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | **this task's primary gate** — expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi`. **Anything red beyond those two is this feature's** |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` from `SOURCE/`, read by **real exit code**; then apply Gate F2's discrimination procedure to any failure beyond the recorded baseline.
- **Success criteria**: `npm run test:fixture` shows **only** the two recorded TD-030 failures; both describes execute; per-`describe` clock scoping is in place with **no** file-level timer setup.
- **Failure response**: if a third case is red, apply Gate F2 in order — (1) remove your new/changed fixture file and re-run; (2) `git checkout main` (**stash first**, `git status` before any destructive command) and re-run; (3) anything red **beyond** those two is yours. **Do not "fix" TD-030 inside this feature's commits, and do not add this file to `vitest.fixture.config.ts:45-52`'s exclude list** — being excluded is how a case gets written, reviewed and merged without ever executing.
- **Verification level**: **L2**.

## Proof Obligations — FE2E-1 (the shipped state)
With a stubbed `getResult()` returning a **legacy** `ExamResult` (no `essay*` keys anywhere, `essaySummary === undefined`, every `PerQuestionResult.essay === undefined`), render the real `/result` and `/result/detail` trees.

- **(a) Positive first** — the ScoreCard's score text and the essay card's `result.notAutoScored` string are **both found by `getByText`**; **every negative assertion below is meaningful only after this passes**.
  - **Primary failure mode (R-F2)**: an empty tree, where every negative assertion passes against nothing. **Boundary**: the real route tree in-process, via `renderServerTree()`. **State assertion**: N/A. **Mock rationale**: only the action module and the data sources are stubbed; dictionaries are real. **Residual**: none.
- **(b)** **None** of the badge strings resolved from the **real** dictionary (`result.essay.state.pending` = "Đang chấm", `.graded` = "Đã chấm", `.failed` = "Chấm thất bại") and none of `result.essay.label`, `.points`, `.denominator` appear anywhere — **assert on resolved strings, not on component names or test ids**.
  - **Primary failure mode**: asserting on a component name, which passes even when the string leaks through another path. **Boundary**: as above. **Residual**: none.
- **(c)** **Zero timers and zero refreshes** — `vi.getTimerCount()` is 0 immediately after render, advancing 200 000 ms schedules nothing, and the counted `refresh` mock has 0 calls. *(This is the F-09 three-part promise, and the one place FE2E-1 needs a fake clock — **keep it inside this describe**.)*
  - **Primary failure mode**: the poller mounting in the shipped state, so a disabled feature still costs the student requests. **Boundary**: as above with a describe-scoped fake clock. **State assertion**: N/A. **Residual**: bundle size is deliberately **not** asserted (the "0 bytes of JS" claim is withdrawn).
- **(d)** The essay card is the **unchanged shared branch** — "Bạn trả lời:" and "Đáp án đã lưu:" both present, `result.notAutoScored` present, and **no** correct/incorrect chip.
  - **Primary failure mode**: the new sub-branch altering RS-0/RS-1. **Boundary**: as above. **Residual**: none.
- **(e)** Both PDF controls carry `aria-disabled="false"` and the reason element they point at does **not** contain `result.essay.pdfBlocked`.
  - **Primary failure mode**: the guard blocking exports in the shipped state. **Boundary**: as above. **Residual**: none.
- **(f) ScoreCard 0-diff** — the ScoreCard subtree's rendered text equals an **independently authored literal** (score to one decimal + "/10", "Đúng" = correct, "Sai" = total − correct) computed **from the fixture by hand**. **This is the automated half of the 0-diff declaration.**
  - **Primary failure mode**: a `ScoreCard` change riding along unnoticed — **any diff in that file is a regression**. **Boundary**: as above. **Residual**: the pixel half stays with the manual screenshot comparison (Task F-A3, Final Phase).

## Proof Obligations — FE2E-3 (one attempt, two PDF doors, one answer)
Render the real `/result` tree **and** the real `/history` row from fixtures describing **one** attempt with an unresolved essay. **This describe runs on real timers.**

- **(a) Positive first** — the attempt's score text found on `/result` and the row's meta line found on `/history`.
- **(b) Same answer, both doors** — on each screen every PDF control has `aria-disabled="true"`, has **no** `disabled` attribute (assert `hasAttribute("disabled") === false` for **every** element in the essay subtree, per FE-AC-21), is **keyboard-reachable** (after `.focus()`, `document.activeElement` is that node), and its `aria-describedby` resolves to an element whose text is `result.essay.pdfBlocked`.
- **(c)** Pressing either produces **zero** `generateAttemptPdfFile` calls, **no** busy phase, and **no** `role="alert"` node.
- **(d)** "Xem chi tiết" is **not** blocked.
- **(e)** The `/history` row shows the `◌ Đang chấm` badge (AC-057).

**Primary failure mode guarded (FE2E-3)**: `blockedReason` threaded into `ActionButton` on `/result` but **not into both `usePdfAction` calls inside `HistoryRowMenu`**, so `/history` **silently exports a PDF for an attempt whose score has not settled**. Near-miss variants each excluded by their own assertion: a real `disabled` attribute; the reason conveyed only by class/opacity so a screen-reader user hears a bare "Lưu"; a `role="alert"` on a blocked click telling the student something broke when a published rule simply applied; "Xem chi tiết" blocked along with the rest, **locking the student away from the retry control**.
**Boundary**: both real route trees in-process, real timers, real dictionaries. **State assertion**: N/A. **Mock rationale**: the PDF generator and the data sources are stubbed; everything else real. **Residual**: the actual exported file's content is F-B3's manual check (html2canvas does not run in jsdom).

## Completion Criteria
- [ ] **Implementation Complete** = FE2E-1 and FE2E-3 executing, with **per-`describe` clock scoping in place and no file-level timer setup**
- [ ] **Quality Complete** = `npm run test:fixture` shows **only** the two recorded TD-030 failures
- [ ] **Integration Complete** = the shipped state and the two-door guard are **automated claims**
- [ ] Every case carries at least one **positive** assertion
- [ ] Every Reference Contract and Binding Decision Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: **Task F-C4 adds the FE2E-2 describe into the structure this task establishes** — that is why F-C4 depends on this task despite converting a different case.
- Scope boundary — preserve unchanged: `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**TD-030 is not this feature's to fix**, Gate F3); `SOURCE/vitest.fixture.config.ts:45-52`'s exclude list (**must not be extended**); the six non-executing sibling driver scripts in that directory.
- `SOURCE/lib/test/renderServerTree.tsx` **does not exist** — import from `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`.
