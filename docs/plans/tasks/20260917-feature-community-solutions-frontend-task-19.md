# Task 19: `SolutionAuthorCard` + `HelpfulButton` + `SolutionMenu` (pin only)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T6 (split 1/3) — the plan entry lists 9 target files (> 5), so it is split: this file = the view screen's header card and its actions; task 20 = question rows + note block; task 21 = screen + route
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T6)
- **Dependencies**: task 15 (P2-T3, `toggleHelpful`/`setPin`), task 17 (P2-T5 split 1/2, `AuthorIdentity`)
- **Provides**: header card for the view screen (composed by task 21); `SolutionMenu` extended with the report **dialog** in task 36 (the item's two states are already rendered here)
- **Size**: Small (3 files + component tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, backend DD **v1.9** (the `toggleHelpful` / `setPin` contracts consumed here), work plan **v1.3**

## Implementation Content

- `SolutionAuthorCard` — states default, pinned ("Tác giả đề ghim"), anonymous; identity via `AuthorIdentity`; "Cập nhật …" via `relativeTime` (with the `now` the screen passes down); action row: `HelpfulButton`, score badge, "⋯" `SolutionMenu`. When the viewer is the author (AC-062): the Helpful button is replaced by the text "x hữu ích".
- **Score badge — exactly two shapes and no third** (Reference Contract Value #18): `score` present and `scoreGrading` absent-or-`false` → `result.outOfTen` ("7.5 trên 10"); `score` present and `scoreGrading === true` → `solutions.scorePending` ("7.5 trên 10 · đang chấm"). `score` **absent** → **no badge at all**, whatever `scoreGrading` says (AC-040 wins over AC-041). `scoreGrading` is present if and only if `score` is — both are projected through the same `show_score` switch and dropped together by the mapper — so there is **no degraded path** and no hedge: the card plans for no response carrying `score` without the grading flag's decision. Decimal point, not comma (UI-D3/D47).
- **`HelpfulButton` — `toggleHelpful(solutionId)`, one argument** (frontend DD § Data Contracts "Helpful toggle contract"; Reference Contract Value #21). There is **no target-state flag**: the action calls `add_community_solution_helpful` and, only when it returns `added = false`, `remove_community_solution_helpful`, so the returned `on` is the row's presence in the database after the call, never a client flag.
  - Interface: `HelpfulButton({ solutionId, initialPressed, initialCount, onError })`, seeded from `SolutionDetail.iMarkedHelpful` / `helpfulCount`. `SolutionAuthorCard` passes `onError` and renders the message in a `role="alert"` line **directly below its card**; `null` removes the line.
  - Sequencing (does not rely on the framework serialising Server Actions): every press flips `desiredOn` first; a press with `inFlight = false` sends one call; a press with `inFlight = true` sends **none**; on an `ok` result, if the confirmed `on` differs from `desiredOn`, send **exactly one** corrective call, otherwise clear `inFlight`. After any burst, at most one call is in flight and the final state equals the last press (AC-064).
  - `aria-pressed` shows `desiredOn`; the count shows `confirmedCount ± 1` while intent and confirmation disagree; `aria-busy="true"` while in flight, and the button **stays pressable**.
  - On error: revert `desiredOn` and the count to the last server-confirmed values; `generic` → `onError(t("solutions.view.helpfulError"))` ("Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé."); `rateLimited` → `onError(t("profile.error.rateLimited", { seconds }))`. No `console.error` on the client — the Server Action already logs unexpected RPC codes.
- `SolutionMenu` — **pin items in this task**: "Ghim bài này" / "Bỏ ghim" (`solutions.menu.pin` / `solutions.menu.unpin`, exam author only) and "Sửa bài giải" (`solutions.menu.edit`) for the solution's own author (AC-062). Pin calls `setPin(examId, action, solutionId)` **passing the row's own `id` as the third argument** (Reference Contract Value #22) — the RPC re-checks that the id is a published solution of `p_exam_id` (else `22023`), and `'unpin'` ignores it. A generic failure renders `solutions.menu.pinError` in a `role="alert"` line in the menu panel. Escape / outside tap closes and returns focus to "⋯".
- **Report item's two states, rendered here from `iReported` (frontend DD v1.6 § Data Contracts `SolutionDetail`, "Render rule — SOLUTION MENU")**: `SolutionDetail.iReported` is a **required boolean** that arrives with the read and is the only source of the already-reported state on a fresh render. `false` → the ordinary "Báo cáo bài giải" item (`solutions.menu.report`); `true` → in its place a single item whose text is `solutions.menu.reported` ("Bạn đã báo cáo bài giải này.") carrying `aria-disabled="true"`, **no** native `disabled` and **no** `onClick`, so it is not pressable again. The menu never renders both. Every other item (pin/unpin, "Sửa bài giải") is unaffected. The `ReportDialog` behind the item is added in task 36 — this task renders the states and asserts them so the field cannot be dropped when task 36 lands.
- **Copy keys added here**: `solutions.view.*` and `solutions.menu.*` — including the DD-pinned `solutions.view.helpfulError` and `solutions.menu.pinError`. **Exception**: `solutions.menu.report` and `solutions.menu.reported` belong to **task 36** per the frontend DD's owning-task table; this task renders the two branches using them, so if task 36 has not landed the executor adds only those two keys with their verbatim UI Spec values and nothing else (`MessageKey = keyof typeof copy` makes a duplicate literal a `tsc` error).

## Acceptance Criteria

From the plan (§ P2-T6), rows that apply to these files: **AC-058, AC-062, AC-064, AC-073, AC-074, AC-079, AC-080, AC-101**; Reference Contract Values **#18, #21, #22**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** the user presses "Hữu ích" again while a `toggleHelpful` call is in flight, the system shall keep at most one call in flight, send one corrective call only if the confirmed `on` differs from the latest press, and end with `aria-pressed` and the count matching the latest press. (AC-064)
- **When** `toggleHelpful` returns `{ code: "generic" }`, the system shall revert the pressed state and count to the last server-confirmed values and show "Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé." in a `role="alert"` line below `SolutionAuthorCard`. (AC-064)
- **While** `SolutionDetail.iReported` is `true`, the menu's report item is the text "Bạn đã báo cáo bài giải này." with `aria-disabled="true"`, no native `disabled` and no click handler; **while** it is `false`, the ordinary "Báo cáo bài giải" item; the menu never renders both. (AC-073, AC-074, UI Spec `C-25` "Đã báo cáo")

Carried hard constraints that apply to this task:
- Actions only via `SOURCE/features/solutions/actions.ts`; identity only via `AuthorIdentity`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`view.*`, `solutions.*` keys); 360px floor; 44px touch targets; "Đêm hội" tokens only (pressed Helpful uses `--background` on `--foreground`, 18.3:1); motion only via existing `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionAuthorCard.tsx` (new)
- [x] `SOURCE/features/solutions/components/HelpfulButton.tsx` (new)
- [x] `SOURCE/features/solutions/components/SolutionMenu.tsx` (new — pin/edit items only)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/features/solutions/components/AuthorIdentity.tsx` (task 17)
- `SOURCE/features/solutions/actions.ts` (task 15 — `toggleHelpful(solutionId)` one argument, `setPin(examId, action, solutionId?)` result shapes)
- `SOURCE/features/solutions/queries.ts` (task 14 — the mapped `SolutionDetail` header: `isMine`, `isPinned`, `iMarkedHelpful`, `helpfulCount`, `iReported`, `score`/`scoreGrading`)
- `SOURCE/components/history/HistoryRowMenu.tsx` (existing menu focus-return pattern)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionAuthorCard`, `HelpfulButton` + its error line, `SolutionMenu`; `CommentSheet` section's "Report affordance and the already-reported state (v1.5)" for the twin rule)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Helpful toggle contract"; `SolutionDetail` render rules for the solution menu and the two badge shapes)
- `docs/design/community-solutions-frontend-design.md` (§ Client State Design — "Optimistic state" and "Seeded-from-server state (v1.5)")
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives Element 6 `HelpfulButton.onError`, Element 10 `iReported`)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "`HelpfulButton` component test", "Already-reported tests → Task 19")
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra/dirty-close rows)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionAuthorCard — verify default + pinned + anonymous states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: HelpfulButton — verify off + on + rate-limited states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionMenu — verify default (pin only in Phase 2) state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D8`, `C-20`–`C-25`; § Yêu cầu trợ năng rows `C-24`, `C-25`)
- `docs/prd/community-solutions-prd.md` (AC-058, AC-062, AC-064, AC-079, AC-080)

## Boundary Context
(From the work plan's Connection Map — "Rate-limit rejection → client copy")
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`.
- **Roundtrip check**: the `seconds` number `toggleHelpful`/`setPin` return appears verbatim in the alert text, and the Helpful pressed state reverts to its pre-click value.

(From the work plan's Connection Map — "Pin target"; this task is the producer)
- **Producer**: the `SolutionMenu` pin item passes the row's own `id`.
- **Consumer**: `setPin(examId, action, solutionId?)` (task 15) → `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`.
- **Consumer parse rule** (verbatim): "RPC re-checks the id is a published solution of `p_exam_id`, else `22023`; `'unpin'` ignores it".
- **Expected signal**: the named solution becomes the only pinned row.
- **Roundtrip check**: the id rendered on the card is the id the menu forwards as `setPin`'s third argument (Reference Contract Value #22: "the action forwards its third argument and does not call the RPC with two").

## Investigation Notes
(Append observations here before implementation begins.)

- `AuthorIdentity.tsx` (task 17): `AuthorIdentity({ identity, size })` — discriminated union switch on `identity.kind`; anonymous branch has no name/avatar field to read (compile-time invariant, not runtime discipline). Reused as-is, no changes.
- `actions.ts` (task 15, committed `a2a7e36`): `toggleHelpful(solutionId: string): Promise<ToggleHelpfulResult>` — ONE argument, no target-state flag; `on` in the result is the row's presence in DB after the call (not an echo of client intent). `setPin(examId: string, action: "pin"|"unpin", solutionId?: string): Promise<SetPinResult>` — THREE arguments; `action` validated before `requireUser()`; `solutionId` forwarded verbatim (including `undefined` on `unpin`) to `set_community_solution_pin`. Both error unions carry only `{code:"rateLimited",seconds}` or `{code:"generic"}` — no `error.message` ever read.
- `queries.ts` (task 14): `SolutionDetail` header fields consumed by this task's components: `id`, `author: AuthorIdentity`, `isPinned`, `updatedAt`, `score?`, `scoreGrading?` (present iff `score` is, backend guarantees both null together), `isMine`, `helpfulCount`, `iMarkedHelpful`, `iReported` (required boolean, sole source of already-reported state on a fresh render). No field exists anywhere in `SolutionDetail`/`SolutionListItem` indicating whether the VIEWER is the EXAM's author (distinct from the solution's author) — this signal is out of this query module's scope; `SolutionMenu` accepts it as an explicit `isExamAuthor` boolean prop that the future screen (task 21) will derive from exam data it already holds. This is a normal Props Design decision (new component, no existing interface to violate), not a design/contract gap — AC-077 already mandates the gating behavior, only the wiring mechanism was left to the component's own prop surface.
- `HistoryRowMenu.tsx` (existing menu focus-return pattern): trigger `button` + `aria-haspopup="menu"` + `aria-expanded`; panel positioned via `getBoundingClientRect()` computed in a `useLayoutEffect`, rendered through `createPortal(..., document.body)` with `position: fixed`, flips up/down and clamps height against viewport + BottomNav reserve; full-screen invisible overlay button closes on outside tap; `jsdom` has no `matchMedia`, guarded. `SolutionMenu.tsx` ports this same positioning hook (2nd occurrence — Rule of Three not yet met, not extracted to a shared hook) plus its own `Escape` keydown handler (pattern taken from `QuestionPaletteDock.tsx`, which HistoryRowMenu itself doesn't implement).
- `SolutionCard.tsx` / `SolutionCard.test.tsx` (task 17): confirms the `ScoreBadge` two-shapes pattern (`score === undefined → null`; `scoreGrading` only read when `score` is present) and the `now: Date` / `editHref?` prop conventions this task's `SolutionAuthorCard` mirrors for its own header fields.
- Design/contract gap check: no gap requiring escalation found. The two HANDOFF precedents (AC-022 data projection gap, 23505 logging-rule conflict) are both "committed code/data contradicts a currently-being-implemented requirement" situations; the `isExamAuthor` prop question above is ordinary new-component interface design, within Props Design discretion (typescript-rules skill), and does not contradict any DD/UI Spec/AC text.
- Copy keys added (frontend DD v1.6 § Vietnamese Copy Keys, task 19 row + UI Spec § "Chuỗi tiếng Việt cần thêm" → "Màn xem (S-05)"): `solutions.view.helpful` ("Hữu ích"), `solutions.view.helpfulCount` ("{count} hữu ích" — AC-062 "x hữu ích" text), `solutions.view.helpfulError` (DD-pinned), `solutions.view.more` ("Thêm" — SolutionMenu trigger aria-label), `solutions.menu.pin`, `solutions.menu.unpin`, `solutions.menu.edit`, `solutions.menu.pinError` (DD-pinned). Exception per task file: `solutions.menu.report`/`solutions.menu.reported` added here with their verbatim UI Spec values only (task 36 not yet landed), nothing else from task 36's scope (no `ReportDialog`, no `reportSolution` call).
- `HelpfulButton` sequencing implementation choice: a `useReducer` (single source of truth: `desiredOn`/`confirmedOn`/`confirmedCount`) plus one `useEffect` keyed on `[desiredOn, confirmedOn, solutionId, onError]` that fires a call whenever `desiredOn !== confirmedOn` and no call is in flight (guarded by a `useRef`, not by the `inFlight` state value, specifically so the effect does not re-run — and self-cancel — merely because the "start" dispatch changes `inFlight`). This naturally reproduces the exact spec sequencing: at most one call in flight, and after resolution, exactly one corrective call only if the confirmed `on` still differs from the latest `desiredOn`.

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P2-T6 "Task 19")

`@/features/solutions/actions` is mocked at the module boundary; `lib/solutions/identity.ts` stays real.

**`HelpfulButton`**
1. **At most one call in flight**: three presses while the first call is pending → `toggleHelpful` called **at most twice in total**, and the final `aria-pressed` equals the third press.
2. **`generic` reverts fully**: `{ ok: false, error: { code: "generic" } }` → `aria-pressed` and the count are back to their initial values, and a `role="alert"` below the card reads "Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé."
3. **`rateLimited`**: `{ code: "rateLimited", seconds: 42 }` → the alert text contains "42"; the pressed state and count revert.
4. **One-argument contract**: every recorded `toggleHelpful` call is made with exactly one argument (the solution id) — no target-state flag.

**`SolutionMenu`** (asserted in the same test file as the pin items, so the field cannot be dropped when task 36 lands)
5. `iReported: false` → an **enabled** "Báo cáo bài giải" item and no text matching `/Bạn đã báo cáo/`.
6. `iReported: true` → "Bạn đã báo cáo bài giải này." with `aria-disabled="true"`, **no** `disabled` attribute, and **no** "Báo cáo bài giải" item.
7. **Pin target**: pressing "Ghim bài này" calls `setPin` with `(examId, "pin", <the row's own id>)` — three arguments, the third being the rendered solution's `id`.
8. **Pin failure**: a generic `setPin` failure renders `solutions.menu.pinError` in a `role="alert"` line inside the menu panel.

**`SolutionAuthorCard`**
9. **Badge shapes**: `{ score: 7.5 }` → "7.5 trên 10"; `{ score: 7.5, scoreGrading: true }` → "7.5 trên 10 · đang chấm"; `{ score: 7.5, scoreGrading: false }` → identical to the first; **no** `score` with `scoreGrading: true` → **no badge** and no text matching `/trên 10/`.
10. **AC-062**: `isMine: true` renders the "x hữu ích" text and "Sửa bài giải" in the menu, and **no** Helpful button.
11. **Pinned + anonymous**: a pinned, `{ kind: "anonymous" }` header renders "Tác giả đề ghim" and "Ẩn danh" and no display name or avatar anywhere in the card.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement the three components
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep menu items data-driven, and the report item's two branches in **one** rendering path, so task 36 adds the dialog without restructuring or introducing a second "just reported" appearance
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`.
- **Success criteria**: all component cases green, including the full revert on error.
- **Failure response**: if a stale optimistic value can remain after an error, stop and move the optimistic state into a single reducer that the error path resets.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (plan Integration Complete + AC-064): `HelpfulButton`'s optimistic flip reverts fully on Server Action error — never leaves a stale optimistic value visible; rapid presses keep only the final state.
- **Primary failure mode**: after a failed toggle the button stays pressed (or the count stays incremented) although the server rejected it.
- **Boundary to exercise**: rendered `HelpfulButton` with `features/solutions/actions.ts` mocked at the module boundary.
- **State assertion**: `aria-pressed="false"`, count n → click → `aria-pressed="true"`, n+1 → mocked rejection resolves → `aria-pressed="false"`, n.
- **Mock boundary rationale**: Server Actions mocked (sole component entry point).
- **Residual**: DB-side refusal proven in task 16.

- **Claim** (AC-062): the author viewing their own solution sees "x hữu ích" text and "Sửa bài giải" in the menu, never a Helpful button.
- **Primary failure mode**: authors can press Helpful on their own solution (UI half of D25).
- **Boundary to exercise**: rendered `SolutionAuthorCard` with `isMine: true`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: task 36 adds the `ReportDialog` behind the menu's report item (this task already renders the item's two `iReported` states); task 46 wires real avatars into `SolutionAuthorCard`.
- Scope boundary: **no report dialog and no `reportSolution` call in this task** — only the item's rendered states from `iReported`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
