# Task 22: `QuestionPaletteDock` view-screen usage (current-question highlight + empty trigger)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T7
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T7)
- **Dependencies**: task 01 (P1-T1), task 21 (P2-T6 split 3/3)
- **Provides**: palette navigation on the view screen, and the blocked "Bảng câu hỏi" trigger when the exam has 0 current questions (DD-U4)
- **Size**: Small (1 file + component test)

## Implementation Content

Wire the relocated `SOURCE/components/shared/QuestionPaletteDock.tsx` into `SolutionViewScreen`: the most recently opened row's cell gets `aria-current="true"` + `glow-sun` styling; other cells `bg-surface`. Choosing cell k closes the panel, opens row k in place, and scrolls it into view (AC-051). Panel title "Bảng câu hỏi" + "N câu" (AC-049); `Escape` closes and returns focus to the trigger. Wiring only — the palette component itself is not modified.

**Empty palette trigger (frontend DD DD-U4, UI Spec `C-21` "Rỗng"; § Main Components "Empty palette trigger on the write and view screens")**: when `questions.length === 0` the screen does **not** mount `QuestionPaletteDock`. In its place it renders one `<button type="button">` with the dock's resting trigger classes (`cn(chipVariants({ active: false }), "gap-1.5 px-3 tabular-nums h-11")`), a `LayoutGrid` icon with `aria-hidden`, visible text `t("common.questionPalette")`, `aria-disabled="true"`, and `aria-describedby` set to the `useId()` id of the element **in the same component** that already shows `t("solutions.emptyExam")` ("Đề này hiện không còn câu hỏi nào.") — the dashed "Rỗng" card task 21 renders. No `aria-expanded`, no `aria-controls` (no panel exists), no `onClick`, never the native `disabled` attribute (UI-D25); no disabled-specific styling is added. The key `solutions.emptyExam` was added to `SOURCE/lib/copy.ts` by task 09 (first consumer); this task adds no key. This is the same blocked-trigger shape as the write screen's (task 09), so both screens read alike.

## Acceptance Criteria

From the plan (§ P2-T7): **AC-049, AC-051**; frontend DD v1.6 EARS (UI Spec `C-21` "Rỗng", DD-U4): "**While** the exam has 0 current questions, the write screen and the view screen shall render the 'Bảng câu hỏi' trigger with `aria-disabled="true"` and an accessible description of 'Đề này hiện không còn câu hỏi nào.', with no `disabled` attribute, and pressing it shall open no panel" (view-screen half here; write-screen half in task 09).

Carried hard constraints that apply to this task:
- `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` stays empty (DD-U4: the blocked trigger is "delivered by the two screens, not by the dock").
- Uses the **same** relocated `QuestionPaletteDock` instance as the write screen — no second copy, no edits to the shared component.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`common.questionPalette` reused); 44px cells at 360px; "Đêm hội" tokens only (`--sun-on-solid` on `--sun`, 11.0:1); motion only via existing `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionViewScreen.tsx` (wiring only)
- [x] Component test under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/components/shared/QuestionPaletteDock.tsx` (task 01: props incl. current-cell highlight convention)
- `SOURCE/features/exams/components/ExamPlayer.tsx` (existing current-question highlight usage)
- `SOURCE/features/solutions/components/SolutionViewScreen.tsx` (task 21)
- `SOURCE/features/solutions/components/SolutionEditorHeader.tsx` (task 09 — the write-screen usage and its blocked trigger, to keep both consistent)
- `docs/design/community-solutions-frontend-design.md` (§ UI Spec Deviations DD-U4; § Main Components "Empty palette trigger on the write and view screens"; § Minimal Surface Alternatives Element 5; § Test Boundaries "Empty palette trigger tests")
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `QuestionPaletteDock`/`QuestionPagination` relocation+extension)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: QuestionPaletteDock — verify view-current state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D26` view-screen row; § Yêu cầu trợ năng rows `C-21`; golden state 10)
- `docs/prd/community-solutions-prd.md` (AC-049, AC-051)

## Investigation Notes
- `QuestionPaletteDock.tsx` (task 01): `cells?: QuestionCell[]` (`{index, state, label}`) bypasses `answeredIndices`/`flaggedIndices`; `current`/`total` still required props (only used internally by `QuestionPagination`'s own-scroll effect, harmless when `cells` supplied); `onJump(index)` is called, then the dock itself closes the panel and returns focus to its trigger (`jump()` in the dock — not something this task needs to reimplement). No prop for a controlled/blocked mode exists (confirms DD-U4: blocked trigger must be delivered by the screen, not the dock).
- `ExamPlayer.tsx`: `current` there is a single "which question is showing" index (one question visible at a time) — confirms `current`/`aria-current` in this shared vocabulary always means "one index, screen-owned state", which is the model reused here as `currentIndex`.
- `SolutionViewScreen.tsx` (task 21, before this task's edits): `SolutionQuestionRow` is **uncontrolled** — internal `useState(defaultOpen)`, no `open`/`onOpenChange` prop, and is not in this task's Target Files, so it cannot gain one. The existing deep-link effect (`initialOpenQuestion`) is the only precedent for "force a specific row open" — it uses `defaultOpen` + `id`/`tabIndex`, applied once via an empty-deps `useEffect`.
- `SolutionEditorHeader.tsx` (task 09): confirms the exact blocked-trigger shape to replicate (`cn(chipVariants({active:false}), "gap-1.5 px-3 tabular-nums h-11")`, `LayoutGrid aria-hidden`, `t("common.questionPalette")` text, `aria-disabled="true"`, `aria-describedby` → the empty-state paragraph's `useId()`, no `aria-expanded`/`aria-controls`/`onClick`, no native `disabled`). Also confirms `panelTitle`/`panelMeta` are **not** passed there (write screen keeps the dock's default panel title) — this task passes them explicitly per its own Implementation Content instruction ("Panel title 'Bảng câu hỏi' + 'N câu'"), a deliberate difference from task 09, not an inconsistency.
- Frontend DD § Main Components "Empty palette trigger…", § Integration Point Map (`QuestionPaletteDock`/`QuestionPagination` row): confirms the dock/`QuestionPagination` stay byte-for-byte unmodified across tasks 09 and 22, and that the blocked trigger is screen-owned.
- UI Spec `UI-D26` (`Màn xem giữ nguyên quy ước hiện có: ô câu đang mở gần nhất glow-sun + aria-current="true", ô khác bg-surface`), AC-051 (`Given màn xem, then ô của câu đang mở gần nhất nổi bật... when chọn ô k, then bảng đóng, hàng câu k mở tại chỗ và được cuộn vào tầm nhìn`), AC-059 (`bấm một hàng: mở/gập tại chỗ; hàng khác KHÔNG bị gập`) and the Bảng tương tác row for `SolutionViewScreen` (`AC-051 | Khi chọn ô k ở bảng câu hỏi | — | Hàng k mở và được cuộn vào tầm nhìn; ô k thành ô "vị trí hiện tại"`) — together these establish that "current" changes **only** on palette selection, never on a plain row-header click; this is what makes the no-callback constraint on `SolutionQuestionRow` implementable without a prop change.
- PRD AC-049/AC-051 as quoted above; AC-061 (deep link) unaffected — kept working via the pre-existing empty-deps effect.
- **Decision (implementation approach)**: `currentIndex` (single state, "most recently opened row" per AC-051) is decoupled from a separate `openTokens: Record<number, number>` map used only to key-remount the **one** row a palette jump targets (forcing a fresh `defaultOpen: true` mount) without touching `SolutionQuestionRow.tsx`. Rows not currently targeted keep a stable key forever (even after `currentIndex` moves away), so jumping elsewhere never collapses a previously-opened row — this was the load-bearing design choice that keeps the task inside its Target Files.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing test: open row 2 → cell 2 has `aria-current="true"`, others none; open row 5 → cell 5 current, cell 2 not; choose cell 4 in the panel → panel closes, row 4 expanded
- [x] Write the failing empty-palette-trigger test (frontend DD § Test Boundaries, "Empty palette trigger tests"; same assertions as task 09): `SolutionViewScreen` with 0 current questions renders a button named "Bảng câu hỏi" with `aria-disabled="true"`, whose accessible description is "Đề này hiện không còn câu hỏi nào.", with no `disabled` attribute; after pressing it, `screen.queryByRole("region", { name: "Bảng câu hỏi" })` is `null` (no panel)
- [x] Run and confirm failure

### 2. Green Phase
- [x] Wire the palette with the current-row state, and the blocked trigger for `questions.length === 0`
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep "most recently opened row" as a single piece of screen state
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`, `SOURCE/components/shared/QuestionPaletteDock.tsx`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` is empty.
- **Success criteria**: `aria-current` toggles with the open row; the empty-exam trigger is blocked with its reason and opens no panel; shared palette file unchanged.
- **Failure response**: if the highlight needs a palette change, stop — `cells[]` + existing current-index props from task 01 must suffice; escalate rather than editing the shared component.
- **Verification level**: L2 (new test added and passing)

## Proof Obligations
- **Claim** (AC-051, verbatim fragment): "ô câu đang mở gần nhất... `aria-current='true'`."
- **Primary failure mode**: the highlight tracks the first open row instead of the most recent, or two cells carry `aria-current`.
- **Boundary to exercise**: rendered `SolutionViewScreen` with the real palette component.
- **State assertion**: exactly one `[aria-current="true"]` cell after each row open.
- **Mock boundary rationale**: none (screen fed fixture detail props).
- **Residual**: 44px cell sizing measured in task 49.

- **Claim** (frontend DD DD-U4, UI Spec `C-21` "Rỗng"): with 0 current questions the view screen shows the "Bảng câu hỏi" trigger as blocked with its reason and opens no panel.
- **Primary failure mode**: the dock is mounted with an empty `cells[]` (a live trigger that opens an empty panel), or the trigger uses native `disabled` (drops out of the focus order and hides the reason).
- **Boundary to exercise**: rendered `SolutionViewScreen` with a `SolutionDetail` whose `questions` is `[]`.
- **State assertion**: button "Bảng câu hỏi", `aria-disabled="true"`, description "Đề này hiện không còn câu hỏi nào.", no `disabled` attribute, no region after pressing; `git diff --stat SOURCE/components/shared/QuestionPaletteDock.tsx` empty.
- **Mock boundary rationale**: none (screen fed fixture detail props).
- **Residual**: the write-screen half is task 09.

## Completion Criteria
- [x] Added tests pass (current-row highlight and the empty palette trigger)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: view screen only.
- Scope boundary: `SOURCE/components/shared/QuestionPaletteDock.tsx` unmodified.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
