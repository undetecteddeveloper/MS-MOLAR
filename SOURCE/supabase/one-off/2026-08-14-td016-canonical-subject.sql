-- TD-016 — đưa questions.subject / exams.subject về giá trị canonical.
--
-- KHÔNG phải một phần của schema.sql: đây là vá DỮ LIỆU, không đổi cấu trúc,
-- nên nó không được đụng vào vân tay §17 (TD-005). Chạy một lần cho mỗi môi
-- trường, paste tay vào Supabase SQL Editor như mọi SQL khác của dự án này.
--
-- BỐI CẢNH (đo trên dev 2026-08-14, service_role):
--   questions: Math 37 · Physics 5 · Chemistry 5 · "Toán" 10
--   exams:     Math 4  · Physics 1 · Chemistry 1 · "Toán" 2
-- 10 câu đó thuộc đúng 2 đề UGC (ugc-f8ec9b8a…, ugc-9c857be4…) do người dùng
-- thật upload lúc 2026-07-20 00:06 và 01:03 UTC — TRƯỚC khi lib/ugc/subjects.ts
-- tồn tại (commit 971a4fe, 2026-07-20 15:33 UTC). Tức là dữ liệu tồn dư của
-- thời chưa có canonical hoá, KHÔNG phải seed.ts như TD-016 từng phỏng đoán.
--
-- `subject` là text tự do — không enum, không khoá ngoại — nên giá trị lạ ghi
-- được bình thường và mọi filter/thống kê theo môn chỉ lặng lẽ bỏ sót nó.
-- Đường ghi đã bịt ở validateExamMeta (2026-08-14); file này dọn phần đã ghi.
--
-- IDEMPOTENT: mệnh đề `<> a.canonical` khiến lần chạy thứ hai không đụng dòng
-- nào. Chạy lại bao nhiêu lần cũng được.

begin;

-- Bảng alias dùng chung cho cả hai lệnh update. Giữ khớp với ALIASES trong
-- lib/ugc/subjects.ts — ở đây chỉ liệt kê dạng CÓ DẤU, đúng như những gì thực
-- sự lọt vào DB; bản đầy đủ (không dấu, viết tắt) là việc của normalizeSubject.
create temporary table td016_alias(raw text primary key, canonical text not null) on commit drop;
insert into td016_alias(raw, canonical) values
  ('Toán', 'Math'), ('Toán học', 'Math'),
  ('Vật lý', 'Physics'), ('Vật lí', 'Physics'),
  ('Hóa học', 'Chemistry'), ('Hoá học', 'Chemistry'),
  ('Sinh học', 'Biology'),
  ('Ngữ văn', 'Literature'),
  ('Tiếng Anh', 'English'),
  ('Lịch sử', 'History'),
  ('Địa lý', 'Geography'), ('Địa lí', 'Geography'),
  ('Tin học', 'Informatics'),
  ('GDCD', 'Civic Education'), ('Giáo dục công dân', 'Civic Education');

-- exams trước (đề là nơi tác giả nhập; questions chỉ là bản cascade xuống).
update public.exams e
set subject = a.canonical
from td016_alias a
where e.subject = a.raw
  and e.subject <> a.canonical;

-- questions: sửa CẢ topic, nhưng CHỈ khi topic đang phản chiếu subject.
-- Lý do: đường UGC đặt `topic := subject` (ADR-0004) nên 32 dòng Math hiện có
-- topic = 'Math'; nếu chỉ sửa subject thì 10 dòng này thành subject='Math' +
-- topic='Toán' — đổi một mảnh vỡ lấy một mảnh vỡ khác, lần này ở facet topic
-- (nơi taxonomy kỹ năng Engine 1 đọc vào). Dòng có topic THẬT ("Hàm số",
-- "Động học"…) không bị đụng: điều kiện `q.topic = q.subject` không khớp.
-- Trong Postgres, vế phải của SET đọc giá trị TRƯỚC update, nên so sánh này
-- dùng đúng subject cũ.
update public.questions q
set subject = a.canonical,
    topic = case when q.topic = q.subject then a.canonical else q.topic end
from td016_alias a
where q.subject = a.raw
  and q.subject <> a.canonical;

commit;

-- Kiểm lại — cả hai phải trả 0 dòng.
select 'questions' as tbl, subject, count(*)
from public.questions
where subject not in ('Math','Physics','Chemistry','Biology','Literature',
                      'English','History','Geography','Informatics','Civic Education')
group by subject
union all
select 'exams', subject, count(*)
from public.exams
where subject not in ('Math','Physics','Chemistry','Biology','Literature',
                      'English','History','Geography','Informatics','Civic Education')
group by subject;
