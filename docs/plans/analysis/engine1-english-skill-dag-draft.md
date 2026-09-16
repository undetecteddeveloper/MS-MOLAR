# Engine 1 — English (Tiếng Anh) Skill DAG Draft

Status: **Tự rà theo corpus, đã seed — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Tiếng Anh từ 2025 (40 câu trắc nghiệm: điền từ vào thông báo/quảng cáo, sắp xếp câu thành đoạn/hội thoại, đọc điền từ, điền câu vào đoạn, đọc hiểu) và dạng đề kiểm tra ở trường (vẫn còn ngữ âm, giao tiếp, viết lại câu, nghe). Corpus THẬT: **40 câu** một đề "Đề thi học kì 2 — đề số 1" Tiếng Anh 11 — trên dev với `subject='English'`; trên prod bản upload này `status=failed` và `subject=''` nên KHÔNG gắn thẻ được theo môn (ghi ở tổng kết). Nội dung: phát âm (3) + trọng âm (3), ngữ pháp (≈6: danh động từ, câu hỏi đuôi, giới từ), từ vựng (≈6), giao tiếp (2), nghe Đ/S (5), đọc điền từ (≈5), đọc hiểu (5), viết lại câu (5, dạng tự luận).

**Chia theo KỸ NĂNG, không theo chủ đề từ vựng:** đề tiếng Anh không phân theo "đơn vị bài học" như STEM; một học sinh yếu "viết lại câu" cần luyện cấu trúc, yếu "đọc hiểu" cần luyện chiến lược đọc — đó là thứ giáo viên gọi tên.

9 node, tiền tố `anh-`.

## Danh sách node

| id | labelVi | Lớp |
|---|---|---|
| `anh-ngu-am` | Ngữ âm: phát âm và trọng âm | 10–12 |
| `anh-ngu-phap` | Ngữ pháp | 10–12 |
| `anh-tu-vung` | Từ vựng: nghĩa của từ, dạng từ, cụm từ cố định, đồng nghĩa và trái nghĩa | 10–12 |
| `anh-giao-tiep` | Chức năng giao tiếp: đáp lời trong hội thoại | 10–12 |
| `anh-doc-dien-tu` | Đọc điền từ vào đoạn văn | 10–12 |
| `anh-doc-hieu` | Đọc hiểu văn bản | 10–12 |
| `anh-lien-ket-van-ban` | Sắp xếp câu và điền câu vào đoạn: liên kết văn bản | 10–12 |
| `anh-viet-lai-cau` | Viết lại câu, chuyển đổi câu và nối câu | 10–12 |
| `anh-nghe-hieu` | Nghe hiểu | 10–12 |

## Cạnh tiên quyết (prerequisite edges)

Chỉ ba cạnh có thứ tự học thật: điền từ đòi cả vốn từ lẫn ngữ pháp; viết lại câu đòi cấu trúc ngữ pháp. Đọc hiểu, giao tiếp, nghe, ngữ âm không có tiên quyết rõ ràng nên là node gốc.

| `skill_node_id` | `prerequisite_node_id` |
|---|---|
| `anh-doc-dien-tu` | `anh-tu-vung` |
| `anh-doc-dien-tu` | `anh-ngu-phap` |
| `anh-viet-lai-cau` | `anh-ngu-phap` |

Node gốc: `anh-ngu-am`, `anh-ngu-phap`, `anh-tu-vung`, `anh-giao-tiep`, `anh-doc-hieu`, `anh-lien-ket-van-ban`, `anh-nghe-hieu`.

## Kiểm tra nhanh

- 9 node, 3 cạnh; DAG hợp lệ (test). ✓
- Corpus 40 câu phủ 8/9 node; chỉ `anh-lien-ket-van-ban` (dạng mới của đề 2025) chưa có câu thật. ✓

## Điểm cần người duyệt để mắt

- 4 câu trong corpus có `content` RỖNG (câu điền từ mà đề gốc để chỗ trống ngay trong đoạn văn, bộ trích xuất không tách được stem) — model sẽ trả no-matching-node hoặc confidence thấp → NULL. Đúng hành vi, không phải lỗi taxonomy.
- Câu nghe (5 câu Đ/S "Listen to part of a news report…") không có audio trong app; gắn `anh-nghe-hieu` vẫn đúng bản chất câu hỏi.
- Ranh giới `anh-ngu-phap` ↔ `anh-tu-vung` với câu điền giới từ/cụm động từ: quy ước ở prompt "giới từ đi theo động từ/tính từ cố định → từ vựng; thì, dạng động từ, mệnh đề → ngữ pháp".

## Product Owner Approval

- [ ] **Đã duyệt**
- [ ] **Cần sửa**
