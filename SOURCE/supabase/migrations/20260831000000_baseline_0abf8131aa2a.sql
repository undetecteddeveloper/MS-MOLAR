-- BASELINE — ảnh chụp `supabase/schema.sql` tại vân tay 0abf8131aa2a.
--
-- FILE NÀY ĐƯỢC SINH RA, KHÔNG VIẾT TAY, và KHÔNG SINH LẠI. Nguồn duy nhất vẫn
-- là `supabase/schema.sql` (quyết định của engineer 2026-08-31: schema.sql giữ
-- vai canonical, migrations chỉ là CƠ CHẾ ÁP).
--
-- Không có lệnh "sinh lại baseline", có chủ ý: file này mô tả một trạng thái
-- ĐÃ XẢY RA. Sinh lại nó theo một schema.sql mới hơn là viết lại quá khứ, và
-- hai database đã được đánh dấu là đã áp đúng bản này rồi.
--
-- VÌ SAO CÓ MỘT BASELINE THAY VÌ MỘT CHUỖI MIGRATION TỪ ĐẦU. Hai database đã
-- tồn tại và đã có dữ liệu học sinh thật; không có lịch sử migration nào dựng
-- lại được chúng từ số không. Baseline nói đúng một câu: "đây là hình dạng
-- schema tại thời điểm dự án bắt đầu dùng migrations". Nó KHÔNG được chạy lại
-- trên hai DB ấy — nó được đánh dấu ĐÃ ÁP bằng `supabase migration repair`,
-- vì cả hai DB đã ở đúng hình dạng này rồi (kiểm bằng vân tay 0abf8131aa2a đọc
-- từ `public.schema_version` trên cả dev lẫn prod, 2026-08-31).
--
-- MỌI THAY ĐỔI SAU NÀY LÀ MỘT FILE MIGRATION MỚI, không phải một lượt sửa file
-- này. Sửa baseline là nói dối về quá khứ: nó mô tả một trạng thái đã xảy ra.
--
-- Nội dung dưới đây là bản sao NGUYÊN VĂN của schema.sql, gồm cả comment — vì
-- comment là phần có giá trị nhất của file đó, và một baseline bị lột comment
-- sẽ thành một bức tường SQL không ai đọc được.

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
-- docs/design/essay-auto-scoring-backend-design.md § Trần ký tự. Nó PHẢI bằng
-- LIMITS.MAX_ATTEMPT_ANSWER (lib/ugc/limits.ts:17); npm run verify:schema đọc
-- lại trần này từ DB THẬT và đỏ nếu hai bên lệch.
alter table public.attempt_answers drop constraint if exists attempt_answers_answer_check;
alter table public.attempt_answers add constraint attempt_answers_answer_check
  check (answer is null or length(answer) <= 4000);

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
  id, content, choices, subject, grade, topic, question_type, part_number, image_url, skill_node_id
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
                         'essayGradedAt',      to_jsonb(now())
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
values (1, '0abf8131aa2a')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
-- @schema-fingerprint-end
