-- FIX — khôi phục EXECUTE grant đúng cho 3 hàm bị migration trước làm hở.
-- 2026-09-01.
--
-- NGUYÊN NHÂN: migration 20260901000000 chạy `drop function; create function;`
-- cho exam_answer_key/claim_attempt_answer_key/record_essay_grade để đổi
-- RETURNS TABLE (thêm passage_id/points). DB này có
-- `alter default privileges in schema public grant all on functions to anon,
-- authenticated, service_role` (schema.sql §10b giải thích rõ), nên MỌI hàm
-- vừa tạo lại đều tự động mở EXECUTE cho cả ba role đó — kể cả anon.
--
-- Ba dòng revoke/grant khoá đúng ba hàm này ĐÃ CÓ SẴN trong schema.sql (từ
-- baseline), nhưng chúng nằm Ở VỊ TRÍ KHÁC trong file — sau lần drop/create
-- ĐẦU TIÊN (baseline), không sau lần drop/create THỨ HAI (migration này áp
-- lên). Một migration chạy TRƯỚC dòng revoke/grant gốc thì dòng gốc đó không
-- còn tác dụng nữa — nó khoá một phiên bản hàm đã bị drop.
--
-- verify:schema bắt được đúng lỗ hổng này (probe EXECUTE bằng anon key thật):
--   ✗ anon VẪN gọi được exam_answer_key / claim_attempt_answer_key
--   ✗ record_essay_grade: authenticated VÀ anon đều VẪN gọi được
--
-- File MỚI, không sửa migration cũ: Supabase CLI dedupe theo TIMESTAMP ID chứ
-- không theo nội dung — sửa file đã áp sẽ không bao giờ chạy lại trên DB đã áp.

revoke all on function public.exam_answer_key(text)            from public, anon;
revoke all on function public.claim_attempt_answer_key(uuid)   from public, anon;
grant execute on function public.exam_answer_key(text)          to authenticated;
grant execute on function public.claim_attempt_answer_key(uuid) to authenticated;

revoke all on function public.record_essay_grade(uuid, text, text, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.record_essay_grade(uuid, text, text, numeric, numeric, boolean)
  to service_role;
