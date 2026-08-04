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
  essay_answer   text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.content, q.choices, q.correct_answer,
         q.subject, q.grade, q.topic, q.question_type,
         q.part_number, q.image_url, q.sub_answers, q.essay_answer
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
  essay_answer   text
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
-- 10c. Thu hồi SELECT mức BẢNG rồi cấp lại đúng 9 cột an toàn.
--      Bắt buộc theo thứ tự này: quyền mức bảng phủ mọi cột, nên chỉ
--      `revoke select (correct_answer, ...)` là KHÔNG có tác dụng.
--      `anon` giữ nguyên 9 cột an toàn (RLS `to authenticated` vẫn cho 0 dòng)
--      để hành vi quan sát được của khách vãng lai không đổi: rỗng, không lỗi.
--      INSERT/UPDATE/DELETE KHÔNG đụng tới — tác giả vẫn ghi đáp án đề của
--      mình, RLS questions_*_author giới hạn phạm vi (ghi không đọc được).
-- ----------------------------------------------------------------------------
revoke select on public.questions from anon, authenticated;
grant select (
  id, content, choices, subject, grade, topic, question_type, part_number, image_url
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
-- 12b. View chạy bằng quyền NGƯỜI GỌI. Danh sách cột giữ NGUYÊN (e.* +
--      rating_count + avg_overall, cùng thứ tự, cùng kiểu) — bắt buộc, vì
--      `create or replace view` không cho đổi shape, và vì PostgREST embed
--      xuyên view này trong getResult() (exam_attempts → exams_with_difficulty).
--      Ngưỡng N=3 vẫn là bản sao SQL của RATING_THRESHOLD (SOURCE/lib/rating).
-- ----------------------------------------------------------------------------
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
  actor_id   uuid references auth.users(id),
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists exam_moderation_log_exam_idx
  on public.exam_moderation_log (exam_id, created_at desc);

alter table public.exam_moderation_log enable row level security;
revoke all on public.exam_moderation_log from anon, authenticated;
