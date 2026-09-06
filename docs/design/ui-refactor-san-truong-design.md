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
- **Trang chủ**: hai cột từ 1024px. Cột trái là hero căn trái (tiêu đề display, đoạn dẫn ≤ 34 ký tự/dòng, nút "Bắt đầu luyện đề" + liên kết "Xem kho đề"); form đăng nhập/đăng ký hoán đổi tại chỗ với hero (giữ cơ chế `?auth=`); khi form mở, lưới về một cột và form **căn giữa** (engineer 2026-09-06 — trước đó lưới vẫn hai cột nên form dồn sang trái nửa màn hình). Liên kết "Về MS-MOLAR" ở chân trang cũng **căn giữa** (engineer 2026-09-06): ngoại lệ có chủ đích của quy tắc căn trái, vì đó là dòng khép trang. **Cột phải đổi theo trạng thái đăng nhập** (engineer chốt 2026-09-04):
  - *Khách*: `TechStack` — bốn công nghệ website chạy trên (Next.js, Supabase, Gemini, Groq) và công cụ đã xây nó (Claude Code), engineer chốt 2026-09-05 thay cho hình phiếu trả lời vẽ bằng CSS của bản trước. Logo là file SVG **màu chính thức** trong `public/logos/` (bộ svgl), không vẽ lại, không đổi màu; nhúng bằng `<img>` vì hai file khai gradient trùng id, inline cùng trang sẽ tô nhầm. Từ 640px: lưới 2 cột nội dung ngang, ô Claude Code trải hết bề rộng vì nó khác loại: công cụ xây, không phải thứ website chạy trên. **Dưới 640px — bố cục "trục"** (engineer 2026-09-05: một cột tuần tự "trông tầm thường"): bốn ô vận hành xếp 2×2, mỗi ô có hàng đầu (logo + tên cạnh nhau) rồi vai trò xuống dòng dưới trải hết bề ngang ô (engineer 2026-09-05: tên phải nằm cạnh logo); lưới `auto-rows-fr` để bốn ô cao bằng nhau (101px ở 360px) dù vai trò ô này gãy hai dòng ô kia một dòng. Claude Code là đồng xu trắng 56px nằm đúng giao điểm bốn ô, khoét vào bốn góc trong, chú thích tên + vai trò ngay dưới lưới. Vị trí nói thay lời: công cụ xây đứng giữa những thứ nó đã ghép lại. Đã cân nhắc và bỏ: xếp gạch so le (đáy lưới lệch, ô Claude Code hụt một góc), dải cuộn ngang (giấu 3/5 nội dung, cần dấu hiệu cuộn), tab logo + một thẻ (cần JS, mỗi lúc chỉ đọc được một vai trò), nhãn dán xoay nhẹ (chữ nghiêng khó đọc ở 12px, lệch tinh thần "đơn giản chọn lọc"). Đo 2026-09-05 ở 360px: khe 20px + đồng xu 56px đè 18px lên mỗi ô, hở 3,1px tới hộp logo gần nhất, bốn ô đều cao 101px, không cuộn ngang. Khe 16px đã thử: từ khi tên đứng cạnh logo, hộp logo hai ô hàng dưới chỉ còn hở 0,3px. Mỗi ô ghi vai trò THẬT trong repo (Gemini đọc đề + gợi ý gia sư, Groq chấm tự luận). Kho đề nằm sau đăng nhập (RLS `to authenticated`) nên với khách KHÔNG có thẻ đề thật nào để hiện.
  - *Đã đăng nhập*: ba đề mới nhất, thẻ thật bấm được (`ExamBrowser layout="stack"`). Người đã đăng nhập mở trang chủ là để làm đề.
  - Cả hai ẩn khi form auth đang mở — lúc đó mắt chỉ còn một việc.
  - **Sóng ô vuông trên nền** (engineer chốt 2026-09-05, sau khi cân lợi/hại): chạm vào NỀN trang chủ thì một vành sóng ô vuông 32px màu `--primary` lan ra từ điểm chạm và mờ dần. **Vô hình cho tới khi chạm** — không lưới mờ thường trực, để giữ quyết định nền trắng phẳng; đổi lại ít người phát hiện, chấp nhận. Sóng chỉ nổi khi chạm đúng **khoảng trắng** (engineer 2026-09-06): mục tiêu chạm không có chữ trực tiếp, không phải hình, không tương tác, và dò ngược lên tới khối trang không gặp phần tử nào có nền tô — chạm vào tiêu đề, thẻ công nghệ, thanh trên hay nút đều không có sóng (đã kiểm từng trường hợp trên trình duyệt). Không nổi khi đã kéo hay giữ, và khi người dùng chọn giảm chuyển động. Lớp vẽ nằm dưới nội dung nên thẻ và nút che sóng như vật nổi trên mặt nước. Chi phí lúc nghỉ: ba listener, không canvas, không mã vẽ (module vẽ nạp ở cú chạm đầu); lúc chạy: canvas gắn vào rồi gỡ ngay khi sóng tắt, vẽ ở tối đa 1,5× DPR, chỉ lặp ô trong vành, tối đa 3 sóng. Đỉnh sóng alpha 0,28 (0,2 đã thử: quá nhạt), ease-out bậc hai (bậc ba đã thử: rời điểm chạm quá nhanh), sống 1450ms (1100ms ở bản đầu; engineer xin dài thêm ~30% để kịp ngắm). Mã: `features/home/ripple/`.
- **Kho đề**: tiêu đề "Kho đề", ô tìm, hàng chip lọc cuộn ngang, lưới thẻ 1 → 2 → 3 cột. Thẻ đề: nhãn môn + lớp, tên đề, meta (thời gian, số câu, trường), thang độ khó 4 nấc, nút "Làm đề" 36px.
- **Chi tiết đề** (engineer chốt 2026-09-06, hai vòng duyệt): breadcrumbs → nhãn môn/lớp → tên đề → tác giả → khối thông số → thẻ vàng "Trước khi bắt đầu" mang nút Làm bài → (đã đăng nhập) liên kết báo cáo đề, dưới một kẻ chia chạy hết bề ngang. Bento 6 ô kẻ viền của bản trước bỏ hẳn (viền là dấu vết theme cũ, §5).
  - Khối thông số KHÔNG dùng lưới ô vuông đều — vòng duyệt đầu dùng lưới 2 cột và engineer chỉ ra hai lỗ hổng: ô dài (trường, độ khó) trải hết hàng bỏ lại nửa hàng trống, và ô vắng dữ liệu cũng bỏ lại nửa hàng trống. Sửa bằng cách chia theo tiêu chí "thông số này có LUÔN tồn tại hay không": số câu + thời lượng (NOT NULL trong DB) là hai Ô cố định đứng cạnh nhau ở hàng đầu; độ khó/trường/năm học/học kỳ (đều nullable) là DÒNG trải hết bề ngang, nhãn trái giá trị phải, vắng thì mất nguyên dòng chứ không để lại ô trống lửng. Kẻ chia giữa các dòng là ngoại lệ đã cho phép của quy tắc "nền tô thay viền" (§4.2: viền còn ở ô nhập VÀ kẻ chia trong danh sách).
  - Liên kết báo cáo đề đứng sau một kẻ chia chạy hết bề ngang trang, không đứng trơ trọi sau khoảng trắng: hai thẻ (thông số / thẻ vàng) hiếm khi cao bằng nhau vì thẻ thông số co theo số dòng có dữ liệu, nên phần đáy trang từng là một mảng trắng không có gì đóng lại — kẻ chia biến nó thành khoảng thở của một dòng khép trang (giống "Về MS-MOLAR" ở chân trang chủ).
  - Sự cố kỹ thuật gặp và sửa trong vòng duyệt này: `DifficultyBadge` biến thể `detail` từng tự trả `<dd>` để cắm thẳng vào `<dl>`; khi trang được viết lại thành "một dòng nhãn-trái/giá-trị-phải dùng chung", `<dd>` đó rơi vào TRONG một `<dd>` khác — HTML sai, React báo lỗi hydration (rerender lại từ đầu ở trình duyệt). Sửa: cả hai biến thể của `DifficultyBadge` giờ chỉ trả `<span>` nội tuyến, không tự mang thẻ ngữ nghĩa nào; ngữ nghĩa `<dl>`/`<dt>`/`<dd>` do nơi gọi quyết định. Có ca kiểm giữ cho `<dd>` lồng nhau không quay lại.

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
