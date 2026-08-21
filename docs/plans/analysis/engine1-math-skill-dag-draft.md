# Engine 1 — Math Skill DAG Draft (Work Plan Phase 1, Task 3 / `backend-task-03`)

Status: **Draft — chờ engineer duyệt** (chưa được approve; `backend-task-04` KHÔNG được bắt đầu cho tới khi mục "Engineer Approval" bên dưới được điền).

Nguồn: khung chương trình Toán THPT theo Chương trình GDPT 2018 (Bộ GD&ĐT), giới hạn ở lớp 10 và lớp 12 — đúng hai khối lớp mà corpus hiện có (`docs/prd/engine1-adaptive-ai-prd.md` A2: 32 câu lớp 12, 5 câu lớp 10, trong tổng ~47 câu Toán). Không đưa nội dung lớp 11 vào cây dù về mặt chương trình gốc một số khái niệm (giới hạn, đạo hàm) học ở lớp 11 — vì corpus không có câu hỏi lớp 11 nào để gắn thẻ, các node lớp 12 dưới đây được đặt tên/phạm vi theo đúng chuyên đề ôn thi lớp 12 (khảo sát hàm số, mũ–logarit, nguyên hàm–tích phân, số phức, hình không gian, Oxyz, xác suất) chứ không tách riêng phần nền tảng lớp 11.

20 node (trong khoảng 15–25 theo AC-003), mỗi node có `id` (slug ổn định, dùng làm khoá chính `skill_nodes.id`) và `labelVi` (nhãn tiếng Việt hiển thị, AC-004). Cột "Lớp" chỉ để engineer review — bảng `skill_nodes` thực tế không có cột grade (xem `docs/design/engine1-adaptive-ai-backend-design.md` §9b), thông tin lớp không đi vào DB.

## Danh sách node

### Lớp 10 (6 node — nền tảng, tương ứng 5 câu hỏi lớp 10 trong corpus)

| id | labelVi | Lớp |
|---|---|---|
| `menh-de-tap-hop` | Mệnh đề và tập hợp | 10 |
| `bpt-bac-nhat-hai-an` | Bất phương trình bậc nhất hai ẩn | 10 |
| `ham-so-bac-hai` | Hàm số bậc hai | 10 |
| `bpt-bac-hai-mot-an` | Bất phương trình bậc hai một ẩn | 10 |
| `he-thuc-luong-tam-giac` | Hệ thức lượng trong tam giác | 10 |
| `thong-ke-xs-lop10` | Thống kê và xác suất cơ bản | 10 |

### Lớp 12 (14 node — trọng tâm ôn thi, tương ứng 32 câu hỏi lớp 12 trong corpus)

| id | labelVi | Lớp |
|---|---|---|
| `tinh-don-dieu-cuc-tri` | Tính đơn điệu và cực trị của hàm số | 12 |
| `gtln-gtnn-tiem-can` | Giá trị lớn nhất, giá trị nhỏ nhất và tiệm cận của hàm số | 12 |
| `khao-sat-ve-do-thi` | Khảo sát và vẽ đồ thị hàm số | 12 |
| `ung-dung-do-thi-bien-luan` | Ứng dụng đồ thị hàm số để biện luận phương trình, bất phương trình | 12 |
| `ham-so-luy-thua-mu-logarit` | Hàm số lũy thừa, hàm số mũ và hàm số lôgarit | 12 |
| `pt-bpt-mu-logarit` | Phương trình, bất phương trình mũ và lôgarit | 12 |
| `nguyen-ham` | Nguyên hàm | 12 |
| `tich-phan` | Tích phân | 12 |
| `ung-dung-tich-phan` | Ứng dụng tích phân tính diện tích, thể tích | 12 |
| `so-phuc` | Số phức | 12 |
| `the-tich-khoi-da-dien` | Thể tích khối đa diện | 12 |
| `mat-non-mat-tru-mat-cau` | Mặt nón, mặt trụ, mặt cầu | 12 |
| `pp-toa-do-khong-gian` | Phương pháp tọa độ trong không gian Oxyz | 12 |
| `xac-suat-co-dieu-kien` | Xác suất có điều kiện | 12 |

## Cạnh tiên quyết (prerequisite edges)

Định dạng `node → prerequisite` (node ở cột trái yêu cầu node ở cột phải đã đạt ngưỡng thành thạo trước). Xây dựng thủ công không vòng lặp (acyclic by construction) — validation hình thức bằng `validateDag()` là việc của `backend-task-04`, không phải task này.

| `skill_node_id` | `prerequisite_node_id` |
|---|---|
| `bpt-bac-hai-mot-an` | `ham-so-bac-hai` |
| `tinh-don-dieu-cuc-tri` | `ham-so-bac-hai` |
| `gtln-gtnn-tiem-can` | `tinh-don-dieu-cuc-tri` |
| `khao-sat-ve-do-thi` | `gtln-gtnn-tiem-can` |
| `ung-dung-do-thi-bien-luan` | `khao-sat-ve-do-thi` |
| `ham-so-luy-thua-mu-logarit` | `ham-so-bac-hai` |
| `pt-bpt-mu-logarit` | `ham-so-luy-thua-mu-logarit` |
| `nguyen-ham` | `tinh-don-dieu-cuc-tri` |
| `tich-phan` | `nguyen-ham` |
| `ung-dung-tich-phan` | `tich-phan` |
| `so-phuc` | `bpt-bac-hai-mot-an` |
| `the-tich-khoi-da-dien` | `he-thuc-luong-tam-giac` |
| `mat-non-mat-tru-mat-cau` | `the-tich-khoi-da-dien` |
| `pp-toa-do-khong-gian` | `mat-non-mat-tru-mat-cau` |
| `xac-suat-co-dieu-kien` | `thong-ke-xs-lop10` |

Node không có tiên quyết (root node trong DAG): `menh-de-tap-hop`, `bpt-bac-nhat-hai-an`, `ham-so-bac-hai`, `he-thuc-luong-tam-giac`, `thong-ke-xs-lop10`.

## Kiểm tra nhanh (thủ công, không thay cho `validateDag()`)

- Số node: 20 — nằm trong khoảng 15–25 (AC-003). ✓
- Phủ đúng 2 khối lớp corpus có (10 và 12). ✓
- Mỗi node đều có `labelVi` tiếng Việt (AC-004). ✓
- Không có cạnh tự tham chiếu (`skill_node_id ≠ prerequisite_node_id` ở mọi dòng). ✓
- Không có chu trình: mọi chuỗi tiên quyết là DAG tuyến tính/rẽ nhánh xuất phát từ 5 root ở trên, không có cạnh nào quay ngược về node đã xuất hiện trước nó trong chuỗi. ✓ (rà bằng mắt; xác nhận hình thức là việc của `validateDag()` ở `backend-task-04`)
- Không có tiên quyết trỏ tới node không tồn tại (0 dangling, AC-002) — mọi `prerequisite_node_id` ở bảng trên đều là một `id` có trong danh sách node phía trên. ✓

## Engineer Approval

- [X] **Đã duyệt** — engineer xác nhận nội dung đúng với khung chương trình MOET, node/cạnh hợp lý để `backend-task-04` seed vào code.
- [ ] **Cần sửa** — liệt kê các điểm cần sửa bên dưới, lặp lại vòng draft → review cho tới khi được duyệt.

_(Để trống — điền khi engineer review xong. `backend-task-04` không được bắt đầu tới khi ô "Đã duyệt" được tick.)_
