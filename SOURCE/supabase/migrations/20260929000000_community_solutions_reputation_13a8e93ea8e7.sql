-- ----------------------------------------------------------------------------
-- 25. COMMUNITY SOLUTIONS — Phase 5: điểm uy tín của CHÍNH người gọi (backend
--     Design Doc v1.9 § Data Contracts "community_reputation_summary()"; work
--     plan task 41 — docs/plans/tasks/20260917-feature-community-solutions-
--     backend-task-41.md).
--
--     Không tham số: chỉ auth.uid(), nên không lượt gọi nào tra được uy tín
--     người khác (AC-089). Không cổng "đề đã published" (ADR-0021 Decision 2,
--     amendment 2026-09-17): bài giải được tính theo trạng thái HIỆN THỜI của
--     chính nó, trạng thái mà S8 giữ nguyên khi đề không hiện.
--
--     Không có cột/bảng nào lưu tổng: mỗi lượt gọi đếm lại từ các dòng sống,
--     nên gỡ về nháp / admin ẩn / xoá hẳn làm điểm rơi ngay ở lượt đọc sau và
--     đăng lại / khôi phục trả điểm về y nguyên (AC-088) — không có gì để trừ.
-- ----------------------------------------------------------------------------
drop function if exists public.community_reputation_summary();
create function public.community_reputation_summary()
returns table (
  total_score int,
  published_count int,
  helpful_count int,
  pinned_count int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mine as (
    -- Chỉ bài ĐANG đã đăng: Hữu ích và ghim của bài nháp/bị ẩn không tính
    -- (AC-088, AC-079). Aggregate không group by luôn ra đúng một hàng, và
    -- coalesce giữ sum() trên 0 dòng là 0 chứ không null (AC-090).
    select
      count(*)::int as n_published,
      coalesce(sum(h.n_helpful), 0)::int as n_helpful,
      (count(*) filter (where cs.is_pinned))::int as n_pinned
    from public.community_solutions cs
    cross join lateral (
      select count(*) as n_helpful
      from public.community_solution_helpfuls hf
      where hf.solution_id = cs.id
    ) h
    where cs.author_id = auth.uid() and cs.status = 'published'
  )
  select
    -- AC-086: 10 × bài đã đăng + 2 × Hữu ích trên bài đã đăng + 20 × bài đã
    -- đăng đang ghim — tính lại mỗi lượt gọi, không lưu ở đâu.
    10 * n_published + 2 * n_helpful + 20 * n_pinned,
    n_published,
    n_helpful,
    n_pinned
  from mine;
$$;
revoke all on function public.community_reputation_summary() from public, anon;
grant execute on function public.community_reputation_summary() to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, '13a8e93ea8e7')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
