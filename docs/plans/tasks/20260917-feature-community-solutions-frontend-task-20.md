# Task 20: `SolutionQuestionRow` + `SolutionNoteBlock` + `QuestionAnswerSummary` (reader variant)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T6 (split 2/3) — the plan entry lists 9 target files (> 5), so it is split: task 19 = header card + actions; this file = per-question rows, label priority, and the server-rendered note block; task 21 = screen + route
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T6)
- **Dependencies**: task 11 (P1-T10, `QuestionAnswerSummary` writer variant), task 14 (P2-T2, `SolutionDetail` per-question shape)
- **Provides**: per-question row components composed by task 21; the note render path proven in task 31
- **Size**: Small (3 files + component tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, work plan **v1.3**

## Implementation Content

- `SolutionQuestionRow` — expand/collapse in place (`aria-expanded`), row ≥56px; shows **exactly one** label per row following Reference Contract Value #2's priority; a "Chưa có lời giải" row has **no** comment button (AC-060 / I019); the sheet itself opens in task 28 — here the button only emits an `onOpenComments(questionId)` callback.
- **Score-gated per-question fields (frontend DD v1.6 § Data Contracts `SolutionDetail`, "Score-gated per-question fields"; Reference Contract Value #19)**: `writerChoiceNode`, `result`, `notAutoScored` and `essayScore` all come from **one** backend value — the header's `per_question` column, which is `case when cs.show_score then er.per_question end`. The mapper (task 14) sets all four **only** when that column is non-null (i.e. only when `score` is present) and leaves **every one of them absent** on **every** question when it is null. It never writes `notAutoScored: false` or any other stand-in.
  - **Render rule**: with `score` absent the row renders **no result label of any kind** — no "Đúng" / "Người viết làm sai" / "Người viết bỏ trống", no "Đã chấm: x/y điểm" / "Chưa chấm", no "Chưa chấm tự động" badge — and **no** "Người viết chọn…" / "Người viết trả lời:" line; only the correct answer / stored answer and the note (AC-040, UI-D17 "khi tắt: không nhãn"). These components read the **presence of the keys**; no component re-checks `score` to decide.
  - `notAutoScored: true` inside a detail that **does** carry a `score` renders the `Badge variant="muted"` "Chưa chấm tự động" (`result.notAutoScored`, AC-041, UI-D16).
- **Comment affordance — present iff `commentCount` is present (Reference Contract Value #20, § Minimal Surface Alternatives Element 8)**: `note.commentCount` is an **optional** key. The mapper drops it (never emits `0` as a stand-in) whenever the response carries no comment surface for that question — the note is below the 15-word gate (AC-048), or the solution is a draft/hidden own preview (S7/AC-071). A **present** `0` means the opposite: the surface exists and no visible comment sits under it yet. So: `note?.commentCount` present → render the comment control ("{count} bình luận" via `solutions.comments.open`, or "Bình luận" via `solutions.comments.openEmpty` when it is `0`); **absent** → render the note and **no** comment button and **no** "m bình luận" text. `comments` is `[]` whenever `commentCount` is absent, so no screen can open the sheet for a question the backend returned no comments for.
- `SolutionNoteBlock` — renders the note body through **server-side `RichText` directly** (not dynamic-imported — this content is needed immediately on open, UI-D22).
- `QuestionAnswerSummary` (reader variant) — "Người viết chọn {answer}" (`solutions.view.writerChoice`) / "Người viết làm sai" / "Người viết bỏ trống" / "Người viết trả lời:" / "Đã chấm: x/y điểm" / "Chưa chấm" / "Chưa chấm tự động", each rendered **only** from the presence of its own key, which the mapper supplies only when the writer left the score visible.

## Acceptance Criteria

From the plan (§ P2-T6), rows that apply to these files: **AC-040, AC-041, AC-059, AC-060**; Reference Contract Values **#2, #19, #20**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **While** a `SolutionDetail` carries no `score`, the view screen renders, on every question row and inside every opened row, no "Chưa chấm tự động" badge, no "Đã chấm: x/y điểm" / "Chưa chấm" label, no "Đúng" / "Người viết làm sai" / "Người viết bỏ trống" label and no "Người viết chọn…" / "Người viết trả lời:" line. (AC-040, UI-D17)
- **While** a `SolutionDetail` carries a `score` and a question has `notAutoScored: true`, that row renders the `Badge variant="muted"` "Chưa chấm tự động" (`result.notAutoScored`). (AC-041, UI-D16)
- **While** a question has no note of at least 15 words, the system renders neither a comment button nor a comment count for that question. (AC-048, AC-060)

Carried hard constraints that apply to this task:
- **ADR-0002**: the note body renders only through the existing `SOURCE/components/shared/RichText.tsx`; no `dangerouslySetInnerHTML`.
- `SolutionNoteBlock` is a Server Component path; no static `import { RichText }` in any `"use client"` file under `SOURCE/features/solutions/`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`view.*`, `row.*` keys); 360px floor; 44px/56px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionQuestionRow.tsx` (new)
- [x] `SOURCE/features/solutions/components/SolutionNoteBlock.tsx` (new)
- [x] `SOURCE/features/solutions/components/QuestionAnswerSummary.tsx` (extend: reader variant)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/features/solutions/components/QuestionAnswerSummary.tsx` (task 11 writer variant)
- `SOURCE/components/shared/RichText.tsx` (server-direct usage)
- `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (server-side RichText + `scored === false` precedent)
- `SOURCE/features/solutions/queries.ts` (task 14 — the mapped `SolutionDetail` per-question shape: `hasChanged`, `note.bodyNode`, the optional `note.commentCount`, and the four score-gated keys)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionQuestionRow`, `SolutionNoteBlock`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — `SolutionDetail`: "Score-gated per-question fields (v1.6, mapper rule)", the render rule under it, and the `note.commentCount` presence invariants)
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives Element 8 — `commentCount` optional)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "Score-hidden row rendering test", "Comment-affordance tests")
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `RichText` two consumption patterns: server-direct, dynamic import)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionQuestionRow — verify Chưa có lời giải + Câu hỏi đã thay đổi + scored branches + no-label states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionNoteBlock — verify default (server RichText) state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: QuestionAnswerSummary — verify mcq/true_false/short_answer/essay + not-auto-scored states, reader variant)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D16`, `UI-D17`, `UI-D22`; golden state 9)
- `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md`
- `docs/prd/community-solutions-prd.md` (AC-059, AC-060)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/community-solutions-ui-spec.md` (UI-D17) | derived-display | "Một hàng chỉ mang một nhãn: `Chưa có lời giải` > `Câu hỏi đã thay đổi` > (khi bật hiện lựa chọn gốc) `Đúng` / `Người viết làm sai` / `Người viết bỏ trống` / `Đã chấm: x/y điểm` / `Chưa chấm` / `Chưa chấm tự động` > (khi tắt) không nhãn." | For every combination of (has note, changed, show_score, answer outcome) the row renders exactly one label chosen by this priority, or none when original answers are off and neither higher label applies |
| Work plan § Reference Contract Values #19 (backend DD v1.9 § Data Contracts `community_solution_detail`, `per_question`) | derived-display | "When this column is SQL `null`, the mapper leaves all four keys absent on every question and never writes a stand-in such as `notAutoScored: false`." | With `score` absent and all four keys absent, the rendered row (open and closed) matches no text in `/Chưa chấm tự động\|Đã chấm\|Chưa chấm\|Người viết (chọn\|trả lời\|làm sai\|bỏ trống)/`, while the correct/stored answer and the note are present |
| Work plan § Reference Contract Values #20 (backend DD v1.9 `community_solution_detail`; frontend DD v1.6 `SolutionDetail`) | derived-display | `comment_count`: "SQL `null` (never `0`) when the question carries no comment surface, an integer when it does"; frontend: "the comment affordance renders if and only if `note.commentCount` is present" | A question with a `note` and no `commentCount` key renders no comment button and no "m bình luận" text; a question with `commentCount: 0` renders the "Bình luận" button |

## Investigation Notes

**Investigation Targets read (2026-09-26):**
- `QuestionAnswerSummary.tsx` (writer variant, task 11): single exported `QuestionAnswerSummary({ stemNode, correctAnswerNode, outcome, questionType, choiceNodes?, subItemNodes?, subAnswers?, essayAnswerNode? })`; branches on `outcomeBranch(outcome)` (essay/notAutoScored/mcq/shortAnswerScored) crossed with `questionType`. Extension point used: added a discriminated union (`variant?: "writer" | "reader"`, `"writer"` implicit when omitted) so the existing writer call shape (no `variant` field, used verbatim by `NoteSheet.tsx` and its own test file) keeps compiling and behaving byte-for-byte — confirmed via `npx vitest run` on the untouched `QuestionAnswerSummary.test.tsx` (24/24 green) after the edit.
- `RichText.tsx`: no `"use client"` by design (TD-021) — 122.5 KB gzip dependency tree; the file's own header comment states the rule this task must not violate ("THÊM `use client` VÀO ĐÂY LÀ ĐẨY 122.5 KB GZIP SANG TRÌNH DUYỆT"). `inline`/block modes, `normalizeMathDelimiters`/`tabularToMarkdownTable`/`escapeBlockMarkers` pre-processing, sanitize-last pipeline (ADR-0002).
- `result/detail/page.tsx:255-265`: the two-line "Bạn trả lời: <input>" / "Đáp án đã lưu: <stored>" layout UI-D16 cites for the not-auto-scored branch — reused (subject swapped to "Người viết") in `ReaderSummary`'s `notAutoScored` branch.
- `features/solutions/queries.ts` (task 14, committed `b3492c9`): `SolutionDetailQuestion` = `{ questionId, stem: unknown, correctAnswer: unknown, writerChoiceNode?: unknown, result?, notAutoScored?, essayScore?: {earned,max}, hasChanged, note?: {body: string, commentCount?: number}, comments }`. **No `questionType`/`choices`/`subItems`/`subAnswers`/`essayAnswer` fields** — confirmed by reading `RawSolutionDetailQuestion`/`mapSolutionDetailQuestion` directly; the backend DD's own addendum (2026-09-25, `community-solutions-backend-design.md:1525`) flags this exact omission as a risk for "the reader-side `community_solution_detail`, tasks 20/25" but the pinned Output columns for `community_solution_detail` (`:1461-1468`) were not amended to add them. **Scope decision (not an escalation):** this task's own Implementation Content bullet 4 and all 7 Required Tests only enumerate the four score-gated keys (`writerChoiceNode`/`result`/`notAutoScored`/`essayScore`) for the reader variant — never a per-type choice/sub-item disclosure ("Xem N phương án" for the view screen is not in this task's Required Tests or Implementation Content, unlike the writer variant's AC-022 obligations). Read literally, the task's own scope already excludes that feature for the reader path, consistent with the data actually available. Recorded here rather than re-raised as a blocking gap, per the HANDOFF's own precedent-matching instruction — if a future task (21 or later) is asked to implement "Xem N phương án" on the view screen, it will hit this same data gap and should escalate then, citing this note.
- `writerQuestionNodes.tsx`: confirms the UI-D22 pattern this task's props follow — a server-only module builds `ReactNode`s (calling `RichText` directly) and hands them to client components as props; client components never import `RichText` themselves. `SolutionQuestionRow`/`QuestionAnswerSummary` (reader) follow the same shape: `stemNode`/`correctAnswerNode`/`writerChoiceNode`/`note.bodyNode` all arrive as already-built `ReactNode`. The server-side per-question node builder that produces `note.bodyNode = <SolutionNoteBlock text=... titleId=.../>` is **task 21's job** (screen assembly), not this task's — `SolutionNoteBlock` itself is the primitive that builder will call.
- UI Spec `SolutionQuestionRow`/`SolutionNoteBlock`/`QuestionAnswerSummary` sections + UI-D16/17/22 + "Chuỗi tiếng Việt cần thêm" § "Màn xem (S-05)": pinned literal strings and key names (`view.writerChoice`, `view.writerWrong`, `view.writerSkipped`, `view.writerAnswer`, `view.solutionLabel`, `row.noSolution`) — all added to `copy.ts` verbatim. `comments.open`/`comments.openEmpty` are listed under "Tấm trượt bình luận (O-02)" in the UI Spec's bucket (usually task 28), but per the copy.ts owning-task rule (already precedented by `essayScored`/`essayPending`, see existing comment in `copy.ts`), task 20 is the first task to render them (on `SolutionQuestionRow`'s own comment button/header count) — added here, task 28 will reuse without redefining.
- ADR-0002 / backend DD `community_solution_detail` Output columns + Invariants (`per_question`, `comment_count`, "Comment count presence condition (binding, v1.7)"): confirms Reference Contract #19/#20's exact wording is reproduced verbatim by the mapper already committed in `queries.ts` — nothing to change there, this task only had to consume the shape correctly.

**Reference Contract Compliance Check:**
| # | Compliance Check | Result | Evidence |
|---|---|---|---|
| UI-D17 (#2) | exactly one label per row by priority, or none | **Y** | `selectRowLabel()` pure function (`SolutionQuestionRow.tsx`) — table-driven test (8 rows) asserts `container.querySelectorAll('[data-slot="badge"]').length` is 0 or 1 and text matches exactly; `SolutionQuestionRow.test.tsx` |
| #19 (per_question absence) | absent score ⇒ no result text anywhere, open or closed; correct/stored answer + note still present | **Y** | `SolutionQuestionRow.test.tsx` "Score ẩn" test renders two rows (true_false-shaped, essay-shaped) with none of the four keys, asserts the forbidden regex has no match closed AND open, and that `correctAnswerNode`/`note.bodyNode` text is present |
| #20 (commentCount presence) | comment affordance renders iff `note?.commentCount` present, `0` still renders | **Y** | `SolutionQuestionRow.test.tsx` Required Tests 4/5/6 |

**Exit Gate re-check (post-implementation):** all three rows above hold against the final code (not just the plan) — confirmed by running the actual test suite (`npx vitest run features/solutions` → 221 passed, 1 pre-existing unrelated flake in `FormulaPreview.error.test.tsx` that passes in isolation, already logged in `docs/plans/community-solutions-HANDOFF.md` § "Phát hiện ngoài phạm vi"), `npx tsc --noEmit` (clean) and `npm run lint` (clean, 0 warnings).

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P2-T6 "Task 20")

Components are rendered directly with literal `SolutionDetail` question objects; `RichText` stays real.

1. **Label priority (table-driven, UI-D17)**: no note + changed → only "Chưa có lời giải"; note + changed → only "Câu hỏi đã thay đổi"; note + unchanged + score present → the one outcome label; score absent → no label. Assert the label count per row is **≤ 1** in every case.
2. **Score-hidden rendering**: a `true_false` question with **no** `notAutoScored` / `result` / `writerChoiceNode` key and an essay question with **no** `essayScore` key, inside a `SolutionDetail` with **no** `score`, render no text matching `/Chưa chấm tự động|Đã chấm|Chưa chấm|Người viết (chọn|trả lời|làm sai|bỏ trống)/` — **both open and closed** — while the correct/stored answer and the note are present (AC-040, UI-D17).
3. **`notAutoScored` with a score**: the same `true_false` question with `notAutoScored: true` inside a detail **with** `score: 7.5` renders "Chưa chấm tự động" (AC-041, UI-D16).
4. **No comment affordance without a count**: a question with `note` but **no** `commentCount` renders the note, **no** comment button and **no** "m bình luận" text (AC-048, and the draft/hidden own-preview case the backend pins as SQL `null`).
5. **Present zero still renders the button**: a question with `note.commentCount: 0` renders the "Bình luận" button (`solutions.comments.openEmpty`).
6. **"Chưa có lời giải" row**: a question with no `note` renders no comment button at all.
7. **Server-direct `RichText`**: `SolutionNoteBlock` renders sanitized `RichText` output server-side, with no static `RichText` import in any `"use client"` file under `features/solutions/`.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above (the label-priority one is table-driven), then run and confirm failure

### 2. Green Phase
- [x] Implement the label selector, row, note block, reader variant
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Label priority lives in one pure function with the table test
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `components/shared/__tests__/RichText.xss.test.tsx` — Covers: note rendering (M8); stays green (no change expected here)
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; read the table-driven label test output.
- **Success criteria**: every table row yields exactly the expected single label (or none); no case yields two.
- **Failure response**: if two labels are needed to express a state, stop and escalate to the UI Spec author — UI-D17 is binding.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (Reference Contract #2): exactly one label per row by the UI-D17 priority — never two simultaneously.
- **Primary failure mode**: a changed question also shows "Người viết làm sai", mixing a stale verdict with the change warning.
- **Boundary to exercise**: in-process unit on the label selector + rendered row DOM.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

- **Claim** (Reference Contract #19 / AC-040): a solution whose writer hid the score renders **no** result information of any kind.
- **Primary failure mode**: a component re-checks `score` (or treats an absent `notAutoScored` as `false`) and prints "Chưa chấm tự động" or a "Người viết…" line on a row whose writer switched the score off — leaking the writer's original answers, which is exactly what `show_score` controls.
- **Boundary to exercise**: `SolutionQuestionRow` + `QuestionAnswerSummary` (reader variant) rendered with literal questions carrying none of the four keys.
- **State assertion**: no text matching `/Chưa chấm tự động|Đã chấm|Chưa chấm|Người viết (chọn|trả lời|làm sai|bỏ trống)/`, open and closed; the correct/stored answer and the note still present.
- **Mock boundary rationale**: none — literal props.
- **Residual**: the mapper that produces the absent keys is backend task 14's test; the real-SQL projection is task 16's.

- **Claim** (ADR-0002 / UI-D22): the note body renders through server-side `RichText` (sanitized) directly.
- **Primary failure mode** (fixture skeleton Test 3): "a future change to the note/comment render path bypasses RichText (e.g. a raw dangerouslySetInnerHTML shortcut)".
- **Boundary to exercise**: rendered `SolutionNoteBlock` with an unmocked `RichText`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: browser-level XSS proof on the view screen is task 31.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: task 21 composes these rows; task 28 wires `onOpenComments` to the comment sheet.
- Scope boundary: the writer variant of `QuestionAnswerSummary` (task 11) keeps its behaviour and tests unchanged.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
