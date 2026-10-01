-- Trả lời gắn với bình luận (một cấp) — docs/design/community-solutions-comment-replies.md.
-- Phần thay đổi của schema.sql §27, chép nguyên văn.

alter table public.community_solution_comments
  add column if not exists parent_id uuid references public.community_solution_comments(id) on delete cascade;
alter table public.community_solution_comments
  add column if not exists reply_to_id uuid references public.community_solution_comments(id) on delete set null;
alter table public.community_solution_comments drop constraint if exists community_solution_comments_status_check;
alter table public.community_solution_comments add constraint community_solution_comments_status_check
  check (status in ('visible', 'hidden', 'deleted'));
alter table public.community_solution_comments drop constraint if exists community_solution_comments_body_check;
alter table public.community_solution_comments add constraint community_solution_comments_body_check
  check (status = 'deleted' or (length(btrim(body)) > 0 and length(body) <= 2000));
alter table public.community_solution_comments drop constraint if exists community_solution_comments_parent_check;
alter table public.community_solution_comments add constraint community_solution_comments_parent_check
  check (parent_id is null or parent_id <> id);
create index if not exists community_solution_comments_parent_idx
  on public.community_solution_comments (parent_id) where parent_id is not null;

-- post_community_comment — thêm p_reply_to_id. Đích trả lời phải cùng bài, cùng
-- câu, đang 'visible'; trả lời một câu trả lời thì vẫn gắn vào gốc của nó.
drop function if exists public.post_community_comment(uuid, text, text, boolean);
drop function if exists public.post_community_comment(uuid, text, text, boolean, uuid);
create function public.post_community_comment(
  p_solution_id uuid,
  p_question_id text,
  p_body text,
  p_is_anonymous boolean,
  p_reply_to_id uuid default null
)
returns table (
  comment_id uuid,
  comment_created_at timestamptz,
  comment_parent_id uuid,
  comment_reply_to_id uuid
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_comment_id uuid;
  v_created_at timestamptz;
  v_parent uuid;
  v_reply_to uuid;
begin
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

  if p_reply_to_id is not null then
    select coalesce(t.parent_id, t.id), t.id into v_parent, v_reply_to
    from public.community_solution_comments t
    where t.id = p_reply_to_id and t.solution_id = p_solution_id
      and t.question_id = p_question_id and t.status = 'visible';
    if v_reply_to is null then
      raise exception 'post_community_comment: not eligible' using errcode = '42501';
    end if;
  end if;

  insert into public.community_solution_comments as c
    (solution_id, question_id, author_id, is_anonymous, body, parent_id, reply_to_id)
  values (p_solution_id, p_question_id, auth.uid(), coalesce(p_is_anonymous, false), p_body, v_parent, v_reply_to)
  returning c.id, c.created_at into v_comment_id, v_created_at;

  return query select v_comment_id, v_created_at, v_parent, v_reply_to;
end;
$$;
revoke all on function public.post_community_comment(uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.post_community_comment(uuid, text, text, boolean, uuid) to authenticated;

-- delete_community_comment — gốc còn con (mọi trạng thái) thì thành dòng mờ
-- 'deleted' (thân rỗng, báo cáo xoá theo); không còn con thì xoá hẳn như cũ.
drop function if exists public.delete_community_comment(uuid);
create function public.delete_community_comment(p_comment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.community_solution_comments c
    join public.community_solutions cs on cs.id = c.solution_id
    join public.exams e on e.id = cs.exam_id
    where c.id = p_comment_id and c.author_id = auth.uid() and c.status = 'visible'
      and e.status = 'published' and not public.is_author_banned(e.author_id)
      and exists (
        select 1 from public.exam_attempts a
        where a.exam_id = e.id and a.user_id = auth.uid() and a.status = 'submitted'
      )
  ) then
    raise exception 'delete_community_comment: not eligible' using errcode = '42501';
  end if;

  if exists (select 1 from public.community_solution_comments ch where ch.parent_id = p_comment_id) then
    delete from public.community_content_reports r where r.comment_id = p_comment_id;
    update public.community_solution_comments set status = 'deleted', body = '' where id = p_comment_id;
  else
    delete from public.community_solution_comments where id = p_comment_id;
  end if;
end;
$$;
revoke all on function public.delete_community_comment(uuid) from public, anon;
grant execute on function public.delete_community_comment(uuid) to authenticated;

-- admin_moderate_community_comment — 'delete' trên gốc còn con cũng thành dòng
-- mờ; 'delete' trên dòng đã 'deleted' là chuyển trạng thái không hợp lệ.
drop function if exists public.admin_moderate_community_comment(uuid, text, text);
create function public.admin_moderate_community_comment(
  p_comment_id uuid,
  p_action text, -- 'hide' | 'restore' | 'delete'
  p_reason text
)
returns table (status text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_exam_id text;
  v_author_id uuid;
  v_current_status text;
begin
  if not public.is_admin_user() then
    raise exception 'admin_moderate_community_comment: not an admin' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'restore', 'delete') then
    raise exception 'admin_moderate_community_comment: invalid action' using errcode = '22023';
  end if;
  if p_action in ('hide', 'delete') and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'admin_moderate_community_comment: reason required' using errcode = '22023';
  end if;

  select cs.exam_id, c.author_id, c.status into v_exam_id, v_author_id, v_current_status
  from public.community_solution_comments c
  join public.community_solutions cs on cs.id = c.solution_id
  where c.id = p_comment_id;
  if v_current_status is null then
    raise exception 'admin_moderate_community_comment: not found' using errcode = 'P0002';
  end if;
  if (p_action = 'hide' and v_current_status <> 'visible')
     or (p_action = 'restore' and v_current_status <> 'hidden')
     or (p_action = 'delete' and v_current_status = 'deleted') then
    raise exception 'admin_moderate_community_comment: invalid transition' using errcode = '22023';
  end if;

  if p_action = 'hide' then
    update public.community_solution_comments set status = 'hidden' where id = p_comment_id;
  elsif p_action = 'restore' then
    update public.community_solution_comments set status = 'visible' where id = p_comment_id;
  elsif exists (select 1 from public.community_solution_comments ch where ch.parent_id = p_comment_id) then
    delete from public.community_content_reports r where r.comment_id = p_comment_id;
    update public.community_solution_comments set status = 'deleted', body = '' where id = p_comment_id;
  else
    delete from public.community_solution_comments where id = p_comment_id; -- cascades its reports
  end if;

  insert into public.community_moderation_log
    (target_type, target_id, exam_id, target_user_id, actor_id, action, reason)
  values ('comment', p_comment_id, v_exam_id, v_author_id, auth.uid(), p_action, nullif(btrim(p_reason), ''));

  return query select case p_action when 'hide' then 'hidden' when 'restore' then 'visible' else 'deleted' end;
end;
$$;
revoke all on function public.admin_moderate_community_comment(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_community_comment(uuid, text, text) to authenticated;

-- community_my_comment_feed — thêm hàng "trả lời bình luận của tôi" (cho người
-- không phải người viết bài) và 3 cột: thread_root_id, is_reply_to_me,
-- reply_to_body. Tên người bình luận áp luật S4 vì người trả lời có thể chính
-- là người viết của một bài ẩn danh.
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
  exam_visible boolean,
  thread_root_id uuid,
  is_reply_to_me boolean,
  reply_to_body text
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
    case when not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile) then up.display_name end,
    (p.community_comments_last_read_at is null or c.created_at > p.community_comments_last_read_at),
    (e.status = 'published' and not public.is_author_banned(e.author_id)),
    coalesce(c.parent_id, c.id),
    coalesce(rt.author_id = auth.uid() and rt.status <> 'deleted', false),
    case when rt.author_id = auth.uid() and rt.status <> 'deleted' then rt.body end
  from public.community_solution_comments c
  join public.community_solutions cs on cs.id = c.solution_id
  join public.exams e on e.id = cs.exam_id
  left join public.user_profiles up on up.id = c.author_id
  left join public.user_profiles p on p.id = auth.uid()
  left join public.community_solution_comments rt on rt.id = c.reply_to_id
  cross join page
  where c.status = 'visible' and c.author_id <> auth.uid() and cs.status = 'published'
    and (cs.author_id = auth.uid() or (rt.author_id = auth.uid() and rt.status <> 'deleted'))
    and c.question_id = any(e.question_ids)
    and exists (select 1 from public.community_solution_notes n where n.solution_id = c.solution_id and n.question_id = c.question_id and public.count_words(n.body) >= 15)
    and exists (select 1 from public.exam_attempts a where a.exam_id = cs.exam_id and a.user_id = auth.uid() and a.status = 'submitted')
  order by c.created_at desc
  limit (select size from page)
  offset (select (num - 1) * size from page);
$$;
revoke all on function public.community_my_comment_feed(int, int) from public, anon;
grant execute on function public.community_my_comment_feed(int, int) to authenticated;

-- community_solution_detail — thêm 3 khoá mỗi bình luận (parent_id, reply_to_id,
-- placeholder) và dòng mờ che sạch danh tính/nội dung (amendment §2).
drop function if exists public.community_solution_detail(uuid);
create function public.community_solution_detail(p_solution_id uuid)
returns table (
  id uuid,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  is_pinned boolean,
  updated_at timestamptz,
  score numeric,
  score_grading boolean,
  per_question jsonb,
  is_mine boolean,
  helpful_count bigint,
  i_marked_helpful boolean,
  i_reported boolean,
  questions jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    cs.id,
    -- Solution identity condition (binding, v1.6): cs.show_profile alone, no
    -- exception for the writer (AC-062, AC-039, M5) — same projection
    -- community_solutions_list uses.
    case when cs.show_profile then cs.author_id end,
    case when cs.show_profile then up.display_name end,
    case when cs.show_profile then up.avatar_url end,
    cs.is_pinned,
    cs.updated_at,
    case when cs.show_score then er.total_score end,
    -- Score-grading condition (binding, v1.8) — the SAME expression
    -- community_solutions_list uses, so list and detail never disagree.
    case when cs.show_score then exists (
      select 1 from jsonb_array_elements(coalesce(er.per_question, '[]'::jsonb)) pq
      where pq ? 'essayState' and pq->>'essayState' <> 'graded'
    ) end,
    case when cs.show_score then er.per_question end,
    cs.author_id = auth.uid(),
    (select count(*) from public.community_solution_helpfuls hh where hh.solution_id = cs.id),
    exists (select 1 from public.community_solution_helpfuls hm where hm.solution_id = cs.id and hm.user_id = auth.uid()),
    exists (select 1 from public.community_content_reports sr where sr.solution_id = cs.id and sr.reporter_id = auth.uid()),
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'question_id', ak.id,
          'stem', ak.content,
          'correct_answer', ak.correct_answer,
          -- AC-022: bảng ghi chú cần đủ dữ liệu để hiện "Xem N phương án" (trắc
          -- nghiệm) / "Đáp án mẫu" (tự luận) ở màn đọc — 4 cột này lấy nguyên từ
          -- `ak` (exam_answer_key đã join sẵn ở FROM bên dưới), không join thêm
          -- bảng nào, không đổi cổng R1/quyền đọc (cùng lớp thiếu sót AC-022 mà
          -- task 03 đã vá ở community_solution_for_writer, commit 4b0ea52).
          'question_type', ak.question_type,
          'choices', ak.choices,
          'sub_answers', ak.sub_answers,
          'essay_answer', ak.essay_answer,
          'has_changed', (n.solution_id is not null and n.question_content_hash is distinct from public.question_content_fingerprint(ak.id)),
          'note', n.body,
          -- Comment count presence condition (binding, v1.7): null (never 0)
          -- when the question carries no comment surface.
          'comment_count', case when cs.status = 'published' and exists (
              select 1 from public.community_solution_notes n2
              where n2.solution_id = cs.id and n2.question_id = ak.id and public.count_words(n2.body) >= 15
            ) then (
              -- Comment count condition (binding, v1.7): published + visible only.
              select count(*)::int from public.community_solution_comments cc
              where cc.solution_id = cs.id and cc.question_id = ak.id and cc.status = 'visible'
            ) end,
          'comments', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                -- Comment identity condition (binding, v1.5): not c.is_anonymous
                -- and (c.author_id <> cs.author_id or cs.show_profile) — no
                -- exception for the caller (AC-062, AC-105).
                'author_id', case when (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then c.author_id end,
                'author_display_name', case when (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then cup.display_name end,
                'author_avatar_path', case when (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then cup.avatar_url end,
                'is_solution_author', (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and c.author_id = cs.author_id),
                'is_mine', (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and c.author_id = auth.uid()),
                'body', case when (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) then null else c.body end,
                -- Hidden-comment columns (binding, v1.6).
                'is_hidden_by_admin', (c.status = 'hidden' and c.author_id = auth.uid()),
                'hidden_reason', case when c.status = 'hidden' and c.author_id = auth.uid() then (
                    select l.reason from public.community_moderation_log l
                    where l.target_type = 'comment' and l.target_id = c.id and l.action = 'hide'
                    order by l.created_at desc limit 1
                  ) end,
                'i_reported', (not (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) and exists (
                  select 1 from public.community_content_reports cr
                  where cr.comment_id = c.id and cr.reporter_id = auth.uid()
                )),
                -- Trả lời một cấp (amendment §2): gốc của mạch + câu được trả lời +
                -- dòng mờ của gốc đã xoá / bị ẩn mà còn trả lời.
                'parent_id', c.parent_id,
                'reply_to_id', c.reply_to_id,
                'placeholder', case when c.status = 'deleted' then 'deleted' when (c.status = 'deleted' or (c.status = 'hidden' and c.author_id <> auth.uid())) then 'hidden' end,
                'created_at', c.created_at
              ) order by c.created_at
            ), '[]'::jsonb)
            from public.community_solution_comments c
            left join public.user_profiles cup on cup.id = c.author_id
            -- Comment row condition (binding, v1.7), applied together with the
            -- comment note condition (binding, v1.6) — S7/AC-071/AC-048.
            where c.solution_id = cs.id and c.question_id = ak.id
              and cs.status = 'published'
              and (
                c.status = 'visible'
                or (c.status = 'hidden' and c.author_id = auth.uid())
                or (c.status in ('hidden', 'deleted') and c.parent_id is null and exists (
                  select 1 from public.community_solution_comments r
                  where r.parent_id = c.id and r.status = 'visible'
                ))
              )
              and exists (
                select 1 from public.community_solution_notes n3
                where n3.solution_id = cs.id and n3.question_id = ak.id and public.count_words(n3.body) >= 15
              )
          )
        ) order by array_position(e.question_ids, ak.id)
      ), '[]'::jsonb)
      from public.exam_answer_key(e.id) ak
      left join public.community_solution_notes n
        on n.solution_id = cs.id and n.question_id = ak.id
    )
  from public.community_solutions cs
  join public.exams e on e.id = cs.exam_id
  left join public.user_profiles up on up.id = cs.author_id
  left join public.exam_attempts ea on ea.id = cs.linked_attempt_id
  left join public.exam_results er on er.attempt_id = ea.id
  where cs.id = p_solution_id
    and e.status = 'published'
    and not public.is_author_banned(e.author_id)
    and exists (
      select 1 from public.exam_attempts a
      where a.exam_id = cs.exam_id and a.user_id = auth.uid() and a.status = 'submitted'
    )
    -- Own-preview carve-out (AC-063): the writer may read their own
    -- draft/hidden solution; every other caller only a published one.
    and (cs.status = 'published' or cs.author_id = auth.uid());
$$;
revoke all on function public.community_solution_detail(uuid) from public, anon;
grant execute on function public.community_solution_detail(uuid) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, '90dadbd4e453')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
