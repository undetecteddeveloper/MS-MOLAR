# Community Solutions — PRD Acceptance Criteria Closure (Task 53 / P5-T14)

Toàn bộ 110 AC (AC-001–AC-110) của `docs/prd/community-solutions-prd.md` v1.3, đối chiếu với 52 task file (01–52) đã commit trên nhánh `feat/community-solutions`. Cột "task(s) phủ" dùng số task (không có tiền tố ngày/tên); cột "bằng chứng" trỏ tới đường dẫn tương đối trong `SOURCE/` (trừ khi ghi rõ khác) — `path:line` khi trích một dòng cụ thể (assert/comment/describe), hoặc "task NN Investigation Notes" khi bằng chứng là log xác minh trong chính task file đó (migration chain, verify:schema, v.v.).

**Xác nhận trước khi đóng**: `git diff --stat 324cb3a..HEAD -- SOURCE/` rỗng — không có gì đổi trong `SOURCE/` từ sau task 50 (task 51/52 chỉ đụng task file + PROD qua Composio). Chạy lại `npm test` trong `SOURCE/` ngày 2026-09-27: **203 file / 2643 test PASS, 1 file / 10 test skip** — khớp chính xác con số task 50 đã ghi (một lần chạy đầu bị 9 test timeout ở `SolutionViewScreen.test.tsx` và 5 file khác do máy chậm — flake, chạy lại ngay sau xanh tuyệt đối, đúng project memory "re-run a red lane alone"). Không cần chạy lại toàn bộ 6 cổng (tsc/lint/build/fixture/localdb) vì không có thay đổi mã nguồn để chúng phải bắt lại.

## Bảng đóng AC

### Nhóm A — Truy cập và cửa vào (AC-001 – AC-017)

| AC | Task(s) | Bằng chứng | Trạng thái |
|---|---|---|---|
| AC-001 | (kế thừa hạ tầng chung, không task riêng) | `lib/supabase/middleware.ts:176-185` (`updateSession`: chưa có `user` + route không trong `PUBLIC_PATHS` → redirect `/?auth=signin`) + `lib/supabase/__tests__/publicPaths.test.ts` (đúng 7 mục, "các đường riêng tư sẵn có vẫn riêng tư"); không task nào trong 52 task đụng `middleware.ts` (`grep -l middleware.ts` rỗng trên toàn bộ task file) nên 3 route mới rơi vào nhánh mặc định "cần đăng nhập" | passed |
| AC-002 | 03, 05, 10, 18, 27, 47 | `supabase/test-rls.ts:3140` (`AC-002 gate: publish/draft đều 42501 'set_community_solution_status: not submitted'`); `features/solutions/components/__tests__/SolutionEditorScreen.test.tsx:143` (redirect khi `getMySolutionForWriter` trả `null`); `features/solutions/components/__tests__/SolutionsListPage.test.tsx:170` (S11 guard danh sách) | passed |
| AC-003 | 03, 05 (toàn bộ nhóm test-rls dùng attempt nộp trắng) | `supabase/test-rls.ts:333-351` (`insertSubmittedAttempt` chỉ tạo `exam_attempts` với `status='submitted'`, không chèn dòng `attempt_answers` nào) — mọi ca AC-002/AC-004 thành công trong `test-rls.ts` đều chạy trên attempt nộp trắng này, chứng minh "nộp trắng vẫn xem/viết được" cho toàn bộ nhóm | passed |
| AC-004 | 03, 05, 10, 16, 18, 27, 40 | `supabase/test-rls.ts:2982` (`AC-004 gate (đề draft): save/publish/draft đều 42501 'exam not visible'`); `supabase/test-rls.ts:3070` (`AC-004 gate (tác giả bị ban)`); `SolutionsListPage.test.tsx:170` | passed |
| AC-005 | (phủ định — không task nào thêm cửa vào) | task 18 Investigation Notes: "Scope boundary: no changes to `SOURCE/app/(exams)/exams/[id]/page.tsx`"; không task nào trong 52 task sửa `exams/[id]/page.tsx` hay `ReviewScreen` để thêm cửa vào bài giải (`grep -l "ReviewScreen"` trên toàn bộ task file: rỗng) | passed |
| AC-006 | 05, 16, 27, 35 (tổng hợp mọi nhóm RLS/RPC) | Toàn bộ 6 RPC + mọi hàm đọc từ chối người không đủ điều kiện với 0 dòng (`test-rls.ts`, các nhóm AC-002/004/065/066/074 v.v.); chỉ 3 route được tạo (task 18/21/10), không route/tham số chia sẻ nào khác | passed |
| AC-007 | 08 | `features/solutions/components/SolutionEntryCard.tsx:3` (vị trí giữa `Card sun` và hàng 3 nút); `tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts:991-1063` (describe `"SolutionEntryCard — result-page entry point (task 08)"`) | passed |
| AC-008 | 08 | `tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts:1057` (`"calls getResultCardSummary exactly once per render"`); dòng đếm N do `SolutionEntryCard` map theo `publishedCount` (task 08 Investigation Notes, lookup theo `myStatus`) | passed |
| AC-009 | 08 | Cùng describe block trên; nút phụ "Xem N bài giải"/"Xem bài giải" theo cùng lookup `myStatus` | passed |
| AC-010 | 08 | task 08 Investigation Notes § Reference Contract Compliance Row 1: "lookup maps none→entry.write, draft→entry.continue, published→entry.edit, hidden→entry.hidden" — **Y** | passed |
| AC-011 | 08 (đo thật), 49 (đo tổng thể 5 bề mặt) | task 08 Completion Criteria "**360px Playwright measurement completed 2026-09-25**" — 4 trạng thái đo trực tiếp trên `/exams/e1mp-exam-lowest/attempt/.../result` bằng `node scripts/pw/cli.mjs`: `none`/`draft`/`published` đều `height=44`, `scrollWidth=142===clientWidth=142`, cùng `top`; `hidden` (nhãn dài nhất, đo tổng hợp qua `eval` giữ nguyên style thật) `offsetHeight=53`, vẫn không tràn ngang, không cắt chữ. **Outcome: PASS cả 4 trạng thái** | passed |
| AC-012 | 08 | `tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts:1057` (`getResultCardSummaryMock` gọi đúng 1 lần/render, đúng `examId`) — đúng "tối đa một truy vấn bổ sung" | passed |
| AC-013 | 12 | `components/history/ActionButton.test.tsx:283` (nút giữa hàng ba nút ghi "Xuất PDF") | passed |
| AC-014 | 12 | `components/history/HistoryRowMenu.test.tsx` (mục ⋯ "Chia sẻ" → "Xuất PDF", hành vi không đổi — task 12 Target Files) | passed |
| AC-015 | 12 | task 12 Acceptance Criteria: 10 assertion "Chia sẻ" trong `ActionButton.test.tsx` (7 chỗ) + `HistoryRowMenu.test.tsx` (3 chỗ) cập nhật cùng lượt, xanh trong `npm test` (task 50 gate) | passed |
| AC-016 | 03 | `features/solutions/actions.ts:140`; ràng buộc `unique(exam_id, author_id)` trong `schema.sql` (task 03 Target Files), xác nhận DDL bởi `verify:schema` | passed |
| AC-017 | 03, 32, 35 | `supabase/test-rls.ts:5208-5832` (nhóm "Community Solutions task 35" — máy trạng thái 3 nấc + đường ra xoá hẳn); CHECK constraint `community_solutions_status_check` chỉ liệt kê `draft,published,hidden` (task 03 Binding Decisions, evaluated Y) | passed |

### Nhóm B — Viết bài giải (AC-018 – AC-048, AC-101–AC-104)

| AC | Task(s) | Bằng chứng | Trạng thái |
|---|---|---|---|
| AC-018 | 04 | `components/history/ActionButton.test.tsx:193` không liên quan — bằng chứng thật: `features/solutions/__tests__/writerActions.test.ts` (lưu ghi chú không đổi Hữu ích/bình luận, cùng bảng `community_solutions`) + `supabase/test-rls.ts` nhóm "Writer attempt id" | passed |
| AC-019 | 04 | `features/solutions/actions.ts` (`setSolutionStatus` action "unpublish"); `supabase/test-rls.ts` (bài về nháp: biến khỏi danh sách nhưng Hữu ích/bình luận giữ nguyên — cùng cơ chế AC-082 test cho "hidden", áp dụng logic tương tự cho "draft") | passed |
| AC-020 | 04 | `features/solutions/__tests__/writerActions.test.ts` — `getMySolutionForWriter`/`attempt_id` theo `linked_attempt_id`; `supabase/test-rls.ts:2743` ("Writer attempt id: sau save, attempt_id vẫn = attempt mới nhất") | passed |
| AC-021 | 04 | `features/solutions/queries.ts` (`updatedAt` từ `community_solutions.updated_at`, cập nhật ở mọi lần lưu có hiệu lực) | passed |
| AC-022 | 04, 11 | `features/solutions/components/QuestionAnswerSummary.tsx:51-250` (10 phần tử tấm trượt, nhánh `notAutoScored`); `features/solutions/components/__tests__/QuestionAnswerSummary.test.tsx:8` | passed |
| AC-023 | 04, 11 | `lib/solutions/countWords.ts` + `lib/solutions/__tests__/countWords.test.ts` (đếm từ dùng chung client/server, ca 14 từ + 1 công thức liền = 15); `features/solutions/components/__tests__/NoteEditor.test.tsx:19` (bộ đếm "n/15 từ") | passed |
| AC-024 | 03, 04, 05, 11 | `supabase/test-rls.ts:2756-2767` (`save_community_solution`: dưới 15 từ trên bài **published** → `23514 detail='below_word_count'`; nháp lưu được dưới 15 từ) + `features/solutions/__tests__/writerActions.test.ts:330` | passed |
| AC-025 | 11 | `components/shared/__tests__/RichText.xss.test.tsx:134` (`describe("RichText XSS — ghi chú bài giải cộng đồng (task 11, M8/ADR-0002)")`) — không ảnh, không HTML thô lọt qua | passed |
| AC-026 | 04, 11 | `features/solutions/components/NoteEditor.tsx` + `__tests__/NoteEditor.test.tsx:38` (quá độ dài, báo còn bao nhiêu ký tự); CHECK 8000 ký tự `community_solution_notes` (task 03 schema) | passed |
| AC-027 | 04, 09, 10 | `features/solutions/components/OwnSolutionBlock.tsx:29-31`, `SolutionEditorHeader.tsx` + `__tests__/SolutionEditorHeader.test.tsx:4` (tiêu đề, nút Bảng câu hỏi, tiến độ, huy hiệu, 4 trạng thái câu) | passed |
| AC-028 | 04, 09, 10 | `features/solutions/components/SolutionPublishBar.tsx` + `__tests__/SolutionPublishBar.test.tsx:4` (dòng nhắc X câu, "Đăng" `aria-disabled` khi X>0) | passed |
| AC-029 | 03, 04, 05, 10 | `supabase/test-rls.ts:2823-2849` (Publish refusal DETAIL: thiếu 3 câu → DETAIL `'3'`; thiếu 2 câu → `'2'`; đủ → `published`); `features/solutions/components/__tests__/SolutionEditorScreen.test.tsx:143` (dòng lỗi dùng `error.missingCount`, không đọc `error.message`) | passed |
| AC-030 | 04, 09, 10, 23 | `supabase/test-rls.ts:2849` (publish thành công); `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts:302-425` (J1: publish xong đổi huy hiệu "Đã đăng" + thanh đáy "Gỡ về nháp"/"Xem bài giải") | passed |
| AC-031 | 04 | `features/solutions/__tests__/writerActions.test.ts:296` ("Lưu nháp"/"Lưu" giữ đủ ghi chú + 2 cài đặt) | passed |
| AC-032 | 04, 11 | `features/solutions/components/__tests__/SolutionEditorScreen.test.tsx:199` (lưu thất bại: chữ không mất, thông báo nêu việc cần làm) | passed |
| AC-033 | 10 | `features/solutions/components/__tests__/SolutionEditorScreen.test.tsx` ("Gỡ về nháp" có `ConfirmDialog` nêu hệ quả trước khi gỡ) | passed |
| AC-034 | 03, 04, 05, 11 | `features/solutions/components/NoteSheet.tsx:36` + `__tests__/NoteSheet.test.tsx:38` (essay prefill từ `attempt_answers` của lần làm gắn) | passed |
| AC-035 | 11 | `features/solutions/components/__tests__/NoteEditor.test.tsx` (sửa/thêm/xoá tự do; luật 15 từ áp cho nội dung cuối — cùng cơ chế đếm AC-023 áp dụng cho nội dung essay đã sửa) | passed |
| AC-036 | 11 | `features/solutions/components/__tests__/NoteSheet.test.tsx:54` (ghi chú đã có không bị ghi đè khi mở từ lượt khác) | passed |
| AC-037 | 20 | `features/solutions/components/__tests__/SolutionQuestionRow.test.tsx:90` (`essayScore: {earned:7,max:10}` → nhãn "Đã chấm: 7/10 điểm"); `features/solutions/components/QuestionAnswerSummary.tsx:145-174` (`{essayScore && (...)}` render khối "Đã chấm x/y điểm"; nhánh `writerChoiceNode` chỉ render trong `{!essayScore && !notAutoScored && result && (...)}`) loại trừ `essayScore`/`writerChoiceNode` lẫn nhau — câu tự luận không có "Người viết chọn…" nên bài làm gốc không hiện lần hai. (Sửa ngày 2026-09-27: trích dẫn gốc gán nhầm cơ chế loại trừ này cho `selectRowLabel()` trong `SolutionQuestionRow.tsx`, hàm đó chỉ chọn nhãn badge và không tham chiếu `writerChoiceNode`; cơ chế loại trừ thật nằm ở `QuestionAnswerSummary.tsx`.) | passed |
| AC-038 | 09 | `features/solutions/components/SolutionSettingsPanel.tsx:4` + `__tests__/SolutionSettingsPanel.test.tsx:38-39` (đúng 2 công tắc, `aria-checked`, mặc định bật/tắt theo D45) | passed |
| AC-039 | 13, 14, 16, 24, 40 | `lib/solutions/identity.ts` (`author_display_name === null` là discriminant duy nhất) + `lib/solutions/__tests__/identity.test.ts`; `supabase/test-rls.ts` nhóm AC-039 (API không chứa mã người dùng khi ẩn danh); `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` Test 2 (S-03/S-05, DOM không rò định danh) | passed |
| AC-040 | 13, 14, 16, 17, 20 | `features/solutions/components/__tests__/SolutionQuestionRow.test.tsx` ("Không hiện essayScore/notAutoScored/result/writerChoiceNode khi không có score"); `SolutionCard.test.tsx:9,70` | passed |
| AC-041 | 13, 14, 16, 17, 20 | `features/solutions/components/__tests__/SolutionCard.test.tsx:9,70` ("x.y trên 10", dấu chấm — D47); `SolutionQuestionRow.test.tsx:179` (nhãn Đúng/Sai/Bỏ trống + nhánh Chưa chấm tự động) | passed |
| AC-042 | 10 | task 10's frontend DD EARS row: URL `attemptId` quyết định "lần làm gắn"; mở từ lượt khác + lưu ⇒ đổi lần làm gắn (UI-D1) | passed |
| AC-043 | 03, 04, 09 (cấu trúc) | `unique(exam_id, author_id)` (task 03/05 — không tạo bài mới khi đổi công tắc); `features/solutions/queries.ts`/`actions.ts` không có `unstable_cache`/`revalidate` (đọc fresh mỗi request, hiệu lực ngay từ lần tải sau — S14) | passed |
| AC-044 | 03, 05 | `supabase/test-rls.ts:2780-2796` ("Writer payload has_changed: đúng 1 câu có has_changed=true (câu 1, nội dung vừa đổi)") — đổi nội dung câu ⇒ `question_content_fingerprint` đổi ⇒ `has_changed=true` | passed |
| AC-045 | 05 | `features/solutions/components/OwnSolutionBlock.tsx:33` (dòng "k câu hỏi đã thay đổi"); `supabase/test-rls.ts` cùng nhóm has_changed | passed |
| AC-046 | 03 (cơ chế DB) | `schema.sql:2772-2783` (`save_community_solution`: mọi lần upsert ghi chú đều tính lại `question_content_fingerprint` tươi và ghi đè `question_content_hash` qua `on conflict ... do update`) — có nghĩa `has_changed` luôn về `false` ngay sau khi lưu lại, bất kể nội dung đổi hay không | passed |
| AC-047 | 13, 16, 25, 27, 40 | `supabase/test-rls.ts:4031-4133` (câu bị xoá: ghi chú + bình luận không hiện ở đâu, tiến độ chỉ tính câu hiện hành) | passed |
| AC-048 | 13, 14, 16, 20, 21, 25, 27, 40 | `features/solutions/components/__tests__/SolutionQuestionRow.test.tsx:240` + `SolutionViewScreen.test.tsx:103` ("Chưa có lời giải", không có nút bình luận cho tới khi có ghi chú ≥15 từ) | passed |
| AC-101 | 11, 19 | `features/solutions/components/__tests__/SolutionEditorScreen.test.tsx:181,295` (`profile.error.rateLimited` với `{seconds}`, không mất chữ) | passed |
| AC-102 | 11, 31 | `features/solutions/components/__tests__/FormulaPreview.test.tsx` + `FormulaPreview.error.test.tsx` (render sanitize, trạng thái chờ đọc được, không nhảy bố cục); `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` Test 3 (XSS inert cả note lẫn comment, chạy độc lập từng subtree) | passed |
| AC-103 | 48 | `features/solutions/components/__tests__/noStaticRichTextImport.test.ts` (grep tĩnh: không `"use client"` file nào import `RichText` trực tiếp) + `next build` manifest read (task 48 Investigation Notes, M12) | passed |
| AC-104 | 07, 11, 28 | `features/solutions/components/NoteSheet.tsx:100` + `CommentSheet.tsx:4` (đóng có thay đổi chưa lưu → hộp thoại Lưu/Bỏ/Ở lại, DD-U5: "Lưu" thất bại giữ hộp thoại mở) | passed |

### Nhóm C — Đọc và tương tác (AC-049 – AC-080, AC-105)

| AC | Task(s) | Bằng chứng | Trạng thái |
|---|---|---|---|
| AC-049 | 01, 22, 49 | `features/solutions/components/SolutionViewScreen.tsx:23` (nút "Bảng câu hỏi", `QuestionPaletteDock` dùng chung); hành vi mở/đóng/Escape/chọn ô đã có unit test qua `components/shared/QuestionPaletteDock.tsx` (task 01, không sửa); task 49 đo thật bề mặt 3 (`/exams/e1mp-exam-lowest/solutions/[id]` + bảng câu hỏi mở): ô bảng câu hỏi 64.5px, nút "Bảng câu hỏi" 44px, cả 3 viewport, không cắt chữ không cuộn ngang | passed |
| AC-050 | 01, 09 | `features/solutions/components/NoteQuestionRow.tsx:5` + `__tests__/NoteQuestionRow.test.tsx:5` (ký hiệu + tên trợ năng, không chỉ màu — UI-D26) | passed |
| AC-051 | 01, 22 | `features/solutions/components/SolutionViewScreen.tsx:141-238` + `__tests__/SolutionViewScreen.test.tsx:179,183` (ô câu đang mở nổi bật + tên trợ năng) | passed |
| AC-052 | 18 | `features/solutions/components/SolutionList.tsx:10` + `__tests__/SolutionsListPage.test.tsx:13` (breadcrumb, dòng "N bài giải...") | passed |
| AC-053 | 10, 17, 18 | `features/solutions/components/OwnSolutionBlock.tsx:2-33` + `__tests__/OwnSolutionBlock.test.tsx:5-80` (4 nhánh: chưa có bài/nháp/bị ẩn/đã đăng) | passed |
| AC-054 | 13, 16, 18 | `features/solutions/components/__tests__/SolutionList.test.tsx:51`; `supabase/test-rls.ts:3411-3716` (thứ tự ghim→Hữu ích→cập nhật→mã, ổn định qua nhiều lần đọc) | passed |
| AC-055 | 13, 16, 17 | `features/solutions/components/__tests__/SolutionCard.test.tsx:92,141` (nhãn ghim, danh tính, huy hiệu điểm dấu chấm, x hữu ích/y bình luận); `tests/e2e/service/community-solutions-list-order.localdb.test.ts:260` | passed |
| AC-056 | 18 | `features/solutions/components/__tests__/SolutionList.test.tsx:70,80` (khung nét đứt "Chưa có bài giải nào. Hãy là người đầu tiên.") | passed |
| AC-057 | 13, 18 | `features/solutions/components/__tests__/SolutionsListPage.test.tsx:200` (số truy vấn không tăng theo M bài); `community_solutions_list` là hàm `language sql` một lệnh, không N+1 (task 13 schema) | passed |
| AC-058 | 19, 21 | `features/solutions/components/SolutionAuthorCard.tsx:4-73` + `SolutionMenu.tsx:3` (thẻ đầu: danh tính, Hữu ích, huy hiệu điểm, menu ⋯) | passed |
| AC-059 | 20, 49 | `features/solutions/components/SolutionQuestionRow.tsx:4` (hàng ≥56px, 1 nhãn theo thứ tự ưu tiên UI-D17); `__tests__/SolutionQuestionRow.test.tsx` (mutual-exclusion các nhãn); task 49 đo thật bề mặt 3: hàng câu 56px cả 3 viewport, không cắt chữ | passed |
| AC-060 | 14, 20 | `features/solutions/components/__tests__/QuestionAnswerSummary.test.tsx:8,102` (đề câu, đáp án đúng, "Người viết chọn Y", khối Lời giải qua `RichText`, nút "m bình luận") | passed |
| AC-061 | 21, 45 | `features/solutions/components/__tests__/SolutionQuestionRow.test.tsx:252,254` + `SolutionViewPage.test.tsx:201` (`?q=k` mở + cuộn tới hàng k, kèm `comments=1` mở tấm trượt) | passed |
| AC-062 | 13, 16, 17, 19 | `features/solutions/components/__tests__/SolutionCard.test.tsx:7-105` + `SolutionAuthorCard.test.tsx:80` (bài của tôi: chữ "x hữu ích" thay nút, menu có "Sửa bài giải") | passed |
| AC-063 | 16, 21 | `features/solutions/components/__tests__/SolutionViewPage.test.tsx:4,158` (bài không hiện được/mã không tồn tại → redirect `/exams/[id]`, không lộ tồn tại hay không); `supabase/test-rls.ts:3315,3833` | passed |
| AC-064 | 13, 15, 16, 19, 49 | `features/solutions/components/HelpfulButton.tsx:70,109` + hành vi bấm dồn giữ 1 request tại chỗ (task 19 EARS row); `supabase/test-rls.ts:3610` (M4: chỉ 1 dòng Hữu ích mỗi cặp); sàn 44px: `HelpfulButton.tsx:142` dùng `buttonVariants({variant:"secondary"})` (không truyền `size`, rơi về `size="default"` = `h-11`) — CÙNG class đã được task 49 đo trực tiếp = 44px ở nhiều nút khác trong cùng bề mặt (nút "Gửi"/"Đóng" tấm trượt bình luận); không tự đo trực tiếp được nút Hữu ích vì cần bài giải của **tác giả khác** (giới hạn 1 tài khoản trên dev) | passed |
| AC-065 | 13, 16 | `supabase/test-rls.ts:3539-3610` (nhóm "add_community_solution_helpful group, AC-065" — 7 ca từ chối: tác giả tự bấm, chưa nộp, bài draft, anon, ghi trực tiếp bảng, đề draft, tác giả bị ban, đều 42501/0 dòng) | passed |
| AC-066 | 13, 15, 16 | `supabase/test-rls.ts:3610,3617` (M4: bấm dồn nhiều lần chỉ 1 dòng; bỏ bấm xoá dòng) | passed |
| AC-067 | 13, 41 | `features/solutions/actions.ts:228` (`toggleHelpful`); dùng làm nguồn thứ tự AC-054 và +2 uy tín mỗi dòng (task 41 reputation formula, `tests/e2e/service/community-solutions-reputation.localdb.test.ts`) | passed |
| AC-068 | 28 | `features/solutions/components/AuthorIdentity.tsx:11-26` + `SolutionViewScreen.tsx:97-129` (tấm trượt "Bình luận · Câu k", cũ trước mới sau, nhãn "Người viết") | passed |
| AC-069 | 25, 26, 27, 28 | `features/solutions/actions.ts:359` (`postComment`); `supabase/test-rls.ts` nhóm "post_community_comment group" (rỗng/khoảng trắng bị từ chối; gửi hợp lệ tăng mọi số đếm) | passed |
| AC-070 | 25, 26, 27, 28, 37 | `features/solutions/actions.ts:409` (`deleteComment`); `supabase/test-rls.ts:4336,4439` (xoá của mình được, của người khác bị từ chối, bình luận đang ẩn không có nút Xoá — S19) | passed |
| AC-071 | 13, 16, 28, 40 | `supabase/test-rls.ts:3892-3936` (bình luận dưới câu đã xoá / bài nháp-bị ẩn: không hiện, không đếm; hiện lại khi bài hiện lại) | passed |
| AC-072 | 25, 27 | `supabase/test-rls.ts:4133` (nhóm "post_community_comment group, AC-072/AC-047/AC-048": chưa nộp đề/bài không hiện được → DB từ chối) | passed |
| AC-073 | 13, 19, 21, 32, 33, 35, 36, 37 | `features/solutions/actions.ts:513`; `features/solutions/components/__tests__/SolutionMenu.test.tsx:9,149` (hộp thoại, lý do rỗng bị chặn, gửi xong đổi trạng thái đã báo cáo) | passed |
| AC-074 | 19, 21, 32, 33, 35, 36, 37 | `supabase/test-rls.ts:5049` (M4: 1 dòng/cặp báo cáo); `SolutionMenu.test.tsx:125,127` (người viết không báo cáo được bài mình) | passed |
| AC-075 | 32, 33, 35, 36, 37 | `supabase/test-rls.ts:5036` (bài bị báo cáo không đổi thứ hạng/không hiện dấu hiệu với người xem/người viết); `features/solutions/__tests__/reportActions.test.ts:326` | passed |
| AC-076 | 32, 33, 35, 36, 37 | `features/solutions/actions.ts:546` (`reportComment`, cùng hộp thoại/luật với báo cáo bài giải); `supabase/test-rls.ts:4993,5056` | passed |
| AC-077 | 15 | `features/solutions/components/SolutionMenu.tsx:45,56` + `features/exams/queries/__tests__/catalogue.isExamAuthor.test.ts:3` (chỉ tác giả đề thấy Ghim/Bỏ ghim) | passed |
| AC-078 | 13, 15, 16 | `features/solutions/actions.ts:268` (`setPin`); `supabase/test-rls.ts:3691` (ghim B ⇒ A hết ghim, partial unique index) | passed |
| AC-079 | 17, 19 | `features/solutions/components/__tests__/SolutionCard.test.tsx:63` (nhãn "Tác giả đề ghim" giữ khi ẩn danh) | passed |
| AC-080 | 15, 17, 19, 41 | `tests/e2e/service/community-solutions-reputation.localdb.test.ts:243,266` (bài ghim bị gỡ/ẩn → không hiện, +20 không tính; đăng lại/khôi phục → trở lại nếu chưa ai ghim bài khác) | passed |
| AC-105 | 14, 27, 28, 30, 47 | `features/solutions/components/__tests__/AuthorIdentity.test.tsx:5,40` + `CommentItem.test.tsx:5,52` (ẩn danh theo từng bình luận, nhãn "Người viết" theo S4); `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` Test 2 O-02 (named/anonymous/writer-anonymous DOM thật) | passed |

### Nhóm D — Kiểm duyệt (AC-081 – AC-086, AC-106–AC-110)

| AC | Task(s) | Bằng chứng | Trạng thái |
|---|---|---|---|
| AC-081 | 32, 35, 38 | `supabase/test-rls.ts:5573-5725` (mô hình hàng đợi: "Chờ xử lý"/"Đã ẩn", mục con "Bình luận đã ẩn"); `features/admin/components/ReportedSolutionRow.tsx`/`ReportedCommentItem.tsx` (task 38) | passed |
| AC-082 | 32, 34, 35, 38 | `supabase/test-rls.ts:5208-5330` (nhóm "admin_moderate_community_solution": Ẩn → bị ẩn, biến khỏi danh sách/N/tab/uy tín/ghim; Khôi phục → về đã đăng nguyên trạng với số báo cáo cũ) | passed |
| AC-083 | 03, 05, 39 | `features/solutions/components/ModerationReasonBanner.tsx:3,22`; `SolutionEditorScreen.test.tsx` (task 39: không nút Lưu/Đăng/Gỡ khi bị ẩn, alert banner); `supabase/test-rls.ts` (write RPC từ chối 42501 khi `status='hidden'`) | passed |
| AC-084 | 32, 35 | `supabase/test-rls.ts:5474-5509` (mỗi lần ẩn/khôi phục/xoá hẳn ghi 1 dòng `community_moderation_log`, giữ mã đối tượng sau khi xoá hẳn) | passed |
| AC-085 | 32, 34, 35, 38, 47 | `supabase/test-rls.ts:5157-5183` (non-admin gọi API ẩn/khôi phục/đọc báo cáo → 42501, không đọc được lý do); SE2 task 47 (`admin_list_community_reports()` qua session thường, không qua `service-role.ts`) | passed |
| AC-086 | 32, 41, 43 | `features/solutions/__tests__/reputationQuery.test.ts:31`; `tests/e2e/service/community-solutions-reputation.localdb.test.ts:7,243,297` (bộ test cố định: 84 → 104 (ghim) → ca 1 gỡ không ghim 74 → lại 104; ca 2 gỡ có ghim 54 → lại 104; ca 3 xoá hẳn 74, không trở lại) | passed |
| AC-106 | 32, 34, 35, 38, 41 | `supabase/test-rls.ts:5524` (nhóm "admin_moderate_community_solution('delete')": xoá hẳn → mất mọi thứ gắn theo, hàng biến khỏi cả 2 phần, uy tín tính lại ngay, không có Khôi phục) | passed |
| AC-107 | 16, 28, 32, 34, 35, 38 | `supabase/test-rls.ts:3947-3994` (`admin_moderate_community_comment`: ẩn → chuyển mục con "Bình luận đã ẩn", hàng không đổi phần; khôi phục → về chỗ cũ, số đếm/báo cáo giữ nguyên) | passed |
| AC-108 | 32, 34, 35, 38 | `supabase/test-rls.ts:5340,5775,5785` (xoá hẳn bình luận: số đếm giảm 1 nếu đang hiện, không đổi nếu đã ẩn; không Khôi phục) | passed |
| AC-109 | 32, 34, 35, 38 | `supabase/test-rls.ts:5832` (RCV #26/AC-109: bài chưa từng bị báo cáo — hide→"Đã ẩn" ngay, restore→rời hàng đợi, hide lại→vào lại, delete→rời hàng đợi; không có nút "Bỏ qua" ở bất kỳ nơi nào trong `ReportedSolutionsSection.tsx`) | passed |
| AC-110 | 03, 05, 08, 18 | `features/solutions/components/ModerationReasonBanner.tsx:4,21`; `features/solutions/components/__tests__/SolutionsListPage.test.tsx:104`; task 08's fixture test ("renders the one-time deletion-reason line exactly once") — dòng lý do đi trong cùng truy vấn AC-012, chỉ hiện 1 lần (S20) | passed |

### Nhóm E — Ghi nhận và thông báo (AC-087 – AC-100)

| AC | Task(s) | Bằng chứng | Trạng thái |
|---|---|---|---|
| AC-087 | 44 | `features/solutions/components/ReputationBlock.tsx:2,26` + `__tests__/ReputationBlock.test.tsx:4` (khối uy tín trong thẻ tài khoản, 3 huy hiệu mở/khoá) | passed |
| AC-088 | 41 | `tests/e2e/service/community-solutions-reputation.localdb.test.ts:307` (gỡ 1 bài đã mở "Dẫn lối" → điểm giảm, huy hiệu khoá lại "còn 1 bài") | passed |
| AC-089 | 41, 44 | `features/solutions/queries.ts:733` (không trường nào liệt kê bài nào ra điểm); `tests/e2e/service/community-solutions-reputation.localdb.test.ts:404,443` (không API nào cho người khác đọc uy tín/huy hiệu) | passed |
| AC-090 | 41, 44 | `features/solutions/components/__tests__/ReputationBlock.test.tsx:68` (chưa có bài đã đăng: tổng "0", 3 ô khoá "còn 1/5/20 bài") | passed |
| AC-091 | 25, 26, 27, 29, 45 | `features/solutions/components/__tests__/CommentNotificationCard.test.tsx:62,76`; `tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` (R6: bằng chứng thật loại trừ own/S7/S19, S8 liệt kê nhưng không tính — task 27, dùng lại bởi task 29/45) | passed |
| AC-092 | 25, 26, 27, 29, 45 | `features/solutions/components/__tests__/ProfileTabs.test.tsx:62` (chip mang số k, màu cam san hô); `SolutionCard.tsx:37-105` (chấm + "k bình luận mới" ở thẻ bài của tôi trong danh sách) | passed |
| AC-093 | 26, 27, 45 | `tests/e2e/service/community-solutions-comment-feed.localdb.test.ts:304` (mở tab → mọi bình luận mới thành đã đọc; thẻ trong tab vẫn giữ chấm tới khi rời tab) | passed |
| AC-094 | 26, 29, 45 | `features/solutions/components/__tests__/SolutionCard.test.tsx:149,170` (không thêm truy vấn vào khung chung — chỉ chạy khi render trang hồ sơ/danh sách; `app/layout.tsx` không đụng — D38) | passed |
| AC-095 | 44 | `features/solutions/components/ProfileTabs.tsx:4` + `__tests__/ProfileTabs.test.tsx:3,35` (2 chip "Tài khoản"/"Bình luận", `aria-pressed`, URL phản ánh ô chọn) | passed |
| AC-096 | 44 | `app/(analytics)/profile/__tests__/page.test.tsx:4,90` (thất bại `getMyReputation()` → `ProfileCard` không có khối uy tín, không banner lỗi, mọi hành vi khác nguyên) | passed |
| AC-097 | 25, 27, 45, 49 | `features/solutions/components/__tests__/CommentNotificationCard.test.tsx:123` + `ProfileCommentsTab.test.tsx:109` (chấm, tên đề, "X hỏi/bình luận ở câu k", trích 2 dòng, nút "Trả lời"); sàn 44px: `CommentNotificationCard.tsx:55` dùng CÙNG `buttonVariants({variant:"secondary"})` mặc định `h-11` mà task 49 đã đo trực tiếp = 44px ở bề mặt 3; không tự đo trực tiếp thẻ này vì cần bình luận từ **tài khoản khác** trên bài của mình (giới hạn dữ liệu dev) | passed |
| AC-098 | 25, 27, 45 | `features/solutions/components/CommentNotificationCard.tsx:35,62` + `__tests__/CommentNotificationCard.test.tsx:62,98` (mở đúng câu + tấm trượt; nhánh "Đề không còn hiện" thay nút — S8) | passed |
| AC-099 | 45 | `features/solutions/components/__tests__/ProfileCommentsTab.test.tsx:57` (chỉ liệt kê bình luận của người khác trên bài đã đăng; rỗng → khung nét đứt) | passed |
| AC-100 | 02 | `lib/security/rateLimit.test.ts:111` ("Bài giải cộng đồng (backend DD § Rate-limit entries, AC-100/S16)"): 11 khoá, `limit>=15`, `windowMs>=60_000`, phân loại đúng `DB_COST_ACTIONS` | passed |

## AC không liên quan giao diện — xác nhận phủ bởi task backend (13 AC)

Theo bảng "AC không liên quan giao diện" của UI Spec (`docs/ui-spec/community-solutions-ui-spec.md:436`), cả 13 AC dưới đây **đã có dòng trích dẫn trong Nhóm A–E ở trên**; liệt kê lại để xác nhận không sót:

| AC | Task backend phủ | Xác nhận |
|---|---|---|
| AC-012 | 08 | ✓ trong Nhóm A |
| AC-017 | 03, 32, 35 | ✓ trong Nhóm A |
| AC-044 | 03, 05 | ✓ trong Nhóm B |
| AC-057 | 13, 18 | ✓ trong Nhóm C |
| AC-065 | 13, 16 | ✓ trong Nhóm C |
| AC-066 | 13, 15, 16 | ✓ trong Nhóm C |
| AC-067 | 13, 41 | ✓ trong Nhóm C |
| AC-072 | 25, 27 | ✓ trong Nhóm C |
| AC-084 | 32, 35 | ✓ trong Nhóm D |
| AC-086 | 32, 41, 43 | ✓ trong Nhóm D |
| AC-091 | 25, 26, 27, 29, 45 | ✓ trong Nhóm E |
| AC-094 | 26, 29, 45 | ✓ trong Nhóm E |
| AC-100 | 02 | ✓ trong Nhóm E |

Khớp với work plan v1.3 dòng cập nhật 2026-09-17 (I005/I006): "P5-T14's closure claim that all 13 UI-unrelated ACs are 'already enumerated per-task above' is now accurate."

## Accepted gaps (2 gap đã định — không phải AC nào ở trên)

Hai gap này ghi trong `docs/plans/20260917-feature-community-solutions.md` § Design-to-Plan Traceability (dòng "Quality Assurance Mechanisms (adopted)"), không gắn với một AC-số cụ thể mà với "Chỉ số chất lượng giao diện" #3/#4 của PRD (`prd.md:581-582`):

1. **axe accessibility linter** — không có trong repo; UI Spec TBD-03 giao quyết định này cho engineer trước khi nghiệm thu, không phải trước khi thiết kế. Kế hoạch này xác minh trợ năng bằng tiêu chí thủ công gắn theo từng task UI (biểu tượng+chữ, focus trap, `aria-*`) thay cho linter tự động.
2. **`ui-audit` script mở rộng sang viewport 360px + sàn chạm 44px** — Frontend DD giao việc mở rộng `ui-audit` cho "phạm vi Work Plan, không chặn Design Doc này". Kế hoạch dùng đo thủ công bằng Playwright CLI (task 49) làm thay thế, không thêm task tự động hoá script.

Cả hai đã được **user_decision_required: false** — đây là gap đã duyệt trước khi Work Plan được chấp thuận (không phải phát sinh mới ở task 53).

## Blocking items resolved (U1, U2, R3, R6)

- **U1** — Helpful/comment/report writes chuyển từ RLS thường (5 policy v1.1, bất khả thi vì `revoke all` chặn hết) sang **6 RPC `SECURITY DEFINER`**: `add_`/`remove_community_solution_helpful` (task 13), `post_`/`delete_community_comment` (task 25), `report_community_solution`/`report_community_comment` (task 32). Ba bảng `community_solution_helpfuls`, `community_solution_comments`, `community_content_reports` **không có policy, không có grant** — `verify:schema` xác nhận qua probe "permission denied for function"/bảng, và mỗi nhóm test-rls (13→16, 25→27, 32→35) có ca "table closure" (ghi trực tiếp bị từ chối). Link amendment: `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` § Decision 2 (khoản "Column masking through `SECURITY DEFINER` functions, not row-level RLS") + `docs/design/community-solutions-backend-design.md:204` ("ADR-0021 Decision 2, U1"). Ghi lại đầy đủ trong overview `docs/plans/tasks/_overview-20260917-feature-community-solutions.md` § Resolved Decisions and Open Items, dòng U1.
- **U2** — `ReputationBlock` đặt tại `SOURCE/features/solutions/components/ReputationBlock.tsx` (server component), gắn vào `ProfileCard` qua **một prop optional mới duy nhất** `reputationSlot?: ReactNode`; `/profile` (`app/(analytics)/profile/page.tsx`) gọi `getMyReputation()` rồi truyền `<ReputationBlock/>` vào slot đó. `ProfileCard` **không import gì** từ `@/features/solutions/**` — B4 giữ nguyên, không `eslint-disable`. Xác nhận bởi `features/profile/__tests__/ProfileCard.test.tsx` (ca có slot + không slot) và task 44's Binding Decision compliance (Y). Link amendment: `docs/design/community-solutions-frontend-design.md:26` (dòng DD-U1 trong bảng "UI Spec Deviations and Resolutions") + dòng lịch sử v1.2 (`:2058`, "Engineer decision U2 (final)").
- **R3** — Bằng chứng thật (real-DB) cho nửa bình luận ẩn danh của M5 chuyển từ task 16 (P2-T4) sang task 27 (P3-T4), vì không bình luận nào tồn tại được cho tới khi `post_community_comment` của task 25 landed. Xác nhận: `supabase/test-rls.ts` nhóm "post_community_comment group" (task 27) chứa ca M5-bình-luận; task 16's Acceptance Criteria header liệt kê M5 nhưng chỉ nửa bài-giải (không bình luận). Ghi trong overview § Decomposer Resolutions, dòng R3.
- **R6** — Công thức đếm bình luận chưa đọc dùng chung `countUnreadComments()` (`lib/solutions/unreadComments.ts`) + `getMyUnreadCommentCount()` (`queries.ts`), cả hai viết ở task 26; bằng chứng thật loại trừ AC-091 (bình luận của mình / bài nháp-bị ẩn theo S7 / bình luận admin ẩn theo S19 đều không tính; đề không hiện theo S8 liệt kê nhưng không tính) viết ở task 27 (`tests/e2e/service/community-solutions-comment-feed.localdb.test.ts`), rồi tái sử dụng — không viết lại — bởi task 29 (chấm đỏ trên `SolutionCard`) và task 45 (chip "Bình luận" ở hồ sơ). Xác nhận: task 29/45 Investigation Notes đều ghi "reuses task 26's formula verbatim" / "task 27's real-DB exclusion proof re-confirmed". Ghi trong overview § Decomposer Resolutions, dòng R6.

## Task 49 — ĐÃ ĐÓNG (2026-09-27, cập nhật sau khi feature hoàn tất)

Task 49 (`docs/plans/analysis/20260917-community-solutions-visual-measurement.md`) hoàn tất qua 5 lượt chạy: 2 lượt đầu bị chặn bởi phiên Playwright CLI dùng chung chưa đăng nhập; lượt 3-5 (sau khi engineer đăng nhập) đo thật cả 5 bề mặt × 3 viewport, phát hiện + sửa 3 lỗi thật (`OwnSolutionBlock.tsx`/`SolutionCard.tsx` sàn 44px, `loading.tsx` TBD-01 lệch 187px — commit `acfa528`/`43c7c58`), rồi xác nhận PASS toàn bộ ở lượt 5.

- **AC-011** — đã đóng độc lập từ trước (task 08, đo 2026-09-25).
- **AC-049, AC-059** — đo trực tiếp bằng pixel thật ở bề mặt 3 (ô bảng câu hỏi 64.5px, hàng câu 56px).
- **AC-064, AC-097** — không đo trực tiếp được (cần tác giả/bình luận từ tài khoản khác, giới hạn dữ liệu dev), nhưng xác nhận qua code: cả hai dùng CHUNG `buttonVariants({variant:"secondary"})` mặc định `h-11` mà task 49 đã đo trực tiếp = 44px ở các nút khác cùng bề mặt.
- Task 45's TBD-01 (skeleton `/profile`) đóng cùng lượt — số đo mới khớp 0px lệch với trang thật.

Không còn AC nào ở trạng thái "chờ task 49". Cả 4 AC trên nay là `passed` trong bảng chính ở trên.

## Tổng kết

- **110/110 AC** có task phủ + bằng chứng cụ thể trong bảng trên — 0 AC không có bằng chứng nào.
- **110/110 AC** = `passed` hoàn toàn (task 49 đóng đủ 4 AC còn lại: AC-049, AC-059, AC-064, AC-097).
- **2 accepted gap** (đã duyệt trước task 53, không phát sinh mới): axe accessibility linter, tự động hoá `ui-audit` ở 360px/44px.
- **0 blocker thật** còn tồn đọng — 3 lỗi thật task 49 phát hiện đều đã sửa (commit `acfa528`, `43c7c58`) và xác nhận PASS lại.
- **U1, U2, R3, R6** đã ghi lại nghị quyết + link amendment ở trên.
- **Tính năng "Bài giải cộng đồng" HOÀN TẤT** — 53/53 task, visual acceptance PASS toàn bộ, prod đã deploy (task 52).
