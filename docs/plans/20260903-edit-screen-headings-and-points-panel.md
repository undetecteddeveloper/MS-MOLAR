# Màn sửa đề: subheading luôn có + panel gán điểm hàng loạt

> **Trạng thái:** chốt phạm vi 2026-09-03. Thuần frontend + một đường ghi mới
> cho `exams.parts`. KHÔNG đụng schema, KHÔNG đụng luật chấm.
>
> **Vì sao plan ngắn:** cả hai việc chạy trên dữ liệu ĐÃ CÓ (`exams.parts` do
> extract ghi từ v2.1/ADR-0005; `questions.points` do B1 thêm 2026-09-01) và
> không đổi bất biến nào của tầng chấm. Phần "tại sao" của luật chia điểm nằm
> trong comment + test tại `lib/ugc/distributePoints.ts`, không nhân bản ở đây.

---

## Vấn đề

**H1 — Đề một phần không có heading nào.** `AssembledQuestionList.tsx` có hai
nhánh: đề nhiều phần render `<section><h2>` theo `exams.parts`, đề một phần
render phẳng một `<ul>`. Nghĩa là màn sửa đề KHÔNG có cấu trúc ổn định — tính
năng sau muốn bám vào ranh giới nhóm câu thì phải tự đoán lại. Và khi AI đọc
sai/thiếu tiêu đề phần, tác giả không có đường sửa: `exams.parts` chỉ được ghi
đúng MỘT lần lúc extract (`actions.ts:565`), `SaveExamPatch` không mang nó.

**H2 — Biểu điểm chỉ nhập được từng ô một.** B1 buộc mọi câu có `points > 0` và
tổng đúng 10 trước khi publish (`validatePointsForPublish`), nhưng đường nhập
duy nhất là ô số trên từng thẻ câu (`QuestionEditor.tsx:206`). Một đề 40 câu là
40 lượt gõ tay để diễn đạt một câu duy nhất: "phần III đáng 3 điểm".

## Việc

### Nhóm H — Subheading

- `SaveExamPatch.parts` (mirror `passages`: gửi NGUYÊN mảng, không patch từng
  phần tử). `saveExam` chấp nhận, chặn `> MAX_PARTS`, chặn title rỗng/quá dài,
  ghi `exams.parts` bằng một update ĐỘC LẬP với `patch.meta` — đúng lý do đã
  ghi cho `passages` ở `actions.ts:861`.
- `AssembledQuestionList`: bỏ nhánh phẳng. MỌI đề đều nhóm theo `part` và mọi
  nhóm đều có `<h2>`. Đề không chia phần ⇒ một nhóm, mặc định `upload.partLabel`.
- Heading sửa được tại chỗ. Sửa heading của đề chưa có `parts` ⇒ tạo entry
  `{number, title}`; xoá trắng ⇒ gỡ entry, quay về nhãn mặc định.

### Nhóm P — Panel gán điểm

- `lib/ugc/distributePoints.ts` — THUẦN, testable riêng: (tổng, danh sách câu,
  trọng số) → điểm từng câu. Luật làm tròn ghi ngay tại đó.
- `PointsPanel.tsx` — cố định góc dưới phải, thu gọn được (mobile mặc định thu).
  Phạm vi = một phần HOẶC một dãy câu. Nhập tổng → chia đều, hoặc chỉnh trọng số
  từng câu. Hiện tổng chạy `x/10`.
- `ReviewScreen`: handler `onBulkPoints` ghi nhiều câu trong MỘT lượt `setExam`.

## Không làm đợt này

- Đổi số phần / gộp tách phần / chuyển câu giữa các phần. Panel và heading chỉ
  ĐỌC ranh giới phần, không dựng lại nó.
- Nhớ biểu điểm giữa các đề (preset). Chờ có nhu cầu thật.

## Cổng verify

6 cổng chuẩn trong `SOURCE/` + UI audit màn `/me/exams/[id]` ở mobile viewport
(panel thu gọn không được che `PublishBar`).
