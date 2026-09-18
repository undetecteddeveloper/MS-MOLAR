-- MIGRATION — nguồn gốc lượt làm bài + đếm nóng liên người dùng (Kho đề theo
-- kệ, 2026-09-18, ADR-0021). Xem schema.sql §20a/20b/20c cho lý do đầy đủ;
-- file này chỉ REPLAY nguyên văn phần thay đổi, không phải toàn bộ schema.
--
-- 20a. `exam_attempts.source` đã inline ở `create table if not exists` cho
--      provisioning mới; hai câu alter dưới đây là cặp idempotent cho hai
--      database ĐANG CHẠY sẵn, vì `create table if not exists` là no-op trên
--      cả hai. Postgres tự đặt tên CHECK inline đúng bằng
--      `exam_attempts_source_check` — tên cặp drop/add dùng — nên khai hai lần
--      vẫn ra MỘT ràng buộc; vế drop đứng trước vế add chỉ để idempotent khi
--      áp lại lần hai.
alter table public.exam_attempts add column if not exists source text not null default 'none';

alter table public.exam_attempts drop constraint if exists exam_attempts_source_check;

alter table public.exam_attempts add constraint exam_attempts_source_check
  check (source in ('practice', 'hot', 'explore', 'none'));

-- 20b. Chỉ mục cửa sổ hot cần: lọc theo trạng thái, sắp theo thời điểm nộp bài.
create index if not exists exam_attempts_status_submitted_idx
  on public.exam_attempts (status, submitted_at desc);

-- 20c. Đếm nóng liên người dùng — SECURITY DEFINER vì `attempts_select_own`
--      chỉ cho user đọc đúng lượt của chính mình. Vị từ bên trong LẶP LẠI
--      đúng những gì `exams_select_visible` áp (published + tác giả không bị
--      ban), vì một hàm definer không chạy dưới RLS.
create or replace function public.exam_hot_counts(
  p_since_recent timestamptz,
  p_since_wide   timestamptz,
  p_max_rows     int default 500
)
returns table (
  exam_id      text,
  recent_count bigint,
  wide_count   bigint,
  total_count  bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- date_trunc chặn CẢ HAI biên caller gửi lên về đúng giờ, phía server: thiếu
  -- dòng này thì một JWT có thể chia đôi trục thời gian tới khi số đếm nhích
  -- lên, định vị lượt nộp bài của người khác chính xác tới giây. Chặn theo giờ
  -- không tốn gì của một bậc thang 7/30 ngày.
  select a.exam_id,
         count(*) filter (where a.submitted_at >= date_trunc('hour', p_since_recent))::bigint,
         count(*) filter (where a.submitted_at >= date_trunc('hour', p_since_wide))::bigint,
         count(*)::bigint
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
   where a.status = 'submitted'
     and e.status = 'published'
     and not public.is_author_banned(e.author_id)
   group by a.exam_id
   order by 4 desc, 2 desc, 1
   limit least(greatest(coalesce(p_max_rows, 500), 1), 1000)
$$;

revoke all on function public.exam_hot_counts(timestamptz, timestamptz, int) from public, anon;

grant execute on function public.exam_hot_counts(timestamptz, timestamptz, int) to authenticated, service_role;

-- Áp bằng Supabase CLI (`db query --file`, đa câu lệnh OK trên dev):
--   npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_340bab74ca57.sql
-- Prod: TỪNG CÂU MỘT qua MCP/Composio (TD-005), engineer xác nhận trước khi
-- đụng exam_attempts.
--
-- Xong thì đọc lại bằng TRUY VẤN THẬT (không phải thông báo thành công của
-- công cụ):
--   select fingerprint from public.schema_version;                                           -- '340bab74ca57'
--   select proname, proacl from pg_proc where proname = 'exam_hot_counts';                    -- EXECUTE: authenticated, service_role; không anon/public
--   select conname from pg_constraint where conname = 'exam_attempts_source_check';           -- 1 dòng
--   select indexname from pg_indexes where indexname = 'exam_attempts_status_submitted_idx';  -- 1 dòng
--   select column_name, is_nullable, column_default from information_schema.columns
--    where table_name = 'exam_attempts' and column_name = 'source';                           -- NO, 'none'::text

insert into public.schema_version (id, fingerprint)
values (1, '340bab74ca57')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
