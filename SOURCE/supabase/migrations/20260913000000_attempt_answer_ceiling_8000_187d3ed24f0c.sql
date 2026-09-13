-- MIGRATION — trần bài làm tự luận 4000 → 8000 (2026-09-13).
--
-- Vì sao: engineer test trên điện thoại thật thấy ô viết bài Ngữ văn vẫn dừng
-- ở "Còn 4000 ký tự". Trần trong mã nay NỚI THEO MÔN (lib/ugc/limits.ts
-- `MAX_ATTEMPT_ANSWER_BY_SUBJECT`: Ngữ văn, Tiếng Anh 8000; còn lại 4000).
-- DB không biết môn nên CHECK phải chứa được bài dài nhất mã cho gõ — bằng
-- `attemptAnswerDbCeiling()` = 8000. Trần DB nâng TRƯỚC rồi mới deploy mã
-- (limits.ts giải thích hai hướng lệch không đối xứng: mã cao hơn DB là
-- Postgres từ chối NGUYÊN lượt nộp bài).
--
-- Không đổi dữ liệu: nới CHECK không đụng dòng nào đã có (mọi dòng ≤ 4000 vẫn
-- thoả ≤ 8000).
--
-- Áp bằng Supabase CLI (`db query --file`, đa câu lệnh OK) hoặc TỪNG CÂU MỘT
-- nếu qua công cụ khác (TD-005). Xong thì đọc lại bằng TRUY VẤN THẬT:
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'attempt_answers_answer_check';   -- ... length(answer) <= 8000
--   select fingerprint from public.schema_version;      -- phải trả 187d3ed24f0c
-- Prod: SO vân tay trước khi áp (Pha 3.5) — `eab3b6e1534a` là bản ngay trước.

alter table public.attempt_answers drop constraint if exists attempt_answers_answer_check;

alter table public.attempt_answers add constraint attempt_answers_answer_check
  check (answer is null or length(answer) <= 8000);

insert into public.schema_version (id, fingerprint)
values (1, '187d3ed24f0c')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
