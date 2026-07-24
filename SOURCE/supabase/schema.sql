-- ============================================================================
-- TrangNguyenDigi — Database Schema (GĐ 2 M2.2)
-- Thiết kế đơn giản theo quyết định C&D Q1=A:
--   - questions/exams chỉ giữ cột cần thiết cho Core Loop.
--   - KHÔNG có confidence_score / quarantine / view published_questions
--     (để dành Post-MVP Layer 4).
-- Cách dùng: paste toàn bộ file này vào Supabase SQL Editor → Run.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- Tham chiếu BACK-END-ARCHITECTURE-MAP.md Mục 3, 4, 8.
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
-- Logic L2 — Core Loop: attempts, answers, results
-- ----------------------------------------------------------------------------

create table if not exists public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id      text not null references public.exams (id),
  status       text not null default 'in_progress',  -- 'in_progress' | 'submitted'
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.attempt_answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.exam_attempts (id) on delete cascade,
  question_id text not null references public.questions (id),
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
alter table public.exams add column if not exists author_id uuid references auth.users(id);
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

alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check
  check (question_type in ('mcq','essay'));
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
alter table public.attempt_answers drop constraint if exists attempt_answers_answer_check;
alter table public.attempt_answers add constraint attempt_answers_answer_check
  check (answer is null or length(answer) <= 500);

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
  score_part1 int not null,                       -- Phần I  (mcq)          1..10
  score_part2 int not null,                       -- Phần II (true_false)   1..10
  score_part3 int not null,                       -- Phần III(short_answer) 1..10
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (exam_id, user_id)                        -- 1 rating / user / đề (upsert khoá)
);

-- Mỗi điểm phần là số nguyên trong [1,10] (AC-002). Một CHECK gộp cả 3 cột.
alter table public.exam_difficulty_ratings drop constraint if exists ratings_scores_range_check;
alter table public.exam_difficulty_ratings add constraint ratings_scores_range_check
  check (
    score_part1 between 1 and 10
    and score_part2 between 1 and 10
    and score_part3 between 1 and 10
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
