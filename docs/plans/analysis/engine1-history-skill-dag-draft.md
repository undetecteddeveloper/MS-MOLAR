# Engine 1 — History (Lịch sử) Skill DAG Draft

Status: **Đặt theo cấu trúc đề, KHÔNG có corpus để rà — chờ product owner duyệt một lượt** (phiên tự hành 2026-09-16; xem `docs/plans/20260916-feature-skill-taxonomy-all-subjects.md`).

Nguồn: cấu trúc đề thi tốt nghiệp THPT môn Lịch sử từ 2025 (CT GDPT 2018): sáu chủ đề lớp 12 (Thế giới trong và sau Chiến tranh lạnh; ASEAN; Cách mạng tháng Tám, chiến tranh giải phóng dân tộc và bảo vệ Tổ quốc 1945 – nay; Công cuộc Đổi mới; Lịch sử đối ngoại; Hồ Chí Minh trong lịch sử Việt Nam) chiếm phần lớn, phần còn lại từ lớp 10–11 (văn minh; cách mạng tư sản – CNTB – CNXH; Đông Nam Á giành độc lập; chiến tranh bảo vệ Tổ quốc và cải cách trước 1858; Biển Đông). Corpus THẬT: **0 câu** trên cả prod lẫn dev.

**Vì sao vẫn seed dù không có câu:** không có node thì đề Sử đầu tiên tải lên sẽ nằm ngoài taxonomy và phải chờ một vòng thiết kế nữa; 10 node theo đúng chủ đề của Bộ là mức thô nhất còn có nghĩa. Chia giai đoạn mịn hơn (kháng chiến chống Pháp / chống Mỹ tách riêng) để dành khi có đề thật — làm trước là bịa hạt mịn không bằng chứng.

**Không có cạnh tiên quyết:** trình tự thời gian không phải thứ tự học (học "Đổi mới" không cần "qua" Cách mạng tháng Tám trước theo nghĩa mastery).

10 node, tiền tố `su-`.

## Danh sách node

### Lớp 10–11 (4 node)

| id | labelVi | Lớp |
|---|---|---|
| `su-van-minh-co-trung-dai` | Các nền văn minh thế giới, Đông Nam Á và Đại Việt thời cổ – trung đại | 10 |
| `su-cach-mang-tu-san-cntb-cnxh` | Cách mạng tư sản, chủ nghĩa tư bản và chủ nghĩa xã hội từ 1917 đến nay | 11 |
| `su-viet-nam-truoc-1945` | Việt Nam trước 1945: chiến tranh bảo vệ Tổ quốc, cải cách và phong trào giải phóng dân tộc | 11 |
| `su-bien-dong` | Chủ quyền của Việt Nam ở Biển Đông | 11 |

### Lớp 12 (6 node)

| id | labelVi | Lớp |
|---|---|---|
| `su-the-gioi-sau-1945` | Thế giới từ 1945: trật tự thế giới, Chiến tranh lạnh và xu thế đa cực | 12 |
| `su-dong-nam-a-asean` | Đông Nam Á giành độc lập và ASEAN | 11–12 |
| `su-cach-mang-thang-tam-khang-chien` | Cách mạng tháng Tám 1945 và các cuộc kháng chiến 1945 – 1975 | 12 |
| `su-bao-ve-to-quoc-doi-moi` | Bảo vệ Tổ quốc sau 1975 và công cuộc Đổi mới | 12 |
| `su-doi-ngoai-viet-nam` | Lịch sử đối ngoại Việt Nam thời cận – hiện đại | 12 |
| `su-ho-chi-minh` | Hồ Chí Minh trong lịch sử Việt Nam | 12 |

## Cạnh tiên quyết (prerequisite edges)

Không có (xem lý do ở đầu).

| `skill_node_id` | `prerequisite_node_id` |
|---|---|

## Kiểm tra nhanh

- 10 node, 0 cạnh. ✓
- Không có câu nào để đối chiếu — đây là môn duy nhất seed hoàn toàn theo tài liệu.

## Điểm cần người duyệt để mắt

- Toàn bộ môn này là tin cậy thấp cho tới khi có đề thật. Khi đề Sử đầu tiên được tải lên, dry-run tagger và xem `no-matching-node` trước khi tin vào bất kỳ số nào.
- `su-cach-mang-thang-tam-khang-chien` gộp 1945 – 1975 vào một node; đề thật thường hỏi tách kháng chiến chống Pháp và chống Mỹ — tách khi có corpus.

## Product Owner Approval

- [ ] **Đã duyệt**
- [ ] **Cần sửa**
