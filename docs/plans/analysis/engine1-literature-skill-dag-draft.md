# Engine 1 — Literature (Ngữ văn) Skill DAG Draft

Status: **Tự rà theo corpus, đã seed — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Ngữ văn từ 2025 — 100% tự luận, hai phần: **Đọc hiểu** (4 điểm, 5 câu trên một ngữ liệu NGOÀI sách giáo khoa: văn học hoặc nghị luận/thông tin) và **Viết** (6 điểm: một đoạn văn ≈200 chữ + một bài văn ≈600 chữ, luân phiên nghị luận văn học / nghị luận xã hội). Corpus THẬT trên prod 2026-09-16: **7 câu** (một đề "Kiểm tra cuối học kì II" Văn 10): 4 câu đọc hiểu bài thơ (nhân vật trữ tình, hình ảnh, ý nghĩa câu thơ, liên hệ), 1 câu "chỉ ra và nêu tác dụng của biện pháp tu từ", 1 đoạn NLVH 200 chữ, 1 bài NLXH 600 chữ. Dev: 0 câu.

**Chia theo KỸ NĂNG, không theo tác phẩm hay theo mức độ nhận thức:** ngữ liệu ngoài SGK nên "tác phẩm" không còn là dạng bài; mức độ (nhận biết/thông hiểu/vận dụng) là thang chấm chứ không phải thứ học sinh luyện riêng. Học sinh luyện "đọc thơ", "đọc truyện", "viết NLXH" — đó là dạng bài giáo viên gọi tên.

**Vì sao chỉ 6 node và 0 cạnh:** corpus 7 câu và không có thứ tự học nào bảo vệ được (viết NLVH cần đọc hiểu — nhưng đọc hiểu thể loại nào? mọi cạnh đều là đoán). Ghi rõ đây là môn ít bằng chứng nhất sau Sử.

**Lưu ý về số liệu:** câu tự luận có `scored: false`, nên "% đúng theo dạng bài" của Văn chỉ tính được từ câu đọc hiểu chấm tự động (trả lời ngắn có đáp án). Thẻ "Kết quả theo môn" đã hiện điểm trung bình cho Văn thay cho đúng/sai; thẻ dạng bài sẽ thưa cho môn này — đúng bản chất, không phải lỗi.

6 node, tiền tố `van-`.

## Danh sách node

| id | labelVi | Lớp |
|---|---|---|
| `van-doc-hieu-tho` | Đọc hiểu văn bản thơ | 10–12 |
| `van-doc-hieu-truyen-ki-kich` | Đọc hiểu văn bản truyện, kí và kịch | 10–12 |
| `van-doc-hieu-nghi-luan-thong-tin` | Đọc hiểu văn bản nghị luận và văn bản thông tin | 10–12 |
| `van-tieng-viet` | Thực hành tiếng Việt: biện pháp tu từ, từ ngữ, ngữ pháp và lỗi câu | 10–12 |
| `van-nghi-luan-van-hoc` | Viết đoạn văn, bài văn nghị luận văn học | 10–12 |
| `van-nghi-luan-xa-hoi` | Viết đoạn văn, bài văn nghị luận xã hội | 10–12 |

## Cạnh tiên quyết (prerequisite edges)

Không có. Bảng để trống có chủ ý — `validateDag()` chấp nhận tập cạnh rỗng (test riêng).

| `skill_node_id` | `prerequisite_node_id` |
|---|---|

## Kiểm tra nhanh

- 6 node, 0 cạnh. ✓
- Corpus prod 7 câu: 4 → `van-doc-hieu-tho`, 1 → `van-tieng-viet` (biện pháp tu từ hỏi trên ngữ liệu thơ — quy ước "kỹ năng CHÍNH là tu từ"), 1 → `van-nghi-luan-van-hoc`, 1 → `van-nghi-luan-xa-hoi`. ✓ (rà tay)

## Điểm cần người duyệt để mắt

- Ranh giới `van-tieng-viet` ↔ `van-doc-hieu-*`: câu tu từ hỏi trên ngữ liệu đọc hiểu có thể được model xếp về đọc hiểu với confidence ≈0.85–0.95. Đây là chỗ mờ nhất; kỳ vọng vài câu rơi NULL ở ngưỡng 0.90.
- Đoạn văn 200 chữ và bài văn 600 chữ gộp chung một node theo kiểu bài (NLVH/NLXH), không theo độ dài.

## Product Owner Approval

- [ ] **Đã duyệt**
- [ ] **Cần sửa**
