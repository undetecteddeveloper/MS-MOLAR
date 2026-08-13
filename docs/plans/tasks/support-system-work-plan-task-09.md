# Task 09: `SupportWidget` Tree + 5 Mount Points + 20s Timeout Race (Work Plan Phase 2, Task 2.2)

Metadata:
- Dependencies: support-system-work-plan-task-08 (Deliverable: `support.*` i18n keys), support-system-work-plan-task-06 (Deliverable: real `submitSupportTicket` contract for the eventual live-backend wiring pass — component tests themselves mock the boundary and do not block on this)
- Provides: `SupportWidget`/`SupportWidgetTrigger`/`SupportWidgetDialog`/`IntentSelector`/`MessageField`/`ScreenshotAttachment` (consumed by task-10's Early Verification Point and task-11's fixture-e2e journey)
- Size: Large (11 files: 6 components + 5 layout/page mount edits) — see Notes for the split rationale kept as one task

## Implementation Content

Create `SupportWidget` (self-guards on `user !== null` AND not-attempt-route, single regex constant), `SupportWidgetTrigger`, `SupportWidgetDialog` (phase state machine: `compose → submitting → (compose, error) | (success)`; `Promise.race` against a 20000ms timeout with an `attemptId` guard discarding a late real response), `IntentSelector`, `MessageField`, `ScreenshotAttachment` (client pre-validation against `LIMITS.MAX_SCREENSHOT_BYTES`/`ALLOWED_SCREENSHOT_MIME`, `URL.createObjectURL`/`revokeObjectURL` lifecycle). Mount `<SupportWidget user={user} />` as an additive sibling to `<BottomNav />` in `(layer2)/layout.tsx`, `(layer3)/layout.tsx`, `(layer4)/layout.tsx`, `(HM)/layout.tsx`, and `app/page.tsx` — no existing line removed.

## Target Files
- [ ] `SOURCE/components/support/SupportWidget.tsx` (new)
- [ ] `SOURCE/components/support/SupportWidgetTrigger.tsx` (new)
- [ ] `SOURCE/components/support/SupportWidgetDialog.tsx` (new)
- [ ] `SOURCE/components/support/IntentSelector.tsx` (new)
- [ ] `SOURCE/components/support/MessageField.tsx` (new)
- [ ] `SOURCE/components/support/ScreenshotAttachment.tsx` (new, + test files for each of the 6 components above)
- [ ] `SOURCE/app/(layer2)/layout.tsx` (additive — sibling `<SupportWidget user={user} />`)
- [ ] `SOURCE/app/(layer3)/layout.tsx` (additive)
- [ ] `SOURCE/app/(layer4)/layout.tsx` (additive)
- [ ] `SOURCE/app/(HM)/layout.tsx` (additive)
- [ ] `SOURCE/app/page.tsx` (additive)

## Investigation Targets
- `docs/design/support-system-frontend-design.md` (§ Data Contracts — `SupportWidget`/`SupportWidgetDialog` Output Guarantees; § Component specs — full code/props for all 6 components; § Fact Disposition Table — 20s timeout race + `attemptId` guard rationale; § Minimal Surface Alternatives Elements 1-2 — `ClientSubmitError` union, inline `useState` no hook extraction; § State Transitions — `SupportWidgetDialog` phase machine; § Integration Point Map — widget mount as render prop sibling to `BottomNav`, student submit as direct async call not `useActionState`; § Change Impact Map — the 5 layouts + `page.tsx` additive-sibling change)
- `docs/ui-spec/support-system-ui-spec.md` (§ Component: SupportWidgetTrigger — Default state; § Component: IntentSelector — Default/Empty/Error states; § Component: MessageField — Default/Loading/Error/Partial states; § Component: ScreenshotAttachment — Default/Loading/Empty/Error/Partial states; § Component: SupportWidgetDialog — Default/Loading/Error/Success sub-state)
- `SOURCE/lib/support/actions.ts` (task-06's `submitSupportTicket` — the real contract this dialog will eventually call, and `SubmitTicketResult`'s exact shape)
- `SOURCE/lib/support/types.ts`, `SOURCE/lib/ugc/limits.ts` (task-04's `TicketIntent`/`LIMITS.MAX_SCREENSHOT_BYTES`/`ALLOWED_SCREENSHOT_MIME` — `ScreenshotAttachment`'s client-side pre-validation must reference these constants directly, not a duplicated copy)
- `SOURCE/lib/i18n/dictionaries/vi.ts`, `en.ts` (task-08's `support.*` keys — every display string must resolve through `useT()`/`getTranslate()`)
- `SOURCE/app/(layer2)/layout.tsx`, `(layer3)/layout.tsx`, `(layer4)/layout.tsx`, `(HM)/layout.tsx`, `SOURCE/app/page.tsx` (current render trees — the exact insertion point next to `<BottomNav />`)
- `SOURCE/components/` (an existing component using `usePathname()` for route-matching, to mirror the attempt-route regex-matching convention)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/support-system-frontend-design.md (§ Data Contracts — `SupportWidget` Output Guarantees) | state-lifecycle-negative | "returns null (no DOM node) when user is null (AC-003) OR when usePathname() matches the (layer2) attempt-route pattern /^\/exams\/[^/]+\/attempt\/[^/]+$/ (AC-005) — both checks run on every render" | Does `SupportWidget` return `null` (no DOM node, not a hidden one) when `user === null`, and separately when `usePathname()` matches the attempt-route regex, with both checks evaluated on every render (Y/N)? |
| docs/design/support-system-frontend-design.md (§ Data Contracts — `SupportWidgetDialog` Output Guarantees) | state-lifecycle-negative | "phase only ever transitions compose -> submitting -> (compose, with submitError set) \| (success, with result set) — never compose -> success directly (AC-040)" | Does `SupportWidgetDialog`'s phase state machine only ever transition `compose -> submitting -> (compose, error) | (success)`, with no direct `compose -> success` transition reachable through any interaction path (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `SupportWidgetDialog` (browser) → `submitSupportTicket` (Server Action). This task owns the **left-side / client** owner (`SOURCE/components/support/SupportWidgetDialog.tsx`); the right-side server owner (`SOURCE/lib/support/actions.ts`) is task-06.

- **Serialized Format**: `multipart/form-data` (`intent`, `message`, `pageUrl`, `userAgent`, `screenWidth`, `screenHeight`, optional `screenshot` File).
- **Consumer Parse Rule**: `formData.get(name)` per field server-side; screenshot via `formData.get("screenshot")` as `File`.
- **Roundtrip check this task must satisfy**: every field this dialog constructs into `FormData` uses the exact key name task-06's server action reads; an omitted optional field (no screenshot attached, metadata capture unavailable) must not be sent as an empty string that server-side parsing would misread as present.
- **Expected Signal**: the response matches the closed `SubmitTicketResult` union — this task's own component tests mock `submitSupportTicket` and assert the dialog reacts correctly to every variant; the real end-to-end reconciliation with task-06's actual implementation happens at task-11's fixture-e2e journey and the manual live-wiring pass task-06/task-09's dependency edge names.

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact attempt-route regex and the 20s timeout/`attemptId` guard mechanics.
- [ ] Write failing component tests: `SupportWidget` across all four `{user, pathname}` combinations (present/present-but-attempt-route/absent-user/absent-user-attempt-route); `SupportWidgetDialog` against every mocked `SubmitTicketResult` variant plus the timeout branch; `IntentSelector`'s exactly-3-options assertion (`getAllByRole("radio")` length 3, explicit 4th-option absence).
- [ ] Run tests and confirm failure (components don't exist yet).

### 2. Green Phase
- [ ] Implement all 6 components exactly per the frontend DD's Component specs and UI Spec's State × Display matrices.
- [ ] Mount `<SupportWidget user={user} />` as an additive sibling to `<BottomNav />` in all 5 target files.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); re-confirm both Reference Contracts' Compliance Checks.
- [ ] Code-review pass for AC-035 (zero hard-coded display string) — no automated check exists for this in this repo; record the review outcome in Investigation Notes.
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: component unit/integration coverage — Config: `SOURCE/vitest.config.ts` (`include: components/**`)
- Production build in CI (`npx next build`) — Enforces: build correctness — Config: `.github/workflows/ci.yml:74-80`

## Operation Verification Methods
- **Verification method**: component tests mounting `SupportWidget` across `{user, pathname}` combinations; mocked-`submitSupportTicket` tests covering every `SubmitTicketResult` variant plus the timeout branch; `IntentSelector` exactly-3-options test.
- **Success criteria**: all component tests green; `tsc`/lint clean; AC-035's zero-hard-coded-string claim confirmed by code review (no automated check exists — recorded QA gap, not silently assumed covered).
- **Failure response**: if a `{user, pathname}` combination renders incorrectly, re-check the regex against the real attempt-route pathname shape before adjusting the guard condition.
- **Verification level**: L2 (component tests green) at this task's own scope; the real, browser-verified guard is task-10's Early Verification Point, deliberately sequenced next.

## Proof Obligations
- **Claim**: `SupportWidget` renders in exactly the union of "authenticated AND not attempt-route" pages, never elsewhere and never nowhere on that set (AC-001, AC-003, AC-005, AC-007).
- **Primary failure mode**: the attempt-route regex mismatches the real pathname shape, or the guard checks only one of the two conditions instead of both on every render.
- **Boundary to exercise**: in-process unit (component test, mocked `usePathname()`/`user` prop).
- **State assertion**: N/A (render-only, no persisted state).
- **Mock boundary rationale**: `usePathname()` mocked at the framework boundary per frontend DD Test Boundaries.
- **Residual**: real browser/real route verification is task-10's Early Verification Point.
- **Claim**: `SupportWidgetDialog` never reaches Success except immediately after `submitSupportTicket` resolves `{ ok: true }`; every error path preserves intent/message/screenshot selection verbatim (AC-020, AC-039, AC-040).
- **Primary failure mode**: an optimistic-success bug shows the acknowledgement before the promise resolves; or a refusal/timeout clears the student's typed input instead of preserving it.
- **Boundary to exercise**: in-process unit (component test, mocked `submitSupportTicket`).
- **State assertion**: before = compose phase with typed input; action = submit against a mocked refusal/timeout; after = still compose phase, with intent/message/screenshot selection unchanged.
- **Mock boundary rationale**: `submitSupportTicket` mocked at the module boundary per frontend DD Mock Boundary Decisions.
- **Residual**: the full multi-step journey (open → select → type → attach → submit → acknowledge) is proven end-to-end by task-11's fixture-e2e journey, not by these unit-level component tests alone.
- **Claim**: `IntentSelector` renders exactly three intent options and no fourth (AC-001).
- **Primary failure mode**: a fourth option is reachable through some interaction path not covered by the three fixed buttons (e.g. a stray extra `<button role="radio">` from a copy-paste error).
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — pure render assertion.
- **Residual**: none.
- **Claim**: `SupportWidgetDialog`'s `phase === "submitting"` guard prevents a repeat click/Enter from firing a second `submitSupportTicket` call while a submit is in flight (`no-op` Failure Mode Checklist category).
- **Primary failure mode**: a double-click or repeat Enter keypress during the submitting phase fires a second concurrent call, risking a duplicate ticket.
- **Boundary to exercise**: in-process unit (component test, simulated repeat interaction during the submitting phase).
- **State assertion**: before = phase is `submitting`; action = a second click/Enter fires; after = the mocked `submitSupportTicket` was invoked exactly once, not twice.
- **Mock boundary rationale**: `submitSupportTicket` mocked; `aria-disabled` state asserted alongside the call-count assertion.
- **Residual**: none.

## Completion Criteria
- [ ] All added component tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [ ] Matches the frontend DD's Data Contracts for each component exactly, and the UI Spec's State × Display matrices for all 5 UI-Spec-mapped components
- [ ] `tsc`/lint clean
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] AC-035's zero-hard-coded-display-string claim confirmed by code review, recorded in Investigation Notes (no automated check exists — recorded QA gap)

## Notes
- Impact scope: `SOURCE/components/support/**` (new) + additive sibling-render edits to the 5 layout/page files.
- Scope boundary: no existing line in any of the 5 layout/page files is removed or reordered — the `SupportWidget` mount is strictly additive. This task is kept as one task despite touching 11 files because all 6 components + all 5 mount points form a single indivisible, mutually-referencing render tree (`SupportWidget` imports all 5 children; splitting the mount points across separate commits would leave the widget importable-but-unmounted in an inconsistent intermediate state).
- Real, browser-verified proof of the mount-point guard and 360px layout is task-10's Early Verification Point, deliberately sequenced immediately after this task — do not treat this task's component-test-level proof as sufficient on its own.
