# Engine 1 — Biology (Sinh học) Skill DAG Draft

Status: **Tự rà theo corpus, đã seed — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Sinh học từ 2025 (CT GDPT 2018 — lớp 12 gồm ba phần Di truyền / Tiến hoá / Sinh thái; lớp 10–11 phần nhỏ). Corpus THẬT trên prod 2026-09-16: **40 câu** trắc nghiệm, một đề "Kiểm tra giữa kì 2 Sinh học 12 — THPT Gia Định": ≈9 câu di truyền quần thể (tần số alen, Hardy–Weinberg, tự thụ phấn), ≈4 câu bằng chứng tiến hoá (cơ quan tương đồng/thoái hoá, bằng chứng phân tử), ≈14 câu học thuyết Darwin / tổng hợp hiện đại / nhân tố tiến hoá, ≈13 câu loài – cách li – hình thành loài. Dev: 0 câu Sinh.

**Vì sao Tiến hoá tách 4 node thay vì 1:** 31/40 câu corpus là tiến hoá, và chúng rơi rõ vào bốn nhóm câu hỏi khác nhau (bằng chứng / học thuyết–nhân tố / loài–hình thành loài / phát sinh sự sống). Một node "Tiến hoá" duy nhất sẽ báo "yếu tiến hoá" mà không nói được yếu gì. Ngược lại, Di truyền chia theo chương chuẩn (5 node) và Sinh thái chỉ 2 node vì chưa có câu thật.

16 node, tiền tố `sinh-`.

## Danh sách node

### Lớp 10 (3 node)

| id | labelVi | Lớp |
|---|---|---|
| `sinh-te-bao` | Sinh học tế bào: thành phần hoá học, cấu trúc và chuyển hoá trong tế bào | 10 |
| `sinh-phan-bao` | Chu kì tế bào, nguyên phân và giảm phân | 10 |
| `sinh-vi-sinh-vat-virus` | Vi sinh vật và virus | 10 |

### Lớp 11 (2 node)

| id | labelVi | Lớp |
|---|---|---|
| `sinh-trao-doi-chat-sinh-vat` | Trao đổi chất và chuyển hoá năng lượng ở thực vật và động vật | 11 |
| `sinh-cam-ung-sinh-truong-sinh-san` | Cảm ứng, sinh trưởng, phát triển và sinh sản ở sinh vật | 11 |

### Lớp 12 — Di truyền (5 node)

| id | labelVi | Lớp |
|---|---|---|
| `sinh-co-so-phan-tu-di-truyen` | Cơ sở phân tử của di truyền: DNA, gene, phiên mã, dịch mã và đột biến gene | 12 |
| `sinh-nhiem-sac-the` | Nhiễm sắc thể và đột biến nhiễm sắc thể | 12 |
| `sinh-quy-luat-di-truyen` | Các quy luật di truyền | 12 |
| `sinh-di-truyen-quan-the` | Di truyền quần thể | 12 |
| `sinh-di-truyen-nguoi-ung-dung` | Di truyền học người và ứng dụng di truyền học | 12 |

### Lớp 12 — Tiến hoá (4 node)

| id | labelVi | Lớp |
|---|---|---|
| `sinh-bang-chung-tien-hoa` | Bằng chứng tiến hoá | 12 |
| `sinh-hoc-thuyet-nhan-to-tien-hoa` | Học thuyết tiến hoá và các nhân tố tiến hoá | 12 |
| `sinh-loai-hinh-thanh-loai` | Loài, cách li sinh sản và quá trình hình thành loài | 12 |
| `sinh-phat-sinh-su-song` | Sự phát sinh, phát triển của sự sống và loài người | 12 |

### Lớp 12 — Sinh thái (2 node)

| id | labelVi | Lớp |
|---|---|---|
| `sinh-quan-the-quan-xa` | Sinh thái học quần thể và quần xã | 12 |
| `sinh-he-sinh-thai-sinh-quyen` | Hệ sinh thái, sinh quyển và sinh thái học phục hồi | 12 |

## Cạnh tiên quyết (prerequisite edges)

| `skill_node_id` | `prerequisite_node_id` |
|---|---|
| `sinh-phan-bao` | `sinh-te-bao` |
| `sinh-co-so-phan-tu-di-truyen` | `sinh-te-bao` |
| `sinh-nhiem-sac-the` | `sinh-phan-bao` |
| `sinh-quy-luat-di-truyen` | `sinh-nhiem-sac-the` |
| `sinh-di-truyen-quan-the` | `sinh-quy-luat-di-truyen` |
| `sinh-di-truyen-nguoi-ung-dung` | `sinh-quy-luat-di-truyen` |
| `sinh-hoc-thuyet-nhan-to-tien-hoa` | `sinh-di-truyen-quan-the` |
| `sinh-loai-hinh-thanh-loai` | `sinh-hoc-thuyet-nhan-to-tien-hoa` |
| `sinh-he-sinh-thai-sinh-quyen` | `sinh-quan-the-quan-xa` |

Node gốc: `sinh-te-bao`, `sinh-vi-sinh-vat-virus`, `sinh-trao-doi-chat-sinh-vat`, `sinh-cam-ung-sinh-truong-sinh-san`, `sinh-bang-chung-tien-hoa`, `sinh-phat-sinh-su-song`, `sinh-quan-the-quan-xa`.

Lý do: quy luật di truyền cần hiểu NST và phân bào (giảm phân giải thích phân li độc lập); di truyền quần thể là quy luật Mendel áp lên quần thể; các nhân tố tiến hoá (đột biến, chọn lọc, phiêu bạt, dòng gene) được định nghĩa bằng thay đổi tần số alen — tức cần di truyền quần thể trước; hình thành loài là hệ quả của các nhân tố tiến hoá + cách li.

## Kiểm tra nhanh

- 16 node, 9 cạnh; DAG hợp lệ (test). ✓
- Corpus prod 40 câu: mọi câu có node đích trong 4 node tiến hoá + `sinh-di-truyen-quan-the`. Ranh giới mờ đã thấy khi rà tay: câu "dòng gene giữa các quần thể" (nhân tố tiến hoá hay di truyền quần thể?) và "cách li địa lí có vai trò…" (nhân tố hay hình thành loài?) — chờ xem confidence thật trong report.

## Điểm cần người duyệt để mắt

- Ranh giới `sinh-hoc-thuyet-nhan-to-tien-hoa` ↔ `sinh-loai-hinh-thanh-loai` với các câu về cách li: quy ước ở prompt gắn thẻ là "cách li địa lí/sinh sản trong bối cảnh hình thành loài → loài–hình thành loài".
- 9 node lớp 10–11 và Sinh thái chưa có câu thật.

## Product Owner Approval

- [ ] **Đã duyệt**
- [ ] **Cần sửa**
