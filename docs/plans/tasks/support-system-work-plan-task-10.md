# Task 10: Fixture-e2e `support-widget-visibility.fixture.e2e.test.ts` (blocking Early Verification Point, frontend) (Work Plan Phase 2, Task 2.3)

Metadata:
- Dependencies: support-system-work-plan-task-09 (Deliverable: `SupportWidget` tree + 5 mount points), support-system-work-plan-task-07 (Deliverable: fixture harness + override boundary)
- Provides: proven real-browser mount-point self-guard — the Early Verification Point Phase 3 is gated on
- Size: Small (1 file: fill in the skeleton)

## Implementation Content

Fill in and execute Obligations A (no widget when logged out), B (no widget on the attempt route regardless of auth, real DOM absence not CSS-hidden), C (360px zero bounding-box intersection with `BottomNav` + `env(safe-area-inset-bottom)` respect — requires a real browser, jsdom cannot compute layout). Use task-07's fixture harness.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` (fill in the skeleton's driver code)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` (full file — Obligation A/B/C Behavior/Proof Obligation blocks)
- `docs/ui-spec/support-system-ui-spec.md` (§ Component: SupportWidgetTrigger — Default state; § Layout Constraints — the 360px `BottomNav` zero-intersection + `env(safe-area-inset-bottom)` requirements; § Accessibility Requirements)
- `SOURCE/components/support/SupportWidget.tsx`, `SupportWidgetTrigger.tsx` (task-09's implemented components — the actual guard/regex and layout code this test exercises for real)
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (task-07's fixture profiles + override-boundary mechanism)
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts`, `history.fixture.e2e.test.ts` (the `FE2Driver`/`HistoryDriver`-style structural-subset-of-Playwright driver convention to follow)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact attempt-route pathname pattern and `BottomNav`'s `--bottom-nav-h` custom property.
- [ ] Fill in the driver code per the skeleton's stated Behavior for Obligations A, B, C — initially expect failures until the fixture/override boundary and the real components are correctly wired together.

### 2. Green Phase
- [ ] Wire the driver against task-07's fixture harness and task-09's real components; run against a real browser (Playwright MCP or equivalent) at 360px width for Obligation C.
- [ ] Iterate until all 3 obligations pass.

### 3. Refactor Phase
- [ ] Clean up driver code; confirm the DOM-absence assertions (Obligations A/B) distinguish "not in the DOM" from "in the DOM but hidden" as the skeleton requires.

## Quality Assurance Mechanisms
- Manual 360px viewport pass (Playwright MCP or `npm run dev`) — Enforces: AC-006's zero-`BottomNav`-intersection guarantee — Config: local dev session — Covers: `SupportWidgetTrigger`

## Operation Verification Methods
(Copied and instantiated from Verification Strategy's Second Verification Target — this task IS the required Early Verification Point, frontend.)
- **Verification method**: `SupportWidget`'s five-mount-point self-guard, run against a real browser for Obligation C's layout intersection (jsdom cannot compute real layout).
- **Success criteria**: all four `{ user, pathname }` combinations render/don't-render correctly across a representative sample of the five real mount pathnames, and a manual 360px Playwright pass confirms zero `BottomNav` intersection (AC-006) on at least one real mounted route.
- **Failure response**: stop before wiring the dialog to the real backend action (task-11) — an incorrect guard is a visibility bug independent of submission logic, and fixing it after the dialog is wired risks the fix being obscured by unrelated submit-flow debugging.
- **Verification level**: L1 (functional — real DOM absence and real computed layout, proven in an actual browser, not jsdom).

## Proof Obligations
- **Claim**: `SupportWidget` returns `null` (no DOM node) when logged out — not merely visually hidden (AC-003).
- **Primary failure mode**: the widget renders but is merely visually hidden (`display:none`/`opacity:0`) instead of the component returning `null` — a DOM node still exists and would be found by a `querySelector`.
- **Boundary to exercise**: full-ui (mocked backend, real browser rendering).
- **State assertion**: N/A (visibility check, not persisted state).
- **Mock boundary rationale**: `getCurrentUser` fixture-driven per task-07's harness.
- **Residual**: none.
- **Claim**: `SupportWidget` renders no DOM node on the exam-attempt route, regardless of auth state — genuinely absent, not CSS-hidden (AC-005, D1).
- **Primary failure mode**: the widget mounts on the attempt route but is suppressed only via CSS instead of the component itself returning `null` for that route pattern.
- **Boundary to exercise**: full-ui (mocked backend, real browser rendering).
- **State assertion**: N/A.
- **Mock boundary rationale**: attempt-route rendering + `getCurrentUser` fixture-driven.
- **Residual**: none.
- **Claim**: at 360px viewport width, the widget trigger's bounding box has zero intersection with `BottomNav`, and its resting position respects `env(safe-area-inset-bottom)` (AC-006, narrowed to `BottomNav` only per PRD v1.2 review).
- **Primary failure mode**: the widget trigger's computed bottom offset does not account for `BottomNav`'s `--bottom-nav-h` custom property, producing a real overlap only visible under actual layout computation.
- **Boundary to exercise**: full-ui, real browser viewport/layout (this obligation cannot be an `integration`-lane RTL test — jsdom does not compute real layout).
- **State assertion**: N/A.
- **Mock boundary rationale**: full-ui with mocked backend; real browser layout engine, not mocked.
- **Residual**: none.

## Completion Criteria
- [ ] All 3 obligations pass (Obligation A, B, C)
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises real-browser rendering/layout
- [ ] This **must pass** before Phase 3 begins per the frontend DD's own Failure response

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` only — driver code fills the existing skeleton, no production component code is changed by this task.
- Scope boundary: if a real defect is found in `SupportWidget`'s guard logic or `SupportWidgetTrigger`'s layout, the fix belongs in task-09's files (already-touched, per that task's own scope) — this task's own Target Files list stays limited to the test file; escalate rather than silently expanding scope if a fix requires touching an unrelated file.
