# Tab "Bài giải" ở trang Hồ sơ (2026-10-03)

## Yêu cầu
Người đã viết bài giải vào lại trang chỉnh sửa/xem bài của mình trong 1–2 thao tác. Hiện chỉ có hai đường: nút "Sửa bài giải" ở trang kết quả của TỪNG đề, hoặc nhớ đúng đề. Không có nơi nào liệt kê "mọi bài giải của tôi".

Đường mới: Hồ sơ → chip **Bài giải** (thao tác 1) → nút **Sửa bài giải** / **Xem** trên thẻ của bài (thao tác 2).

## Quyết định
| # | Quyết định | Lý do |
|---|---|---|
| D1 | Chip thứ hai trong `ProfileTabs`: Tài khoản · **Bài giải** · Bình luận. URL `?tab=solutions`. | Trang đã có khung tab; thêm một chip, không thêm trang. Người dùng đề xuất tab ở Hồ sơ. |
| D2 | Hàm DB mới `community_my_solutions()` (schema §28), không tham số, chỉ đọc `auth.uid()`. | Bảng `community_solutions` bị `revoke all` với `authenticated`; chỉ đọc qua RPC. Không hàm nào có sẵn liệt kê bài của chính tác giả xuyên nhiều đề. |
| D3 | Mỗi thẻ: tên đề, môn + lớp, nhãn trạng thái (Nháp / Đã đăng / Bị ẩn), "Cập nhật …", số "hữu ích" khi đã đăng. Nút "Sửa bài giải" (luôn có nếu mở được) và "Xem" (chỉ bài đã đăng). | Việc người đọc làm là mở lại bài. Con số phụ khác bỏ. |
| D4 | Đề không còn hiện (chưa published / tác giả đề bị ban) hoặc không còn lượt nộp để gắn: không nút, dòng "Đề không còn hiện". | Cùng quy ước thẻ bình luận (`profile.comments.examHidden`): không bao giờ một liên kết gãy — trang viết bài redirect khi cổng R1 không qua. |
| D5 | `attempt_id` của hàm = `coalesce(linked_attempt_id, lượt nộp mới nhất)` — đúng công thức `community_solution_for_writer`. | URL trang viết đòi `attemptId` khớp; sai thì redirect. |
| D6 | Trần 100 bài, mới cập nhật nhất lên đầu, không phân trang. | Mỗi người tối đa một bài/đề; 100 vượt xa thực tế. |
| D7 | Trạng thái rỗng: "Bạn chưa viết bài giải nào" + cách viết (dùng lại câu hướng dẫn của tab Bình luận). | Cold start là ca đông nhất với tài khoản mới. |

## Ngoài phạm vi
Xoá bài từ danh sách, sắp xếp/lọc, đếm bình luận mới trên từng thẻ (đã có ở tab Bình luận).

## File
- `SOURCE/supabase/schema.sql` §28 + §17 vân tay; `supabase/migrations/<ts>_community_my_solutions_<fp>.sql`; `lib/schema/schemaFingerprint.ts`.
- `supabase/verify-schema.ts` (probe), `tests/e2e/service/community-solutions-my-solutions.localdb.test.ts`.
- `features/solutions/queries.ts` (`getMySolutions`), `components/ProfileSolutionsTab.tsx`, `components/ProfileTabs.tsx`, `lib/profileTab.ts`.
- `app/(analytics)/profile/page.tsx`, `lib/copy.ts`; test: `profileTab`, `ProfileTabs`, `ProfileSolutionsTab`, trang hồ sơ, truy vấn.

## Task (mỗi task một bước kiểm)
1. DB: §28 + vân tay + migration + áp lên DEV + probe + test localdb. Kiểm: `npm run verify:schema`, `npm run test:localdb`.
2. Truy vấn + component + chip + trang + chuỗi + test đơn vị. Kiểm: tsc, eslint, vitest.
3. Đo giao diện 3 viewport (360/768/1280), vùng chạm ≥44px. Cần phiên đăng nhập CLI — người dùng làm.
4. PROD: áp migration, đọc lại `schema_version` — CHỈ khi người dùng nói có (CLAUDE.md §5).
