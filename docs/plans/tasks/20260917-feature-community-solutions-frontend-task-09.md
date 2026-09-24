# Task 09: Write-screen children — `SolutionEditorHeader`, `SolutionSettingsPanel`, `NoteQuestionRow`, `SolutionPublishBar`

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P1-T9 (split 1/2) — the plan entry lists 9 target files (> 5), so it is split: this file = the prop-driven child components; task 10 = `SolutionEditorScreen` + route + `attemptId` boundary
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T9)
- **Dependencies**: task 01 (P1-T1, relocated `QuestionPaletteDock` with `cells[]`), task 07 (P1-T7, `SettingSwitch`)
- **Provides**: four presentational components with typed props, composed by task 10; the additive optional prop `SettingSwitch.lockReasonId?` (frontend DD § Main Components `components/ui/SettingSwitch.tsx`, Element 7); the 0-question blocked "Bảng câu hỏi" trigger on the write screen (DD-U4); the copy key `solutions.emptyExam` (first consumer in execution order)
- **Size**: Medium (4 new components + 1 extended primitive + component tests)

## Implementation Content

- `SolutionEditorHeader` — title "Bài giải của bạn", progress bar + "a/N câu đã ghi chú", status badge, and `QuestionPaletteDock` wired with `cells[]` + `triggerLabel="Bảng câu hỏi"` (label text from `SOURCE/lib/copy.ts`).
  - **0 current questions (DD-U4, UI Spec `C-21` "Rỗng")**: condition `cells.length === 0`. The header does **not** mount `QuestionPaletteDock`; in its place it renders one `<button type="button">` with the dock's resting trigger classes (`cn(chipVariants({ active: false }), "gap-1.5 px-3 tabular-nums h-11")`), a `LayoutGrid` icon with `aria-hidden`, visible text `t("common.questionPalette")`, `aria-disabled="true"`, and `aria-describedby` set to the `useId()` id of the header's own "Rỗng" sentence `t("solutions.emptyExam")` ("Đề này hiện không còn câu hỏi nào."; progress bar hidden while N = 0). No `aria-expanded`, no `aria-controls`, no `onClick`, never the native `disabled` attribute (UI-D25); no panel exists. `SOURCE/components/shared/QuestionPaletteDock.tsx` stays unchanged.
  - Adds `solutions.emptyExam` to `SOURCE/lib/copy.ts` with its verbatim UI Spec value if it is not there yet (owning-task rule: the first task in execution order that renders a key adds it).
- `SolutionSettingsPanel` — two `SettingSwitch` rows: "Hiện hồ sơ" (default **on**) and "Hiện điểm và lựa chọn gốc" (default **off**), with their sub-lines. It accepts an optional `lockReasonId` and forwards it to **both** switches for the read-only "Chỉ đọc (bài bị ẩn)" row; task 10 supplies the id of the `ModerationReasonBanner` from `SolutionEditorScreen` (task 39 wires the alert variant).
- `SettingSwitch` (`SOURCE/components/ui/SettingSwitch.tsx`, committed in `e4b278d`) — one optional prop added: `lockReasonId?: string`. It renders `aria-describedby={[descriptionId, lockReasonId].filter(Boolean).join(" ")}` — both ids (description first) when the row is locked, `descriptionId` alone otherwise. No other behaviour changes and `disabled` keeps its current meaning; every existing call site keeps compiling and renders the same `aria-describedby`.
- `NoteQuestionRow` — the 4 states from UI-D7: Đã ghi chú / Chưa ghi chú / Chưa đủ 15 từ / Câu hỏi đã thay đổi; row ≥56px.
- `SolutionPublishBar` — states draft-incomplete, ready, published, publish-rejected, rate-limited. "Đăng" uses `aria-disabled` + `aria-describedby`, **never** native `disabled` (UI-D25). "Đăng" becomes enabled only when every current question has ≥15 words (client mirror of the server gate, defensive only). After publish the bar shows "Gỡ về nháp" / "Xem bài giải" (AC-030). Sticks above `BottomNav` and carries `data-bottom-bar`.

All four take data via props only; state ownership (reducer) is task 10's.

## Acceptance Criteria

From the plan (§ P1-T9), rows that apply to these files: **AC-027, AC-028, AC-030 (bar half), AC-050 / UI-D26 palette cells (Reference Contract Value #9)**; frontend DD v1.6 EARS (UI Spec `C-21` "Rỗng", DD-U4): "**While** the exam has 0 current questions, the write screen and the view screen shall render the 'Bảng câu hỏi' trigger with `aria-disabled="true"` and an accessible description of 'Đề này hiện không còn câu hỏi nào.', with no `disabled` attribute, and pressing it shall open no panel" (write-screen half here; view-screen half in task 22).

Carried hard constraints that apply to this task:
- **Task 01 must have landed** before creating `SOURCE/features/solutions/components/**`.
- `SOURCE/components/shared/QuestionPaletteDock.tsx` (and `QuestionPagination.tsx`) stay **unchanged**: `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` is empty.
- The only edit to a committed primitive is the additive optional `SettingSwitch.lockReasonId?`; every existing `SettingSwitch.test.tsx` case stays green unchanged.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`editor.*`, `row.*`, `bar.*` keys from UI Spec § "Chuỗi tiếng Việt cần thêm" → Màn viết).
- 360px floor; 44px touch targets (56px question rows); "Đêm hội" tokens only from `SOURCE/app/globals.css`; motion only via existing `.motion-*` / `usePresence`.
- State conveyed by icon **and** text/accessible name, never colour alone.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionEditorHeader.tsx` (new)
- [x] `SOURCE/features/solutions/components/SolutionSettingsPanel.tsx` (new)
- [x] `SOURCE/features/solutions/components/NoteQuestionRow.tsx` (new)
- [x] `SOURCE/features/solutions/components/SolutionPublishBar.tsx` (new)
- [x] `SOURCE/components/ui/SettingSwitch.tsx` (extend: `lockReasonId?`)
- [x] `SOURCE/components/ui/SettingSwitch.test.tsx` (extend: two `lockReasonId` cases; existing cases untouched)
- [x] `SOURCE/lib/copy.ts` (add `solutions.emptyExam` if absent; other `editor.*`/`row.*`/`bar.*` keys per the owning-task rule)
- [x] Component tests for the four components (under `SOURCE/features/solutions/components/__tests__/`), including the empty palette trigger case

## Investigation Targets
- `SOURCE/components/shared/QuestionPaletteDock.tsx` (task 01 deliverable: `cells`, `triggerLabel`, `panelTitle`, `panelMeta` props)
- `SOURCE/components/ui/SettingSwitch.tsx` and `SOURCE/components/ui/SettingSwitch.test.tsx` (task 07 deliverables; `descriptionId` is a single id today)
- `SOURCE/components/ui/progress.tsx`, `SOURCE/components/ui/badge.tsx`, `SOURCE/components/ui/button.tsx`
- `SOURCE/lib/copy.ts`
- `docs/design/community-solutions-frontend-design.md` (§ Technical Dependencies — Slice B)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionEditorHeader`, `SolutionSettingsPanel`, `NoteQuestionRow`, `SolutionPublishBar`)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `components/ui/SettingSwitch.tsx` "Interface addition (v1.3)"; "Empty palette trigger on the write and view screens")
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives — Element 5 blocked trigger, Element 7 `lockReasonId`; § UI Spec Deviations DD-U4)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "`SettingSwitch` `lockReasonId` test", "Empty palette trigger tests")
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation / rate-limit rows)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionEditorHeader — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionSettingsPanel — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SettingSwitch — verify on + off + busy + disabled states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: NoteQuestionRow — verify Đã ghi chú + Chưa ghi chú + Chưa đủ 15 từ + Câu hỏi đã thay đổi states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionPublishBar — verify draft-incomplete + ready + published + publish-rejected + rate-limited states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: QuestionPaletteDock — verify write-cell-states (4))
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D7`, `UI-D25`, `UI-D26`; § Visual Acceptance golden states 5, 6, 10; § Yêu cầu trợ năng rows `C-12`, `C-13`, `C-14`, `C-21`)
- `docs/prd/community-solutions-prd.md` (AC-027, AC-028, AC-030, AC-050)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/community-solutions-ui-spec.md` (UI-D26) | derived-display | UI-D26 palette cell state set: Đã ghi chú→`Check`/"Câu k, đã ghi chú"; Chưa ghi chú/chưa đủ 15 từ→`Minus`/"Câu k, chưa ghi chú"·"Câu k, chưa đủ 15 từ"; Câu hỏi đã thay đổi→`RefreshCw`/"Câu k, câu hỏi đã thay đổi" | `SolutionEditorHeader` builds `cells[]` so each palette cell's icon and accessible name equal the UI-D26 pair for its row state |

## Investigation Notes
(Append observations here before implementation begins. Record the Reference Contract Compliance Check result.)

- `QuestionPaletteDock.tsx` (`SOURCE/components/shared/QuestionPaletteDock.tsx`): additive `cells?: QuestionCell[]`, `triggerLabel?: ReactNode`, `panelTitle?/panelMeta?: string`, always-required `current`/`total`/`onJump`. With `cells` present, `answeredIndices`/`flaggedIndices` are ignored, trigger auto-gains `h-11` (write-screen 44px floor), and the panel `<section>` carries `aria-label={t("common.questionPalette")}` ("Bảng câu hỏi") — that `<section>` is the accessible `role="region"` the empty-trigger tests check is absent. Trigger accessible name is always `t("common.questionPalette")` regardless of `triggerLabel` (visible text only). Resting-trigger class for the blocked button (0 questions) = `cn(chipVariants({ active: false }), "gap-1.5 px-3 tabular-nums h-11")` per `QuestionPaletteDock.tsx:107` and DD § Main Components "Empty palette trigger". File is untouched by this task (verified via `git diff --stat` at Green phase).
- `QuestionPagination.tsx` (`SOURCE/components/shared/QuestionPagination.tsx`): `QuestionCell = { index: number; state: QuestionCellState; label: string }`; write-screen states used here are `"noted" | "missing" | "short" | "changed"` (the `WRITE_LOOK` map: noted→`Check`/`bg-primary`, missing/short→`Minus`/`bg-surface`, changed→`RefreshCw`/`bg-sun-soft`) — confirms UI-D26 exactly. The committed fixture test (`SOURCE/components/shared/__tests__/QuestionPaletteDock.test.tsx`, "nhánh cells[] — UI-D26") pins the literal cell `label` strings this task's `cells[]` must reproduce verbatim: `"Câu 1, đã ghi chú"`, `"Câu 2, chưa ghi chú"`, `"Câu 3, chưa đủ 15 từ"`, `"Câu 4, câu hỏi đã thay đổi"` — lower-case first letter after the comma. This task's shared `noteRowCellLabel()` helper (exported from `NoteQuestionRow.tsx`) lower-cases the first letter of the same `solutions.row.*` string already used for the row's own visible text, so both surfaces read one lookup (Refactor step).
- `SettingSwitch.tsx`/`SettingSwitch.test.tsx` (committed `e4b278d`): `aria-describedby={descriptionId}` (single id) before this task's edit; 8 existing test cases, none asserting a specific string shape beyond `toBe(BASE.descriptionId)` — confirmed compatible with the additive `[descriptionId, lockReasonId].filter(Boolean).join(" ")` change (empty/undefined `lockReasonId` collapses to `descriptionId` alone, no trailing space). `disabled`/`busy` already use `aria-disabled`/`aria-busy`, no native `disabled` anywhere — pattern reused for the four new components' own disabled affordances (`UI-D25`, matches `ActionButton.tsx:70-88`'s `aria-disabled={x ? "true" : "false"}` + guarded `onClick` idiom, and `ConfirmDialog.tsx`'s `aria-disabled:opacity-60` class convention).
- `SOURCE/components/ui/progress.tsx`: `Progress({ value, max, size, ...props })` renders `role="progressbar"`; caller supplies `aria-labelledby` pointing at its own progress-text element's `id` (no built-in label).
- `SOURCE/components/ui/badge.tsx`: `Badge` variants `plain/surface/sun/success/wrong/muted/outline` — used `muted` for "Nháp", `success` for "Đã đăng" (reusing existing top-level `status.published` key, same text "Đã đăng"), `wrong` for "Bị ẩn".
- `SOURCE/components/ui/button.tsx`: `Button` wraps `@base-ui/react` `Button`; `buttonVariants` (cva) exported for building raw `<button className={buttonVariants(...)}>` elements that need `aria-disabled` instead of native `disabled` (UI-D25) — same idiom `ConfirmDialog.tsx` already uses for its primary button.
- `SOURCE/lib/copy.ts`: confirmed `solutions.switch.on/off`, `solutions.dirty.*`, `status.published` ("Đã đăng") already present; `solutions.emptyExam`, `solutions.status.draft/hidden`, `solutions.editor.*`, `solutions.row.*`, `solutions.bar.*` were absent before this task and are added now (owning-task rule; `solutions.status.*` was listed in the DD's table as owned by task 08, but grep confirmed task 08's `SolutionEntryCard` never rendered it — this task is the actual first renderer via the status badge, so it is added here per the general rule, which is authoritative over the table when they disagree). `profile.error.rateLimited` (existing) reused verbatim for `SolutionPublishBar`'s rate-limited state — no new key.
- `docs/design/community-solutions-frontend-design.md` § Main Components confirms: (a) `SettingSwitch.lockReasonId?` renders `aria-describedby` with description id first, lock id second, no other behaviour change; (b) the empty-palette trigger never mounts `QuestionPaletteDock`, has no `aria-expanded`/`aria-controls`/`onClick`, never native `disabled`; description target is the header's own "Rỗng" sentence id (`useId()`). § Data Contracts ties `SolutionEditorState`/`OwnSolutionSummary` fields (`note`, `wordCount`, `hasChanged`, `showProfile`, `showScore`, `status: SolutionStatus | null`) to what a future task 10 will derive into this task's component props; this task defines those props itself (no interface pinned in the DD for the 4 new components beyond their responsibility/shape prose), so `SolutionEditorHeaderProps.questionStates: NoteRowState[]` (one array, `a`/`N` derived from it) and `SolutionPublishBarProps` (`totalCount`, `incompleteCount`, `error?`) are this task's own minimal design, consistent with the DD's state names.
- **Reference Contract Compliance Check (UI-D26 palette-cell row, derived-display)**: planned approach — `SolutionEditorHeader` computes `cells: QuestionCell[]` from a `questionStates: NoteRowState[]` prop via the shared `NOTE_ROW_ICON`/`NOTE_ROW_LABEL_KEY` lookup exported by `NoteQuestionRow.tsx`, producing exactly the icon+label pairs the UI-D26 table and the committed `QuestionPaletteDock.test.tsx` fixture pin. Evaluation: **Y** — same lookup and same lower-cased label format already proven correct by the pre-existing fixture test, reused rather than re-derived.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests: `NoteQuestionRow` renders each of the 4 states with icon + text; `SolutionPublishBar` "Đăng" has `aria-disabled="true"` + `aria-describedby` pointing at the reminder line when any question <15 words and no `disabled` attribute ever; enabled when all ≥15; published state shows "Gỡ về nháp"/"Xem bài giải"; rate-limited shows `role=alert` with `{seconds}`; `SolutionSettingsPanel` defaults (profile on, score off); header palette cells match UI-D26
- [x] Write failing `SettingSwitch` tests (frontend DD § Test Boundaries): with `lockReasonId` supplied, `aria-describedby` contains both the description id and the lock-reason id, in that order; without it, `aria-describedby` equals `descriptionId` exactly (no trailing space, no extra token) and every existing case in `SettingSwitch.test.tsx` stays green. Add a `SolutionSettingsPanel` case: rendered with `lockReasonId`, both switches carry it in `aria-describedby` after their own description id
- [x] Write the failing empty-palette-trigger test (frontend DD § Test Boundaries): `SolutionEditorHeader` with 0 current questions renders a button named "Bảng câu hỏi" with `aria-disabled="true"`, whose accessible description is "Đề này hiện không còn câu hỏi nào.", with no `disabled` attribute; after pressing it, `screen.queryByRole("region", { name: "Bảng câu hỏi" })` is `null` (no panel); with 1 or more questions the real `QuestionPaletteDock` renders instead
- [x] Run and confirm failure — confirmed red (component files did not exist / `SettingSwitch` lacked `lockReasonId`) before implementation; two RTL query fixes needed mid-flight (`Button render={<Link/>}` exposes `role="button"` not `role="link"`; `NoteQuestionRow` renders 2 `<svg>` per row — state icon + `ChevronRight` — not 1), both fixed in the same Red→Green pass

### 2. Green Phase
- [x] Implement the four components, the `SettingSwitch.lockReasonId?` prop and the header's blocked trigger
- [x] Run only the added tests and confirm they pass; confirm `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` is empty — both confirmed (53/53 new tests green; diff empty)

### 3. Refactor Phase
- [x] Share one row-state → (icon, label key) lookup between `NoteQuestionRow` and the header's `cells[]` — `NOTE_ROW_ICON`, `NOTE_ROW_LABEL_KEY` and `noteRowCellLabel()` exported from `NoteQuestionRow.tsx`, imported by `SolutionEditorHeader.tsx`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs` — Covers: `SOURCE/features/solutions/**`, `SOURCE/components/shared/QuestionPaletteDock.tsx`
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/` and read the four component test files, the extended `SettingSwitch.test.tsx`, and `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx`.
- **Success criteria**: all four `NoteQuestionRow` states and all five `SolutionPublishBar` states render as specified; no `disabled` attribute on "Đăng" in any state; palette cells equal UI-D26; the `lockReasonId` and empty-trigger tests pass; the shared palette diff is empty.
- **Failure response**: if a state cannot be expressed with props alone (needs internal fetch), stop — data flows from task 10's reducer only.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (UI-D25 / AC-028): "Đăng" is never natively disabled; when blocked it carries `aria-disabled` and an `aria-describedby` reason naming the remaining count.
- **Primary failure mode**: native `disabled` removes the button from focus order and hides the reason from screen-reader users (and adds a `[disabled]` node the fixture lane forbids).
- **Boundary to exercise**: rendered `SolutionPublishBar` DOM.
- **State assertion**: props with 1 short note → `aria-disabled="true"` + reason text contains the count; props with 0 short notes → `aria-disabled` absent/false.
- **Mock boundary rationale**: none.
- **Residual**: the end-to-end publish gate through real UI is proven in task 23 (J1).

- **Claim** (UI-D7 / AC-050): each row and palette cell conveys its state by icon **and** accessible name.
- **Primary failure mode**: "Chưa đủ 15 từ" and "Chưa ghi chú" render identically, or state is colour-only.
- **Boundary to exercise**: rendered DOM queried by accessible name.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: 44px/56px sizing measured in task 49.

- **Claim** (frontend DD § Main Components `SettingSwitch`, Element 7): the read-only settings row keeps the switch's own description **and** points at the moderation-reason banner — `aria-describedby={[descriptionId, lockReasonId].filter(Boolean).join(" ")}`.
- **Primary failure mode**: the lock reason replaces the description (or a trailing space/empty token is emitted when no lock id exists), so a screen-reader user loses the row's own sub-line or existing call sites change their DOM.
- **Boundary to exercise**: rendered `SettingSwitch` with and without `lockReasonId`, and `SolutionSettingsPanel` forwarding it.
- **State assertion**: with the prop → `aria-describedby` = `"<descriptionId> <lockReasonId>"`; without → exactly `descriptionId`; every pre-existing `SettingSwitch.test.tsx` case still passes.
- **Mock boundary rationale**: none.
- **Residual**: the banner's own id and the hidden-solution state come from task 10 / task 39.

- **Claim** (frontend DD DD-U4, UI Spec `C-21` "Rỗng"): with 0 current questions the write screen shows the "Bảng câu hỏi" trigger as blocked with its reason and opens no panel.
- **Primary failure mode**: the dock is mounted with an empty `cells[]` (a live trigger opening an empty panel), or the trigger uses native `disabled` (leaves the focus order, hides the reason).
- **Boundary to exercise**: rendered `SolutionEditorHeader` with `cells = []`.
- **State assertion**: button "Bảng câu hỏi", `aria-disabled="true"`, description "Đề này hiện không còn câu hỏi nào.", no `disabled` attribute, no region after pressing; `QuestionPaletteDock.tsx` diff empty.
- **Mock boundary rationale**: none.
- **Residual**: the view-screen half is task 22.

## Completion Criteria
- [x] All added tests pass — 53/53 new tests green (`npm test` inside `SOURCE/`, plus full suite 2218 passed/10 skipped unaffected)
- [x] Operation verified per Operation Verification Methods above — `npm test` run, all four `NoteQuestionRow`/`SolutionPublishBar` states verified, no `disabled` attribute on "Đăng" in any state, palette cells equal UI-D26, `lockReasonId`/empty-trigger tests pass, `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` empty
- [x] Each Proof Obligation is met — all 4 (UI-D25/AC-028, UI-D7/AC-050, `SettingSwitch` Element 7, DD-U4/`C-21` "Rỗng") have passing assertions in the new test files
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes — UI-D26 row: `Y`, verified against the pre-existing `QuestionPaletteDock.test.tsx` fixture's literal cell labels/icons

## Notes
- Impact scope: task 10 composes these; task 39 renders them read-only for a hidden solution.
- Scope boundary: no data fetching and no Server Action calls inside these four components; `SettingSwitch.tsx` gains only the optional `lockReasonId?` prop; `SOURCE/components/shared/QuestionPaletteDock.tsx` unmodified.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
