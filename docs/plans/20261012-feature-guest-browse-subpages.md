# Khách xem được các trang con, dùng thì phải đăng nhập (2026-10-12)

## Yêu cầu
Hôm nay khách bấm Kho đề / Thống kê / Lịch sử / Đăng đề bị đá về form đăng nhập (proxy 307). Một số người thấy bất tiện. Mới: khách VÀO được bốn trang đó; Kho đề hiện đề như thường; ba trang kia hiện thẻ "cần đăng nhập" ở phần nội dung chính. Kèm: logo mới chưa lên Google.

## Quyết định (người dùng chốt 2026-10-12)
| # | Quyết định | Lý do |
|---|---|---|
| D1 | Bấm một đề ở Kho đề → khách xem được trang chi tiết đề; nút "Làm bài" đổi thành "Đăng nhập để làm bài". | Người dùng chọn. Khách thấy đề trước khi quyết định lập tài khoản. |
| D2 | Tên người đăng đề hiện cho khách như người đã đăng nhập. | Người dùng chọn (đã được báo: đề công khai ra Internet). Không đổi `AuthorByline`. |
| D3 | Google KHÔNG đọc Kho đề: `robots.ts`, `sitemap.ts` giữ nguyên. | Người dùng chọn. `Disallow: /exams`, `/history`, `/me`, `/upload` đã phủ bốn trang. |
| D4 | Đăng nhập xong về đúng trang khách đang xem, không phải luôn `/exams`. | Người dùng chọn. |

## Quyết định kỹ thuật
| # | Quyết định | Lý do |
|---|---|---|
| T1 | Proxy: danh sách MỚI `GUEST_READABLE_PATHS`, chỉ cho GET/HEAD; KHÔNG thêm vào `PUBLIC_PATHS`. Gồm đúng `/exams`, `/exams/{id}` (một đoạn), `/history`, `/me/dashboard`, `/upload`. | `PUBLIC_PATHS` canh bất biến "đúng 1 đường GHI chưa-đăng-nhập" (ADR-0017). Server Action là POST tới chính URL trang, nên mở theo path sẽ mở cả POST. Cho riêng GET thì mọi POST của khách vẫn bị 307. |
| T2 | `/exams/{id}/attempt|rate|solutions|result` và `/me/exams`, `/profile` vẫn sau đăng nhập. | Ngoài yêu cầu; khách không có lối bấm vào đó. |
| T3 | Ba trang Thống kê / Lịch sử / Đăng đề: bỏ `redirect("/?auth=signin")`, dựng khung + `PageHeader` như thường, nội dung chính = thẻ `LoginRequired` (tiêu đề trang giữ nguyên, một câu nói cần đăng nhập để làm gì, nút Đăng nhập chính, nút Tạo tài khoản phụ). KHÔNG fetch dữ liệu cá nhân cho khách. | Cổng chạy TRƯỚC mọi lượt đọc (Lịch sử AC-016 hiện đã đòi điều này). |
| T4 | DB (§29, một migration): policy `exams_select_published_anon` cho `anon` (published và tác giả không bị ban — cùng vị từ `exams_select_visible` §18b) + `grant execute on exam_hot_counts … to anon`. Không đụng `questions`, `exam_attempts`, `search_exams`. | Hôm nay `exams` chỉ có policy `to authenticated` nên khách đọc 0 dòng. `author_display_name` nằm sẵn trên `exams`, không cần đọc `profiles`. Chi tiết đề chỉ cần `exams_with_difficulty` (đã `security_invoker`, `exam_rating_aggregate` đã cấp anon). |
| T5 | Khách ở Kho đề: không có kệ "Cần luyện", không nhãn "đã làm", xếp hạng không cá nhân hoá; vẫn lọc / sắp xếp / phân trang. Không đọc `exam_attempts` / `exam_results` khi `user === null`. | Các lượt đọc đó là của riêng người dùng. Không dựa vào RLS trả 0 dòng — quyền bảng của anon chưa được kiểm. |
| T6 | Ô tìm đề trên header vẫn chỉ cho người đã đăng nhập. | `search_exams` thu hồi của anon (ADR-0020); mở là mặt tấn công mới, ngoài yêu cầu. Việc tiếp theo nếu cần. |
| T7 | `next`: một hàm `safeNextPath()` duy nhất, chỉ nhận đúng năm đích của T1 (đường dẫn tương đối, không `//`, `\`, `://`). Đi qua: `?next=` trên `/?auth=signin|signup|verify`, trường ẩn của `signIn` / `signUp` / `verifySignupCode`. OAuth (Google/Facebook): truyền bằng cookie httpOnly sống 10 phút, KHÔNG qua query của `redirectTo`; `/auth/callback` đọc, kiểm lại bằng `safeNextPath`, xoá cookie. | Danh sách redirect cho phép của Supabase không đọc được từ repo; `?next=/exams` hiện chỉ chứng minh đúng một giá trị. Cookie không phụ thuộc vào nó. Open-redirect là rủi ro chính của tính năng này. |
| T8 | `NavItem.guarded` giữ nghĩa "khách không prefetch" (đích render nặng); sửa chú thích + `items.test.ts` (không còn bằng "không có trong PUBLIC_PATHS"). | Prefetch bốn trang cho mỗi khách mở trang chủ là bốn lượt render + chạm trần anon theo IP (TD-013). |
| T9 | Logo Google: KHÔNG đổi code. | Đo 2026-10-12: prod phát đúng logo quạ (`favicon.ico` 4765 byte khớp repo, đã có khung 16/32/48 nên đủ điều kiện bội-của-48 của Google). Ảnh chụp của người dùng cũng còn tiêu đề "About Us" tiếng Anh trong khi prod đã là "Giới thiệu" — Google chưa quét lại cả trang. Người dùng bấm "Yêu cầu lập chỉ mục" cho trang chủ ở Search Console. |

## Ngoài phạm vi
Ô tìm đề cho khách (T6); trang chi tiết cho `/me/exams`, `/profile`; đưa Kho đề lên sitemap (D3); đổi `/about` — Google còn giữ bản tiếng Anh cũ, tự cập nhật khi quét lại.

## File
- `proxy.ts`, `lib/supabase/middleware.ts` (+ `publicPaths.test.ts`, test mới cho GET/POST), `lib/nav/items.ts` (+ test).
- `supabase/schema.sql` §29 + §17, `supabase/migrations/<ts>_guest_browse_exams_<fp>.sql`, `lib/schema/schemaFingerprint.ts`, `supabase/verify-schema.ts` (probe anon).
- `features/exams/queries/{shelves,ranking,catalogue}.ts` (nhánh khách), `app/(exams)/exams/page.tsx`, `app/(exams)/exams/[id]/page.tsx`.
- `components/shared/LoginRequired.tsx` (mới), `app/(history)/history/page.tsx`, `app/(analytics)/me/dashboard/page.tsx`, `app/(authoring)/upload/page.tsx`, `lib/copy.ts`.
- `lib/auth/nextPath.ts` (mới), `features/auth/actions.ts`, `app/auth/callback/route.ts`, `features/auth/components/*` (form đọc `next`).

## Task (mỗi task một bước kiểm)
1. Logo T9: không có việc code (đã đo). Việc của người dùng: Search Console → Yêu cầu lập chỉ mục trang chủ.
2. `safeNextPath` + test (đường tấn công: `//evil`, `/\evil`, `javascript:`, `%2F%2F`, đích ngoài danh sách).
3. DB T4: schema §29 + vân tay + migration + áp DEV + probe. Kiểm: `npm run verify:schema`, `npm run test:localdb`, đọc `exams` bằng anon trên dev.
4. Proxy T1 + test (GET qua, POST 307, `/exams/x/attempt/y` 307, `/exams-evil` 307).
5. Truy vấn nhánh khách T5 + trang Kho đề + chi tiết đề (D1). Test đơn vị.
6. `LoginRequired` + ba trang T3 + chuỗi.
7. Luồng `next` (T7) qua form, action, OAuth cookie, callback. Test đơn vị + một lượt Playwright trên dev (email/mật khẩu).
8. Nav T8. Đo giao diện 3 viewport (360/768/1280): khách ở 4 trang, vùng chạm ≥44px, CLS.
9. PROD (CHỈ khi người dùng nói có, CLAUDE.md §5): đọc `schema_version` của prod TRƯỚC (PROGRESS ghi prod = `b9f0a4ee8211`, tức đã có §27/§28; nếu khác, áp đúng thứ tự tên file). Vân tay đích `b7a082a92dac`.

## Ghi chú thực hiện (2026-10-12)
- Danh sách trang khách + `safeNextPath` + `authHref` nằm ở `lib/auth/guestPaths.ts` (không phải `nextPath.ts` như dự kiến).
- Khách bỏ qua `?skill=`: `skill_nodes`/`questions` không đọc được với anon, một URL tự gõ không được thành lỗi 500.
- Task 3 (áp DEV) và 7–8 phần đo giao diện: CHƯA LÀM — dev Supabase đang tạm dừng.
