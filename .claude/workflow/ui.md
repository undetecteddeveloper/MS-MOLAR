# Đường: Giao diện

Chỉnh hoặc thiết kế lại trang, animation, bố cục. Đọc `ops-ui.md` trước.

**Chỉnh nhỏ** (đổi một màu, khoảng cách, chữ trong thành phần có sẵn): làm thẳng như việc vặt, rồi đo bằng Playwright CLI.

**Trang mới, đổi bố cục, đổi cách biểu diễn dữ liệu → PROTOTYPE TRƯỚC:**
1. Đọc component THẬT của trang (header, chip, thẻ đề, BottomNav…) và `lib/copy.ts`. Prototype dựng lại 1:1 mọi phần đã có (kể cả nút nhỏ như "Đánh giá"); chỉ phác phần MỚI.
2. Dựng bằng công cụ Artifact (quickstart, intent "design"): 2–3 hướng có TÊN ổn định, đủ trạng thái (mặc định, lỗi, rỗng/đang tải), theo token trong `globals.css`. Hỏi người dùng chọn hướng (AskUserQuestion). Chỉ code hướng được chọn.
3. Con số phụ không đổi việc người đọc làm thì bỏ.
4. Code: dùng lớp `.motion-*` + `usePresence`, không viết transition mới (ops-ui.md).
5. Đo trên trang thật bằng Playwright CLI + skill `ui-audit`: CLS, nhảy layout, 3 viewport (360 / 768 / 1280), vùng chạm ≥44px. Phần cần đăng nhập mà phiên CLI chưa đăng nhập → Claude tự đăng nhập tài khoản test theo ops-ui.md; chỉ khi CLI không bật hoặc đăng nhập lỗi sau một lần thử lại thì dừng phần đó, báo THIẾU và nhờ người dùng. KHÔNG nói "giao diện ổn" khi chưa đo.
6. Kết thúc: đủ 6 cổng; commit `feat/fix(scope): ...`; báo cáo dòng đầu `ĐỦ BƯỚC` / `THIẾU …`.
