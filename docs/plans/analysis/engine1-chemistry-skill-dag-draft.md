# Engine 1 — Chemistry (Hoá học) Skill DAG Draft

Status: **Tự rà theo corpus, đã seed — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Hoá học từ 2025 (CT GDPT 2018), chia theo CHƯƠNG — đây cũng là cách ma trận đề của Bộ liệt kê nội dung (lớp 12: ester–lipid, carbohydrate, hợp chất chứa nitrogen, polymer, pin điện–điện phân, đại cương kim loại, nhóm IA/IIA, kim loại chuyển tiếp; lớp 10–11 phần còn lại). Đối chiếu corpus THẬT trên prod 2026-09-16: **18 câu**, một đề "Kiểm tra học kì 1 Hóa học 10 — THPT Bình Chiểu" (12 trắc nghiệm + 6 tự luận): cấu tạo nguyên tử (≈6), bảng tuần hoàn (≈2), liên kết hoá học (≈4: octet, Lewis, độ âm điện, năng lượng liên kết), oxi hoá – khử (≈5), 1 câu ứng dụng sulfur. Dev có thêm 5 câu Hoá 10 seed (nguyên tử, bảng tuần hoàn).

Vì corpus chỉ chạm lớp 10, node lớp 11–12 được đặt theo chương của đề tốt nghiệp chứ chưa có câu thật để rà — ghi rõ ở mục cuối. Không chia mịn hơn chương (ví dụ không tách "amine" khỏi "amino acid") khi chưa có bằng chứng.

15 node, tiền tố `hoa-`.

## Danh sách node

### Lớp 10 (6 node)

| id | labelVi | Lớp |
|---|---|---|
| `hoa-cau-tao-nguyen-tu` | Cấu tạo nguyên tử | 10 |
| `hoa-bang-tuan-hoan` | Bảng tuần hoàn và định luật tuần hoàn | 10 |
| `hoa-lien-ket-hoa-hoc` | Liên kết hoá học | 10 |
| `hoa-phan-ung-oxi-hoa-khu` | Phản ứng oxi hoá – khử | 10 |
| `hoa-nang-luong-toc-do-can-bang` | Năng lượng hoá học, tốc độ phản ứng và cân bằng hoá học | 10–11 |
| `hoa-phi-kim` | Nguyên tố phi kim: halogen, nitrogen và sulfur | 10–11 |

### Lớp 11 (2 node)

| id | labelVi | Lớp |
|---|---|---|
| `hoa-dai-cuong-huu-co-hydrocarbon` | Đại cương hoá học hữu cơ và hydrocarbon | 11 |
| `hoa-dan-xuat-hydrocarbon` | Dẫn xuất của hydrocarbon: alcohol, phenol, hợp chất carbonyl và carboxylic acid | 11 |

### Lớp 12 (7 node)

| id | labelVi | Lớp |
|---|---|---|
| `hoa-ester-lipid` | Ester và lipid | 12 |
| `hoa-carbohydrate` | Carbohydrate: glucose, saccharose, tinh bột và cellulose | 12 |
| `hoa-hop-chat-chua-nitrogen` | Amine, amino acid, peptide và protein | 12 |
| `hoa-polymer` | Polymer: chất dẻo, tơ và cao su | 12 |
| `hoa-pin-dien-dien-phan` | Pin điện và điện phân | 12 |
| `hoa-dai-cuong-kim-loai` | Đại cương về kim loại | 12 |
| `hoa-kim-loai-nhom-a-chuyen-tiep` | Kim loại nhóm IA, IIA và kim loại chuyển tiếp dãy thứ nhất | 12 |

## Cạnh tiên quyết (prerequisite edges)

| `skill_node_id` | `prerequisite_node_id` |
|---|---|
| `hoa-bang-tuan-hoan` | `hoa-cau-tao-nguyen-tu` |
| `hoa-lien-ket-hoa-hoc` | `hoa-cau-tao-nguyen-tu` |
| `hoa-phan-ung-oxi-hoa-khu` | `hoa-lien-ket-hoa-hoc` |
| `hoa-phi-kim` | `hoa-phan-ung-oxi-hoa-khu` |
| `hoa-dan-xuat-hydrocarbon` | `hoa-dai-cuong-huu-co-hydrocarbon` |
| `hoa-ester-lipid` | `hoa-dan-xuat-hydrocarbon` |
| `hoa-carbohydrate` | `hoa-dan-xuat-hydrocarbon` |
| `hoa-hop-chat-chua-nitrogen` | `hoa-dan-xuat-hydrocarbon` |
| `hoa-polymer` | `hoa-dai-cuong-huu-co-hydrocarbon` |
| `hoa-pin-dien-dien-phan` | `hoa-phan-ung-oxi-hoa-khu` |
| `hoa-dai-cuong-kim-loai` | `hoa-phan-ung-oxi-hoa-khu` |
| `hoa-kim-loai-nhom-a-chuyen-tiep` | `hoa-dai-cuong-kim-loai` |

Node gốc: `hoa-cau-tao-nguyen-tu`, `hoa-nang-luong-toc-do-can-bang`, `hoa-dai-cuong-huu-co-hydrocarbon`.

Lý do từng cạnh: số oxi hoá suy từ độ âm điện/liên kết (oxi hoá–khử ← liên kết); pin điện, điện phân, tính chất kim loại và phi kim đều là hoá học oxi hoá–khử; mọi lớp chất hữu cơ lớp 12 (ester, carbohydrate, amine/amino acid) đọc theo nhóm chức đã học ở dẫn xuất hydrocarbon; polymer trùng hợp từ hydrocarbon không no.

## Kiểm tra nhanh

- 15 node, 12 cạnh; DAG hợp lệ (test). ✓
- Corpus prod 18 câu rơi trọn vào 4 node lớp 10 đầu (`cau-tao-nguyen-tu`, `bang-tuan-hoan`, `lien-ket-hoa-hoc`, `phan-ung-oxi-hoa-khu`) + 1 câu sulfur → `hoa-phi-kim`, 1 câu kim loại M + HNO₃ → `hoa-phan-ung-oxi-hoa-khu`. ✓

## Điểm cần người duyệt để mắt

- 11 node lớp 11–12 CHƯA có câu thật nào — đặt theo chương đề tốt nghiệp. Đây là phần tin cậy thấp nhất của môn này.
- `hoa-nang-luong-toc-do-can-bang` gộp ba chương (nhiệt hoá học lớp 10, tốc độ phản ứng lớp 10, cân bằng lớp 11) — tách khi có corpus.

## Product Owner Approval

- [ ] **Đã duyệt**
- [ ] **Cần sửa**
