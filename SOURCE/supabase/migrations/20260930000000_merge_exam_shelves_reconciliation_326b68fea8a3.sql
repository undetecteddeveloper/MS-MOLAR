-- MIGRATION — Hoà nhánh `main` (Kho đề theo kệ, đã merge lên prod trước đó,
-- fingerprint 340bab74ca57) vào `feat/community-solutions` (2026-09-27).
--
-- KHÔNG có DDL nào trong file này. Hai nhánh phát triển song song từ cùng một
-- điểm (`af05f28`) trong hai worktree khác nhau — Kho đề theo kệ (branch
-- `worktree-parallel-work`) đã tự merge vào `main` và tự áp migration của nó
-- (`20260918000000_exam_hot_counts_and_attempt_source_340bab74ca57.sql`) lên
-- CẢ dev (`hynwleaxtbtjzkvpjsug`) LẪN prod (`pebjdlbgbmizgfpuptjl`) trước khi
-- nhánh này (Bài giải cộng đồng) đóng xong. Xác nhận bằng truy vấn thật ngay
-- trước khi viết file này: cả hai database đều đã có `exam_hot_counts()` và
-- cột `exam_attempts.source` — không có gì để CREATE/ALTER thêm.
--
-- Việc merge chỉ đưa văn bản §20 (Kho đề theo kệ) của `main` vào `schema.sql`
-- của nhánh này (đặt trước §20 Bài giải cộng đồng — số thứ tự trùng có chủ
-- đích, xem ghi chú tại §20 mới trong schema.sql: "Số thứ tự các mục trong
-- file này là lịch sử, không phải vị trí"), để schema.sql tiếp tục là nguồn
-- canonical DUY NHẤT mô tả đúng những gì hai database đang thực sự chạy. Vân
-- tay đổi vì NỘI DUNG file đổi (thêm văn bản), dù không có câu lệnh mới nào
-- cần áp — nên migration này chỉ có đúng một câu: cập nhật vân tay.
--
-- Đọc lại bằng TRUY VẤN THẬT sau khi áp (cả dev và prod):
--   select fingerprint from public.schema_version; -- phải trả 326b68fea8a3
insert into public.schema_version (id, fingerprint)
values (1, '326b68fea8a3')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
