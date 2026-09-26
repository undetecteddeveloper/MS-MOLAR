-- MIGRATION — Bài giải cộng đồng, Phase 2: RPC đọc list/detail có che danh
-- tính + ghim bài + bảng/RPC "Hữu ích" + khối bảng bình luận/báo cáo (backend
-- Design Doc v1.9 § Data Contracts, ownership row "task 13 (Phase 2)"; work
-- plan docs/plans/tasks/20260917-feature-community-solutions-backend-task-13.md).
--
-- Đối tượng migration này tạo, mỗi cái đúng MỘT nơi sở hữu (ADR-0021, U1 —
-- engineer quyết 2026-09-17, decomposer resolution R2):
--   - community_solution_helpfuls — bảng "Hữu ích", RLS bật, không policy,
--     không grant; đường ghi duy nhất là hai RPC bên dưới.
--   - community_solution_comments, community_content_reports — CHỈ khối bảng
--     (create table, CHECK, index, RLS, revoke); community_solutions_list và
--     community_solution_detail là hàm `language sql`, thân hàm được Postgres
--     phân giải ở thời điểm CREATE nên hai bảng này phải tồn tại trước. RPC
--     ghi của hai bảng này (post_/delete_community_comment, report_community_
--     solution/report_community_comment) sang task 25 và task 32 — không phải
--     migration này.
--   - community_solutions_list(p_exam_id), community_solution_detail(p_solution_id)
--     — hai RPC đọc SECURITY DEFINER, danh tính/điểm che bằng `case when
--     <show-flag> then <cột> end`, không có ngoại lệ cho người viết (AC-062).
--   - set_community_solution_pin(p_exam_id, p_action, p_solution_id) — hoán
--     đổi ghim nguyên tử (AC-078).
--   - add_community_solution_helpful(uuid), remove_community_solution_helpful(uuid)
--     — hai trong sáu RPC ghi người dùng của U1 (bốn RPC còn lại: task 25,
--     task 32).
--
-- Áp bằng Supabase CLI (`db query --file`, đa câu lệnh OK) hoặc TỪNG CÂU MỘT
-- nếu qua công cụ khác (TD-005). CHỈ áp lên DEV (`hynwleaxtbtjzkvpjsug`) ở
-- bước này — PROD là việc của task 52, làm riêng sau khi 6 migration của
-- toàn bộ tính năng đã xong.
--
-- Sau khi áp, đọc lại bằng TRUY VẤN THẬT:
--   select fingerprint from public.schema_version; -- phải trả 6dc51eaf6a66

create table if not exists public.community_solution_helpfuls (
  solution_id uuid not null references public.community_solutions(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (solution_id, user_id)
);
alter table public.community_solution_helpfuls enable row level security;
revoke all on public.community_solution_helpfuls from anon, authenticated;
create table if not exists public.community_solution_comments (
  id           uuid primary key default gen_random_uuid(),
  solution_id  uuid not null references public.community_solutions(id) on delete cascade,
  question_id  text not null references public.questions(id) on delete cascade,
  author_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_anonymous boolean not null default false,
  body         text not null,
  status       text not null default 'visible',
  created_at   timestamptz not null default now()
);
alter table public.community_solution_comments drop constraint if exists community_solution_comments_status_check;
alter table public.community_solution_comments add constraint community_solution_comments_status_check
  check (status in ('visible', 'hidden'));
alter table public.community_solution_comments drop constraint if exists community_solution_comments_body_check;
alter table public.community_solution_comments add constraint community_solution_comments_body_check
  check (length(btrim(body)) > 0 and length(body) <= 2000);
create index if not exists community_solution_comments_solution_idx
  on public.community_solution_comments (solution_id, question_id, created_at);
alter table public.community_solution_comments enable row level security;
revoke all on public.community_solution_comments from anon, authenticated;
create table if not exists public.community_content_reports (
  id          uuid primary key default gen_random_uuid(),
  solution_id uuid references public.community_solutions(id) on delete cascade,
  comment_id  uuid references public.community_solution_comments(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table public.community_content_reports drop constraint if exists community_content_reports_reason_check;
alter table public.community_content_reports add constraint community_content_reports_reason_check
  check (length(btrim(reason)) > 0 and length(reason) <= 1000);
alter table public.community_content_reports drop constraint if exists community_content_reports_target_check;
alter table public.community_content_reports add constraint community_content_reports_target_check
  check ((solution_id is not null and comment_id is null) or (solution_id is null and comment_id is not null));
create unique index if not exists community_content_reports_solution_reporter_idx
  on public.community_content_reports (solution_id, reporter_id) where solution_id is not null;
create unique index if not exists community_content_reports_comment_reporter_idx
  on public.community_content_reports (comment_id, reporter_id) where comment_id is not null;
alter table public.community_content_reports enable row level security;
revoke all on public.community_content_reports from anon, authenticated;

drop function if exists public.community_solutions_list(text);
create function public.community_solutions_list(p_exam_id text)
returns table (
  id uuid,
  status text,
  is_pinned boolean,
  updated_at timestamptz,
  is_mine boolean,
  author_id uuid,
  author_display_name text,
  author_avatar_path text,
  score numeric,
  score_grading boolean,
  helpful_count bigint,
  i_marked_helpful boolean,
  comment_count bigint,
  changed_question_count int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eligible as (
    select 1 from public.exams e
    where e.id = p_exam_id and e.status = 'published' and not public.is_author_banned(e.author_id)
      and exists (
        select 1 from public.exam_attempts a
        where a.exam_id = p_exam_id and a.user_id = auth.uid() and a.status = 'submitted'
      )
  )
  select
    cs.id,
    cs.status,
    cs.is_pinned,
    cs.updated_at,
    cs.author_id = auth.uid() as is_mine,
    -- AC-062 / AC-039: identity follows show_profile for every caller, the
    -- writer included; the writer learns ownership only from is_mine.
    case when cs.show_profile then cs.author_id end,
    case when cs.show_profile then up.display_name end,
    case when cs.show_profile then up.avatar_url end,
    case when cs.show_score then er.total_score end,
    -- AC-041 (v1.8): the score badge reads "x.y trên 10 · đang chấm" while the
    -- linked attempt still carries an essay question that has not reached
    -- 'graded'. Same source as the detail contract's per-question essayScore /
    -- notAutoScored: the linked attempt's exam_results.per_question elements.
    case when cs.show_score then exists (
      select 1 from jsonb_array_elements(coalesce(er.per_question, '[]'::jsonb)) pq
      where pq ? 'essayState' and pq->>'essayState' <> 'graded'
    ) end,
    coalesce(h.helpful_count, 0),
    exists (select 1 from public.community_solution_helpfuls hh where hh.solution_id = cs.id and hh.user_id = auth.uid()),
    coalesce(c.comment_count, 0),
    (
      select count(*)::int from unnest((select question_ids from public.exams where id = p_exam_id)) as qid
      join public.community_solution_notes n on n.solution_id = cs.id and n.question_id = qid
      where n.question_content_hash is distinct from public.question_content_fingerprint(qid)
    )
  from public.community_solutions cs
  -- v1.8: left join, not join — § Integration Point Map's user_profiles boundary
  -- contract says a join miss yields null fields, never a dropped row.
  left join public.user_profiles up on up.id = cs.author_id
  left join public.exam_attempts ea on ea.id = cs.linked_attempt_id
  left join public.exam_results er on er.attempt_id = ea.id
  left join (
    select solution_id, count(*) as helpful_count from public.community_solution_helpfuls group by solution_id
  ) h on h.solution_id = cs.id
  left join (
    -- AC-047 (v1.7): a comment under a question no longer in the exam's
    -- question_ids counts nowhere. AC-048 (v1.6): a visible comment counts
    -- only under a note of at least 15 words for its question.
    select cc.solution_id, count(*) as comment_count
    from public.community_solution_comments cc
    where cc.status = 'visible'
      and exists (
        select 1 from public.exams e2
        where e2.id = p_exam_id and cc.question_id = any(e2.question_ids)
      )
      and exists (
        select 1 from public.community_solution_notes n
        where n.solution_id = cc.solution_id and n.question_id = cc.question_id
          and public.count_words(n.body) >= 15
      )
    group by cc.solution_id
  ) c on c.solution_id = cs.id
  where cs.exam_id = p_exam_id
    and cs.status = 'published'
    and exists (select 1 from eligible)
  order by cs.is_pinned desc, coalesce(h.helpful_count, 0) desc, cs.updated_at desc, cs.id;
$$;
revoke all on function public.community_solutions_list(text) from public, anon;
grant execute on function public.community_solutions_list(text) to authenticated;

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
                'author_id', case when (not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then c.author_id end,
                'author_display_name', case when (not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then cup.display_name end,
                'author_avatar_path', case when (not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)) then cup.avatar_url end,
                'is_solution_author', c.author_id = cs.author_id,
                'is_mine', c.author_id = auth.uid(),
                'body', c.body,
                -- Hidden-comment columns (binding, v1.6).
                'is_hidden_by_admin', c.status = 'hidden',
                'hidden_reason', case when c.status = 'hidden' then (
                    select l.reason from public.community_moderation_log l
                    where l.target_type = 'comment' and l.target_id = c.id and l.action = 'hide'
                    order by l.created_at desc limit 1
                  ) end,
                'i_reported', exists (
                  select 1 from public.community_content_reports cr
                  where cr.comment_id = c.id and cr.reporter_id = auth.uid()
                ),
                'created_at', c.created_at
              ) order by c.created_at
            ), '[]'::jsonb)
            from public.community_solution_comments c
            left join public.user_profiles cup on cup.id = c.author_id
            -- Comment row condition (binding, v1.7), applied together with the
            -- comment note condition (binding, v1.6) — S7/AC-071/AC-048.
            where c.solution_id = cs.id and c.question_id = ak.id
              and cs.status = 'published'
              and (c.status = 'visible' or (c.status = 'hidden' and c.author_id = auth.uid()))
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

drop function if exists public.set_community_solution_pin(text, text, uuid);
create function public.set_community_solution_pin(
  p_exam_id text,
  p_action text, -- 'pin' | 'unpin'
  p_solution_id uuid default null -- required for 'pin', ignored for 'unpin'
)
returns table (pinned_solution_id uuid)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  -- AC-004 / M2: the exam must be published with its author not banned.
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and not public.is_author_banned(e.author_id)
  ) then
    raise exception 'set_community_solution_pin: exam not visible' using errcode = '42501';
  end if;
  if not exists (select 1 from public.exams e where e.id = p_exam_id and e.author_id = auth.uid()) then
    raise exception 'set_community_solution_pin: not the exam author' using errcode = '42501';
  end if;
  -- D36-equivalent for authors: pinning still requires the AUTHOR to have
  -- submitted their own exam, same R1 gate every other write in this file uses.
  if not exists (
    select 1 from public.exam_attempts a
    where a.exam_id = p_exam_id and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'set_community_solution_pin: author has not submitted own exam' using errcode = '42501';
  end if;

  if p_action = 'unpin' then
    update public.community_solutions set is_pinned = false where exam_id = p_exam_id and is_pinned;
    return query select null::uuid;
  elsif p_action = 'pin' then
    if not exists (
      select 1 from public.community_solutions
      where id = p_solution_id and exam_id = p_exam_id and status = 'published'
    ) then
      raise exception 'set_community_solution_pin: target not a published solution of this exam' using errcode = '22023';
    end if;
    -- Atomic swap: unset the old pin, set the new one, in one statement pair
    -- inside this function's own transaction (AC-078 — "tại mọi lúc tối đa một").
    update public.community_solutions set is_pinned = false where exam_id = p_exam_id and is_pinned;
    update public.community_solutions set is_pinned = true where id = p_solution_id;
    return query select p_solution_id;
  else
    raise exception 'set_community_solution_pin: invalid action' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.set_community_solution_pin(text, text, uuid) from public, anon;
grant execute on function public.set_community_solution_pin(text, text, uuid) to authenticated;

drop function if exists public.add_community_solution_helpful(uuid);
create function public.add_community_solution_helpful(p_solution_id uuid)
returns table (added boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row_count int;
begin
  -- D25 / AC-065 / AC-004: a published solution that is not the caller's own,
  -- on a published exam whose author is not banned, an exam the caller has
  -- submitted.
  if not exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    where cs.id = p_solution_id and cs.status = 'published' and cs.author_id <> auth.uid()
      and e.status = 'published' and not public.is_author_banned(e.author_id)
  ) or not exists (
    select 1 from public.community_solutions cs
    join public.exam_attempts a on a.exam_id = cs.exam_id
    where cs.id = p_solution_id and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'add_community_solution_helpful: not eligible' using errcode = '42501';
  end if;

  -- AC-064 / AC-066: a repeat is a no-op, not an error; the primary key
  -- (solution_id, user_id) keeps at most one row per pair.
  insert into public.community_solution_helpfuls (solution_id, user_id)
  values (p_solution_id, auth.uid())
  on conflict (solution_id, user_id) do nothing;
  get diagnostics v_row_count = row_count;

  return query select v_row_count = 1;
end;
$$;
revoke all on function public.add_community_solution_helpful(uuid) from public, anon;
grant execute on function public.add_community_solution_helpful(uuid) to authenticated;

drop function if exists public.remove_community_solution_helpful(uuid);
create function public.remove_community_solution_helpful(p_solution_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  -- AC-004 / AC-002 / M2: removing a mark is a write on this exam's solution
  -- data, so it needs the exam gate every other write has: a published exam
  -- whose author is not banned, an exam the caller has submitted.
  if not exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    join public.exam_attempts a on a.exam_id = e.id
    where cs.id = p_solution_id
      and e.status = 'published' and not public.is_author_banned(e.author_id)
      and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'remove_community_solution_helpful: not eligible' using errcode = '42501';
  end if;

  -- Only the caller's own row can match. Removing a row that does not exist is
  -- a no-op (AC-066: un-marking deletes the row).
  delete from public.community_solution_helpfuls h
  where h.solution_id = p_solution_id and h.user_id = auth.uid();
end;
$$;
revoke all on function public.remove_community_solution_helpful(uuid) from public, anon;
grant execute on function public.remove_community_solution_helpful(uuid) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, '6dc51eaf6a66')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
