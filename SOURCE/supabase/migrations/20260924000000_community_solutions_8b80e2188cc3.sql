-- MIGRATION — Bài giải cộng đồng, Phase 1: nền tảng + nội dung cốt lõi + đường
-- ghi + RPC cho màn viết (backend Design Doc v1.9 § Migration Strategy,
-- ownership row "task 03 (Phase 1)"; work plan
-- docs/plans/tasks/20260917-feature-community-solutions-backend-task-03.md).
--
-- Đối tượng migration này tạo, mỗi cái đúng MỘT nơi sở hữu (ADR-0021):
--   - admin_users(user_id) + is_admin_user() — danh tính admin DB-native mới,
--     KHÔNG chạm SOURCE/lib/supabase/service-role.ts (TD-029/ADR-0019).
--   - count_words(text), question_content_fingerprint(text).
--   - community_solutions, community_solution_notes — bảng nội dung cốt lõi.
--   - save_community_solution(...), set_community_solution_status(...) —
--     đường ghi.
--   - community_moderation_log — nhật ký kiểm duyệt riêng (không đụng
--     exam_moderation_log).
--   - community_solution_for_writer(...), community_solution_result_card(...)
--     — RPC đọc cho màn viết + trang kết quả.
--
-- Áp bằng Supabase CLI (`db query --file`, đa câu lệnh OK) hoặc TỪNG CÂU MỘT
-- nếu qua công cụ khác (TD-005). CHỈ áp lên DEV (`hynwleaxtbtjzkvpjsug`) ở
-- bước này — PROD là việc của task 52, làm riêng sau khi 6 migration của
-- toàn bộ tính năng đã xong.
--
-- Sau khi áp, chạy NGOÀI file này (dữ liệu, không phải schema — ADR-0021 §
-- Implementation Guidance, ADR binding #7): với MỖI id trong `ADMIN_USER_IDS`
-- của project dev,
--   insert into public.admin_users (user_id) values ('<id>');
-- Đọc lại bằng TRUY VẤN THẬT:
--   select fingerprint from public.schema_version;      -- phải trả 8b80e2188cc3
--   select count(*) from public.admin_users;             -- phải khớp số id dev ADMIN_USER_IDS

-- 20a. admin_users — bản sao trong DB của biến môi trường ADMIN_USER_IDS
-- (ADR-0021 Decision 3). RLS bật, KHÔNG policy nào — client không đọc/ghi
-- trực tiếp được, chỉ is_admin_user() (SECURITY DEFINER) đọc được.
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin_user() from public, anon;

grant execute on function public.is_admin_user() to authenticated;

-- 20b. count_words(text) — twin của lib/solutions/countWords.ts.
-- question_content_fingerprint(text) — cột khớp AC-044 CHÍNH XÁC: nội dung/
-- lựa chọn/đáp án đổi mới tính "câu đã thay đổi"; điểm/chủ đề/kỹ năng thì
-- không. SECURITY INVOKER (không phải DEFINER): §10c vẫn từ chối authenticated
-- đọc thẳng correct_answer/sub_answers/essay_answer, nên chỉ các hàm SECURITY
-- DEFINER bên dưới gọi được hàm này.
create or replace function public.count_words(p_text text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when btrim(coalesce(p_text, '')) = ''
    then 0
    else array_length(regexp_split_to_array(btrim(p_text), '\s+'), 1)
  end;
$$;

revoke all on function public.count_words(text) from public, anon;

grant execute on function public.count_words(text) to authenticated;

create or replace function public.question_content_fingerprint(p_question_id text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select md5(
    coalesce(q.content, '') || '|' ||
    coalesce(q.choices::text, '') || '|' ||
    coalesce(q.correct_answer, '') || '|' ||
    coalesce(q.sub_answers::text, '') || '|' ||
    coalesce(q.essay_answer, '')
  )
  from public.questions q
  where q.id = p_question_id;
$$;

revoke all on function public.question_content_fingerprint(text) from public, anon;

grant execute on function public.question_content_fingerprint(text) to authenticated;

-- 20c. community_solutions + community_solution_notes — bảng nội dung cốt lõi
-- (ADR-0021 Decision 1: status ∈ {draft,published,hidden}; admin xoá hẳn là
-- một lối RA khỏi máy trạng thái, không phải trạng thái thứ tư — S17).
create table if not exists public.community_solutions (
  id                uuid primary key default gen_random_uuid(),
  exam_id           text not null references public.exams(id) on delete cascade,
  author_id         uuid not null references auth.users(id) on delete cascade,
  status            text not null default 'draft',
  show_profile      boolean not null default true,
  show_score        boolean not null default false,
  is_pinned         boolean not null default false,
  linked_attempt_id uuid references public.exam_attempts(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (exam_id, author_id)
);

alter table public.community_solutions drop constraint if exists community_solutions_status_check;

alter table public.community_solutions add constraint community_solutions_status_check
  check (status in ('draft','published','hidden'));

alter table public.community_solutions enable row level security;

revoke all on public.community_solutions from anon, authenticated;

create unique index if not exists community_solutions_pinned_per_exam_idx
  on public.community_solutions (exam_id) where is_pinned;

create index if not exists community_solutions_exam_status_idx
  on public.community_solutions (exam_id, status);

create index if not exists community_solutions_author_idx
  on public.community_solutions (author_id);

create table if not exists public.community_solution_notes (
  solution_id           uuid not null references public.community_solutions(id) on delete cascade,
  question_id           text not null references public.questions(id) on delete cascade,
  body                  text not null default '',
  question_content_hash text,
  updated_at            timestamptz not null default now(),
  constraint community_solution_notes_pkey primary key (solution_id, question_id)
);

alter table public.community_solution_notes drop constraint if exists community_solution_notes_body_length_check;

alter table public.community_solution_notes add constraint community_solution_notes_body_length_check
  check (length(body) <= 8000);

alter table public.community_solution_notes enable row level security;

revoke all on public.community_solution_notes from anon, authenticated;

-- 20d. save_community_solution — đường ghi DUY NHẤT tạo/cập nhật một bài giải
-- cùng ghi chú từng câu. p_notes: mảng jsonb {"question_id": text, "body":
-- text}. Một transaction, tất-cả-hoặc-không (AC-031's "Đã lưu"). drop-then-
-- create (không phải `create or replace`) để idempotent kể cả khi RETURNS
-- TABLE đổi hình dạng sau này — cùng quy ước exam_answer_key() dùng ở §10a,
-- áp dụng cho mọi hàm RETURNS TABLE mới trong khối này.
drop function if exists public.save_community_solution(text, uuid, boolean, boolean, jsonb);

create function public.save_community_solution(
  p_exam_id text,
  p_attempt_id uuid,
  p_show_profile boolean,
  p_show_score boolean,
  p_notes jsonb
)
returns table (solution_id uuid, status text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_solution_id uuid;
  v_status text;
  v_note jsonb;
  v_word_count int;
begin
  -- R1 gate, tự suy lại (không tin RLS — đây là hàm SECURITY DEFINER).
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and not public.is_author_banned(e.author_id)
  ) then
    raise exception 'save_community_solution: exam not visible' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.exam_attempts a
    where a.exam_id = p_exam_id and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'save_community_solution: not submitted' using errcode = '42501';
  end if;
  -- D36: tác giả của chính đề đó không được miễn — check ở trên đã phủ (không
  -- có nhánh dành riêng cho tác giả).

  -- p_attempt_id, khi có, phải là lượt làm ĐÃ NỘP của chính người gọi trên
  -- CHÍNH đề này (R8/D27) — không bao giờ tin mù tham số đầu vào.
  if p_attempt_id is not null and not exists (
    select 1 from public.exam_attempts a
    where a.id = p_attempt_id and a.exam_id = p_exam_id
      and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'save_community_solution: attempt not owned or not submitted' using errcode = '42501';
  end if;

  -- cs-qualified: status cũng là cột output của hàm này
  -- (backend DD § Data Contracts "PL/pgSQL name resolution").
  insert into public.community_solutions as cs (exam_id, author_id, show_profile, show_score, linked_attempt_id)
  values (p_exam_id, auth.uid(), p_show_profile, p_show_score, coalesce(p_attempt_id, null))
  on conflict (exam_id, author_id) do update
    set show_profile      = excluded.show_profile,
        show_score        = excluded.show_score,
        linked_attempt_id = coalesce(excluded.linked_attempt_id, cs.linked_attempt_id),
        updated_at        = now()
  returning cs.id, cs.status into v_solution_id, v_status;

  -- Bị ẩn = khoá (S6): không lượt lưu nào đi xa hơn đây với bài giải đã ẩn.
  if v_status = 'hidden' then
    raise exception 'save_community_solution: solution is hidden' using errcode = '42501';
  end if;

  for v_note in select * from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb))
  loop
    v_word_count := public.count_words(v_note ->> 'body');
    -- S1: trên bài giải ĐÃ ĐĂNG, ghi chú của một câu CÒN TRONG ĐỀ không được
    -- lưu dưới 15 từ (câu mới thêm vào đề được miễn cho tới lượt lưu đầu tiên
    -- của nó — vòng lặp này chỉ ghi đúng thứ người gọi gửi lên).
    if v_status = 'published'
       and v_word_count < 15
       and exists (
         select 1 from public.exams e
         where e.id = p_exam_id and (v_note ->> 'question_id') = any(e.question_ids)
       )
    then
      -- AC-024 / UI Spec C-17: dòng từ chối không nêu số, nên DETAIL là một
      -- token cố định — điều duy nhất tách nó khỏi CHECK độ dài ghi chú (cũng
      -- 23514 nhưng DETAIL là "Failing row contains (…)" của chính Postgres).
      raise exception 'save_community_solution: note below 15 words on a published solution'
        using errcode = '23514', detail = 'below_word_count';
    end if;

    -- Đích conflict theo TÊN ràng buộc: solution_id cũng là cột output của
    -- hàm này, và danh sách cột trong on conflict không qualify được.
    insert into public.community_solution_notes (solution_id, question_id, body, question_content_hash, updated_at)
    values (
      v_solution_id,
      v_note ->> 'question_id',
      coalesce(v_note ->> 'body', ''),
      public.question_content_fingerprint(v_note ->> 'question_id'),
      now()
    )
    on conflict on constraint community_solution_notes_pkey do update
      set body                  = excluded.body,
          question_content_hash = excluded.question_content_hash,
          updated_at            = now();
  end loop;

  return query select v_solution_id, v_status;
end;
$$;

revoke all on function public.save_community_solution(text, uuid, boolean, boolean, jsonb) from public, anon;

grant execute on function public.save_community_solution(text, uuid, boolean, boolean, jsonb) to authenticated;

-- 20e. set_community_solution_status — chuyển draft ↔ published (R4: gỡ về
-- nháp luôn được phép cho chủ, publish đòi mọi câu hiện tại >= 15 từ, AC-029).
drop function if exists public.set_community_solution_status(text, text);

create function public.set_community_solution_status(
  p_exam_id text,
  p_action text -- 'publish' | 'draft'
)
returns table (status text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_solution_id uuid;
  v_current_status text;
  v_missing_count int;
begin
  if p_action not in ('publish', 'draft') then
    raise exception 'set_community_solution_status: invalid action' using errcode = '22023';
  end if;
  -- AC-004 / M2: cả hai hành động đòi đề đã published và tác giả không bị ban
  -- (nửa "đề" của gate R1 mà save_community_solution dùng).
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and not public.is_author_banned(e.author_id)
  ) then
    raise exception 'set_community_solution_status: exam not visible' using errcode = '42501';
  end if;
  -- AC-002 / M2: người gọi phải có lượt làm ĐÃ NỘP trên đề này. Sở hữu bài
  -- giải không chứng minh được điều đó: attempts_update_own cho phép người
  -- dùng tự đổi status lượt làm của chính mình.
  if not exists (
    select 1 from public.exam_attempts a
    where a.exam_id = p_exam_id and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    raise exception 'set_community_solution_status: not submitted' using errcode = '42501';
  end if;

  -- cs-qualified: status cũng là cột output của hàm này.
  select cs.id, cs.status into v_solution_id, v_current_status
  from public.community_solutions cs
  where cs.exam_id = p_exam_id and cs.author_id = auth.uid();

  if v_solution_id is null then
    raise exception 'set_community_solution_status: no solution to publish' using errcode = 'P0002';
  end if;
  if v_current_status = 'hidden' then
    raise exception 'set_community_solution_status: solution is hidden' using errcode = '42501';
  end if;

  if p_action = 'publish' then
    -- AC-029: mọi câu HIỆN TẠI phải >= 15 từ. Tất-cả-hoặc-không.
    select count(*) into v_missing_count
    from unnest((select question_ids from public.exams where id = p_exam_id)) as qid
    left join public.community_solution_notes n
      on n.solution_id = v_solution_id and n.question_id = qid
    where public.count_words(n.body) < 15;

    -- AC-029 / UI Spec C-14: dòng từ chối phải NÊU số câu chưa đạt 15 từ, nên
    -- con số rời hàm này dưới dạng dữ liệu có cấu trúc (DETAIL, PostgREST trả
    -- về ở error.details) chứ không bao giờ được parse ngược từ message.
    if v_missing_count > 0 then
      raise exception 'set_community_solution_status: % question(s) below 15 words', v_missing_count
        using errcode = '23514', detail = v_missing_count::text;
    end if;

    update public.community_solutions set status = 'published', updated_at = now() where id = v_solution_id;
    return query select 'published'::text;
  else
    update public.community_solutions set status = 'draft', updated_at = now() where id = v_solution_id;
    return query select 'draft'::text;
  end if;
end;
$$;

revoke all on function public.set_community_solution_status(text, text) from public, anon;

grant execute on function public.set_community_solution_status(text, text) to authenticated;

-- 20f. community_moderation_log — nhật ký kiểm duyệt RIÊNG cho tính năng này
-- (ADR-0021 "exam_moderation_log is not extended": bảng đó chỉ được ghi bởi
-- moderateExam() trong service-role.ts — đúng bề mặt tính năng này bị cấm
-- chạm). target_id KHÔNG phải khoá ngoại — phải sống sót qua một lượt xoá hẳn
-- (AC-084). viewed_at chỉ được ĐẶT, không bao giờ bị gỡ lại (S20 — cột này
-- cần trước cả các hàm admin_* vì community_solution_result_card đọc nó).
create table if not exists public.community_moderation_log (
  id             uuid primary key default gen_random_uuid(),
  target_type    text not null,
  target_id      uuid not null, -- cố ý KHÔNG là khoá ngoại: phải sống sót qua xoá hẳn (AC-084)
  exam_id        text references public.exams(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  actor_id       uuid references auth.users(id) on delete set null,
  action         text not null,
  reason         text,
  created_at     timestamptz not null default now(),
  viewed_at      timestamptz
);

alter table public.community_moderation_log drop constraint if exists community_moderation_log_target_type_check;

alter table public.community_moderation_log add constraint community_moderation_log_target_type_check
  check (target_type in ('solution', 'comment'));

alter table public.community_moderation_log drop constraint if exists community_moderation_log_action_check;

alter table public.community_moderation_log add constraint community_moderation_log_action_check
  check (action in ('hide', 'restore', 'delete'));

create index if not exists community_moderation_log_unseen_idx
  on public.community_moderation_log (target_user_id, exam_id, target_type, viewed_at);

alter table public.community_moderation_log enable row level security;

revoke all on public.community_moderation_log from anon, authenticated;

-- 20g. community_solution_for_writer — màn viết đọc CHÍNH bài giải của mình
-- (được tạo LƯỜI: chỉ có sau lượt save_community_solution đầu tiên, D9's
-- "viết dần" — hàm đọc này không bao giờ insert). 7 cột, ĐÚNG thứ tự, KHÔNG
-- có changed_question_count (v1.9 — frontend tự suy từ questions[].has_changed,
-- backend DD § Data Contracts "community_solution_for_writer" Output columns).
drop function if exists public.community_solution_for_writer(text);

create function public.community_solution_for_writer(p_exam_id text)
returns table (
  solution_id   uuid,
  attempt_id    uuid,
  status        text,
  show_profile  boolean,
  show_score    boolean,
  hidden_reason text,
  questions     jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt_id uuid;
begin
  -- R1 gate, tự suy lại — người gọi không đủ điều kiện nhận 0 dòng, KHÔNG bao
  -- giờ nhận dòng "chưa có bài giải" (AC-002, AC-004).
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and not public.is_author_banned(e.author_id)
  ) then
    return;
  end if;

  -- Lượt làm ĐÃ NỘP mới nhất của người gọi trên đề này — cũng là attempt_id
  -- mặc định khi bài giải chưa có/chưa gắn lượt làm nào (UI Spec UI-D1).
  select a2.id into v_attempt_id
    from public.exam_attempts a2
   where a2.exam_id = p_exam_id and a2.user_id = auth.uid() and a2.status = 'submitted'
   order by a2.submitted_at desc nulls last, a2.started_at desc
   limit 1;

  if v_attempt_id is null then
    return;
  end if;

  return query
  select
    cs.id as solution_id,
    coalesce(cs.linked_attempt_id, v_attempt_id) as attempt_id,
    cs.status,
    coalesce(cs.show_profile, true) as show_profile,
    coalesce(cs.show_score, false) as show_score,
    case when cs.status = 'hidden' then (
      select l.reason from public.community_moderation_log l
      where l.target_type = 'solution' and l.target_id = cs.id and l.action = 'hide'
      order by l.created_at desc limit 1
    ) end as hidden_reason,
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'question_id', ak.id,
          'stem', ak.content,
          'correct_answer', ak.correct_answer,
          -- AC-022: note sheet cần đủ dữ liệu để hiện "Xem N phương án" (trắc
          -- nghiệm) / "Đáp án mẫu" (tự luận) — 4 cột này lấy nguyên từ `ak`
          -- (exam_answer_key đã join sẵn ở FROM bên dưới), không join thêm
          -- bảng nào, không đổi cổng vào entitlement.
          'question_type', ak.question_type,
          'choices', ak.choices,
          'sub_answers', ak.sub_answers,
          'essay_answer', ak.essay_answer,
          -- Kết quả riêng câu này của lượt làm đã gắn — nguồn "Bạn làm đúng/
          -- sai/bỏ trống". per_question lưu nguyên PerQuestionResult[] (khoá
          -- questionId, camelCase — types/result.ts), không transform khi ghi.
          'my_result', (
            select pq from jsonb_array_elements(coalesce(er.per_question, '[]'::jsonb)) as pq
            where pq ->> 'questionId' = ak.id
            limit 1
          ),
          'note', n.body,
          'word_count', public.count_words(n.body),
          'has_changed', (n.solution_id is not null and n.question_content_hash is distinct from public.question_content_fingerprint(ak.id)),
          -- Ghi chú hiện tại có ĐÚNG BẰNG bài làm tự luận của lượt làm đã gắn
          -- không — tín hiệu duy nhất suy được từ dữ liệu đã có, không thêm
          -- cột trạng thái mới (AC-034/AC-035/AC-036 bookkeeping phía frontend).
          'essay_prefill_applied', coalesce(n.body is not null and n.body <> '' and n.body = aa.answer, false)
        ) order by array_position(e.question_ids, ak.id)
      ), '[]'::jsonb)
      from public.exams e
      cross join public.exam_answer_key(p_exam_id) ak
      left join public.community_solution_notes n
        on n.solution_id = cs.id and n.question_id = ak.id
      left join public.exam_results er
        on er.attempt_id = coalesce(cs.linked_attempt_id, v_attempt_id)
      left join public.attempt_answers aa
        on aa.attempt_id = coalesce(cs.linked_attempt_id, v_attempt_id) and aa.question_id = ak.id
      where e.id = p_exam_id
    ) as questions
  from (select 1) as _dummy
  left join public.community_solutions cs
    on cs.exam_id = p_exam_id and cs.author_id = auth.uid();
end;
$$;

revoke all on function public.community_solution_for_writer(text) from public, anon;

grant execute on function public.community_solution_for_writer(text) to authenticated;

-- 20h. community_solution_result_card — MỘT truy vấn thêm duy nhất mà trang
-- kết quả được phép gọi (AC-012, M11). ĐỌC-TIÊU-THỤ: unseen_deletion_reason
-- chỉ khác null đúng MỘT lần cho mỗi lượt xoá hẳn — đọc xong là đánh dấu đã
-- xem (viewed_at), không đọc lại được lần hai (S20).
drop function if exists public.community_solution_result_card(text);

create function public.community_solution_result_card(p_exam_id text)
returns table (
  published_count int,
  my_status text,
  changed_question_count int,
  unseen_deletion_reason text
)
language plpgsql
volatile -- ghi viewed_at, nên KHÔNG phải stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
  v_log_id uuid;
begin
  -- AC-004 / M2: 0 dòng khi đề chưa published hoặc tác giả bị ban. AC-002 /
  -- M2: 0 dòng khi người gọi chưa có lượt làm ĐÃ NỘP trên đề. Cả hai trường
  -- hợp: lý do xoá hẳn (nếu có) KHÔNG được trả về và KHÔNG bị đánh dấu đã xem
  -- — nó vẫn "chưa xem" cho tới khi card render lại được (S20).
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id
      and e.status = 'published'
      and not public.is_author_banned(e.author_id)
  ) or not exists (
    select 1 from public.exam_attempts a
    where a.exam_id = p_exam_id and a.user_id = auth.uid() and a.status = 'submitted'
  ) then
    return;
  end if;

  select id, reason into v_log_id, v_reason
  from public.community_moderation_log
  where target_user_id = auth.uid()
    and exam_id = p_exam_id
    and target_type = 'solution'
    and action = 'delete'
    and viewed_at is null
  order by created_at desc
  limit 1;

  if v_log_id is not null then
    update public.community_moderation_log set viewed_at = now() where id = v_log_id;
  end if;

  return query
  select
    (select count(*)::int from public.community_solutions where exam_id = p_exam_id and status = 'published'),
    (select status from public.community_solutions where exam_id = p_exam_id and author_id = auth.uid()),
    (select
       count(*)::int from unnest((select question_ids from public.exams where id = p_exam_id)) as qid
       join public.community_solution_notes n
         on n.solution_id = (select id from public.community_solutions where exam_id = p_exam_id and author_id = auth.uid())
         and n.question_id = qid
       where n.question_content_hash is distinct from public.question_content_fingerprint(qid)),
    v_reason;
end;
$$;

revoke all on function public.community_solution_result_card(text) from public, anon;

grant execute on function public.community_solution_result_card(text) to authenticated;

insert into public.schema_version (id, fingerprint)
values (1, '8b80e2188cc3')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
