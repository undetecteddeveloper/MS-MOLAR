# Trang ẩn Maxwell the Cat (2026-10-12)

## Yêu cầu
Gõ "maxwell" hoặc "cat" vào ô tìm đề → mở một trang ẩn: nền đen, không navbar, một nút mũi tên về đúng trang trước đó, mô hình 3D Maxwell the Cat (`maxwell_the_cat_dingus.glb`) xoay vòng và nhấp nhô dưới đèn rọi như trưng bày trong tủ kính, bên dưới là tiêu đề "Chúc mừng bạn đã tìm ra Maxwell!!!" màu cầu vồng có animation chạy liên tục. Phải dùng được trên điện thoại.

## Quyết định (người dùng chốt 2026-10-12)
| # | Quyết định | Lý do |
|---|---|---|
| D1 | Kích hoạt khi ô tìm có ĐÚNG một từ khoá rồi nhấn Enter (hoặc bấm dòng "Xem tất cả kết quả"). Gõ "category", "education" vẫn tìm đề thường. | Người dùng chọn. Khớp theo chuỗi đã chuẩn hoá của ô tìm (bỏ dấu, không phân biệt hoa thường). |
| D2 | Từ khoá: `maxwell`, `cat`, `mèo` (so khớp sau bỏ dấu: `meo`; `cát` cũng khớp `cat`). | Người dùng chọn thêm "mèo" vì giao diện toàn tiếng Việt. |
| D3 | Chỉ người đã đăng nhập tìm ra (ô tìm của header không đổi). Khách có đường link `/maxwell` vẫn xem được. | Người dùng chọn. |
| D4 | Ghi công ngay trên trang: mô hình "Maxwell the cat (Dingus)" của bean (alwayshasbean), CC BY 4.0, có link nguồn + giấy phép. | Giấy phép CC BY 4.0 trong chính file `.glb` bắt buộc ghi công. |

## Quyết định kỹ thuật
| # | Quyết định | Lý do |
|---|---|---|
| T1 | Route `app/maxwell/page.tsx` nằm NGOÀI mọi route group → không có SiteHeader/BottomNav. Root layout chỉ có lớp phủ loading + analytics. | Yêu cầu "không navbar". |
| T2 | `three` (+ `@types/three`), dựng cảnh bằng mã thuần trong `features/maxwell/scene/`, nạp bằng `import()` động từ client component. Không `@react-three/*`. | Ít phụ thuộc hơn, dễ kiểm hàm thuần; chỉ route này tải `three`, các trang khác không nặng thêm. |
| T3 | Mô hình ở `public/models/maxwell-the-cat.gltf` + `.bin` + 2 ảnh rời (tổng 152 KB, byte gốc giữ nguyên), tách từ `.glb` bằng `scripts/split-glb.mjs`. KHÔNG dùng `.glb` nhúng. Proxy đã bỏ qua mọi path có dấu chấm. | Đo 2026-10-12 trên Chrome: texture nhúng trong `.glb` được giải mã qua `fetch(blob:)`, CSP (`connect-src 'self'` + Supabase) chặn → mèo trắng toát. Tách file thì ảnh tải bằng đường dẫn cùng origin, KHÔNG phải nới CSP cả site cho một trang ẩn. Safari đi đường khác nên không bị — đây là lỗi chỉ thấy khi đo trên Chrome. |
| T4 | Proxy: thêm `/maxwell` vào `GUEST_READABLE_EXACT_PATHS` (chỉ GET/HEAD; POST vẫn 307). KHÔNG vào `PUBLIC_PATHS`. | Cùng cơ chế với T1 của brief khách xem trang con. |
| T5 | Ô tìm ghi `pathname + search` đang đứng vào `sessionStorage` (tab này) ngay trước khi sang `/maxwell`. Mũi tên: có dấu → `router.back()`; không có → `/exams`. Dấu luôn qua `isSafeMaxwellOrigin` (không `//`, `\`, `://`, không chính `/maxwell`). | "Về đúng trang trước đó" = đúng hành vi Back, giữ cả vị trí cuộn và bộ lọc. KHÔNG dùng `history.length`: đo 2026-10-12, phiên trình duyệt mới đã là 2 (mục about:blank) nên `back()` đưa về trang trống. |
| T6 | Không đưa `/maxwell` vào `robots.txt` (sẽ lộ trang ẩn); dùng `<meta robots noindex>` của chính trang, không vào sitemap. | Trang ẩn không nên được liệt kê ở file công khai. |
| T7 | Mobile trước: `min-h-dvh`, safe-area (tai thỏ + thanh Home), vùng chạm ≥44px (mũi tên, link ghi công), khung hình tự co theo tỉ lệ canvas (dọc/ngang), độ nét ≤2x, bóng đổ 1024. | Người dùng yêu cầu dùng được trên điện thoại. |
| T8 | Không nhánh `prefers-reduced-motion` cho phần xoay/nhấp nhô/cầu vồng. | Cùng tiền lệ khối "TRANG CHỦ SỐNG ĐỘNG" (globals.css, yêu cầu rõ của người dùng 2026-09-30): máy tắt hiệu ứng thì trang đứng yên, người dùng từng báo đó là lỗi. Ghi trong báo cáo để đảo lại nếu muốn. |
| T9 | Không WebGL / lỗi tải → vẫn hiện tiêu đề + một câu báo; không để trang trắng. | Máy yếu, WebView trong app Zalo/Facebook. |
| T10 | Bỏ prototype Artifact của luật `ui.md`: người dùng đã mô tả đủ bố cục (không có ≥2 hướng để chọn). Thay bằng đo 3 viewport trên trang thật. | Ghi rõ ở báo cáo. |

## File
- `lib/search/easterEgg.ts` (+ `easterEgg.test.ts`, `maxwellOrigin.test.ts`) — `isMaxwellQuery`, `MAXWELL_PATH`, dấu trang trước.
- `components/layout/HeaderSearch.tsx` (+ test) — Enter / dòng "Xem tất cả" với từ khoá → `/maxwell`.
- `lib/auth/guestPaths.ts` (+ `guestPaths.test.ts`, `guestReadable.test.ts`).
- `features/maxwell/components/{MaxwellStage,MaxwellBackButton}.tsx`, `features/maxwell/scene/{createMaxwellScene,framing,motion}.ts` (+ test hàm thuần).
- `app/maxwell/page.tsx` (+ test), `app/globals.css` (`.motion-rainbow-text`), `lib/copy.ts` (`maxwell.*`).
- `app/robots.ts` (chỉ chú thích), `public/models/maxwell-the-cat.{gltf,bin}` + `maxwell-the-cat-tex{0,1}.{jpg,png}`, `scripts/split-glb.mjs`, `package.json` + lock.
- File gốc `maxwell_the_cat_dingus.glb` ở thư mục gốc repo vẫn untracked, không đụng (của người dùng).

## Task (mỗi task một bước kiểm)
1. Từ khoá + HeaderSearch + test. Kiểm: vitest file liên quan.
2. Proxy khách + test. Kiểm: `guestReadable.test.ts`.
3. Cảnh 3D (hàm thuần có test; phần WebGL đo trên trình duyệt thật).
4. Trang + copy + CSS + test cây render.
5. Đo: Playwright CLI 360 / 768 / 1280 (có WebGL, không navbar, mũi tên về đúng trang, CLS, vùng chạm), kích thước chunk `three` chỉ ở route này.
6. 6 cổng, PROGRESS.md, commit.
