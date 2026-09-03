-- MIGRATION — chỉ mục cho các cột tra cứu nóng (refactor hiệu năng A2). 2026-09-03.
--
-- Vì sao (đầy đủ ở schema.sql §19): Postgres không tự tạo chỉ mục cho khoá
-- ngoại; 5 cột lọc nóng nhất (lịch sử, dashboard, analytics, "đề của tôi",
-- cascade xoá câu hỏi) chưa có chỉ mục nào trên cả dev lẫn prod (đọc
-- `pg_indexes` ngày 2026-09-03).
--
-- ĐO TRƯỚC (prod, `explain (analyze, buffers)`): Seq Scan trên cả 4 truy vấn,
-- 1.3–6.5 ms — bảng còn rất nhỏ (91 lượt làm bài, 16 kết quả, 7 đề, 387 ô trả
-- lời). Planner sẽ vẫn chọn Seq Scan ở cỡ này; chỉ mục là để ngày bảng lớn lên
-- không có màn nào lặng lẽ thành quét toàn bảng.
--
-- Chỉ tạo chỉ mục — KHÔNG đổi dữ liệu, KHÔNG đổi ràng buộc, không có gì để
-- backfill. `if not exists` nên chạy lại vô hại.
--
-- ÁP TỪNG CÂU LỆNH MỘT (TD-005). Xong thì đọc lại bằng TRUY VẤN THẬT:
--   select indexname from pg_indexes where schemaname='public'
--    and indexname in ('exam_attempts_user_submitted_idx','exam_attempts_exam_idx',
--                      'exam_results_user_created_idx','exams_author_idx',
--                      'attempt_answers_question_idx');   -- phải trả đủ 5 dòng
--   select fingerprint from public.schema_version;         -- phải trả 4ecb67741520
-- Xác nhận planner DÙNG được chỉ mục (bảng nhỏ nên phải tắt seq scan mới thấy):
--   set enable_seqscan = off;
--   explain select id from public.exam_attempts
--     where user_id = '<một uuid có thật>' order by submitted_at desc;
--   -- phải thấy "Index Scan using exam_attempts_user_submitted_idx"

create index if not exists exam_attempts_user_submitted_idx
  on public.exam_attempts (user_id, submitted_at desc);

create index if not exists exam_attempts_exam_idx
  on public.exam_attempts (exam_id);

create index if not exists exam_results_user_created_idx
  on public.exam_results (user_id, created_at desc);

create index if not exists exams_author_idx
  on public.exams (author_id);

create index if not exists attempt_answers_question_idx
  on public.attempt_answers (question_id);

insert into public.schema_version (id, fingerprint)
values (1, '4ecb67741520')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
