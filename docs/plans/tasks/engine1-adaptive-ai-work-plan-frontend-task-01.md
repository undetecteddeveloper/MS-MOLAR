# Task 01 (Frontend): Slice A — `useTutorAction` + `ExplainStepAffordance` + `ResultDetailPage` mount (Work Plan Phase 4, Task 14)

Metadata:
- Dependencies: backend-task-13 (`explainStep()`), backend-task-09 (`hasBeenWrongTwice` on `getResult()`'s output, the mount gate)
- Provides: `ExplainStepAffordance`/`useTutorAction`, consumed by Phase 5's manual verification; establishes the pattern frontend-task-02 follows
- Size: Medium (5 files: `useTutorAction.ts`, `ExplainStepAffordance.tsx`, `result/detail/page.tsx` extension, `en.ts`/`vi.ts` extension)

## Implementation Content

Add the `tutor.*` i18n keys (`en.ts`/`vi.ts`, appended tail block per the frontend DD's exact placement instructions) **first** — both components' `useT()`/compile-time key-completeness depend on it.

Implement `useTutorAction.ts` (4-phase state machine, synchronous `busyRef` guard checked before any state update, calls `explainStep(attemptId, questionId)` in that **exact argument order** — not `ExplainStepAffordanceProps`' `(questionId, attemptId)` declaration order, per the frontend DD's own flagged risk).

Implement `ExplainStepAffordance.tsx` (idle/busy/hint-shown/error render, never native `disabled`, `aria-disabled`/`aria-busy`/`aria-describedby`, hint renders only via `RichText`).

Mount conditionally (`r.hasBeenWrongTwice &&`) in **both** scored sub-branches (mcq, short_answer) of `ResultDetailPage` — never in the not-scored branch.

Convert `ExplainStepAffordance.test.tsx`'s 5 already-generated tests into real vitest(jsdom) tests:
- Test 1 (AC-025, busyRef no-op — at most 1 `explainStep()` call across 2 rapid activations)
- Test 2 (argument-order proof, two distinguishable literal fixtures)
- Test 3 (AC-018-020 UI half + D5, hint renders via `RichText`, button control removed)
- Test 4 (AC-021, failure path — both typed-error and rejected-promise cases — retry-relabeled button stays focusable, `role="alert"` mounts)
- Test 5 (AC-023/024/029, component functions with only its documented `{questionId, attemptId}` props, no skill-tag-shaped prop consulted)

## Target Files
- [x] `SOURCE/lib/i18n/dictionaries/en.ts` (additive — `tutor.*` tail block)
- [x] `SOURCE/lib/i18n/dictionaries/vi.ts` (additive — `tutor.*` tail block)
- [x] `SOURCE/components/tutor/useTutorAction.ts` (new)
- [x] `SOURCE/components/tutor/ExplainStepAffordance.tsx` (new)
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (additive — conditional mount in mcq + short_answer branches)
- [x] `SOURCE/components/tutor/ExplainStepAffordance.test.tsx` (fill in the existing skeleton's 5 tests)

## Investigation Targets
- `SOURCE/components/tutor/ExplainStepAffordance.test.tsx` (already generated — read in full: the IMPLEMENTER NOTE on `// @vitest-environment jsdom`, the full Mock Boundary Decisions note including the `within`-not-`screen` convention and no-jest-dom-matchers convention, all 5 tests' exact annotations)
- `docs/design/engine1-adaptive-ai-frontend-design.md` (§ State Machine Detail — `useTutorAction`; § Accessibility Implementation — `aria-disabled`/`aria-busy`/`aria-describedby`, never native `disabled`, `role="alert"`; § Applicable Standards — the RateButton/ActionButton native-`disabled` bug precedent; § Error Handling table; § Logging and Monitoring; § i18n `tutor.*` keys placement; § Minimal Surface Alternatives Elements 1-3)
- `docs/ui-spec/engine1-adaptive-ai-ui-spec.md` (§ D5 — "no control to re-invoke the tutor shall exist in this state for this question in this render"; § D1 — "Absent/false = affordance does not render (fail-closed, satisfies AC-024)"; § Component: ResultDetailPage state x display matrix; § Component: ExplainStepAffordance state x display matrix)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (the existing mcq/short_answer/not-scored branches, `notScored` at line ~71, `questionType === "true_false"`/`"short_answer"` checks — the exact 2 mount points)
- `SOURCE/app/(layer2)/tutorActions.ts` (backend-task-13 — `explainStep(attemptId, questionId)`'s exact parameter order, the risk this task's Test 2 proves)
- An existing client-component-with-`usePdfAction`-style-hook precedent in this repo (e.g. `ActionButton`/`usePdfAction` from the History feature, if present) — mirrors this task's own `useTutorAction`/`ExplainStepAffordance` split and its `aria-disabled` (never native `disabled`) convention

## Change Category

`Change Category: boundary-change`

This task extends `ResultDetailPage`'s existing render tree (an already-shipped page) with a new conditional mount. Sweep required: verify the not-scored branch remains completely untouched, and that every pre-existing question/user not satisfying `hasBeenWrongTwice === true` renders byte-identically to before this change (Phase 4 Completion Criteria: "pre-existing all-server-rendering behavior is unregressed").

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-frontend-design.md (§ Minimal Surface Alternatives Element 1) | contract_schema | `useTutorAction` returns `{phase, hint, run}` | Does `useTutorAction.ts` export exactly this return shape, no additional fields (Y/N)? |
| docs/design/engine1-adaptive-ai-frontend-design.md (§ Minimal Surface Alternatives Element 2) | contract_schema | One generic `tutor.error` copy for all 4 backend error codes | Does the error-state render use a single generic `tutor.error` i18n string regardless of which of the 4 backend error codes was returned, never disclosing `not_eligible`'s existence to the user (Y/N)? |
| docs/design/engine1-adaptive-ai-frontend-design.md (§ Minimal Surface Alternatives Element 3) | contract_schema | No `idPrefix` prop — `questionId` alone is page-unique | Does `ExplainStepAffordanceProps` omit any `idPrefix`-shaped prop, relying on `questionId` alone for any DOM-id uniqueness need (Y/N)? |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/ui-spec/engine1-adaptive-ai-ui-spec.md (§ D5) | state-lifecycle-negative | "once a hint is shown ... the button is replaced by a static (non-interactive) hint panel... no control to re-invoke the tutor shall exist in this state for this question in this render" | Does the hint-shown render remove the "explain this step" button/control entirely from the DOM, with no queryable re-invoke control (Y/N)? |
| docs/ui-spec/engine1-adaptive-ai-ui-spec.md (§ D1) | state-lifecycle-negative | "Absent/false = affordance does not render (fail-closed, satisfies AC-024)." | Does `ResultDetailPage` mount `ExplainStepAffordance` only when `r.hasBeenWrongTwice` is strictly `true` (absent/false/undefined all result in no mount) (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `ExplainStepAffordance`/`useTutorAction` (client, browser) → `explainStep()` (Next.js Server Action). This task owns the **left-side / client** owner (`SOURCE/components/tutor/useTutorAction.ts`) — the right-side server (`SOURCE/app/(layer2)/tutorActions.ts`) was defined in backend-task-13.

- **Serialized Format**: — (no encoding boundary).
- **Consumer Parse Rule**: `explainStep()`'s own typed-result branch (`"hint" in result`).
- **Expected Signal**: `explainStep` is called with the exact `(attemptId, questionId)` order, not the props' `(questionId, attemptId)` declaration order — proven by this task's own Test 2 with two distinguishable literal fixture values.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular the skeleton's full 5-test annotation set and the exact `ResultDetailPage` mount points.
- [x] Sweep the not-scored-branch adjacent case per Change Category above; record findings in Investigation Notes.
- [x] Add `// @vitest-environment jsdom` as the real test file's first line.
- [x] Convert the 5 skeleton tests into real vitest(jsdom) tests, using `within` scoping (never global `screen`) and raw DOM property/attribute checks (no jest-dom matchers), per the Mock Boundary Decisions convention.
- [x] Run the tests and confirm all 5 fail (no implementation exists yet).

### 2. Green Phase
- [x] Add `tutor.*` i18n keys to `en.ts`/`vi.ts` (appended tail block).
- [x] Implement `useTutorAction.ts`: 4-phase state machine (idle/busy/hint-shown/error), synchronous `busyRef` check before any state update, calls `explainStep(attemptId, questionId)` in that exact order.
- [x] Implement `ExplainStepAffordance.tsx`: idle/busy/hint-shown/error render; `aria-disabled`/`aria-busy`/`aria-describedby`, never native `disabled`; hint renders only via `RichText`; error state mounts a `role="alert"` paragraph with the generic `tutor.error` copy and a retry-relabeled, still-focusable button.
- [x] Mount `ExplainStepAffordance` conditionally (`r.hasBeenWrongTwice &&`) in both the mcq and short_answer branches of `ResultDetailPage`; leave the not-scored branch untouched.
- [x] Run `npx vitest run components/tutor/ExplainStepAffordance.test.tsx` — confirm all 5 pass.

### 3. Refactor Phase
- [x] Confirm every Binding Decision and Reference Contract Compliance Check evaluates to `Y`; record evidence in Investigation Notes.
- [x] Confirm the not-scored branch and every other pre-existing `ResultDetailPage` render path is byte-identical to before this change.

## Investigation Notes

### Investigation Targets read

- **`ExplainStepAffordance.test.tsx` (skeleton)** — authoritative. Adopted verbatim: `// @vitest-environment jsdom` first line; `explainStep` is the only mock (I/O boundary); `RichText`/`BentoCell`/`Button`/`useT()` all real; no `I18nProvider` wrapper (`useT()` falls back to `DEFAULT_LOCALE`, confirmed `"en"` at `lib/i18n/locales.ts:10`, so assertions use English copy); no jest-dom matchers (raw DOM property/attribute reads); every query scoped through `within(container)`, never global `screen`; no `cleanup()` (matching the sibling convention).
- **Frontend DD § State Machine Detail / § Accessibility Implementation / § Error Handling / § Logging and Monitoring / § i18n / § Minimal Surface Elements 1–3** — the DD carries a near-complete reference implementation for both new files; implemented as written (4-phase machine, `busyRef` before any state update, `try/catch/finally` always releasing the ref, `console.error` twice with `{attemptId, questionId, errorCode|err}` only — never the hint or question content).
- **UI Spec § D1 / § D5 / both state × display matrices** — D5's "no control to re-invoke" is implemented as a full early `return` of the `BentoCell` hint panel, so the button subtree is not rendered at all in `hint-shown`.
- **`SOURCE/app/(layer2)/tutorActions.ts` (real source, not assumption)** — signature verified at line 156: `export async function explainStep(attemptId: string, questionId: string): Promise<ExplainStepResult>`; result type at line 53: `{ hint: string } | { error: ExplainStepError }` with `ExplainStepError = "not_eligible" | "rate_limited" | "gemini_unavailable" | "server"` (line 51). **No discrepancy** against the skeleton test's assumed `"hint" in result` discriminant or the backend DD — no escalation triggered. The test file imports the real `ExplainStepResult` type (while mocking the module's runtime), so a future change to that union breaks this test at compile time.
- **`ResultDetailPage`** — not-scored branch returns early at its own `if (notScored) { ... return (...) }` (page.tsx:74–128); the scored `<li>` follows, with the `isShortAnswer ? … : …` ternary as the only sub-branch split. Exactly 2 mount points, one at the end of each ternary arm.
- **Client-component-plus-hook precedent — FOUND**: `SOURCE/components/history/ActionButton.tsx` + `SOURCE/components/history/usePdfAction.ts` (plus `ActionButton.test.tsx` as the test precedent). Mirrored: hook owns `phase` + `busyRef` + `run()` and returns them; component owns render only; `aria-disabled` as the **string** `"true"`/`"false"`; `aria-busy` boolean; `aria-describedby` → an sr-only reason span with **no** `aria-live` (text mutation is the announcement mechanism); native `disabled` never used. Deviations from that precedent, each spec-mandated: no `idPrefix` prop (Minimal Surface Element 3), no `Tooltip` (visible label always present), error paragraph in-flow rather than absolutely positioned (UI Spec: this component has vertical room in the `<li>` flow).

### Adjacent Case Sweep (Change Category: `boundary-change`)

Whitespace-insensitive diff of `page.tsx` (`git diff -w`) contains exactly: the new import, the mount-rationale comment, two `<>…</>` wrappers, two `{r.hasBeenWrongTwice === true && <ExplainStepAffordance … />}` blocks, and one prettier line-wrap of the pre-existing `isSelectedWrong` assignment (caused purely by the deeper indentation, no semantic change). **The not-scored branch is byte-identical** — zero diff hunks touch lines 74–128. Fragments emit no DOM, and both new blocks render `false`/nothing unless the flag is strictly `true`, so every pre-existing render path (not-scored questions, and every scored question where `hasBeenWrongTwice` is `false`/`undefined`) produces identical DOM to before. No residual adjacent case found outside the Target Files.

### Binding Decisions — Compliance Check evaluation (post-implementation)

Planned approach (contract_schema axis): implement the hook/component exactly as the frontend DD's reference implementation specifies, adding no field, prop, or error-copy variant beyond it.

| Source (Axis) | Evaluation | Evidence |
|---|---|---|
| Minimal Surface Element 1 — `{phase, hint, run}` | **Y** | `useTutorAction.ts` declares `UseTutorActionResult { phase; hint; run }` and its single `return { phase, hint, run };` — no fourth field; `tsc --noEmit` clean against the explicit return type annotation. |
| Minimal Surface Element 2 — one generic `tutor.error` | **Y** | The error render is a single `<p role="alert">{t("tutor.error")}</p>`; `result.error` reaches only `console.error`, never the UI. Test 4 asserts the identical string `"Couldn't load a hint. Try again."` for both a typed `{error: "gemini_unavailable"}` and a rejected promise — no code path can surface `not_eligible`'s existence. Only 4 `tutor.*` keys exist in both dictionaries; no per-code key. |
| Minimal Surface Element 3 — no `idPrefix`-shaped prop | **Y** | `ExplainStepAffordanceProps` has exactly `{questionId, attemptId}`. DOM-id uniqueness comes from `` const reasonId = `tutor-${questionId}-reason` `` — `questionId` alone, which is already the `.map()` key on the page. Test 5 renders with only those two props and the component is fully activatable. |

### Reference Contracts — Compliance Check evaluation (post-implementation)

| Source | Evaluation | Evidence |
|---|---|---|
| UI Spec § D5 — hint-shown removes every re-invoke control | **Y** | `phase === "hint-shown" && hint !== null` returns the `BentoCell` panel early, so the button subtree never renders. Test 3 asserts `within(container).queryByRole("button")` is `null`, both named queries are `null`, and `container.querySelectorAll("button").length === 0`. |
| UI Spec § D1 — mount only when strictly `true` (fail-closed) | **Y** | Both mount points read `{r.hasBeenWrongTwice === true && (…)}` — an explicit identity check, matching AC-023's own wording (`When r.hasBeenWrongTwice === true`); `false`, `undefined`, and an absent field all fail it. The not-scored branch has no mount at all. |

### Boundary roundtrip (Connection Map — Expected Signal)

Test 2 is the roundtrip guard: the producer (`useTutorAction`) emits `(attemptId, questionId)` and the consumer (`explainStep`'s real signature) expects that same order. Asserted twice — `toHaveBeenCalledWith(ATTEMPT_ID, QUESTION_ID)` and `mock.calls[0]` deep-equal — with two non-interchangeable fixtures (`"attempt-fixture-111"` / `"question-fixture-222"`).

### Mutation checks (proof that the tests are not vacuous)

Each primary failure mode named in the Proof Obligations was injected into the implementation, the suite re-run, and the implementation restored:

| Injected defect | Result |
|---|---|
| `if (phase === "busy") return;` replacing the `busyRef` check | Test 1 **fails** (2 calls recorded). Note: this required firing both activations inside **one** `act()` body — `fireEvent.click` wraps each call in its own `act()`, which flushes the state update in between and lets a state-based guard falsely pass. The final Test 1 uses `act(() => { button.click(); button.click(); })` for this reason. |
| `explainStep(questionId, attemptId)` (swapped) | Tests 2 and 5 **fail**. |
| `<p>{hint}</p>` replacing `<RichText text={hint} />` | Test 3 **fails** (literal `**` present, no `<strong>`). |
| `disabled={phase === "error"}` on the button | Test 4 **fails** (native `disabled` present, button unfocusable). |

### Verification

- `npx vitest run components/tutor/ExplainStepAffordance.test.tsx` → `Test Files 1 passed (1) / Tests 5 passed (5)`.
- Full suite `npx vitest run` → `Test Files 68 passed | 1 skipped (69) / Tests 654 passed | 3 todo (657)` — no regression (the 3 remaining `todo`s belong to other files, not this one).
- `npx tsc --noEmit` → clean, project-wide (this is also what enforces `vi.ts`'s key-set completeness for the 4 new keys).
- `npx eslint --max-warnings 0` on all touched paths → clean, including the bundled `jsx-a11y` rules over the new ARIA usage.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `components/tutor/`
- Manual axe-equivalent pass (ESLint's bundled `jsx-a11y` rules + manual ARIA/contrast walk) — Covered: `ExplainStepAffordance`'s 4 states (exercised fully in Phase 5 Task 20, but this task's own use of `aria-disabled`/`aria-busy`/`role="alert"` is the ESLint-`jsx-a11y`-checked half, enforced now)

## Operation Verification Methods
- **Verification method**: run `npx vitest run components/tutor/ExplainStepAffordance.test.tsx` against the 5 tests.
- **Success criteria**: all 8 frontend component tests project-wide are eventually green (this task contributes 5 of them); `ResultDetailPage`'s pre-existing all-server-rendering behavior is unregressed for every question/user not satisfying the new gating conditions (Phase 4 Completion Criteria).
- **Failure response**: if Test 2 (argument-order proof) fails, treat as this feature's own top-named risk materializing — do not proceed to frontend-task-02 or Phase 5 until fixed. The real, non-mocked round trip is separately verified by Phase 5 Task 17 (Verification Strategy's Second Verification Target) — if that real round trip's shape differs from this task's mocked assumption (e.g. a field name or discriminant differs from `"hint" in result`), escalate as a discrepancy against the backend Design Doc rather than silently adapting.
- **Verification level**: L2 (new tests added and passing) now; L1 (real `explainStep()` round trip against a dev-seeded wrong-twice question) is the Verification Strategy's Second Verification Target, executed in Phase 5 Task 17.

## Proof Obligations
(Sourced verbatim from `ExplainStepAffordance.test.tsx`'s own annotations.)
- **Claim**: Test 1 — a second activation while busy is a verified no-op; `explainStep()` called AT MOST ONCE across 2 rapid activations (AC-025).
- **Primary failure mode**: the `busyRef` guard is implemented as a React state check (`phase === "busy"`) instead of a synchronous ref check, so a second click fired in the same tick is NOT blocked.
- **Boundary to exercise**: integration (jsdom render + simulated events), mocked `explainStep()`.
- **State assertion**: N/A (call-count assertion, not persisted state).
- **Mock boundary rationale**: `explainStep` mocked (I/O boundary); `useTutorAction`'s own phase/busyRef control flow runs for real, in-process.
- **Residual**: none.
- **Claim**: Test 2 — `explainStep` is called with `(attemptId, questionId)`, never the swapped `(questionId, attemptId)` order.
- **Primary failure mode**: the call site swaps the two string arguments (both compile fine either order) — every tutor invocation silently targets the wrong attempt/question pair.
- **Boundary to exercise**: integration, mocked `explainStep()`.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: this is the SOLE guard against this specific regression class — no type-system check can catch it.
- **Claim**: Test 3 — hint-shown state renders the hint via `RichText` and removes the re-invoke control (AC-018-020 UI half + D5).
- **Primary failure mode**: the hint is rendered through a competing plain-text/`dangerouslySetInnerHTML` path instead of `RichText`, or the button remains mounted alongside the hint panel.
- **Boundary to exercise**: integration, mocked `explainStep()` resolving `{hint}`; `RichText` real, unmocked.
- **State assertion**: N/A.
- **Mock boundary rationale**: `RichText` exercised for real (already covered by its own `RichText.xss.test.tsx`, reused unmodified — this test only proves routing INTO `RichText`, not `RichText`'s own sanitize correctness).
- **Residual**: none.
- **Claim**: Test 4 — failure path (both typed-error and rejected-promise) re-labels to retry, mounts a `role="alert"` error, button stays focusable (AC-021).
- **Primary failure mode**: the button is set to native `disabled` on error (the exact bug already fixed twice in this codebase, RateButton then ActionButton), permanently blocking a retry via keyboard; or the error paragraph lacks `role="alert"`.
- **Boundary to exercise**: integration, mocked `explainStep()` — both a typed-error resolution and a rejected Promise.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: none.
- **Claim**: Test 5 — the component functions with only its documented `{questionId, attemptId}` props, no skill-tag-shaped prop consulted (AC-023/024/029).
- **Primary failure mode**: a future maintainer widens `ExplainStepAffordanceProps` to accept a skill-tag-shaped field and conditions rendering/behavior on it, silently breaking AC-029's "needs question content, not a skill tag" contract for untagged questions.
- **Boundary to exercise**: integration, real render with only the minimal props.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: the mount/no-mount DECISION itself (AC-023/024, `ResultDetailPage`'s own gating) is out of this component's RTL scope, per the skeleton's own note — verified instead by the manual Playwright pass (Phase 5 Task 18) and this task's Reference Contract row (UI Spec § D1) above.

## Completion Criteria
- [x] `tutor.*` i18n keys added; `useTutorAction.ts`/`ExplainStepAffordance.tsx` implemented; mounted in both mcq/short_answer branches of `ResultDetailPage`
- [x] All 5 `ExplainStepAffordance.test.tsx` tests pass
- [x] Each Binding Decision and Reference Contract Compliance Check evaluates to `Y`, evidence recorded in Investigation Notes
- [x] Not-scored branch and all other pre-existing `ResultDetailPage` renders confirmed byte-identical
- [x] Each Proof Obligation is met (each one's primary failure mode injected and confirmed to fail the owning test — see Investigation Notes § Mutation checks)

## Notes
- Impact scope: `SOURCE/components/tutor/**` (new), `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` (additive tail block), `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (additive mount only).
- Scope boundary: do not modify `RichText`'s own implementation; do not modify the not-scored branch of `ResultDetailPage`; do not implement `SkillRecommendationCard`/`DashboardPage` here (frontend-task-02).
