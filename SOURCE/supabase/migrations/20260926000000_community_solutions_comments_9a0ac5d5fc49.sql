-- ----------------------------------------------------------------------------
-- 22. COMMUNITY SOLUTIONS — Phase 3: hai RPC ghi bình luận + RPC đọc feed
--     "Bình luận của tôi" + cột cursor chưa đọc (backend Design Doc v1.9
--     § Data Contracts, work plan task 25 — docs/plans/tasks/
--     20260917-feature-community-solutions-backend-task-25.md).
--
--     Bảng community_solution_comments đã tồn tại từ §21 (task 13, resolution
--     R2) — khối này KHÔNG tạo lại bảng đó và không thêm policy/grant nào lên
--     nó (U1); post_community_comment/delete_community_comment là hai RPC ghi
--     DUY NHẤT của bảng đó (đúng như §21 đã ghi khi tạo bảng).
-- ----------------------------------------------------------------------------

-- Cùng quy ước với add_community_solution_helpful (xem comment phía trên nó ở
-- §21): danh tính người gọi CHỈ lấy từ auth.uid(), mọi lượt từ chối raise đúng
-- MỘT message errcode 42501.
drop function if exists public.post_community_comment(uuid, text, text, boolean);
create function public.post_community_comment(
  p_solution_id uuid,
  p_question_id text,
  p_body text,
  p_is_anonymous boolean
)
returns table (comment_id uuid, comment_created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
begin
  -- AC-072 / S7 / AC-047: a published solution on a published exam whose
  -- author is not banned, an exam the caller has submitted, and a question
  -- that is still part of the exam. AC-048: the solution has a note of at
  -- least 15 words for that question; without one there is no comment button.
  if not exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    join public.exam_attempts a on a.exam_id = e.id
    where cs.id = p_solution_id and cs.status = 'published'
      and e.status = 'published' and not public.is_author_banned(e.author_id)
      and a.user_id = auth.uid() and a.status = 'submitted'
      and p_question_id = any(e.question_ids)
      and exists (
        select 1 from public.community_solution_notes n
        where n.solution_id = cs.id and n.question_id = p_question_id
          and public.count_words(n.body) >= 15
      )
  ) then
    raise exception 'post_community_comment: not eligible' using errcode = '42501';
  end if;

  -- status is not written: it keeps its 'visible' default, so no caller can
  -- create a hidden comment. community_solution_comments_body_check rejects an
  -- empty or over-long body (23514).
  insert into public.community_solution_comments as c
    (solution_id, question_id, author_id, is_anonymous, body)
  values (p_solution_id, p_question_id, auth.uid(), coalesce(p_is_anonymous, false), p_body)
  returning c.id, c.created_at into v_comment_id, v_created_at;

  return query select v_comment_id, v_created_at;
end;
$$;
revoke all on function public.post_community_comment(uuid, text, text, boolean) from public, anon;
grant execute on function public.post_community_comment(uuid, text, text, boolean) to authenticated;

drop function if exists public.delete_community_comment(uuid);
create function public.delete_community_comment(p_comment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row_count int;
begin
  -- AC-070 / S19: only the caller's own comment, and only while it is visible.
  -- AC-004 / AC-002 / M2: only on a published exam whose author is not banned,
  -- an exam the caller has submitted. The foreign-key cascade removes the
  -- comment's reports with it.
  delete from public.community_solution_comments c
  using public.community_solutions cs, public.exams e
  where c.id = p_comment_id and c.author_id = auth.uid() and c.status = 'visible'
    and cs.id = c.solution_id and e.id = cs.exam_id
    and e.status = 'published' and not public.is_author_banned(e.author_id)
    and exists (
      select 1 from public.exam_attempts a
      where a.exam_id = e.id and a.user_id = auth.uid() and a.status = 'submitted'
    );
  get diagnostics v_row_count = row_count;

  -- Nothing deleted is a refusal, raised rather than ignored: another user's
  -- comment, an admin-hidden comment, a missing comment and a comment on an
  -- exam the caller may not reach get the same error, so the refusal is
  -- observable without revealing which case applied.
  if v_row_count = 0 then
    raise exception 'delete_community_comment: not eligible' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.delete_community_comment(uuid) from public, anon;
grant execute on function public.delete_community_comment(uuid) to authenticated;

-- Cursor "đã đọc bình luận tới đâu" (Proof Obligation của task 25, Failure Mode
-- #7): nullable, KHÔNG default — `default now()` sẽ âm thầm đánh dấu MỌI bình
-- luận có sẵn là đã đọc cho MỌI người dùng. Ghi duy nhất qua markCommentsRead()
-- (task 26), một update thường dưới profiles_update_own không đổi (§7) —
-- không RPC nào cho cột này. Đặt TRƯỚC community_my_comment_feed bên dưới có
-- chủ đích: hàm đó `language sql` nên Postgres phân giải cột nó đọc NGAY LÚC
-- CREATE (cùng lý do §21 đặt bảng bình luận trước community_solutions_list),
-- nên cột phải tồn tại trước khi hàm được tạo.
alter table public.user_profiles add column if not exists community_comments_last_read_at timestamptz;

-- community_my_comment_feed — backend DD v1.9 § Data Contracts
-- "community_my_comment_feed(p_page, p_page_size)": tên/kiểu/biểu thức của
-- 10 cột và vị từ Row condition (binding) chép NGUYÊN VĂN từ đó; hình dạng
-- thân hàm (language sql, ceiling trang) là chi tiết triển khai của CHÍNH task
-- này — DD để ngỏ có chủ đích (cùng quy ước với community_solution_detail ở
-- §21). Ceiling trang chọn 20 (thoả "not below 20" của DD — không dùng
-- LIST_ROW_CEILING vì hằng đó phục vụ fetch-all trong biên, không phải trang).
drop function if exists public.community_my_comment_feed(int, int);
create function public.community_my_comment_feed(p_page int, p_page_size int)
returns table (
  comment_id uuid,
  solution_id uuid,
  exam_id text,
  exam_title text,
  question_number int,
  comment_body text,
  comment_created_at timestamptz,
  author_display_name text,
  is_unread boolean,
  exam_visible boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with page as (
    select least(greatest(coalesce(p_page_size, 20), 1), 20) as size,
           greatest(coalesce(p_page, 1), 1) as num
  )
  select
    c.id,
    c.solution_id,
    cs.exam_id,
    e.title,
    array_position(e.question_ids, c.question_id),
    c.body,
    c.created_at,
    case when not c.is_anonymous then up.display_name end,
    (p.community_comments_last_read_at is null or c.created_at > p.community_comments_last_read_at),
    (e.status = 'published' and not public.is_author_banned(e.author_id))
  from public.community_solution_comments c
  join public.community_solutions cs on cs.id = c.solution_id
  join public.exams e on e.id = cs.exam_id
  left join public.user_profiles up on up.id = c.author_id
  left join public.user_profiles p on p.id = auth.uid()
  cross join page
  -- Row condition (binding, backend DD v1.9 § Data Contracts
  -- "community_my_comment_feed"), chép nguyên văn.
  where c.status = 'visible' and c.author_id <> auth.uid() and cs.author_id = auth.uid() and cs.status = 'published' and c.question_id = any(e.question_ids) and exists (select 1 from public.community_solution_notes n where n.solution_id = c.solution_id and n.question_id = c.question_id and public.count_words(n.body) >= 15) and exists (select 1 from public.exam_attempts a where a.exam_id = cs.exam_id and a.user_id = auth.uid() and a.status = 'submitted')
  order by c.created_at desc
  limit (select size from page)
  offset (select (num - 1) * size from page);
$$;
revoke all on function public.community_my_comment_feed(int, int) from public, anon;
grant execute on function public.community_my_comment_feed(int, int) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, '9a0ac5d5fc49')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
