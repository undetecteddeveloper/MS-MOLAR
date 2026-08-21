# Kế hoạch — Layout Responsive cho Mobile

**Ngày:** 2026-08-07
**Nguồn nghiên cứu:** `Mobile-Layout-Research-MS` (Google Drive, đọc qua Composio
→ Drive export; toolkit `googledocs` KHÔNG connected trong phiên này nên không
đọc bằng `GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT` được).
**Trạng thái trước khi làm:** website chỉ hỗ trợ tốt desktop.

---

## 0. Phần tài liệu nghiên cứu KHÔNG áp dụng

Ghi ra đây để phiên sau không đi tìm lại rồi tưởng bị bỏ sót:

- **§6.1 VietQR / Deep Link ngân hàng** — MS-MOLAR không có thanh toán, không có
  giỏ hàng, không có luồng checkout. Không có gì để tích hợp.
- **§7.1 E-commerce / Shoppertainment** (Sticky "Thêm vào giỏ", Listing Banner) —
  cùng lý do.
- **Chat widget Zalo (§6.2 nhắc tới)** — site hiện KHÔNG có widget nào. Thêm một
  cái là QUYẾT ĐỊNH SẢN PHẨM, không phải sửa layout; nếu sau này thêm thì quy tắc
  chống đè (§6.2) đã ghi sẵn ở mục 4 dưới đây.

Phần áp dụng trực tiếp là **§7.2 Nền tảng Giáo dục và Nội dung Chuyên sâu**, cộng
với §1–§5 (ngân sách hiệu năng, breakpoint, thumb zone, mật độ thông tin).

---

## 1. Hiện trạng — ĐO THẬT, không đọc code đoán

Đo bằng trình duyệt thật ở viewport 360×800 (dải chiếm 11,75% thị phần VN theo
§2.1), tài khoản `smithnguyen247+rlstesta@gmail.com`.

| Mã | Vấn đề | Số đo |
|----|--------|-------|
| F1 | `SiteHeader` tràn ngang MỌI route đã đăng nhập | `scrollWidth` 468px / `clientWidth` 350px → **tràn 118px**. `HeaderProfile` nằm ở x=402–468, HOÀN TOÀN ngoài màn hình |
| F2 | Dải nav trang chủ ăn 37% chiều cao | `<aside>` cao **296px / 800px**; CTA chính "Bắt đầu" rơi xuống y=827 bên trong khung cuộn nội bộ cao 504px |
| F3 | Vùng chạm dưới ngưỡng 44–48px (§4.3) | 21 phần tử ở `/exams`, 16 ở player. Nav link cao **29px**; checkbox lọc **16×16**; CTA thẻ "Chấm →" **63×16** |
| F4 | Rail bộ lọc không dùng được | 3 ô lọc nhanh render ở `left: -46px` — ngoài mép trái màn hình; nhãn cụt còn "ất" |
| F5 | Player không có điều khiển thường trực | `QuestionPagination` bắt đầu ở y=797 — đúng MỘT viewport bên dưới, với đề chỉ **5 câu**. Đồng hồ + "Nộp bài" cuộn mất |
| F6 | Biểu đồ dashboard chỉ có hover | "Rê chuột lên một môn để xem chi tiết" — không có đường chạm (§4.3 cấm hover-only) |
| F7 | Toast nằm trong vùng ngón cái | `fixed inset-x-0 bottom-6`; §6.2 yêu cầu flash message đẩy từ TRÊN xuống |

**Gốc rễ của F1 + phần lớn F3 là MỘT thứ:** 5 nav link + nút ngôn ngữ + ô profile
nhồi vào một hàng ngang duy nhất, mỗi link `whitespace-nowrap`. Không có cơ chế
sụp đổ nào.

Điểm ĐÃ ĐÚNG sẵn (không được phá khi sửa): không chỗ nào dùng `100vh`/`h-screen`
(§3.2 đã đạt — trang chủ dùng `h-dvh`); `ExamBrowser` đã có lưới 1→2→3 cột;
`ExamPlayer` đã có vuốt trái/phải (`useSwipe`); `PublishBar` đã `sticky bottom-0`.

---

## 2. Hệ điểm ngắt — ÁNH XẠ vào mặc định Tailwind, KHÔNG tự chế

Tài liệu §3.1 chia 4 tầng. Tailwind v4 mặc định: `sm`=640, `md`=768, `lg`=1024.

| Tầng tài liệu | Dải | Dùng gì |
|---------------|-----|---------|
| 1 — Vi di động | <360px | base, chỉ cần KHÔNG vỡ (không có breakpoint riêng) |
| 2 — Di động chính | 360–767px | base (không tiền tố) |
| 3 — Máy tính bảng | 768–1023px | **`md:`** |
| 4 — Màn hình lớn | ≥1024px | **`lg:`** |

Ranh giới tầng 2↔3 của tài liệu (768px) TRÙNG ĐÚNG `md` mặc định của Tailwind, và
ranh giới 3↔4 (1024px) trùng đúng `lg`.

**Quyết định: KHÔNG khai báo breakpoint tuỳ biến.** Lý do — một bộ breakpoint tự
chế sẽ thành nguồn chân lý THỨ HAI nằm cạnh bộ mặc định của Tailwind: mọi người
sau phải học thêm một hệ, và `sm:` (vẫn tồn tại, vẫn dùng được) sẽ âm thầm mang
nghĩa khác với `md:` tự chế. Chi phí học + chi phí lệch pha lớn hơn lợi ích của
việc đặt tên riêng, trong khi mặc định đã khớp sẵn con số tài liệu yêu cầu.

**Hệ quả cần biết:** code cũ dùng `sm:` (640px) làm lằn ranh "hết mobile". Dải
640–767px vì thế đang nhận bố cục kiểu desktop trong khi tài liệu xếp nó vào
"di động chính". Những chỗ quyết định bố cục nav/lọc/player chuyển sang `md:`;
`sm:` còn lại ở chỗ chỉ chỉnh cỡ chữ/khoảng cách thì giữ nguyên (đổi hết sẽ là
một đợt churn lớn không mua thêm gì).

---

## 3. Kiến trúc điều hướng — Bottom-heavy (§4.2)

Đây là thay đổi lớn nhất, và là thứ trả cùng lúc F1 + F2 + phần lớn F3.

```
MOBILE (<768px)                     DESKTOP (≥768px)
┌──────────────────────┐            ┌──────────────────────────────┐
│ [logo]      [avatar] │  56px      │ [logo] Nhà Đề TK LS Tải  VI/EN [avatar] │
├──────────────────────┤            ├──────────────────────────────┤
│                      │            │                              │
│   nội dung           │            │   nội dung                   │
│   (không tràn ngang) │            │                              │
│                      │            │   (GIỮ NGUYÊN như hiện tại)  │
├──────────────────────┤            └──────────────────────────────┘
│ ⌂   ▤   ◠   ↺   ↑   │  56px
│ Nhà Đề  TK  LS  Tải │  mỗi ô ≥48px — VÙNG XANH
└──────────────────────┘
```

- **`components/layout/BottomNav.tsx`** (mới) — `fixed bottom-0`, `md:hidden`,
  5 đích, mỗi ô `min-h-12` (48px) và chia đều `flex-1`. Active theo
  `usePathname()` dùng ĐÚNG logic so khớp của `SiteHeader` (không viết lại lần
  hai — hai bản so khớp lệch nhau là bug im lặng).
- **`SiteHeader`** — ẩn dãy 5 link ở `max-md:`; logo chuyển từ `max-sm:hidden`
  sang LUÔN hiện (nay có chỗ vì link đã dọn đi). `LanguageToggle` +
  `HeaderProfile` ở lại header: chúng là thao tác HIẾM, không xứng một ô trong
  thanh đáy vốn chỉ có 5 chỗ.
- **Guest** — tag "Tài khoản" ở lại header (không chiếm ô đáy), giữ đúng 5 ô cho
  cả guest lẫn user đã đăng nhập. Thanh đáy KHÔNG được đổi số ô theo trạng thái
  đăng nhập: vị trí ô là trí nhớ cơ bắp, xê dịch nó là phá chính thứ khiến bottom
  nav đáng giá.
- **`SiteHeader` chuyển chỗ** `app/(layer2)/_components/` → `components/layout/`.
  Nó đã được 4 route group dùng chung và nay dùng cả ở trang chủ; nằm trong
  `_components` của layer2 là sai chỗ từ trước, và giờ thì gây hiểu nhầm thật.
- **Trang chủ** — `HomeSidebar` chuyển thành `max-lg:hidden`; dưới `lg` trang chủ
  dùng chính `SiteHeader` + `BottomNav` như mọi trang khác. Thu hồi 296px, và
  toàn site chỉ còn MỘT hệ điều hướng trên mobile thay vì hai.

**Vùng an toàn (§6.2 "Navigational Clearance"):** thanh đáy cộng
`env(safe-area-inset-bottom)`; nội dung trang cộng padding đáy bằng
`3.5rem + safe-area` để dòng cuối không chui xuống dưới thanh. Định nghĩa MỘT
lần bằng utility `.pb-bottom-nav` trong `globals.css`, không rải số 56px khắp nơi.
`app/layout.tsx` thêm `viewportFit: "cover"` — thiếu nó thì `env(safe-area-*)`
luôn trả 0 và cả cơ chế trên thành vô nghĩa.

---

## 4. Các thay đổi còn lại

| Mã | Việc | Cách |
|----|------|------|
| F3 | Vùng chạm ≥44px | `min-h-11` cho `LanguageToggle`, trigger `HeaderProfile`, `RateButton`, ô lọc nhanh; ô `QuestionPagination` giữ `aspect-square` nhưng nâng sàn |
| F4 | Bộ lọc mobile | Dưới `md`: rail dọc + panel `absolute` đổi thành **bottom sheet** (`fixed inset-x-0 bottom-0`, `max-h-[70dvh]`, tự cuộn). 3 ô lọc nhanh chuyển VÀO sheet. Desktop giữ nguyên rail sticky |
| F5 | Player | Dưới `md`: thanh hành động **sticky đáy** (Trước · Nộp bài · Tiếp) nằm TRÊN `BottomNav`; đồng hồ vào dải sticky trên; `QuestionPagination` thành khối đóng/mở được |
| F6 | Biểu đồ | Thêm đường chạm/tiêu điểm song song với hover (không bỏ hover — desktop vẫn dùng) |
| F7 | Toast | Dưới `md` đẩy lên **top-center**; desktop giữ bottom-center. Bắt buộc: sau khi có `BottomNav`, một toast `bottom-6` sẽ nằm ĐÚNG TRÊN thanh đáy — tự mình tạo ra đúng cái xung đột §6.2 mô tả |

---

## 5. Ràng buộc phải giữ

Lấy từ `.claude/MEMORY.md` §3 và `globals.css` — thay đổi bố cục KHÔNG được kéo
theo thay đổi bản sắc:

- Token màu lấy từ `globals.css` (nguồn chuẩn), không chép hex từ bảng theme.
- Trên nền đen sơn mài dùng `--brand-on-dark`, KHÔNG dùng `--brand`.
- Không đổ bóng, không gradient — phân lớp bằng nền + hairline.
- Không trộn serif vào button/label/navigation.
- Thứ tự DOM = thứ tự đọc; không dùng `order-*` để kéo ô lên trên về mặt thị giác
  (WCAG 1.3.2 / 2.4.3).

## 6. Cổng verify

`npx tsc --noEmit` · `npx eslint --max-warnings 0` · `npx vitest run` ·
`npm run build`, chạy trong `SOURCE/`. Sau đó đo LẠI bằng trình duyệt thật ở
360×800: `scrollWidth - clientWidth` phải bằng **0** trên mọi route đã sửa.
