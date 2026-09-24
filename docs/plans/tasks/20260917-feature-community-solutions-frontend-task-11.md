# Task 11: `NoteSheet` + `NoteEditor` + `FormulaPreview` + `QuestionAnswerSummary` (writer variant) — RichText XSS acceptance criterion

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P1-T10
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T10)
- **Dependencies**: task 07 (P1-T7, `OverlaySheet`/`ConfirmDialog`), task 10 (P1-T9 split 2/2, `SolutionEditorScreen`)
- **Provides**: the note-authoring sheet opened from `NoteQuestionRow`; `QuestionAnswerSummary` (writer variant; reader variant added in task 20)
- **Size**: Medium (5 files + component tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, backend DD **v1.9** (the `saveSolution` result union this sheet renders), work plan **v1.3**

## Implementation Content

- `NoteSheet` — built on `OverlaySheet`; states default, published-under-15, save-success, save-failure; dirty-close via `ConfirmDialog variant="dirty-close"` (AC-104).
- **`saveSolution` result union (backend DD v1.9, Reference Contract Value #10)**: `{ ok: true, solutionId, status }` | `{ ok: false, error: { code: "rateLimited", seconds: number } | { code: "belowWordCount" } | { code: "generic" } }`. There is **no `notEligible` and no `hidden` code**, and `belowWordCount` carries **no** count on this action (the count exists only on `setSolutionStatus`, task 10). A hidden solution has no input and no save button at all (UI Spec `C-17` "Chỉ đọc", AC-083), so no hidden branch is needed.
- **Rendering per code (UI Spec `C-17` "Lỗi" row; Reference Contract Value #28)** — the sheet's `role="alert"` line, with the textarea keeping the typed text and the sheet staying open in **every** case:
  - `belowWordCount` → `solutions.note.tooShortPublished` ("Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước.")
  - `generic` → `solutions.note.saveError` ("Chưa lưu được. Bạn thử lại nhé.")
  - `rateLimited` → `profile.error.rateLimited` with `{seconds}` (AC-101)
- **DD-U5 — dirty-close "Lưu" failure (Reference Contract Value #24)**: when the 3-choice dirty-close dialog's "Lưu" fails, the **dialog stays open** with the failure text in `ConfirmDialog`'s `error` prop (`role="alert"` inside the dialog) and "Lưu" pressable again; the sheet stays open underneath with its text untouched; "Bỏ" and "Ở lại" keep their meanings; nothing is cleared on either layer. The caller supplies the text from the action's code — the same three mappings as above — because `ConfirmDialog` itself renders nothing on a rejected `onConfirm`. A second, successful "Lưu" closes both layers. The dialog's `open` state and the message passed to `error` live in the sheet's owner; `ConfirmDialog` owns only its internal `busy` flag (frontend DD § Client State Design, "Pending state (non-optimistic, v1.3)").
- `NoteEditor` — word counter uses the **same** `countWords()` from `SOURCE/lib/solutions/countWords.ts` (task 04) the server calls; max length 8000 chars enforced client-side (server enforces too); essay prefill from the linked attempt's answer (AC-034–AC-036).
- `FormulaPreview` — the first user-authored-markdown render surface in the feature: `dynamic(() => import("@/components/shared/RichText")…, { ssr: false })` + a `warmRichText()` pre-warm on first interaction; never in the first bundle. States idle, loading ("Đang mở xem trước…", fixed-height placeholder), shown, load-error.
- `QuestionAnswerSummary` (writer variant) — mcq/true_false/short_answer/essay; implements UI-D16's "Chưa chấm tự động" branch for `true_false`/unscored `short_answer`.
- Add a **note-body fixture group** to `RichText.xss.test.tsx`: `<script>`, `<img onerror>`, `javascript:` link, HTML inside a formula block (UI Spec § Cách đo row XSS).

## Acceptance Criteria

From the plan (§ P1-T10): **AC-022, AC-023, AC-024, AC-025, AC-034–AC-036, AC-101, AC-102, AC-104 (dirty-close via task 07, DD-U5)**; Reference Contract Values **#10, #24, #28**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** a note save returns `belowWordCount`, `NoteSheet` renders "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước." in its `role="alert"` line; **when** it returns `generic`, "Chưa lưu được. Bạn thử lại nhé."; in both cases the typed text stays in the textarea. (AC-024, AC-032, UI Spec `C-17` "Lỗi")
- **If** the "Lưu" choice of the 3-choice dirty-close dialog fails, **then** the dialog stays open with the failure text in a `role="alert"` line inside it and "Lưu" pressable again, and the sheet stays open underneath with its text unchanged. (AC-104, DD-U5)
- **When** any write action is rejected for rate-limiting, `profile.error.rateLimited` is rendered with the server-provided `{seconds}` and no unsaved input is cleared. (AC-101, S16)

Carried hard constraints that apply to this task:
- **ADR-0002 (explicit acceptance criterion)**: note content renders only through the existing `SOURCE/components/shared/RichText.tsx`; the `RichText.xss.test.tsx` note-body fixture group is green **in this commit** (M8). No `dangerouslySetInnerHTML` shortcut anywhere in these files.
- No static `import { RichText }` in any `"use client"` file under `SOURCE/features/solutions/` (bundle budget, M12).
- `warmRichText()` is modelled on `SOURCE/features/authoring/components/QuestionEditor.tsx` (lines ~71–90) but **not imported** from there (B4 cross-feature boundary).
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`note.*` keys, UI Spec § Chuỗi tiếng Việt cần thêm → Tấm trượt ghi chú); 360px floor; 44px touch targets; "Đêm hội" tokens only; motion only via `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/NoteSheet.tsx` (new)
- [x] `SOURCE/features/solutions/components/NoteEditor.tsx` (new)
- [x] `SOURCE/features/solutions/components/FormulaPreview.tsx` (new)
- [x] `SOURCE/features/solutions/components/QuestionAnswerSummary.tsx` (new — writer variant)
- [x] `SOURCE/components/shared/__tests__/RichText.xss.test.tsx` (add note-body fixture group)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

**Additional files touched (necessary wiring/integration, not in the original list above — see Investigation Notes "Scope expansion beyond the original Target Files list"):**
- [x] `SOURCE/features/solutions/components/SolutionEditorScreen.tsx` (modified — replaced task 10's `NoteEditorScaffold` with real `<NoteSheet>`, reused existing reducer actions, added optional `questionNodes` prop)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page.tsx` (modified — builds `questionNodes` via `renderWriterQuestionNodes` server-side, UI-D22)
- [x] `SOURCE/features/solutions/components/writerQuestionNodes.tsx` (new — server-only, statically imports `RichText`, builds `stemNode`/`correctAnswerNode`/`noteNode` per UI-D22)
- [x] `SOURCE/features/solutions/lib/questionOutcome.ts` (new — `unknown → PerQuestionResult` type guard for `myResult`)
- [x] `SOURCE/features/solutions/lib/saveErrorText.ts` (new — extracted from `SolutionEditorScreen.tsx` to avoid a circular import with `NoteSheet.tsx`, which also needs it for the DD-U5 dialog's error text)
- [x] `SOURCE/lib/copy.ts` (added `solutions.note.*` keys this task owns per DD's "first task in execution order that renders it" rule, plus `solutions.view.essayScored`/`essayPending` — see Investigation Notes)

## Investigation Targets
- `SOURCE/components/shared/RichText.tsx` and `SOURCE/components/shared/__tests__/RichText.xss.test.tsx` (existing sanitize path and fixture shape)
- `SOURCE/features/authoring/components/QuestionEditor.tsx` (lines ~71–90: `dynamic` + `warmRichText` pattern — model only)
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (second `dynamic` RichText precedent)
- `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (line ~216: `scored === false` "Chưa chấm tự động" precedent)
- `SOURCE/lib/solutions/countWords.ts` (task 04)
- `SOURCE/components/shared/OverlaySheet.tsx`, `SOURCE/components/shared/ConfirmDialog.tsx` (task 07)
- `SOURCE/features/solutions/components/SolutionEditorScreen.tsx` (task 10 — how a row opens the sheet and receives saved state)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — Note-authoring contract, incl. the v1.6 "Mapper rules": a backend `null` note arrives as `""`, `wordCount` passed through)
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `RichText` two consumption patterns: server-direct, dynamic import)
- `docs/design/community-solutions-frontend-design.md` (§ UI Action - API Contract Mapping — the `saveSolution` row: the v1.6 union, the mapping rule, and the per-code rendering)
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra rows and the "Overlay dirty-close" row, DD-U5)
- `docs/design/community-solutions-frontend-design.md` (§ Client State Design — "Pending state (non-optimistic, v1.3)": who owns the dialog's `open` + `error`; § Test Boundaries — "`saveSolution` error-code tests", "Dirty-close failure tests")
- `docs/design/community-solutions-backend-design.md` v1.9 (§ Main Components `actions.ts` — `saveSolution`'s pinned result union)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: NoteSheet — verify default + published-under-15 + save-success + save-failure states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: NoteEditor — verify default + essay-prefill + too-long states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: FormulaPreview — verify idle + loading + shown + load-error states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: QuestionAnswerSummary — verify mcq/true_false/short_answer/essay + not-auto-scored states)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D16`, `UI-D22`, `UI-D23`; § Cách đo rows XSS and Đếm từ; golden states 7–8)
- `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md` (RichText-only rendering of untrusted markdown)
- `docs/prd/community-solutions-prd.md` (S15, AC-022–AC-025, AC-034–AC-036, AC-102)

## Investigation Notes

**Existing patterns confirmed by reading the Investigation Targets:**
- `RichText.tsx`/`RichText.xss.test.tsx`: sanitize pipeline is `remark-gfm + remark-math → rehype-katex → rehype-sanitize` (sanitize LAST, backstops KaTeX output too); no `rehype-raw`, no `urlTransform` override, `trust:false`. Added the note-body fixture group (`<script>`, `<img onerror>`, `javascript:` link, HTML inside `$…$`) and ran it BEFORE writing any component code (Red-phase instruction) — all 4 new + 18 existing cases passed immediately (22/22), confirming this is the EXISTING sanitizer correctly covering a new UGC surface, not a gap. No escalation needed.
- `QuestionEditor.tsx:78-85` / `ExplainStepAffordance.tsx`: both model `dynamic(() => import(".../RichText").then(m => m.RichText), { ssr: false })` + a same-`import()` `warmRichText()`. `FormulaPreview.tsx` follows this pattern but does NOT rely on `next/dynamic`'s own Suspense fallback for the loading/error UI — it tracks state via an explicit `await import(...)` in `open()` so the button label/`aria-busy` can transition deterministically (UI-D23 requires "Đang mở xem trước…" + fixed-height placeholder), then renders `<LazyRichText>` (already warmed, near-instant) wrapped in a small class-based `PreviewErrorBoundary` (defense-in-depth for a render-time throw).
- `result/detail/page.tsx:159,216`: confirms `notScored = r.scored === false`, and the "Chưa chấm tự động" badge condition is `!r.essay` (not `notScored` alone) — essay is excluded from that branch. `QuestionAnswerSummary`'s `outcomeBranch()` mirrors this exactly.
- `OverlaySheet.tsx`/`ConfirmDialog.tsx`: shell is pure (`onRequestClose` returns `"closed"|"kept"`); `ConfirmDialog`'s `open`/`error` are fully owned by the caller, and it renders nothing itself on a rejected `onConfirm` — confirms `NoteSheet` must supply the DD-U5 error text itself.
- `SolutionEditorScreen.tsx` (task 10): the `NoteEditorScaffold` stand-in and its own doc comment explicitly named `NoteSheet`/task 11 as the replacement, reusing `state.activeNote`/`saveNote()` — done (see below). Its EXISTING test file (`SolutionEditorScreen.test.tsx`) already exercises the scaffold's shape (`getByRole("textbox")`, a button named exactly `"Lưu"`) — `NoteSheet`'s real markup was built to keep those exact accessible names so that file's 9 pre-existing tests keep passing unmodified (verified: all 9 + 8 new describe blocks green, 17/17).

**Data-shape discovery (binding for scope, recorded per "Unimplemented Dependency Handling"):** `community_solution_for_writer`'s ALREADY-APPLIED migration (`SOURCE/supabase/migrations/20260924000000_community_solutions_7cd454572675.sql:447-469`, backend task 03, out of this task's authority to change) builds `questions[]` with exactly `question_id, stem (= ak.content, plain string), correct_answer (= ak.correct_answer, plain string), my_result (= a raw PerQuestionResult element, or null), note, word_count, has_changed, essay_prefill_applied`. It carries **no `question_type`, no `choices`, no `sub_answers`, no `essay_answer`** column. Consequence for `QuestionAnswerSummary` (writer variant):
  - Question-type branching is derived from `myResult`'s own shape (essay via `outcome.essay` presence; not-auto-scored via `outcome.scored === false` and no `essay`; mcq via `outcome.correct !== undefined`; else short-answer-scored) — mirrors `result/detail/page.tsx`'s own precedent, no new heuristic invented.
  - AC-022's "Xem N phương án" (full mcq choice list) and true_false's per-item (a-d) content, and essay's "Đáp án mẫu" sample answer, **cannot be rendered** — the source columns do not exist in the RPC output. `QuestionAnswerSummary` renders the correct-answer SUMMARY the RPC actually provides (a letter/string) and the essay score line (`earnedPoints`/`maxPoints`, which PerQuestionResult DOES carry) instead. This is the same RPC `community_solution_detail` (task 14, reader variant) will read from — backend DD v1.9's own "Output columns" for that function name only `stem`/`correct_answer` too (no `choices`/`sub_answers`/`essay_answer` there either), so this is a systemic gap affecting task 20 as well, not specific to this task's implementation choice. Flagging for the orchestrator/engineer to decide: extend the migration with the missing columns (new migration, backend task, schema:plan → fingerprint → apply-dev → verify:schema flow) or accept the summary-only rendering as final scope. None of this task's 12 Required Tests or 3 Proof Obligations require the full choice list, so this gap does not block Completion Criteria.
  - `solutions.note.choices`/`note.choicesHide` copy keys (UI Spec's list) were deliberately NOT added — no code path renders them (would be dead keys).

**Follow-up (same day, closes the gap above):** backend commit `4b0ea52` added `question_type`/`choices`/`sub_answers`/`essay_answer` to `community_solution_for_writer` (migration renamed `...7cd454572675.sql` → `...8b80e2188cc3.sql`, schema fingerprint updated, independently re-verified on dev — see that commit's message). This task's scope was extended accordingly: `queries.ts`'s `SolutionEditorQuestion`/mapper now carry the 4 fields; `writerQuestionNodes.tsx` builds `choiceNodes`/`subItemNodes`/`subAnswers`/`essayAnswerNode` from them; `QuestionAnswerSummary` renders the full mcq choice list behind a "Xem N phương án" disclosure (AC-022/AC-060, default closed, correct choice badged), true_false/short_answer per-item content, and a conditional "Đáp án mẫu" line for essay — superseding the "summary-only rendering" fallback described above. The `solutions.note.choices`/`note.choicesHide` keys ARE now used (added to `lib/copy.ts`), reversing the "deliberately NOT added" note two lines up. 8 new tests cover this in `QuestionAnswerSummary.test.tsx`.

**Scope expansion beyond the original Target Files list (necessary wiring, not a scope creep for its own sake):**
  - UI-D22 requires `stem`/`correctAnswer` to be rendered via `RichText` **server-side before the client boundary** (never a client dynamic-import for these — only `FormulaPreview`'s note-body preview and `CommentSheet`'s comment body get that treatment, per UI-D22's own text). Since `SolutionEditorQuestion.stem`/`.correctAnswer` are `unknown` raw strings (task 04's deliberate deferral, confirmed in `queries.ts`'s own doc comment), and `SolutionEditorScreen.tsx` is `"use client"` (cannot statically import `RichText`, M12), the conversion had to happen in a NEW server-only file (`writerQuestionNodes.tsx`, no `"use client"`, mirrors but does not import `features/exams/components/questionNodes.tsx` — B4) called from `page.tsx` (a Server Component) — not from Target Files list, but the only place structurally capable of doing this per the binding UI-D22/M12 rules.
  - `SolutionEditorScreenProps` gained an OPTIONAL `questionNodes?: WriterQuestionNode[]` prop (not required) specifically so `SolutionEditorScreen.test.tsx` (task 10, not this task's file to modify) keeps compiling and passing without changes — that file's `question()` helper builds raw `SolutionEditorQuestion` objects and never supplies this prop. Confirmed: all 9 of its original tests plus this task's 8 new ones pass unmodified/added (17/17).
  - `saveErrorText` (the 3-way `belowWordCount`/`generic`/`rateLimited` → copy-key mapping) was extracted from `SolutionEditorScreen.tsx` into `SOURCE/features/solutions/lib/saveErrorText.ts` because `NoteSheet.tsx` needs the SAME mapping for the DD-U5 dialog's `error` text, and `SolutionEditorScreen.tsx` imports `NoteSheet` — keeping the function in `SolutionEditorScreen.tsx` would have created a circular import.

**Binding Decisions / Reference Contracts check:** this task file declares no `## Binding Decisions` or `## Reference Contracts` section, so that pre-implementation gate does not apply; the 3 Proof Obligations below are the binding correctness claims instead, evaluated in Completion Criteria.

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P1-T10 "Task 11 tests")

`saveSolution` is mocked at the module boundary (`@/features/solutions/actions`); `RichText` and `countWords()` stay real.

1. **`belowWordCount` in the sheet**: a resolved `{ ok: false, error: { code: "belowWordCount" } }` renders a `role="alert"` line "Ghi chú phải có ít nhất 15 từ. Muốn để ngắn thì gỡ bài về nháp trước." (`solutions.note.tooShortPublished`); the textarea still holds the typed text and the sheet stays open.
2. **`generic` in the sheet**: a resolved `{ ok: false, error: { code: "generic" } }` renders "Chưa lưu được. Bạn thử lại nhé." (`solutions.note.saveError`); textarea and sheet unchanged.
3. **`rateLimited` in the sheet**: `{ code: "rateLimited", seconds: 42 }` renders `profile.error.rateLimited` containing "42"; the text is kept.
4. **DD-U5, both codes on the dialog**: with the sheet dirty, closing opens the 3-choice dialog; the same two codes on its "Lưu" put the same two strings in `ConfirmDialog`'s `error`, with the dialog **still open**, "Lưu" pressable again, and the sheet's textarea value unchanged underneath.
5. **DD-U5 recovery**: a second "Lưu" that resolves `{ ok: true, … }` closes **both** layers.
6. **Word counter**: the counter equals `countWords()`'s output for the same string (same function the server calls, AC-023).
7. **Published + under 15 words**: on a published solution a note below 15 words (including empty) is refused with the published-under-15 message and the text stays; on a draft the same 0-word note calls `saveSolution` exactly once (Failure Mode #3 / AC-024).
8. **Length ceiling**: 8000-character limit enforced client-side, with the "Còn {remaining} ký tự" counter (`solutions.note.charsLeft`) before the limit is hit; text is never truncated client-side.
9. **Essay prefill** (AC-034–AC-036), including the "did not re-apply after a manual edit" bookkeeping.
10. **`QuestionAnswerSummary` writer variant**: the "Chưa chấm tự động" branch for `true_false` / unscored `short_answer` (UI-D16).
11. **`FormulaPreview`**: fixed-height loading placeholder → content; load-error state on import failure; no static `RichText` import.
12. **XSS**: the note-body fixture group in `RichText.xss.test.tsx` is green **in this commit** (M8, ADR-0002).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Add the note-body XSS fixture group to `RichText.xss.test.tsx`; confirm it runs (it exercises the existing sanitizer, so failures here indicate a real sanitizer gap — stop and escalate if any case fails before implementation) — ran green immediately (22/22), no sanitizer gap
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement the four components
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep one `LazyRichText` definition inside `FormulaPreview`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `components/shared/__tests__/RichText.xss.test.tsx` — Enforces: no executable markup from untrusted markdown/KaTeX — Covers: note rendering (M8)
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs` — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `next build` (manual manifest read) — markdown/KaTeX chunk absent from the write route's first bundle (formal measurement task 48)
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/` (includes `RichText.xss.test.tsx`); on the dev server open the write screen, open a note sheet, type a formula, tap "Xem trước công thức", and confirm in the browser network panel that the RichText chunk loads only on that tap.
- **Success criteria**: note-body XSS group green; component tests green; preview chunk not requested on initial route load.
- **Failure response**: if the preview requires a static RichText import to work, stop — the dynamic-import contract (S15, M12) is binding.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (S15, verbatim): "bản xem trước đi cùng đường `RichText` đã sanitize như màn xem (cùng chuỗi vào → cùng kết quả, kể cả ca bị lọc), bộ render markdown + KaTeX nạp động khi bấm lần đầu và không bao giờ nằm trong bundle đầu."
- **Primary failure mode**: `FormulaPreview` renders through a different path than the view screen (so a payload filtered in one surface renders live in the other), or the renderer is statically bundled.
- **Boundary to exercise**: real `RichText` (unmocked) for the same input string in the XSS fixture and in `FormulaPreview`.
- **State assertion**: N/A.
- **Mock boundary rationale**: only `features/solutions/actions.ts` is mocked; `RichText` renders for real.
- **Residual**: browser-level proof on the view screen is task 31; bundle proof is task 48.

- **Claim** (Reference Contract Value #24, DD-U5, verbatim): "The **dialog stays open** with the failure text in its `error` prop (`role="alert"` inside the dialog) and "Lưu" pressable again; the sheet stays open underneath with its text and its "Ẩn danh" choice untouched; "Bỏ" and "Ở lại" keep their meanings. Nothing is cleared on either layer." (The "Ẩn danh" half belongs to `CommentSheet`, task 28; here it is the sheet's text.)
- **Primary failure mode**: a failed "Lưu" closes the dialog (or the sheet) and the typed note is lost — the exact silent-data-loss case AC-104 exists to prevent.
- **Boundary to exercise**: `NoteSheet` + `ConfirmDialog` with `saveSolution` mocked to reject once, then succeed.
- **State assertion**: after the first failure the dialog is still in the DOM with a `role="alert"` inside it, "Lưu" is pressable, and the textarea value equals its pre-press value; after the second, successful press both layers are gone.
- **Mock boundary rationale**: Server Action mocked at the module boundary; `ConfirmDialog` renders for real.
- **Residual**: the comment-sheet twin of this behaviour is task 28.

- **Claim** (Failure Mode #3, empty input / AC-024): a 0-word note saves on a draft; on a published solution a note below 15 words (including empty) is rejected with the published-under-15 message and the text stays.
- **Primary failure mode**: empty notes are blocked on drafts (breaking "viết dần") or accepted on published solutions.
- **Boundary to exercise**: `NoteSheet` + `NoteEditor` with the solution status prop varied and `saveSolution` mocked.
- **State assertion**: published + "" → save attempt → no action call, message shown, text unchanged; draft + "" → action called once.
- **Mock boundary rationale**: Server Action mocked at the module boundary.
- **Residual**: server enforcement proven in tasks 04/05.

## Completion Criteria
- [x] All added tests pass, including the `RichText.xss.test.tsx` note-body group (explicit acceptance criterion) — `npm test` (SOURCE), re-verified after the run-2 follow-up above: 168 files passed / 1 pre-existing skip, 2272 tests passed / 10 pre-existing skips, 0 failures
- [x] Operation verified per Operation Verification Methods above — `npm test` green; dev-server browser-network-panel check DEFERRED (auto-mode blocks the sign-in flow needed to reach the write screen live, same recurring issue as tasks 08/10 — pre-approved by the orchestrator); substituted a static `next build` manifest check instead (see below)
- [x] Each Proof Obligation is met — S15 (FormulaPreview-side: real, unmocked `RichText`, same sanitize path as the XSS fixtures; dynamic-load confirmed statically — see below; full view-screen/bundle-budget comparison is this task's own stated residual, tasks 31/48); DD-U5 (Reference Contract #24, parametrized `belowWordCount`/`generic` + recovery tests, `SolutionEditorScreen.test.tsx`); Failure Mode #3/AC-024 (published+0-word vs draft+0-word tests, same file)

**Bundle-splitting check (static substitute for the live browser-network-panel step):** `npm run build` (production, Turbopack) succeeded including the write route. Of the 53 static chunk files emitted, exactly ONE (`2aolv82mcdndy.js`) contains `"katex"`, and it belongs to the `react-loadable-manifest.json` entry for the write route's `page` (id `80001`) — a dynamically-loaded chunk group, not part of that route's `build-manifest.json` `rootMainFiles`. No other static chunk (including the route's own root/main files) references `katex` or `rehype-sanitize`. This is consistent with the RichText/KaTeX chunk being absent from the write route's initial bundle and loaded only through `FormulaPreview`'s `dynamic()` call.

## Notes
- Impact scope: task 20 adds the reader variant of `QuestionAnswerSummary`; task 28 adds the comment XSS group next to this one.
- Scope boundary: `SOURCE/components/shared/RichText.tsx` itself is not modified; `SOURCE/features/authoring/components/QuestionEditor.tsx` is not modified or imported.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
