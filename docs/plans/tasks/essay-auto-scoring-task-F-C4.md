# Task F-C4 — Convert FE2E-2 (reserved-slot journey)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-C (Interaction and fixture-e2e, frontend slices V4 + V5), Task F-C4**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**`)

Metadata:
- Dependencies: **Task F-C3** (same file, shared fake-clock harness — F-C3 lands **first** and sets up the per-`describe` scoping; I009), **Task F-C2**, **Task F-B2**.
- Blocks: nothing.
- Provides: fixture lane resolution **3/3**; unresolved `it.todo`: **0**.
- Size: Small (1 file, one added describe)
- Verification level: **L2**.

## Implementation Content

Convert the third case. **This is the reserved multi-step journey slot**: `/result` renders with pending essays, state carries across a `router.refresh()` boundary, and the journey has a **completion point** (all essays resolved, PDF unblocked).

It is **not** a service-integration-e2e case — nothing here needs a real DB write, a real event, or a real external call; the band's arrival is modelled by the **stubbed `getResult()` returning a different fixture on the second call**, which is also the only deterministic way to hit the transition.

### Behaviour
Render the real `/result` tree with `essaySummary.pendingCount = 1`; advance **one** poll interval on the fake clock; the counted `refresh` mock fires and the stubbed `getResult()` now returns the **all-resolved** fixture; the page re-renders **in place**.

### Determinism
Fake timers only, **no `waitFor` in this describe**, all clock movement through `vi.advanceTimersByTime` **inside `act()`**. The fake clock is scoped to **this describe's own** `beforeEach`/`afterEach` — **never file-level**, which would hang FE2E-3's menu interactions. **Task F-C3 already established that structure; this task adds a describe into it rather than introducing it.**

### Recorded limit, stated at the assertion
jsdom has **no real `router.refresh()`** and **no painted focus ring**, so (f) proves the **necessary** condition (nothing was unmounted), **not** the **sufficient** one (focus actually survived in a browser). The sufficient half stays with the **manual browser pass** (FE-OQ-4 / IV-4 / R-F3). **Do not let this case's name claim it.**

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (the FE2E-2 describe)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (the skeleton's FE2E-2 annotations; **and the per-`describe` clock structure Task F-C3 established**)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayGradingPoller — verify default (polling) + resolved states; the transition journey)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Agreement Checklist Scope — `EssayGradingPoller`: the mount condition is `essaySummary !== undefined`, **not** `pendingCount > 0` (F-05))
- `SOURCE/app/(layer2)/_components/EssayGradingPoller.tsx` (Task F-C2 — the cadence constants, the `aria-live` region, the mount predicate)
- `SOURCE/components/history/usePdfAction.ts` and `SOURCE/components/history/ActionButton.tsx` (Task F-B2 — the controls that unblock after the transition)
- `SOURCE/app/(layer2)/_components/__tests__/ExamTimer.test.tsx` (`:17-19` — nested timers need their own advance; one long advance leaves React no commit point)
- `SOURCE/lib/i18n/dictionaries/vi.ts` (Task F-A1 — `result.essay.announceAllDone` = "Đã chấm xong toàn bộ câu tự luận.", resolved through the **real** dictionary)

## Reference Contracts

*(No Reference Contract Values row is scoped to this task; the poller's five constants are pinned in Task F-C2 and are read here through the component.)*

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayGradingPoller — verify default (polling) + resolved states)

## Investigation Notes

### Fixture lane resolution: 3/3, unresolved `it.todo`: 0
`essay-auto-scoring.fixture.e2e.test.ts` now reports **3 executing cases and no todo**. The lane's only remaining red is the recorded TD-030 baseline in `subscription.fixture.e2e.test.ts`.

### The limit is stated at the assertion, and the case name does not claim past it
jsdom has no real `router.refresh()`. Here the refresh is **counted** (a mock) and the band's arrival is **modelled** by re-rendering with the resolved fixture — which the task file already identifies as the only deterministic way to hit the transition. So the case proves the **necessary** condition (nothing was unmounted across the transition) and **not** the sufficient one (focus actually survived in a browser). The sufficient half stays with the manual browser pass (FE-OQ-4 / IV-4 / R-F3).

"Nothing was unmounted" is asserted concretely rather than described: the `aria-live` element and both PDF buttons are compared by **node identity** (`toBe`) before and after the transition, not merely by presence.

### The three-step journey, and what each step rules out
1. One fast interval on the fake clock ⇒ exactly **one** `router.refresh()`. The live region starts **empty** (AB-7).
2. A refresh that resolves **nothing** leaves the region **empty** — announcing on every tick is the AC-023 defect seen from the other side, a screen reader interrupting at every poll.
3. The render that resolves the **last** essay inserts `announceAllDone` **exactly once**, into the **same** region node. This is the case that a `pendingCount > 0` mount condition would break: the region would leave the DOM in the same commit the sentence was to be inserted.

### Commit hygiene: F-C3 and F-C4 were split back apart
Both tasks rewrite the same file and I completed them in one sitting before committing. Rather than collapse them into one commit, the file was reverted to its F-C3 state (FE2E-2 back to `it.todo`), F-C3 was committed and verified on its own, and F-C4 was then re-applied on top. One task, one commit — including the intermediate state actually being green.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, especially the clock structure Task F-C3 established
- [ ] Add the FE2E-2 describe **into that structure** with its own `beforeEach`/`afterEach` fake clock — **do not** introduce a file-level clock
- [ ] Write obligations (a)–(f); observe failure

### 2. Green Phase
- [ ] Drive the transition: render with `pendingCount = 1`, advance **exactly one** interval inside `act()`, let the stubbed `getResult()` return the all-resolved fixture on the second call
- [ ] Bring all six obligations green
- [ ] Run `npm run test:fixture`

### 3. Refactor Phase
- [ ] Confirm **zero `waitFor`** in this describe
- [ ] Confirm the fake clock is **describe-scoped**, never file-level
- [ ] Confirm the recorded limit is written **at the assertion** for (f)

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: the fixture-e2e lane — Config: `SOURCE/vitest.fixture.config.ts`; covers `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` — **lane already red, see Gate F**
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 2022 passed / 10 skipped / 0 todo |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **TD-030 baseline only.** This file: **3 executing, 0 todo** — fixture lane resolution **3/3** |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: `npm run test:fixture`, read by **real exit code**; the transition is **driven**, not asserted around.
- **Success criteria**: fixture lane shows **only** the TD-030 baseline; all six obligations green; fixture lane resolution **3/3**, unresolved `it.todo`: **0**.
- **Failure response**: if the describe hangs, a `waitFor` is present with fake timers, or the clock leaked to file level (which hangs FE2E-3's menu interactions). If (c) passes but (d) does not, the implementation announces on **every** tick — the AC-023 defect from the other direction.
- **Verification level**: **L2**.

## Proof Obligations
- **(a) Before** — with `pendingCount` 1, the `aria-live="polite"` region **exists** (`container.querySelector` is non-null) and is **empty**; assert emptiness on **`textContent`**, not on node absence.
  - **Primary failure mode**: asserting the absence of a node, which passes when the region was never rendered at all. **Boundary**: the real `/result` route tree in-process, fake timers. **State assertion**: region present, `textContent` empty. **Mock rationale**: `getResult()` and the PDF generator stubbed; `next/navigation` mocked so refreshes are counted; dictionaries real. **Residual**: none.
- **(b) The transition is driven, not asserted around** — advance **exactly one** interval inside `act()`. *(Nested `setTimeout` means each tick needs its own advance; one long advance leaves React no commit point.)*
  - **Primary failure mode**: a single long advance producing no commits, so the case silently tests nothing. **Boundary**: as above. **Residual**: none.
- **(c) After** — the **same** `aria-live` node is still in the document, compared by **node identity** against the reference captured in (a). *(A remount that happens to re-add an equivalent node **is** the defect, and a selector re-query cannot tell them apart.)* Its `textContent` now equals `result.essay.announceAllDone` = **"Đã chấm xong toàn bộ câu tự luận."** resolved through the **real** dictionary.
  - **Primary failure mode**: the mount condition written as `pendingCount > 0` — the shape the UI Spec first published — so on the render that resolves the last essay the component unmounts, the region leaves the DOM **in the same commit the sentence would have been inserted**, and completion is **never announced**. **A test that renders the resolved state directly passes**: the region is absent in both the correct and the broken implementation at that instant. **Only the transition distinguishes them**, which is why this case must drive the page through it. **Boundary**: as above, by node identity. **State assertion**: node identity + `textContent` before → after. **Residual**: none.
- **(d) Negative control in the same case** — a refresh where `pendingCount` does **not** decrease leaves the region **empty**.
  - **Primary failure mode**: without this, (c) passes for an implementation that announces on **every** tick. **Boundary**: as above. **Residual**: none.
- **(e) Unblock in place** — after the transition both PDF controls carry `aria-disabled="false"` and **one click calls the mocked `generateAttemptPdfFile` exactly once** (not "at least once").
  - **Primary failure mode**: a dogpile from a state-based latch, or a guard that never releases. **Boundary**: as above with a counted mock. **Residual**: none.
- **(f) No control was unmounted** across the transition — capture the DOM nodes of the PDF control and any retry control **before** the refresh and assert the **same node objects** report `isConnected === true` afterwards.
  - **Primary failure mode**: a remount that loses focus and scroll position mid-journey. **Boundary**: as above, by node identity. **State assertion**: `isConnected` before → after. **Mock rationale**: as above.
  - **Residual — recorded at the assertion**: jsdom has **no real `router.refresh()`** and **no painted focus ring**, so this proves the **necessary** condition (nothing was unmounted), **not** the **sufficient** one (focus actually survived in a browser). The sufficient half stays with the manual browser pass (FE-OQ-4 / IV-4 / R-F3).

## Completion Criteria
- [ ] **Implementation Complete** = FE2E-2 executing with **all six** obligations
- [ ] **Quality Complete** = fixture lane shows **only** the TD-030 baseline
- [ ] **Integration Complete** = fixture lane resolution **3/3**, unresolved `it.todo`: **0**
- [ ] The fake clock is scoped to **this describe**; there is **no** file-level `vi.useFakeTimers()`
- [ ] Zero `waitFor` in this describe
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: none in production code.
- Scope boundary — preserve unchanged: the FE2E-1 and FE2E-3 describes (Task F-C3 owns them — this task **adds** a describe, it does not restructure the file); `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts`; `SOURCE/vitest.fixture.config.ts:45-52`'s exclude list (Gate F3).
- The band's arrival is modelled by the stubbed `getResult()` returning a **different fixture on the second call** — the only deterministic way to hit the transition.
