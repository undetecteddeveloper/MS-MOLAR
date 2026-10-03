-- ============================================================================
-- TrangNguyenDigi — Database Schema (GĐ 2 M2.2)
-- Thiết kế đơn giản theo quyết định C&D Q1=A:
--   - questions/exams chỉ giữ cột cần thiết cho Core Loop.
--   - KHÔNG có confidence_score / quarantine / view published_questions
--     (để dành Post-MVP Layer 4).
-- Cách dùng: paste toàn bộ file này vào Supabase SQL Editor → Run.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- Tham chiếu ARCHITECTURE.md (gốc repo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Logic L1 — Identity
-- ----------------------------------------------------------------------------

create table if not exists public.user_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'student',
  created_at   timestamptz not null default now()
);

-- Ảnh đại diện (ADR-0016). Cột này giữ ĐƯỜNG DẪN OBJECT trong bucket `avatars`
-- (`{auth.uid()}/{uuid}.{ext}`), KHÔNG phải URL tải được: bucket private nên mọi
-- lượt đọc phải ký lại lúc render (lib/auth/getCurrentUser.ts). Ai lưu URL vào
-- đây thì sau 1 giờ nó chết mà không có gì báo.
-- Nullable + additive: handle_new_user() bên dưới insert danh sách cột CỐ ĐỊNH
-- nên trigger không bị ảnh hưởng.
alter table public.user_profiles add column if not exists avatar_url text;

-- Tự tạo user_profiles khi có user mới trong auth.users (chuẩn Supabase).
-- SECURITY DEFINER để bypass RLS lúc insert tự động.
-- S#24: OAuth (Google/Facebook) không set 'display_name' trong
-- raw_user_meta_data — chỉ có 'full_name'/'name' (Google) hoặc 'name'
-- (Facebook). Fallback chain: display_name → full_name → name → phần
-- trước "@" của email (KHÔNG dùng email đầy đủ — lộ email trên UI).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Logic L4 (tối giản) — Content: questions & exams
-- ----------------------------------------------------------------------------

create table if not exists public.questions (
  id             text primary key,
  content        text not null,
  choices        jsonb not null,                 -- [{ id: 'A'|'B'|'C'|'D', text }]
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  subject        text not null,
  grade          int  not null,
  topic          text not null
);

create table if not exists public.exams (
  id               text primary key,
  title            text not null,
  question_ids     text[] not null,               -- thứ tự câu hỏi trong đề
  duration_minutes int  not null,
  subject          text not null,
  grade            int  not null,
  -- S#27: metadata cho Filter/ExamCard (School/Year/Semester + sort Newest/Oldest).
  school           text,                          -- trường biên soạn/nguồn đề (free-text)
  school_year      int,                           -- niên khóa ra đề, vd 2024
  semester         text,                          -- 'HK1' | 'HK2' (constraint bên dưới)
  created_at       timestamptz not null default now()
);

-- S#27 migration — DB đã tồn tại từ trước KHÔNG nhận cột mới qua
-- `create table if not exists` → ALTER riêng, idempotent.
alter table public.exams add column if not exists school text;
alter table public.exams add column if not exists school_year int;
alter table public.exams add column if not exists semester text;
alter table public.exams add column if not exists created_at timestamptz not null default now();

alter table public.exams drop constraint if exists exams_semester_check;
alter table public.exams add constraint exams_semester_check
  check (semester is null or semester in ('HK1', 'HK2'));

-- ----------------------------------------------------------------------------
-- Tìm đề theo tên (ADR-0020, 2026-09-08) — chuẩn hoá + trigram, chạy TRONG
-- Postgres, không dịch vụ tìm kiếm ngoài.
--
-- Vì sao ở ĐÂY (ngay sau bảng exams, trước §12b): view `exams_with_difficulty`
-- dùng `e.*`, và `e.*` bung ra rồi ĐÓNG BĂNG lúc view được tạo — cột sinh phải
-- tồn tại TRƯỚC khi file tạo view thì view mới phơi được nó. Trên DB đã có view
-- từ trước, migration phải drop/tạo lại view (migration 2026-09-01 là tiền lệ).
--
-- `search_normalize` khai IMMUTABLE dù `unaccent()` gốc chỉ STABLE: hàm gốc
-- STABLE vì từ điển được tra theo `search_path`; gọi với từ điển ĐÍCH DANH
-- (`extensions.unaccent`) thì kết quả không còn phụ thuộc phiên — đúng điều
-- kiện để dùng trong cột sinh và chỉ mục. Bản JS `lib/search/normalize.ts`
-- làm ĐÚNG cùng các bước; làn localdb so hai bản trên cùng chuỗi tiếng Việt.
-- Đổi cách chuẩn hoá về sau = dựng lại cột sinh, không chỉ sửa hàm.
-- ----------------------------------------------------------------------------
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

-- Cột sinh chứ không phải trigger: không có đường ghi nào (seed, UGC publish,
-- sửa tay trong SQL Editor) quên được nó.
alter table public.exams add column if not exists title_search text
  generated always as (public.search_normalize(title)) stored;

-- GIN trigram: tăng tốc cả `ILIKE '%term%'` (bộ lọc ?q= của Kho đề) lẫn toán tử
-- `<%` (word_similarity — chịu lỗi gõ trong RPC search_exams).
create index if not exists exams_title_search_trgm_idx
  on public.exams using gin (title_search extensions.gin_trgm_ops);

-- Gợi ý khi gõ. SECURITY INVOKER: RLS `exams_select_visible` áp lên người gọi,
-- nên khách chưa đăng nhập không thấy gì (và bị revoke luôn cho rõ ý). STABLE,
-- không ghi. Xếp: bắt đầu bằng từ khoá → đầu một từ → chứa từ khoá → giống
-- nhất (word_similarity, chịu lỗi gõ) → mới nhất. Từ khoá chuẩn hoá NGAY TRONG
-- hàm nên người gọi gửi chuỗi thô; chuỗi ra chỉ còn [a-z0-9 ] nên không có ký
-- tự đặc biệt nào của LIKE lọt vào mẫu.
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

-- ----------------------------------------------------------------------------
-- Logic L2 — Core Loop: attempts, answers, results
-- ----------------------------------------------------------------------------

create table if not exists public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- `on delete cascade`: xoá đề thì mọi lượt làm bài đi theo (xem §15 — DB đã
  -- dựng trước 2026-08-04 KHÔNG nhận thay đổi này qua `create table if not
  -- exists`, phải nhờ khối alter ở §15).
  exam_id      text not null references public.exams (id) on delete cascade,
  status       text not null default 'in_progress',  -- 'in_progress' | 'submitted'
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.attempt_answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.exam_attempts (id) on delete cascade,
  -- `on delete cascade`: xoá câu hỏi thì ô trả lời đi theo (xem §15).
  question_id text not null references public.questions (id) on delete cascade,
  answer      text check (answer in ('A', 'B', 'C', 'D')),  -- null = bỏ trống
  flagged     boolean not null default false,
  unique (attempt_id, question_id)
);

create table if not exists public.exam_results (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null unique references public.exam_attempts (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  total_score     numeric(4, 2) not null,           -- thang 10
  correct         int not null,
  total           int not null,
  per_question    jsonb not null,                   -- PerQuestionResult[]
  topic_breakdown jsonb not null,                   -- TopicResult[]
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.user_profiles   enable row level security;
alter table public.questions        enable row level security;
alter table public.exams            enable row level security;
alter table public.exam_attempts    enable row level security;
alter table public.attempt_answers  enable row level security;
alter table public.exam_results     enable row level security;

-- user_profiles — user chỉ đọc/sửa profile của mình -------------------------
drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own" on public.user_profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
  for update using (id = auth.uid());

-- questions — mọi authenticated user đọc được -------------------------------
drop policy if exists "questions_select_authenticated" on public.questions;
create policy "questions_select_authenticated" on public.questions
  for select to authenticated using (true);

-- exams — mọi authenticated user đọc được -----------------------------------
drop policy if exists "exams_select_authenticated" on public.exams;
create policy "exams_select_authenticated" on public.exams
  for select to authenticated using (true);

-- exam_attempts — user chỉ thao tác attempt của mình ------------------------
drop policy if exists "attempts_select_own" on public.exam_attempts;
create policy "attempts_select_own" on public.exam_attempts
  for select using (user_id = auth.uid());

drop policy if exists "attempts_insert_own" on public.exam_attempts;
create policy "attempts_insert_own" on public.exam_attempts
  for insert with check (user_id = auth.uid());

drop policy if exists "attempts_update_own" on public.exam_attempts;
create policy "attempts_update_own" on public.exam_attempts
  for update using (user_id = auth.uid());

-- attempt_answers — chỉ khi attempt thuộc về user --------------------------
drop policy if exists "answers_select_own" on public.attempt_answers;
create policy "answers_select_own" on public.attempt_answers
  for select using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_answers.attempt_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "answers_insert_own" on public.attempt_answers;
create policy "answers_insert_own" on public.attempt_answers
  for insert with check (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_answers.attempt_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "answers_update_own" on public.attempt_answers;
create policy "answers_update_own" on public.attempt_answers
  for update using (
    exists (
      select 1 from public.exam_attempts a
      where a.id = attempt_answers.attempt_id and a.user_id = auth.uid()
    )
  );

-- exam_results — user chỉ đọc/ghi kết quả của mình --------------------------
drop policy if exists "results_select_own" on public.exam_results;
create policy "results_select_own" on public.exam_results
  for select using (user_id = auth.uid());

drop policy if exists "results_insert_own" on public.exam_results;
create policy "results_insert_own" on public.exam_results
  for insert with check (user_id = auth.uid());

-- ============================================================================
-- UGC Exam Upload v2.0 (ADR-0001/0003, Design Doc §Schema & DB Enforcement)
-- Lifecycle + authorship + source files. Idempotent.
-- KHÔNG có admin: không is_admin(), không cap trigger, không role trigger.
-- Thứ tự: cột/constraint → exam_reports → SELECT policies thay thế →
--         WRITE policies tác giả → profiles with check → Storage policies →
--         BACKFILL CUỐI CÙNG.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. exams — cột lifecycle/tác giả/file nguồn + CHECK status
-- ----------------------------------------------------------------------------
alter table public.exams add column if not exists status text not null default 'processing';
-- `on delete` viết RÕ chứ không để mặc định — xem §16: mọi khoá ngoại phải khai
-- hành vi xoá, và `verify:schema` fail nếu có cái nào bỏ trống.
-- Dòng này CHỈ có hiệu lực trên DB trắng; §16b mới là nơi sở hữu hành vi thật
-- (`add column if not exists` không chạy lại trên DB đã có cột, nên đổi ở đây
-- không đủ). Giữ hai chỗ NÓI CÙNG MỘT THỨ để đọc §L4 không hiểu nhầm.
alter table public.exams add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.exams add column if not exists author_display_name text;   -- ADR-0003: snapshot tên tác giả
alter table public.exams add column if not exists reviewed_at timestamptz;    -- set khi publish
alter table public.exams add column if not exists question_file_path text;    -- path trong exam-uploads (nguồn re-run)
alter table public.exams add column if not exists answer_file_path text;

alter table public.exams drop constraint if exists exams_status_check;
alter table public.exams add constraint exams_status_check
  check (status in ('processing','review','draft','published','failed'));

-- ----------------------------------------------------------------------------
-- 2. questions — cột mới (seeded rows nhận default, không đổi dữ liệu)
-- ----------------------------------------------------------------------------
alter table public.questions add column if not exists question_type text not null default 'mcq';
alter table public.questions add column if not exists image_url text;         -- URL Storage của hình đã crop
alter table public.questions add column if not exists essay_answer text;      -- đáp án mẫu cho essay; null với mcq

-- questions_type_check CỐ Ý không add ở đây. Bản v2.0 của nó là
-- `check (question_type in ('mcq','essay'))`, và §8c (v2.1) nới ra thành
-- 4 giá trị. Trên DB đã có dữ liệu v2.1 (true_false/short_answer), add bản HẸP
-- ở đây làm cả file chết ngay tại dòng này với
-- `23514: check constraint "questions_type_check" ... is violated by some row`
-- — script dừng, §8c không bao giờ chạy tới, nên constraint không bao giờ được
-- nới lại. Tức là file TỰ PHÁ tính idempotent của chính nó (2026-08-03).
-- §8c là nơi DUY NHẤT sở hữu constraint này; nó đã có sẵn `drop ... if exists`.
-- Đáp án MCQ vẫn ở correct_answer (CHECK A–D giữ nguyên); essay dùng essay_answer.

-- ----------------------------------------------------------------------------
-- 3. exam_reports — báo cáo nội dung (1 report / user / exam)
-- ----------------------------------------------------------------------------
create table if not exists public.exam_reports (
  id                    uuid primary key default gen_random_uuid(),
  exam_id               text not null references public.exams(id) on delete cascade,
  reporter_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reporter_display_name text,                            -- ADR-0003 snapshot
  reason                text not null,
  created_at            timestamptz not null default now(),
  unique (exam_id, reporter_id)                          -- 1 report / user / exam
);
alter table public.exam_reports drop constraint if exists exam_reports_reason_check;
alter table public.exam_reports add constraint exam_reports_reason_check
  check (length(btrim(reason)) > 0);

-- ----------------------------------------------------------------------------
-- 4. SELECT policies thay thế — published HOẶC của chính tác giả (không admin)
-- ----------------------------------------------------------------------------
drop policy if exists "exams_select_authenticated" on public.exams;
drop policy if exists "exams_select_visible" on public.exams;
create policy "exams_select_visible" on public.exams
  for select to authenticated using (
    status = 'published' or author_id = auth.uid()
  );

-- questions: thấy được nếu thuộc ít nhất một exam mà user được thấy.
drop policy if exists "questions_select_authenticated" on public.questions;
drop policy if exists "questions_select_visible" on public.questions;
create policy "questions_select_visible" on public.questions
  for select to authenticated using (
    exists (
      select 1 from public.exams e
      where questions.id = any(e.question_ids)
        and (e.status = 'published' or e.author_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. WRITE policies tác giả (không admin)
-- ----------------------------------------------------------------------------
-- exams: tác giả tự quản lý đề của mình (mọi status). Published vẫn sửa được (PRD R8).
drop policy if exists "exams_insert_author" on public.exams;
create policy "exams_insert_author" on public.exams
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "exams_update_author" on public.exams;
create policy "exams_update_author" on public.exams
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "exams_delete_author" on public.exams;
create policy "exams_delete_author" on public.exams
  for delete to authenticated using (author_id = auth.uid());

-- questions: tác giả ghi câu hỏi thuộc đề của chính mình.
drop policy if exists "questions_insert_author" on public.questions;
create policy "questions_insert_author" on public.questions
  for insert to authenticated with check (
    exists (select 1 from public.exams e
            where questions.id = any(e.question_ids) and e.author_id = auth.uid())
  );
drop policy if exists "questions_update_author" on public.questions;
create policy "questions_update_author" on public.questions
  for update to authenticated using (
    exists (select 1 from public.exams e
            where questions.id = any(e.question_ids) and e.author_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e
            where questions.id = any(e.question_ids) and e.author_id = auth.uid())
  );
drop policy if exists "questions_delete_author" on public.questions;
create policy "questions_delete_author" on public.questions
  for delete to authenticated using (
    exists (select 1 from public.exams e
            where questions.id = any(e.question_ids) and e.author_id = auth.uid())
  );

-- Seeded content có author_id is null → không policy tác giả nào khớp — client
-- chỉ đọc; owner sửa seed qua service-role/SQL (không đổi). Gỡ UGC published
-- xấu: out-of-band bằng service-role (bypass RLS).

-- ----------------------------------------------------------------------------
-- 6. exam_reports policies — chỉ đọc report của chính mình
-- ----------------------------------------------------------------------------
alter table public.exam_reports enable row level security;

drop policy if exists "reports_insert_own" on public.exam_reports;
create policy "reports_insert_own" on public.exam_reports
  for insert to authenticated with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published')
  );

-- Select = chỉ row của mình (cho UI "bạn đã báo cáo"). Owner đọc tất cả out-of-band.
drop policy if exists "reports_select_own" on public.exam_reports;
create policy "reports_select_own" on public.exam_reports
  for select to authenticated using (reporter_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. profiles_update_own — bổ sung with check (đóng lỗ hổng write-scoping)
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own" on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 8. Storage policies — bucket exam-images & exam-uploads
--    Bucket tạo qua Storage API/dashboard (xem supabase/setup-storage.ts).
--    Path convention: {bucket}/{exam_id}/{filename} → policy resolve exam từ
--    segment đầu của path. Nếu SQL Editor báo "must be owner of table objects",
--    tạo các policy này qua Dashboard → Storage → Policies (nội dung y hệt).
-- ----------------------------------------------------------------------------
-- exam-images: hình của đề published đọc được (catalog/player); chưa published
-- chỉ tác giả đọc.
drop policy if exists "exam_images_select" on storage.objects;
create policy "exam_images_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'exam-images'
    and exists (
      select 1 from public.exams e
      where e.id = (storage.foldername(name))[1]
        and (e.status = 'published' or e.author_id = auth.uid())
    )
  );

-- exam-images write: chỉ tác giả sở hữu exam được ghi vào folder của đề mình.
drop policy if exists "exam_images_write" on storage.objects;
create policy "exam_images_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'exam-images'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  );

-- exam-uploads (file gốc câu hỏi/đáp án): chỉ tác giả, cả đọc lẫn ghi. Không bao giờ public.
drop policy if exists "exam_uploads_all" on storage.objects;
create policy "exam_uploads_all" on storage.objects
  for all to authenticated using (
    bucket_id = 'exam-uploads'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  ) with check (
    bucket_id = 'exam-uploads'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 8b. Vá phát hiện khi làm Task 4.1 (2026-07-16):
--   (1) correct_answer NOT NULL + CHECK A–D làm câu ESSAY và câu mcq THIẾU đáp
--       án (trạng thái failed/review chờ tác giả sửa) không thể lưu. Nới thành
--       nullable; tính toàn vẹn của đề PUBLISHED do publishExam cưỡng chế
--       (validate sạch mới cho publish — AC-013/016); catalog/player chỉ đọc
--       published nên không bao giờ gặp correct_answer null.
--   (2) exam-images thiếu policy UPDATE (re-crop dùng upsert) và DELETE
--       (deleteExam dọn hình) cho tác giả.
-- ----------------------------------------------------------------------------
alter table public.questions alter column correct_answer drop not null;
alter table public.questions drop constraint if exists questions_correct_answer_check;
alter table public.questions add constraint questions_correct_answer_check
  check (correct_answer is null or correct_answer in ('A', 'B', 'C', 'D'));

drop policy if exists "exam_images_update" on storage.objects;
create policy "exam_images_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'exam-images'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  ) with check (
    bucket_id = 'exam-images'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  );

drop policy if exists "exam_images_delete" on storage.objects;
create policy "exam_images_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'exam-images'
    and exists (select 1 from public.exams e
                where e.id = (storage.foldername(name))[1] and e.author_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 8c. UGC v2.1 (ADR-0005) — format đề quốc gia nhiều PHẦN (Task A1, 2026-07-17).
--   Đề TN THPT từ 2025: PHẦN I (mcq) / PHẦN II (đúng-sai 4 ý a–d) / PHẦN III
--   (trả lời ngắn), số câu ĐÁNH LẠI TỪ 1 theo từng phần → cần trục part.
--   - part_number: phần chứa câu hỏi (đề cũ không chia phần = 1).
--   - sub_answers: đáp án Đ/S từng ý cho true_false, dạng {"a":bool,...} —
--     SERVER-ONLY như correct_answer (player KHÔNG BAO GIỜ select cột này).
--   - short_answer TÁI DÙNG cột essay_answer (giá trị mong đợi dạng text).
--   - exams.parts: [{"number":int,"title":text}] tiêu đề phần in trên đề để
--     hiển thị nhóm; null với đề 1 phần.
-- ----------------------------------------------------------------------------
alter table public.questions add column if not exists part_number int not null default 1;
alter table public.questions add column if not exists sub_answers jsonb;

alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check
  check (question_type in ('mcq', 'essay', 'true_false', 'short_answer'));

alter table public.exams add column if not exists parts jsonb;

-- attempt_answers.answer trước đây CHECK in ('A'..'D') — v2.1 người làm bài
-- còn nhập Đ/S từng ý (true_false, mã hoá "a:Đ,b:S,...") và giá trị ngắn
-- (short_answer). Nới thành text tự do có giới hạn độ dài; tính đúng/sai của
-- mcq do computeScore server-side quyết định, CHECK cũ không phải tầng bảo vệ.
--
-- 500 -> 4000 (Essay Auto-Scoring R11/D11): một bài tự luận có rubric không
-- viết nổi trong 500 ký tự. Con số 4000 KHÔNG có cơ sở thực nghiệm — production
-- có 0 bài tự luận đã nộp — nên nó được chọn bằng lập luận và ghi ở
-- docs/design/essay-auto-scoring-backend-design.md § Trần ký tự.
--
-- 4000 -> 8000 (2026-09-13): trần trong mã nay NỚI THEO MÔN (Ngữ văn, Tiếng
-- Anh: 8000; còn lại 4000 — LIMITS.MAX_ATTEMPT_ANSWER_BY_SUBJECT). DB không
-- biết môn nên CHECK phải chứa được bài dài nhất mã cho gõ: nó PHẢI bằng
-- attemptAnswerDbCeiling() (lib/ugc/limits.ts); npm run verify:schema đọc lại
-- trần này từ DB THẬT và đỏ nếu hai bên lệch.
alter table public.attempt_answers drop constraint if exists attempt_answers_answer_check;
alter table public.attempt_answers add constraint attempt_answers_answer_check
  check (answer is null or length(answer) <= 8000);

-- ----------------------------------------------------------------------------
-- 8d. UGC — NGỮ LIỆU DÙNG CHUNG (A1, 2026-09-01).
--   Đề Tiếng Anh/Ngữ văn gắn MỘT bài đọc cho một NHÓM câu ("Read the following
--   passage and mark the letter... Questions 34-40"). Trước bản này pipeline
--   không có chỗ đựng thứ đó, nên bài đọc bị CHÉP LẶP vào content của từng
--   câu: 7 câu = 7 bản y hệt trong DB, 7 lần hiện cho học sinh, 7 lần AI phải
--   xuất lại cùng một đoạn văn — và đó là nguyên nhân thật của 7 lỗi
--   STEM_TOO_LONG ở đề Tiếng Anh 40 câu.
--
--   - exams.passages: [{"id":text,"title":text|null,"text":text}] | null.
--     jsonb TRÊN exams chứ không phải bảng riêng, ĐÚNG khuôn exams.parts ngay
--     trên: ngữ liệu thuộc về đúng một đề, không bao giờ dùng lại giữa các đề
--     và không bao giờ được truy vấn độc lập. Một bảng riêng ở đây chỉ thêm
--     khoá ngoại, thêm policy RLS và thêm một nhánh cascade phải canh, mà
--     không mở ra truy vấn nào ta thật sự cần.
--   - questions.passage_id: trỏ tới phần tử `id` trong mảng trên; null = câu
--     tự chứa (đại đa số câu của 8 môn còn lại).
--
--   KHÔNG khoá ngoại và KHÔNG CHECK tham chiếu: đích nằm trong jsonb nên
--   Postgres không cưỡng chế được, y hệt cách part_number không có FK sang
--   exams.parts. Tính toàn vẹn do tầng app giữ (validateAssembledExam báo
--   PASSAGE_MISSING), và hướng lệch được chọn có chủ đích — một passage_id mồ
--   côi làm câu hỏi mất phần ngữ liệu, KHÔNG làm hỏng lượt thi.
--
--   Row cũ tự đúng: cả hai cột nullable, mặc định null (cùng lối lập luận với
--   part_number/sub_answers/exams.parts ở §8c) — không cần backfill.
-- ----------------------------------------------------------------------------
alter table public.exams add column if not exists passages jsonb;
alter table public.questions add column if not exists passage_id text;

-- ----------------------------------------------------------------------------
-- 8e. LUẬT CHẤM ĐIỂM KHỚP ĐỀ NGUYÊN BẢN (B1 + B2 + B3, 2026-09-01).
--
--   Trước bản này điểm tính bằng tỉ lệ `đúng/tổng × 10` — MỌI câu cân bằng
--   nhau, và câu tự luận đứng ngoài mẫu số. Ba hệ quả sai, đã đo:
--     · đề Ngữ văn thật là 3đ Đọc hiểu + 7đ Làm văn, nhưng bài NLVH 5 điểm bị
--       đếm ngang bài NLXH 2 điểm;
--     · PHẦN II chấm nhị phân cả câu, nên đúng 3/4 ý được 0 thay vì 0.5đ;
--     · một lượt thi toàn tự luận ra `total_score = 0.00`, và một đề Văn hỗn
--       hợp hiện 10.0/10 trên bài đáng 4.75/10.
--
--   - questions.points: điểm câu này đáng. MẶC ĐỊNH 1, và đó là điều kiện để
--     KHÔNG phải backfill bảng này: với đề thuần trắc nghiệm, tổng có trọng số
--     Σ(đúng×1)/Σ(1)×10 rút gọn về đúng công thức cũ, nên số cũ và số mới trùng
--     khít. CHECK > 0 vì một câu 0 điểm biến mất khỏi mẫu số trong im lặng.
--     Con số và lý do khai ở lib/scoring/questionPoints.ts.
--
--   - exam_results.total_score_legacy: ảnh chụp `total_score` theo luật CŨ, ghi
--     đúng một lần bởi script backfill TRƯỚC khi nó ghi đè. Nullable, row mới
--     để null — nó không phải một cột song song của total_score, nó là ĐƯỜNG
--     LUI. Backfill là thao tác một chiều trên điểm của học sinh thật; không có
--     cột này thì một ca biên tính sai là không có đường về.
-- ----------------------------------------------------------------------------
alter table public.questions add column if not exists points numeric not null default 1;
alter table public.questions drop constraint if exists questions_points_check;
alter table public.questions add constraint questions_points_check check (points > 0);

-- ----------------------------------------------------------------------------
-- 8e-bis. `points` NULLABLE — "đề không in điểm" phải nói được (2026-09-02).
--
--   `not null default 1` ở trên đúng cho việc nó được viết ra: row CŨ tự đúng,
--   không backfill. Nhưng nó không để lại chỗ nào cho "chưa biết", trong khi
--   CẢ HAI đầu đọc đã sẵn sàng cho null từ B1: `fromRows` quy giá trị không
--   phải số về undefined, và `maxPointsOf` quy về DEFAULT_QUESTION_POINTS. Chỉ
--   riêng cột là chưa.
--
--   Cái giá của khoảng trống đó, đo trên đề thật: đề Ngữ văn 10 cuối kì II
--   (THPT Nguyễn Quốc Trinh) in điểm ở phần Viết (2,0 + 4,0) và KHÔNG in ở 5
--   câu Đọc hiểu. PostgREST gom mảng row thành một INSERT có danh sách cột
--   chung, nên 5 câu kia nhận NULL vào cột `not null` → 23502 → cả lượt upload
--   hỏng với "Could not save the questions". Đề TRỘN hai loại là ca thường gặp
--   của mọi đề tự luận, không phải ca biên.
--
--   DROP NOT NULL, GIỮ DEFAULT 1. Giữ default là điều kiện để bản vá này không
--   chạm vào ai khác: mọi chỗ insert mà KHÔNG khai cột (seed.ts, fixture test)
--   vẫn nhận 1 y như trước; chỉ khoá khai TƯỜNG MINH null mới ra null. Row đã
--   tồn tại không đổi một giá trị nào — AC-012 (lượt thi cũ chấm lại ra đúng số
--   cũ) giữ nguyên.
--
--   `questions_points_check` không cần sửa: trong Postgres, CHECK trả NULL là
--   THOẢ, nên `points > 0` vẫn chặn 0 và số âm mà vẫn cho null đi qua.
--
--   Đề PUBLISHED không bao giờ mang null: validatePointsForPublish bắt mọi câu
--   phải có điểm > 0 và tổng đủ 10 trước khi cho publish.
-- ----------------------------------------------------------------------------
alter table public.questions alter column points drop not null;

alter table public.exam_results add column if not exists total_score_legacy numeric;

-- ----------------------------------------------------------------------------
-- 9. BACKFILL — CUỐI CÙNG: seed cũ (không tác giả) → published
-- ----------------------------------------------------------------------------
update public.exams
   set status = 'published'
 where author_id is null
   and status is distinct from 'published';
-- questions defaults (question_type='mcq', image_url=null, essay_answer=null)
-- không cần backfill.
-- v2.1: part_number default 1 / sub_answers null / exams.parts null — row cũ
-- (seed + UGC v2.0) tự đúng, không cần backfill (AC-033).

-- ============================================================================
-- Exam Difficulty Rating (ADR-0008, Backend Design Doc) — 1 rating / user / đề,
-- SỬA ĐƯỢC (upsert). Idempotent. KHÔNG cột trên exams, KHÔNG trigger, KHÔNG backfill.
-- Mô phỏng shape exam_reports; khác biệt: có update-own (rating sửa được) + 3 điểm phần.
-- ============================================================================
create table if not exists public.exam_difficulty_ratings (
  id          uuid primary key default gen_random_uuid(),
  exam_id     text not null references public.exams(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  score_part1 int not null,                       -- Phần I  (mcq)          1..5 sao
  score_part2 int not null,                       -- Phần II (true_false)   1..5 sao
  score_part3 int not null,                       -- Phần III(short_answer) 1..5 sao
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (exam_id, user_id)                        -- 1 rating / user / đề (upsert khoá)
);

-- Mỗi điểm phần là số SAO nguyên trong [1,5] (AC-002). Một CHECK gộp cả 3 cột.
-- Thang cũ là [1,10]; khi thu về [1,5] phải QUY ĐỔI dữ liệu có sẵn TRƯỚC khi
-- siết CHECK, nếu không lệnh add constraint sẽ bị chính các dòng cũ chặn lại.
-- ceil(n/2) giữ nguyên thứ tự khó/dễ và không tạo ra giá trị 0.
update public.exam_difficulty_ratings
set score_part1 = ceil(score_part1 / 2.0),
    score_part2 = ceil(score_part2 / 2.0),
    score_part3 = ceil(score_part3 / 2.0)
where score_part1 > 5 or score_part2 > 5 or score_part3 > 5;

alter table public.exam_difficulty_ratings drop constraint if exists ratings_scores_range_check;
alter table public.exam_difficulty_ratings add constraint ratings_scores_range_check
  check (
    score_part1 between 1 and 5
    and score_part2 between 1 and 5
    and score_part3 between 1 and 5
  );

-- RLS: mỗi write policy AND 3 điều kiện — (a) user_id = auth.uid(); (b) đề đã
-- published (EXISTS, tiền lệ reports_insert_own); (c) đã có attempt 'submitted'
-- (EXISTS cross-table, tiền lệ answers_insert_own). Khác biệt chủ đích so với
-- exam_reports (không có update-own): rating SỬA ĐƯỢC (upsert) nên cần cả
-- insert-own VÀ update-own VÀ select-own.
alter table public.exam_difficulty_ratings enable row level security;

-- INSERT: chỉ chủ nhân + đề published + đã có attempt 'submitted' (eligibility).
drop policy if exists "ratings_insert_own" on public.exam_difficulty_ratings;
create policy "ratings_insert_own" on public.exam_difficulty_ratings
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exams e
      where e.id = exam_difficulty_ratings.exam_id and e.status = 'published'
    )
    and exists (
      select 1 from public.exam_attempts a
      where a.exam_id = exam_difficulty_ratings.exam_id
        and a.user_id = auth.uid()
        and a.status = 'submitted'
    )
  );

-- UPDATE (upsert path): USING chọn row của mình; WITH CHECK giữ nguyên 3 điều kiện
-- (chủ nhân + published + eligibility) cho row kết quả.
drop policy if exists "ratings_update_own" on public.exam_difficulty_ratings;
create policy "ratings_update_own" on public.exam_difficulty_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exams e
      where e.id = exam_difficulty_ratings.exam_id and e.status = 'published'
    )
    and exists (
      select 1 from public.exam_attempts a
      where a.exam_id = exam_difficulty_ratings.exam_id
        and a.user_id = auth.uid()
        and a.status = 'submitted'
    )
  );

-- SELECT = chỉ rating của mình (cho prefill "đã đánh giá" — AC-013). Aggregate
-- toàn cục KHÔNG đọc qua policy này mà qua view (definer) — xem view bên dưới.
drop policy if exists "ratings_select_own" on public.exam_difficulty_ratings;
create policy "ratings_select_own" on public.exam_difficulty_ratings
  for select to authenticated using (user_id = auth.uid());

-- View đọc: exams.* + rating_count + avg_overall (NULL khi < 3 rating).
-- Encoding NULL-dưới-ngưỡng cho phép nulls-last order + lọc bucket qua toán tử
-- PostgREST thường, KHÔNG cần HAVING/RPC. Ngưỡng N=3 nằm ở ĐÂY (SQL) và ở
-- SOURCE/lib/rating (TS, RATING_THRESHOLD) — giữ đồng bộ bằng test (không có
-- hằng số vật lý chung băng qua ranh giới SQL/TS). Số '3' dưới đây là bản sao
-- SQL của RATING_THRESHOLD.
--
-- ⚠ DROP TRƯỚC, KHÔNG PHẢI `create or replace` MỘT MÌNH — và đây là lỗi đã gây
-- sập dev thật (2026-09-01, PostgreSQL 42703 trên mọi trang đọc danh sách đề).
--
-- `select e.*` được BUNG RA VÀ ĐÓNG BĂNG lúc view được tạo. Thêm một cột vào
-- `exams` sau đó KHÔNG làm view mọc thêm cột; view cứ giữ danh sách cũ, và mọi
-- truy vấn xin cột mới qua view đều 42703 "column does not exist" — trong khi
-- `\d exams` cho thấy cột nằm ngay đó. Đúng vết này: §8d thêm `exams.passages`,
-- app đọc `passages` qua view, mọi trang /exams, chi tiết đề và lịch sử chết.
--
-- `create or replace view` KHÔNG cứu được: nó chỉ cho phép THÊM cột vào CUỐI
-- danh sách. Cột mới của `e.*` chèn vào TRƯỚC rating_count/avg_overall, nên
-- Postgres đọc ra là "đổi tên cột thứ 18 từ rating_count thành passages" và từ
-- chối với 42P16. Drop rồi tạo lại là cách DUY NHẤT, và để nó ở đây khiến
-- schema.sql chạy lại được trên một DB cũ bất kỳ thay vì gãy giữa chừng.
--
-- An toàn khi drop: không object nào phụ thuộc view này (đã soi pg_depend trên
-- dev — 0 dependent), và quyền đọc của anon/authenticated đến từ
-- `alter default privileges` sẵn có của Supabase nên view mới tự có lại (§10b
-- giải thích cùng cơ chế đó cho function).
drop view if exists public.exams_with_difficulty;
create or replace view public.exams_with_difficulty as
select
  e.*,
  coalesce(agg.rating_count, 0) as rating_count,
  case when coalesce(agg.rating_count, 0) >= 3 then agg.avg_overall end as avg_overall
from public.exams e
left join (
  select
    exam_id,
    count(*) as rating_count,
    -- overall mỗi user = mean 3 phần; community = mean các overall.
    avg((score_part1 + score_part2 + score_part3) / 3.0) as avg_overall
  from public.exam_difficulty_ratings
  group by exam_id
) agg on agg.exam_id = e.id;

-- ----------------------------------------------------------------------------
-- 9b. Skill Taxonomy (Engine 1 Adaptive AI & Feedback, PRD R1/R2, D1) — Math
--     only. Nodes + prerequisite edges (DAG); reviewed by the engineer before
--     ship (A2), not authored here. questions.skill_node_id is nullable —
--     a question may legitimately have no skill (D2: NULL instead of a
--     guess). Placed HERE (before §10, not appended at the end) because §10c
--     below is edited in place to grant skill_node_id, and that edit needs
--     the column to already exist earlier in the file's execution order.
-- ----------------------------------------------------------------------------
create table if not exists public.skill_nodes (
  id         text primary key,           -- slug, vd 'luy-thua', 'logarit'
  label_vi   text not null,               -- nhãn tiếng Việt hiển thị (AC-004)
  created_at timestamptz not null default now()
);

create table if not exists public.skill_prerequisites (
  skill_node_id        text not null references public.skill_nodes(id) on delete cascade,
  prerequisite_node_id text not null references public.skill_nodes(id) on delete cascade,
  primary key (skill_node_id, prerequisite_node_id)
);
alter table public.skill_prerequisites drop constraint if exists skill_prerequisites_no_self_check;
alter table public.skill_prerequisites add constraint skill_prerequisites_no_self_check
  check (skill_node_id <> prerequisite_node_id);

alter table public.questions add column if not exists skill_node_id text
  references public.skill_nodes(id) on delete set null;
-- `set null`: xoá một skill node không được kéo xoá câu hỏi theo — câu hỏi vẫn
-- hợp lệ, chỉ mất tag (giống questions.correct_answer nullable đã xử lý case
-- "chưa đủ dữ liệu" bằng nullable thay vì xoá dòng).

alter table public.skill_nodes enable row level security;
drop policy if exists "skill_nodes_select_authenticated" on public.skill_nodes;
create policy "skill_nodes_select_authenticated" on public.skill_nodes
  for select to authenticated using (true);

alter table public.skill_prerequisites enable row level security;
drop policy if exists "skill_prerequisites_select_authenticated" on public.skill_prerequisites;
create policy "skill_prerequisites_select_authenticated" on public.skill_prerequisites
  for select to authenticated using (true);
-- Không có policy ghi cho client — tiền lệ "Seeded content" (§5 comment cũ):
-- taxonomy do kỹ sư duyệt rồi seed qua service_role (seedSkillTaxonomy.ts),
-- không phải nội dung người dùng ghi qua app.

-- ============================================================================
-- ANSWER-KEY COLUMN LOCKDOWN (Security review 2026-08-03, Critical #1)
--
-- VẤN ĐỀ: RLS lọc DÒNG, không lọc CỘT. `questions_select_visible` cho mọi
-- authenticated user đọc câu hỏi của đề published — tức là CẢ DÒNG, gồm
-- correct_answer / sub_answers / essay_answer. Việc app code không select
-- 3 cột đó (getExamForPlayer) chỉ là kỷ luật application-code: Supabase phơi
-- REST API thẳng ra browser, nên `GET /rest/v1/questions?select=correct_answer`
-- bằng chính JWT của học sinh vẫn lấy được toàn bộ đáp án trước khi nộp bài.
-- Trước đây được ghi nhận là technical debt (PROCESS.md) — nay đóng lại.
--
-- CÁCH ĐÓNG: quyền cột (GRANT/REVOKE), tầng NGANG HÀNG với RLS chứ không phải
-- application-code. `authenticated`/`anon` mất SELECT ở mức bảng và chỉ được
-- cấp lại 9 cột an toàn; 3 cột đáp án CHỈ ra khỏi DB qua 2 hàm SECURITY DEFINER
-- dưới đây, mỗi hàm tự kiểm tra quyền của người gọi.
--
-- ⚠ HỆ QUẢ BẢO TRÌ (fail-closed, chủ đích): quyền cột KHÔNG tự áp cho cột mới.
-- Thêm cột vào public.questions sau này ⇒ phải thêm nó vào GRANT ở cuối khối
-- này (nếu an toàn) hoặc vào RETURNS TABLE của exam_answer_key (nếu là đáp án),
-- nếu không PostgREST trả 42501 "permission denied for table questions".
-- `npm run verify:schema` bắt đúng trường hợp này (đọc danh sách cột THẬT từ DB
-- rồi đối chiếu với 2 danh sách trong chính khối này) — chạy nó sau khi apply.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 10a. exam_answer_key(exam_id) — MỘT nơi duy nhất định nghĩa "ai được xem đáp
--      án": tác giả của đề, HOẶC người đã có attempt 'submitted' trên đề đó
--      (màn Chi tiết sau khi nộp). Người đang làm bài dở KHÔNG khớp nhánh nào.
--
--      SECURITY DEFINER: chạy dưới quyền owner (postgres) nên vượt qua được
--      REVOKE cột ở 10c. Điều kiện WHERE bên dưới là gate thật, KHÔNG dựa vào
--      RLS — hàm vẫn đúng kể cả khi owner không bypass RLS (2 nhánh entitlement
--      là tập con của questions_select_visible).
--
--      drop-then-create (không phải `create or replace`) để idempotent kể cả
--      khi RETURNS TABLE đổi shape.
-- ----------------------------------------------------------------------------
drop function if exists public.exam_answer_key(text);
create function public.exam_answer_key(p_exam_id text)
returns table (
  id             text,
  content        text,
  choices        jsonb,
  correct_answer text,
  subject        text,
  grade          int,
  topic          text,
  question_type  text,
  part_number    int,
  image_url      text,
  sub_answers    jsonb,
  essay_answer   text,
  -- A1: màn review của tác giả VÀ màn Chi tiết sau khi nộp đều dựng lại câu
  -- hỏi từ hàm này, nên khoá ngữ liệu phải đi kèm — thiếu nó thì bài đọc chung
  -- biến mất ở đúng hai surface cần đọc lại đề.
  passage_id     text,
  points         numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.content, q.choices, q.correct_answer,
         q.subject, q.grade, q.topic, q.question_type,
         q.part_number, q.image_url, q.sub_answers, q.essay_answer,
         q.passage_id, q.points
    from public.exams e
    join public.questions q on q.id = any(e.question_ids)
   where e.id = p_exam_id
     and (
       -- (1) Tác giả: mọi status (màn review/save/publish S-03 của Layer 4).
       e.author_id = auth.uid()
       -- (2) Đã nộp bài đề ĐÃ PUBLISHED: màn Chi tiết được xem đáp án.
       --     `e.status = 'published'` KHÔNG thừa: hàm là SECURITY DEFINER nên
       --     RLS exams_select_visible không còn che chắn ở đây, mà attempt thì
       --     tạo được trên đề bất kỳ (attempts_insert_own chỉ soi user_id, và
       --     startAttempt chưa gate published — security review 2026-08-03 Low).
       --     Thiếu dòng này thì "tạo attempt trên đề nháp của người khác rồi
       --     claim" sẽ đọc được đáp án bản nháp. Hai nhánh cộng lại đúng bằng
       --     điều kiện của exams_select_visible.
       or (
         e.status = 'published'
         and exists (
           select 1 from public.exam_attempts a
            where a.exam_id = e.id
              and a.user_id = auth.uid()
              and a.status = 'submitted'
         )
       )
     )
   order by q.id;
$$;

-- ----------------------------------------------------------------------------
-- 10b. claim_attempt_answer_key(attempt_id) — đường DUY NHẤT lấy đáp án khi
--      đang chấm bài (submitExam). KHÓA attempt trước, trả đáp án sau, trong
--      cùng một transaction:
--
--        gọi được ⇒ attempt đã bị đóng ⇒ đáp án không còn dùng để gian lận.
--
--      Đây là lý do submitExam an toàn dù chạy bằng chính JWT của học sinh:
--      gọi thẳng RPC này từ devtools chỉ tự nộp bài sớm cho chính mình, không
--      lấy được đáp án của một attempt còn mở.
--
--      Nhánh 2 (attempt đã 'submitted' nhưng chưa có exam_results) cố ý cho
--      đọc lại: không lộ thêm gì (đã submitted thì 10a nhánh (2) cũng cho đọc),
--      nhưng giúp submitExam chấm lại được nếu lần trước lỗi giữa chừng.
-- ----------------------------------------------------------------------------
drop function if exists public.claim_attempt_answer_key(uuid);
create function public.claim_attempt_answer_key(p_attempt_id uuid)
returns table (
  id             text,
  content        text,
  choices        jsonb,
  correct_answer text,
  subject        text,
  grade          int,
  topic          text,
  question_type  text,
  part_number    int,
  image_url      text,
  sub_answers    jsonb,
  essay_answer   text,
  -- ⚠ HAI CỘT NÀY PHẢI KHỚP `exam_answer_key()` TỪNG CỘT MỘT ⚠
  -- Thân hàm uỷ quyền bằng `return query select * from public.exam_answer_key(…)`,
  -- nên lệch một cột là Postgres từ chối hàm LÚC CHẠY ("structure of query does
  -- not match function result type") — và đây là đường DUY NHẤT `submitExam()`
  -- lấy đáp án để chấm, tức cả tính năng nộp bài chết. Không cổng nào của repo
  -- bắt được lỗi này: tsc/vitest không đọc SQL, verify:schema chỉ soi danh sách
  -- cột được GRANT. Thêm cột vào 10a thì thêm luôn ở đây.
  passage_id     text,
  points         numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_exam_id text;
begin
  -- Khóa attempt (chỉ của chính mình, chỉ khi còn 'in_progress'). UPDATE có
  -- điều kiện = gate atomic: 2 lời gọi đồng thời thì chỉ 1 cái khóa được.
  update public.exam_attempts a
     set status       = 'submitted',
         submitted_at = coalesce(a.submitted_at, now())
   where a.id = p_attempt_id
     and a.user_id = auth.uid()
     and a.status = 'in_progress';

  -- Đọc lại trong cùng transaction: chỉ đi tiếp nếu attempt là của mình VÀ đã
  -- đóng (vừa khóa ở trên, hoặc đã submitted từ trước).
  select a.exam_id into v_exam_id
    from public.exam_attempts a
   where a.id = p_attempt_id
     and a.user_id = auth.uid()
     and a.status = 'submitted';
  if v_exam_id is null then
    return;   -- không phải attempt của mình / không tồn tại → 0 dòng
  end if;

  -- Uỷ quyền cho 10a: entitlement "đã có submitted attempt" giờ đã thỏa.
  return query select * from public.exam_answer_key(v_exam_id);
end;
$$;

-- Chỉ user đã đăng nhập gọi được.
--
-- ⚠ `revoke ... from public` MỘT MÌNH LÀ KHÔNG ĐỦ trên Supabase (phát hiện
-- 2026-08-03 khi probe DB thật). Supabase có sẵn
--   alter default privileges in schema public grant all on functions
--     to anon, authenticated, service_role;
-- nên mọi hàm vừa tạo trong schema `public` ĐÃ được cấp EXECUTE TƯỜNG MINH cho
-- 3 role đó. `revoke from public` chỉ gỡ quyền ngầm của PUBLIC, không đụng tới
-- các grant tường minh kia — hàm vẫn gọi được bằng anon key.
-- ⇒ Phải revoke ĐÍCH DANH từng role. Áp dụng cho MỌI hàm thêm vào sau này.
revoke all on function public.exam_answer_key(text)            from public, anon;
revoke all on function public.claim_attempt_answer_key(uuid)   from public, anon;
grant execute on function public.exam_answer_key(text)          to authenticated;
grant execute on function public.claim_attempt_answer_key(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 10c. Thu hồi SELECT mức BẢNG rồi cấp lại đúng danh sách cột an toàn.
--      Bắt buộc theo thứ tự này: quyền mức bảng phủ mọi cột, nên chỉ
--      `revoke select (correct_answer, ...)` là KHÔNG có tác dụng.
--      `anon` giữ nguyên 9 cột an toàn (RLS `to authenticated` vẫn cho 0 dòng)
--      để hành vi quan sát được của khách vãng lai không đổi: rỗng, không lỗi.
--      INSERT/UPDATE/DELETE KHÔNG đụng tới — tác giả vẫn ghi đáp án đề của
--      mình, RLS questions_*_author giới hạn phạm vi (ghi không đọc được).
-- ----------------------------------------------------------------------------
revoke select on public.questions from anon, authenticated;
-- `passage_id` (A1) nằm trong nhóm an toàn: nó là KHOÁ TRA ngữ liệu dùng chung,
-- không phải nội dung đáp án — player phải đọc được nó mới biết câu này thuộc
-- bài đọc nào trong exams.passages.
--
-- ⚠ ĐỪNG viết chú thích BÊN TRONG cặp ngoặc dưới đây: verify-schema.ts lấy danh
-- sách cột bằng một regex rồi split theo dấu phẩy và KHÔNG bóc comment, nên mỗi
-- dòng `--` lọt vào trong ngoặc sẽ bị đọc thành một tên cột và cổng đỏ với
-- "GRANT nhắc tới cột không tồn tại".
grant select (
  id, content, choices, subject, grade, topic, question_type, part_number, image_url, skill_node_id,
  passage_id, points
) on public.questions to anon, authenticated;

-- ============================================================================
-- SCORE WRITE LOCKDOWN (Security review 2026-08-03, Critical #2)
--
-- VẤN ĐỀ: `results_insert_own` chỉ check `user_id = auth.uid()`. DB không hề
-- kiểm tra attempt có phải của user, có đã nộp chưa, và điểm có đúng bằng cái
-- computeScore tính ra không. Hai đường lạm dụng:
--   (1) Tự bịa điểm: POST /rest/v1/exam_results {total_score: 10, ...}.
--   (2) Chiếm chỗ attempt NGƯỜI KHÁC: attempt_id là UNIQUE, nên ghi một dòng
--       trỏ vào attempt của nạn nhân sẽ làm lần nộp bài thật của họ chết vì
--       23505 — attempt hỏng vĩnh viễn. (Khó khai thác vì attempt_id là UUID
--       không đoán được, nhưng vẫn là lỗ hổng của cùng một policy.)
--
-- CÁCH ĐÓNG: client MẤT HẲN quyền ghi. Vì sao không siết policy cho xong: chấm
-- điểm nằm ở computeScore (TypeScript) — chuẩn hoá NFC, so khớp số kiểu Việt,
-- codec Đ/S — và submitExam kết nối Postgres BẰNG CHÍNH JWT của học sinh, nên
-- DB không phân biệt được "server của mình" với "devtools của học sinh". Chỉ có
-- hai lối thoát: chép luật chấm điểm sang SQL (hai bản, lệch nhau = sai điểm
-- thật), hoặc cho việc ghi điểm đi bằng một danh tính khác. Chọn cách hai.
--
-- Ghi điểm nay chỉ đi qua record_exam_result() và CHỈ service_role gọi được
-- (SOURCE/lib/supabase/service-role.ts, server-only).
--
-- ⚠ SỬA ĐỔI, ĐỌC KÈM: khối "ESSAY GRADE WRITE" NGAY SAU §11b (ADR-0018) là
-- NGOẠI LỆ ĐẦU TIÊN của cách đọc mạnh "dòng exam_results không bao giờ đổi sau
-- khi insert". Điều §11 tuyên bố ở trên vẫn nguyên vẹn — KHÔNG client nào ghi
-- được vào exam_results bằng bất kỳ đường nào, và không writer nào ngoài
-- service_role tồn tại — nhưng band tự luận được ghi ĐÈ TẠI CHỖ vào đúng một
-- phần tử của per_question, bởi hai hàm đặc quyền nữa. Đọc khối đó trước khi
-- kết luận bất cứ điều gì về tính bất biến của một dòng kết quả.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 11a. Thu hồi mọi quyền GHI của client trên exam_results.
--      SELECT giữ nguyên — results_select_own vẫn phục vụ Result/History/
--      Analytics. UPDATE/DELETE trước nay đã bị RLS chặn (không có policy nào),
--      nhưng quyền bảng thì vẫn còn; thu hồi luôn để không phải dựa vào
--      "tình cờ chưa ai viết policy".
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.exam_results from anon, authenticated;

-- Policy insert vẫn giữ và được siết lại — nó KHÔNG còn với tới được (đã mất
-- quyền INSERT), nhưng là lớp thứ hai: nếu sau này ai đó lỡ `grant all` trên
-- schema public (Supabase dashboard hay quen tay), policy này vẫn chặn hai
-- đường lạm dụng ở trên. Hai thứ phải cùng sai thì học sinh mới ghi được điểm.
drop policy if exists "results_insert_own" on public.exam_results;
create policy "results_insert_own" on public.exam_results
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exam_attempts a
      where a.id = exam_results.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'submitted'
    )
  );

-- ----------------------------------------------------------------------------
-- 11a-bis. overtime_seconds (Security review Medium #6 — timer server-side).
--   Đặt Ở ĐÂY chứ không ở cuối file vì record_exam_result() ngay bên dưới ghi
--   vào cột này; file chạy tuần tự nên cột phải có trước hàm.
--   0 = nộp trong thời gian cho phép. >0 = số giây vượt quá
--   (started_at + duration_minutes). Do DB tự tính, client không khai được.
--   Đồng hồ ở ExamPlayer vẫn auto-submit khi về 0 (PA A) — đó là UX; cột này
--   là bản ghi sự thật cho trường hợp tắt JS / sửa client để làm quá giờ.
-- ----------------------------------------------------------------------------
alter table public.exam_results
  add column if not exists overtime_seconds int not null default 0;

-- ----------------------------------------------------------------------------
-- 11b. record_exam_result() — đường DUY NHẤT ghi được điểm.
--
--      CỐ Ý KHÔNG phải SECURITY DEFINER. service_role vốn đã bypass RLS và còn
--      nguyên quyền INSERT (11a chỉ thu hồi của anon/authenticated), nên hàm
--      chạy được với quyền của chính người gọi. Giữ INVOKER để phòng thủ theo
--      lớp: lỡ ai đó `grant execute ... to authenticated` thì học sinh VẪN
--      không ghi được, vì còn thiếu quyền INSERT ở 11a. Phải hỏng cả hai chỗ.
--
--      user_id KHÔNG nhận từ tham số mà SUY RA từ attempt — người gọi không thể
--      ghi điểm cho tài khoản khác dù có muốn. Cột user_id có `default
--      auth.uid()`, nhưng dưới service_role auth.uid() là NULL, nên bắt buộc
--      phải truyền tường minh; suy ra từ attempt là cách vừa đúng vừa an toàn.
--
--      Trùng attempt_id → 23505 từ UNIQUE, không nuốt lỗi: submitExam đã có
--      nhánh idempotent riêng cho "đã nộp rồi" trước khi tới đây.
-- ----------------------------------------------------------------------------
drop function if exists public.record_exam_result(uuid, numeric, int, int, jsonb, jsonb);
create function public.record_exam_result(
  p_attempt_id      uuid,
  p_total_score     numeric,
  p_correct         int,
  p_total           int,
  p_per_question    jsonb,
  p_topic_breakdown jsonb
)
returns void
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_user_id  uuid;
  v_overtime int;
begin
  -- Chủ nhân của attempt = chủ nhân của điểm. Đồng thời cưỡng chế "đã nộp":
  -- điểm chỉ tồn tại cho attempt đã đóng (claim_attempt_answer_key §10b đóng nó).
  --
  -- overtime_seconds (§13, Medium #6) tính LUÔN TẠI ĐÂY, từ started_at +
  -- duration_minutes của chính DB — KHÔNG nhận từ tham số, cùng lý do với
  -- user_id: người gọi không được phép tự khai mình nộp đúng giờ. Đồng hồ đếm
  -- ngược ở client chỉ là UX; đây mới là chỗ duy nhất phán quyết.
  select
    a.user_id,
    greatest(
      0,
      ceil(extract(epoch from
        coalesce(a.submitted_at, now()) - (a.started_at + make_interval(mins => e.duration_minutes))
      ))
    )::int
  into v_user_id, v_overtime
    from public.exam_attempts a
    join public.exams e on e.id = a.exam_id
   where a.id = p_attempt_id
     and a.status = 'submitted';

  if v_user_id is null then
    raise exception 'record_exam_result: attempt % không tồn tại hoặc chưa submitted', p_attempt_id
      using errcode = 'check_violation';
  end if;

  insert into public.exam_results
    (attempt_id, user_id, total_score, correct, total, per_question, topic_breakdown, overtime_seconds)
  values
    (p_attempt_id, v_user_id, p_total_score, p_correct, p_total, p_per_question, p_topic_breakdown, v_overtime);
end;
$$;

-- Revoke ĐÍCH DANH anon + authenticated, không chỉ PUBLIC — xem ghi chú dài ở
-- cuối §10b về default privileges của Supabase. Thiếu dòng này thì học sinh vẫn
-- GỌI được hàm (chỉ chết ở INSERT bên trong nhờ §11a), tức lớp phòng thủ thứ
-- hai coi như không có.
revoke all on function public.record_exam_result(uuid, numeric, int, int, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_exam_result(uuid, numeric, int, int, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- ESSAY GRADE WRITE (Essay Auto-Scoring, ADR-0018, PRD C1/W2/W4)
--
-- ĐÂY LÀ NGOẠI LỆ ĐẦU TIÊN của tính chất "exam_results không đổi sau khi
-- insert" mà §11 dựng lên. §11 vẫn đúng ở dạng nó tuyên bố — KHÔNG client nào
-- ghi được vào exam_results bằng bất kỳ đường nào, và không writer nào ngoài
-- service_role tồn tại. Cái không còn đúng là cách đọc mạnh hơn, không thành
-- văn: "dòng không bao giờ đổi sau khi insert". Ba bề mặt phải tôn trọng điều
-- đó (ADR-0018 § Amendment to ADR-0010): xuất PDF bị chặn khi còn câu chưa
-- giải quyết, ScoreCard/history hiện dấu "đang chấm" thay vì một con số sắp
-- đổi, và bất kỳ lượt cache dòng kết quả nào trong tương lai phải khoá theo
-- một thứ dịch chuyển khi band đáp xuống (hôm nay CHƯA có cache nào).
--
-- HAI hàm chứ không một, và claim CHẠY TRƯỚC settle: một pass bị cắt ngang
-- KHÔNG ghi gì cả (after() chết cùng invocation, không cron, không queue), nên
-- một bộ đếm tăng lúc GHI sẽ không bao giờ đếm được lượt bị bỏ dở — và trần 3
-- lượt của AC-064 sẽ hỏng đúng ở tình huống nó tồn tại để xử: một học sinh
-- nhìn "đang chấm" đứng im và bấm chấm lại. Vậy nên lượt bị TIÊU LÚC CLAIM.
--
-- CẢ HAI đều KHÔNG PHẢI SECURITY DEFINER, cùng lý do với record_exam_result()
-- (§11b): service_role vốn đã bypass RLS và còn nguyên quyền UPDATE (§11a chỉ
-- thu hồi của anon/authenticated), nên INVOKER chạy đúng. Giữ INVOKER nghĩa là
-- phải hỏng CẢ HAI chỗ mới thủng: ai đó vừa `grant execute ... to
-- authenticated`, vừa `grant update on exam_results to authenticated`.
--
-- CẢ HAI đều KHÔNG nhận user_id: quyền sở hữu suy ra từ attempt bên trong SQL,
-- nên một call site sai vẫn không dịch nổi điểm của học sinh khác.
--
-- UPDATE bó vào ĐÚNG cột per_question và ĐÚNG một phần tử. total_score,
-- correct, total, topic_breakdown, overtime_seconds KHÔNG xuất hiện ở bất kỳ
-- đâu trong hai thân hàm dưới đây — đó là thứ giữ AC-009 và W8 đúng BẰNG CẤU
-- TRÚC chứ không bằng kỷ luật: không câu lệnh nào trong repo dịch nổi bộ ba
-- điểm cũ sau khi nó đã được insert.
--
-- `order by ord` trong jsonb_agg là BẮT BUỘC, không phải trang trí: per_question
-- là một MẢNG mà thứ tự chính là thứ tự câu trong đề, và mọi bề mặt kết quả
-- render theo thứ tự đó. Thiếu `order by`, Postgres được phép trả về một mảng
-- xếp khác, và toàn bộ đề bị xáo trộn NGAY LẦN ĐẦU một câu tự luận được chấm —
-- một khuyết tật mà mọi test kiểu "band đã đáp xuống chưa" đều xanh.
--
-- KHÔNG hàm nào kiểm giá trị band. Tập đóng {0, 0.25, 0.5, 0.75, 1} được khai
-- MỘT LẦN, trong TypeScript (lib/scoring/essayLifecycle.ts), và một mệnh đề
-- `p_earned in (...)` ở đây sẽ là lời khai thứ hai của cùng một luật sản phẩm —
-- đúng bài toán hai-đồng-hồ mà §11 đã từ chối khi nó không chép computeScore
-- sang SQL. Cái SQL cưỡng chế là những thứ KHÔNG có bản sao TypeScript: quyền
-- sở hữu, 'submitted', sự tồn tại của phần tử, tính hợp lệ của chuyển trạng
-- thái, trần lượt, và thứ tự mảng. Mỗi cái là một sự thật về DÒNG, không phải
-- về ĐIỂM.
-- ============================================================================

drop function if exists public.claim_essay_grading_attempt(uuid, text);
create function public.claim_essay_grading_attempt(
  p_attempt_id  uuid,
  p_question_id text
)
returns table (claimed boolean, attempts int, reason text)
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_user_id  uuid;
  v_element  jsonb;
  v_state    text;
  v_attempts int;
begin
  -- Cùng cưỡng chế với record_exam_result()/record_skill_mastery(): chủ nhân
  -- suy ra từ attempt, và attempt phải đã đóng. Người gọi không tự khai được.
  select a.user_id into v_user_id
    from public.exam_attempts a
   where a.id = p_attempt_id
     and a.status = 'submitted';

  if v_user_id is null then
    return query select false, 0, 'not_submitted'::text;
    return;
  end if;

  -- Phần tử phải TỒN TẠI và phải MANG khoá vòng đời. Thiếu khoá nghĩa là câu
  -- này không phải câu tự luận chấm được (row cũ, thiếu ground truth, hoặc
  -- tính năng đang tắt lúc nộp) — một lượt claim ở đó là một lời gọi sai.
  select pq into v_element
    from public.exam_results r,
         lateral jsonb_array_elements(r.per_question) pq
   where r.attempt_id = p_attempt_id
     and pq->>'questionId' = p_question_id
     and pq ? 'essayState'
   limit 1;

  if v_element is null then
    return query select false, 0, 'no_element'::text;
    return;
  end if;

  v_state    := v_element->>'essayState';
  v_attempts := coalesce((v_element->>'essayAttempts')::int, 0);

  -- 'graded' hấp thụ: kiểm TRƯỚC trần lượt, vì một câu đã có band là no-op bất
  -- kể còn bao nhiêu lượt (AC-063), và người gọi cần phân biệt được hai ca đó.
  if v_state = 'graded' then
    return query select false, v_attempts, 'already_graded'::text;
    return;
  end if;

  if v_state not in ('pending', 'failed') then
    return query select false, v_attempts, 'bad_state'::text;
    return;
  end if;

  -- Trần lượt (AC-064). Con số 3 khai ở TypeScript
  -- (ESSAY_MAX_ATTEMPTS, lib/scoring/essayLifecycle.ts) và literal ở đây bị
  -- GHIM VÀO NÓ bởi npm run verify:schema — chữ ký hai tham số mà ADR-0018
  -- chốt không cho truyền trần vào, nên cặp lời-khai-đôi này không xoá được và
  -- được ghim bằng một cổng thay vì bằng hy vọng.
  if v_attempts >= 3 then
    return query select false, v_attempts, 'exhausted'::text;
    return;
  end if;

  update public.exam_results r
     set per_question = (
       select jsonb_agg(
                case
                  when e->>'questionId' = p_question_id and e ? 'essayState'
                  then e || jsonb_build_object('essayAttempts', v_attempts + 1)
                  else e
                end
                order by ord
              )
         from jsonb_array_elements(r.per_question) with ordinality as t(e, ord)
     )
   where r.attempt_id = p_attempt_id;

  return query select true, v_attempts + 1, 'ok'::text;
end;
$$;

-- Revoke ĐÍCH DANH anon + authenticated, không chỉ PUBLIC — xem ghi chú dài ở
-- cuối §10b về default privileges của Supabase. Thiếu dòng này thì học sinh vẫn
-- GỌI được hàm (chỉ chết ở UPDATE bên trong nhờ §11a), tức lớp phòng thủ thứ
-- hai coi như không có.
revoke all on function public.claim_essay_grading_attempt(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_essay_grading_attempt(uuid, text)
  to service_role;


drop function if exists public.record_essay_grade(uuid, text, text, numeric, numeric, boolean);
create function public.record_essay_grade(
  p_attempt_id     uuid,
  p_question_id    text,
  p_state          text,
  p_earned         numeric,
  p_max            numeric,
  p_low_confidence boolean
)
returns boolean
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_rows    int;
begin
  -- Chuyển trạng thái hợp lệ là một sự thật về DÒNG, nên nó được cưỡng chế ở
  -- đây. Giá trị BAND thì không — xem khối chú thích đầu mục.
  if p_state not in ('graded', 'failed') then
    raise exception 'record_essay_grade: p_state % không hợp lệ', p_state
      using errcode = 'check_violation';
  end if;

  select a.user_id into v_user_id
    from public.exam_attempts a
   where a.id = p_attempt_id
     and a.status = 'submitted';

  if v_user_id is null then
    raise exception 'record_essay_grade: attempt % không tồn tại hoặc chưa submitted', p_attempt_id
      using errcode = 'check_violation';
  end if;

  -- GHI-LẦN-ĐẦU-THẮNG là một vị từ trong CHÍNH câu lệnh này, không phải một
  -- lượt đọc-rồi-ghi ở TypeScript: một lượt chấm lại đua với pass gốc (đúng ca
  -- AC-063 mô tả) sẽ lọt qua cửa sổ giữa lượt đọc và lượt ghi. Tiền lệ trong
  -- repo là change_support_ticket_status(), dựng vì đúng lý do đó.
  --
  -- 'failed' KHÔNG được vị từ bảo vệ: một câu failed PHẢI trở thành graded được
  -- khi chấm lại. Chuyển hợp lệ: pending → graded|failed, failed → graded|failed.
  -- 'graded' là hấp thụ.
  --
  -- Trùng ⇒ 0 dòng ⇒ trả false. Đây là một GIÁ TRỊ TRẢ VỀ, không phải exception:
  -- một lượt ghi trùng bị từ chối là kết cục BÌNH THƯỜNG của cuộc đua, và nó
  -- KHÔNG BAO GIỜ được hiện ra cho học sinh (AC-062) — nó đi vào telemetry.
  --
  -- essayGradedAt lấy từ now() của DB, KHÔNG nhận từ tham số — cùng lý do
  -- record_exam_result() tự tính overtime_seconds (§11b): người gọi không được
  -- phép tự khai một dấu thời gian.
  update public.exam_results r
     set per_question = (
       select jsonb_agg(
                case
                  when e->>'questionId' = p_question_id and e ? 'essayState'
                  then e || jsonb_build_object(
                         'essayState',         p_state,
                         'essayEarned',        case when p_state = 'graded'
                                                    then to_jsonb(p_earned)
                                                    else 'null'::jsonb end,
                         'essayMax',           case when p_state = 'graded'
                                                    then to_jsonb(p_max)
                                                    else 'null'::jsonb end,
                         'essayLowConfidence', case when p_state = 'graded'
                                                    then to_jsonb(coalesce(p_low_confidence, false))
                                                    else to_jsonb(false) end,
                         'essayGradedAt',      to_jsonb(now()),
                         -- B3 — TỬ SỐ ĐIỂM của dòng này.
                         --
                         -- `essayEarned` là BAND (thang 0..1, thứ EssayScoreLine
                         -- hiển thị); `earnedPoints` là điểm THẬT của câu trong
                         -- thang của đề. Hai thứ khác nhau khi câu tự luận không
                         -- đáng đúng 1 điểm — bài NLVH 5 điểm với band 0.25 được
                         -- 1.25 điểm, không phải 0.25.
                         --
                         -- Nhân với `maxPoints` ĐÃ LƯU SẴN trên chính phần tử
                         -- (do computeScore() ghi lúc nộp) chứ không đọc lại
                         -- questions.points: tác giả sửa điểm câu SAU khi học
                         -- sinh nộp thì lượt thi đó vẫn phải được chấm theo đề
                         -- lúc họ làm. 'failed' ⇒ 0, không phải null: nó vẫn
                         -- chiếm chỗ trong mẫu số.
                         'earnedPoints',       case when p_state = 'graded'
                                                    then to_jsonb(
                                                           coalesce(p_earned, 0)
                                                           * coalesce((e->>'maxPoints')::numeric, 0)
                                                         )
                                                    else to_jsonb(0) end
                       )
                  else e
                end
                order by ord
              )
         from jsonb_array_elements(r.per_question) with ordinality as t(e, ord)
     )
   where r.attempt_id = p_attempt_id
     and exists (
       select 1
         from jsonb_array_elements(r.per_question) e
        where e->>'questionId' = p_question_id
          and e ? 'essayState'
          and e->>'essayState' <> 'graded'
     );

  get diagnostics v_rows = row_count;

  -- B3 — TÍNH LẠI `total_score` sau khi band đã vào `per_question`.
  --
  -- Trước bản này hàm chỉ đụng `per_question` và KHÔNG BAO GIỜ đụng
  -- `total_score` — đó chính là mấu chốt khiến điểm tự luận không bao giờ vào ô
  -- điểm lớn, dù nó vẫn được chấm.
  --
  -- ĐÂY KHÔNG PHẢI CHÉP LUẬT CHẤM ĐIỂM SANG SQL, và sự phân biệt đó là điều
  -- kiện để không tái phạm "hai chiếc đồng hồ" mà ADR-0010 đã từ chối: mọi QUY
  -- TẮC (đúng/sai, thang bậc PHẦN II, trọng số từng câu) đã được TypeScript
  -- quyết định và đóng băng thành `earnedPoints`/`maxPoints` trên từng phần tử.
  -- Câu lệnh dưới đây chỉ CỘNG hai cột số đã có sẵn rồi quy về thang 10 — nó
  -- không biết mcq khác true_false ở chỗ nào, và nó không cần biết.
  --
  -- Mẫu số 0 ⇒ giữ nguyên `total_score` cũ thay vì ghi 0: mẫu số rỗng nghĩa là
  -- lượt thi này không có dòng nào mang `maxPoints` (dòng ghi trước B1), và ghi
  -- 0 đè lên điểm thật của một lượt thi cũ là làm hỏng dữ liệu.
  -- CÂU TỰ LUẬN CHƯA `graded` ĐỨNG NGOÀI CẢ TỬ LẪN MẪU — AC-015.
  --
  -- Điều kiện lọc `not (e ? 'essayState') or e->>'essayState' = 'graded'` đọc
  -- là: "câu thường thì luôn tính; câu tự luận chỉ tính khi đã có band".
  --
  -- Vì sao KHÔNG để một câu `failed` cộng 0 vào tử và trọng số của nó vào mẫu:
  -- đó đúng là "con số 0 im lặng" mà AC-015 cấm, và `summariseEssays()` đã áp
  -- cùng quy tắc cho dòng hiển thị. Chấm hỏng là hỏng của HỆ THỐNG, không phải
  -- của học sinh — trừ điểm họ vì Groq trả 429 là bịa ra một bài làm kém.
  --
  -- `maxPoints` trên phần tử KHÔNG bị xoá khi failed, chỉ bị BỎ QUA lúc cộng.
  -- Đó là chủ đích: một lượt chấm lại thành công sau đó cần trọng số gốc để
  -- nhân band, và một `maxPoints` đã bị ghi 0 sẽ làm mọi lượt chấm lại ra 0.
  update public.exam_results r
     set total_score = round(sums.earned / sums.max * 10, 2)
    from (
      select
        coalesce(sum(coalesce((e->>'earnedPoints')::numeric, 0)), 0) as earned,
        coalesce(sum((e->>'maxPoints')::numeric), 0)                 as max
        from public.exam_results r2,
             jsonb_array_elements(r2.per_question) e
       where r2.attempt_id = p_attempt_id
         and e ? 'maxPoints'
         and (not (e ? 'essayState') or e->>'essayState' = 'graded')
    ) sums
   where r.attempt_id = p_attempt_id
     and sums.max > 0;

  return v_rows = 1;
end;
$$;

revoke all on function public.record_essay_grade(uuid, text, text, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.record_essay_grade(uuid, text, text, numeric, numeric, boolean)
  to service_role;

-- ============================================================================
-- VIEW RLS (Security review 2026-08-03, Medium #4 — thực đo ra thì NẶNG HƠN)
--
-- ĐO ĐƯỢC TRÊN DB THẬT 2026-08-03: view `exams_with_difficulty` được tạo qua
-- SQL Editor nên owner = postgres, mà Postgres mặc định chạy view bằng quyền
-- OWNER → RLS của `exams` KHÔNG ÁP DỤNG khi đọc qua view. Hệ quả đo được:
--   `GET /rest/v1/exams_with_difficulty?select=*` bằng ANON KEY, KHÔNG CẦN
--   ĐĂNG NHẬP, trả về toàn bộ đề — gồm cả bản nháp chưa published của người
--   khác, kèm title/author_id/question_file_path (đường dẫn file gốc trong
--   Storage). Review xếp Medium vì tưởng cần đăng nhập; thực tế không cần.
-- App không lộ ra vì listExams/getExam tự thêm .eq("status","published") —
-- lại đúng cái kiểu "chỉ application-code che chắn" mà §10 vừa dọn.
--
-- ⚠ KHÔNG chỉ `alter view ... set (security_invoker = true)` là xong.
-- View còn gộp `exam_difficulty_ratings`, mà policy `ratings_select_own` chỉ
-- cho đọc rating CỦA CHÍNH MÌNH. Bật invoker cho cả view thì subquery aggregate
-- cũng chạy dưới quyền người xem → rating_count/avg_overall chỉ còn đếm đúng 1
-- rating của chính họ. Community difficulty (ADR-0008) sẽ SAI TOÀN BỘ mà không
-- báo lỗi gì — đúng kiểu hỏng im lặng, và schema đã tự ghi chú điều này ở §
-- "SELECT = chỉ rating của mình… Aggregate toàn cục KHÔNG đọc qua policy này".
--
-- CÁCH LÀM: tách đôi theo đúng ranh giới nhạy cảm.
--   - Phần AGGREGATE (rating_count/avg_overall): không nhạy cảm (số đếm + trung
--     bình, không kèm ai chấm gì), cần toàn cục → hàm SECURITY DEFINER riêng.
--   - Phần đọc `exams`: chuyển sang security_invoker để RLS exams_select_visible
--     quay lại làm chủ, thay vì chép predicate của nó vào WHERE của view (chép
--     thì mỗi lần đổi policy là view lệch một lần, im lặng).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 12a. Aggregate rating — definer, toàn cục, KHÔNG kèm danh tính người đánh giá.
--      Chỉ trả về đề ĐÃ CÓ rating; mà muốn rating thì đề phải published
--      (ratings_insert_own), nên tập này vốn đã là dữ liệu catalog công khai.
-- ----------------------------------------------------------------------------
-- `create or replace`, KHÔNG phải drop-then-create như §10/§11 — khác biệt có
-- lý do: view exams_with_difficulty (12b) phụ thuộc hàm này, nên `drop function`
-- ở lần chạy THỨ HAI sẽ chết với
--   2BP01: cannot drop function ... because other objects depend on it
-- (đã xảy ra thật 2026-08-03). `create or replace` giữ nguyên dependency.
-- ⚠ Đánh đổi: nếu sau này đổi RETURNS TABLE của hàm, `create or replace` sẽ báo
-- "cannot change return type of existing function" → khi đó phải
-- `drop view public.exams_with_difficulty;` trước, chạy lại cả khối 12, xong
-- kiểm lại grant trên view.
create or replace function public.exam_rating_aggregate()
returns table (
  exam_id      text,
  rating_count bigint,
  avg_overall  numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.exam_id,
         count(*)::bigint,
         -- overall mỗi user = mean 3 phần; community = mean các overall.
         avg((r.score_part1 + r.score_part2 + r.score_part3) / 3.0)
    from public.exam_difficulty_ratings r
   group by r.exam_id;
$$;

-- View security_invoker gọi hàm này DƯỚI DANH NGHĨA NGƯỜI XEM → người xem phải
-- có EXECUTE. Cấp cho cả anon: view vẫn trả 0 dòng cho anon (RLS `exams` lo
-- việc đó), nhưng thiếu EXECUTE thì anon nhận LỖI thay vì rỗng — đổi hành vi
-- không cần thiết.
revoke all on function public.exam_rating_aggregate() from public;
grant execute on function public.exam_rating_aggregate() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12b. View chạy bằng quyền NGƯỜI GỌI. HÌNH DẠNG giữ nguyên (e.* + rating_count
--      + avg_overall, cùng thứ tự, cùng kiểu) vì PostgREST embed xuyên view này
--      trong getResult() (exam_attempts → exams_with_difficulty).
--      Ngưỡng N=3 vẫn là bản sao SQL của RATING_THRESHOLD (SOURCE/lib/rating).
-- ----------------------------------------------------------------------------
-- Drop trước vì đúng lý do đã ghi ở khối tạo view lần đầu (§8b/9): `e.*` đóng
-- băng lúc tạo, nên trên một DB đã có view từ trước khi `exams` mọc thêm cột thì
-- `create or replace` gãy 42P16, còn bỏ qua drop thì view thiếu cột và mọi truy
-- vấn xin cột mới chết 42703. Đây là chỗ THỨ HAI, không phải chỗ thừa: file này
-- tạo view hai lần (lần đầu không security_invoker), và cả hai lần đều phải
-- chịu cùng một ràng buộc.
drop view if exists public.exams_with_difficulty;
create or replace view public.exams_with_difficulty
with (security_invoker = true) as
select
  e.*,
  coalesce(agg.rating_count, 0) as rating_count,
  case when coalesce(agg.rating_count, 0) >= 3 then agg.avg_overall end as avg_overall
from public.exams e
left join public.exam_rating_aggregate() agg on agg.exam_id = e.id;

-- Phòng khi view đã tồn tại từ trước mà `create or replace` không đổi option.
alter view public.exams_with_difficulty set (security_invoker = true);

-- ============================================================================
-- TAKEDOWN UGC (Security review 2026-08-03, Medium #7)
--
-- Trước: gỡ đề UGC xấu phải chạy SQL tay bằng service-role (chính schema này tự
-- ghi ở §5: "Gỡ UGC published xấu: out-of-band bằng service-role"). Với nền tảng
-- phục vụ học sinh, "quy trình gỡ nội dung" mà là mở SQL Editor gõ tay thì
-- không dùng được lúc cần gấp, và không để lại dấu vết ai gỡ, gỡ khi nào.
--
-- ADR-0001 chốt KHÔNG có admin trong DB (không is_admin(), không role trigger).
-- Bản vá này GIỮ NGUYÊN quyết định đó: không thêm cột role, không thêm policy
-- admin. Quyền quản trị nằm NGOÀI database — danh sách user id trong biến môi
-- trường (ADMIN_USER_IDS), và mọi thao tác gỡ đi qua service_role ở tầng app
-- (lib/supabase/service-role.ts). DB chỉ cần biết thêm đúng một trạng thái.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 14a. Trạng thái 'removed' — đã bị gỡ. Khác 'draft' ở chỗ TÁC GIẢ KHÔNG tự
--      đưa ngược lại được (xem 14b); 'draft' là trạng thái làm việc bình thường
--      của tác giả nên gỡ về 'draft' thì họ bấm Publish lại là xong.
-- ----------------------------------------------------------------------------
alter table public.exams drop constraint if exists exams_status_check;
alter table public.exams add constraint exams_status_check
  check (status in ('processing','review','draft','published','failed','removed'));

-- ----------------------------------------------------------------------------
-- 14b. Đề đã gỡ thì tác giả không đụng vào được nữa.
--      `using` soi dòng CŨ → không sửa được đề đang ở 'removed'.
--      `with check` soi dòng MỚI → không tự đặt đề của mình thành 'removed'
--      (không cần thiết, và giữ 'removed' mang đúng một nghĩa: do quản trị gỡ).
--      service_role bypass RLS nên tầng admin vẫn khôi phục được.
--      Đề 'removed' vẫn hiện với chính tác giả qua exams_select_visible
--      (nhánh author_id) — CỐ Ý: họ cần biết đề bị gỡ, thay vì thấy nó biến mất.
-- ----------------------------------------------------------------------------
drop policy if exists "exams_update_author" on public.exams;
create policy "exams_update_author" on public.exams
  for update to authenticated
  using (author_id = auth.uid() and status is distinct from 'removed')
  with check (author_id = auth.uid() and status is distinct from 'removed');

-- Xoá hẳn cũng chặn: tác giả không được xoá đề đang bị gỡ để phi tang.
drop policy if exists "exams_delete_author" on public.exams;
create policy "exams_delete_author" on public.exams
  for delete to authenticated
  using (author_id = auth.uid() and status is distinct from 'removed');

-- ----------------------------------------------------------------------------
-- 14c. Nhật ký gỡ/khôi phục — ai làm, lúc nào, vì sao.
--      CHỈ service_role đọc/ghi: đây là bản ghi vận hành, không phải dữ liệu
--      của người dùng. RLS bật + KHÔNG policy nào = anon/authenticated không
--      thấy gì, kể cả tác giả bị gỡ bài.
-- ----------------------------------------------------------------------------
create table if not exists public.exam_moderation_log (
  id         uuid primary key default gen_random_uuid(),
  exam_id    text not null references public.exams(id) on delete cascade,
  action     text not null check (action in ('remove','restore')),
  -- `set null` (§16b, TD-012): nhật ký kiểm toán KHÔNG được biến mất theo tài
  -- khoản người đã bấm gỡ, nên KHÔNG cascade. Mất DANH TÍNH actor thì chịu
  -- được; mất cả DÒNG thì biến "xoá tài khoản" thành "xoá dấu vết".
  actor_id   uuid references auth.users(id) on delete set null,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists exam_moderation_log_exam_idx
  on public.exam_moderation_log (exam_id, created_at desc);

alter table public.exam_moderation_log enable row level security;
revoke all on public.exam_moderation_log from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 15. Khoá ngoại của luồng làm bài — bổ sung `on delete cascade` (2026-08-04).
--
--     BUG THẬT, phát hiện lúc smoke test trên production:
--     hai khoá ngoại dưới đây khai lúc dựng §L2 mà KHÔNG có `on delete`, nên
--     mặc định là NO ACTION. Hệ quả: ngay khi có MỘT người làm bài, tác giả
--     VĨNH VIỄN không xoá được đề của mình — `deleteExam` chết ở bước xoá
--     questions với 23503, im lặng với người dùng cho tới khi đọc kỹ dialog.
--
--     Vì sao cascade là đúng chứ không phải chặn xoá: hai bảng dữ liệu-người-
--     dùng-khác đã gắn với đề từ trước — `exam_reports` (§3) và
--     `exam_difficulty_ratings` (§12) — ĐỀU đã `on delete cascade`. Ý đồ
--     thiết kế sẵn có là "xoá đề thì mọi thứ phái sinh đi theo"; hai khoá này
--     chỉ là chỗ bị bỏ sót, không phải một quyết định ngược lại.
--
--     `exam_results` không cần đụng: nó đã cascade qua `attempt_id`
--     (→ exam_attempts → exams), nên chuỗi tự đủ khi mắt xích trên thông.
--
--     Idempotent: drop constraint theo tên mặc định của Postgres rồi tạo lại.
--     Chạy lại nhiều lần không lỗi nhờ `if exists`.
-- ----------------------------------------------------------------------------

-- Xoá đề → xoá luôn mọi lượt làm bài của mọi người trên đề đó.
alter table public.exam_attempts
  drop constraint if exists exam_attempts_exam_id_fkey;
alter table public.exam_attempts
  add constraint exam_attempts_exam_id_fkey
  foreign key (exam_id) references public.exams (id) on delete cascade;

-- Xoá câu hỏi → xoá luôn các ô trả lời trỏ vào nó. Đây chính là mắt xích làm
-- deleteExam chết, vì questions bị xoá TRƯỚC exams (policy delete của questions
-- cần row exams còn tồn tại — xem §L4 deleteExam).
alter table public.attempt_answers
  drop constraint if exists attempt_answers_question_id_fkey;
alter table public.attempt_answers
  add constraint attempt_answers_question_id_fkey
  foreign key (question_id) references public.questions (id) on delete cascade;

-- ----------------------------------------------------------------------------
-- 16. Khoá ngoại: khai hành vi xoá RÕ RÀNG + đường đọc metadata (2026-08-04).
--
--     Vì sao có phần này (TECH-DEBT TD-011): bug xoá đề ngày 2026-08-04 là một
--     khoá ngoại thiếu `on delete` — mặc định NO ACTION — và nó đi lọt qua MỌI
--     cổng đang có: tsc xanh, vitest xanh, `verify:schema` xanh. Lý do rất cụ
--     thể: `verify-schema.ts` chỉ quan sát được DB qua PostgREST, mà PostgREST
--     KHÔNG phơi `information_schema`; cách duy nhất suy ra `on delete` từ phía
--     client là thật sự xoá một dòng cha rồi xem dòng con có đi theo không —
--     đúng thứ bị cấm vì script phải an toàn để chạy trên production.
--
--     §16a mở một đường ĐỌC metadata thật, để `verify:schema` so thẳng
--     `on delete` của mọi khoá ngoại với schema.sql thay vì suy từ hành vi.
--     §16b chuẩn hoá hai khoá ngoại duy nhất còn để mặc định.
--
--     Quy ước từ nay: MỌI `references` trong file này phải viết kèm `on delete`,
--     kể cả khi hành vi mong muốn đúng bằng mặc định. `verify:schema` fail nếu
--     có cái nào bỏ trống. Đây mới là chỗ bắt được bug — nó bắt lúc ĐỌC DIFF,
--     trước khi SQL kịp chạy ở đâu.
-- ----------------------------------------------------------------------------

-- 16a. Metadata khoá ngoại, đọc được qua PostgREST.
--
--      SECURITY INVOKER (mặc định), CỐ Ý — không phải SECURITY DEFINER: pg_catalog
--      vốn đã đọc được với mọi role, nên definer chỉ thêm một hàm leo quyền vào
--      bề mặt tấn công mà không mua được gì. EXECUTE bị khoá về service_role vì
--      sơ đồ khoá ngoại là thông tin về cấu trúc hệ thống, không phải dữ liệu
--      người dùng — không có lý do gì để trình duyệt hỏi được.
--
--      Hàm CHỈ ĐỌC catalog: không DML, không DDL, chạy trên production vô hại.
create or replace function public.schema_foreign_keys()
returns table (
  constraint_name  text,
  child_schema     text,
  child_table      text,
  child_columns    text[],
  parent_schema    text,
  parent_table     text,
  parent_columns   text[],
  on_delete        text,
  on_update        text
)
language sql
stable
set search_path = ''
as $$
  select
    c.conname::text,
    cn.nspname::text,
    ct.relname::text,
    (select pg_catalog.array_agg(a.attname::text order by k.ord)
       from pg_catalog.unnest(c.conkey) with ordinality as k(attnum, ord)
       join pg_catalog.pg_attribute a
         on a.attrelid = c.conrelid and a.attnum = k.attnum),
    pn.nspname::text,
    pt.relname::text,
    (select pg_catalog.array_agg(a.attname::text order by k.ord)
       from pg_catalog.unnest(c.confkey) with ordinality as k(attnum, ord)
       join pg_catalog.pg_attribute a
         on a.attrelid = c.confrelid and a.attnum = k.attnum),
    -- pg_constraint lưu hành vi xoá thành MỘT KÝ TỰ; dịch ra chữ để so trực
    -- tiếp với cú pháp viết trong schema.sql, không phải tra bảng khi đọc log.
    case c.confdeltype
      when 'a' then 'no action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
      else c.confdeltype::text
    end,
    case c.confupdtype
      when 'a' then 'no action'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
      else c.confupdtype::text
    end
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class     ct on ct.oid = c.conrelid
  join pg_catalog.pg_namespace cn on cn.oid = ct.relnamespace
  join pg_catalog.pg_class     pt on pt.oid = c.confrelid
  join pg_catalog.pg_namespace pn on pn.oid = pt.relnamespace
  where c.contype = 'f'
    and cn.nspname = 'public'
  order by ct.relname, c.conname
$$;

-- Supabase cấp sẵn EXECUTE cho anon/authenticated qua default privileges, và
-- `revoke from public` KHÔNG gỡ được cái đó — phải gọi tên hai role (bài học
-- §10b, chỗ đã một lần bỏ lọt đúng lỗi này).
revoke all on function public.schema_foreign_keys() from public, anon, authenticated;
grant execute on function public.schema_foreign_keys() to service_role;

-- 16b. Hai khoá ngoại duy nhất trỏ `auth.users` mà không cascade —
--      `on delete set null` (TECH-DEBT TD-012, sửa 2026-08-07).
--
--      Lịch sử ngắn, vì nó giải thích vì sao dòng dưới KHÔNG phải `no action`:
--      2026-08-04 mục này viết rõ `no action` (đúng bằng hành vi mặc định đang
--      có) và ghi lại thành TD-012 với nhận định "chưa chạm tới được, ngày làm
--      tính năng xoá tài khoản thì đổi sang set null". 2026-08-07 đổi luôn.
--      Lý do đổi sớm: `no action` KHÔNG mua được gì hôm nay (không có đường nào
--      trong app xoá tài khoản — đã grep `deleteUser`/`admin.deleteUser`), nó
--      chỉ hẹn giờ một lần 23503 cho người viết tính năng đó. Còn `set null`
--      hôm nay cũng KHÔNG đổi hành vi gì, vì không có lệnh xoá nào để chạm tới.
--      Hai lựa chọn cùng giá ở hiện tại; một cái đúng sẵn ở tương lai.
--
--      Vì sao `set null` là đáp án chứ không phải cascade:
--      - `exams.author_id` nullable, và ADR-0003 đã snapshot `author_display_name`
--        ngay trên hàng đề — chính là để đề sống sót qua việc tác giả biến mất.
--        Cascade sẽ xoá sạch đề CÔNG KHAI của người khác đang làm dở.
--      - `exam_moderation_log.actor_id` nullable. Nhật ký kiểm toán mất DANH
--        TÍNH người bấm còn chấp nhận được; mất cả DÒNG thì không — cascade
--        biến "xoá tài khoản" thành "xoá luôn dấu vết mình đã làm gì".
alter table public.exams
  drop constraint if exists exams_author_id_fkey;
alter table public.exams
  add constraint exams_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

alter table public.exam_moderation_log
  drop constraint if exists exam_moderation_log_actor_id_fkey;
alter table public.exam_moderation_log
  add constraint exam_moderation_log_actor_id_fkey
  foreign key (actor_id) references auth.users (id) on delete set null;

-- ============================================================================
-- MASTERY WRITE (Engine 1 Adaptive AI, ADR-0011, PRD R3/AC-011)
--
-- Mirrors §11's SCORE WRITE LOCKDOWN shape exactly: client loses all write
-- access, a privileged service_role-only INVOKER function derives user_id
-- from the attempt row (never a parameter), requires status='submitted'.
--
-- DELIBERATELY a SEPARATE function from record_exam_result(), not an
-- extension of it: PRD Reliability NFR requires a failed mastery update to
-- NOT break exam submission. Extending record_exam_result() would make the
-- two writes atomic (one statement, one implicit transaction) — a mastery-
-- side failure would roll back the score insert too. See ADR-0011.
-- ============================================================================

create table if not exists public.user_skill_mastery (
  user_id       uuid not null references auth.users(id) on delete cascade,
  skill_node_id text not null references public.skill_nodes(id) on delete cascade,
  correct_count int not null default 0,
  total_count   int not null default 0,
  last_wrong_at timestamptz,             -- null = chưa từng sai trên skill này
  updated_at    timestamptz not null default now(),
  primary key (user_id, skill_node_id)
);

alter table public.user_skill_mastery enable row level security;

-- Không có insert/update policy cho authenticated: KHÔNG có trường hợp hợp lệ
-- nào client tự ghi mastery — mọi ghi đi qua record_skill_mastery() dưới đây
-- (service_role, bypass RLS). Revoke tường minh dù RLS không có policy nào
-- cho các thao tác ghi (defense-in-depth, tiền lệ §11a).
revoke insert, update, delete on public.user_skill_mastery from anon, authenticated;

drop policy if exists "mastery_select_own" on public.user_skill_mastery;
create policy "mastery_select_own" on public.user_skill_mastery
  for select using (user_id = auth.uid());

drop function if exists public.record_skill_mastery(uuid, jsonb);
create function public.record_skill_mastery(
  p_attempt_id   uuid,
  p_per_question jsonb
)
returns void
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  -- Cùng cưỡng chế với record_exam_result(): user_id suy ra từ attempt, đòi
  -- status='submitted' — người gọi không tự khai được user_id hay attempt
  -- chưa nộp.
  select a.user_id into v_user_id
    from public.exam_attempts a
   where a.id = p_attempt_id
     and a.status = 'submitted';

  if v_user_id is null then
    raise exception 'record_skill_mastery: attempt % không tồn tại hoặc chưa submitted', p_attempt_id
      using errcode = 'check_violation';
  end if;

  -- Gộp theo skill_node_id: câu scored=false hoặc skill_node_id null KHÔNG
  -- đóng góp gì (AC-010/AC-029) — WHERE lọc cả hai điều kiện, join là INNER
  -- nên câu không khớp questions (hiếm, xem Data Contracts) cũng tự loại.
  -- scored thiếu (undefined ở TS, JSON.stringify bỏ key) → coalesce về true,
  -- khớp đúng quy ước "undefined = true" của computeScore.ts.
  insert into public.user_skill_mastery
    (user_id, skill_node_id, correct_count, total_count, last_wrong_at, updated_at)
  select
    v_user_id,
    q.skill_node_id,
    count(*) filter (where (pq->>'isCorrect')::boolean),
    count(*),
    max(now()) filter (where not (pq->>'isCorrect')::boolean),
    now()
  from jsonb_array_elements(p_per_question) as pq
  join public.questions q on q.id = pq->>'questionId'
  where coalesce((pq->>'scored')::boolean, true)
    and q.skill_node_id is not null
  group by q.skill_node_id
  on conflict (user_id, skill_node_id) do update
  set correct_count = public.user_skill_mastery.correct_count + excluded.correct_count,
      total_count   = public.user_skill_mastery.total_count + excluded.total_count,
      last_wrong_at = coalesce(excluded.last_wrong_at, public.user_skill_mastery.last_wrong_at),
      updated_at    = now();
end;
$$;

-- Revoke ĐÍCH DANH — xem ghi chú §10b về default privileges của Supabase.
revoke all on function public.record_skill_mastery(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_skill_mastery(uuid, jsonb) to service_role;

-- ============================================================================
-- TELEMETRY LOG (Engine 1 Adaptive AI, PRD R4/AC-012/AC-013)
--
-- Ghi lại lời gọi tutor/adaptive để quan sát được sau khi ship (AC-012), KHÔNG
-- BAO GIỜ chứa answer-key material (AC-013 — schema không có cột nào để chứa
-- correct_answer/sub_answers/essay_answer, đúng bằng thiết kế). Bảng vận hành,
-- không phải dữ liệu người dùng tự xem — tiền lệ exam_moderation_log: RLS bật
-- + không policy đọc nào cho authenticated/anon.
-- ============================================================================
create table if not exists public.telemetry_log (
  id            uuid primary key default gen_random_uuid(),
  -- `set null`: nhật ký vận hành không nên biến mất theo tài khoản (tiền lệ
  -- §16b, TD-012) — mất DANH TÍNH chấp nhận được, mất DÒNG thì không.
  user_id       uuid references auth.users(id) on delete set null,
  -- 'essay_grade' mới ở Essay Auto-Scoring R13 — xem cặp drop/add MỚI ở cuối
  -- file: cột này chưa từng có cặp drop/add, nên sửa MỖI ở đây chỉ đúng cho
  -- một lần provision MỚI (đúng hình dạng TD-005 trên dev/prod đã tồn tại).
  event_type    text not null check (event_type in ('adaptive_route', 'tutor_invoke', 'essay_grade')),
  question_id   text references public.questions(id) on delete set null,
  skill_node_id text references public.skill_nodes(id) on delete set null,
  success       boolean not null,
  -- Mã có cấu trúc, KHÔNG BAO GIỜ free-text/exception message — chặn một
  -- con đường vô tình nhét nội dung câu hỏi (UGC, attacker-influenced) vào
  -- log qua err.message.
  error_code    text check (
    error_code is null or error_code in (
      'gemini_unavailable', 'rate_limited', 'server', 'not_eligible',
      -- Mới ở R13/AC-045 — xem khối SUBSCRIPTION telemetry_log ở cuối file:
      -- sửa TẠI CHỖ ở đây là để một lần provision MỚI đúng; cặp drop/add
      -- dưới đó là để dev/prod (đã tồn tại, nên `create table if not
      -- exists` là no-op) cũng đúng. Thiếu một trong hai = hình dạng TD-005.
      'user_quota_exhausted', 'project_budget_exhausted',
      -- Mới ở Essay Auto-Scoring R13 — xem cặp drop/add ở cuối file.
      'groq_unavailable', 'invalid_output', 'duplicate_write'
    )
  ),
  created_at    timestamptz not null default now()
);

alter table public.telemetry_log enable row level security;

-- Chỉ GHI được (lúc invoke), KHÔNG đọc được — quan sát vận hành (AC-012) đi
-- qua service_role/SQL Editor, không qua app. Revoke tường minh SELECT/UPDATE/
-- DELETE dù RLS không có policy nào cho các thao tác đó (defense-in-depth,
-- tiền lệ §11a).
revoke select, update, delete on public.telemetry_log from anon, authenticated;
revoke insert on public.telemetry_log from anon;

drop policy if exists "telemetry_insert_own" on public.telemetry_log;
create policy "telemetry_insert_own" on public.telemetry_log
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================================
-- User Support System v1 (PRD support-system-prd.md v1.2, ADR-0012, Design
-- Doc support-system-backend-design.md) — support_tickets + support_ticket_notes
-- + support-screenshots storage policies. Idempotent.
-- ============================================================================
create table if not exists public.support_tickets (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  intent                      text not null,
  message                     text not null,
  page_url                    text,          -- null cho phép (AC-010: khoảng trống metadata không chặn submit)
  user_agent                  text,
  screen_width                integer,
  screen_height               integer,
  screenshot_path             text,          -- 1 cột scalar = tối đa 1 ảnh cấu trúc (AC-011, metric 7)
  status                      text not null default 'new',
  notify_failed               boolean not null default false,           -- AC-032
  first_status_transition_at  timestamptz,                              -- AC-016/AC-047, null khi còn 'new'
  created_at                  timestamptz not null default now()
);

alter table public.support_tickets drop constraint if exists support_tickets_intent_check;
alter table public.support_tickets add constraint support_tickets_intent_check
  check (intent in ('bug', 'suggestion', 'question'));

alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('new', 'in_progress', 'resolved'));                 -- AC-029 (DB layer)

alter table public.support_tickets drop constraint if exists support_tickets_message_not_empty_check;
alter table public.support_tickets add constraint support_tickets_message_not_empty_check
  check (length(btrim(message)) > 0);

alter table public.support_tickets drop constraint if exists support_tickets_message_length_check;
alter table public.support_tickets add constraint support_tickets_message_length_check
  check (length(message) <= 1000);   -- LIMITS.MAX_SUPPORT_MESSAGE (SOURCE/lib/ugc/limits.ts) — TBD-07 resolved: 1000

create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own" on public.support_tickets
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own" on public.support_tickets
  for select to authenticated using (user_id = auth.uid());            -- AC-015; không có UI đọc trong v1 (D3) nhưng RLS vẫn bật

-- KHÔNG có policy update/delete cho `authenticated`: đổi status, ghi cờ
-- notify_failed đều đi qua service role trong Server Action admin/hệ thống,
-- không mở surface cho student tự sửa nội dung/status ticket của mình.

-- ----------------------------------------------------------------------------
-- change_support_ticket_status(p_ticket_id, p_status) — đường DUY NHẤT ghi
-- first_status_transition_at, atomic CASE trong cùng câu UPDATE (AC-047).
--
-- CỐ Ý KHÔNG phải SECURITY DEFINER, cùng lý do với record_exam_result() (§11b):
-- service_role đã bypass RLS và còn nguyên quyền UPDATE trên support_tickets,
-- nên hàm chạy đúng dưới quyền người gọi (INVOKER, mặc định của Postgres khi
-- không khai `security definer`). Giữ INVOKER để phòng thủ theo lớp: lỡ ai đó
-- `grant execute ... to authenticated` thì học sinh/admin vẫn không đổi được
-- status qua đường này, vì `support_tickets` không có policy update nào cho
-- `authenticated` (xem trên) — phải hỏng cả hai chỗ mới khai thác được.
--
-- p_status validate lại NGAY TRONG hàm — lớp cưỡng chế thứ ba, độc lập với
-- validate ở changeTicketStatusAction (defensive) và CHECK constraint ở trên
-- (authoritative backstop, AC-029).
-- ----------------------------------------------------------------------------
drop function if exists public.change_support_ticket_status(uuid, text);
create function public.change_support_ticket_status(
  p_ticket_id uuid,
  p_status    text
)
returns table (status text, first_status_transition_at timestamptz)
language plpgsql
volatile
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('new', 'in_progress', 'resolved') then
    raise exception 'change_support_ticket_status: status % không hợp lệ', p_status
      using errcode = 'check_violation';
  end if;

  return query
    update public.support_tickets t
       set status = p_status,
           first_status_transition_at = case
             when t.status = 'new' and p_status <> 'new' then now()
             else t.first_status_transition_at
           end
     where t.id = p_ticket_id
    returning t.status, t.first_status_transition_at;
end;
$$;

-- Revoke ĐÍCH DANH anon + authenticated (không chỉ PUBLIC), giống record_exam_result
-- §11b — thiếu dòng này thì bất kỳ authenticated nào (không riêng admin, vì DB
-- không có role admin — ADR-0001) gọi thẳng RPC này cũng đổi được status của
-- ticket bất kỳ, bỏ qua hoàn toàn isAdminUserId() re-check ở tầng Server Action.
revoke all on function public.change_support_ticket_status(uuid, text)
  from public, anon, authenticated;
grant execute on function public.change_support_ticket_status(uuid, text)
  to service_role;

-- Internal notes: KHÔNG BAO GIỜ là cột trên support_tickets (D4). Idiom
-- "strict" giống exam_moderation_log/schema_version — KHÁC telemetry_log's
-- narrow form (telemetry_log có insert path từ app, notes thì KHÔNG).
create table if not exists public.support_ticket_notes (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  admin_id    uuid references auth.users(id) on delete set null,       -- audit row sống sót nếu admin bị xoá (giống exam_moderation_log.actor_id)
  note_text   text not null,
  created_at  timestamptz not null default now()
);

alter table public.support_ticket_notes drop constraint if exists support_ticket_notes_text_not_empty_check;
alter table public.support_ticket_notes add constraint support_ticket_notes_text_not_empty_check
  check (length(btrim(note_text)) > 0);

create index if not exists support_ticket_notes_ticket_idx on public.support_ticket_notes (ticket_id, created_at);

alter table public.support_ticket_notes enable row level security;
revoke all on public.support_ticket_notes from anon, authenticated;
-- ZERO policy nào — service role (bypass RLS) là đường ghi/đọc duy nhất
-- (AC-025, AC-026, AC-048). `authenticated` không có INSERT path — không
-- policy nào cấp, và `revoke all` xoá cả grant tầng bảng.

-- Bucket "support-screenshots" tạo ngoài SQL (setup-storage.ts BUCKETS array),
-- private (public:false), kèm fileSizeLimit/allowedMimeTypes ở tầng Storage
-- (backstop — enforcement chính vẫn ở Server Action, xem TBD-02 rationale).
drop policy if exists "support_screenshots_insert_own" on storage.objects;
create policy "support_screenshots_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'support-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- KHÔNG select/update/delete policy cho `authenticated`: student không đọc
-- lại ảnh mình gửi (D3 — không có "my tickets"); admin đọc qua signed URL do
-- service role tạo (bypass RLS hoàn toàn — AC-013: không authenticated nào
-- khác, kể cả không phải tác giả, có quyền đọc trực tiếp qua policy này).

-- ----------------------------------------------------------------------------
-- Storage policies — bucket "avatars" (ADR-0016, PRD AC-031/AC-032/AC-033)
--     Bucket tạo ngoài SQL (setup-storage.ts BUCKETS), private (public:false),
--     kèm fileSizeLimit/allowedMimeTypes ở tầng Storage (backstop — enforcement
--     chính vẫn ở Server Action changeAvatar).
--     Path convention: {auth.uid()}/{uuid}.{ext} → mọi policy dưới đây dùng
--     CHUNG một vị từ sở hữu, chép từ "support_screenshots_insert_own" §16:
--       bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
--
--     ⚠ CÓ select ở đây, trong khi support-screenshots CỐ Ý KHÔNG có. Khác biệt
--     nằm ở đường đọc, không phải ở mức nhạy cảm: ảnh support do service role
--     ký hộ cho admin, còn ảnh đại diện thì CHÍNH CHỦ đọc lại object của mình
--     bằng client PHIÊN CỦA MÌNH để ký signed URL (getCurrentUserProfile →
--     storage.createSignedUrl). Thiếu policy select thì createSignedUrl trả lỗi
--     và mọi avatar âm thầm tụt về initials — trông như "user chưa có ảnh" chứ
--     không như một bug (PRD R-f).
--
--     Nếu SQL Editor báo "must be owner of table objects", tạo qua Dashboard →
--     Storage → Policies (nội dung y hệt), giống §8.
-- ----------------------------------------------------------------------------
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- delete: đổi ảnh là upload key MỚI rồi xoá key cũ (best-effort, changeAvatar
-- bước 7). Không có policy này thì object cũ ở lại vĩnh viễn.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- SUBSCRIPTION — payment_orders (PRD R8, ADR-0013/ADR-0014)
--
-- Chứng từ tiền, KHÔNG phải trạng thái phái sinh: nó sống lâu hơn tài khoản
-- (`on delete set null`, PRD R-g) để một khiếu nại vẫn đối soát được. Client
-- chỉ ĐỌC đơn của chính mình; mọi lệnh ghi đi qua service_role.
-- ============================================================================
create table if not exists public.payment_orders (
  -- payOS đòi orderCode là SỐ NGUYÊN; bigint là kiểu vừa khít, và đây cũng là
  -- khoá của nhà cung cấp cho cả webhook lẫn GET /v2/payment-requests/{id}.
  order_code    bigint primary key,
  -- CHO PHÉP NULL kèm `on delete set null`, cố ý (PRD R-g): chứng từ tiền phải
  -- sống lâu hơn tài khoản. Cái giá là settlement một đơn mồ côi sẽ không tìm
  -- ra người thụ hưởng và từ chối — đúng kết cục fail-closed mong muốn.
  user_id       uuid references auth.users(id) on delete set null,
  amount        integer not null check (amount > 0),
  -- KHÔNG có trạng thái 'refunded': hoàn tiền là một thao tác ngân hàng cộng
  -- một câu SQL sửa tay (D10). Bịa ra một status mà code không bao giờ đặt là
  -- tạo một trạng thái chỉ tới được bằng một nhánh code không tồn tại (đúng
  -- cảnh báo của ADR-0013).
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'expired', 'cancelled')),
  created_at    timestamptz not null default now(),
  -- Soi gương `expiredAt` của chính payOS trên payment request. MỘT hằng số
  -- dùng chung nuôi cả hai (ADR-0013 Implementation Guidance) — hai đồng hồ
  -- lệch nhau đẻ ra một QR mà bên này tưởng còn sống, bên kia tưởng đã chết.
  -- Hằng đó là `ORDER_PENDING_WINDOW_MS` (lib/billing/pricing.ts).
  pending_until timestamptz not null,
  settled_at    timestamptz,

  -- Bốn cột chuyển khoản (UI Spec C-13, FE-B-01) ----------------------------
  -- Bốn trường còn lại của CheckoutOrder (UI Spec C-13). Chúng được LƯU chứ
  -- không suy ra, vì đúng một lý do: phải đọc được trên một lần vào nguội
  -- /pricing/checkout?order=… mà trong phiên KHÔNG có lượt gọi createOrder()
  -- nào — link "tiếp tục thanh toán" (AC-027), một lần F5, một bookmark.
  -- Ghi MỘT LẦN, từ phản hồi create-request của payOS, trong chính câu insert
  -- tạo dòng; không bao giờ tính lại lúc đọc (frontend Risk R-11). Số tài
  -- khoản hay memo đổi dưới chân một đơn đang bay là cùng loại lỗi mà
  -- settleOrder() bước 3 từ chối trên số tiền.
  -- NOT NULL cưỡng chế được vì lượt gọi nhà cung cấp đi TRƯỚC insert: payOS
  -- không trả lời thì không dòng nào được ghi.
  qr_payload     text not null,   -- payOS `qrCode`: một PAYLOAD VietQR/EMVCo, KHÔNG phải URL (UI-D14)
  account_number text not null,   -- AC-028 — tài khoản NHẬN của mình, không bao giờ của người trả
  account_name   text not null,   -- AC-028 — chủ tài khoản nhận
  memo           text not null    -- AC-028 — payOS `description`; chuỗi nhà cung cấp đối soát theo
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

alter table public.payment_orders enable row level security;

-- Client chỉ ĐỌC được đơn của chính mình và KHÔNG ghi được gì. Hai nơi đọc là
-- S-05 ("đơn của tôi", R10) và S-06 (màn thanh toán). Đúng một policy này là
-- TOÀN BỘ đường đọc của cả hai: với bốn cột chuyển khoản ở trên, một select
-- theo chủ sở hữu trả đủ tám trường CheckoutOrder, nên S-06 không cần action
-- thứ hai và không cần gọi nhà cung cấp để render (FE-B-01). Revoke tường minh
-- dù RLS không có policy nào cho các thao tác ghi (defense-in-depth, tiền lệ
-- §11a).
revoke insert, update, delete on public.payment_orders from anon, authenticated;
revoke select on public.payment_orders from anon;

drop policy if exists "orders_select_own" on public.payment_orders;
create policy "orders_select_own" on public.payment_orders
  for select to authenticated using (user_id = auth.uid());

-- ============================================================================
-- SUBSCRIPTION — subscriptions (entitlement; PRD R2/R3/R4, ADR-0013)
--
-- Kỳ trả trước, KHÔNG phải subscription do nhà cung cấp đẩy: entitlement được
-- SUY RA lúc đọc bằng cách so `expires_at` (cộng 3 ngày ân hạn, PRD D8/R4) với
-- now(). Không boolean, không status enum, không sự kiện vòng đời từ provider,
-- và do đó không job định kỳ nào trong repo này.
-- ============================================================================
create table if not exists public.subscriptions (
  -- `cascade`, khác payment_orders: dòng này không phải chứng từ tiền, nó là
  -- trạng thái phái sinh. Tài khoản đi thì nó đi theo.
  user_id          uuid primary key references auth.users(id) on delete cascade,
  -- MỘT giá trị vòng đời duy nhất. Không boolean, không status enum (PRD
  -- R2/AC-004; metric #4 đếm đúng loại cột này và kỳ vọng bằng 0).
  expires_at       timestamptz not null,
  -- KHÔNG phải bản chép lại của expires_at (backend DD, MSA-1): sau một lần mua
  -- sớm, `expires_at − 30d` chính là hạn CŨ — nó trả lời một câu hỏi khác. Đây
  -- là mốc bắt đầu kỳ HẠN MỨC 30 ngày hiện tại (A4), đặt trong CÙNG câu lệnh
  -- gia hạn expires_at — chính điều đó làm ca mua sớm của AC-016 được thêm
  -- NGÀY mà không được thêm một suất hạn mức thứ hai.
  period_anchor_at timestamptz not null,
  updated_at       timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke select on public.subscriptions from anon;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- ============================================================================
-- SUBSCRIPTION — record_payment_settlement() (ADR-0014, PRD AC-009/031/033)
--
-- Đường DUY NHẤT gia hạn được entitlement. Anh em với record_exam_result()
-- (§11b) và record_skill_mastery() (khối MASTERY WRITE), và theo cả hai từng
-- mệnh đề: INVOKER (mặc định của Postgres khi không khai `security definer` —
-- service_role vốn đã bypass RLS), danh tính SUY RA từ dòng đơn hàng, revoke
-- ĐÍCH DANH khỏi public/anon/authenticated, và DROP-THEN-CREATE như cả hai.
--
-- KHÔNG dùng `create or replace`: ngoại lệ duy nhất trong file này
-- (exam_rating_aggregate, §12a) tồn tại vì có view phụ thuộc vào hàm đó; hàm
-- này KHÔNG có đối tượng nào phụ thuộc, nên tiền đề của ngoại lệ vắng mặt. Khác
-- biệt không phải thẩm mỹ: `create or replace` giữ im lặng một chữ ký cũ nếu
-- sau này danh sách tham số đổi — trên đường tiền, đó là hai hàm settlement
-- gọi được trong khi tài liệu mô tả một.
--
-- Idempotency là mệnh đề `status = 'pending'` NẰM TRONG UPDATE ... RETURNING,
-- không phải một phép kiểm riêng: hai lượt settlement đồng thời (webhook và nút
-- "kiểm tra lại" bấm cùng lúc) tranh cùng một dòng, một bên thắng, UPDATE của
-- bên kia không khớp dòng nào và hàm no-op. Đó là AC-031, và nó không cần bảng
-- nonce, không cần đồng hồ (ADR-0014 Decision 4).
--
-- SAI LỆCH ĐƯỢC GHI NHẬN so với ADR-0014 Implementation Guidance ("Two
-- statements is a window"): thân hàm này dùng HAI câu lệnh. Thứ làm nó an toàn
-- không phải câu chữ mà là ngữ nghĩa giao dịch — thân plpgsql chạy trong một
-- giao dịch ngầm duy nhất, và câu lệnh đầu khoá dòng đơn hàng dưới vị từ
-- `status = 'pending'`, nên một settlement đồng thời của cùng order_code sẽ
-- chặn rồi khớp 0 dòng. Dạng một-câu-lệnh (CTE ghi dữ liệu) bị loại vì nhánh
-- `raise exception` không-người-thụ-hưởng bên dưới không có tương đương trong
-- CTE. Đây là SAI LỆCH, không phải tuân thủ; ca đồng thời trên Postgres thật là
-- thứ CHỨNG MINH nó, thay vì giả định.
-- ============================================================================
drop function if exists public.record_payment_settlement(bigint, integer);
create function public.record_payment_settlement(
  p_order_code bigint,
  p_period_days integer default 30
)
returns timestamptz
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_new_expires timestamptz;
begin
  -- Một câu lệnh giành lấy đơn. Nếu nó không còn 'pending' (đã paid, expired,
  -- cancelled, hoặc không tồn tại) thì không khớp gì và ta trả null.
  update public.payment_orders
     set status = 'paid', settled_at = now()
   where order_code = p_order_code
     and status = 'pending'
  returning user_id into v_user_id;

  if not found then
    return null;                 -- phát lại hoặc đơn lạ: no-op, không phải lỗi
  end if;

  if v_user_id is null then
    -- Đơn sống sót qua một tài khoản đã xoá (on delete set null). Fail closed
    -- và để lại dấu vết ồn ào: dòng giờ là 'paid' mà không có người thụ hưởng —
    -- đúng trạng thái cần một con người đối soát bằng tay (D10).
    raise exception 'settlement for order % has no beneficiary', p_order_code
      using errcode = 'check_violation';
  end if;

  -- GIA HẠN, không bao giờ ghi đè (PRD R3, ADR-0013). max(hiện có, now()) là
  -- thứ làm việc mua sớm THÊM ngày thay vì tịch thu ngày.
  insert into public.subscriptions (user_id, expires_at, period_anchor_at, updated_at)
  values (v_user_id, now() + make_interval(days => p_period_days), now(), now())
  on conflict (user_id) do update
    set expires_at = greatest(public.subscriptions.expires_at, now())
                     + make_interval(days => p_period_days),
        -- CÙNG câu lệnh với phép gia hạn ở trên: ca mua sớm của AC-016 được
        -- thêm NGÀY và đúng một kỳ hạn mức, không bao giờ hai.
        period_anchor_at = now(),
        updated_at = now()
  returning expires_at into v_new_expires;

  return v_new_expires;
end;
$$;

-- Supabase mặc định cấp EXECUTE cho public trên hàm mới. Revoke ĐÍCH DANH là
-- thứ duy nhất gỡ được nó (ADR-0011/ADR-0014 Implementation Guidance — nhắc
-- lại vì quên nó thì im lặng; xem thêm ghi chú §10b).
revoke all on function public.record_payment_settlement(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.record_payment_settlement(bigint, integer)
  to service_role;

-- ============================================================================
-- SUBSCRIPTION — telemetry_log.error_code mở rộng TẠI CHỖ (PRD R13,
-- AC-045/046/047)
--
-- CHECK hiện có được khai INLINE trong khối TELEMETRY LOG ở trên. Hai chỗ sửa,
-- và BẮT BUỘC cả hai — không chỗ nào một mình là đúng:
--   (1) danh sách inline sửa thành sáu literal, để một lần provision MỚI là
--       đúng;
--   (2) cặp drop/add dưới đây, để một DB ĐÃ provision là đúng — `create table
--       if not exists` là no-op trên dev và prod, cả hai đều đã tồn tại, nên
--       chỉ sửa inline sẽ đúng hình dạng TD-005: đúng trong git, vắng mặt ở
--       mọi database.
-- Constraint được THAY dưới CHÍNH TÊN của nó, không bao giờ dựng song song một
-- cái thứ hai — bài học §10c ("Bắt buộc theo thứ tự này"), thứ AC-045 gọi tên
-- trực tiếp.
-- ============================================================================
alter table public.telemetry_log
  drop constraint if exists telemetry_log_error_code_check;
alter table public.telemetry_log
  add constraint telemetry_log_error_code_check check (
    error_code is null or error_code in (
      'gemini_unavailable', 'rate_limited', 'server', 'not_eligible',
      -- Mới trong tính năng này. Tên chọn ĐÚNG BẰNG chuỗi lý do từ chối của
      -- consumeQuota(), để giá trị trong log và nhánh sinh ra nó không thể bị
      -- ánh xạ nhầm.
      'user_quota_exhausted',      -- AC-014/AC-015/AC-018/AC-053: hạn mức gói của CHÍNH người dùng
      'project_budget_exhausted',  -- AC-022/AC-023: ngân sách ngày toàn dự án của R7
      -- Ba mã mới ở Essay Auto-Scoring R13/AC-055. Tái dùng bốn mã sẵn có ở
      -- đâu tái dùng được (rate_limited, project_budget_exhausted, server,
      -- not_eligible); chỉ thêm khi mã cũ KHÔNG phân biệt được điều gì.
      'groq_unavailable',          -- nhà cung cấp Groq không tới được / lỗi phía họ
      'invalid_output',            -- parseGrade từ chối output của model (AC-006/AC-041)
      'duplicate_write'            -- AC-062: settle thứ hai khớp 0 dòng — bình thường, không bao giờ hiện cho học sinh
    )
  );

-- ----------------------------------------------------------------------------
-- MỚI (Essay Auto-Scoring R13/AC-055): event_type CHƯA TỪNG có cặp drop/add.
--
-- Thiếu khối này thì 'essay_grade' đúng trong git và bị CHECK từ chối trên cả
-- dev lẫn prod — mọi lượt ghi telemetry của việc chấm hỏng, IM LẶNG, vì lượt
-- ghi ấy là best-effort và không ai nhìn thấy nó thất bại.
--
-- Tên `telemetry_log_event_type_check` KHÔNG phải tên dự đoán: nó được đọc ra
-- bằng truy vấn chỉ-đọc trên CẢ HAI project ngày 2026-08-29 (Gate C của
-- docs/plans/20260829-feature-essay-auto-scoring.md) và giống nhau ở hai bên.
-- Điều này quan trọng vì `drop constraint if exists` với tên SAI là một no-op
-- IM LẶNG: migration báo thành công trong khi CHECK cũ vẫn đứng đó từ chối.
-- ----------------------------------------------------------------------------
alter table public.telemetry_log
  drop constraint if exists telemetry_log_event_type_check;
alter table public.telemetry_log
  add constraint telemetry_log_event_type_check check (
    event_type in ('adaptive_route', 'tutor_invoke', 'essay_grade')
  );

-- ----------------------------------------------------------------------------
-- 18. Tác giả bị BAN thì đề của họ rời khỏi catalog (TECH-DEBT TD-032).
--
--     VÌ SAO CÓ PHẦN NÀY. Ban một tài khoản trên Supabase (`banned_until`) chặn
--     ĐĂNG NHẬP và không chạm gì tới quyền ĐỌC nội dung đã published. Đo được
--     2026-08-29: tài khoản probe của `verify:schema` bị ban, và cả 4 đề
--     published của nó vẫn hiện bình thường trên prod. Tức "cấm cửa tác giả" và
--     "gỡ nội dung của tác giả" là hai việc, và trước khối này chỉ có việc thứ
--     nhất tồn tại.
--
--     KHÔNG DÙNG 'removed' CHO VIỆC NÀY, có chủ ý. §14 đã có một trạng thái gỡ
--     thủ công, từng đề một, có nhật ký (`exam_moderation_log`). Nó trả lời câu
--     "đề này có vấn đề". Ban trả lời câu "NGƯỜI này có vấn đề" — một vị từ về
--     tác giả, đúng một chỗ, và nó phải TỰ ĐẢO NGƯỢC khi lệnh ban hết hạn hoặc
--     được gỡ. Viết nó thành N lần `update exams set status='removed'` là chép
--     một trạng thái sang một bảng khác rồi phải nhớ chép ngược lại — và "phải
--     nhớ" chính là hình dạng của mọi món nợ trong sổ này.
--
--     BAN CÓ HẠN ĐƯỢC TÔN TRỌNG: `banned_until > now()`. Supabase ghi lệnh ban
--     vĩnh viễn bằng một mốc rất xa (dự án này dùng 2999-01-01), nên một vị từ
--     `is not null` đơn thuần sẽ giữ đề bị ẩn mãi sau khi lệnh ban đã hết hạn.
--
--     TÁC GIẢ VẪN THẤY ĐỀ CỦA CHÍNH MÌNH (`author_id = auth.uid()` ở vế sau).
--     Điều đó KHÔNG mâu thuẫn với lệnh ban: người bị ban không đăng nhập được
--     nên không có `auth.uid()` nào để khớp. Vế ấy giữ nguyên cho đúng một
--     trường hợp — lệnh ban hết hạn — và khi đó tác giả lấy lại đề của mình mà
--     không cần ai chạy lệnh gì.
--
--     `author_id is null` (nội dung seed) KHÔNG bị ảnh hưởng: `is_author_banned(null)`
--     trả false, nên seed vẫn hiện. Đây là hành vi phải giữ, không phải hệ quả
--     tình cờ — §5 đã ghi rằng seed cố ý không khớp policy tác giả nào.
-- ----------------------------------------------------------------------------

-- 18a. Vị từ. SECURITY DEFINER vì `authenticated` không có (và không nên có)
--      quyền đọc `auth.users`; biểu thức của một RLS policy chạy dưới quyền
--      NGƯỜI GỌI, nên không có đường nào đọc `banned_until` từ trong policy mà
--      không đi qua một hàm definer.
--
--      ⚠ BỀ MẶT LỘ RA, ghi thẳng thay vì giấu: hàm này cấp EXECUTE cho
--      `authenticated`, nên bất kỳ người dùng đã đăng nhập nào cũng hỏi được
--      "uuid này có đang bị ban không". Chấp nhận vì hai lý do đo được:
--      (1) nó đòi một uuid mà người hỏi PHẢI CÓ SẴN, và (2) `exams.author_id`
--      vốn đã đọc được qua PostgREST bằng anon key cho mọi đề published, nên
--      tập uuid có thể hỏi vốn đã nằm trong tay client từ trước. Thứ thêm vào
--      là một boolean về trạng thái kiểm duyệt, không phải một danh sách.
--      Nếu về sau điều đó thành vấn đề, cách chữa là chuyển vị từ vào một cột
--      đã materialize trên `user_profiles` — KHÔNG phải bỏ grant, vì bỏ grant
--      thì policy chết chứ không phải kín hơn.
--
--      `stable`: trong một câu lệnh, kết quả không đổi — planner được phép gọi
--      một lần cho mỗi `author_id` phân biệt thay vì một lần cho mỗi dòng.
create or replace function public.is_author_banned(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = p_author_id
       and u.banned_until is not null
       and u.banned_until > now()
  );
$$;

revoke all on function public.is_author_banned(uuid) from public;
grant execute on function public.is_author_banned(uuid) to anon, authenticated, service_role;

-- 18b. Policy đọc `exams` — cùng hình dạng với §4, thêm đúng một vế.
--      Chép lại NGUYÊN policy thay vì "sửa" nó: Postgres không có
--      `alter policy ... add`, và `drop`+`create` trong cùng một lượt là cách
--      duy nhất giữ file idempotent.
drop policy if exists "exams_select_visible" on public.exams;
create policy "exams_select_visible" on public.exams
  for select to authenticated using (
    (status = 'published' and not public.is_author_banned(author_id))
    or author_id = auth.uid()
  );

-- 18c. `questions` đi theo `exams`, nếu không thì nội dung câu hỏi của một tác
--      giả bị ban vẫn đọc được qua `/rest/v1/questions` trong khi đề đã biến
--      mất — một lỗ hổng hình dạng §10, và im lặng y như thế.
drop policy if exists "questions_select_visible" on public.questions;
create policy "questions_select_visible" on public.questions
  for select to authenticated using (
    exists (
      select 1 from public.exams e
      where questions.id = any(e.question_ids)
        and (
          (e.status = 'published' and not public.is_author_banned(e.author_id))
          or e.author_id = auth.uid()
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 19. Chỉ mục cho các cột tra cứu nóng (2026-09-03, refactor hiệu năng A2).
--
--     Postgres tự tạo chỉ mục cho PRIMARY KEY và UNIQUE, KHÔNG tạo cho khoá
--     ngoại. Tới 2026-09-03 file này có 22 bảng mà chỉ 4 chỉ mục tự khai, và
--     không cột nào dưới đây có chỉ mục — đọc bằng `pg_indexes` trên CẢ dev
--     lẫn prod, không suy từ file (TD-005: file và DB từng lệch nhau).
--
--     ĐO TRƯỚC KHI THÊM, và con số nói thật: prod hôm đó có 91 lượt làm bài,
--     16 kết quả, 7 đề, 387 ô trả lời. Ở cỡ đó `explain analyze` cho Seq Scan
--     trên mọi truy vấn dưới đây (2–6 ms) và planner SẼ TIẾP TỤC chọn Seq Scan
--     kể cả khi có chỉ mục — với bảng vài trang, quét tuần tự rẻ hơn đi qua
--     B-tree. Chỉ mục ở đây mua cái này: khi bảng lớn theo người dùng thật, các
--     màn dưới KHÔNG lặng lẽ chuyển từ mili-giây sang quét toàn bảng — và không
--     ai phải nhớ ra để thêm nó vào đúng ngày đó. Xác nhận planner DÙNG được
--     chúng bằng `set enable_seqscan = off` rồi `explain` (ghi trong migration).
--
--     Cột đầu mỗi chỉ mục là cột lọc, cột sau là cột sắp xếp — khớp đúng hình
--     dạng truy vấn PostgREST sinh ra, để một chỉ mục phục vụ cả WHERE lẫn
--     ORDER BY và không cần Sort riêng.
-- ----------------------------------------------------------------------------

-- Lịch sử làm bài + dashboard: lọc theo người, mới nhất trước.
-- (app/(HM)/queries.ts listMyHistory, app/(layer2)/queries.ts listMySubmittedExamIds)
create index if not exists exam_attempts_user_submitted_idx
  on public.exam_attempts (user_id, submitted_at desc);

-- Đếm/lọc lượt làm bài theo đề (xếp hạng đề, "đã làm", cascade khi xoá đề).
create index if not exists exam_attempts_exam_idx
  on public.exam_attempts (exam_id);

-- Analytics + lịch sử: kết quả của một người, mới nhất trước.
-- (app/(layer3)/queries.ts getAnalyticsByRange, app/(HM)/queries.ts)
create index if not exists exam_results_user_created_idx
  on public.exam_results (user_id, created_at desc);

-- "Đề của tôi": lọc theo tác giả. (app/(layer4)/queries.ts listMyExams, getMyExam)
create index if not exists exams_author_idx
  on public.exams (author_id);

-- Khoá ngoại attempt_answers.question_id → questions ON DELETE CASCADE (§15):
-- xoá một câu hỏi buộc Postgres tìm mọi ô trả lời của nó — không có chỉ mục
-- thì mỗi câu bị xoá là một lần quét toàn bảng attempt_answers.
create index if not exists attempt_answers_question_idx
  on public.attempt_answers (question_id);

-- ----------------------------------------------------------------------------
-- 20. Kho đề theo kệ — nguồn gốc lượt làm bài + đếm nóng liên người dùng
--     (2026-09-18, ADR-0021).
--
--     ĐẶT SAU §19 (khối chỉ mục, kết thúc ngay phía trên) và TRƯỚC §17
--     (schema_version, ở cuối file): thân hàm exam_hot_counts() gọi
--     public.is_author_banned() (§18a), public.exams và public.exam_attempts,
--     nên thứ tự phụ thuộc đặt khối này sau cả ba; §17 luôn phải là câu lệnh
--     CUỐI CÙNG của file vì khối vân tay ở đó phải là thứ ghi sau chót. Số thứ
--     tự các mục trong file này là lịch sử, không phải vị trí — khối Bài giải
--     cộng đồng ngay phía dưới cũng tự đánh số từ §20, không đổi lại vì mỗi
--     nhánh đánh số độc lập lúc viết (merge từ `main`, 2026-09-27).
-- ----------------------------------------------------------------------------

-- 20a. `source` đã inline ở `create table if not exists public.exam_attempts`
--      phía trên; đây là cặp alter idempotent cho hai database ĐANG CHẠY sẵn,
--      vì `create table if not exists` là no-op trên cả hai. Postgres tự đặt
--      tên CHECK inline đúng bằng `exam_attempts_source_check` — tên cặp
--      drop/add dưới đây dùng — nên khai hai lần vẫn ra MỘT ràng buộc. Vế drop
--      đứng trước vế add chỉ để idempotent khi áp lại lần hai; không ràng
--      buộc tên đó tồn tại trên database nào hiện nay.
alter table public.exam_attempts add column if not exists source text not null default 'none';
alter table public.exam_attempts drop constraint if exists exam_attempts_source_check;
alter table public.exam_attempts add constraint exam_attempts_source_check
  check (source in ('practice', 'hot', 'explore', 'none'));

-- 20b. Chỉ mục cửa sổ hot cần: lọc theo trạng thái, sắp theo thời điểm nộp
--      bài — cột lọc trước, cột sắp xếp sau, đúng quy ước §19. Ở số dòng hiện
--      tại planner vẫn chọn Seq Scan (lý do đã ghi ở §19); chỉ mục có sẵn để
--      khi bảng lớn theo người dùng thật không ai phải nhớ thêm nó đúng lúc.
create index if not exists exam_attempts_status_submitted_idx
  on public.exam_attempts (status, submitted_at desc);

-- 20c. Đếm nóng liên người dùng. `attempts_select_own` chỉ cho user đọc đúng
--      lượt của chính mình, nên "đề này bao nhiêu học sinh đã nộp" không đọc
--      được kiểu nào khác — SECURITY DEFINER là đường duy nhất. Một hàm
--      definer không chạy dưới RLS, nên vị từ bên trong LẶP LẠI đúng những gì
--      `exams_select_visible` (§18b) áp: published + tác giả không bị ban;
--      không lặp lại nghĩa là mở khả kiến rộng hơn bảng xếp hạng phẳng, một
--      cách âm thầm. Không tham số user id nào — hàm chỉ nhận biên cửa sổ thời
--      gian và một trần hàng.
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

-- Cấp theo hình dạng search_exams (§ Tìm đề theo tên, :185-186), KHÔNG theo
-- exam_rating_aggregate (:1566-1567): exam_rating_aggregate cấp cho anon vì
-- một view security_invoker gọi nó THAY MẶT anon và nếu không sẽ 42501 thay vì
-- trả rỗng; không gì vô danh gọi hàm này, và `/exams` không nằm trong
-- PUBLIC_PATHS.
revoke all on function public.exam_hot_counts(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.exam_hot_counts(timestamptz, timestamptz, int) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 20. COMMUNITY SOLUTIONS — Phase 1: nền tảng + nội dung cốt lõi + đường ghi +
--     RPC cho màn viết (Bài giải cộng đồng, backend Design Doc v1.9 § Data
--     Contracts, work plan task 03 — docs/plans/tasks/20260917-feature-
--     community-solutions-backend-task-03.md).
--
--     ADR-0021 Decision 3: admin_users + is_admin_user() là danh tính admin
--     DB-NATIVE mới, KHÔNG chạm SOURCE/lib/supabase/service-role.ts (TD-029,
--     ADR-0019 — bề mặt đó đứng nguyên 13 export / 4 lượt ghi thẳng). Mọi bảng
--     nội dung mới ở dưới (community_solutions, community_solution_notes,
--     community_moderation_log) bật RLS + revoke sạch anon/authenticated —
--     đường đọc/ghi duy nhất là các hàm SECURITY DEFINER dưới đây, và MỖI hàm
--     tự suy lại gate R1 (đề đã published, tác giả không bị ban, người gọi đã
--     nộp bài trên đề đó) trong chính thân hàm, không tin RLS đã lọc thay —
--     đúng tiền lệ exam_answer_key() ở §10a. admin_users.user_id là dữ liệu
--     NGOÀI file này, nạp riêng theo TỪNG project Supabase (dev/prod có
--     auth.users khác nhau) — không bao giờ là literal trong file idempotent
--     này (ADR-0021 § Facts verified, § Implementation Guidance).
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 21. COMMUNITY SOLUTIONS — Phase 2: RPC đọc list/detail có che danh tính +
--     ghim bài + bảng/RPC "Hữu ích" + khối bảng bình luận/báo cáo (backend
--     Design Doc v1.9 § Data Contracts, work plan task 13 — docs/plans/tasks/
--     20260917-feature-community-solutions-backend-task-13.md).
--
--     Ba bảng community_solution_helpfuls, community_solution_comments,
--     community_content_reports NGAY PHÍA TRÊN cố ý KHÔNG có một dòng comment
--     nào đứng ngay trước từng khối: SOURCE/lib/schema/splitStatements.ts gộp
--     một comment đứng ngay trên một câu lệnh vào chính văn bản câu lệnh đó,
--     nên ba khối này phải giữ NGUYÊN VĂN đúng SQL của backend DD § Data
--     Contracts "SECURITY DEFINER user-write RPCs: Helpful, comments,
--     reports", không thêm một dòng comment nào phía trên. community_solution_
--     comments và community_content_reports ở đây CHỈ có khối bảng — quyết
--     định phân rã R2: community_solutions_list và community_solution_detail
--     dưới đây là hàm `language sql`, thân hàm được Postgres phân giải ở
--     ngay thời điểm CREATE, nên hai bảng này phải tồn tại trước khi hai hàm
--     đọc được tạo; RPC GHI của hai bảng đó (post_/delete_community_comment,
--     report_community_solution/report_community_comment) sang task 25 và
--     task 32 — không phải ở đây. Cả ba bảng: RLS bật, MỌI quyền thu hồi khỏi
--     anon/authenticated, KHÔNG policy nào, KHÔNG grant nào (ADR-0021 Decision
--     2, U1 — engineer quyết 2026-09-17, backend DD v1.9 § Migration
--     Strategy) — đường ghi duy nhất của Helpful là hai RPC add_/remove_
--     community_solution_helpful ở cuối khối này; bình luận và báo cáo giữ
--     nguyên trạng thái đóng (không policy, không grant) cho TRỌN VẸN tính
--     năng — không migration nào sau đây được thêm một policy hay một grant
--     lên ba bảng này.
-- ----------------------------------------------------------------------------

-- community_solutions_list — Reference Contract Value #3 ghim đúng order by;
-- AC-062/AC-039: danh tính che theo show_profile, KHÔNG có ngoại lệ cho chính
-- người viết; score/score_grading gộp chung một cổng show_score.
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

-- community_solution_detail — Reference Contract Value #14 ghim đúng 14 cột
-- header / 11 cột mỗi câu / 11 cột mỗi bình luận (backend DD v1.10 § Data
-- Contracts, "Output columns"). Hình dạng thân hàm là chi tiết triển khai của
-- CHÍNH task này (DD để ngỏ có chủ đích — xem đoạn cuối § `community_solution_
-- detail`); mọi điều kiện che/đếm/hiện dưới đây COPY nguyên các "Invariants"
-- nhị phân của DD, không phải suy diễn mới: Solution identity condition,
-- Comment identity condition, Solution status condition for comments, Comment
-- note condition, Comment row condition, Hidden-comment columns, Comment count
-- presence condition, Score-grading condition (CÙNG biểu thức community_
-- solutions_list dùng), Comment count condition. Own-preview (AC-063): người
-- viết đọc bản nháp/bị ẩn của chính mình vẫn qua đúng R1, chỉ nới lỏng điều
-- kiện trạng thái bài giải (status = 'published' or cs.author_id = auth.uid())
-- — mọi comments/comment_count của bản xem trước đó tự về rỗng/null vì cả hai
-- điều kiện trên đều đòi cs.status = 'published'.
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

-- set_community_solution_pin — AC-078: hoán đổi ghim nguyên tử (gỡ-rồi-đặt
-- trong cùng một transaction hàm), có khoá unique một-phần của task 03 làm
-- chốt chặn độc lập thứ hai.
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

-- Mọi Helpful/bình luận/báo cáo ghi chỉ qua RPC SECURITY DEFINER — ba bảng
-- giữ nguyên trạng thái đóng (RLS bật, mọi quyền thu hồi, không policy):
-- policy không tải nổi các lượt ghi này vì biểu thức policy chạy dưới role
-- người gọi, role đó không có quyền gì trên các bảng này hay trên
-- community_solutions. Quy ước chung của cả sáu RPC ghi người dùng: danh tính
-- người gọi CHỈ lấy từ auth.uid(), không tham số nào mang id người dùng; mọi
-- lượt từ chối raise đúng MỘT message errcode 42501 cho mỗi hàm; cột bảng
-- được alias-qualify vì cột RETURNS TABLE là biến PL/pgSQL
-- (plpgsql.variable_conflict mặc định error).
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

-- ----------------------------------------------------------------------------
-- 24. COMMUNITY SOLUTIONS — Phase 5: avatar của tác giả cộng đồng ký được cho
--     người dùng ĐÃ ĐĂNG NHẬP khác (backend Design Doc v1.9 § Data Contracts
--     "user_profiles.community_comments_last_read_at and
--     avatars_select_community_visible", § Minimal Surface Alternatives
--     Element 3 — Phương án A, engineer chốt 2026-09-17; work plan task 40 —
--     docs/plans/tasks/20260917-feature-community-solutions-backend-task-40.md).
--
--     CỘNG THÊM vào bốn policy avatars_*_own của ADR-0016 ở trên — không sửa
--     policy nào trong số đó (avatars_select_own giữ nguyên từng byte). Policy
--     Storage được OR với nhau, nên policy mới chỉ NỚI thêm người ký được,
--     không bao giờ thu hẹp đường chính chủ đọc ảnh của mình.
--
--     Vì sao KHÔNG phải kịch bản Kill Criteria của ADR-0016 (vốn đòi một ADR
--     mới): bucket vẫn private, policy chỉ `to authenticated` (anon không bao
--     giờ ký được), và vẫn là signed URL ngắn hạn — không có đường đọc
--     "public author profile" hay đọc không đăng nhập nào.
--
--     Cột cộng thêm user_profiles.community_comments_last_read_at đi cùng khối
--     DD này đã thuộc task 25 (§22) — KHÔNG lặp lại ở đây.
-- ----------------------------------------------------------------------------
create or replace function public.community_avatar_owner_visible(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_solutions cs
    join public.exams e on e.id = cs.exam_id
    where cs.author_id = p_owner_id and cs.status = 'published' and cs.show_profile
      and e.status = 'published' and not public.is_author_banned(e.author_id)
  ) or exists (
    select 1 from public.community_solution_comments c
    join public.community_solutions cs on cs.id = c.solution_id
    join public.exams e on e.id = cs.exam_id
    where c.author_id = p_owner_id and c.status = 'visible' and not c.is_anonymous
      -- S7 / AC-071: not under a draft or hidden solution. AC-047: not under a
      -- question removed from the exam. AC-048: only under a note of at least
      -- 15 words. S4: not the writer's own comment on a solution whose profile
      -- is hidden.
      and cs.status = 'published' and c.question_id = any(e.question_ids)
      and exists (
        select 1 from public.community_solution_notes n
        where n.solution_id = c.solution_id and n.question_id = c.question_id
          and public.count_words(n.body) >= 15
      )
      and (cs.author_id <> c.author_id or cs.show_profile)
      and e.status = 'published' and not public.is_author_banned(e.author_id)
  );
$$;
revoke all on function public.community_avatar_owner_visible(uuid) from public, anon;
grant execute on function public.community_avatar_owner_visible(uuid) to authenticated;

-- Additive to ADR-0016's avatars_select_own — does not modify it. Scoped
-- narrowly: visible only when the owning account currently has >=1
-- non-anonymous published solution, or non-anonymous visible comment under a
-- published solution, a current question and a note of at least 15 words (not
-- the writer's own comment on a solution whose profile is hidden), on a
-- published exam whose author is not banned. Any
-- reader who reaches this policy has ALREADY passed this feature's own R1
-- gate to learn the object path in the first place (via a masking RPC) —
-- this policy only has to answer "may Storage sign this path," not
-- re-derive R1 itself.
drop policy if exists "avatars_select_community_visible" on storage.objects;
create policy "avatars_select_community_visible" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars'
    and public.community_avatar_owner_visible(((storage.foldername(name))[1])::uuid)
  );

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

-- ----------------------------------------------------------------------------
-- 26. COMMUNITY SOLUTIONS — kệ "Lời giải cộng đồng mới nhất" cho trang chủ
--     (F-041, engineer 2026-09-30). RPC RIÊNG, không mở rộng
--     community_solutions_list: hàm đó lọc theo ĐÚNG MỘT p_exam_id và không
--     nhận limit; kệ trang chủ cần N bài mới nhất XUYÊN NHIỀU đề.
--
--     Cùng cổng "đủ điều kiện" với community_solutions_list (S-03/R2): một bài
--     giải chỉ lọt vào feed của NGƯỜI GỌI nếu người đó đã NỘP đúng đề đó — feed
--     vì thế CÁ NHÂN HOÁ theo eligibility, không phải một feed giống nhau cho
--     mọi người. Thiếu cổng này thì một học sinh CHƯA làm đề sẽ thấy preview
--     lời giải của đề đó ngay trên trang chủ — lộ đáp án trước khi làm, đúng
--     rủi ro mà community_solutions_list đã chặn.
--
--     Danh tính che theo show_profile — không ngoại lệ, kể cả chính người viết
--     (AC-062/AC-039, cùng quy tắc community_solutions_list). Hình dạng trả về
--     CỐ Ý gọn hơn community_solutions_list (không comment_count/score/
--     is_mine/changed_question_count): đây là một tấm thẻ GIỚI THIỆU trên
--     trang chủ, bấm vào mới sang màn xem đầy đủ.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 27. COMMUNITY SOLUTIONS — trả lời gắn với bình luận (một cấp, hướng C;
--     docs/design/community-solutions-comment-replies.md).
--
--     APPEND-ONLY có chủ đích: các hàm dưới đây ĐÃ nằm trong §21–§23 (đã áp lên
--     dev và prod). Test migrationsMatchSchema đòi mọi câu lệnh của mọi migration
--     cũ còn nguyên trong file này, nên bản cũ giữ lại ở chỗ cũ và bản mới được
--     tạo lại ở đây (drop + create) — chạy tuần tự từ trên xuống cho đúng kết quả.
--
--     parent_id   = bình luận GỐC của mạch (null = chính nó là gốc).
--     reply_to_id = bình luận cụ thể được trả lời (có thể là một câu trả lời).
--     status 'deleted' = dòng mờ của gốc đã xoá mà còn trả lời: thân rỗng, báo
--     cáo đã xoá; không bao giờ hiện danh tính/nội dung (detail che hết).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 28. COMMUNITY SOLUTIONS — "Bài giải của tôi" cho tab Hồ sơ (2026-10-03,
--     docs/plans/20261003-feature-profile-solutions-tab.md).
--
--     Không hàm nào có sẵn liệt kê bài giải của CHÍNH người gọi xuyên nhiều
--     đề: community_solution_for_writer / _result_card nhận đúng MỘT p_exam_id,
--     community_solutions_list cũng vậy, còn bảng community_solutions bị
--     `revoke all` với authenticated. Hàm này là đường đọc duy nhất cho tab.
--
--     Không tham số: chỉ auth.uid(), nên không lượt gọi nào xem được bài của
--     người khác (cùng quy ước community_reputation_summary). Trả MỌI trạng
--     thái của bài (nháp, đã đăng, bị ẩn) — đây là bài CỦA người gọi, không
--     phải feed công khai nên không cần cổng "đã nộp đề" để che đáp án.
--
--     attempt_id dùng ĐÚNG công thức community_solution_for_writer
--     (coalesce(linked_attempt_id, lượt nộp mới nhất)): URL trang viết đòi
--     attemptId khớp giá trị đó, sai thì trang redirect. NULL khi không còn lượt
--     nộp nào (lượt bị xoá) — khi đó frontend không dựng nút Sửa.
--
--     exam_visible = đề đang published và tác giả đề không bị ban — cùng biểu
--     thức community_my_comment_feed. Frontend dùng nó để không bao giờ dựng
--     liên kết tới đề đã ẩn (trang viết/xem sẽ redirect).
--
--     Trần 100 dòng, mới cập nhật nhất trước: mỗi người tối đa một bài mỗi đề.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 17. Phiên bản schema — DB tự khai nó đang chạy bản nào (2026-08-07).
--
--     Vì sao có phần này (TECH-DEBT TD-005): file này được paste TAY vào SQL
--     Editor. Không có bản ghi "môi trường nào đang ở phiên bản nào", nên code
--     và DB lệch nhau mà KHÔNG có gì báo. Đã xảy ra thật hai lần:
--       - bản vá §10: code chuyển sang RPC trong khi DB chưa có hàm;
--       - bản vá cascade 2026-08-04 (bug xoá đề): áp lên prod, QUÊN dev. Suốt
--         3 ngày Preview deploy vẫn chết 23503 trong khi tsc/vitest/verify đều
--         xanh — vì không cổng nào biết dev đang chạy bản nào.
--
--     Từ nay `verify:schema` và `instrumentation.ts` đọc bảng này và so với vân
--     tay của schema.sql trong git. Lệch = có người quên paste, và nó nói ra.
--
--     ⚠ ĐÂY KHÔNG PHẢI MIGRATION TOOL. Không thứ tự áp, không rollback, không
--     biết đi từ bản A sang bản B. Nó trả lời đúng MỘT câu: "DB này có đang
--     chạy đúng file schema.sql trong git không?". Trả nợ trọn vẹn TD-005 vẫn
--     là Supabase CLI migrations.
-- ----------------------------------------------------------------------------
create table if not exists public.schema_version (
  id          smallint primary key default 1 check (id = 1),
  fingerprint text not null,
  applied_at  timestamptz not null default now()
);

-- Sơ đồ hệ thống, không phải dữ liệu người dùng — không có lý do gì để trình
-- duyệt đọc được. RLS bật + KHÔNG policy nào = anon/authenticated không thấy
-- gì; service_role bỏ qua RLS nên `verify:schema` và server vẫn đọc được.
alter table public.schema_version enable row level security;
revoke all on public.schema_version from anon, authenticated;

-- Khối dưới đây PHẢI là câu lệnh CUỐI CÙNG của file, cố ý: nếu paste bị đứt
-- giữa chừng (timeout, lỗi ở §nào đó), vân tay KHÔNG được ghi — DB thà không
-- biết mình là bản nào, còn hơn khai nhận một bản nó chưa chạy hết.
--
-- Nội dung giữa hai marker KHÔNG tính vào vân tay (nếu tính thì băm chứa chính
-- nó — xem lib/schema/schemaFingerprint.ts).
-- @schema-fingerprint-begin
insert into public.schema_version (id, fingerprint)
values (1, 'b9f0a4ee8211')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
-- @schema-fingerprint-end
