# MS-MOLAR — Memory Consolidated (2026-07-27)

> File này thay thế phần lớn Claude Code auto-memory chi tiết trước đây. Từ nay memory system (ngoài repo) chỉ còn giữ 3 thứ: repo, test account, path temp screenshot. Toàn bộ lịch sử implementation + theme được lưu ở file này thay vì trong memory ẩn.

## 1. Nội dung được giữ lại trong Claude Code memory

- **Repo**: `E:\StemWeb_project\MS-MOLAR` — web luyện đề thi, Next.js 16 + Supabase. Giao tiếp với engineer bằng tiếng Việt.
- **Test accounts** (password chung `rls-test-password-123`):
  - `smithnguyen247+rlstesta@gmail.com` — tài khoản test chính, hiển thị tên "AnhPhat" trên navbar
  - `smithnguyen247+rlstestb@gmail.com`
  - `smithnguyen247+se2rater1@gmail.com` … `+se2rater10@gmail.com` — 10 tài khoản dùng để test rating threshold (N=3 raters)
  - ⚠️ KHÔNG đụng `smithnguyen247@gmail.com` và `nguyenphatbentre904@gmail.com` — đây là tài khoản thật của user (không có `+alias`)
- **Temporary screenshot folder**: `E:\StemWeb_project\MS-MOLAR\SCREENSHOT\temporary_screenshot` (Playwright MCP lưu screenshot tạm ở đây; xoá sau khi dùng xong)
  - Tham chiếu liên quan: `SCREENSHOT\design_reference` — ảnh tham chiếu thiết kế gốc (nguồn so sánh cho temporary_screenshot)

## 2. Tiến độ implementation

Tiến độ thực thi dự án được lưu tại **`PROCESS.md`** (root repo), KHÔNG lưu ở đây nữa — file này chỉ trỏ tới đó để tránh trùng lặp và tránh MEMORY.md phình to theo thời gian.

- `PROCESS.md` ghi theo từng phiên (session), mỗi mục có tiêu đề dạng `# [Tên feature] — Mô tả (S#N, ngày)`, đánh số S# tăng dần.
- **⚠️ CHỈ đọc ~100–200 dòng CUỐI file** (`tail -n 200 PROCESS.md`, hoặc Read với `offset` gần cuối) — file đã hơn 3000 dòng, đọc hết vừa tốn context vừa không cần thiết vì các mục cũ đã xong không còn đổi. Chỉ đọc sâu hơn về trước nếu cần tra một quyết định/gotcha cụ thể trong lịch sử.
- File từng bị bỏ quên khá lâu (không cập nhật từ ~2026-07-18 dù có nhiều việc đã làm sau đó) — 2026-07-27 đã bổ sung lại 2 mục còn thiếu (S#37 UGC extract fix, S#38 Rating System redesign + ghi chú Analytics Layer 3 WIP). Từ nay: **mỗi phiên implementation xong phải tự thêm một mục mới vào cuối `PROCESS.md`** theo đúng format trên, đừng để bị bỏ quên lại.

## 3. Theme — "Mực & Sơn mài" (Ink & Lacquer), từ DESIGN.md

Bản sắc: biên tập cổ điển (kiểu New York Times) kết hợp bảng màu sơn mài truyền thống Việt Nam. (Nguồn gốc: `DESIGN.md` ở root repo — coi file đó là authoritative nếu có thay đổi so với đây.)

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
