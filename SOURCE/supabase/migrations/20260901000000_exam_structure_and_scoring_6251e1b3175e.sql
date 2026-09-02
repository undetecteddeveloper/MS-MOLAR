-- MIGRATION — ĐỀ KHỚP ĐỀ NGUYÊN BẢN: cấu trúc (Nhóm A) + luật chấm (Nhóm B).
-- 2026-09-01.
--
-- MỘT file cho cả hai nhóm, có lý do: chúng cùng sửa lại `grant select (…)` của
-- §10c và cùng dựng lại `exam_answer_key()`. `schema.sql` là nguồn canonical và
-- chỉ giữ được BẢN CUỐI của mỗi câu lệnh, nên tách đôi sẽ để lại một migration
-- mang bản trung gian không còn tồn tại ở đâu — đúng thứ cổng
-- `migrationsMatchSchema` bắt. Không mất mát gì: chưa bản nào được apply.
--
-- ═══ NHÓM A — cấu trúc đề (§8d) ═══
--   Đề Tiếng Anh/Ngữ văn gắn MỘT bài đọc cho một NHÓM câu. Pipeline không có
--   chỗ đựng ngữ liệu dùng chung, nên bài đọc bị chép lặp vào `content` từng
--   câu — nguyên nhân thật của 7 lỗi STEM_TOO_LONG trên đề Tiếng Anh 40 câu.
--
-- ═══ NHÓM B — luật chấm (§8e) ═══
--   B1  không có khái niệm "câu này đáng mấy điểm" — mọi câu cân bằng nhau,
--       nên bài NLVH 5 điểm bị đếm ngang bài NLXH 2 điểm.
--   B2  PHẦN II chấm nhị phân cả câu; đúng 3/4 ý được 0 thay vì 0.5đ.
--   B3  điểm tự luận không bao giờ vào ô điểm lớn, nên một lượt thi toàn tự
--       luận ra 0.00 và đề Văn hỗn hợp hiện 10.0/10 trên bài đáng 4.75/10.
--
-- Giải thích ĐẦY ĐỦ ở supabase/schema.sql §8d và §8e; file này chỉ là cơ chế áp.
-- Mọi cột mới đều nullable hoặc có default ⇒ row cũ tự đúng, KHÔNG backfill bảng.
--
-- ⚠ SAU KHI APPLY, CHẠY BACKFILL ĐIỂM — bản vá này KHÔNG tự tính lại điểm cũ:
--     npx tsx scripts/backfill-scores.ts            # dry-run, in bảng cũ→mới
--     npx tsx scripts/backfill-scores.ts --apply    # ghi thật
--   Bỏ qua bước đó = hai thang điểm sống chung trong một cột `total_score`.

-- ── Nhóm A ──────────────────────────────────────────────────────────────────
alter table public.exams add column if not exists passages jsonb;
alter table public.questions add column if not exists passage_id text;

-- ── Nhóm B ──────────────────────────────────────────────────────────────────
alter table public.questions add column if not exists points numeric not null default 1;
alter table public.questions drop constraint if exists questions_points_check;
alter table public.questions add constraint questions_points_check check (points > 0);

-- Đường lui của backfill. Nullable, row mới để null.
alter table public.exam_results add column if not exists total_score_legacy numeric;

-- §10c — cấp lại quyền đọc kèm hai cột mới. `passage_id` là khoá tra ngữ liệu,
-- `points` là trọng số câu: cả hai là dữ liệu HIỂN THỊ, không phải đáp án.
-- Thiếu dòng này thì verify:schema đỏ "cột KHÔNG có đường đọc nào".
revoke select on public.questions from anon, authenticated;

grant select (
  id, content, choices, subject, grade, topic, question_type, part_number, image_url, skill_node_id,
  passage_id, points
) on public.questions to anon, authenticated;

-- §10a — hàm trả đáp án phải trả thêm `passage_id` (màn review của tác giả và
-- màn Chi tiết sau khi nộp dựng lại câu hỏi từ đây) và `points` (`submitExam()`
-- chấm bài từ đây — thiếu nó thì MỌI đề chấm như nhau và cả B1 vô tác dụng).

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

-- §10b — PHẢI dựng lại theo: thân hàm uỷ quyền bằng
-- `return query select * from public.exam_answer_key(…)`, nên RETURNS TABLE của
-- nó phải khớp 10a TỪNG CỘT. Lệch một cột là Postgres từ chối hàm LÚC CHẠY
-- ("structure of query does not match function result type") và cả tính năng
-- nộp bài chết — không cổng nào của repo bắt được lỗi đó.

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

-- §11c — B3: hàm ghi band nay tính lại luôn `total_score`. Trước bản này nó chỉ
-- đụng `per_question` và KHÔNG BAO GIỜ đụng `total_score` — đó chính là mấu chốt
-- khiến điểm tự luận không bao giờ vào ô điểm lớn dù vẫn được chấm.
--
-- KHÔNG phải chép luật chấm điểm sang SQL: mọi quy tắc đã được TypeScript quyết
-- định và đóng băng thành `earnedPoints`/`maxPoints` trên từng phần tử; câu lệnh
-- chỉ CỘNG hai trường số rồi chia. (Ngưỡng đếm của TD-029 nổ ở đây — đã ghi vào
-- TECH-DEBT.md và ADR-0018 § Amendment 2026-09-01.)

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

-- §17 — DẤU VÂN TAY ĐÃ CHUYỂN SANG MIGRATION MỚI NHẤT (2026-09-01, khi
-- 20260901020000_recreate_exams_with_difficulty_view_* được thêm).
--
-- Trước đây file này tự đóng dấu '6251e1b3175e'. Con số đó nay KHÔNG CÒN ĐÚNG:
-- schema.sql đã đổi (dựng lại view `exams_with_difficulty`) nên vân tay của nó
-- là 'a667c85693bc'. Giữ dòng cũ lại thì file này khai một trạng thái không còn
-- tồn tại ở đâu, và cổng `migrationsMatchSchema` đỏ đúng vì lẽ đó.
--
-- Bỏ đi KHÔNG mất gì: dấu vân tay là trạng thái CUỐI của cả chuỗi migration,
-- không phải của từng bước, nên chỉ file cuối cần đóng dấu. Một DB áp đủ chuỗi
-- (baseline → 000000 → 010000 → 020000) vẫn kết thúc ở đúng vân tay hiện tại.
--
-- QUY ƯỚC TỪ NAY: chỉ migration MỚI NHẤT mang khối §17. Thêm migration mới thì
-- gỡ khối này khỏi file trước đó — nếu không, cổng sẽ đỏ ở đúng chỗ này.
