# PROJECT_OVERVIEW — TrangNguyenDigi (MS-MOLAR)

> Tài liệu nền tảng cho agent và engineer.
> Cập nhật file này khi có quyết định kỹ thuật mới — xoá phần đã lỗi thời thay vì
> để nó tồn tại song song với sự thật (rà soát 2026-08-06: đã bỏ toàn bộ phần mô
> tả tầm nhìn 3D ban đầu — xem §10; 2026-08-07: `PROCESS.md` — nhật ký từng phiên
> — đã bị xoá, nợ kỹ thuật còn mở đã chuyển hết sang `TECH-DEBT.md`; tiến độ theo
> phiên nay ghi ở Notion, xem `.claude/MEMORY.md`).

---

## 0. Quick Reference

| Mục | Giá trị |
|---|---|
| **Tên dự án** | TrangNguyenDigi (tên repo local: MS-MOLAR) |
| **Repo** | `github.com/undetecteddeveloper/TrangNguyenDigi.git` |
| **Giao tiếp agent ↔ engineer** | Tiếng Việt |
| **Solo hay team** | Solo (1 engineer) |
| **Tài liệu liên quan** | `ARCHITECTURE.md` (code ở đâu), §2 dưới đây (design token), `TECH-DEBT.md`, `docs/adr/`. Tiến độ từng phiên: Notion (xem `.claude/MEMORY.md`) |

---

## 1. Product Summary

**TrangNguyenDigi** là nền tảng web luyện đề thi trực tuyến dành cho học sinh THCS và THPT tại Việt Nam.

**Mục tiêu cốt lõi:** Cung cấp ngân hàng đề có thể cập nhật, kiểm tra và xóa với tính minh bạch cao. Làm một việc duy nhất và làm thật tốt.

**Đối tượng người dùng:** Học sinh THCS → THPT — thường dùng thiết bị Android tầm trung, kết nối mạng không ổn định.

**Ưu tiên triển khai:** Core loop (làm đề) trước, giao diện ấn tượng sau.

---

## 2. Design System — theme "Sân trường" (2026-09-04)

Thay theme "Mực & Sơn mài" (kem + serif + đỏ son, 2026-08-06 → 2026-09-04) —
engineer nhận định layout cũ "không có gì nổi bật" và chọn hướng này trong ba
prototype vì "vừa đơn giản vừa cuốn hút màu sắc hơn". Ưu tiên điện thoại (học
sinh lớp 6–12, Android tầm trung). Chỉ tiếng Việt, chỉ bản sáng.

> **Nguồn giá trị là `SOURCE/app/globals.css`.** Quy tắc, lý do và bảng tương
> phản đầy đủ ở `docs/design/ui-refactor-san-truong-design.md`. Khi hai bên lệch
> nhau thì `globals.css` thắng. Tài liệu trong `docs/` trỏ về
> "PROJECT_OVERVIEW.md §2" là trỏ về đây.

**Màu (6 màu làm việc):** nền trắng `#FFFFFF` · bề mặt xanh nhạt `#EEF7F1`
(thẻ, chip — "viền" của theme này) · chữ `#14291C` · chữ phụ `#4F6656` · hành
động `#117A45` · vàng nắng `#FFC531` (nền nhẹ `#FFF3CF`) · sai/xoá `#C43E2A`.
Viền ô nhập `#6F8D78`; kẻ trang trí `#CFE3D6`.

**Typography:** MỘT họ chữ — Lexend 400/500/600/700 (`next/font/google`, subset
`latin + vietnamese`). Số dùng `tabular-nums` thay font mono. Nhãn nhỏ
(`.eyebrow`) là chữ thường 12px/600 — KHÔNG in hoa giãn chữ.

**Hình dạng:** bán kính gốc 14px; thẻ 18px (`rounded-card`); nút hành động và
chip `rounded-full` (viên thuốc). Nút cao 44px mặc định (sàn vùng chạm), 52px
cho hành động chính của một màn hình.

**Phẳng:** không box-shadow, không gradient — phân lớp bằng NỀN TÔ (surface),
viền chỉ còn ở ô nhập (WCAG 1.4.11) và kẻ chia trong danh sách. Hover/active
đổi nền, không đổi hình.

**Quy tắc cứng:**
- Vàng nắng chỉ 1,6:1 trên trắng → KHÔNG BAO GIỜ là ranh giới thông tin một
  mình: đứng sau icon/chữ đen (ô active thanh đáy), kèm viền đậm, hoặc làm nền
  tô nhẹ. Thanh tiến độ tô XANH.
- Một khối vàng (`Card variant="sun"`) mỗi màn hình — hai khối là vàng hết nghĩa "nhấn".
- Chữ đỏ dùng `#C43E2A` (5,1:1); `#E4573D` chỉ cho khối/điểm số cỡ lớn.
- Không nhãn in hoa, không dấu chấm giữa nối meta, không mũi tên sau chữ nút,
  không tô màu một cụm từ trong tiêu đề.
- Dùng token (`bg-surface`, `text-muted-foreground`…), đừng hardcode hex.

**Copy:** toàn bộ câu chữ ở `SOURCE/lib/copy.ts` (một từ điển tiếng Việt, hàm
`t()`); module i18n hai ngôn ngữ đã gỡ 2026-09-04.

---

## 3. UI Architecture — Route Groups

> Đổi tên 2026-09-03 (refactor B3): `(layer1)`→`(auth)`, `(layer2)`→`(exams)`,
> `(layer3)`→`(analytics)`, `(layer4)`→`(authoring)`, `(HM)`→`(history)`. Tài liệu
> trong `docs/` viết trước ngày đó vẫn dùng tên cũ — đọc theo bảng này. URL
> người dùng không đổi (tên nhóm route không xuất hiện trên đường dẫn). Code
> của mỗi tính năng nằm ở `SOURCE/features/<tên>/` — xem `ARCHITECTURE.md`.

| Route group | Tên cũ | Chức năng | Code |
|---|---|---|---|
| `(auth)` — Entry & Identity | (layer1) | Đăng nhập / đăng ký, OAuth callback, reset password | `features/auth` |
| `(exams)` — Core Loop *(ưu tiên cao nhất)* | (layer2) | Chọn đề (browse/filter), làm bài (timer, flag câu), nộp bài, xem kết quả | `features/exams` |
| `(analytics)` — Reflection / Analytics | (layer3) | Phân tích điểm yếu, gợi ý ôn tập (`docs/design/analytics-layer3-*`); hồ sơ cá nhân `/profile` | `features/analytics`, `features/profile` |
| `(authoring)` — Content Infrastructure (UGC) | (layer4) | Upload đề (PDF → Gemini extract), review trước khi publish, quản lý đề của tôi | `features/authoring` |
| `(history)` — History | (HM) | Lịch sử làm bài đã nộp, xem lại + lưu/chia sẻ PDF kết quả | `features/history` |
| `(billing)` — trang công khai | — | `/terms`, `/about` (công khai). Các trang giá / thanh toán / đơn hàng / chính sách hoàn tiền đã GỠ khỏi giao diện 2026-09-04; phần chạy ngầm (webhook payOS, `lib/billing`, entitlement, schema) giữ nguyên để bật lại không phải làm lại | `features/billing` (queries), `lib/billing` |
| `(admin)` | — | Trang kiểm duyệt nội bộ — danh sách đề bị report, gỡ/khôi phục; hàng đợi ticket hỗ trợ (auth qua `ADMIN_USER_IDS`, không có role trong DB — xem ADR-0001) | `features/admin` |

(history) và (admin) độc lập với tiến độ Analytics — không phụ thuộc lẫn nhau.

---

## 4. Tech Stack

**Tiêu chí ưu tiên:** Latency thấp · Responsive mạnh · Bảo mật đủ dùng · Nhẹ trên thiết bị tầm trung.

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + React 19 | SSR/ISR giảm latency; App Router map tự nhiên vào route group theo layer; TypeScript bắt lỗi compile-time khi solo dev không có reviewer |
| Styling | Tailwind CSS v4 | Utility-first, không CSS thừa trong production build |
| Component primitives | base-ui + `class-variance-authority` (`SOURCE/components/ui/`) | Unstyled, accessible, dễ áp token của §2 |
| Backend & DB | Supabase (PostgreSQL + Auth + Storage) | RLS ở tầng DB (không thể bypass qua API), Auth built-in, PostgreSQL đủ mạnh cho dữ liệu đề thi nhiều quan hệ |
| UGC extraction | Google Gemini API | Trích câu hỏi/đáp án từ PDF đề thi upload lên |
| PDF export | jsPDF + html2canvas | Xem ADR-0009 (lý do không dùng `@react-pdf/renderer`) |
| Deployment | Vercel, region `sin1` (Singapore) | Gần Supabase prod (`ap-south-1`) và người dùng VN. Region khai trong `SOURCE/vercel.json` |
| Testing | Vitest (unit/component) | Xem §6 |

---

## 5. Project Structure

```
MS-MOLAR/
├── SOURCE/                  # Toàn bộ source code (Next.js app, Root Directory trên Vercel)
│   ├── app/                 # App Router — CHỈ page/layout/loading/error, theo route group
│   │                        #   (auth) (exams) (analytics) (authoring) (history) (billing) (admin)
│   ├── features/            # Code của từng tính năng: queries.ts, actions.ts, components/, __tests__/
│   ├── components/          # UI dùng chung (components/ui = primitives, layout/, shared/, ...)
│   ├── lib/                 # Utilities, Supabase client, security, ugc, pdf, schema...
│   └── supabase/            # schema.sql, seed.ts, test-rls.ts, verify-schema.ts
├── docs/                    # PRD, ADR, Design Doc, UI Spec, work plan theo từng feature
├── SCREENSHOT/              # Ảnh tham chiếu thiết kế + screenshot tạm (Playwright MCP)
├── TECH-DEBT.md             # Sổ ghi nợ kỹ thuật
├── ARCHITECTURE.md          # Cái gì để đâu, vì sao, thêm màn hình mới thì tạo file ở đâu
└── PROJECT_OVERVIEW.md      # File này
```

---

## 6. Testing Strategy

- **Vitest** (`npm run test` trong `SOURCE/`) — unit/component test cho business logic và component có rủi ro hồi quy (vd `ExamTimer`, `SuccessToast`). Bắt buộc cho mọi bugfix có hình dạng lặp lại được.
- **`SOURCE/supabase/test-rls.ts`** — test cách ly RLS hai-user trên Postgres thật (không mock).
- **`SOURCE/supabase/verify-schema.ts`** — đối chiếu `schema.sql` khai báo với hành vi thật của DB (cột, khoá ngoại, `on delete`) sau mỗi lần apply schema.
- **Playwright MCP** — dùng để agent lái trình duyệt thật kiểm tra thủ công (không phải bộ E2E test tự động chạy trong CI); xem `.mcp.json` và `[[playwright-mcp-screenshot-quality]]` trong memory.

---

## 7. Git Conventions

### Commit Message Format

Theo Conventional Commits:

```
<type>(<scope>): <mô tả ngắn>
```

| Type | Khi nào |
|---|---|
| `feat` | Tính năng mới |
| `fix` | Sửa lỗi |
| `refactor` | Cải tiến code, không đổi behavior |
| `style` | UI/CSS, không đổi logic |
| `test` | Thêm/sửa test |
| `chore` | Config, dependencies, build |
| `docs` | Tài liệu nội bộ |

### Branching

Việc nhỏ: push thẳng `main`. Feature lớn: nhánh riêng (vd `feat/rating-system`) rồi merge vào `main` — Vercel tự tạo Preview deploy cho mỗi feature branch (trỏ Supabase project **dev**; Production trỏ **prod**).

---

## 8. Non-Functional Requirements

### Performance
- **Target:** Lighthouse Performance Score ≥ 85 trên mobile (mid-range Android)
- First Contentful Paint (FCP) ≤ 2.5s trên 3G

### Security
- Supabase RLS bắt buộc trên mọi table chứa dữ liệu user
- Không lưu sensitive data (điểm, lịch sử) ở localStorage
- Input validation ở cả client (TypeScript types) và server (Supabase policies)
- Chi tiết đầy đủ + trạng thái từng mục: `TECH-DEBT.md` (đợt security review 2026-08-03 đã sinh ra ADR-0010/ADR-0011; tài liệu review không còn trong repo)

### Accessibility
- Toàn bộ interactive element có keyboard navigation
- Alt text cho mọi `<img>`

### SEO
- `<title>`, `<meta description>`, Open Graph tags đầy đủ (`opengraph-image.tsx`, `sitemap.ts`, `robots.ts`)
- Navbar và Footer là HTML thuần, crawlable

---

## 9. Risk Register

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| Layer 1 quá tối giản → user mới không biết làm gì | Trung bình | Hint text nhỏ; không phá vỡ thẩm mỹ biên tập của §2 |
| Feedback loop sai hướng (user học sai → hệ thống học theo) | Thấp (Layer 3) | Ground Truth layer cứng cho đề chính thức Bộ GD&ĐT — không bị kéo xuống bởi report |
| Mất personalization/lịch sử của user | Thấp | Lưu trên Supabase (không phải localStorage) |
| Nợ kỹ thuật đang mở có thể nổ khi chạm tới | Xem `TECH-DEBT.md` | Theo dõi + đánh giá lại định kỳ, không để mục cũ tự tin sai |

---

## 10. Decisions Log

Ghi lại các quyết định kỹ thuật quan trọng để tránh revisit không cần thiết.

| Ngày | Quyết định | Lý do |
|---|---|---|
| — | Next.js (App Router) thay vì React thuần | SSR/ISR giảm latency, SEO tốt hơn |
| — | Supabase thay vì Firebase | PostgreSQL + RLS mạnh hơn cho dữ liệu đề thi phức tạp; bảo mật tốt hơn |
| — | shadcn-style primitives (base-ui + cva) thay vì MUI/Antd | Unstyled, dễ customize theo token riêng của §2 |
| 2026-07-27 | History (lịch sử làm bài) tách thành layer riêng `(HM)` thay vì gộp vào Layer 3 (Reflection) | Layer 3 dở dang cho Analytics; tách để triển khai độc lập |
| **2026-08-06** | **Bỏ hẳn tầm nhìn ban đầu: homepage 3D (Three.js scene bàn gỗ + máy Mac, GSAP transition, "Spatial Memory" visual-language-per-layer)** | Không bao giờ được implement — `package.json` không có `three`/`gsap`; `(layer1)` thực tế là trang đăng nhập phẳng. Theme thật đang dùng là "Mực & Sơn mài" (§2), editorial/phẳng, ưu tiên tốc độ tải trên Android tầm trung hơn hiệu ứng 3D. Tài liệu cũ mô tả 3D đã bị xoá khỏi file này ở lần rà soát 2026-08-06 để tránh gây hiểu nhầm cho agent đọc sau. |
| **2026-09-04** | **Theme "Sân trường" thay "Mực & Sơn mài"** — trắng, xanh lá đậm, vàng nắng, Lexend; nút viên thuốc, thẻ 18px, không viền/bóng. Chọn trong 3 prototype (A Vở ô ly, B Sân trường, C Phòng tự học) | Engineer: layout cũ tự nghĩ/từ template, không nổi bật; B "vừa đơn giản vừa cuốn hút màu sắc hơn". Chi tiết: `docs/design/ui-refactor-san-truong-design.md` |
| 2026-09-04 | Bỏ tiếng Anh, gỡ module i18n; toàn bộ copy ở `lib/copy.ts` | Engineer chốt chỉ tiếng Việt; đồng thời đóng TD-033 (bundle nạp cả hai từ điển) |
| 2026-09-04 | Gỡ các trang billing (giá, thanh toán, đơn hàng, hoàn tiền) và mọi chỗ nhắc Premium khỏi giao diện; giữ `lib/billing`, webhook payOS, schema | Tính năng chưa áp vào website; giữ phần ngầm để bật lại không phải làm lại |
| 2026-09-08 | Tìm đề theo tên chạy TRONG Postgres (`pg_trgm` + `unaccent`, cột sinh `exams.title_search`, RPC `search_exams`), không dùng dịch vụ tìm kiếm ngoài; ô tìm trên header chỉ cho người đã đăng nhập | Khớp không dấu/chịu lỗi gõ cho tên đề ngắn; cả dev lẫn prod có sẵn hai extension; dữ liệu ở lại sau RLS, không phải đồng bộ sang chỉ mục ngoài. Xem lại khi kho vượt ~50k đề hoặc tìm trong nội dung câu hỏi. Chi tiết: ADR-0020, `docs/design/exam-search-design.md` |

> Agent: Khi engineer ra quyết định kỹ thuật mới trong quá trình làm việc, thêm vào bảng này và ghi ngày.
