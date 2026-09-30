-- Kệ "Lời giải cộng đồng mới nhất" cho trang chủ (F-041, 2026-09-30). RPC mới,
-- KHÔNG sửa community_solutions_list — xem schema.sql §26 cho lý do đầy đủ.
drop function if exists public.community_solutions_latest_for_home(int);
create function public.community_solutions_latest_for_home(p_limit int)
returns table (
  id uuid,
  exam_id text,
  exam_subject text,
  exam_grade int,
  updated_at timestamptz,
  author_display_name text,
  author_avatar_path text,
  helpful_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cs.id,
    cs.exam_id,
    e.subject,
    e.grade,
    cs.updated_at,
    case when cs.show_profile then up.display_name end,
    case when cs.show_profile then up.avatar_url end,
    coalesce(h.helpful_count, 0)
  from public.community_solutions cs
  join public.exams e on e.id = cs.exam_id
  left join public.user_profiles up on up.id = cs.author_id
  left join (
    select solution_id, count(*) as helpful_count
    from public.community_solution_helpfuls
    group by solution_id
  ) h on h.solution_id = cs.id
  where cs.status = 'published'
    and e.status = 'published'
    and not public.is_author_banned(e.author_id)
    and exists (
      select 1 from public.exam_attempts a
      where a.exam_id = cs.exam_id and a.user_id = auth.uid() and a.status = 'submitted'
    )
  order by cs.updated_at desc, cs.id
  limit greatest(p_limit, 0);
$$;
revoke all on function public.community_solutions_latest_for_home(int) from public, anon;
grant execute on function public.community_solutions_latest_for_home(int) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, 'cc59e441b53f')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
