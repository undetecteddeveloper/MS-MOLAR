-- ----------------------------------------------------------------------------
-- 23. COMMUNITY SOLUTIONS — Phase 4: hai RPC báo cáo + bốn RPC admin (kiểm
--     duyệt, hàng đợi báo cáo, ghi chú cho admin) (backend Design Doc v1.9
--     § Data Contracts "Admin RPCs" + "SECURITY DEFINER user-write RPCs" khối
--     reports, work plan task 32 — docs/plans/tasks/20260917-feature-
--     community-solutions-backend-task-32.md).
--
--     Bảng community_content_reports đã tồn tại từ §21 (task 13, resolution
--     R2) — khối này KHÔNG tạo lại bảng đó và KHÔNG thêm policy/grant nào lên
--     nó (U1): hai RPC report_* dưới đây là đường ghi DUY NHẤT của bảng.
--
--     ADR-0021 Decision 3: bốn RPC admin_* là đường kiểm duyệt DB-native —
--     KHÔNG chạm SOURCE/lib/supabase/service-role.ts (TD-029, ADR-0019), không
--     đụng exam_reports/exam_moderation_log/moderateExam(). Mỗi hàm admin gọi
--     is_admin_user() làm câu lệnh ĐẦU TIÊN, trước mọi kiểm tra lý do/chuyển
--     trạng thái và trước mọi lượt đọc bảng — nên một người không phải admin
--     chỉ học được đúng một điều: "not an admin".
--
--     Thứ tự "chụp trước, xoá sau" của nhánh 'delete' (AC-084): hai hàm
--     admin_moderate_* đọc exam_id + author_id của đối tượng vào biến TRƯỚC câu
--     DELETE. DELETE cascade xoá luôn ghi chú/Hữu ích/bình luận/báo cáo phụ
--     thuộc; nếu đọc SAU thì dòng log sẽ mang exam_id/target_user_id null. Dòng
--     community_moderation_log được ghi trong CÙNG lời gọi hàm (một
--     transaction) — lỗi ở bất kỳ bước nào thì cả thay đổi lẫn dòng log cùng
--     rollback; target_id không có FK nên dòng log sống sót sau khi đối tượng
--     bị xoá hẳn.
-- ----------------------------------------------------------------------------

-- Same conventions as add_community_solution_helpful (see the comment above it).
-- One function per target type: the ownership rule and the join path differ
-- between a solution and a comment. Each function writes exactly one target
-- column and passes null for the other, so community_content_reports_target_check
-- always holds; the CHECK remains the structural backstop.
drop function if exists public.report_community_solution(uuid, text);
create function public.report_community_solution(p_solution_id uuid, p_reason text)
returns table (already_reported boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row_count int;
begin
  -- AC-074 / AC-004: a published solution that is not the caller's own, on a
  -- published exam whose author is not banned, an exam the caller has submitted.
  if not exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    join public.exam_attempts a on a.exam_id = e.id
    where cs.id = p_solution_id and cs.status = 'published' and cs.author_id <> auth.uid()
      and e.status = 'published' and not public.is_author_banned(e.author_id)
      and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'report_community_solution: not eligible' using errcode = '42501';
  end if;

  -- AC-073 / AC-074: a repeat report is a no-op, not an error; the partial
  -- unique index community_content_reports_solution_reporter_idx is the
  -- arbiter. community_content_reports_reason_check rejects an empty or
  -- over-long reason (23514). A report changes nothing else (AC-075).
  insert into public.community_content_reports (solution_id, comment_id, reporter_id, reason)
  values (p_solution_id, null, auth.uid(), p_reason)
  on conflict (solution_id, reporter_id) where solution_id is not null do nothing;
  get diagnostics v_row_count = row_count;

  return query select v_row_count = 0;
end;
$$;
revoke all on function public.report_community_solution(uuid, text) from public, anon;
grant execute on function public.report_community_solution(uuid, text) to authenticated;

drop function if exists public.report_community_comment(uuid, text);
create function public.report_community_comment(p_comment_id uuid, p_reason text)
returns table (already_reported boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row_count int;
begin
  -- AC-076 / AC-074 / AC-004: a comment that is not the caller's own, under a
  -- published solution, on a published exam whose author is not banned, an
  -- exam the caller has submitted.
  if not exists (
    select 1 from public.community_solution_comments c
    join public.community_solutions cs on cs.id = c.solution_id
    join public.exams e on e.id = cs.exam_id
    join public.exam_attempts a on a.exam_id = e.id
    where c.id = p_comment_id and cs.status = 'published' and c.author_id <> auth.uid()
      and e.status = 'published' and not public.is_author_banned(e.author_id)
      and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'report_community_comment: not eligible' using errcode = '42501';
  end if;

  -- AC-076: a repeat report is a no-op, not an error; the partial unique index
  -- community_content_reports_comment_reporter_idx is the arbiter.
  insert into public.community_content_reports (solution_id, comment_id, reporter_id, reason)
  values (null, p_comment_id, auth.uid(), p_reason)
  on conflict (comment_id, reporter_id) where comment_id is not null do nothing;
  get diagnostics v_row_count = row_count;

  return query select v_row_count = 0;
end;
$$;
revoke all on function public.report_community_comment(uuid, text) from public, anon;
grant execute on function public.report_community_comment(uuid, text) to authenticated;

drop function if exists public.admin_moderate_community_solution(uuid, text, text);
create function public.admin_moderate_community_solution(
  p_solution_id uuid,
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
    raise exception 'admin_moderate_community_solution: not an admin' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'restore', 'delete') then
    raise exception 'admin_moderate_community_solution: invalid action' using errcode = '22023';
  end if;
  -- AC-082 / AC-106: hiding and hard-deleting need a reason the writer reads;
  -- restoring does not.
  if p_action in ('hide', 'delete') and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'admin_moderate_community_solution: reason required' using errcode = '22023';
  end if;

  -- cs-qualified: status is also this function's output column.
  select cs.exam_id, cs.author_id, cs.status into v_exam_id, v_author_id, v_current_status
  from public.community_solutions cs where cs.id = p_solution_id;
  if v_exam_id is null then
    raise exception 'admin_moderate_community_solution: not found' using errcode = 'P0002';
  end if;
  -- AC-017: an admin never moderates a draft. 'hide' needs a published
  -- solution, 'restore' a hidden one (it returns to published, AC-082), 'delete'
  -- a published or hidden one (AC-106). 'restore' re-checks no word count: the
  -- notes were locked while hidden (AC-083), and 'hide' accepts only a published
  -- solution, which already met the 15-word rule (S1).
  if (p_action = 'hide' and v_current_status <> 'published')
     or (p_action = 'restore' and v_current_status <> 'hidden')
     or (p_action = 'delete' and v_current_status not in ('published', 'hidden')) then
    raise exception 'admin_moderate_community_solution: invalid transition' using errcode = '22023';
  end if;

  if p_action = 'hide' then
    update public.community_solutions set status = 'hidden', updated_at = now() where id = p_solution_id;
  elsif p_action = 'restore' then
    update public.community_solutions set status = 'published', updated_at = now() where id = p_solution_id;
  else -- delete
    delete from public.community_solutions where id = p_solution_id; -- cascades notes/helpfuls/comments/reports
  end if;

  insert into public.community_moderation_log
    (target_type, target_id, exam_id, target_user_id, actor_id, action, reason)
  values ('solution', p_solution_id, v_exam_id, v_author_id, auth.uid(), p_action, nullif(btrim(p_reason), ''));

  return query select coalesce(
    case p_action when 'hide' then 'hidden' when 'restore' then 'published' else 'deleted' end, ''
  );
end;
$$;
revoke all on function public.admin_moderate_community_solution(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_community_solution(uuid, text, text) to authenticated;

-- Comment twin of admin_moderate_community_solution: the same admin gate, action
-- set and single audit-log write, against community_solution_comments. It also
-- enforces the comment state machine (hide: visible -> hidden; restore:
-- hidden -> visible; delete: either state) and a non-empty reason for hide and
-- delete (AC-107, AC-108). No counter is maintained: comment_count in every
-- read RPC counts visible comments only, so hiding or deleting a visible
-- comment lowers it on the next read and deleting a hidden one leaves it as is.
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

  -- c-qualified: status is also this function's output column.
  select cs.exam_id, c.author_id, c.status into v_exam_id, v_author_id, v_current_status
  from public.community_solution_comments c
  join public.community_solutions cs on cs.id = c.solution_id
  where c.id = p_comment_id;
  if v_current_status is null then
    raise exception 'admin_moderate_community_comment: not found' using errcode = 'P0002';
  end if;
  if (p_action = 'hide' and v_current_status <> 'visible')
     or (p_action = 'restore' and v_current_status <> 'hidden') then
    raise exception 'admin_moderate_community_comment: invalid transition' using errcode = '22023';
  end if;

  if p_action = 'hide' then
    update public.community_solution_comments set status = 'hidden' where id = p_comment_id;
  elsif p_action = 'restore' then
    update public.community_solution_comments set status = 'visible' where id = p_comment_id;
  else -- delete
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

-- admin_list_community_reports — hàng đợi R17 (backend DD v1.9 § Data
-- Contracts "Admin RPCs"): Queue row condition (binding, v1.8), Queue row
-- columns (binding, v1.8), Entry condition + Hidden-comment columns (binding,
-- v1.7) chép NGUYÊN các biểu thức của DD; hình dạng thân hàm là chi tiết
-- triển khai của task này (DD để ngỏ có chủ đích — "contract only"). Danh tính
-- KHÔNG che (S5): admin luôn đọc tên thật, cờ *_is_anonymous_to_readers chỉ
-- nói người ĐỌC sẽ thấy gì. Không cột avatar nào (DD decision (a)). Thứ tự
-- hàng (DD không ghim): "Chờ xử lý" trước "Đã ẩn", rồi bài sửa gần nhất trước.
-- plpgsql vì cần raise trước mọi lượt đọc; id/exam_id/status là cột output
-- trùng tên cột bảng nên mọi tham chiếu đều alias-qualify (DD "PL/pgSQL name
-- resolution (v1.3)" rule 1).
drop function if exists public.admin_list_community_reports();
create function public.admin_list_community_reports()
returns table (
  id uuid,
  exam_id text,
  exam_title text,
  author_display_name text,
  author_is_anonymous_to_readers boolean,
  status text,
  report_count int,
  report_reasons text[],
  reported_comments jsonb,
  hidden_comments jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin_list_community_reports: not an admin' using errcode = '42501';
  end if;

  return query
  select
    cs.id,
    cs.exam_id,
    e.title,
    up.display_name,
    not cs.show_profile,
    cs.status,
    (select count(*)::int from public.community_content_reports r where r.solution_id = cs.id),
    coalesce(
      (select array_agg(r.reason order by r.created_at desc)
       from public.community_content_reports r where r.solution_id = cs.id),
      '{}'::text[]
    ),
    -- Queue row columns → reported_comments: currently VISIBLE comments with
    -- at least one open report, newest comment first.
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'question_number', array_position(e.question_ids, c.question_id),
          'body', c.body,
          'commenter_display_name', up2.display_name,
          'commenter_is_anonymous_to_readers', c.is_anonymous,
          'report_count', (select count(*)::int from public.community_content_reports r where r.comment_id = c.id),
          'report_reasons', coalesce(
            (select array_agg(r.reason order by r.created_at desc)
             from public.community_content_reports r where r.comment_id = c.id),
            '{}'::text[]
          )
        ) order by c.created_at desc
      ), '[]'::jsonb)
      from public.community_solution_comments c
      left join public.user_profiles up2 on up2.id = c.author_id
      where c.solution_id = cs.id and c.status = 'visible'
        and exists (select 1 from public.community_content_reports r where r.comment_id = c.id)
    ),
    -- Entry condition (binding, v1.7): every hidden comment of the row,
    -- whatever its report count, newest hidden first; [] never null.
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', hc.id,
          'question_number', hc.question_number,
          'body', hc.body,
          'commenter_display_name', hc.commenter_display_name,
          'commenter_is_anonymous_to_readers', hc.commenter_is_anonymous_to_readers,
          'hidden_reason', hc.hidden_reason,
          'hidden_at', hc.hidden_at,
          'report_count', hc.report_count
        ) order by hc.hidden_at desc nulls last
      ), '[]'::jsonb)
      from (
        select
          c.id,
          array_position(e.question_ids, c.question_id) as question_number,
          c.body,
          up3.display_name as commenter_display_name,
          c.is_anonymous as commenter_is_anonymous_to_readers,
          (select l.reason from public.community_moderation_log l
           where l.target_type = 'comment' and l.target_id = c.id and l.action = 'hide'
           order by l.created_at desc limit 1) as hidden_reason,
          (select l.created_at from public.community_moderation_log l
           where l.target_type = 'comment' and l.target_id = c.id and l.action = 'hide'
           order by l.created_at desc limit 1) as hidden_at,
          (select count(*)::int from public.community_content_reports r where r.comment_id = c.id) as report_count
        from public.community_solution_comments c
        left join public.user_profiles up3 on up3.id = c.author_id
        where c.solution_id = cs.id and c.status = 'hidden'
      ) hc
    )
  from public.community_solutions cs
  join public.exams e on e.id = cs.exam_id
  left join public.user_profiles up on up.id = cs.author_id
  -- Queue row condition (binding, v1.8), chép nguyên văn: "Đã ẩn" = mọi bài
  -- hidden, KHÔNG điều kiện báo cáo nào (Reference Contract Value #26);
  -- "Chờ xử lý" = bài published còn >=1 báo cáo mở trên chính nó hoặc trên
  -- BẤT KỲ bình luận nào của nó (kể cả bình luận đã ẩn). Nháp không bao giờ
  -- là một hàng. is_admin_user() lặp lại ở đây: gate trên từng hàng, không
  -- chỉ ở đầu hàm (DD Invariants).
  where (cs.status = 'hidden' or (cs.status = 'published' and (exists (select 1 from public.community_content_reports r where r.solution_id = cs.id) or exists (select 1 from public.community_content_reports r join public.community_solution_comments c on c.id = r.comment_id where c.solution_id = cs.id))))
    and public.is_admin_user()
  order by (cs.status = 'hidden'), cs.updated_at desc, cs.id;
end;
$$;
revoke all on function public.admin_list_community_reports() from public, anon;
grant execute on function public.admin_list_community_reports() to authenticated;

-- admin_get_community_solution_notes — Reference Contract Value #16: đúng ba
-- cột {question_number, question_id, body}, twin snake_case của frontend
-- AdminSolutionNote. Một dòng cho mỗi ghi chú của câu CÒN trong đề (nên
-- question_number không bao giờ null), theo thứ tự câu; KHÔNG cổng "admin đã
-- nộp đề" (AC-081). question_id/body trùng tên cột bảng → alias-qualify, và
-- order by dùng biểu thức chứ không dùng tên cột output.
drop function if exists public.admin_get_community_solution_notes(uuid);
create function public.admin_get_community_solution_notes(p_solution_id uuid)
returns table (
  question_number int,
  question_id text,
  body text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin_user() then
    raise exception 'admin_get_community_solution_notes: not an admin' using errcode = '42501';
  end if;

  return query
  select
    array_position(e.question_ids, n.question_id),
    n.question_id,
    n.body
  from public.community_solution_notes n
  join public.community_solutions cs on cs.id = n.solution_id
  join public.exams e on e.id = cs.exam_id
  where n.solution_id = p_solution_id
    and n.question_id = any(e.question_ids)
    and public.is_admin_user()
  order by array_position(e.question_ids, n.question_id);
end;
$$;
revoke all on function public.admin_get_community_solution_notes(uuid) from public, anon;
grant execute on function public.admin_get_community_solution_notes(uuid) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, 'cb08928767f8')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
