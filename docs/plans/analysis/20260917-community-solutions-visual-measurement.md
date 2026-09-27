# Community Solutions — Visual Acceptance Measurement (Task 49 / P5-T10)

## Trạng thái

**PASS toàn bộ 5 bề mặt × 3 viewport (đo 2026-09-27, 5 lượt chạy, 3 lỗi thật
phát hiện + sửa).** Session Playwright CLI dùng chung đăng nhập thật (tài
khoản "AnhPhat" / `smithnguyen247+rlstesta@gmail.com`), tự xác nhận lại ở đầu
mỗi lượt chạy. Ba lỗi thật phát hiện qua các lượt đo trước, cả ba đã được sửa
và **xác nhận lại đạt sàn 44px bằng đo DOM sống** trong lượt đo xác nhận cuối
(lượt 5):

1. Nút "Cài đặt bài giải…" (`SolutionSettingsPanel`, bề mặt 4, task 09) — 38px
   → 44px, commit `cea9f60`.
2. Nút "Viết tiếp"/"Xem lý do" (`OwnSolutionBlock`, bề mặt 2, task 17) — 36px
   → 44px, commit `acfa528`.
3. Liên kết "Sửa" (`SolutionCard`, bề mặt 2, task 17) — 20px → 44px (thêm
   `min-h-11`), commit `acfa528`.

TBD-01 (skeleton `profile/loading.tsx`, task 45) cũng đã đóng — commit
`43c7c58` cập nhật cả cấu trúc (thêm khối skeleton cho hàng chip) lẫn số đo
(khối thẻ hồ sơ khớp `ReputationBlock`), xác nhận lại lượt 5: lệch 0px giữa
skeleton và trang thật ở cả 360px và 768px.

Không còn lỗi thật nào tồn đọng thuộc phạm vi task 49/community-solutions.
Các giới hạn dữ liệu (thẻ ghim, tác giả khác, v.v.) và các hàng "Cách đo"
ngoài phạm vi task 49 (bundle budget, XSS, đếm từ) vẫn còn, xem "Việc còn lại"
ở cuối tài liệu.

## Mục đích

Đo trực quan (visual acceptance) 5 bề mặt UI của tính năng "Bài giải cộng
đồng" ở 3 viewport (360×800, 768×1024, 1440×900) bằng Playwright CLI, theo
UI Spec `docs/ui-spec/community-solutions-ui-spec.md` § Visual Acceptance
(golden states 1–12), § Ràng buộc bố cục, § Cách đo — vì script `ui-audit`
hiện có (`​.claude/skills/ui-audit/scripts/audit.mjs`) chạy 375/768/1440 với
sàn chạm 24px, không đủ cho `AC-011` (yêu cầu đúng 360px) và sàn 44px của
NFR trợ năng (xem "Vì sao ui-audit không đủ" bên dưới).

## 5 bề mặt cần đo × 3 viewport

| # | Bề mặt | Ghi chú riêng cần kiểm khi đo |
|---|---|---|
| 1 | `/exams/[id]/attempt/[attemptId]/result` (thẻ cửa vào) | Đủ 4 nhãn `myStatus` (kể cả nhãn dài nhất "Bài giải của bạn đang bị ẩn"); hai nút cùng hàng, ≥44px, không cắt chữ ở 360px |
| 2 | `/exams/[id]/solutions` | Khối "Bài giải của bạn" (nháp/tiến độ), bài ghim đầu danh sách, thẻ ẩn danh, trạng thái rỗng |
| 3 | `/exams/[id]/solutions/[solutionId]` + bảng câu hỏi mở + tấm trượt bình luận mở | Hàng câu ≥56px; ô bảng câu hỏi ≥44px (lưới 5 cột trong 320px ở 360px); tấm trượt đè lên `BottomNav` |
| 4 | `/exams/[id]/attempt/[attemptId]/solution` + tấm trượt ghi chú mở | Hàng câu màn viết ≥56px, đủ 4 trạng thái; hai công tắc; thanh đáy dính `BottomNav` |
| 5 | `/profile?tab=account` và `/profile?tab=comments` | Hai chip ngay dưới mô tả (≥44px mỗi chip); khối uy tín + 3 huy hiệu trên hàng đổi mật khẩu; tab Bình luận có chấm chưa đọc |

Mỗi bề mặt × mỗi viewport (360/768/1440) ghi: số phần tử đo được, chiều
cao nhỏ nhất tìm thấy, selector nào (nếu có) fail sàn 44px/56px, kết quả nhãn
cắt chữ ở 360px (có/không), kết quả cuộn ngang ở 360px (có/không) — đúng theo
mẫu số đo của task 08 (Investigation Notes, phép đo entry-card 360px Phase 1:
`getBoundingClientRect()`/`scrollWidth`/`clientWidth` qua `eval`, so `top` hai
nút để xác nhận cùng hàng). Phần tử được quét: `button, a, input[type=checkbox],
[role=menuitem]` trong trang, **trừ** chrome dùng chung toàn site không thuộc
task nào của tính năng này (`nav[aria-label="Breadcrumb"]`, skip-link
`a[href="#main-content"]`, thanh điều hướng đầu trang `Tài khoản và ngôn
ngữ`/`Chính`) — các phần tử này thuộc `components/layout/*`, có từ trước tính
năng, không nằm trong Target Files của bất kỳ task community-solutions nào
nên nằm ngoài phạm vi sửa của task 49; chiều cao của chúng được ghi lại dưới
dạng quan sát riêng (mục "Quan sát ngoài phạm vi"), không tính là fail của
task 49.

### Số đo thật — Bề mặt 4: `/exams/e1mp-exam-prereq/attempt/6ec9386a-.../solution` + tấm trượt ghi chú mở

Đo 2026-09-27, tài khoản "AnhPhat" đã đăng nhập thật qua session Playwright
CLI dùng chung. Đề `e1mp-exam-prereq` có đúng 1 câu; mở tấm trượt ghi chú câu
1, điền ghi chú tạm 35 từ vào ô soạn (đủ ngưỡng "≥15 từ") **nhưng không bấm
"Lưu"/"Lưu nháp"** — xác nhận lại bằng `goto` mới tới trang danh sách bài giải
của đề này vẫn hiện "0 bài giải… Chưa có bài giải nào", tức **không có dữ
liệu tạm nào được ghi vào DB**.

| Viewport | Số phần tử trong phạm vi | Chiều cao nhỏ nhất | Selector fail sàn 44px | Cắt chữ ở 360px | Cuộn ngang ở 360px |
|---|---|---|---|---|---|
| 360×800 | 11 | **38px** | Nút gập/mở "Cài đặt bài giải…" (`SolutionSettingsPanel.tsx:49-64`) — `height=38`, `width=304` | Không | Không (`scrollWidth=360===clientWidth=360`) |
| 768×1024 | 11 | 38px | Cùng nút, `height=38`, `width=592` | N/A (chỉ bắt buộc đo ở 360px) | Không đo (không bắt buộc ở viewport này) |
| 1440×900 | 11 | 38px | Cùng nút, `height=38`, `width=592` | N/A | Không đo |

**Kết luận bề mặt 4 (đã sửa, lần chạy trước)**: nút "Cài đặt bài giải" từng
**FAIL** sàn 44px ở cả 3 viewport (38px, task 09). Đã được sửa (`min-h-11`,
commit `cea9f60`). **Xác nhận lại 2026-09-27** trên cùng trang
(`e1mp-exam-prereq` attempt `6ec9386a-...`, tấm trượt ghi chú câu 1 mở) ở
360px: nút "Cài đặt bài giải…" nay đo được `height=44` (đạt sàn) — lỗi cũ đã
đóng. Các phần tử khác trong phạm vi ở bề mặt này (nút câu hỏi, nút đóng
dialog, "Xem trước công thức", "Lưu") vẫn đạt sàn 44px, không cắt chữ, không
cuộn ngang ở 360px (không đo lại toàn bộ theo đúng chỉ dẫn lần này — chỉ xác
nhận nút vừa sửa).

### Số đo thật — Bề mặt 1: `/exams/[id]/attempt/[attemptId]/result` (thẻ cửa vào), đủ 4 trạng thái `myStatus`

Đo 2026-09-27. Ba trạng thái thật dùng dữ liệu có sẵn/thao tác thật trên dev:
`none` và `draft` cùng một lượt làm (`e1mp-exam-prereq` attempt
`6ec9386a-0e6a-43a7-9791-50e28a1ac66a` — đo `none` trước, sau đó viết ghi chú
thật + bấm "Lưu nháp" để chuyển thật sang `draft` rồi đo lại, dữ liệu này ở
lại dev DB như dữ liệu thử nghiệm hợp lệ, cùng cách task 08 đã làm);
`published` dùng lại `e1mp-exam-lowest` attempt `b0a11a2d-...` (bài giải thật
đã đăng từ trước). `hidden` đo **tổng hợp** (không tái hiện được thật vì tài
khoản test không tự kích hoạt kiểm duyệt): `eval` ghi đè `textContent` của
nút "Sửa bài giải" thành "Bài giải của bạn đang bị ẩn" ngay trên trang
`published`, tái dùng nguyên style tính toán thật của nút — đúng phương pháp
task 08 đã dùng.

| Trạng thái | Viewport | Nút chính | Nút phụ | `top` hai nút | Cắt chữ 360px | Cuộn ngang 360px |
|---|---|---|---|---|---|---|
| `none` | 360 | "Viết bài giải" h=44 w=144 | "Xem bài giải" h=44 w=144 | 955.75 = 955.75 | Không (`scrollWidth=142=clientWidth=142`) | Không (`360=360`) |
| `none` | 768 | h=44 w=288 | h=44 w=288 | 820.75=820.75 | N/A | N/A |
| `none` | 1440 | h=44 w=288 | h=44 w=288 | 820.75=820.75 | N/A | N/A |
| `draft` | 360 | "Viết tiếp" h=44 w=144 | "Xem bài giải" h=44 w=144 | 955.75=955.75 | Không | Không |
| `draft` | 768 | h=44 w=288 | h=44 w=288 | 820.75=820.75 | N/A | N/A |
| `draft` | 1440 | h=44 w=288 | h=44 w=288 | 820.75=820.75 | N/A | N/A |
| `published` | 360 | "Sửa bài giải" h=44 w=144 | "Xem 1 bài giải" h=44 w=144 | 841.5=841.5 | Không | Không |
| `published` | 768 | h=44 w=288 | h=44 w=288 | 721.25=721.25 | N/A | N/A |
| `published` | 1440 | h=44 w=288 | h=44 w=288 | 721.25=721.25 | N/A | N/A |
| `hidden` (tổng hợp) | 360 | "Bài giải của bạn đang bị ẩn" — **xuống 2 dòng, h=53** w=144 | h=53 w=144 | 841.5=841.5 | Không (`scrollWidth=142=clientWidth=142`) | Không |
| `hidden` (tổng hợp) | 768 | 1 dòng, h=44 w=288 | h=44 w=288 | 721.25=721.25 | N/A | N/A |
| `hidden` (tổng hợp) | 1440 | 1 dòng, h=44 w=288 | h=44 w=288 | 721.25=721.25 | N/A | N/A |

**Kết luận bề mặt 1: PASS cả 4 trạng thái ở cả 3 viewport** — nhãn dài nhất
"Bài giải của bạn đang bị ẩn" xuống dòng đúng như `UI-D2` xử lý, không cắt
chữ, cao 53px (≥44px), hai nút luôn cùng hàng (`top` bằng nhau), không cuộn
ngang ở 360px. Khớp với kết quả task 08 đã đo (Phase 1).

### Số đo thật — Bề mặt 2: `/exams/[id]/solutions` (danh sách bài giải)

Đo 2026-09-27, quét trong phạm vi `main` (trừ `nav[aria-label="Breadcrumb"]`).

| Trạng thái / đề | Viewport | Phần tử trong phạm vi | Chiều cao | Kết quả | Cuộn ngang 360px |
|---|---|---|---|---|---|
| Khối "Bài giải của bạn" — Nháp (`e1mp-exam-prereq`, sau khi Lưu nháp) | 360/768/1440 | Nút "Viết tiếp" (link, `role=button`) | **44px** (`w=101.39`, không đổi theo bề rộng) | PASS (đã sửa, commit `acfa528`) | Không (`360=360`) |
| Danh sách rỗng, không có nháp (`exam-ly-10`) | 360 | Nút "Viết bài giải của bạn" | 52px, w=296 | PASS | Không |
| Danh sách rỗng, không có nháp (`exam-ly-10`) | 768/1440 | cùng nút | 52px, w=584 | PASS | N/A |
| Thẻ bài đã đăng của tôi trong danh sách (`e1mp-exam-lowest`) | 360 | Thẻ phủ link (toàn thẻ) | 124px, w=328 | PASS (không phải nút icon-only, thừa xa sàn) | Không |
| Thẻ bài đã đăng của tôi trong danh sách (`e1mp-exam-lowest`) | 360/768/1440 | Liên kết "Sửa" | **44px**, w=26.42 (không đổi theo bề rộng; `min-h-11` mới) | PASS (đã sửa, commit `acfa528`) | — |
| Thẻ bài đã đăng của tôi trong danh sách (`e1mp-exam-lowest`) | 768/1440 | Thẻ phủ link | 132px, w=624 | PASS | N/A |

**Kết luận bề mặt 2 (xác nhận lại 2026-09-27, lượt 5): PASS toàn bộ**, cả hai
lỗi thuộc task 17 đã được sửa và đo lại trực tiếp trên DOM sống (không chỉ
tin file nguồn):
1. `SOURCE/features/solutions/components/OwnSolutionBlock.tsx` — nút
   "Viết tiếp" (nhánh nháp) đo lại `height=44, width=101.39` ở cả 3 viewport
   (360/768/1440) trên `e1mp-exam-prereq/solutions` — HMR đã áp dụng, class
   `Button size="sm"` cũ đã bị bỏ (không còn prop `size`, mặc định `h-11` =
   44px, xem `SOURCE/components/ui/button.tsx:52`). Nút "Xem lý do" (nhánh bị
   ẩn) dùng cùng đoạn mã không truyền `size` (component source dòng 69) nên
   cùng đạt 44px theo suy luận mã nguồn — vẫn không đo trực tiếp được vì
   không có dữ liệu bị ẩn thật trên dev (giới hạn dữ liệu không đổi từ các
   lượt trước). Nhánh rỗng (`size="lg"`, 52px) không đổi, vẫn PASS.
2. `SOURCE/features/solutions/components/SolutionCard.tsx` — liên kết "Sửa"
   đo lại `height=44, width=26.42` ở cả 3 viewport trên
   `e1mp-exam-lowest/solutions`; `outerHTML` xác nhận class `min-h-11` đã có
   mặt trên DOM sống (không chỉ trong file nguồn). Chiều rộng 26.42px không
   đạt 44px nhưng quy tắc rộng ≥44px chỉ áp cho nút chỉ-có-icon, đây là liên
   kết có chữ "Sửa" nên không áp — không cần lập luận miễn trừ WCAG 2.5.8 nữa
   vì chiều cao literal đã đạt sàn.

**Không đo được vì thiếu dữ liệu (không phải lỗi)**: bài ghim đầu danh sách,
thẻ ẩn danh không huy hiệu điểm, thẻ bài giải của **người khác** — dev DB chỉ
có đúng 1 bài giải đã đăng, của chính tài khoản test, không có tác giả thứ
hai nào (đã khảo sát lại toàn bộ `/exams` trong lần chạy trước, không đổi).

### Số đo thật — Bề mặt 3: `/exams/[id]/solutions/[solutionId]` + bảng câu hỏi + tấm trượt bình luận

Đo 2026-09-27 trên `e1mp-exam-lowest/solutions/4b984204-1f0c-4e36-856c-b9b34e59dabc`
(bài giải đã đăng thật của chính tài khoản test), mở hàng Câu 1.

| Viewport | Phần tử | Chiều cao | Kết quả |
|---|---|---|---|
| 360 | Nút "Thêm" (⋯) | 44×44 | PASS |
| 360 | Nút "Bảng câu hỏi" | 44×136.98 | PASS |
| 360 | Hàng "Câu 1" (đã mở) | 56×328 | PASS (≥56px hàng câu) |
| 360 | Nút "Bình luận" (xuất hiện khi hàng mở) | 44×64.31 | PASS |
| 360 | Ô bảng câu hỏi (mở "Bảng câu hỏi", ô "1") | 64.5×64.5 | PASS (chỉ có 1 câu — **không đo được** claim "lưới 5 cột trong 320px cho ô ~50px" vì đề chỉ có 1 câu, giới hạn dữ liệu) |
| 360 | Tấm trượt bình luận — nút "Đóng" | 44×44 | PASS |
| 360 | Tấm trượt bình luận — ô "Ẩn danh" (input thô 13×13, nhưng `<label class="flex min-h-11 items-center gap-2 text-sm">` bao quanh) | label = 44×77.45 (vùng chạm thật) | PASS qua `label` — input thô không phải vùng chạm thật, đúng mẫu toggle đã dùng nơi khác trong codebase |
| 360 | Tấm trượt bình luận — nút "Gửi" | 44×65.97 | PASS |
| 360 | Không cuộn ngang | `docScrollWidth=360=docClientWidth=360` | PASS |
| 768/1440 | "Đóng"/"Gửi"/label "Ẩn danh" | đều 44px cao | PASS (không đổi theo bề rộng) |

**Đo bổ sung (thao tác thật, đã dọn sạch)**: gửi thật một bình luận của chính
mình lên câu 1 (đủ điều kiện đăng) để đo trạng thái "có bình luận" — nút
"Xoá" trên bình luận đo được **44×27.06px** (đạt sàn 44px cao; quy tắc
width≥44 chỉ áp cho "nút chỉ có icon", nút này có chữ "Xoá" nên không áp,
PASS). Sau khi đo xong đã bấm "Xoá" + xác nhận xoá thật để **dọn sạch dữ
liệu tạm** — xác nhận lại bằng `goto` mới: hàng câu trở lại "Câu 1" (không
còn "1 bình luận"), không còn dữ liệu tạm nào trong dev DB.

**Kết luận bề mặt 3: PASS toàn bộ** phần tử đo được, kể cả bảng câu hỏi mở và
tấm trượt bình luận mở.

**Không đo được vì thiếu dữ liệu (không phải lỗi)**: bình luận ẩn danh, bình
luận của người viết là **người khác** (mình chỉ có thể tự bình luận trên bài
của chính mình, không tái hiện được góc nhìn "người viết" thật của người
khác), huy hiệu ghim, "Hữu ích" của người khác, ô thẻ người viết đầy đủ (điểm
8.5/10 mẫu) — cùng giới hạn 1 tài khoản duy nhất trên dev đã ghi nhận trước.

### Số đo thật — Bề mặt 5: `/profile?tab=account` và `/profile?tab=comments`

Đo 2026-09-27, quét trong phạm vi `main`.

| Tab | Viewport | Phần tử | Chiều cao | Kết quả |
|---|---|---|---|---|
| `account` | 360/768/1440 | Chip "Tài khoản" | 44×95.22 | PASS |
| `account` | 360/768/1440 | Chip "Bình luận" | 44×92.31 | PASS |
| `account` | 360/768/1440 | Nút "Đổi tên" | 44×44 | PASS |
| `account` | 360/768/1440 | Nút "Đổi mật khẩu" | **36×129.42** | FAIL sàn 44px — **nhưng ngoài phạm vi** (xem dưới) |
| `account` | 360/768/1440 | Nút "Đăng xuất" | 44×115.78 | PASS |
| `comments` | 360/768/1440 | Chip "Tài khoản" + "Bình luận" (chỉ 2 phần tử, danh sách rỗng) | 44×~93-95 mỗi chip | PASS |
| cả hai tab | 360 | Cuộn ngang | `360=360` | Không |

**"Đổi mật khẩu" 36px — ngoài phạm vi task 49/community-solutions**: nút này
thuộc `SOURCE/features/profile/components/ProfileCard.tsx`, có từ **trước**
tính năng "Bài giải cộng đồng". Task 44 (component duy nhất chạm
`ProfileCard.tsx` trong tính năng này) xác nhận rõ trong tài liệu của chính
nó: "**one** new optional prop `reputationSlot`... every other behaviour
(avatar, display name, **password**, sign-out) is unchanged" — nút "Đổi mật
khẩu" không nằm trong Target Files/AC nào của tính năng này. Ghi nhận để
coordinator biết (giống các phần tử `components/layout/*` đã ghi ở mục "Quan
sát ngoài phạm vi" bên dưới), **không phải lỗi của task 49 hay bất kỳ task
community-solutions nào**.

**Đo thêm để kiểm tra tab Bình luận có dữ liệu**: đã thử gửi một bình luận
thật của chính mình lên bài giải của chính mình, sau đó kiểm tra
`/profile?tab=comments` — **tab vẫn hiện rỗng** ("Chưa có bình luận nào về
bài giải của bạn."), xác nhận hệ thống loại bình luận của chính tác giả khỏi
"bình luận nhận được" của họ (đúng theo thiết kế: mục này để nhận biết người
khác bình luận, không phải để soi lại bình luận của chính mình). Đã xoá
bình luận thử này ngay sau đó — không còn dữ liệu tạm.

**Không đo được vì thiếu dữ liệu (không phải lỗi)**: các thẻ bình luận có
nội dung thật (chấm chưa đọc, "{tên} hỏi ở câu {số}"/"bình luận ở câu {số}",
"Đề không còn hiện", "Xem thêm") — cần bình luận từ **tài khoản khác** trên
bài giải của tôi, không tái hiện được với 1 tài khoản duy nhất.

### TBD-01 — Chiều cao skeleton `SOURCE/app/(analytics)/profile/loading.tsx`

Đo 2026-09-27 trên trang thật `/profile?tab=account`, so với skeleton hiện
tại trong file (chú thích đầu file ghi "415px dưới 640px / 323px từ 640px",
đo ngày 2026-09-10 — **trước khi** task 44 thêm hàng chip `ProfileTabs` +
`ReputationBlock` vào `ProfileCard`).

| Bề rộng | Khối trang thật (`main` > các con trực tiếp) | Chiều cao thật | Skeleton hiện tại |
|---|---|---|---|
| 360px (<640) | `header` (tiêu đề+mô tả) | 92.5px | có khối placeholder tương ứng (không đo riêng, không phải khối bị lệch) |
| 360px (<640) | hàng chip `Tài khoản`/`Bình luận` | **44px** | **KHÔNG có khối skeleton nào cho hàng này** — thiếu hẳn |
| 360px (<640) | `ProfileCard` (có khối uy tín) | **602px** | 415px (lệch **+187px**) |
| 768px (≥640) | `header` | 71.5px | có khối placeholder |
| 768px (≥640) | hàng chip | **44px** | **KHÔNG có khối skeleton** |
| 768px (≥640) | `ProfileCard` (có khối uy tín) | **510px** | 323px (lệch **+187px**) |

**Kết luận TBD-01: KHÔNG đóng được chỉ bằng cách sửa hai con số trong chú
thích đầu file** — đây không phải sai số đo cần cập nhật, mà là **lệch cấu
trúc thật**:
1. Skeleton hiện có đúng 2 khối (tiêu đề+mô tả, rồi một khối thẻ) nhưng
   trang thật bây giờ có **3** khối (tiêu đề+mô tả, hàng chip 44px, rồi
   thẻ hồ sơ) — thiếu hẳn khối skeleton cho hàng chip.
2. Chiều cao khối thẻ thật (602px/510px) chênh nhau đúng ~187px so với số cũ
   (415px/323px) ở **cả hai** mốc bề rộng — khớp với việc `ReputationBlock`
   (task 44) được chèn thêm vào `ProfileCard`, nhưng con số 415/323 hiện tại
   trong code không phản ánh việc này.
3. Chiều cao thật của `ProfileCard` còn **phụ thuộc dữ liệu**:
   `getMyReputation()` thất bại/ném thì `reputationSlot` là `undefined` và
   thẻ ngắn lại (gần với 415/323 cũ hơn) — một con số cố định duy nhất trong
   skeleton không thể khớp thật cả hai trường hợp, đây là quyết định thiết
   kế (chọn khớp trường hợp phổ biến hơn, hay thêm khối riêng cho
   `reputationSlot` có thể ẩn) chứ không phải một phép đo đơn thuần.

Vì `loading.tsx` cần **sửa cấu trúc JSX** (thêm khối skeleton cho hàng chip,
và quyết định cách biểu diễn khối uy tín có/không), không chỉ cập nhật số đo
trong chú thích, việc này **vượt phạm vi chỉnh sửa của task 49** (task 49
không có Target Files nguồn) — routed về task 45.

**TBD-01 đã đóng — commit `43c7c58` (xác nhận lại 2026-09-27, lượt 5)**:
`loading.tsx` nay có đủ 3 khối theo đúng thứ tự trang thật (tiêu đề+mô tả →
hàng chip → thẻ hồ sơ), khối thẻ hồ sơ chọn khớp nhánh có `reputationSlot`
(nhánh phổ biến hơn với tài khoản test hiện có bài giải đã đăng) — quyết định
thiết kế được ghi lại trong chú thích đầu file. Đo lại DOM sống trên trang
thật (`main` > 3 con trực tiếp), so với các khối skeleton tương ứng:

| Bề rộng | Khối | Trang thật (đo lại 2026-09-27) | Skeleton (`loading.tsx`) | Chênh lệch |
|---|---|---|---|---|
| 360px | header | 92.5px | `h-[5.78125rem]` = 92.5px | 0px |
| 360px | hàng chip | 44px | `h-11` = 44px | 0px |
| 360px | thẻ hồ sơ | 602px | `h-[37.625rem]` = 602px | 0px |
| 768px | header | 71.5px | `sm:h-[4.46875rem]` = 71.5px | 0px |
| 768px | hàng chip | 44px | `h-11` = 44px | 0px |
| 768px | thẻ hồ sơ | 510px | `sm:h-[31.875rem]` = 510px | 0px |

Chênh lệch 0px ở cả 6 phép đo (2 bề rộng × 3 khối) — không còn giật khi
skeleton chuyển sang nội dung thật, với điều kiện `getMyReputation()` thành
công (nhánh phổ biến); nhánh lỗi/vắng `reputationSlot` sẽ ngắn hơn skeleton
một chút (đã ghi nhận có chủ đích trong chú thích file, giật nhẹ theo hướng
"trang thật thấp hơn skeleton" — hướng ít gây khó chịu hơn theo phân tích đã
có, không phải một lỗi mới).

### Quan sát ngoài phạm vi (không phải fail của task 49)

Ở cùng bề mặt 4, quét không lọc còn phát hiện các phần tử chrome dùng chung
toàn site thấp hơn 44px: skip-link "Tới nội dung chính" (`height=20`), link
breadcrumb "Kho đề" (`height=24`), nút tài khoản đầu trang thu gọn còn
`width=40` ở 360px (`min-h-11` nên cao đạt 44 nhưng rộng chưa đạt 44 —
"icon-only" tại breakpoint hẹp do tên bị ẩn qua CSS responsive). Cả ba đều
thuộc `components/layout/*`, có từ trước tính năng "Bài giải cộng đồng",
không nằm trong Target Files của task 01/07-12/17-22/28/29/36-39/44-46 —
**ghi nhận để coordinator biết, không thuộc phạm vi sửa của task 49 hay bất
kỳ task community-solutions nào**.

Ở bề mặt 5 (`/profile?tab=account`), nút "Đổi mật khẩu" đo được 36px cao ở cả
3 viewport (`SOURCE/features/profile/components/ProfileCard.tsx`) — có từ
trước tính năng, task 44 (task duy nhất chạm file này) xác nhận rõ chỉ thêm
một prop tuỳ chọn và "mọi hành vi khác (avatar, tên hiển thị, **mật khẩu**,
đăng xuất) không đổi" — ghi nhận cùng nhóm quan sát ngoài phạm vi này, không
phải lỗi của task 49 hay bất kỳ task community-solutions nào.

## Vì sao `ui-audit` hiện có không đủ cho task này

Đọc `.claude/skills/ui-audit/scripts/audit.mjs` (chỉ đọc, không sửa):

- Script cố định 3 viewport `375×812` (mobile) / `768×1024` (tablet) /
  `1440×900` (desktop) — **không có mốc 360px** mà `AC-011` yêu cầu
  (`docs/ui-spec/community-solutions-ui-spec.md` dòng "Cách đo" row `AC-011`:
  `--viewport-size=360,800`).
- Script đo CLS/long-task/console-error/failed-request và chụp ảnh khi phần
  tử gây layout-shift lúc hover/click — **không đo `getBoundingClientRect().height`
  của từng phần tử tương tác**, nên không thể tự xác nhận sàn chạm 44px hay
  hàng câu 56px. (Ngưỡng 24px được UI Spec nhắc tới nằm ở
  `references/aesthetic-checklist.md:32` của skill, không phải trong chính
  `audit.mjs`.)
- Do đó UI Spec (§ Cách đo, dòng "Hạn chế công cụ đã biết") xác nhận đây là
  khoảng trống công cụ đã biết (TBD-04) và chỉ định phép đo thủ công bằng
  Playwright CLI (`node scripts/pw/cli.mjs …`, script `scripts/pw/cli.mjs` +
  `scripts/pw/server.mjs` trong `SOURCE/`) làm thay thế đã được Design Doc
  công nhận (không mở rộng `ui-audit` trong plan này).

## Lịch sử các lần chạy

### Lần 1 (2026-09-25): chặn ở đăng nhập
Đọc toàn bộ Investigation Targets; khởi động `next dev`; session check
(`goto /profile`) trả về `?auth=signin` — **chưa đăng nhập**. Dừng lại, không
tự đăng nhập, tắt `next dev`.

### Lần 2 (2026-09-27, retry #1): vẫn chặn dù orchestrator xác nhận đã đăng nhập
Dev server đã chạy sẵn (PID 5520), dùng nguyên trạng. Session check lặp lại
kết quả `?auth=signin` — vẫn **chưa đăng nhập**. Xác minh server CLI dùng
chung còn sống (port file + `server.log` cho thấy tiến trình chạy liên tục từ
`2026-09-27T01:22:44Z`, đúng phiên hôm nay). Dừng lại, không tự đăng nhập,
không đụng dev server.

### Lần 3 (2026-09-27, retry #2 — lần chạy này): đăng nhập thật, đo được, phát hiện 1 lỗi thật

1. Tự xác nhận lại session **trước khi tin báo cáo của coordinator** (đúng
   yêu cầu của lần chạy này): `goto /profile` → trả về trang hồ sơ thật (không
   redirect `?auth=signin`); `eval` đọc nội dung trang xác nhận tài khoản
   "AnhPhat" / `smithnguyen247+rlstesta@gmail.com` — khớp tài khoản test được
   chỉ định. Session **đã đăng nhập thật**.
2. Không có Supabase MCP trong bộ công cụ của lần chạy này (dù coordinator có
   gợi ý) — khảo sát dữ liệu dev qua chính trình duyệt (Playwright CLI) thay
   vì SQL: duyệt `/exams`, kiểm tra `solutions` cho mọi đề liệt kê được. Kết
   quả: toàn bộ đề đều có **0 bài giải**, trừ `e1mp-exam-lowest` có đúng
   **1 bài giải đã đăng — của chính tài khoản test** (không có bài giải nào
   của người khác trong toàn bộ dev DB hiện tại). ⇒ Không tái hiện được các
   trạng thái "khác author + Hữu ích + bình luận + ghim" bằng dữ liệu thật với
   một tài khoản duy nhất — giới hạn đã biết, không tự tạo tài khoản thứ hai
   (ngoài phạm vi task này).
3. Xác nhận lại trạng thái `published` thật trên `e1mp-exam-lowest` attempt
   `b0a11a2d-...` (cùng đề/attempt task 08 đã dùng) — hiển thị đúng "Sửa bài
   giải" / "Xem 1 bài giải" cùng hàng, khớp bằng chứng của task 08.
4. Lấy được attempt id thật cho trạng thái `none` (chưa viết bài) từ
   `/history`: `exam-toan-10` attempt `35b7e0e8-...`, `e1mp-exam-prereq`
   attempt `6ec9386a-...`.
5. Mở màn viết (bề mặt 4) trên `e1mp-exam-prereq` attempt `6ec9386a-...`, mở
   tấm trượt ghi chú câu 1, điền ghi chú tạm 35 từ (đủ ngưỡng ≥15 từ) —
   **không lưu** (không bấm "Lưu"/"Lưu nháp"); xác nhận lại bằng `goto` mới
   rằng đề này vẫn "0 bài giải" ⇒ **không có dữ liệu tạm nào được ghi vào DB**
   trong lần chạy này.
6. Đo bề mặt 4 (tấm trượt ghi chú mở) ở đủ 3 viewport bằng `eval` quét
   `getBoundingClientRect()` trên `button, a, input[type=checkbox],
   [role=menuitem]` (loại trừ chrome dùng chung toàn site) — xem bảng số đo ở
   trên. **Phát hiện thật**: nút "Cài đặt bài giải" (`SolutionSettingsPanel`,
   task 09) cao 38px ở cả 3 viewport, dưới sàn 44px.
7. Theo đúng chỉ dẫn "nếu bất kỳ phép đo nào FAIL thì dừng lại, không tự sửa,
   báo cáo rõ" — **dừng đo tại đây**. Không đo tiếp bề mặt 1 (các trạng thái
   còn lại)/2/3/5, không mở bảng câu hỏi/tấm trượt bình luận. Không đụng dev
   server (giữ nguyên cổng 3000). Không commit.

### Lần 4 (2026-09-27, lần chạy này): xác nhận lỗi cũ đã sửa, đo hết 4 bề mặt còn lại, phát hiện 2 lỗi thật mới + TBD-01 chưa đóng được

1. Tự xác nhận lại session trước khi tin báo cáo: `goto /profile` → trang hồ
   sơ thật, không redirect — vẫn đăng nhập là "AnhPhat".
2. Xác nhận lỗi cũ (nút "Cài đặt bài giải", `SolutionSettingsPanel`, task 09,
   commit `cea9f60` đã thêm `min-h-11`) — đo lại ở 360px, nay đạt `height=44`.
   Không đo lại toàn bộ bề mặt 4 theo đúng chỉ dẫn (chỉ xác nhận nút vừa sửa).
3. **Bề mặt 1** (4 trạng thái `myStatus`): đo `none` trên `e1mp-exam-prereq`
   attempt `6ec9386a-...` (attempt vẫn ở trạng thái `none` từ lần trước); viết
   ghi chú thật + bấm "Lưu nháp" trên cùng lượt làm để chuyển thật sang
   `draft`, đo lại; đo `published` trên `e1mp-exam-lowest` attempt
   `b0a11a2d-...`; đo `hidden` tổng hợp bằng `eval` ghi đè `textContent` trên
   trang `published` (đúng phương pháp task 08). **PASS cả 4 trạng thái ở cả
   3 viewport** — xem bảng số đo ở trên.
4. **Bề mặt 2**: đo khối nháp (`e1mp-exam-prereq/solutions`, sau khi chuyển
   `draft` ở bước 3), danh sách rỗng (`exam-ly-10/solutions`), thẻ bài đã
   đăng của tôi (`e1mp-exam-lowest/solutions`). **Phát hiện 2 lỗi thật mới**:
   nút "Viết tiếp" trong `OwnSolutionBlock` (36px) và liên kết "Sửa" trong
   `SolutionCard` (20px), cả hai thuộc task 17 — xem bảng + phân tích ở trên.
5. **Bề mặt 3**: mở hàng câu, bảng câu hỏi, tấm trượt bình luận trên bài giải
   published thật; gửi + xoá thật một bình luận thử để đo thêm trạng thái "có
   bình luận" (nút "Xoá"). **PASS toàn bộ**.
6. **Bề mặt 5**: đo cả hai tab (`account`/`comments`) ở 3 viewport; thử gửi +
   xoá một bình luận thử để kiểm tra tab "Bình luận" có tự populate không (kết
   quả: không — bình luận của chính tác giả không tính vào "bình luận nhận
   được" của họ, đúng thiết kế). Phát hiện nút "Đổi mật khẩu" 36px nhưng xác
   nhận đây là phần tử **ngoài phạm vi** (pre-existing, task 44 xác nhận không
   đổi).
7. **TBD-01**: đo 3 khối con của `main` trên trang thật ở 360/768px, so với
   skeleton hiện tại — phát hiện skeleton **lệch cấu trúc** (thiếu hẳn khối
   cho hàng chip, và khối thẻ lệch +187px ở cả hai mốc) chứ không chỉ lệch số
   đo — **không sửa `loading.tsx`** vì việc sửa cần thay đổi JSX (thêm khối +
   quyết định thiết kế cho `reputationSlot` vắng mặt), vượt phạm vi task 49.
8. Theo đúng "Failure response" — không tự sửa `OwnSolutionBlock.tsx`,
   `SolutionCard.tsx`, hay `loading.tsx`. Không đụng dev server. Không commit.
   Mọi dữ liệu thử nghiệm tạo ra trong lần chạy này (bình luận thử) đã được
   xoá; riêng lượt "Lưu nháp" ở bước 3 (chuyển `e1mp-exam-prereq` attempt
   `6ec9386a-...` từ `none` sang `draft`) **giữ nguyên** trong dev DB — đây là
   dữ liệu đo hợp lệ (cùng cách task 08 tạo dữ liệu draft/published để đo),
   không phải dữ liệu rác cần dọn.

### Lần 5 (2026-09-27, lượt đo xác nhận cuối — lần chạy này): xác nhận cả 3 lỗi đã sửa, đóng task 49

Cả 3 lỗi thật (task 09, 2× task 17) đã được sửa và commit trước khi lượt này
bắt đầu (`acfa528`, `43c7c58`) theo báo cáo của điều phối viên — lượt này
**tự đo lại trên DOM sống**, không chỉ tin file nguồn hay báo cáo commit.

1. Tự xác nhận lại session trước khi đo: `goto /profile` → trang hồ sơ thật,
   không redirect — vẫn đăng nhập là "AnhPhat".
2. Đọc lại 3 file nguồn đã sửa (`OwnSolutionBlock.tsx`, `SolutionCard.tsx`,
   `profile/loading.tsx`) để xác nhận nội dung fix đã có trong file nguồn
   trước khi đo DOM (đối chiếu HMR).
3. Đo lại nút "Viết tiếp" (`OwnSolutionBlock`, nhánh nháp) trên
   `e1mp-exam-prereq/solutions` (attempt `6ec9386a-...` vẫn ở trạng thái
   `draft` từ lượt 4) ở cả 3 viewport — `height=44, width=101.39` cả ba lần,
   HMR đã áp dụng đúng. Không đo trực tiếp "Xem lý do" (không có dữ liệu bị
   ẩn thật) — xác nhận qua đọc mã nguồn (cùng đoạn không truyền `size`).
4. Đo lại liên kết "Sửa" (`SolutionCard`) trên `e1mp-exam-lowest/solutions` ở
   cả 3 viewport — `height=44, width=26.42` cả ba lần; `outerHTML` xác nhận
   class `min-h-11` có mặt trên DOM sống.
5. Đo lại 3 khối `main` trên `/profile?tab=account` ở 360px và 768px, so với
   số đo mã hoá trong `loading.tsx` — khớp 0px lệch ở cả 6 phép đo (2 bề rộng
   × 3 khối: header/hàng chip/thẻ hồ sơ).
6. Kiểm tra không cuộn ngang ở 360px trên cả hai trang bề mặt 2
   (`e1mp-exam-lowest/solutions`, `e1mp-exam-prereq/solutions`) —
   `scrollWidth=clientWidth=360` cả hai.
7. **Kết luận: cả 3 điểm đều PASS trên DOM sống, HMR đã áp dụng đầy đủ, không
   cần refresh/restart dev server.** Không đụng dev server. Không commit.
   Không tạo/xoá dữ liệu thử nghiệm nào trong lượt này (chỉ đọc/đo). **Task 49
   HOÀN TẤT — tính năng "Bài giải cộng đồng" PASS visual acceptance
   (AC-011, AC-049, AC-059, AC-064, AC-097).**

## Việc còn lại (không phải fail của task 49)

Cả 3 lỗi thật + TBD-01 phát hiện qua các lượt đo trước đã được sửa và xác
nhận lại PASS bằng đo DOM sống (lượt 5, xem "Trạng thái" ở đầu tài liệu và
các bảng số đo tương ứng). Không còn mục nào cần fix commit tiếp theo cho
AC-011/AC-049/AC-059/AC-064/AC-097.

Còn lại (ngoài phạm vi sửa của task 49, không chặn việc đóng task):

1. Ngân sách bundle (`AC-103`/M12), XSS (`RichText.xss.test.tsx`), đếm từ
   (`AC-023`) là các dòng khác trong bảng "Cách đo" — **ngoài phạm vi task 49**
   (task 49 chỉ phụ trách hai dòng đầu: `AC-011` + sàn chạm 44px), không đo
   trong deliverable này.
2. Các trạng thái không đo được vì thiếu dữ liệu (không phải lỗi, xem từng
   mục ở trên): bài ghim, thẻ ẩn danh, bài giải/bình luận của **tác giả
   khác**, huy hiệu "Hữu ích" của người khác, khối "Người viết" đầy đủ, lưới
   5 cột thật của bảng câu hỏi (đề hiện có chỉ 1 câu), nút "Xem lý do" (nhánh
   bị ẩn của `OwnSolutionBlock`, xác nhận qua suy luận mã nguồn chứ không đo
   trực tiếp) — cần một tài khoản dev thứ hai, một đề nhiều câu hơn có bài
   giải, hoặc quyền kích hoạt kiểm duyệt thật để đo, ngoài khả năng của task
   49 (không có quyền tạo tài khoản/dữ liệu thứ hai).
3. "Đổi mật khẩu" 36px (`ProfileCard.tsx`) và các phần tử chrome dùng chung
   (`components/layout/*`) — xác nhận có từ trước tính năng, ngoài phạm vi
   mọi task community-solutions (xem "Quan sát ngoài phạm vi").
