# SEO — tìm ra tên "MS-MOLAR" trên Google

**Trạng thái 2026-08-09: phần LÀM ĐƯỢC BẰNG CODE đã xong; phần còn lại chờ
NGƯỜI.** Không phải nợ kỹ thuật (không có gì sai), là việc CHƯA làm.

Ranh giới quan trọng, đừng nhầm: không có dòng code nào đưa được site vào chỉ
mục Google. Code chỉ làm cho site DỄ hiểu và DỄ verify khi Google tới; việc kéo
Google tới (Search Console, domain, backlink) nằm ngoài repo.

## Câu hỏi gốc

Engineer tìm "MS-MOLAR" trên Google, không thấy site — chỉ ra được khi gõ đúng
domain. Mục tiêu đã chốt: **tìm kiếm THƯƠNG HIỆU** ("MS-MOLAR") phải ra ngay,
KHÔNG phải lên top từ khóa chung ("luyện đề thi online" — xem mục cuối, việc
khác hẳn, gác riêng).

## Đã điều tra — 4 nguyên nhân

1. **Chỉ có `/` được phép index.** `app/robots.ts` + `app/sitemap.ts` đã cố
   ý chặn crawler ở mọi route khác (`/exams`, `/history`, `/upload`...) vì
   nội dung nằm sau đăng nhập — vào chỉ nhận redirect `/?auth=signin`
   (`lib/supabase/middleware.ts`). **Phần này ĐÃ ĐÚNG, không cần sửa** — với
   mục tiêu tìm-tên-thương-hiệu thì 1 trang chủ là đủ, vấn đề không nằm ở đây.
2. **Chưa có domain riêng.** `vercel domains ls` → 0 domain. Site chỉ sống ở
   `ms-molar.vercel.app` — subdomain miễn phí của Vercel, độ tin cậy thấp hơn
   hẳn domain riêng trong mắt Google (dùng chung uy tín với hàng triệu site
   khác trên cùng subdomain gốc `.vercel.app`).
3. **Chưa thấy dấu hiệu đã khai báo Google Search Console** — không có thẻ
   `google-site-verification` nào trong code. Nếu chưa từng verify + submit
   sitemap thủ công, Google phải TỰ tình cờ bò vào site (có thể mất vài tuần,
   vì chưa có ai trỏ link tới để Google "tìm thấy" theo cách thông thường).
4. **Chưa có backlink nào** trỏ về site — tín hiệu xếp hạng/khám phá lớn của
   Google, hiện bằng 0.

`app/layout.tsx` (metadata: title/description/OG/Twitter card/canonical) đã
đầy đủ, không phải điểm nghẽn.

## ĐÃ LÀM TRONG CODE (2026-08-09)

- **JSON-LD structured data** (`SOURCE/lib/seo/jsonLd.ts`, render ở
  `app/page.tsx`): `Organization` + `WebSite` với `alternateName` gồm các cách
  viết người dùng thật sẽ gõ (`MS MOLAR`, `MSMOLAR`, `MS-Molar`) — Google không
  tự suy ra biến thể có dấu cách từ `MS-MOLAR`. Mô tả + `inLanguage` đi theo
  ngôn ngữ đang render (en/vi).
  - Khối inline này mang **nonce CSP** lấy từ header `x-nonce`; production
    không còn `'unsafe-inline'` nên thiếu nonce là bị trình duyệt chặn — hỏng
    im lặng, trang vẫn đẹp mà structured data biến mất.
  - CỐ Ý không khai `potentialAction`/sitelinks search box: Google khai tử
    tính năng đó cuối 2024 và site không có endpoint tìm kiếm công khai.
- **Hook verify Search Console**: `metadata.verification.google` đọc env
  `GOOGLE_SITE_VERIFICATION` (`app/layout.tsx`, đã ghi vào `.env.example`).
  Nghĩa là bước 1 dưới đây **không cần sửa code + deploy lại** nữa: dán token
  vào Vercel → Settings → Environment Variables là thẻ meta tự xuất hiện.

## Việc cần làm khi quay lại (ưu tiên theo thứ tự)

1. ~~**Verify site trong Google Search Console**~~ — **XONG 2026-08-17.**
   Verify bằng thẻ meta (URL prefix `https://ms-molar.vercel.app/`, không phải
   "Miền" — subdomain `.vercel.app` không có DNS mà mình kiểm soát để làm TXT
   record). Token dán vào Vercel env `GOOGLE_SITE_VERIFICATION` (scope
   **Production**, type `plain` — giá trị này vốn nằm trong HTML công khai,
   không phải secret) qua Composio, kèm redeploy để nạp biến, rồi xác nhận thẻ
   `<meta name="google-site-verification">` sống thật trên
   `https://ms-molar.vercel.app/` trước khi bấm nút "Xác minh" trong Search
   Console — tránh xác minh nhầm lúc thẻ chưa lên production.
2. ~~**Submit `sitemap.xml` + "Request Indexing"**~~ — **XONG 2026-08-17.**
   Submit lần đầu báo "Không thể tìm nạp" — kiểm bằng `curl -A Googlebot` xác
   nhận `sitemap.xml` trả `200 OK` + `Content-Type: application/xml`, không bị
   chặn gì; hoá ra chỉ là độ trễ tự nhiên trước khi Google chạy lượt tìm nạp
   đầu (`Lần đọc cuối cùng` khi đó vẫn trống). Refresh sau ít lâu → thành công.
   Request Indexing cho `/` đã bấm qua URL Inspection.
3. **(Nên làm) Mua domain riêng** (vd `ms-molar.vn`/`.com`), gắn vào Vercel
   (`vercel domains add`), đặt `NEXT_PUBLIC_SITE_URL` — tăng độ tin cậy so với
   subdomain `.vercel.app`, và tên thương hiệu khớp domain giúp tìm-tên dễ ra
   kết quả đúng hơn. Domain xong thì đổi property Search Console sang loại
   "Miền" để phủ luôn mọi biến thể http/https/www.
4. ~~Thêm JSON-LD structured data~~ — **XONG 2026-08-09**, xem mục "Đã làm
   trong code" ở trên. Kiểm tra lại sau khi có domain thật bằng Rich Results
   Test / Search Console → Enhancements.
5. **Còn mở.** Theo dõi **Search Console → Coverage/Pages** tới khi `/` hiện
   trạng thái "Indexed" (thường vài ngày–2 tuần sau bước 1–2, không có gì để
   AI tự verify được — phụ thuộc lịch crawl của Google).

## Gác lại — KHÔNG làm bây giờ: lên top từ khóa chung

Nếu sau này muốn xuất hiện khi tìm từ khóa chung (vd "luyện đề thi online",
"trắc nghiệm Toán 10") thì đây là bài toán khác hẳn, cạnh tranh thật, mất
nhiều tháng, và đòi hỏi **quyết định sản phẩm lớn hơn**: phải có trang
đề/nội dung xem được KHÔNG cần đăng nhập để Google có gì mà index (hiện
`robots.ts` đang chặn toàn bộ `/exams` vì tất cả nằm sau đăng nhập) — cộng với
nội dung phong phú hơn và backlink thật. Chưa bàn phạm vi này ở đây.
