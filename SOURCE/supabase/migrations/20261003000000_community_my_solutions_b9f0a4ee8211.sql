-- "Bài giải của tôi" cho tab Hồ sơ (2026-10-03). RPC mới chỉ đọc, không đổi bảng
-- nào — xem schema.sql §28 cho lý do đầy đủ.
drop function if exists public.community_my_solutions();
create function public.community_my_solutions()
returns table (
  solution_id uuid,
  exam_id text,
  exam_title text,
  exam_subject text,
  exam_grade int,
  status text,
  attempt_id uuid,
  updated_at timestamptz,
  helpful_count int,
  exam_visible boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cs.id,
    cs.exam_id,
    e.title,
    e.subject,
    e.grade,
    cs.status,
    coalesce(cs.linked_attempt_id, (
      select a.id
        from public.exam_attempts a
       where a.exam_id = cs.exam_id and a.user_id = auth.uid() and a.status = 'submitted'
       order by a.submitted_at desc nulls last, a.started_at desc
       limit 1
    )),
    cs.updated_at,
    (select count(*)::int from public.community_solution_helpfuls hf where hf.solution_id = cs.id),
    (e.status = 'published' and not public.is_author_banned(e.author_id))
  from public.community_solutions cs
  join public.exams e on e.id = cs.exam_id
  where cs.author_id = auth.uid()
  order by cs.updated_at desc, cs.id
  limit 100;
$$;
revoke all on function public.community_my_solutions() from public, anon;
grant execute on function public.community_my_solutions() to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, 'b9f0a4ee8211')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
