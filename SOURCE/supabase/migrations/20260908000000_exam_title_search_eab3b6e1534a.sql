-- MIGRATION — tìm đề theo tên trong Postgres (ADR-0020). 2026-09-08.
--
-- Vì sao (đầy đủ ở docs/adr/ADR-0020-exam-title-search-in-postgres.md và
-- schema.sql § "Tìm đề theo tên"): ô tìm trên header cần khớp KHÔNG DẤU, không
-- phân biệt hoa thường, chịu lỗi gõ, và phải chịu được khi kho đề lớn dần.
-- Chọn `pg_trgm` + `unaccent` ngay trong Postgres (cả dev lẫn prod đều có sẵn
-- hai extension này, chưa bật) thay vì một dịch vụ tìm kiếm ngoài phải đồng bộ
-- dữ liệu và nằm ngoài RLS.
--
-- Thêm: 2 extension, hàm chuẩn hoá `search_normalize` (IMMUTABLE — từ điển gọi
-- đích danh), cột sinh `exams.title_search`, chỉ mục GIN trigram, RPC
-- `search_exams` (SECURITY INVOKER, chỉ authenticated/service_role). DỰNG LẠI
-- view `exams_with_difficulty`: `e.*` đóng băng lúc tạo nên view cũ KHÔNG có
-- `title_search`, và bộ lọc `?q=` của Kho đề đọc qua view (cùng lý do migration
-- 20260901020000_*). Không đổi dữ liệu người dùng; cột sinh tự tính cho mọi
-- dòng đã có.
--
-- ÁP TỪNG CÂU LỆNH MỘT (TD-005). Xong thì đọc lại bằng TRUY VẤN THẬT:
--   select extname from pg_extension where extname in ('unaccent','pg_trgm');  -- 2 dòng
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='exams' and column_name='title_search'; -- 1 dòng
--   select indexname from pg_indexes where indexname = 'exams_title_search_trgm_idx'; -- 1 dòng
--   select column_name from information_schema.columns
--     where table_name='exams_with_difficulty' and column_name='title_search'; -- 1 dòng (view đã dựng lại)
--   select public.search_normalize('Đề KIỂM TRA Hóa Học lớp 10 — Ứng dụng');
--     -- 'de kiem tra hoa hoc lop 10 ung dung'
--   select id, title from public.search_exams('hoa hoc', 5);                   -- có dòng
--   select fingerprint from public.schema_version;                            -- phải trả eab3b6e1534a
-- Prod: SO vân tay trước khi áp (Pha 3.5) — `4ecb67741520` là bản ngay trước.

create extension if not exists unaccent with schema extensions;

create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_normalize(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, translate(input, 'đĐ', 'dD'))),
        '[^a-z0-9]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

alter table public.exams add column if not exists title_search text
  generated always as (public.search_normalize(title)) stored;

create index if not exists exams_title_search_trgm_idx
  on public.exams using gin (title_search extensions.gin_trgm_ops);

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

create or replace function public.search_exams(q text, max_results int default 6)
returns table (id text, title text, subject text, grade int)
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    select public.search_normalize(coalesce(q, '')) as t
  )
  select e.id, e.title, e.subject, e.grade
  from public.exams e, term
  where e.status = 'published'
    and length(term.t) >= 2
    and (
      e.title_search like '%' || term.t || '%'
      or term.t operator(extensions.<%) e.title_search
    )
  order by
    (e.title_search like term.t || '%') desc,
    (e.title_search like '% ' || term.t || '%') desc,
    (e.title_search like '%' || term.t || '%') desc,
    extensions.word_similarity(term.t, e.title_search) desc,
    e.created_at desc,
    e.id
  limit least(greatest(coalesce(max_results, 6), 1), 20)
$$;

revoke all on function public.search_exams(text, int) from public, anon;

grant execute on function public.search_exams(text, int) to authenticated, service_role;

insert into public.schema_version (id, fingerprint)
values (1, 'eab3b6e1534a')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
