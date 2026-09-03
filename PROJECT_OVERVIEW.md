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
| **Tài liệu liên quan** | `DESIGN.md` (design token), `TECH-DEBT.md`, `docs/DEPLOYMENT.md`. Tiến độ từng phiên: Notion (xem `.claude/MEMORY.md`) |

---

## 1. Product Summary

**TrangNguyenDigi** là nền tảng web luyện đề thi trực tuyến dành cho học sinh THCS và THPT tại Việt Nam.

**Mục tiêu cốt lõi:** Cung cấp ngân hàng đề có thể cập nhật, kiểm tra và xóa với tính minh bạch cao. Làm một việc duy nhất và làm thật tốt.

**Đối tượng người dùng:** Học sinh THCS → THPT — thường dùng thiết bị Android tầm trung, kết nối mạng không ổn định.

**Ưu tiên triển khai:** Core loop (làm đề) trước, giao diện ấn tượng sau.

---

## 2. Design System

Nguồn thiết kế duy nhất là **`DESIGN.md`** (root repo) — theme "Mực & Sơn mài"
(Ink & Lacquer): biên tập cổ điển kiểu New York Times kết hợp bảng màu sơn mài
truyền thống Việt Nam, phẳng (không 3D, không box-shadow/gradient). Coi
`DESIGN.md` là authoritative cho mọi màu sắc/typography/spacing/component token
— file này không lặp lại nội dung đó.

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
| `(billing)` — Subscription | — | Bảng giá, thanh toán payOS, đơn hàng; `/terms`, `/refund-policy`, `/about` công khai | `features/billing` |
| `(admin)` | — | Trang kiểm duyệt nội bộ — danh sách đề bị report, gỡ/khôi phục; hàng đợi ticket hỗ trợ (auth qua `ADMIN_USER_IDS`, không có role trong DB — xem ADR-0001) | `features/admin` |

(history) và (admin) độc lập với tiến độ Analytics — không phụ thuộc lẫn nhau.

---

## 4. Tech Stack

**Tiêu chí ưu tiên:** Latency thấp · Responsive mạnh · Bảo mật đủ dùng · Nhẹ trên thiết bị tầm trung.

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + React 19 | SSR/ISR giảm latency; App Router map tự nhiên vào route group theo layer; TypeScript bắt lỗi compile-time khi solo dev không có reviewer |
| Styling | Tailwind CSS v4 | Utility-first, không CSS thừa trong production build |
| Component primitives | base-ui + `class-variance-authority` (`SOURCE/components/ui/`) | Unstyled, accessible, dễ áp token của `DESIGN.md` |
| Backend & DB | Supabase (PostgreSQL + Auth + Storage) | RLS ở tầng DB (không thể bypass qua API), Auth built-in, PostgreSQL đủ mạnh cho dữ liệu đề thi nhiều quan hệ |
| UGC extraction | Google Gemini API | Trích câu hỏi/đáp án từ PDF đề thi upload lên |
| PDF export | jsPDF + html2canvas | Xem ADR-0009 (lý do không dùng `@react-pdf/renderer`) |
| Deployment | Vercel, region `sin1` (Singapore) | Gần Supabase prod và người dùng VN — xem `docs/DEPLOYMENT.md` §2.2b |
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
├── DESIGN.md                # Design token — nguồn duy nhất, xem §2
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

Việc nhỏ: push thẳng `main`. Feature lớn: nhánh riêng (vd `feat/rating-system`) rồi merge vào `main` — Vercel tự tạo Preview deploy cho mỗi feature branch (trỏ Supabase project **dev**, xem `docs/DEPLOYMENT.md`).

---

## 8. Non-Functional Requirements

### Performance
- **Target:** Lighthouse Performance Score ≥ 85 trên mobile (mid-range Android)
- First Contentful Paint (FCP) ≤ 2.5s trên 3G

### Security
- Supabase RLS bắt buộc trên mọi table chứa dữ liệu user
- Không lưu sensitive data (điểm, lịch sử) ở localStorage
- Input validation ở cả client (TypeScript types) và server (Supabase policies)
- Chi tiết đầy đủ + trạng thái từng mục: `docs/security-review-2026-08-03.md`, `docs/TECH-DEBT.md`

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
| Layer 1 quá tối giản → user mới không biết làm gì | Trung bình | Hint text nhỏ; không phá vỡ thẩm mỹ biên tập của `DESIGN.md` |
| Feedback loop sai hướng (user học sai → hệ thống học theo) | Thấp (Layer 3) | Ground Truth layer cứng cho đề chính thức Bộ GD&ĐT — không bị kéo xuống bởi report |
| Mất personalization/lịch sử của user | Thấp | Lưu trên Supabase (không phải localStorage) |
| Nợ kỹ thuật đang mở có thể nổ khi chạm tới | Xem `docs/TECH-DEBT.md` | Theo dõi + đánh giá lại định kỳ, không để mục cũ tự tin sai |

---

## 10. Decisions Log

Ghi lại các quyết định kỹ thuật quan trọng để tránh revisit không cần thiết.

| Ngày | Quyết định | Lý do |
|---|---|---|
| — | Next.js (App Router) thay vì React thuần | SSR/ISR giảm latency, SEO tốt hơn |
| — | Supabase thay vì Firebase | PostgreSQL + RLS mạnh hơn cho dữ liệu đề thi phức tạp; bảo mật tốt hơn |
| — | shadcn-style primitives (base-ui + cva) thay vì MUI/Antd | Unstyled, dễ customize theo token riêng của `DESIGN.md` |
| 2026-07-27 | History (lịch sử làm bài) tách thành layer riêng `(HM)` thay vì gộp vào Layer 3 (Reflection) | Layer 3 dở dang cho Analytics; tách để triển khai độc lập |
| **2026-08-06** | **Bỏ hẳn tầm nhìn ban đầu: homepage 3D (Three.js scene bàn gỗ + máy Mac, GSAP transition, "Spatial Memory" visual-language-per-layer)** | Không bao giờ được implement — `package.json` không có `three`/`gsap`; `(layer1)` thực tế là trang đăng nhập phẳng. Theme thật đang dùng là "Mực & Sơn mài" (`DESIGN.md`), editorial/phẳng, ưu tiên tốc độ tải trên Android tầm trung hơn hiệu ứng 3D. Tài liệu cũ mô tả 3D đã bị xoá khỏi file này ở lần rà soát 2026-08-06 để tránh gây hiểu nhầm cho agent đọc sau. |

> Agent: Khi engineer ra quyết định kỹ thuật mới trong quá trình làm việc, thêm vào bảng này và ghi ngày.
