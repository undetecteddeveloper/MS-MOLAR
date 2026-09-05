# Design plan — refactor UI/UX theo hướng "Sân trường"

**Ngày:** 2026-09-04 · **Nhánh:** `design/ui-refactor-san-truong` · **Row Notion:** "Refactor UI/UX toàn site — hướng B"
**Trạng thái:** đang thực hiện. Nguồn giá trị token là `SOURCE/app/globals.css`; file này là quy tắc và lý do.

## 1. Brief (engineer chốt 2026-09-04)

- Layout cũ tự nghĩ hoặc lấy từ template đơn giản nên không nổi bật. Giao toàn quyền tái thiết kế theo hướng **chuyên nghiệp, nhất quán, ưu tiên điện thoại** (học sinh lớp 6–12, Android tầm trung).
- Đơn giản nhưng là đơn giản **được chọn lọc**; màu sắc **thu hút học sinh** nhưng **không loè loẹt**, không gradient ở mọi component.
- Chỉ **tiếng Việt**; gỡ module dịch thuật. Giữ tên **MS-MOLAR**. Ô logo để trống chờ logo mới.
- Gỡ các trang billing khỏi giao diện (giá, thanh toán, đơn hàng, chính sách hoàn tiền); phần chạy ngầm giữ nguyên. Giữ Giới thiệu và Điều khoản.
- Không đổi luồng, route, dữ liệu, sàn WCAG AA, thanh điều hướng đáy, chế độ tập trung khi làm bài, mẫu PDF, ngân sách hiệu năng.
- Chọn hướng **B "Sân trường"** trong ba prototype (A Vở ô ly, B Sân trường, C Phòng tự học — `SCREENSHOT/temporary_screenshot/prototype/ui-directions.html`), lý do: "vừa đơn giản vừa cuốn hút màu sắc hơn hai bản còn lại".

## 2. Token

### Màu (6 màu làm việc)

| Vai trò | Giá trị | Ghi chú tương phản |
|---|---|---|
| Nền | `#FFFFFF` | |
| Bề mặt (thẻ, chip, khối phụ) | `#EEF7F1` | Đây là "viền" của theme: phân lớp bằng nền tô, không kẻ viền |
| Chữ | `#14291C` (xanh đen) | 15,6:1 trên trắng |
| Chữ phụ | `#4F6656` | 6,2:1 trên trắng, 5,6:1 trên bề mặt |
| Hành động (primary) | `#117A45` | 5,4:1 trên trắng → chữ trắng trên nút đạt AA mọi cỡ. `#158A4E` của prototype chỉ 4,4:1 nên đã hạ |
| Vàng nắng | `#FFC531` / nền nhẹ `#FFF3CF` | Chỉ 1,6:1 trên trắng → **không bao giờ** là ranh giới thông tin một mình: đứng sau icon/chữ đen (ô active thanh đáy), hoặc kèm viền đậm (lựa chọn đang chọn), hoặc làm nền tô nhẹ |
| Sai / xoá | `#C43E2A` chữ, `#E4573D` khối lớn | 5,1:1 / 3,7:1 |
| Viền ô nhập | `#6F8D78` | 3,6:1 (WCAG 1.4.11) |
| Kẻ trang trí | `#CFE3D6` | không chịu ngưỡng |

Thanh tiến độ tô **xanh** (3,9:1 trên track), không tô vàng — vàng không đạt 3:1 trên nền sáng.

### Chữ

Một họ duy nhất: **Lexend** 400/500/600/700, subset `latin + vietnamese`, nạp qua `next/font/google` (`--font-lexend`). Số dùng `tabular-nums` (đồng hồ, điểm, phân trang) thay cho font mono.

| Vai trò | Cỡ / đậm |
|---|---|
| Tiêu đề trang (display, tối đa 1/trang) | clamp(30px, 5vw, 52px) / 700, leading 1.1 |
| h1 trang tác vụ | 24–28px / 700 |
| h2 khối | 18–20px / 600 |
| Thân | 16px / 400, leading 1.5–1.55 |
| Phụ, meta | 13–14px / 400–500 |
| Nhãn nhỏ (`.eyebrow`) | 12px / 600, **chữ thường**, không giãn chữ |

Không in hoa nhãn, không dấu chấm giữa nối meta, không mũi tên sau chữ nút, không tô màu một cụm từ trong tiêu đề.

### Hình dạng và không gian

- Bán kính gốc `--radius: 14px` (sm 8 · md 11 · lg 14 · xl 20). Thẻ nội dung `--radius-card: 18px`. Nút hành động và chip: `rounded-full`.
- Nút: cao 44px mặc định (sàn vùng chạm), 52px cho hành động chính của một màn hình, 36px cho nút trong thẻ.
- Không box-shadow, không gradient. Trạng thái hover/active đổi **nền** (đậm hơn 6–8%), không đổi hình.
- Khoảng cách theo thang 4/8/12/16/20/24/32. Lề trang trên điện thoại 20px.
- Bề rộng trang giữ ba nấc `small 42rem / default 48rem / full 72rem` (PageContainer).

## 3. Bố cục

- **Một hệ điều hướng cho mọi trang, kể cả trang chủ**: SiteHeader trắng (ô logo trống + chữ MS-MOLAR, dãy liên kết từ 768px, ô tài khoản) và BottomNav 5 ô dưới 768px (ô đang chọn: viên thuốc vàng sau icon đen). Sidebar riêng của trang chủ bị bỏ.
- **Trang chủ**: hai cột từ 1024px. Cột trái là hero căn trái (tiêu đề display, đoạn dẫn ≤ 34 ký tự/dòng, nút "Bắt đầu luyện đề" + liên kết "Xem kho đề"); form đăng nhập/đăng ký hoán đổi tại chỗ với hero (giữ cơ chế `?auth=`). **Cột phải đổi theo trạng thái đăng nhập** (engineer chốt 2026-09-04):
  - *Khách*: `HeroFigure` — phiếu trả lời trắc nghiệm **vẽ bằng CSS**, không phải ảnh. Sáu câu A/B/C/D, vài câu đã tô, câu đang làm viền vàng, thẻ điểm "8,5 · Chấm xong ngay" nổi ở góc. Theo lối minh hoạ của Supabase (sơ đồ trừu tượng trên nền lưới mờ, một màu nhấn duy nhất) nhưng dựng từ vốn từ vựng của chính sản phẩm. Lý do không dùng ảnh: ~0 byte thay vì 60–200KB ở đúng phần tử LCP; không phụ thuộc CDN ảnh; và ảnh minh hoạ chung chung là dấu hiệu "mẫu có sẵn". Kho đề nằm sau đăng nhập (RLS `to authenticated`) nên với khách KHÔNG có thẻ đề thật nào để hiện.
  - *Đã đăng nhập*: ba đề mới nhất, thẻ thật bấm được (`ExamBrowser layout="stack"`). Người đã đăng nhập mở trang chủ là để làm đề.
  - Cả hai ẩn khi form auth đang mở — lúc đó mắt chỉ còn một việc.
- **Kho đề**: tiêu đề "Kho đề", ô tìm, hàng chip lọc cuộn ngang, lưới thẻ 1 → 2 → 3 cột. Thẻ đề: nhãn môn + lớp, tên đề, meta (thời gian, số câu, trường), thang độ khó 4 nấc, nút "Làm đề" 36px.
- **Làm bài** (chế độ tập trung): thanh trên gồm nút thoát, tên đề rút gọn, đồng hồ dạng chip, nút cờ; "Câu 7 trên 40" + thanh tiến độ; câu hỏi; bốn lựa chọn dạng thẻ tô nền, đang chọn = nền vàng nhẹ + viền vàng đậm; thanh đáy Câu trước / Nộp bài / Câu sau.
- **Kết quả**: thẻ điểm (số 64px màu xanh, "trên 10"), dòng thời gian làm, bảng Đúng/Sai/Bỏ trống có chấm màu; hai nút Xem từng câu / Làm lại đề; thẻ "Luyện tiếp chỗ còn yếu" nền vàng nhẹ.
- Căn **trái** toàn bộ; chỉ số điểm và trạng thái rỗng căn giữa.

## 4. Nguyên tắc

1. **Một chỗ táo bạo**: vàng nắng. Mọi thứ khác im lặng (trắng, xanh nhạt, chữ xanh đen).
2. **Nền tô thay viền**: khối nào cần tách thì tô `surface`; viền chỉ còn ở ô nhập (bắt buộc theo WCAG) và kẻ chia trong danh sách.
3. **Trạng thái bằng hình lẫn màu**: đang chọn có viền + nền, đúng/sai có chấm + chữ, không dựa vào màu đơn thuần.
4. **Chữ là lời của sản phẩm**: xưng "bạn", câu ngắn, nút nói đúng việc xảy ra ("Làm đề", "Nộp bài", "Làm lại đề").
5. **Điện thoại trước**: mọi thứ dựng ở 360px rồi mới nới lên; vùng chạm ≥ 44px; không cuộn ngang; thanh đáy giữ nguyên 5 ô.

## 5. Tự soát trước khi dựng (chống "mặc định AI")

| Dấu hiệu mẫu có sẵn | Ở theme cũ | Theme mới |
|---|---|---|
| Kem + serif + đỏ đất | Có | Bỏ hẳn (trắng, Lexend, xanh lá) |
| Nhãn in hoa giãn chữ | Có (`.eyebrow`, nav) | Bỏ; nhãn chữ thường 12px/600 |
| Dấu chấm giữa nối meta | Có (`0.0/10 · 31/08 · 43s`) | Tách bằng khoảng cách hoặc dấu phẩy |
| Mũi tên sau chữ nút/liên kết | Có (`RATE →`, `Tiếp →`) | Bỏ |
| Cùng một bo góc và bóng cho mọi khối | Có (rounded-lg) | Bo theo vai trò: pill / 18px / 14px; không bóng |
| Tô màu một cụm từ trong tiêu đề | Prototype B lần 1 | Bỏ ở lần soát 1 |
| Xám trung tính không chọn lọc | — | Xám ngả xanh `#4F6656` / `#CFE3D6` |

## 6. Phạm vi kỹ thuật của đợt

- `lib/copy.ts` thay `lib/i18n/**` (một từ điển tiếng Việt, hàm `t()` thuần). Đồng thời đóng TD-033.
- Gỡ `app/(billing)/pricing`, `me/orders`, `refund-policy`; gỡ component UI billing (`features/billing/components/**`, `components/billing/{LegalLinks,OrderStatusBadge,RecheckOrderControl,TutorQuotaNote}`); giữ `lib/billing`, `features/billing/queries.ts`, webhook payOS, schema.
- Token + font + primitives (`button`, `input`, `card`, `badge`, `chip`, `progress`) → khung (SiteHeader, BottomNav, PageHeader) → từng nhóm trang theo thứ tự ưu tiên.
- Mỗi nhóm trang: chụp 360/768/1280, đối chiếu mục 2–4, đo CLS/long task, engineer duyệt, 6 cổng, commit.
