# Engine 1 — Physics (Vật lí) Skill DAG Draft

Status: **Tự rà theo corpus, đã seed — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16, quyết định "không chờ duyệt từng môn" của product owner; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Vật lí từ 2025 (Chương trình GDPT 2018 — lớp 12 chiếm phần lớn: Vật lí nhiệt, Khí lí tưởng, Từ trường, Vật lí hạt nhân; lớp 10–11 phần còn lại), đối chiếu với corpus THẬT trên prod ngày 2026-09-16: **23 câu**, toàn bộ từ một đề "Kiểm tra cuối kì 2 Vật lý 11 — Sở GD&ĐT Quảng Nam" (21 trắc nghiệm + 2 tự luận), nội dung: từ trường / lực từ / lực Lorentz / cảm ứng điện từ / tự cảm (≈13 câu) và khúc xạ / phản xạ toàn phần / lăng kính / thấu kính / mắt (≈9 câu). Dev có thêm 5 câu Lý 10 seed (động học, động lực học).

**Vì sao có node "Quang hình học" dù CT 2018 đã bỏ chương này khỏi lớp 11:** gần nửa corpus prod là câu quang hình (đề theo CT 2006 vẫn được tải lên và luyện). Không có node thì 9/23 câu rơi về NULL — taxonomy phải phủ thứ học sinh thật sự đang làm, không chỉ thứ chương trình mới nói.

15 node, `id` có tiền tố `ly-` (khoá chính `skill_nodes.id` là toàn cục cho mọi môn). Cột "Lớp" chỉ để review — bảng `skill_nodes` không có cột grade.

## Danh sách node

### Lớp 10 (5 node)

| id | labelVi | Lớp |
|---|---|---|
| `ly-dong-hoc` | Động học chất điểm | 10 |
| `ly-dong-luc-hoc` | Động lực học: các định luật Newton và các loại lực | 10 |
| `ly-cong-nang-luong-cong-suat` | Công, năng lượng và công suất | 10 |
| `ly-dong-luong` | Động lượng và va chạm | 10 |
| `ly-chuyen-dong-tron-bien-dang` | Chuyển động tròn và biến dạng của vật rắn | 10 |

### Lớp 11 (5 node)

| id | labelVi | Lớp |
|---|---|---|
| `ly-dao-dong` | Dao động | 11 |
| `ly-song` | Sóng cơ, sóng âm, sóng ánh sáng và sóng điện từ | 11 |
| `ly-dien-truong` | Điện trường và điện thế | 11 |
| `ly-dong-dien-mach-dien` | Dòng điện không đổi và mạch điện | 11 |
| `ly-quang-hinh` | Quang hình học: khúc xạ, thấu kính, mắt và dụng cụ quang | 11 (CT 2006) |

### Lớp 12 (5 node)

| id | labelVi | Lớp |
|---|---|---|
| `ly-vat-li-nhiet` | Vật lí nhiệt: nội năng, nhiệt lượng và chuyển thể | 12 |
| `ly-khi-li-tuong` | Khí lí tưởng | 12 |
| `ly-tu-truong-cam-ung` | Từ trường, lực từ và cảm ứng điện từ | 12 (CT 2018) / 11 (CT 2006) |
| `ly-dien-xoay-chieu` | Dòng điện xoay chiều | 12 |
| `ly-vat-li-hat-nhan` | Vật lí hạt nhân và phóng xạ | 12 |

## Cạnh tiên quyết (prerequisite edges)

Định dạng `node → prerequisite`. Chỉ giữ cạnh có thứ tự học thật (định luật Newton cần động học; năng lượng/động lượng/dao động xây trên động lực học; sóng xây trên dao động; mạch điện cần điện trường; từ trường cần dòng điện; xoay chiều cần cảm ứng điện từ; khí lí tưởng cần vật lí nhiệt).

| `skill_node_id` | `prerequisite_node_id` |
|---|---|
| `ly-dong-luc-hoc` | `ly-dong-hoc` |
| `ly-cong-nang-luong-cong-suat` | `ly-dong-luc-hoc` |
| `ly-dong-luong` | `ly-dong-luc-hoc` |
| `ly-chuyen-dong-tron-bien-dang` | `ly-dong-luc-hoc` |
| `ly-dao-dong` | `ly-dong-luc-hoc` |
| `ly-song` | `ly-dao-dong` |
| `ly-dong-dien-mach-dien` | `ly-dien-truong` |
| `ly-tu-truong-cam-ung` | `ly-dong-dien-mach-dien` |
| `ly-dien-xoay-chieu` | `ly-tu-truong-cam-ung` |
| `ly-khi-li-tuong` | `ly-vat-li-nhiet` |

Node gốc (không có tiên quyết): `ly-dong-hoc`, `ly-dien-truong`, `ly-quang-hinh`, `ly-vat-li-nhiet`, `ly-vat-li-hat-nhan`.

## Kiểm tra nhanh

- 15 node, 10 cạnh; `validateDag()` chạy trong `skillTaxonomy.test.ts` cho riêng môn và cho bản gộp 7 môn. ✓
- Mỗi id có tiền tố `ly-`, mỗi nhãn có dấu tiếng Việt. ✓
- Corpus prod 23 câu: 13 câu → `ly-tu-truong-cam-ung`, 9 câu → `ly-quang-hinh`, 1 câu (Henry là đơn vị của độ tự cảm) → `ly-tu-truong-cam-ung`. Không câu nào thiếu node. ✓ (rà tay; kết quả gắn thẻ thật nằm trong report `supabase/skill-tagging-report-*`)

## Điểm cần người duyệt để mắt

- `ly-song` gộp sóng cơ, sóng âm, sóng ánh sáng, sóng điện từ vào một node (CT 2018 xếp chung một chương "Sóng"). Nếu corpus lớp 11 mới về nhiều, cân nhắc tách "Sóng ánh sáng (giao thoa)" riêng.
- `ly-tu-truong-cam-ung` phủ cả lực Lorentz và tự cảm — đề CT 2006 tách hai chương, CT 2018 gộp một. Gộp theo CT 2018.

## Product Owner Approval

- [ ] **Đã duyệt** — nội dung đúng với cấu trúc đề tốt nghiệp và corpus.
- [ ] **Cần sửa** — liệt kê bên dưới.

_(Đã seed dev; seed prod chờ deploy nhánh — xem D6 trong plan.)_
