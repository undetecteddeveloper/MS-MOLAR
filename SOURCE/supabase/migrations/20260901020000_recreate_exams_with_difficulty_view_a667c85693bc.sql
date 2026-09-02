-- MIGRATION — DỰNG LẠI VIEW `exams_with_difficulty`. 2026-09-01.
--
-- LỖI ĐÃ XẢY RA THẬT trên dev, ngay sau khi 20260901000000_* được áp: mở trang
-- duyệt đề (/exams) là sập với PostgreSQL 42703 (undefined_column), và màn hình
-- lỗi toàn cục của Next.js in ra `{code: "42703", ...}`.
--
-- NGUYÊN NHÂN — `select e.*` trong một VIEW được BUNG RA VÀ ĐÓNG BĂNG lúc view
-- được tạo. Nó KHÔNG phải một tham chiếu sống tới `exams`. Migration trước thêm
-- `exams.passages` (§8d) nhưng không đụng tới view, nên:
--
--     exams                  … parts, passages          ← cột có thật
--     exams_with_difficulty  … parts, rating_count, avg_overall
--                                    ↑ passages KHÔNG có ở đây
--
-- App đọc danh sách đề QUA VIEW (ADR-0008 Decision 2 — cùng nguồn quan hệ với
-- rating), và `EXAM_COLUMNS` nay xin cả `passages`, nên PostgREST hỏi một cột
-- mà view không có. Đo trên dev (hynwleax…) trước khi viết file này: `exams` có
-- `passages`, view thì không; `questions.passage_id`/`points` đều đã có, tức
-- KHÔNG phải migration cũ áp thiếu — chỉ riêng view bị bỏ quên.
--
-- VÌ SAO PHẢI DROP, KHÔNG `create or replace` MỘT MÌNH: `create or replace view`
-- chỉ cho phép THÊM cột vào CUỐI. Cột mới của `e.*` chèn vào TRƯỚC
-- rating_count/avg_overall, nên Postgres hiểu là "đổi tên cột thứ 18" và từ
-- chối bằng 42P16 "cannot change name of view column". Drop rồi tạo lại là
-- đường duy nhất.
--
-- AN TOÀN — đã soi trên dev trước khi drop:
--   · pg_depend: 0 object phụ thuộc view này (không view/rule nào chồng lên);
--   · ACL: anon/authenticated có quyền qua `alter default privileges` sẵn có
--     của Supabase (§10b mô tả cùng cơ chế cho function), nên view tạo lại tự
--     có lại quyền đọc — KHÔNG có `grant` tường minh nào bị mất;
--   · view không chứa dữ liệu, drop không mất một dòng nào.
--
-- Cả ba câu lệnh dưới đây đã có mặt trong schema.sql (§9 và §12b) — cổng
-- `migrationsMatchSchema` đòi đúng thế.

drop view if exists public.exams_with_difficulty;

create or replace view public.exams_with_difficulty
with (security_invoker = true) as
select
  e.*,
  coalesce(agg.rating_count, 0) as rating_count,
  case when coalesce(agg.rating_count, 0) >= 3 then agg.avg_overall end as avg_overall
from public.exams e
left join public.exam_rating_aggregate() agg on agg.exam_id = e.id;

alter view public.exams_with_difficulty set (security_invoker = true);

-- §17 — ghi lại vân tay để `verify:schema` và instrumentation.ts thôi báo lệch.
insert into public.schema_version (id, fingerprint)
values (1, 'a667c85693bc')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
