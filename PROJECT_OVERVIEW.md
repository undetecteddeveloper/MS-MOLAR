# PROJECT_OVERVIEW — TrangNguyenDigi

> Tài liệu nền tảng cho agent và engineer. Đọc file này trước khi đọc `WORKFLOW.md` hoặc `PROCESS.md`.
> Cập nhật file này khi có quyết định kỹ thuật mới — không được để thông tin lỗi thời tồn tại.

---

## 0. Quick Reference

| Mục | Giá trị |
|---|---|
| **Tên dự án** | TrangNguyenDigi |
| **Repo** | `github.com/undetecteddeveloper/TrangNguyenDigi.git` |
| **Giao tiếp agent ↔ engineer** | Tiếng Việt |
| **PROCESS.md** | Tiếng Việt |
| **Solo hay team** | Solo (1 engineer) |
| **Tài liệu liên quan** | `WORKFLOW.md`, `PROCESS.md` |

---

## 1. Product Summary

**TrangNguyenDigi** là nền tảng web luyện đề thi trực tuyến dành cho học sinh THCS và THPT tại Việt Nam.

**Mục tiêu cốt lõi:** Cung cấp ngân hàng đề có thể cập nhật, kiểm tra và xóa với tính minh bạch cao. Làm một việc duy nhất và làm thật tốt.

**Đối tượng người dùng:** Học sinh THCS → THPT — thường dùng thiết bị Android tầm trung, kết nối mạng không ổn định.

**Ưu tiên triển khai:** Core loop (làm đề) trước, giao diện ấn tượng sau.

---

## 2. Design Philosophy

Hai nguyên lý chỉ đạo mọi quyết định thiết kế:

**Progressive Disclosure** — Chỉ hiển thị những gì user cần ở thời điểm đó. Layer 1 chỉ có một quyết định. Layer 2 không có distraction. Complexity tăng dần theo hành trình.

**Spatial Memory** — Mỗi layer có visual language riêng biệt. User biết mình đang ở đâu mà không cần breadcrumb hay label.

| Layer | Visual Language |
|---|---|
| Layer 1 — Entry & Identity | Spatial / 3D (bàn, đồ vật, không gian) |
| Layer 2 — Core Loop | Focused / tối giản (như tờ giấy trắng) |
| Layer 3 — Reflection | Analytical / data (charts, số liệu) |
| Layer 4 — Content Infrastructure | Structured / editorial (content management UI) |

---

## 3. UI Architecture — Layer System

Xem `WORKFLOW.md` Mục 1 để biết quy tắc dependency và điều kiện hoàn thành layer.

### Layer 1 — Entry & Identity
- Homepage 3D: scene chiếc bàn gỗ + máy Mac (Three.js trên desktop, CSS Parallax 2.5D trên mobile)
- Click vào Mac → fade transition → vào Layer 2
- Login / Signup
- Personalization: đổi model máy tính, sticky notes

### Layer 2 — Core Loop *(ưu tiên cao nhất)*
- Chọn đề (browse / filter / random / gợi ý)
- Làm bài: timer, flag câu để xem lại
- Nộp bài: xem đáp án + breakdown theo chủ đề

### Layer 3 — Reflection *(xây sau khi Layer 1–2 ổn định)*
- Phân tích điểm yếu, gợi ý ôn tập

### Layer 4 — Content Infrastructure *(xây sau)*
- Quản lý, cập nhật, kiểm duyệt đề
- Version control cho từng câu hỏi
- Confidence scoring + quarantine system
- Thiết kế như plugin độc lập — không hardcode vào core

### Layer HM — History *(độc lập với Layer 3, không phụ thuộc tiến độ Analytics)*
- Lịch sử làm bài: trang liệt kê các attempt đã nộp và có điểm
- Phạm vi: danh sách history của các attempt đã submit + lưu/chia sẻ PDF kết quả (save/share)

---

## 4. Tech Stack

### Quyết định & Lý do

**Tiêu chí ưu tiên:** Latency thấp · Responsive mạnh · Bảo mật đủ dùng · Nhẹ trên thiết bị tầm trung

---

#### Frontend — Next.js 15 (App Router) + TypeScript

| Tiêu chí | Lý do chọn Next.js |
|---|---|
| Latency thấp | SSR/ISR render trước HTML — user nhận nội dung ngay, không chờ JS hydrate |
| SEO | Canvas 3D không được index; Next.js gánh text qua HTML chuẩn |
| Image | Built-in `next/image` tự optimize, lazy load, WebP conversion |
| Routing | App Router maps tự nhiên với layer structure |
| TypeScript | Bắt lỗi tại compile time — quan trọng khi solo dev không có reviewer |

Styling: **Tailwind CSS** — utility-first, không có unused CSS trong production build.
Component primitives: **shadcn/ui** (Radix UI) — accessible, unstyled, customizable.

---

#### 3D & Animation — Three.js + GSAP

| Thư viện | Phạm vi sử dụng |
|---|---|
| **Three.js** | Scene 3D Layer 1 — desktop only |
| **GSAP** | Transition giữa các layer, micro-animations |
| **CSS Parallax + Gyroscope** | Fallback cho mobile (thay WebGL) — giữ đủ chức năng cốt lõi |

> **Quan trọng:** Three.js chỉ load khi user trên desktop và trình duyệt hỗ trợ WebGL. Mobile nhận fallback 2.5D — không bao giờ load Three.js.

---

#### Backend & Database — Supabase

Supabase được chọn thay Firebase vì đáp ứng tốt hơn cả hai tiêu chí hiệu suất và bảo mật:

| Tiêu chí | Supabase |
|---|---|
| **Latency thấp** | PostgreSQL + connection pooling (PgBouncer) · Edge Functions chạy gần user |
| **Bảo mật cơ bản** | Built-in Auth (email, OAuth) · JWT tự động · HTTPS mặc định |
| **Bảo mật nâng cao** | Row Level Security (RLS) — policy trực tiếp ở DB, không thể bypass qua API · MFA support |
| **Truy vấn phức tạp** | PostgreSQL mạnh hơn Firestore cho dữ liệu đề thi có nhiều quan hệ |
| **Realtime** | Subscriptions nếu cần tính năng live sau này |

Supabase cung cấp trong một platform: **Auth · Database · Storage · Edge Functions · Realtime**.

---

#### Deployment — Vercel

- Native Next.js support, zero-config
- Global Edge Network → giảm latency từ VN
- Preview deployments tự động khi push PR
- Analytics + Web Vitals built-in

---

### Stack Summary

```
Frontend   : Next.js 15 (App Router) + TypeScript + Tailwind CSS
UI Lib     : shadcn/ui (Radix UI)
3D/Anim    : Three.js (desktop) + GSAP + CSS Parallax (mobile)
Backend    : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
Deployment : Vercel
Testing    : Xem Mục 6
```

---

## 5. Project Structure

```
TrangNguyenDigi/
├── SOURCE/                  # Toàn bộ source code
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── (layer1)/        # Entry & Identity routes
│   │   ├── (layer2)/        # Core Loop routes
│   │   ├── (layer3)/        # Reflection routes
│   │   ├── (layer4)/        # Content Infrastructure routes
│   │   └── (HM)/            # History — lịch sử làm bài (attempt history)
│   ├── components/          # Shared UI components
│   │   ├── ui/              # shadcn/ui primitives
│   │   └── [feature]/       # Feature-specific components
│   ├── lib/                 # Utilities, helpers, Supabase client
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript type definitions
├── ASSETS/                  # Static media không qua build pipeline
│   ├── models/              # 3D models (.glb/.gltf) — curated only
│   ├── fonts/               # Custom fonts
│   └── images/              # Raw images trước khi optimize
├── TEXT/                    # Nội dung & bản thảo (tách khỏi code)
│   ├── copy/                # UI copy, labels, messages
│   └── docs/                # Tài liệu nội bộ (WORKFLOW, PROCESS, etc.)
├── PROCESS.md               # State memory của workflow hiện tại
├── WORKFLOW.md              # Quy trình agent
└── PROJECT_OVERVIEW.md      # File này
cộng thêm TEMP_SCREENSHOT để lưu full size screeshot từ localhost của agent và TEMPLATE để lưu mẫu layout cho agent
```

> **Quy tắc ASSETS/models:** Chỉ import model đã được kiểm tra format, polygon count và license. Không import model tùy ý từ ngoài vào.

---

## 6. Testing Strategy

Vì dự án chưa có test suite, testing được triển khai theo pha:

| Pha | Giai đoạn | Công cụ | Phạm vi |
|---|---|---|---|
| **Pha 0** | Layer 1–2 (đầu dự án) | Thủ công | Build chạy được, render đúng trên Chrome/Firefox/Safari + Android mid-range |
| **Pha 1** | Khi Layer 2 ổn định | **Vitest** | Unit test cho business logic (tính điểm, xử lý đề) |
| **Pha 2** | Khi Layer 3 bắt đầu | **Playwright** | E2E test các user flow chính (chọn đề → làm → nộp) |

> **Agent lưu ý:** Ở Pha 0, bước Testing trong WORKFLOW = kiểm tra thủ công theo checklist. Agent không tự dựng test framework khi chưa được chỉ định chuyển sang Pha 1.

**Checklist Testing Pha 0 (thủ công):**
- `npm run build` không có lỗi
- Render đúng trên viewport 375px (mobile) và 1280px (desktop)
- Không có console error khi chạy
- Các route liên quan đến feature vừa làm hoạt động đúng

---

## 7. Git Conventions

### Khởi tạo (lần đầu tiên)

```bash
git init
git remote add origin https://github.com/undetecteddeveloper/TrangNguyenDigi.git
git branch -M main
```

> Agent thực hiện đoạn này ở lần **Git đầu tiên** của dự án, trước `git add`.

### Commit Message Format

Theo Conventional Commits với layer scope:

```
<type>(<layer>/<module>): <mô tả ngắn bằng tiếng Anh>
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

Ví dụ:
```
feat(layer1/auth): add Google OAuth login flow
fix(layer2/exam): handle null answer on submit
style(layer1/homepage): adjust Mac model lighting
```

### Branching (khi dự án lớn hơn)

Hiện tại: push thẳng lên `main`.
Khi Layer 2 hoàn thành: chuyển sang `main` + `dev` + feature branches.

---

## 8. Non-Functional Requirements

### Performance
- **Target:** Lighthouse Performance Score ≥ 85 trên mobile (mid-range Android)
- First Contentful Paint (FCP) ≤ 2.5s trên 3G
- Three.js scene chỉ load sau khi user tương tác (lazy init) — không block LCP

### Security
- Supabase RLS bắt buộc trên mọi table chứa dữ liệu user
- Không lưu sensitive data (điểm, lịch sử) ở localStorage
- Input validation ở cả client (TypeScript types) và server (Supabase policies)
- Auth token không được expose trong URL

### Accessibility
- Toàn bộ interactive element có keyboard navigation
- Alt text cho mọi `<img>`
- Canvas 3D có text fallback cho screen reader

### SEO (đặc biệt quan trọng vì Layer 1 dùng Canvas)
- Mọi nội dung quan trọng phải có trong HTML (không chỉ trong canvas)
- `<title>`, `<meta description>`, Open Graph tags đầy đủ
- Navbar và Footer là HTML thuần — gánh toàn bộ crawlable text

---

## 9. Risk Register

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| Three.js quá nặng trên Android tầm trung | Cao | Fallback CSS 2.5D bắt buộc; test trên thiết bị thực trước khi merge Layer 1 |
| Layer 1 quá tối giản → user mới không biết làm gì | Trung bình | Thêm subtle pulse animation trên Mac + hint text nhỏ; không phá vỡ thẩm mỹ |
| SEO bị mất vì canvas không được index | Trung bình | Navbar/Footer HTML gánh text; kiểm tra với Google Rich Results Test |
| Feedback loop sai hướng (user học sai → hệ thống học theo) | Thấp (Layer 4) | Ground Truth layer cứng cho đề chính thức Bộ GD&ĐT — không bị kéo xuống bởi report |
| Mất personalization data của user | Thấp | Lưu trên Supabase (không phải localStorage); export/backup cần thiết kế sớm |

---

## 10. Decisions Log

Ghi lại các quyết định kỹ thuật quan trọng để tránh revisit không cần thiết.

| Ngày | Quyết định | Lý do |
|---|---|---|
| — | Next.js 15 thay vì React thuần | SSR/ISR giảm latency, SEO tốt hơn cho Canvas-heavy site |
| — | Supabase thay vì Firebase | PostgreSQL + RLS mạnh hơn cho dữ liệu đề thi phức tạp; bảo mật tốt hơn |
| — | Three.js chỉ trên desktop | Mobile mid-range VN không đủ GPU để chạy WebGL ổn định |
| — | shadcn/ui thay vì MUI/Antd | Unstyled primitives dễ customize hơn cho visual language riêng từng layer |
| — | Testing Pha 0 là thủ công | Chưa đủ codebase để viết test có ý nghĩa; tránh over-engineering sớm |
| 2026-07-27 | History (lịch sử làm bài) tách thành layer riêng `(HM)` thay vì gộp vào Layer 3 (Reflection) | Layer 3 hiện đang dở dang cho Analytics (chưa commit); tách History thành layer riêng để triển khai độc lập, không phụ thuộc tiến độ Analytics; quyết định theo yêu cầu sản phẩm trực tiếp |

> Agent: Khi engineer ra quyết định kỹ thuật mới trong quá trình làm việc, thêm vào bảng này và ghi ngày.
