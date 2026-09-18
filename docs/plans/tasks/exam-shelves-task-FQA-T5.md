# Task FQA-T5 (manual, not automatable) — Playwright CLS audit

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T5**
Layer: cross-cutting (manual verification — no source files changed unless a defect is found)

Metadata:
- Dependencies: Phase 5 (page integration) and Phase 7 (home block) complete
- Blocks: none (but is a required sign-off gate per Success Criteria #3)
- Size: Small (0 files; 1 manual audit run)
- Verification level: L1 (manual, real-browser functional measurement)

## Implementation Content
Playwright CLI interaction audit (`npm run pw`, run from inside `SOURCE/`) — measure CLS at 360/768/1024/1280 on `/exams` (0 params) cold open AND on a horizontal shelf swipe, plus `/exams?sort=hot` and `/` signed-in. Target: CLS = 0 at all four widths, both triggers (Success Criteria #3).

## Target Files
- [ ] None expected (manual measurement task; source files change only if a defect is found and fixed as a follow-up)

## Investigation Targets
- `SOURCE/scripts/pw/cli.mjs` (the Playwright CLI harness this task runs)
- `docs/design/exam-shelves-frontend-design.md` (§ Rendering, performance and motion — the CLS=0 design intent, `motion-safe:scroll-smooth`)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Motion, § Responsive Behaviour — the 4 target breakpoints)
- `C:\Users\ASUS\.claude\projects\...\windows-bash-tooling-quirks.md`-equivalent project context: Playwright CLI dies during build; run from inside SOURCE; scope selectors to `main`

## Investigation Notes
_(Record here: the measured CLS value at each of the 4 breakpoints, for each of the 4 trigger scenarios (cold open ×2 pages + swipe ×1 + home ×1) — 16 data points total; any non-zero CLS found, with the specific element responsible.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Confirm `npm run pw` is runnable in the current session per the project's own known tooling constraints (run from inside `SOURCE/`, not mid-build)
### 2. Green Phase
- [ ] Measure CLS at 360/768/1024/1280 on `/exams` cold open
- [ ] Measure CLS at 360/768/1024/1280 on a horizontal shelf swipe interaction
- [ ] Measure CLS at 360/768/1024/1280 on `/exams?sort=hot`
- [ ] Measure CLS at 360/768/1024/1280 on `/` signed-in
### 3. Refactor Phase
- [ ] If any measurement is non-zero, identify the responsible element and file a follow-up fix before sign-off — do not record a passing result if any of the 16 data points is non-zero

## Operation Verification Methods
- **Verification method**: `npm run pw` from inside `SOURCE/`, measuring CLS at all 4 breakpoints × all 4 trigger scenarios.
- **Success criteria**: CLS = 0 at all four widths, both triggers scenario groups (Success Criteria #3) — 16/16 data points at 0.
- **Failure response**: a non-zero CLS blocks sign-off — this is a manual, non-automatable gate; escalate to the engineer with the specific breakpoint/scenario/element responsible rather than rounding to "close enough."
- **Verification level**: L1 — real-browser functional measurement, the strongest verification level available.

## Proof Obligations
- **Claim** (Success Criteria #3): CLS = 0 at 360/768/1024/1280 on `/exams` cold open, on a horizontal shelf swipe, on `/exams?sort=hot`, and on `/` signed-in.
  - **Primary failure mode**: the shelf row's horizontal scroll container reserves layout space incorrectly (e.g. images without explicit dimensions, or a late-loading web font shifting text), causing a visible layout shift specifically on the swipe interaction or on first paint — a defect class that unit/integration tests cannot detect since it requires real browser layout and paint timing.
  - **Boundary to exercise**: real browser, via the Playwright CLI harness — not a mock, not a server-rendered tree comparison.
  - **State assertion**: N/A (a visual/layout measurement, not a data-state transition).
  - **Mock boundary rationale**: none — CLS is fundamentally a real-browser rendering metric that cannot be proven by a mocked or server-only render.
  - **Residual**: this measures the specific 4 breakpoints × 4 scenarios named by the plan; it does not exhaustively cover every possible viewport or interaction sequence a real user might produce.

## Completion Criteria
- [ ] All 16 data points (4 breakpoints × 4 scenarios) measured and recorded
- [ ] CLS = 0 confirmed at every data point
- [ ] Investigation Notes record every measurement, not a summary judgment

## Notes
- Impact scope: none expected; if a defect is found, the fix is a follow-up task outside this plan's original scope (escalate rather than silently expanding scope).
- Scope boundary: this task does not implement fixes — it measures and reports.
