-- MIGRATION — `questions.points` NULLABLE. 2026-09-02.
--
-- LỖI ĐÃ XẢY RA THẬT trên prod (dpl_4HVffjjtfA2ySpafmMWkbrenZheP, 13:59 UTC),
-- và giống hệt trên dev. Upload đề Ngữ văn 10 cuối kì II (THPT Nguyễn Quốc
-- Trinh) chết ở bước lưu với thông báo "Could not save the questions. Try
-- again."; log server:
--
--     [extractAndAssemble] insert questions:
--     null value in column "points" of relation "questions"
--     violates not-null constraint
--
-- NGUYÊN NHÂN — hai mảnh gặp nhau:
--
--   1. Đề TRỘN hai loại câu. Phần Viết in điểm ngay trên đề (Câu 1 = 2,0 · Câu
--      2 = 4,0); 5 câu Đọc hiểu KHÔNG in điểm nào. `extractQuestions` để
--      `points` undefined cho 5 câu ấy — đúng như prompt dặn ("NEVER guess a
--      mark"), vì một con điểm bịa ra là một con điểm sai của học sinh thật.
--
--   2. PostgREST gom một MẢNG row thành MỘT câu INSERT với danh sách cột
--      CHUNG. Row nào thiếu khoá thì cột ấy nhận NULL — KHÔNG rơi về default
--      của cột. Chỗ ghi trong actions.ts spread `points` có điều kiện, nên
--      mảng row của đề này có row mang khoá và row không, và 5 câu Đọc hiểu
--      nhận NULL vào một cột `not null`.
--
-- Vì sao tới hôm nay mới lộ: đề trước giờ đều ĐỒNG NHẤT. Mọi câu đều không in
-- điểm → cột vắng hẳn khỏi INSERT → default 1 áp, chạy được. Mọi câu đều in
-- điểm → cũng chạy được. Đề trộn là ca đầu tiên, và nó không phải ca biên: đề
-- tự luận Ngữ văn nào cũng có hình dạng ấy.
--
-- BẢN VÁ NÀY sửa mảnh thứ nhất — cho cột nói được "chưa biết". Mảnh thứ hai
-- sửa trong cùng lượt commit ở app/(layer4)/actions.ts: khoá `points` nay có
-- mặt ở MỌI row (`q.points ?? null`), nên ba ca trên hợp thành một đường chạy.
--
-- HAI ĐẦU ĐỌC ĐÃ SẴN SÀNG CHO NULL TỪ B1, chỉ riêng cột là chưa:
--   · lib/ugc/fromRows.ts        — `typeof row.points === "number" ? … : undefined`
--   · lib/scoring/questionPoints.ts — maxPointsOf() quy về DEFAULT_QUESTION_POINTS
--
-- GIỮ DEFAULT 1, chỉ bỏ NOT NULL. Đây là điều kiện để bản vá không chạm ai
-- khác: mọi chỗ insert KHÔNG khai cột (supabase/seed.ts, fixture của test)
-- vẫn nhận 1 y như trước; chỉ khoá khai TƯỜNG MINH null mới ra null. Không
-- một row đang tồn tại nào đổi giá trị, nên AC-012 (lượt thi cũ chấm lại phải
-- ra đúng con số cũ) giữ nguyên — không cần backfill, không cần đường lui.
--
-- `questions_points_check` KHÔNG cần sửa: trong Postgres một CHECK trả NULL là
-- THOẢ, nên `points > 0` vẫn chặn 0 và số âm mà vẫn cho null đi qua.
--
-- Đề PUBLISHED không bao giờ mang null: validatePointsForPublish() bắt mọi câu
-- phải có điểm > 0 và tổng đủ 10 trước khi cho publish. Null chỉ sống ở đề
-- đang ở 'review'/'failed' — đúng chỗ tác giả nhìn thấy ô trống và điền vào.
--
-- ÁP TỪNG CÂU LỆNH MỘT (TD-005). Xong thì đọc lại bằng TRUY VẤN THẬT:
--   select is_nullable, column_default from information_schema.columns
--    where table_schema='public' and table_name='questions' and column_name='points';
--   -- phải trả:  YES | 1
--   select fingerprint from public.schema_version;  -- phải trả 92e1574f1013

alter table public.questions alter column points drop not null;

insert into public.schema_version (id, fingerprint)
values (1, '92e1574f1013')
on conflict (id) do update
  set fingerprint = excluded.fingerprint,
      applied_at  = now();
