# Task 10: `components/history/ActionButton.tsx` (Work Plan Phase 2, Task 2.5)

Metadata:
- Dependencies: history-work-plan-task-09 (Deliverable: `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile`)
- Provides: `ActionButton` component (consumed by Task 12, Task 13)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/components/history/ActionButton.tsx`. Implement the skeleton `SOURCE/components/history/ActionButton.test.tsx` (currently no import/render blocks) — add both with the real component in this same commit (Red → Green): `action`/`pdfInput`/`idPrefix` props; 4-phase state machine (idle/busy/error/fallback-confirmed); synchronous `busyRef` guard; `attemptShare` helper (native share / `canShareFile`-false fallback / `AbortError`-as-success); error/status text nested as a button descendant (never a sibling) to preserve the DOM-shape invariant.

## Target Files
- [x] `SOURCE/components/history/ActionButton.tsx` (new)
- [x] `SOURCE/components/history/ActionButton.test.tsx` (fill in skeleton)

## Investigation Targets
- `SOURCE/components/history/ActionButton.test.tsx` (the full skeleton — obligations a-g, mock boundary notes)
- `docs/design/history-frontend-design.md` (§ ActionButton — Deep Dive — the full component code including `attemptShare`, the DOM-shape fix rationale, and the rejected `TooltipContent`-only alternative)
- `docs/design/history-frontend-design.md` (§ State Transitions — `ActionButton` phase machine — the state diagram and the "ActionButton phase → local DOM shape" table)
- `docs/design/history-frontend-design.md` (§ Data Contracts — `ActionButton` yaml — exact prop shape and output guarantees)
- `docs/ui-spec/history-ui-spec.md` (§ Component: ActionButton — verify default + loading + error + partial states)
- `docs/ui-spec/history-ui-spec.md` (§ D1 — Share-fallback UX and dismissal rule; § D4 — a11y pattern, `aria-disabled`+`aria-describedby`+`Tooltip`, never native `disabled`)
- `SOURCE/app/(layer2)/_components/rating/RateButton.tsx` (lines 42-75 — the D4 a11y pattern's only existing prior implementation, reused here as the 2nd application, not yet a Rule-of-Three extraction)
- `SOURCE/components/ui/tooltip.tsx` (the `Tooltip`/`TooltipTrigger`/`TooltipContent` primitives this component composes)

## Investigation Notes

- `ActionButton.test.tsx` skeleton (obligations a-g): confirmed the mock boundary is `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile` (module-level mock) + `navigator.share` (stubbed per-test via `Object.defineProperty`/`vi.mocked`); obligation (g)'s cross-file half explicitly allowed to defer until Task 13.
- Frontend DD § ActionButton — Deep Dive: full `ActionButton.tsx` code (Phase type, LABEL/ICON const maps, `attemptShare` helper, `handleClick`, JSX) copied/adapted verbatim into the real component; the DOM-shape fix rationale (why the phase-specific error/status spans must be `TooltipTrigger` descendants, `position: absolute` anchored by the button's own `position: relative`, never `Tooltip`-level siblings) drove the JSX structure — confirmed by reading `@base-ui/react`'s installed `TooltipRoot.js` (renders no element of its own) and `TooltipTrigger.js` (`useRenderElement("button", componentProps, ...)`, merging `elementProps`/user `onClick` onto that `<button>`) directly, matching the DD's own citation.
- Frontend DD § State Transitions — `ActionButton` phase machine / `ActionButton phase -> local DOM shape` table: implemented the 4-phase machine (idle/busy/error/fallback-confirmed) exactly per the `mermaid` diagram; `fallback-confirmed` uses plain `useState`, no timer/storage (see Reference Contract row below).
- Frontend DD § Data Contracts — `ActionButton`: `ActionButtonProps = { action: "save"|"share"; pdfInput: AttemptPdfData; idPrefix: string }` implemented verbatim; output guarantee (exactly one focusable `<button>`-rooted element per phase, never native `disabled`) verified by proof-obligation (f).
- UI Spec § Component: ActionButton / § D1 / § D4: busy/error/fallback-confirmed copy strings, `role="alert"`/`role="status" aria-live="polite"`, and the `aria-disabled`+`aria-describedby`+`Tooltip` pattern (never native `disabled`) all implemented per spec.
- `RateButton.tsx:42-75`: confirmed as the D4 pattern's only prior implementation (2nd occurrence here, not yet Rule-of-Three) — `ActionButton` reuses the same `Tooltip`/`TooltipTrigger`+`aria-disabled`+`aria-describedby`+always-present `sr-only` reason span shape, extended with the busy/error/fallback-confirmed state machine `RateButton` doesn't need.
- `SOURCE/components/ui/tooltip.tsx`: `Tooltip`/`TooltipTrigger`/`TooltipContent` composed exactly as in `RateButton.tsx`; `TooltipContent` never renders in these tests (tooltip stays closed — hover/focus not simulated), consistent with the DD's own note that `TooltipPortal` renders `null` while unmounted (confirmed by reading the installed `@base-ui/react/tooltip/portal/TooltipPortal.js`).
- Test-environment finding (not anticipated by the skeleton): this repo's `vitest.config.ts` wires no `@testing-library/jest-dom` setup file, so jest-dom matchers (`toHaveAttribute`, `toHaveTextContent`, `toBeInTheDocument`) are unavailable — all assertions use raw DOM properties/attributes instead (`el.getAttribute(...)`, `el.textContent`), matching the existing `AttemptPdfTemplate.test.tsx`/`DifficultyBadge.test.tsx` convention. Confirmed via a full `npx vitest run` (284 passed, 1 todo) with no regressions elsewhere.
- Reference Contract compliance (re-evaluated against the final implementation): **Y** — `phase` is declared via `useState<Phase>("idle")` only; no `localStorage`/timer/persisted mechanism exists anywhere in `ActionButton.tsx`, so `fallback-confirmed` naturally clears on unmount/reload with no explicit dismiss-on-navigate code path.
- Binding Decision compliance (re-evaluated against the final implementation): **Y** — `ActionButton.tsx`'s only import of PDF-generation functionality is `import { canShareFile, downloadPdfFile, generateAttemptPdfFile, type AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";` (the single Task 09 module); no local re-implementation of any PDF-generation/download/share-capability-detection logic exists in this file.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-frontend-design.md` (§ State Transitions — `ActionButton` phase machine) | state-lifecycle-negative | `"The fallback-confirmed → idle-on-navigate-away transition needs no explicit code: the confirmation is plain component state (useState), not persisted storage, so it naturally disappears on unmount/reload — which already matches D1's 'persists until next activation on that row, no auto-dismiss timer' requirement"` | Is the `fallback-confirmed` phase implemented purely via `useState` (no `localStorage`/timer/persisted mechanism), so it naturally clears on unmount/reload with no explicit dismiss-on-navigate code path? |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | dependency_direction | Enforce the single-implementation requirement (AC-007) structurally — both `HistoryRow` and `ResultActions` import the same module; no second, parallel PDF-generation path may form | Does `ActionButton.tsx` import `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile` exclusively from `SOURCE/lib/pdf/generateAttemptPdf.ts` (the single module from Task 09), with no local re-implementation of any PDF-generation logic? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the DOM-shape fix rationale (why the status/error span must be a `TooltipTrigger`-nested descendant, not a `Tooltip`-level sibling).
- [x] Write the failing tests per the skeleton's 7 obligations (a-g) with `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile`/`navigator.share`/`navigator.canShare` all mocked: (a) busy-guard no-double-trigger; (b) native-share success path; (c) `canShareFile`-false fallback + persistent confirmation; (d) `AbortError` → idle, not error; (e) non-`AbortError` rejection → error phase + retry; (f) DOM-shape invariant (exactly one in-flow child per phase, all 4 phases); (g) no-fetch/no-persisted-URL + cross-file import-specifier tripwire (may initially stub/skip the cross-file half until `HistoryRow.tsx`/`ResultActions.tsx` exist in Phases 3-4 — tracked, not silently dropped).
- [x] Run tests and confirm failure (component doesn't exist yet).

### 2. Green Phase
- [x] Implement `ActionButton` exactly per the frontend DD's Deep Dive code, including the D2 DOM-shape fix (status/error text as a button-descendant, `position: absolute`, anchored by the button's own `position: relative`).
- [x] Run only the added tests and confirm they pass (obligation g's cross-file half may assert against not-yet-existing files as a documented TODO).

### 3. Refactor Phase
- [x] Improve code (maintain passing tests); confirm `handleClick`'s Share branch stays flattened via the `attemptShare` helper (max-3-nesting-levels guideline).
- [x] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (jsdom, `// @vitest-environment jsdom`) — Enforces: component render/state-machine/DOM-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/components/history/ActionButton.test.tsx`

## Operation Verification Methods
- **Verification method**: run `ActionButton.test.tsx` with `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile`/`navigator.share`/`navigator.canShare` mocked; separately, a manual keyboard-only pass confirms the button is focusable and clickable in every phase.
- **Success criteria**: all 7 obligations green (obligation g's cross-file check may initially assert against not-yet-existing files — acceptable to stub/skip until Task 13, tracked as a TODO in the test); `tsc`/lint clean; WCAG D4 pattern followed (`aria-disabled`+`aria-describedby`+`Tooltip`, never native `disabled`).
- **Failure response**: if the busy-guard (`busyRef`) fails to suppress a second concurrent click, do not proceed to Task 11 — AC-010 is a hard requirement, not a nice-to-have.
- **Verification level**: L2 (6-7/7 obligations green, per the deferred cross-file check) — proven for real at Task 11's Early Verification Point.

## Proof Obligations
- **Claim**: AC-010 / Failure Mode `no-op` — 2 rapid clicks while busy invoke `generateAttemptPdfFile` at most once.
  - **Primary failure mode**: a rapid second click while `phase==="busy"` invokes `generateAttemptPdfFile` a second time (`aria-disabled` alone does not block the DOM click event; only the synchronous `busyRef` guard does).
  - **Boundary to exercise**: in-process unit (jsdom render + simulated click events, mocked PDF pipeline).
  - **State assertion**: before — `phase==="idle"`, `busyRef.current===false`; action — 2 rapid clicks fired before the first call's promise settles; after — `generateAttemptPdfFile` mock call count `===1`.
  - **Mock boundary rationale**: `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile` mocked to isolate the state-machine/guard logic from the real PDF pipeline (already covered separately by Task 09's tests).
  - **Residual**: none.
- **Claim**: AC-011 — native share path calls `navigator.share({files:[file]})` with the exact resolved `File`, returns to idle.
  - **Primary failure mode**: the wrong `File` object is passed to `navigator.share`, or phase does not return to idle after a successful share.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: before — idle; action — click Share with `canShareFile` mocked true and `navigator.share` mocked to resolve; after — `navigator.share` called once with `{files:[file]}`, phase `===idle`.
  - **Mock boundary rationale**: same as above; `navigator.share`/`navigator.canShare` mocked since jsdom does not implement the Web Share API.
  - **Residual**: none for the mocked call-construction proof; a real share sheet opening in an actual browser is a manual Playwright MCP/cross-browser concern (Task 18).
- **Claim**: AC-012 / Failure Mode `unavailable boundary` — `canShareFile`-false path calls `downloadPdfFile`, transitions to `fallback-confirmed`, persists until the next Save/Share click.
  - **Primary failure mode**: the fallback confirmation auto-dismisses (or fails to persist), or `downloadPdfFile` is not called on the unsupported-browser path.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: before — idle; action — click Share with `canShareFile` mocked false; after — `downloadPdfFile` called once, phase `==="fallback-confirmed"`, `role="status"` text present and still present after a no-op re-render, absent only after the next Save/Share click on the same instance.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: Share-cancellation — `navigator.share` rejecting with a `DOMException` named `"AbortError"` resolves phase back to idle, not error.
  - **Primary failure mode**: a cancelled Share (`AbortError`) is misclassified into the Error phase instead of resolving quietly back to idle.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: before — busy; action — `navigator.share` mock rejects with `DOMException("AbortError")`; after — phase `===idle`, no `role="alert"` element renders.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: AC-018 — a non-`AbortError` rejection sets error phase with `role="alert"`, button stays clickable, retry succeeds.
  - **Primary failure mode**: the button remains stuck busy/disabled after a failure, or `busyRef` is not reset, preventing a retry.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: before — busy; action — `generateAttemptPdfFile` mock rejects with a non-`AbortError`; after — phase `==="error"`, `role="alert"` text present, `aria-disabled==="false"`; a follow-up click with the mock reconfigured to resolve completes normally.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: DOM-shape invariant — every phase contributes exactly one in-flow child element to the rendering parent.
  - **Primary failure mode**: the Error/FallbackConfirmed status text renders as a DOM sibling of the button instead of a descendant, adding an extra grid item to `ResultActions`'/`HistoryRow`'s parent container (the exact regression the frontend DD's own v1.1 revision had to fix once already).
  - **Boundary to exercise**: in-process unit (DOM structure inspection across all 4 phases).
  - **State assertion**: N/A (structural, not state-transition).
  - **Mock boundary rationale**: same as above.
  - **Residual**: this proves the invariant in isolation; Task 12's manual visual check confirms it holds in the real `result/page.tsx` `grid-cols-3` layout.
- **Claim**: AC-013 / no-public-link + AC-007 structural tripwire — no fetch/XHR call is ever made; the only URL constructed is a transient, immediately-revoked object URL; `HistoryRow.tsx`/`ResultActions.tsx` both reference the same `generateAttemptPdfFile` import specifier.
  - **Primary failure mode**: Share ever performs a network request or constructs a persisted/public URL instead of a transient, immediately-revoked object URL; or a second, parallel PDF-generation import specifier forms across the two call sites.
  - **Boundary to exercise**: in-process unit (fetch/XHR spy + `URL.createObjectURL`/`revokeObjectURL` mock call-order assertion) + a static source-text search (the cross-file half, deferred until Task 13).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: the cross-file import-specifier half cannot be completed until `HistoryRow.tsx` (Task 13) and `ResultActions.tsx` (Task 12) both exist — tracked explicitly as a TODO in this test, completed by Task 13.

## Completion Criteria
- [x] All added tests pass (6-7/7 obligations, per the documented deferral) — 7/7 in-scope obligations pass; obligation g's cross-file half is `it.todo` per the documented Task 13 deferral.
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] `tsc`/lint clean; WCAG D4 pattern followed
- [x] Every Reference Contract / Binding Decision Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/components/history/ActionButton.tsx` + its test file only.
- Scope boundary: do not wire this component into `ResultActions`/`HistoryRow` in this task — that begins at Tasks 12/13. Proven for real (actual PDF generation) at Task 11.
