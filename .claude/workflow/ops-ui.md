# Ghi chú vùng: Giao diện, đo đạc, chuyển động

## Tài khoản test
Mật khẩu chung `rls-test-password-123`. Chính: `smithnguyen247+rlstesta@gmail.com` (hiện tên "AnhPhat" trên navbar). Phụ: `+rlstestb`, `+se2rater1` … `+se2rater10` (10 tài khoản thử ngưỡng chấm N=3). TUYỆT ĐỐI không đụng `smithnguyen247@gmail.com` và `nguyenphatbentre904@gmail.com` (tài khoản thật, không có `+alias`).

## Đăng nhập phiên Playwright CLI
- NGƯỜI DÙNG ĐÃ CHO PHÉP LÂU DÀI (2026-10-03): khi cần đo phần phải đăng nhập, Claude TỰ đăng nhập tài khoản test (mục trên) qua Playwright CLI, không hỏi lại, miễn công cụ đang bật (`SOURCE/scripts/pw/cli.mjs` còn và lệnh `status` trả ok). Làm đúng thứ tự: `goto /?auth=signin` → `fill #email` → `fill #password` → `click` nút submit → `wait` `header button[aria-haspopup="menu"]`; cần script Playwright độc lập thì `storageState` ra file tạm, đo xong XOÁ file. CHỈ tài khoản test, không bao giờ tài khoản thật.
- Công cụ không bật (thiếu `cli.mjs`, `status` lỗi) HOẶC một bước đăng nhập bị chặn/lỗi: thử lại đúng MỘT lần, rồi DỪNG phần đo cần đăng nhập, báo nguyên văn lỗi, ghi CHƯA LÀM / `THIẾU` (CLAUDE.md §4). Không lách bằng cách khác (script đăng nhập riêng, dùng storageState cũ, sửa cấu hình quyền). Lúc đó mới nhờ người dùng đăng nhập phiên CLI từ terminal của họ.
- Làm hết phần công khai trước phần cần đăng nhập. CLI là một process nền dùng chung (khoá bằng `%TEMP%\ms-molar-pw-cli\port`), nên lệnh họ gõ và lệnh Claude gõ đi vào cùng một trình duyệt. Đã đăng nhập thì mọi bước chuỗi (ghi chú, lưu nháp, xuất bản, tải lại) chạy liền không cần đăng nhập lại.
- Form đăng nhập có HAI phần tử chứa chữ "Đăng nhập" (tab đang bật đứng trước trong DOM, và nút submit). Dùng `button[type=submit]:has-text('Đăng nhập')`; bản `button:has-text(…)` bấm nhầm tab và trả `ok:true` mà không có tác dụng.
- Khi được phép tự đăng nhập: `#email`, `#password`, `main form button[type="submit"]:not([name="provider"])`, chờ `header button[aria-haspopup="menu"]`. Đăng xuất một tài khoản cũng thu hồi storageState đã lưu của nó.

## Đo giao diện
- Phiên CLI chết khi `npm run build` chạy ("Target page, context or browser has been closed"): sau build chạy `cli.mjs close`, `goto` để khởi động lại, rồi đăng nhập lại.
- `.claude/skills/ui-audit/scripts/audit.mjs` không tìm thấy `playwright` từ thư mục skill: sao chép sang `SOURCE/scripts/pw/_audit_tmp.mjs`, chạy với `--storage-state=<file>`, xoá bản sao sau khi xong (cùng mẹo cho script thăm dò tạm).
- Chọn phần tử có phạm vi: `main a[href="/exams"]` (link của SiteHeader có trong DOM nhưng `display:none` trên mobile và đứng trước); `ol > li` bị lệch bởi số mục breadcrumb. In phần tử khớp bằng `eval` trước khi bấm.
- Bấm scrim toàn màn hình bằng Playwright hết giờ khi menu nằm giữa viewport: đóng bằng `eval "document.querySelector('…scrim…').click()"`.
- Bộ lọc điều khiển bằng URL (`router.push` → render lại server) bị tính là CLS khi phản hồi tới sau 500 ms `hadRecentInput` (dev ≈1 giây): các hàng còn sống nhảy lên (đo 0,57 / 0,43 / 0,33 ở 360/768/1280 trên /history). Cho danh sách một `key` dựng từ bộ lọc + trang để kết quả thành cây con mới thì hết. Đo bằng PerformanceObserver ghi `hadRecentInput`, không bằng một số CLS sau tải.
- `SupportWidgetTrigger` ở z-45, trên `FilterSheet` (z-30); nó tự ẩn khi `FilterSheet` mở qua `body:has([data-filter-sheet])`. Bottom sheet mới phải dùng lại `FilterSheet` hoặc mang thuộc tính `data-filter-sheet`.
- Dev server (`next dev` cổng 3000) tự nạp lại khi sửa file. `storageState` lưu từ phiên CLI dùng được trong script Playwright độc lập.

## Từ vựng chuyển động (dùng chung, không viết mới)
Khối `CHUYỂN ĐỘNG` cuối `SOURCE/app/globals.css` (lớp `.motion-scrim/pop/modal/sheet/unfold`, keyframe `motion-pill-in/badge-in/settle/grow-x`, biến `--motion-*`) + hook `SOURCE/components/shared/usePresence.ts` cho chiều ĐÓNG. Quy tắc đầy đủ: `docs/design/ui-refactor-san-truong-design.md` §7.
- Menu/popover → `.motion-pop` + `usePresence(open, POP_EXIT_MS)`; hộp thoại → `.motion-modal` + `MODAL_EXIT_MS`; bottom sheet → `.motion-sheet` + `SHEET_EXIT_MS`; scrim → `.motion-scrim`. Nút/chip đã tự co 3% qua `buttonVariants`/`chipVariants`, không thêm.
- CẤM: `transition-all`; fade/stagger nội dung trang lúc tải (đo 2026-08-22: bỏ fade giảm LCP 348 ms); `opacity` trên phần tử LCP (điểm số, thanh biểu đồ chỉ dùng `scale`); animate chiều cao của danh sách mở in-flow (cuộn hụt).
- Chỉ thêm lớp mới vào globals.css khi thật sự là loại chuyển động chưa có. Còn nợ: năm hộp thoại (LeaveExam, ReportExam, Delete, Support, ChangePassword) mới có chiều VÀO, chưa nối `usePresence`; bảng gợi ý của ô tìm đề chưa có chuyển động.
