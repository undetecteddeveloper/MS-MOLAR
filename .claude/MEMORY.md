# MS-MOLAR — Memory Consolidated (2026-08-06)

> File này thay thế phần lớn Claude Code auto-memory chi tiết trước đây. Toàn bộ lịch sử implementation + theme được lưu ở file này thay vì trong memory ẩn.

## 1. Nội dung được giữ lại trong Claude Code memory

- **Test accounts** (password chung `rls-test-password-123`):
  - `smithnguyen247+rlstesta@gmail.com` — tài khoản test chính, hiển thị tên "AnhPhat" trên navbar
  - `smithnguyen247+rlstestb@gmail.com`
  - `smithnguyen247+se2rater1@gmail.com` … `+se2rater10@gmail.com` — 10 tài khoản dùng để test rating threshold (N=3 raters)
  - ⚠️ KHÔNG đụng `smithnguyen247@gmail.com` và `nguyenphatbentre904@gmail.com` — đây là tài khoản thật của user (không có `+alias`)

## 1b. Định hướng chụp screenshot bằng Playwright (tránh downscale)

Claude Code có giới hạn cứng của API Anthropic: ảnh bị downscale nếu cạnh dài nhất vượt 8000px (1 ảnh) hoặc 2000px (nhiều ảnh cùng lúc trong context) — không có setting nào tắt được. Khi cần chụp lại **toàn bộ layout của một trang** để xem/chỉnh sửa UI, đây là định hướng nên theo (không phải luật cứng, tuỳ ngữ cảnh mà linh hoạt):

- Đừng chụp `fullPage: true` nguyên trang dài — chụp **từng phần nhỏ** (theo section/viewport, hoặc element-scoped screenshot dùng `ref` từ `browser_snapshot`) rồi ghép lại trong đầu khi review.
- Nếu một trang cần nhiều ảnh (nhiều section), có thể **tạo subfolder riêng cho nhóm screenshot của trang đó** (ví dụ `SCREENSHOT\temporary_screenshot\<ten-trang>\`) để dễ quản lý và dễ dọn dẹp sau khi dùng xong, thay vì đổ chung vào `temporary_screenshot`.
- Việc chia nhỏ ảnh cũng giúp né giới hạn 2000px khi context đang tích luỹ nhiều ảnh cùng lúc.

## 2. Workflow tổng thể mỗi phiên

Ba pha, chạy theo thứ tự. Pha 2 tồn tại để pha 1 của phiên SAU tìm lại được việc dang dở.

### Pha 1 — Checking (đầu phiên)

1. **Tool**: xác nhận thứ sắp dùng còn sống, đừng giả định. 
   - `composio` MCP: Dùng Composio MCP (`COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, toolkit `notion`, `supabase`, `vercel`, `google drive` đã connected). Composio CLI không được hỗ trợ trên Window. Bỏ qua thay vì cố cài.
2. **Việc dang dở**: đọc Notion database **MS-MOLAR** (`3b378ba6-ae12-803c-8500-c572b6fc745f`) — lọc row khác trạng thái "Hoàn tất". Kèm `docs/TECH-DEBT.md` và `docs/plans/`.
3. Chỉ tiếp tục việc cũ khi engineer yêu cầu; mặc định hỏi trước khi tự nối tiếp.

### Pha 2 — Notion (ghi nhận)

Tạo/cập nhật row trong database MS-MOLAR. Thuộc tính: `Tên nhiệm vụ`, `Trạng thái` (Chưa bắt đầu/Đang thực hiện/Hoàn tất), `Mô tả`, `Loại nhiệm vụ`, `Mức độ ưu tiên`, `Mức độ công sức`. Thân page ghi **số đo và lý do**, không chỉ liệt kê việc — phiên sau đọc lại cần hiểu *tại sao*, không chỉ *cái gì*.

`PROCESS.md` — lịch sử chỉ-đọc từ 2026-08-06 — đã **xoá hẳn 2026-08-07**: mọi
nợ kỹ thuật còn mở trong đó (rà toàn bộ ~3700 dòng, không chỉ phần cuối) đã
chuyển vào `TECH-DEBT.md`; các mục còn lại đều đã được phiên sau giải quyết
(xác minh từng mục bằng code/DB thật, không chép mù). Quyết định cũ giờ tra ở
Notion database MS-MOLAR (row đã đóng) hoặc git log, không còn ở PROCESS.md.

### Pha 3 — Implementation

1. **Code**: nghiên cứu các thông tin liên quan đến mission hoặc task --> khởi động `dev-workflows-fullstack` với `/recipe-fullstack-implement` (hoặc skills `recipe-plan` / `recipe-implement` / `recipe-fullstack-build` / `recipe-front-*` / `recipe-review`; agent chuyên biệt như `quality-fixer`, `code-reviewer`. Chỉ inovke đối với mission - các task lớn) --> cập nhật bảng trong Notion cho mỗi task --> lặp lại các step này cho đến khi tới step "Cổng verify".
2. **Cổng verify** — chạy đủ 4, trong `SOURCE/`, TRƯỚC khi commit:
   `npx tsc --noEmit` · `npx eslint --max-warnings 0` · `npx vitest run` · `npm run build`
   `next build` bắt lỗi ranh giới server/client mà `tsc` không thấy — đừng bỏ.
3. **Commit + push**: branch trước, không commit thẳng `main` trừ khi engineer bảo thế.
   ⚠️ Cây làm việc thường có sẵn thay đổi CHƯA COMMIT của engineer. Trước mọi `git checkout -- <file>` / `git restore`, đối chiếu `git status` đầu phiên xem file đó đã bẩn từ trước chưa — revert nhầm là xoá việc của họ, không hoàn lại được.
4. **Deploy**: **tự làm bằng `vercel` qua `composio MCP`** (đã cài + đăng nhập + link sẵn), chạy trong `SOURCE/`:
   - Preview: `vercel` → trả link, gửi engineer duyệt.
   - Production: `vercel --prod`, hoặc promote bản preview đã duyệt.
   - Mặc định đi preview trước với thay đổi diện rộng (theme, i18n, auth); chỉ vào thẳng prod khi engineer bảo.
   - Push `main` cũng kích hoạt build prod tự động — coi chừng deploy hai lần.
   - Có skill `vercel:deploy` và `vercel:status`. Env/Supabase prod: `docs/DEPLOYMENT.md`.
5. **Đóng vòng**: cập nhật lại row Notion (trạng thái + kết quả verify + link deploy + việc còn lại).

## 3. Theme — "Mực & Sơn mài" (Ink & Lacquer)

Bản sắc: biên tập cổ điển (kiểu New York Times) kết hợp bảng màu sơn mài truyền thống Việt Nam.

> `DESIGN.md` ở root repo **đã bị xoá có chủ đích (2026-08-06)** — đừng đi tìm, và đừng khôi phục. Mục này cùng `SOURCE/app/globals.css` nay là nguồn tham chiếu duy nhất cho theme; khi hai chỗ lệch nhau thì **`globals.css` thắng** (xem cảnh báo cuối mục).

**Màu:**
- primary (Đỏ son) `#A62C2B` · on-primary (Ngà) `#EDE1C8` · primary-hover `#8F2523`
- background (Ngà) `#EDE1C8` · foreground (Đen sơn mài, warm black) `#1B1512`
- surface `#1B1512` · on-surface `#EDE1C8`
- accent (Vàng đồng) `#B8863B` · on-accent `#1B1512`
- muted (Xám khói) `#6B655C` · on-muted `#EDE1C8`
- border `#D8C9A8`

**Typography:** Serif (Source Serif 4) chỉ dùng cho `display`/`h1`/`h2`/`quote`; Sans (Be Vietnam Pro) cho phần còn lại (body, label-caps, UI, nav) — vì hỗ trợ đầy đủ dấu tiếng Việt. Line-height serif lớn 1.15–1.3; sans body 1.6–1.7.

**Layout:** max-width 720px cho khối text dài; spacing theo scale (xs 4px … xl 40px); tối đa 1 `rule-divider`/section.

**Elevation:** Không box-shadow, không gradient — chỉ dùng màu nền/surface + border mỏng để phân lớp. Muốn "nổi" thì dùng border 2px màu accent, không dùng shadow.

**Shapes:** Bo góc nhẹ — `rounded.sm` 4px (button/input), `rounded.md` 8px (card). Không dùng hình pill.

**Quy tắc cứng:**
- Đỏ son (primary) không phủ khối text lớn hay nền lớn — chỉ dùng cho accent/vùng nhỏ/banner/tag.
- Không bao giờ dùng chữ trắng tinh (#FFFFFF) trên nền primary — dùng on-primary (Ngà).
- Không bao giờ dùng đen tuyền (#000000) — foreground/surface dùng warm black `#1B1512`.
- Vàng đồng (accent) không dùng cho khối lớn hay text dài — chỉ dùng cho divider/border/icon/hover underline.
- Không trộn serif vào button, label, navigation.
- Không dùng text primary-trên-surface (hoặc ngược lại) nhỏ hơn 24px — thiếu tương phản.

**⚠️ Giá trị đã hiệu chỉnh theo WCAG (2026-08-06)** — bảng màu trên là bản sắc thiết kế, nhưng vài giá trị KHÔNG đạt ngưỡng tương phản nên code dùng biến thể khác. Lấy `SOURCE/app/globals.css` làm nguồn chuẩn cho token, đừng chép hex từ bảng trên vào code:

- `--ring` (focus) `#8a6222`, KHÔNG phải `#B8863B` (chỉ 2.49:1, cần 3:1).
- `--input` (viền ô nhập) `#877748`, KHÔNG phải `#D8C9A8` (1.26:1). `--border` vẫn `#D8C9A8` — kẻ trang trí thì không chịu ngưỡng.
- `--muted-foreground` `#605a52`, KHÔNG phải `#6B655C` (4.45:1, hụt 4.5:1).
- `--brand-on-dark` `#e86b5c` — dùng THAY đỏ son khi đặt trên nền đen sơn mài (nav/sidebar). Đỏ son `#A62C2B` trên `#1B1512` chỉ 2.44:1, đúng như quy tắc "<24px" ở trên đã cảnh báo. Nền ngà vẫn dùng `#A62C2B`.
- Dùng token (`text-[color:var(--muted-foreground)]`), đừng hardcode hex — đợt sửa này phải đi gỡ 29 chỗ hardcode vì chúng vượt mặt token.
