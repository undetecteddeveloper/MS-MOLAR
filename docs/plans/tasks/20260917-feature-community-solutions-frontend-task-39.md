# Task 39: `ModerationReasonBanner` "alert" variant wired into `SolutionEditorScreen` (hidden read-only)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P4-T8
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T8)
- **Dependencies**: task 10 (P1-T9 split 2/2, `SolutionEditorScreen` + banner alert variant wiring), task 32 (P4-T1, admin hide exists)
- **Provides**: the writer's read-only view of an admin-hidden solution
- **Size**: Small (2 files + component test)

## Implementation Content

When the writer's own solution has `status = 'hidden'`, `SolutionEditorScreen` renders fully read-only: **no** "Lưu nháp", "Đăng", or "Gỡ về nháp" controls, note rows open read-only, and `ModerationReasonBanner` (`alert` variant, `role="alert"`) shows the admin's reason at the top.

## Acceptance Criteria

From the plan (§ P4-T8): **AC-083**.

Carried hard constraints that apply to this task:
- UI matches the DB guarantee from task 03 (a hidden solution rejects every write RPC with `42501`) — defence in depth, not a replacement.
- Vietnamese strings only via `SOURCE/lib/copy.ts`; destructive banner contrast `--destructive` on `bg-destructive/10` (7.1:1); "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionEditorScreen.tsx` (extend — refactor only, rename `hidden` → `isReadOnly`; hành vi AC-083 đã có sẵn từ task 10/11)
- [x] `SOURCE/features/solutions/components/ModerationReasonBanner.tsx` (extend: alert variant exercised — không sửa code, chỉ được test mới khai thác thêm)
- [x] Component test under `SOURCE/features/solutions/components/__tests__/` (`SolutionEditorScreen.test.tsx`, mở rộng)

## Investigation Targets
- `SOURCE/features/solutions/components/SolutionEditorScreen.tsx` (task 10), `SolutionPublishBar.tsx`, `NoteQuestionRow.tsx` (task 09)
- `SOURCE/features/solutions/components/ModerationReasonBanner.tsx` (tasks 08/10)
- `SOURCE/features/solutions/components/NoteSheet.tsx` (task 11 — read-only open behaviour)
- `SOURCE/supabase/schema.sql` (`save_community_solution`/`set_community_solution_status` hidden guard, task 03)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionEditorScreen — verify hidden (read-only) state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Yêu cầu trợ năng row `C-15` biến thể ẩn)
- `docs/prd/community-solutions-prd.md` (S6, AC-083)

## Investigation Notes

- `SolutionEditorScreen.tsx` (task 10/11): `ModerationReasonBanner` (`variant="alert"`) đã được render ở đầu màn khi `hidden && state.hiddenReason` (dòng ~421 trước refactor); `SolutionSettingsPanel` đã nhận `lockReasonId={hidden ? lockReasonId : undefined}` (khoá hai công tắc, AC-083); `NoteSheet` đã nhận `readOnly={hidden}` + `hiddenReason={state.hiddenReason}`. Một biến `hidden = state.status === "hidden"` ĐÃ được suy ra một lần và dùng lại ở cả ba chỗ — refactor của task 39 chỉ đổi TÊN biến này thành `isReadOnly` (rõ nghĩa "chỉ đọc" hơn tại điểm dùng ở con), hành vi giữ nguyên 100%.
- `SolutionPublishBar.tsx`: đã có hàng rào riêng `if (status === "hidden") return null` (dòng 69, comment "AC-083 — cha quyết định có mount hay không, ở đây chỉ giữ ma trận trạng thái riêng của component"). Không sửa file này — đây không phải bản sao của `isReadOnly`, là nhánh trạng thái độc lập của chính component (`SolutionPublishBarStatus` gồm `draft | published | hidden`), không phải chỗ lặp logic cần gộp.
- `NoteQuestionRow.tsx` (task 09): không phân biệt hidden/không — hàng vẫn mở tấm trượt bình thường qua `onOpen`; đúng UI Spec "mọi hàng câu mở ra tấm trượt CHỈ ĐỌC" (quyết định đọc/ghi nằm ở `NoteSheet`, không phải ở hàng). Không cần sửa.
- `NoteSheet.tsx` (task 11): khi `readOnly`, nhánh JSX đã thay `NoteEditor` + hai nút Lưu/Lưu-và-sang-câu bằng `<div>{noteNode}</div>` (không render bất kỳ nút lưu/ô nhập nào); còn tự hiện lại `ModerationReasonBanner variant="alert"` bên trong tấm trượt khi `readOnly && hiddenReason` (băng lặp lại đúng lý do, không phải lỗi trùng — UI Spec cho phép). `requestClose()` khi `readOnly` đóng thẳng không hỏi "còn thay đổi chưa lưu" (đúng, không có gì để làm dirty).
- `writerQuestionNodes.tsx`: `noteNode: <RichText text={q.note} />` — bản render CHỈ ĐỌC của ghi chú hiện tại, dựng phía server; test dùng node tối giản (`<p>{note}</p>`) thay vì gọi RichText thật (đủ để xác nhận "vẫn xem được nội dung", không lặp lại phạm vi test riêng của RichText).
- `schema.sql` (task 03): `save_community_solution` (dòng 2746-2747) và `set_community_solution_status` (dòng 2841-2842) đều `raise exception ... errcode = '42501'` khi `status = 'hidden'` — DB guard đã tồn tại; UI của task này CHỈ LÀ phòng thủ thêm (defense-in-depth), không thay thế.
- `lib/copy.ts`: mọi khoá cần dùng đã có sẵn (`solutions.hiddenBanner`, `solutions.status.hidden`, `solutions.editor.crumb`, `solutions.row.*`) — không cần thêm khoá mới.
- **Kết luận trước khi code**: SAU khi đọc toàn bộ Investigation Targets, hành vi AC-083 (không nút Lưu/Đăng/Gỡ; băng lý do; mở hàng vẫn đọc được nhưng không có ô nhập/nút lưu) đã ĐƯỢC HIỆN THỰC ĐẦY ĐỦ bởi task 10/11 — không có phần hành vi nào còn thiếu. Việc của task 39 là: (1) viết test khẳng định tường minh AC-083 (chưa có test nào phủ trạng thái `hidden` trong `SolutionEditorScreen.test.tsx` trước đó), và (2) refactor đặt tên `isReadOnly` cho cờ suy-một-lần đã có, đúng yêu cầu "Refactor phase" của task.
- **RED-phase proof (thật, không phải suy diễn)**: vì `SolutionEditorScreen.tsx`/`ModerationReasonBanner.tsx` không có diff chưa commit nào để `git stash`, RED được chứng minh bằng cách tạm thời gán `const hidden = false;` (vô hiệu hoá đúng cơ chế bảo vệ) rồi chạy lại đúng hai test mới — cả hai đỏ đúng chỗ: (a) `screen.getByRole("alert")` không tìm thấy phần tử nào (banner biến mất); (b) `within(dialog).queryByRole("textbox")` trả về một `<textarea>` chứa "ghi chú của tôi" (không còn `null`). Sau đó phục hồi nguyên văn `const hidden = state.status === "hidden";`, xác nhận `git diff` rỗng, chạy lại xanh (19/19). Refactor đổi tên `hidden` → `isReadOnly` áp dụng SAU bước GREEN này.

### Binding Decisions / Reference Contracts
Task file không có mục "Binding Decisions" hay "Reference Contracts" riêng — bỏ qua hai bước đó.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing test: hidden fixture → no element named "Lưu nháp"/"Đăng"/"Gỡ về nháp"; banner `role="alert"` contains the reason; opening a row shows the note without an editable textarea or save control
- [x] Run and confirm failure — proof: temporarily `const hidden = false;` in `SolutionEditorScreen.tsx` (no committable diff existed to `git stash`, so the guard mechanism itself was disabled instead), reran the 2 new tests → both red at the exact assertions (banner alert missing; editable `<textarea>` present instead of read-only note), then restored the exact original line (`git diff` empty after restore)

### 2. Green Phase
- [x] Implement the read-only branch — already fully implemented by task 10/11 (`ModerationReasonBanner` alert wiring, `NoteSheet` `readOnly`/`hiddenReason`, `SolutionPublishBar`'s own `status === "hidden" → null`, `SolutionSettingsPanel`'s `lockReasonId`); no additional behavioral code was needed
- [x] Run only the added test and confirm it passes — 19/19 in `SolutionEditorScreen.test.tsx`

### 3. Refactor Phase
- [x] One `isReadOnly` derived flag passed to children — renamed `hidden` → `isReadOnly` at the single derivation site, three call sites updated (banner condition, `SolutionSettingsPanel.lockReasonId`, `NoteSheet.readOnly`); `SolutionPublishBar`'s own internal `status === "hidden"` branch left untouched (its own component-level state matrix, not a duplicate of this flag)
- [x] Confirm added tests and task 09/10/11 tests still pass — full `npm test`: 2574 passed, 10 skipped (pre-existing, unrelated)

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — J1 stays green
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `test:fixture` inside `SOURCE/`.
- **Success criteria**: read-only test green; existing editor tests and J1 unaffected.
- **Failure response**: if a write control can still render for `hidden`, stop and fix before closing Phase 4.
- **Verification level**: L2 (new test added and passing)

## Proof Obligations
- **Claim** (AC-083, verbatim): "mọi thứ chỉ đọc, không nút Lưu/Đăng/Gỡ."
- **Primary failure mode**: the writer sees an enabled "Lưu nháp" on a hidden solution, types, and loses text to a `42501` rejection.
- **Boundary to exercise**: rendered `SolutionEditorScreen` with a hidden fixture and `features/solutions/actions.ts` mocked.
- **State assertion**: N/A.
- **Mock boundary rationale**: Server Actions mocked; DB refusal proven in task 03's function guard.
- **Residual**: none.

## Completion Criteria
- [x] Added test passes (2 new tests, 19/19 total in `SolutionEditorScreen.test.tsx`)
- [x] Operation verified per Operation Verification Methods above (`npm test`, `npm run test:fixture` both green; also ran `npm run lint` and `npx tsc --noEmit` clean)
- [x] Each Proof Obligation is met (see below)

## Notes
- Impact scope: write screen only.
- Scope boundary: the status variant of the banner (task 08) unchanged.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
