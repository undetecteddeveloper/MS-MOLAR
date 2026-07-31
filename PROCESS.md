# [GĐ 0: Nền Móng] — Scaffold Project

- **Latest prompt:** "Bắt đầu thiết lập dự án."
- **Latest step:** Git ✅ Done
- **Layer status:** GĐ 0 Done

---

## M0.1 — Khởi tạo project
- **State:** Done
  + Next.js 16.2.7 + TypeScript + Tailwind CSS 4 + App Router — Done
  + shadcn/ui initialized (Button, Input) — Done
  + Prettier + prettier-plugin-tailwindcss — Done
  + ESLint (via Next.js), TypeScript strict mode — Done

## M0.2 — Hello Production
- **State:** Done
  + Trang `/` hiển thị "TrangNguyenDigi" — Done
  + git init + remote origin + branch main — Done
  + Push lên https://github.com/undetecteddeveloper/TrangNguyenDigi.git — Done
  + (Kết nối Vercel: engineer thực hiện thủ công trên vercel.com)

## M0.3 — Khung route groups
- **State:** Done
  + Route groups: `(layer1)` `(layer2)` `(layer3)` `(layer4)` — Done
  + `proxy.ts` skeleton (Next.js 16 convention, thay thế `middleware.ts`) — Done
  + Thư mục `SOURCE/types/` `SOURCE/hooks/` `SOURCE/components/shared/` — Done
  + `npm run build` pass không lỗi — Done

---

## Lưu ý kỹ thuật phát sinh

| Vấn đề | Giải quyết |
|---|---|
| `create-next-app` không nhận tên thư mục có chữ hoa (SOURCE) | Tạo trong thư mục tạm rồi di chuyển vào SOURCE/ |
| Route groups `(layerN)/page.tsx` conflict vì cùng resolve về `/` | Xóa placeholder page.tsx trong các route groups — root `/` chỉ do `app/page.tsx` đảm nhiệm |
| `middleware.ts` deprecated trong Next.js 16 | Đổi thành `proxy.ts` theo convention mới |
| Tailwind CSS 4 không dùng `tailwind.config.ts` | Config qua `globals.css` với `@import "tailwindcss"` |

---

## Tiến độ tổng thể

```
GĐ 0 — Nền Móng              : [x] Done
GĐ 1 — Functional Prototype  : [x] Done (M1.1–M1.7) — confirmed browser 2026-06-05
GĐ 2 — Connected Prototype   : [x] Done (M2.1–M2.7) — confirmed browser 2026-06-06
GĐ 3 — Polish (MVP ship)     : [ ] In Progress
  M3.1 Visual language L2    : [x] Done (Tasks 1–5, commits 57c403a→35c1811, 2026-06-08→2026-06-13)
  M3.2 Responsive L2         : [x] Done (commit 36e40a4, 2026-06-14)
  M3.3 Homepage 3D           : [x] Done (commit e094bc5, 2026-06-14)
  M3.4 Homepage Mobile       : [ ] Not Started
  M3.5 Personalization       : [ ] Not Started
  M3.6 Transitions & SEO     : [ ] Not Started
─────────────────────────────
Post-MVP A — Layer 3         : [ ] Not Started
Post-MVP B — Layer 4         : [ ] Not Started
```

---
---

# [Layer 2: Core Loop] — Task: GĐ 1 Functional Prototype (M1.1–M1.7)

- **Latest prompt:** "Bắt đầu với các milestone còn lại của GĐ1" (M1.5–M1.7), tiếp nối M1.1–M1.4.
- **Latest step:** Git
- **Layer status:** Layer 2 Dở dang (GĐ 1 logic + structure Done; chưa style/DB/auth)

### Quyết định C&D (engineer chốt)
- Q1=B: `/exams` → `/exams/[id]` (Detail) → "Bắt đầu" → Player.
- Q2=A: Player ở route blueprint `/exams/[id]/attempt/[attemptId]`, `attemptId` sinh client-side bằng `crypto.randomUUID()` (GĐ 2 thay bằng UUID từ DB).
- Q3=A: một câu/trang, điều hướng next/prev + pagination.
- Q4=B: `choices: { id: 'A'|'B'|'C'|'D', text }[]` + `correctAnswer: ChoiceId`.

---

## Logic Module: Data Model + Fake Data
- **State:** Done
  + M1.1 `types/question.ts` (Question, Choice, ChoiceId) — Done
  + M1.1 `types/exam.ts` (Exam) — Done
  + M1.1 `types/attempt.ts` (Attempt) — Done
  + M1.2 `lib/fake-data/exams.ts` — 2 đề (Toán 10, Vật Lý 10), mỗi đề 5 câu, đáp án verify tay — Done
  + M1.2 `getFakeExams()`, `getFakeExam(id)`, `getFakeQuestions(examId)` — Done

## UI Module: Exam Browser + Exam Player (structure, chưa style)
- **State:** Done (cho scope M1.3–M1.4)
  + M1.3 `_components/ExamBrowser.tsx` + `ExamCard.tsx` — list đề, Link sang Detail — Done
  + M1.3 `exams/page.tsx` (Browser), `exams/[id]/page.tsx` (Detail) + `StartAttemptButton.tsx` — Done
  + M1.4 `_components/QuestionRenderer.tsx` + `AnswerChoice.tsx` — hiện câu + 4 radio — Done
  + M1.4 `_components/QuestionPagination.tsx` — prev/next + jump số câu — Done
  + M1.4 `exams/[id]/attempt/[attemptId]/page.tsx` (Player) — Done

---

---

## Logic Module: Scoring (M1.6 — ⭐ tracer code)
- **State:** Done
  + M1.6 `types/result.ts` (ScoreResult, PerQuestionResult, TopicResult) — Done
  + M1.6 `lib/scoring/computeScore.ts` — hàm THUẦN `(questions, answers) → ScoreResult`, thang 10, topicBreakdown — Done
  + M1.6 Verify tay 8/8 case (đúng hết→10, sai hết→0, partial 3/5→6, bỏ trống, breakdown) qua `npx tsx` one-shot — Done

## Logic Module: Exam Player State (M1.5)
- **State:** Done
  + M1.5 `hooks/useExamPlayer.ts` — useReducer (current + answers), actions SELECT_ANSWER/GOTO/NEXT/PREV — Done
  + M1.5 Player refactor dùng hook (thay useState placeholder) — Done

## UI Module: Result + Submit (M1.7)
- **State:** Done
  + M1.7 `_components/ScoreCard.tsx` (điểm tổng) + `TopicBreakdown.tsx` (theo chủ đề) — Done
  + M1.7 `exams/[id]/attempt/[attemptId]/result/page.tsx` (ResultView) — chi tiết từng câu + "Làm lại" — Done
  + M1.7 Nút "Nộp bài" thật: sessionStorage bridge (Q=A) → điều hướng Result — Done

---

## Ghi chú scope & nợ kỹ thuật (cho GĐ 2)
- Bridge Player→Result qua `sessionStorage` key `attempt:<attemptId>`. **GĐ 2 (M2.6)** thay bằng `submitExam()` Server Action + `getResult(attemptId)` từ DB — route không đổi.
- `attemptId` sinh client-side (`crypto.randomUUID`). **GĐ 2** thay bằng UUID do `startAttempt()` tạo.
- `getFakeExams/getFakeExam/getFakeQuestions` → **GĐ 2 (M2.5)** thay bằng query Supabase.
- `computeScore` giữ nguyên, **GĐ 2** chạy server-side trong `submitExam()`.
- Tất cả `_components` theo `UI-LAYER-MAP.md` Mục 4.5 — GĐ 3 (M3.1) chỉ thêm style.

## Kết quả Testing
- `tsc --noEmit`: pass (exit 0).
- `next build`: pass — 6 routes gồm `/exams/[id]/attempt/[attemptId]/result`.
- `computeScore` verify tay: **8/8 pass** (Pha 0, không cài framework — script tạm đã xóa).
- Visual testing: bỏ qua (Pha 0 thủ công; render server-side xác nhận qua build).

## ✅ Tiêu chí thoát GĐ 1 (PROJECT_ROADMAP Mục 5)
- [x] Chọn được 1 trong 2 đề mẫu.
- [x] Trả lời hết câu, nộp bài.
- [x] Điểm hiển thị chính xác (verify tay 8/8).
- [x] Toàn bộ in-memory, không cần internet.
- [x] **Kiểm thử thủ công trên browser (2026-06-05):** Engineer xác nhận toàn bộ luồng chạy đúng — chọn đề, làm bài, pagination, nộp bài, kết quả, "Làm lại". GĐ 1 CONFIRMED ✅

> **Layer 2 status:** Dở dang (logic + structure xong; chưa style/DB/auth — đúng tinh thần prototype-first).
> **Bước tiếp theo:** GĐ 2 — Connected Prototype (Supabase + auth thật, xem PROJECT_ROADMAP Mục 6).

---
---

# [Layer 1 + Layer 2] — Task: GĐ 2 Connected Prototype (M2.1–M2.4)

- **Latest prompt:** "Continue the project where we paused" → GĐ 2; engineer chốt Q1=A (schema đơn giản, không confidence/quarantine), Q2=A (batch on submit); phạm vi đợt này M2.1→M2.4, các milestone còn lại yêu cầu sau.
- **Latest step:** Git
- **Layer status:** Layer 1 Dở dang (auth), Layer 2 Dở dang

### Quyết định C&D (engineer chốt)
- Q1=A: Schema `questions`/`exams` chỉ các cột cần thiết (không `confidence_score`/`quarantine`/view `published_questions`) — mở rộng L4 ở Post-MVP.
- Q2=A: Persist batch-on-submit — giữ `useReducer` client-side, `submitExam()` insert toàn bộ `attempt_answers` + tính điểm một lần (sẽ làm ở M2.6).
- Phạm vi đợt này: M2.1–M2.4. Event system (L3/L4) bỏ qua ở GĐ 2.

---

## Logic Module: Supabase Clients (M2.1)
- **State:** Done
  + M2.1 Cài `@supabase/supabase-js` + `@supabase/ssr` — Done
  + M2.1 `.env.local` (URL + anon + service_role) — Done
  + M2.1 `lib/supabase/client.ts` (browser, `createBrowserClient`) — Done
  + M2.1 `lib/supabase/server.ts` (server, đọc cookie qua `createServerClient`) — Done
  + M2.1 `lib/supabase/middleware.ts` (`updateSession`: refresh token + chặn route) — Done

## Logic Module: Database Schema + RLS (M2.2)
- **State:** Done (code) — ⚠️ chờ engineer apply lên DB
  + M2.2 `supabase/schema.sql` — 6 bảng + RLS + trigger `handle_new_user` (auto tạo user_profiles). Idempotent. — Done
  + M2.2 **Engineer chạy `supabase/schema.sql` trong Supabase SQL Editor** — Done

## Logic Module: Seed Data (M2.3)
- **State:** Done (code) — ⚠️ chờ chạy sau khi M2.2 apply
  + M2.3 `supabase/seed.ts` — đẩy 2 đề + 10 câu từ fake-data vào DB (service_role, upsert, tự nạp `.env.local`) — Done
  + M2.3 Chạy `npx tsx supabase/seed.ts` — Done (10 câu hỏi + 2 đề ✅)
  + M2.3 Verify data trong Supabase dashboard — Done (seed log xác nhận)

## Logic Module + UI Module: Auth thật (M2.4 — Logic Layer 1)
- **State:** Done
  + M2.4 `app/(layer1)/actions.ts` — signUp/signIn/signOut Server Actions (`useActionState` pattern) — Done
  + M2.4 user_profiles row tạo tự động qua DB trigger (thay vì trong action — tránh lỗi timing email-confirm) — Done
  + M2.4 `lib/auth/getCurrentUser.ts` — helper Server Component — Done
  + M2.4 `app/(layer1)/_components/AuthForm.tsx` + `app/(layer1)/login/page.tsx` — form tối giản (chưa style) — Done
  + M2.4 `proxy.ts` — gọi `updateSession`, chặn route chưa auth (public: `/`, `/login`) → redirect `/login` — Done

---

## Files đã tạo/sửa (Updating)
- Tạo: `lib/supabase/{client,server,middleware}.ts`, `lib/auth/getCurrentUser.ts`
- Tạo: `supabase/schema.sql`, `supabase/seed.ts`
- Tạo: `app/(layer1)/actions.ts`, `app/(layer1)/_components/AuthForm.tsx`, `app/(layer1)/login/page.tsx`
- Sửa: `proxy.ts` (pass-through → `updateSession` + route guard)
- Sửa: `package.json` / `package-lock.json` (thêm `@supabase/ssr`, `@supabase/supabase-js`)
- `.env.local`: 3 biến Supabase (gitignored — không commit)

## Kết quả Testing
- `tsc --noEmit`: pass (exit 0).
- `next build`: pass — 7 routes, thêm `/login`; `Proxy (Middleware)` được nhận diện.
- Seed live-DB: **pass** — 10 câu hỏi + 2 đề đã vào DB (2026-06-06).
- Visual testing: bỏ qua so sánh — engineer chưa cung cấp reference image (đúng quy định WORKFLOW Bước 4).

> Lưu ý quy trình: Đọc sơ qua các md file có trong dự án để có đủ context.

---
---

# [Layer 2: Core Loop] — Task: GĐ 2 Connected Prototype (M2.5–M2.7)

- **Latest prompt:** "bắt đầu với các milestone còn lại của giai đoạn 2" (M2.5–M2.7). Engineer chốt Q1=A, Q2=A.
- **Latest step:** Git
- **Layer status:** Layer 2 Dở dang (wiring DB xong; chưa style)

### Quyết định C&D (engineer chốt)
- Q1=A: Giữ `lib/fake-data/` CHỈ làm nguồn cho `seed.ts`; gỡ mọi import trong app (app đọc 100% từ DB).
- Q2=A: `getResult` gặp attempt chưa nộp / không tồn tại → `redirect('/exams/[id]')`.
- Bảo mật: tạo `PublicQuestion = Omit<Question,'correctAnswer'>` cho client player; `correctAnswer` chỉ ở server; `computeScore` chạy server-side trong `submitExam`.
- Bỏ `submitAnswer` per-câu (đúng Q2=A batch on submit). Không cài tool mới; visual testing bỏ qua ở GĐ2.

---

## Logic Module: L2 Reads — thay fake-data (M2.5)
- **State:** Done
  + M2.5 `types/question.ts` — thêm `PublicQuestion = Omit<Question,'correctAnswer'>` — Done
  + M2.5 `app/(layer2)/queries.ts` (server-only) — `listExams()`, `getExam(id)`, `getExamForPlayer(id)` (PublicQuestion, không select correct_answer), `getResult(attemptId)` — Done
  + M2.5 Sửa `exams/page.tsx` + `exams/[id]/page.tsx` → async dùng query — Done
  + M2.5 Gỡ import fake-data khỏi app (chỉ `seed.ts` còn dùng) — Done

## Logic Module: L2 Writes — Server Actions (M2.6)
- **State:** Done
  + M2.6 `app/(layer2)/actions.ts` — `startAttempt(examId)` (insert + redirect), `submitExam(attemptId, answers)` (batch upsert answers + computeScore server-side + insert results + khóa attempt + redirect; idempotent) — Done
  + M2.6 `StartAttemptButton` → `<form action={startAttempt}>` (bỏ `crypto.randomUUID`) — Done
  + M2.6 Tách player: `attempt/[attemptId]/page.tsx` (server fetch PublicQuestion) + `_components/ExamPlayer.tsx` (client, giữ `useExamPlayer`, submit qua `useTransition`) — Done
  + M2.6 Result `page.tsx` → server component đọc `getResult` (bỏ sessionStorage + computeScore client); "Làm lại" = `<Link>` — Done
  + M2.6 `QuestionRenderer` prop → `PublicQuestion` — Done

## Logic Module: Test RLS (M2.7)
- **State:** Done
  + M2.7 `supabase/test-rls.ts` — 2 user (tạo qua Admin API, email_confirm=true), test bằng anon key + login thật — Done
  + M2.7 Chạy `npx tsx supabase/test-rls.ts` — **6/6 PASS** — Done

---

## Files đã tạo/sửa (Updating M2.5–M2.7)
- Tạo: `app/(layer2)/queries.ts`, `app/(layer2)/actions.ts`, `app/(layer2)/_components/ExamPlayer.tsx`, `supabase/test-rls.ts`
- Sửa: `types/question.ts` (+PublicQuestion), `QuestionRenderer.tsx` (prop PublicQuestion), `StartAttemptButton.tsx` (form action), `exams/page.tsx`, `exams/[id]/page.tsx`, `attempt/[attemptId]/page.tsx` (server), `attempt/[attemptId]/result/page.tsx` (server)
- Giữ nguyên: `lib/fake-data/exams.ts` (chỉ làm nguồn seed), `computeScore.ts` (tracer code, giờ chạy server-side), `useExamPlayer.ts`

## Kết quả Testing (M2.5–M2.7)
- `tsc --noEmit`: pass.
- `next build`: pass — `/exams*` chuyển sang dynamic (ƒ) vì đọc DB qua cookie.
- RLS test: **6/6 PASS** (A đọc của mình ✓, B bị chặn đọc/update attempt của A ✓, anon bị chặn questions/attempts ✓, auth đọc được questions ✓).
- Visual testing: bỏ qua (chưa có reference image, UI cố tình chưa style — đúng WORKFLOW Bước 4).

> Lưu ý quy trình: Đọc sơ qua các md file có trong dự án để có đủ context.

## ✅ Tiêu chí thoát GĐ 2 (PROJECT_ROADMAP Mục 6)
- [x] Test user đăng ký/đăng nhập được (auth M2.4 + RLS test tạo/login user).
- [x] Làm đề lấy từ DB thật (listExams/getExam/getExamForPlayer).
- [x] Attempt + điểm persist trong Supabase (startAttempt/submitExam → exam_attempts/attempt_answers/exam_results).
- [x] RLS chặn đúng giữa 2 user (6/6 pass).
- [x] **Kiểm thử thủ công end-to-end trên browser (2026-06-06):** Engineer xác nhận toàn bộ luồng chạy đúng — đăng nhập, duyệt đề từ DB, bắt đầu làm, nộp bài, kết quả persist (reload vẫn còn), "Làm lại". **GĐ 2 CONFIRMED ✅**

> **Thiếu sót nhỏ ghi nhận (xử lý ở GĐ 3):** Trang `/exams/[id]` (Detail) và Player không có nút quay lại trang trước hoặc về homepage. Điều hướng ngược chiều chưa được thiết kế ở GĐ 1–2 (chưa style, chưa có nav). Sẽ bổ sung khi làm navigation/header ở GĐ 3 — Polish.

> **Bước tiếp theo:** GĐ 3 — Polish (visual language, 3D homepage, responsive, navigation). Yêu cầu C&D riêng trước khi code.

---

*Issue (nếu có):* (đã xử lý trong lúc test) signUp dính "Email invalid" với domain example.com/không-MX, rồi "email rate limit exceeded".
*Fixing process:* Chuyển M2.7 sang tạo user bằng Admin API (`email_confirm=true`, không gửi mail) + login bằng anon key để test RLS. Pass 6/6.

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.1 Task 1 (Visual language Exam Browser)

- **Latest prompt:** "Thực hiện M3.1, task 1 đầu tiên" — chỉ milestone M3.1, bắt đầu từ Task 1. "Using all front-end skill".
- **Latest step:** Testing (build + tsc + visual browser) ✅ — chờ engineer xác nhận để Git.
- **Layer status:** Layer 2 — bắt đầu style (visual language Focused).

### Quyết định C&D (engineer chốt qua bảng Q + assets)
- Q2/Q3/Q4: Engineer **cung cấp assets riêng** trong `ASSETS/` + `TEMPLATE/`. Font dự án = **Merriweather** (variable TTF, `ASSETS/fonts/`) thay cho Inter. Models thật (AIO_PC/BOOK/PENCIL `.glb`) cho M3.3.
- Template tham chiếu: `TEMPLATE/L2/L2_mobile.png` (sidebar filter + blocks), `TEMPLATE/homepage/homepage_desktop.png` (editorial dark, mono wordmark).
- Scope đợt này: **chỉ M3.1 Task 1** — style ExamBrowser + ExamCard + ExamFilters.

### Quyết định kỹ thuật
- Font sống ở `ASSETS/` (UI-LAYER-MAP Mục 11) → **không copy vào public**; `next/font/local` trỏ `../../ASSETS/fonts/...`. Mở `turbopack.root` lên thư mục cha để next-font đọc được file ngoài SOURCE.
- Subset Geist: `latin` + `latin-ext` (Geist không có subset `vietnamese`; latin-ext phủ dấu tiếng Việt). Merriweather variable TTF phủ đầy đủ tiếng Việt.
- Visual language L2 "tờ giấy trắng / focused": nền giấy ấm nhẹ, mực mềm, 1 accent chàm tiết chế (`--brand`), hairline border, nhãn mono small-caps (`.eyebrow`), tiêu đề serif.
- Filter state ở **URL searchParams** (UI-LAYER-MAP Mục 9) → Server Component re-query DB. Chỉ lọc theo data hiện có: **Môn học + Lớp** (không dựng filter giả Trường/Năm/Mức độ chưa có trong data model).

## UI Module: Exam Browser (style) — M3.1 Task 1
- **State:** Done (chờ engineer confirm visual)
  + `app/layout.tsx` — thêm `localFont` Merriweather (`--font-merriweather`), `lang="vi"`, subset latin-ext.
  + `app/globals.css` — token `--font-serif`/`--font-heading` = Merriweather, fix `--font-sans` = Geist; `--brand` accent; palette giấy ấm/mực mềm; base typography (h1–h3 serif, `.eyebrow`).
  + `next.config.ts` — `turbopack.root` = thư mục cha (đọc font ASSETS).
  + `_components/ExamFilters.tsx` (MỚI) — client, 2 select Môn học/Lớp + "Xoá lọc", push URL qua `useTransition`.
  + `_components/ExamCard.tsx` — thẻ giấy hairline, eyebrow môn/lớp, tiêu đề serif hover→brand, meta số câu/phút.
  + `_components/ExamBrowser.tsx` — grid `sm:grid-cols-2` + empty state.
  + `exams/page.tsx` — shell 2 cột (header + aside filters sticky + grid), đọc `searchParams` (await, Next 16).
  + `queries.ts` — `listExams(filters?)` (`.eq` subject/grade) + `listExamFacets()` (distinct, sort vi).

## Kết quả Testing (M3.1 Task 1)
- `tsc --noEmit`: pass. `next build`: pass (7 routes; font ASSETS resolve OK).
- **Visual (browser, đăng nhập test user `+rlstesta`):** /exams render đúng — nền giấy, serif Merriweather có dấu tiếng Việt chuẩn, eyebrow mono, 2 cột, cards hairline. Filter Môn học=Toán → URL `?subject=Toán`, lưới còn 1 đề, hiện "Xoá lọc". **0 console errors.**
- **⚠️ Gotcha Turbopack dev:** chạy `next build` rồi `npm run dev` chung `.next` → 500 `loadFontManifest: Unexpected end of JSON input` (font manifest rỗng). Fix: xoá `.next` rồi `dev` lại. Build production không dính.

> **Còn lại của M3.1 (session sau):** Task 2 QuestionRenderer/AnswerChoice (focus mode), Task 3 ExamTimer/QuestionPagination/FlagButton, Task 4 ScoreCard/TopicBreakdown, Task 5 markdown + LaTeX. Component ExamTimer/FlagButton chưa tồn tại — sẽ tạo khi tới task đó.

*Issue (engineer feedback — làm lại M3.1 Task 1):* Bản đầu sai **triết lý mobile-first** (chỉ verify desktop) + **sai bố cục** so với `TEMPLATE/L2/L2_mobile.png`: thiếu header (logo + dropdown menu), thiếu **toggle ▶/▼ ẩn/hiện bảng lọc** (tam giác đen = toggle button), filter dùng native select thay vì panel collapsible. Screenshot lưu sai chỗ (repo root thay vì `TEMP_SCREENSHOT/`).
*Fixing process (Done — visual confirm browser 2026-06-07):*
- **Mobile-first**: thiết kế/verify từ 375px trước; trên mobile bảng lọc **collapse mặc định** (content full-width), nút "Bộ lọc" ▼ mở ra; lg: bảng lọc thành sidebar luôn hiện (master toggle `lg:hidden`).
- `_components/SiteHeader.tsx` (MỚI, client) — header sticky nền trắng: logo "Trạng Nguyên" (serif, → `/`) + dropdown menu (Trang chủ / Đề luyện / Đăng xuất qua `signOut` Server Action L1, backdrop bắt click ngoài).
- `_components/ExamFilters.tsx` (viết lại) — master toggle ẩn/hiện cả bảng lọc + mỗi filter là **accordion** (▼ toggle "ẩn hiện bảng chọn"), option dạng list chọn được (active = màu brand + gạch). Bỏ native select.
- `exams/page.tsx` (viết lại) — SiteHeader + body mobile-first (1 cột → `lg:grid-cols-[220px_1fr]`).
- **Nền trắng**: màu bg trong template (xanh/vàng/đỏ) chỉ tượng trưng — giữ paper trắng, hairline; KHÔNG fill màu.
- Screenshot đúng chỗ: `TEMP_SCREENSHOT/exam-browser-{mobile,mobile-filter-open,desktop,desktop-menu}.png`.
- Verify: 375px (header + filter collapse + cards 1 cột; mở filter → accordion Môn học/Lớp; chọn Toán → URL `?subject=Toán` → còn 1 đề + "Xoá lọc") và 1280px (header full-width, sidebar lọc + grid 2 cột, dropdown menu mở đúng). `tsc`/`build` pass. **0 console errors.**
- ⚠️ Font Merriweather giữ nguyên (engineer chỉ định) — tiếng Việt có dấu render chuẩn ở cả serif/sans/mono (latin-ext).

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.1 Task 1 (LÀM LẠI lần 2 — overlay filter)

- **Latest prompt:** "M3.1 phải làm lại vì sai yêu cầu phiên trước." Engineer gửi lại template `L2_mobile.png` + giải thích + #Yêu cầu chi tiết. Chốt: navbar + filter đều sticky (toàn bộ nội dung bên trong); filter **overlay đè lên** danh sách đề (không đẩy block sang bên); mọi toggle mở ra **bảng chọn overlay không làm xê dịch bố cục** phần tử khác; dùng **rgba trong source** làm nổi bật Filter khi mở; **không thêm bg color** ngoài rgba được cấp; nút tam giác đen thuộc về *Filter (master toggle). "Sử dụng front-end skill". "Bắt đầu code".
- **Latest step:** Testing ✅ (tsc + build + visual mobile browser) — **chờ engineer xác nhận visual để Git** (milestone này làm lại do bị từ chối visual lần trước → không auto-Git).
- **Layer status:** Layer 2 — style lại (visual language Focused, mobile-only verify).

### Quyết định C&D (engineer chốt)
- Q1 (6 filter vs 2 field DB): hiển thị đủ 6 filter ở mức **tượng trưng** (Môn học + Lớp có data thật & lọc URL; Trường/Năm/Học kỳ/Mức độ symbolic — data thêm ở milestone sau).
- Q2=B: giữ `exam.title` nguyên (không dựng "môn + học kì + năm"); block hiển thị title + nội dung tượng trưng (Trường, Mức độ).
- Sticky: áp dụng cho **toàn bộ** nội dung navbar và *Filter.
- Toggle = overlay (absolute/fixed, ngoài flow) → mở không đẩy phần tử khác (kể cả filter khác).
- *Filter mở = overlay đè exam list + **rgba** highlight (panel sheet trắng rgba + scrim rgba dim list).
- Không bg color mới (chỉ rgba được cấp + token paper/card/hairline sẵn có). Không có "front-end skill" cài đặt → áp dụng best practices thủ công.

## UI Module: Exam Browser (style lại — overlay filter) — M3.1 Task 1
- **State:** In Progress
  + `ExamFilters.tsx` — viết lại: master toggle tam giác đen (▶→▼, thuộc *Filter) + panel overlay (absolute, rgba sheet) + 6 filter row (mỗi row toggle mở options dạng overlay absolute, không xê dịch); scrim rgba fixed dim list; sticky `top-14`.
  + `exams/page.tsx` — bỏ lg sidebar grid; stack dọc: header → ExamFilters (sticky overlay) → ExamBrowser. max-w hẹp (focused).
  + `ExamBrowser.tsx` — danh sách block dọc 1 cột (khớp template mobile).
  + `ExamCard.tsx` — block: title (serif) + nội dung tượng trưng (Trường/Mức độ) + meta thật (môn/lớp, câu/phút).

## Kết quả Testing (M3.1 Task 1 — làm lại)
- `tsc --noEmit`: pass. `next build`: pass (7 routes).
- **Visual (browser mobile 375×812, /exams):** khớp template + #Yêu cầu:
  - Navbar sticky (logo "Trạng Nguyên" + dropdown Menu).
  - Master toggle tam giác đen "▶ BỘ LỌC" → mở "▼", sticky `top-14`.
  - Mở *Filter: panel rgba sheet trắng **đè lên** danh sách đề (block Vật Lý mờ phía sau qua scrim rgba — KHÔNG bị đẩy sang bên); 6 filter (Môn học, Lớp, Trường, Năm, Học kỳ, Mức độ).
  - Mở "Môn học": bảng chọn overlay (absolute) phủ lên Trường/Năm — Học kỳ/Mức độ **không xê dịch** (đúng yêu cầu "không ảnh hưởng bố cục").
  - Lọc chạy: `?subject=Toán` → 1 đề; `?subject=Vật Lý` → 1 đề; master hiện "Bộ lọc · đang lọc" + "Xoá lọc"; sub-panel tự đóng sau khi chọn.
  - **0 console errors** (chỉ warning preload font/css — Next dev, vô hại).
- Screenshot: `TEMP_SCREENSHOT/m3.1-redo-mobile-{1-collapsed,2-filter-open,3-monhoc-open,4-after-select}.png`.
- ⚠️ MCP `browser_click` báo timeout 5s (quirk RPC) nhưng click vẫn vào — xác nhận bằng `browser_evaluate` (click option → URL đổi đúng).

### Sửa lần 2 (engineer feedback)
*Issue:* (1) Tự thêm tiêu đề trang "Chọn đề luyện" — template không có → bỏ. (2) *Filter đặt sai chỗ: đang là thanh ngang phía trên list; phải nằm BÊN TRÁI cạnh list + đè lên list khi mở; cả block *Filter phải `sticky` để đi theo khi cuộn.
*Fixing process:*
- `exams/page.tsx` — bỏ hẳn `<header>` tiêu đề; layout `flex items-start`: ExamFilters (trái) | exam list (`flex-1`).
- `ExamFilters.tsx` — đổi sang **tay nắm mảnh bên trái** (tam giác đen ▶ + nhãn dọc "BỘ LỌC", chấm brand khi đang lọc), `sticky top-14`. Mở → panel `absolute left-0 top-0 w-[84vw]` đè lên list (rgba sheet + scrim). Bỏ `overflow-y-auto` ở panel (tránh clip sub-panel overlay).

## Kết quả Testing (sửa lần 2 — browser mobile 375×812)
- `tsc` pass. `next build` pass (7 routes). **0 console errors**.
- **Đóng:** không còn tiêu đề trang; tay nắm *Filter mảnh bên trái (▶ + "BỘ LỌC" dọc) cạnh exam list — khớp template.
- **Mở:** panel đè lên list (block Vật Lý mờ sau scrim rgba), 6 filter; chọn Toán → `?subject=Toán`.
- **Sticky (kiểm bằng JS):** cuộn `scrollY=700` → tay nắm vẫn ghim `top=56px` (đi theo user). `getComputedStyle.position='sticky'`.
- **Overlay không xê dịch:** mở Môn học → options phủ lên Lớp/Trường/Năm; Học kỳ/Mức độ KHÔNG bị đẩy.
- Screenshot: `TEMP_SCREENSHOT/m3.1-redo2-mobile-{1-collapsed,2-filter-open,4-monhoc-open}.png` (ảnh sticky-scrolled bỏ vì DOM clone bị React reconcile — sticky đã xác minh bằng JS).
- **Engineer xác nhận visual ✅ (2026-06-08)**
- **Git: commit `57c403a`, push lên main ✅ (2026-06-08)**
  - Staged: `SOURCE/app/(layer2)/_components/` (4 file), `SOURCE/app/(layer2)/exams/page.tsx`, `SOURCE/app/(layer2)/queries.ts`, `SOURCE/app/globals.css`, `SOURCE/app/layout.tsx`, `SOURCE/next.config.ts`, `ASSETS/` (fonts + models 3D).
  - **KHÔNG stage:** MD file, screenshot, `.claude/`, `.mcp.json`, `TEMPLATE/`, `TEXT/`. Rule này áp dụng cho mọi Git step về sau.
- **M3.1 Task 1 — DONE ✅**

> **Bước tiếp theo (M3.1 còn lại):**
> - Task 2: Style `QuestionRenderer` + `AnswerChoice` (focus mode — exam player)
> - Task 3: Style `ExamTimer` + `QuestionPagination` + `FlagButton` (ExamTimer/FlagButton chưa tồn tại — sẽ tạo)
> - Task 4: Style `ScoreCard` + `TopicBreakdown`
> - Task 5: Markdown + LaTeX rendering cho nội dung câu hỏi

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.1 Task 2 (Style Exam Player — focus mode)

- **Latest prompt:** "Go on the next task" → Task 2. Engineer chốt "Có chức năng như agent đề nghị" + "Bắt đầu code". (Trước đó: bỏ block "5 câu · 15 phút" khỏi ExamCard.)
- **Latest step:** Testing (tsc + build pass) — **chờ engineer xác nhận visual để Git** (milestone UI → không auto-Git, theo pattern Task 1).
- **Layer status:** Layer 2 — tiếp tục style (visual language Focused).

### Quyết định C&D (engineer chốt)
- Approach style như agent đề xuất: ExamPlayer shell (SiteHeader + top bar tiến độ sticky + cột hẹp) · QuestionRenderer (eyebrow mono + nội dung serif) · AnswerChoice (card hairline, radio ẩn, nhãn A/B/C/D mono, selected = brand) · QuestionPagination (ô vuông trạng thái chưa làm/đã làm/đang xem + prev/next minimal).
- Timer + Flag để dành **Task 3** (câu hỏi hành vi timer-hết-giờ vẫn mở).

## UI Module: Exam Player (style) — M3.1 Task 2
- **State:** Done (chờ engineer confirm visual)
  + `_components/AnswerChoice.tsx` — viết lại: card hairline, `<input radio>` `sr-only` (giữ a11y), nhãn chữ cái mono, selected = `border-brand bg-brand/8`, hover = `border-brand/40 bg-accent`.
  + `_components/QuestionRenderer.tsx` — eyebrow "Câu N / M", nội dung `font-serif text-xl leading-relaxed`, fieldset bỏ border, legend sr-only.
  + `_components/QuestionPagination.tsx` — ô vuông `size-9`: đang xem = brand solid, đã làm = `bg-brand/8` viền brand mờ, chưa làm = hairline; prev/next text minimal disabled mờ.
  + `_components/ExamPlayer.tsx` — thêm `SiteHeader`; top bar sticky `top-14`; `main` cột `max-w-2xl` căn giữa; nút "Nộp bài" nền brand; "còn N câu" nhấn số.
  + `_components/ExamCard.tsx` — gỡ block meta "N câu · N phút" (engineer yêu cầu) — `Exam` type + queries giữ nguyên `durationMinutes` (cần cho ExamTimer Task 3).

### Sửa theo feedback engineer (screenshot review)
*Issue:* (1) Top bar dưới navbar lặp "Câu n/N" cạnh tên đề → bỏ. (2) Bỏ 2 nút "Câu trước"/"Câu sau" (điều hướng chỉ qua ô số). (3) Tên đề căn giữa block top bar.
*Fixing process:*
- `ExamPlayer.tsx` — top bar bỏ span "Câu N / M", đổi `justify-between` → `justify-center` (tên đề căn giữa). Bỏ destructure `next`/`prev` khỏi `useExamPlayer` + bỏ prop `onPrev`/`onNext` truyền xuống.
- `QuestionPagination.tsx` — gỡ hẳn 2 nút prev/next + 2 prop `onPrev`/`onNext` khỏi interface; chỉ còn lưới ô số (`onJump`). `useExamPlayer` vẫn export `next`/`prev` (không dùng — vô hại).
- `tsc` pass, `next build` pass (7 routes).

## Kết quả Testing (M3.1 Task 2)
- `tsc --noEmit`: pass. `next build`: pass (7 routes, không đổi).
- **Visual:** Playwright MCP chưa cấu hình trong session này + không có reference image riêng cho màn Player → bỏ qua bước chụp tự động (đúng WORKFLOW Bước 4). Chờ engineer xác nhận visual trên browser trước khi Git.

> **Còn lại M3.1:** Task 3 (ExamTimer + FlagButton — cần chốt hành vi timer hết giờ), Task 4 (ScoreCard + TopicBreakdown), Task 5 (markdown + LaTeX).

> **Task 2 — Git: commit `9bc5e86`, push main ✅.** Staged 5 component (AnswerChoice, ExamCard, ExamPlayer, QuestionPagination, QuestionRenderer). KHÔNG stage MD/TEXT/.claude/TEMPLATE. **Task 2 DONE ✅.**

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.1 Task 3 (ExamTimer + FlagButton)

- **Latest prompt:** "Chọn phương án của agent cho bộ đếm thời gian" + "Bắt đầu code".
- **Latest step:** Testing (tsc + build pass) — **chờ engineer xác nhận visual để Git**.
- **Layer status:** Layer 2 — tiếp tục style.

### Quyết định C&D (engineer chốt)
- Timer hết giờ → **PA A (auto-submit)**: đồng hồ về 0 tự gọi `submitExam()`. Đúng hành vi phòng thi.
- FlagButton: đánh dấu câu để xem lại — state in-memory trong `useExamPlayer` (không persist DB, đúng "local UI state" UI-LAYER-MAP Mục 9).
- Vị trí top bar: timer (trái) · tên đề (giữa, giữ căn giữa engineer đã yêu cầu) · flag (phải) — grid 3 cột `[1fr_auto_1fr]`.

## Logic Module: Exam Player State (mở rộng)
- **State:** Done
  + `hooks/useExamPlayer.ts` — thêm `flags: Record<string,true>` + action `TOGGLE_FLAG`, expose `flags`/`toggleFlag`. Giữ next/prev (không dùng — vô hại).

## UI Module: Exam Player — Timer + Flag (M3.1 Task 3)
- **State:** Done (chờ engineer confirm visual)
  + `_components/ExamTimer.tsx` (MỚI) — client, đếm ngược từ `durationMinutes` bằng `setTimeout` từng giây; chạm 0 → `onTimeUp()` đúng 1 lần (2-effect pattern, callback giữ trong ref → dùng answers mới nhất). MM:SS mono, đổi màu `destructive` ở phút cuối, KHÔNG nhấp nháy.
  + `_components/FlagButton.tsx` (MỚI) — client, toggle flag câu hiện tại; cờ tô đặc + chữ mono, active = brand. Controlled qua flagged/onToggle.
  + `_components/QuestionPagination.tsx` — thêm prop `flaggedIndices`; ô câu đã flag có chấm brand góc trên-phải (ring nền).
  + `_components/ExamPlayer.tsx` — nhận `durationMinutes`; top bar grid 3 cột (timer/tên đề/flag); `submittedRef` chống nộp trùng (nút thủ công + auto-submit); truyền flags xuống Pagination.
  + `exams/[id]/attempt/[attemptId]/page.tsx` — truyền `durationMinutes={data.exam.durationMinutes}`.

## Kết quả Testing (M3.1 Task 3)
- `tsc --noEmit`: pass. `next build`: pass (7 routes, không đổi).
- **Visual:** chờ engineer xác nhận trên browser (pattern milestone style). Lưu ý: timer 15:00 đếm ngược; auto-submit chỉ kích khi về 00:00.

> **Còn lại M3.1:** Task 4 (ScoreCard + TopicBreakdown), Task 5 (markdown + LaTeX).

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.1 Task 4 + 5 (Result page + Markdown/LaTeX)

- **Latest prompt:** "Hoàn thành hai task còn lại của M3.1. Bắt đầu code." (model Opus). Trước đó C&D qua template `TEMPLATE/L2/resultpage_L2_mobile.png` + 6 câu hỏi engineer chốt.
- **Latest step:** ✅ **DONE — đã Git commit `35c1811`** (S#13, 2026-06-13).
- **Layer status:** Layer 2 — tiếp tục style (visual language Focused).

### Quyết định C&D (engineer chốt qua bảng Q1–Q6)
- Q1: Score summary (tên đề, câu đúng/sai, thời gian hoàn thành) — **tượng trưng**, chưa persist thời gian thực.
- Q2: Topic breakdown — nhãn theo `topic` của câu hỏi (vd "Câu đạo hàm") — **tượng trưng**.
- Q3: 2 ô cạnh block topic = **Save PDF** (icon trống + chữ `<save>`) + **Share** (icon trống + chữ `share`) — placeholder, chưa có function.
- Q4: "Trở về homepage" → route `/` (trang placeholder hiện có; L1 style sau).
- Q5: "Chi tiết" → **page riêng** (`result/detail`) hiển thị đúng/sai từng câu — bố cục tự thiết kế, nhất quán L2.
- Q6: Màu template chỉ tượng trưng → giữ nền giấy trắng + accent tiết chế (không fill đỏ/vàng/xanh).

### Quyết định kỹ thuật
- Markdown + LaTeX: dùng `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `katex` (chuẩn hệ sinh thái). Component dùng chung `components/shared/RichText.tsx` (client) — import `katex/dist/katex.min.css`.
- `getResult` mở rộng: trả `questions: Record<id, {content, choices}>` (thay `questionContent` map string) để Detail page render đủ nội dung + lựa chọn.
- Detail page route con: `/exams/[id]/attempt/[attemptId]/result/detail` (server component, đọc `getResult`).

## UI Module: Result Page (M3.1 Task 4)
- **State:** Done (chờ engineer confirm visual)
  + `ScoreCard.tsx` — block "tờ giấy": eyebrow + tên đề serif + điểm lớn /10 (brand) + dl 3 cột đúng/sai/thời gian (thời gian = "—" tượng trưng) — Done
  + `TopicBreakdown.tsx` — list chủ đề "Câu <topic>" + thanh tiến độ brand (correct/total) — Done
  + `ResultActions.tsx` (MỚI) — 2 ô vuông Save/Share: icon trống (ô hairline) + nhãn mono "save"/"share", `disabled` (chưa có function — Q3) — Done
  + `result/page.tsx` — redesign: SiteHeader + ScoreCard + grid [TopicBreakdown | (Save/Share + Trở về trang chủ)] + nav 2 cột (Xem chi tiết brand → detail / Làm lại) — Done
  + `result/detail/page.tsx` (MỚI) — chi tiết từng câu: status Đúng/Sai/Bỏ trống; mỗi lựa chọn tô đáp án đúng (brand) + đáp án chọn sai (destructive) + tag; ← Quay lại kết quả — Done

## UI Module: Markdown + LaTeX (M3.1 Task 5)
- **State:** Done
  + `components/shared/RichText.tsx` (MỚI) — react-markdown + remark-gfm + remark-math + rehype-katex + katex CSS; prop `inline` (p→fragment) cho nhãn lựa chọn — Done
  + `QuestionRenderer.tsx` — content dùng `<RichText>` (block) — Done
  + `AnswerChoice.tsx` — text lựa chọn dùng `<RichText inline>` — Done
  + (Detail page cũng dùng RichText cho content + choices.)

## Logic Module: getResult mở rộng
- **State:** Done
  + `queries.ts` — `getResult` trả `questions: Record<id, {content, choices}>` (thay `questionContent` map string); select thêm `choices`; import `Choice` type — Done

## Kết quả Testing (M3.1 Task 4 + 5)
- `npm install react-markdown remark-gfm remark-math rehype-katex katex`: +121 packages (lần đầu fail ECONNRESET → cài lại OK).
- `tsc --noEmit`: pass (exit 0).
- `next build`: pass — **8 routes**, thêm `/exams/[id]/attempt/[attemptId]/result/detail`.
- Đã `rm -rf .next` sau build (tránh gotcha font manifest khi `npm run dev`).
- **Visual (Playwright MCP, 390px, login test user `+rlstesta`):**
  + Result page: bố cục khớp `resultpage_L2_mobile.png` — block điểm; [chủ đề | (save/share đỉnh + Trang chủ đáy)]; [Xem chi tiết | Làm lại]. **0 console errors.**
  + Detail page: từng câu status Đúng/Bỏ trống, đáp án đúng tô brand + tag "ĐÁP ÁN ĐÚNG", "← Quay lại kết quả". **0 console errors.**

### Sửa sau review engineer (vòng 1)
- Nút trở về: text "Trở về trang chủ" → **"Trang chủ"** (1 dòng, không wrap).
- Bố cục nút Trang chủ chưa khớp template → cột phải `items-stretch` + `justify-between`: save/share canh **đỉnh**, "Trang chủ" canh **đáy** (thẳng đáy block chủ đề) — đúng template.
- Đã so trực tiếp page hiện tại vs template qua Playwright, lặp tới khi khớp.

> **M3.1 — hoàn tất Task 1–5, visual đã verify bằng Playwright.** Chờ engineer xác nhận lần cuối → Git.

---
---

# [Layer 2: Core Loop] — Task: GĐ 3 Polish — M3.2 Responsive Layer 2 (Task 1–3)

- **Latest prompt:** "Bắt đầu thực hiện M3.2 (tất cả task)." Engineer chốt Q1=A, Q2=A, Q3=A (model Opus).
- **Latest step:** Testing ✅ (tsc + build + visual Playwright mobile 390 / desktop 1280) — **chờ engineer xác nhận visual để Git** (pattern milestone UI).
- **Layer status:** Layer 2 — responsive (visual language Focused giữ nguyên).

### Quyết định C&D (engineer chốt)
- Q1=A: Swipe = **touch events thuần** (`useSwipe` hook, không thêm dependency). Đúng tinh thần "chuyển câu instant, không animation thừa" (UI-LAYER-MAP 4.2).
- Q2=A: Style luôn trang **Exam Detail** (`/exams/[id]`) — đang còn ở trạng thái GĐ 1 (xấu), nằm giữa Browser→Player nên không thể bỏ sót khi test mobile.
- Q3=A: Desktop giữ lưới ô số pagination + thêm **keyboard nav** (← →); mobile dùng swipe + vẫn giữ lưới ô số.

## Logic/Hook Module: Swipe + Keyboard nav (M3.2 Task 1)
- **State:** Done
  + `hooks/useSwipe.ts` (MỚI) — touch events, chỉ tính swipe khi vuốt ngang vượt ngưỡng 50px VÀ trội hơn vuốt dọc (không nuốt cuộn trang); không preventDefault. Trả props `{onTouchStart,onTouchEnd}`. — Done
  + `_components/ExamPlayer.tsx` — destructure `next`/`prev` từ `useExamPlayer`; gắn `useSwipe({onSwipeLeft:next,onSwipeRight:prev})` lên div bọc QuestionRenderer; `useEffect` keydown ← → (bỏ qua khi focus ở INPUT/TEXTAREA để radio group dùng mũi tên chọn A/B/C/D bình thường). — Done

## UI Module: Exam Detail style + breakpoints (M3.2 Task 2)
- **State:** Done (chờ engineer confirm visual)
  + `exams/[id]/page.tsx` (viết lại) — visual language L2: SiteHeader + back link "← Tất cả đề" (bù thiếu sót nav ghi nhận từ GĐ 2) + eyebrow môn/lớp + tiêu đề serif + 2 ô meta (số câu/thời gian) + đoạn dẫn + nút brand. `max-w-xl`, mobile-first. — Done
  + `_components/StartAttemptButton.tsx` — style brand, `w-full` mobile → `sm:w-auto` desktop. — Done

## Testing thiết bị (M3.2 Task 3)
- **State:** Done (screenshot chuẩn bị cho engineer test Android thật)
  + Screenshot `TEMP_SCREENSHOT/m3.2-*.png` (mobile 390 + desktop 1280) cho Detail/Player/Result.

## Kết quả Testing (M3.2)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes (không đổi). Đã `rm -rf .next` sau build.
- **Visual (Playwright, login test user `+rlstesta`):**
  + **Swipe** (dispatch TouchEvent trên vùng câu hỏi): vuốt trái Câu 1→2 ✓, vuốt phải 2→1 ✓.
  + **Keyboard:** ArrowRight 1→2 ✓; ArrowLeft 2→1 ✓; **guard** — ArrowRight khi target=radio KHÔNG chuyển câu (giữ ở Câu 2) ✓.
  + **Detail page** 390 + 1280: bố cục L2 đúng (back link, eyebrow, tiêu đề serif, 2 ô meta, nút brand full→auto). ✓
  + **Player** 390 + 1280: top bar timer·tên đề·flag, focus mode cột hẹp, không vỡ. ✓
  + **Result** 390 + 1280: constrained max-w-xl, không vỡ. ✓
  + **0 console errors** (2 warning preload font — Next dev, vô hại).

> **Còn lại GĐ 3 sau M3.2:** M3.3 Homepage 3D (Three.js, model `.glb`), M3.4 Mobile fallback, M3.5 Personalization, M3.6 Transitions & SEO + Lighthouse.

---
---

# [Layer 1: Entry] — Task: GĐ 3 Polish — M3.3 Homepage 3D

- **Latest prompt:** "Bắt đầu thực hiện toàn bộ task của M3.3" (model Opus). C&D chốt qua bảng Q1–Q5.
- **Latest step:** ✅ **DONE — Git commit `e094bc5`, push main** (2026-06-14).
- **Layer status:** Layer 1 — homepage style xong (editorial dark + 3D).

### Quyết định C&D (engineer chốt)
- Q1: Navbar L1 **kế thừa `SiteHeader` của L2** (không viết lại). → header trắng sticky trên nền hero tối (tương phản editorial).
- Q2: Bấm máy AIO → dẫn thẳng `/exams` (Exam Browser; proxy tự đẩy `/login` nếu chưa auth).
- Q3: **Bỏ** 3 feature columns dưới fold (không dùng).
- Q4=A: Nền tối riêng cho homepage (`#0d0d11`), tách khỏi visual L2 giấy trắng.
- Q5=A: M3.3 chỉ desktop; mobile fallback để M3.4.

### Quyết định kỹ thuật
- Stack: `three@0.184` + `@react-three/fiber@9` (React 19) + `@react-three/drei@10`. Cài thêm `@types/three` (dev).
- Model `.glb` cần serve runtime cho `useGLTF` → **copy** `ASSETS/models/*/source/*.glb` sang `SOURCE/public/models/` (AIO `all_in_one_pc.glb`, BOOK `stack_of_books.glb`, PENCIL `Pencil.glb`). Textures **embedded** trong .glb (self-contained, không cần copy textures riêng).
- `proxy.ts` matcher sửa loại trừ path có phần mở rộng (`.*\\..*`) → `/models/*.glb` không bị route guard đẩy `/login` (homepage là public, khách chưa auth vẫn xem được scene).
- SSR: Canvas WebGL chỉ mount client → `Homepage3D` (client) dùng `next/dynamic(ssr:false)` nạp `Scene3D`.
- Layout: hero cần **chiều cao tường minh** `h-[calc(100dvh-3.5rem)]` (header h-14) — flex-1 không đủ tin cậy cho R3F đo parent (lần đầu canvas chỉ cao 150px).

## UI Module: Homepage 3D (M3.3)
- **State:** Done (chờ engineer confirm visual)
  + `app/(layer1)/_components/Scene3D.tsx` (MỚI) — Canvas dark `#0d0d11`; ambient + 1 directional key light đổ bóng (orthographic shadow-camera); bàn gỗ dựng từ box geometry (mặt bàn y=0 + 4 chân kim loại); sàn tối hứng bóng; `Model` helper chuẩn hoá .glb (xoay→scale theo target→căn tâm x/z + đặt đáy chạm bàn); AIO giữa (clickable → `router.push('/exams')` + cursor pointer + pointLight xanh nhạt mô phỏng màn hình sáng); BOOK phải, PENCIL trái; `ContactShadows` mềm; `Suspense` fallback "Đang tải…".
  + `app/(layer1)/_components/Homepage3D.tsx` (MỚI) — client wrapper, `dynamic(ssr:false)` nạp Scene3D (loading "Đang dựng cảnh…").
  + `app/page.tsx` (viết lại) — `SiteHeader` + `<main>` nền tối + hero `h-[calc(100dvh-3.5rem)]` chứa Homepage3D + CTA "Nhấn vào màn hình để bắt đầu" (Link `/exams`, fallback a11y/non-WebGL).
  + `proxy.ts` — matcher loại trừ static file có phần mở rộng.
  + `public/models/` (MỚI) — 3 .glb copy từ ASSETS.

## Kết quả Testing (M3.3)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes; homepage `/` **static (○)**.
- Đã `rm -rf .next` trước `npm run dev` (gotcha font manifest).
- **Visual (Playwright desktop 1280×800, /):**
  + Scene render khớp `homepage_desktop.png`: phòng tối, bàn gỗ chân kim loại, máy AIO màn hình sáng (kèm chuột — bonus từ model), bút đỏ trái, chồng sách xanh phải, CTA mono dưới. Canvas 1265×744.
  + **Click máy AIO** (dispatch PointerEvent giữa canvas): raycast bắt đúng mesh → điều hướng `/exams` ✓ (session còn → không qua `/login`).
  + **0 console errors** (4 warning: THREE.Clock/PCFSoftShadowMap deprecated nội bộ three + preload font Merriweather — đều vô hại).
- Screenshot: `TEMP_SCREENSHOT/m3.3-homepage-desktop.png`.

### 🐛 Bug fix (engineer report — hover làm model nhảy loạn / sách biến mất)
*Nguyên nhân:* `Model` áp `scale`/`position` trực tiếp lên chính `scene` qua `<primitive object={scene} scale position>`, nhưng `useMemo` cũng đo `Box3.setFromObject(scene)` trên scene đó → mỗi re-render (hover đổi state) đo lại trên scene đã biến đổi của lần trước → **cộng dồn** → scale/tọa độ nhảy loạn, sách scale về ~0 nên biến mất, bút phình to. Thêm: prop `rotation` là array literal → reference mới mỗi render → recompute liên tục.
*Sửa:* Tách *đo* khỏi *áp transform* — reset `scene.position/scale` về gốc trước khi đo (chỉ bake rotation); scale/offset áp lên **group bọc ngoài**, không đụng transform của `scene`. Deps useMemo dùng số `rx,ry,rz` thay array. **Verify Playwright: bắn 30 pointermove lên AIO → scene ổn định tuyệt đối (sách còn, bút đúng cỡ, không nhảy), 0 console errors.**

### 🐛 Bug fix 2 (engineer report — scrollbar dọc + object quá gần camera)
*Scrollbar:* hero tính `calc(100dvh-3.5rem)` nhưng header có `border-b` 1px → cao 57px (không phải 56) → tổng trang = 100dvh + 1px → tràn 1px. *Sửa:* bỏ calc thủ công, bọc homepage trong `div.flex.h-[100dvh].flex-col.overflow-hidden`, header trong flow + `main.flex-1.min-h-0` (Canvas vẫn có chiều cao xác định). Verify `scrollHeight - clientHeight = 0`.
*Object quá gần:* kéo camera lùi `position z 3.9 → 4.7` (giữ fov 38) → toàn cảnh lùi xa, nhỏ lại, nhiều khoảng thở, chân bàn hiện đủ. Verify screenshot 1280×800, 0 console errors.

### ✨ Bổ sung ánh sáng (engineer yêu cầu — qua vài vòng)
- **Directional light top-down**: đổi vị trí `[3.5,6,4] → [0,9,-1.5]`, intensity `1.5 → 2.1` — chiếu gần thẳng từ trên xuống mặt bàn, hơi nghiêng về camera để bóng đổ ra trước (thấy độ sâu).
- **Bóng đậm hơn (nổi khối)**: `ambientLight 0.28 → 0.18` + `ContactShadows opacity 0.45 → 0.85`, `far 3 → 1.3`.
- **Đèn trần bóng sợi đốt**: đã thêm `PendantLamp` (dây + đui + quả cầu emissive + pointLight ấm) rồi **engineer yêu cầu BỎ** — đã gỡ hẳn component + usage, chỉ giữ directional light. Scene cuối: directional top-down + ambient + pointLight xanh màn hình.

### Điểm cần engineer review
- **Header trắng trên nền tối**: đúng quyết định Q1 (kế thừa SiteHeader, không viết lại) → tương phản mạnh. Nếu muốn header tối hơi hoà với hero thì là thay đổi riêng (sẽ phải sửa/biến thể SiteHeader — ngoài "không viết lại").
- **Sách màu xanh bão hoà**: là texture embedded của model, hơi nổi so với tông editorial trầm của template. Giữ nguyên asset; có thể override material nếu engineer muốn dịu lại.
- Màn hình AIO chưa có hiệu ứng bloom (đốm sáng) như template — cần postprocessing (`@react-three/postprocessing`), để dành nếu engineer yêu cầu.

> **Còn lại GĐ 3:** M3.4 Mobile fallback (ảnh tĩnh + parallax thay 3D nặng trên mobile), M3.5 Personalization, M3.6 Transitions & SEO + Lighthouse.

---
---

# [Layer 1: Entry] — Task: GĐ 3 Polish — M3.4 Homepage Mobile Fallback

- **Latest prompt:** "Tiếp tại nơi đã dừng trong PROCESS.md. Thực hiện M3.4." (model Opus). Trước đó cùng phiên engineer yêu cầu sửa desktop hover (scale Mac + biến CTA tĩnh thành CTA hover) — đã xong, engineer xác nhận "Hoạt động ổn".
- **Latest step:** Testing ✅ (tsc + build pass) — ⚠️ **Visual chưa ổn — engineer xem trên browser và từ chối, sẽ sửa lại phiên sau.** Chưa Git.
- **Layer status:** Layer 1 — thêm nhánh mobile (visual language Spatial/2.5D thay 3D).

### Quyết định C&D (engineer chốt — bảng Q1–Q5)
- Q1=A: Dựng fallback 2.5D bằng **CSS/HTML layers** (tái hiện bàn+Mac+đạo cụ editorial tối), KHÔNG cần ảnh tĩnh mới (ASSETS/images rỗng, không có template mobile).
- Q2=A: Ngưỡng load 3D = `≥1024px` (`lg`) + có WebGL → 3D; còn lại (kể cả tablet) → 2.5D.
- Q3=A: Parallax theo **cuộn + di con trỏ/ngón** (pointermove), **BỎ** gyroscope (optional, tránh popup quyền iOS).
- Q4=Bỏ qua: sticky notes để dành M3.5 (cần account/DB). M3.4 chỉ scene + CTA.
- Q5=A: Tự thiết kế theo visual language L1, **không cần screenshot lại** (không có template mobile để so).

### Quyết định kỹ thuật
- **Three.js KHÔNG nạp trên mobile** ⇒ không dùng CSS `hidden` (component vẫn mount → `dynamic()` vẫn tải chunk). Branch bằng JS: `HomepageStage` (client) đọc `matchMedia('(min-width:1024px)')` + check WebGL sau hydrate → chỉ mount `Homepage3D` khi đủ điều kiện; ngược lại `HomepageMobile`.
- SSR/first paint render nhánh mobile (HTML/CSS thuần, nhẹ, tốt SEO, không layout shift trên Android); desktop swap sang 3D sau mount.
- Parallax dùng **CSS variables** (`--px`/`--py`) ghi qua ref + throttle rAF (tránh re-render React mỗi pointermove — quan trọng cho Android tầm trung). Layer transform `translate3d(calc(var(--px)*Npx)...)`, transition mượt.

## UI Module: Homepage Mobile (M3.4)
- **State:** Done (chờ engineer confirm visual)
  + `hooks/useParallax.ts` (MỚI) — `usePointerParallax<T>()`: ghi `--px`/`--py` ∈ [-1,1] theo vị trí con trỏ/ngón trong phần tử, throttle rAF, reset khi rời (pointerleave/up/cancel). — Done
  + `app/(layer1)/_components/HomepageMobile.tsx` (MỚI) — scene 2.5D editorial tối: lớp tường/glow/bàn gỗ/bóng/Mac(màn hình sáng)/sách/bút parallax theo độ sâu (3→16px) + vignette tĩnh + khối CTA tĩnh ghim đáy ("Vào học →" Link `/exams`, eyebrow). `<h1 sr-only>` gánh SEO. CSS var qua `as CSSProperties`. — Done
  + `app/(layer1)/_components/HomepageStage.tsx` (MỚI) — branch desktop(3D)/mobile(2.5D) bằng `matchMedia('(min-width:1024px)')` + `hasWebGL()`; mount Homepage3D CHỈ khi đủ điều kiện → three không nạp trên mobile. — Done
  + `app/page.tsx` — thay `<Homepage3D/>` bằng `<HomepageStage/>` (giữ shell + SiteHeader). — Done

## Kết quả Testing (M3.4)
- `tsc --noEmit`: pass (exit 0). `next build`: pass — 8 routes; homepage `/` **vẫn static (○)** vì fallback mobile SSR ra HTML thuần (3D chỉ swap client-side trên desktop). Đã `rm -rf .next` sau build.
- **Three.js KHÔNG nạp trên mobile (kiến trúc):** `HomepageStage` import `Homepage3D` (module wrapper nhẹ) nhưng chỉ *render* nó khi `use3D=true`; chunk three thực sự nằm sau `dynamic(ssr:false)` của Scene3D → chỉ tải khi Scene3D mount (tức desktop). Nhánh mobile không bao giờ mount Homepage3D.
- **Visual:** ⚠️ Engineer xem trên browser và nhận xét **"chưa ổn"**. Sẽ sửa lại phiên sau. Chưa Git, chưa commit.

> **Bước tiếp theo (phiên sau):** Hỏi engineer muốn sửa cụ thể điểm nào (bố cục, màu, độ mạnh parallax, hình dạng Mac/bàn…) → sửa `HomepageMobile.tsx` theo feedback → verify lại → Git.

---
---

# [Layer 1: Entry] — Task: GĐ 3 Polish — M3.4 RESET (xóa code, làm lại từ đầu)

- **Latest prompt:** "Xóa các file code liên quan của M3.4 để thực hiện lại. Chờ engineer yêu cầu code." (Không dùng Playwright trong phiên này.)
- **Latest step:** Updating + Testing tối giản (chỉ `tsc --noEmit`, không build/không Playwright) — **xong. Chờ TE1 từ engineer (chưa C&D lại).**
- **Layer status:** Layer 1 — quay lại trạng thái cuối M3.3 (chỉ desktop 3D, chưa có nhánh mobile).

## Logic/UI Module: Xóa code M3.4
- **State:** Done
  + Xóa `SOURCE/hooks/useParallax.ts` — Done
  + Xóa `SOURCE/app/(layer1)/_components/HomepageMobile.tsx` — Done
  + Xóa `SOURCE/app/(layer1)/_components/HomepageStage.tsx` — Done
  + Revert `SOURCE/app/page.tsx` — import lại `Homepage3D` (thay `HomepageStage`), `<Homepage3D />` thay `<HomepageStage />`, sửa comment đầu file về lại mô tả M3.3 (desktop only, mobile fallback để M3.4 làm lại) — Done
  + **Giữ nguyên, KHÔNG đụng tới:** `SOURCE/app/(layer1)/_components/Scene3D.tsx` — hover-scale (`HOVER_SCALE`, lerp `useFrame`) + CTA `<Html>` "Nhấn để bắt đầu" là phần bổ sung của M3.3, engineer đã xác nhận "Hoạt động ổn" trước khi M3.4 bắt đầu.
  + `SOURCE/app/(layer1)/_components/Homepage3D.tsx` — không đổi, vẫn còn nguyên từ M3.3.

## Kết quả Testing (RESET)
- `tsc --noEmit` (trong `SOURCE/`): pass, không lỗi sau khi xóa file + revert `page.tsx`.
- Không chạy `next build` / Playwright trong phiên này theo yêu cầu engineer.

> **Bước tiếp theo:** Chờ engineer gửi TE1 mới (yêu cầu/feedback cụ thể cho M3.4) → C&D lại từ đầu (không tái dùng C&D vòng 1 nếu engineer muốn hướng khác) → Coding.

---
---

# [Layer 1: Entry] — Task: GĐ 3 Polish — M3.4 Homepage Mobile Fallback (LÀM LẠI — computer.png trên bàn CSS)

- **Latest prompt:** "Thực hiện M3.4: Import ảnh AIO PC (computer.png) trong ASSETS/images; computer.png nằm trên một 3D table model (4 chân, agent tự vẽ); CTA button đè trên chính giữa computer.png; navbar kế thừa từ UI L2." (model Opus, KHÔNG dùng Playwright phiên này.)
- **Latest step:** Testing ✅ (tsc + next build pass) — **chờ engineer xác nhận visual trên browser để Git** (pattern milestone UI; lần trước bị từ chối nên không auto-Git).
- **Layer status:** Layer 1 — thêm nhánh mobile (visual language Spatial tái hiện bằng CSS 2.5D).

### Quyết định C&D (engineer chốt — 2 câu hỏi)
- Q1=A: Bàn dựng bằng **CSS/HTML 2.5D** (faux-3D: mặt bàn trapezoid phối cảnh + 4 chân, agent tự vẽ). KHÔNG Three.js trên nhánh mobile (đúng ràng buộc lõi dự án).
- Q2=A: Thiết kế mới **chỉ áp dụng <1024px**; giữ nguyên scene 3D Three.js M3.3 cho desktop → cần branching (HomepageStage).

### Quyết định kỹ thuật
- `computer.png` (256×256, illustration AIO phẳng nền trong suốt) copy `ASSETS/images/` → `SOURCE/public/images/` để Next serve runtime (proxy đã loại path có đuôi từ M3.3). Render bằng `next/image` (priority, alt → a11y/SEO).
- Bàn faux-3D bằng CSS thuần (deterministic, không cần Playwright verify): mặt bàn `clip-path: polygon(14% 0,86% 0,100% 100%,0 100%)` (trapezoid hẹp-sau-rộng-trước) + cạnh trước (độ dày) + 4 chân (2 trước đậm/ra ngoài, 2 sau mảnh+tối+thụt vào → chiều sâu) + bóng đổ mềm. Tông gỗ trầm khớp editorial dark `#0d0d11`.
- Máy đặt **trên** mặt bàn: z-index máy > bàn + `-mt-6` kéo bàn lên dưới đáy máy. CTA "Vào học →" `absolute` đè chính giữa computer.png (bg-brand + text-brand-foreground, active:scale-95).
- Branch không dùng CSS `hidden`: `HomepageStage` (client) đọc `matchMedia('(min-width:1024px)')` + `hasWebGL()` sau hydrate → chỉ *mount* Homepage3D (→ Scene3D dynamic → three) khi đủ điều kiện. SSR + render client đầu = HomepageMobile (HTML thuần).

## UI Module: Homepage Mobile (M3.4 — làm lại)
- **State:** Done (chờ engineer confirm visual)
  + `SOURCE/public/images/computer.png` (MỚI) — copy từ ASSETS. — Done
  + `app/(layer1)/_components/HomepageMobile.tsx` (MỚI) — scene 2.5D: glow màn hình + eyebrow + máy (next/image) trên bàn gỗ faux-3D 4 chân + CTA đè giữa máy + bóng đổ + hint dưới. `<h1 sr-only>` gánh SEO. — Done
  + `app/(layer1)/_components/HomepageStage.tsx` (MỚI) — branch desktop(3D)/mobile(2.5D) bằng matchMedia + hasWebGL; three không nạp trên mobile. — Done
  + `app/page.tsx` — thay `<Homepage3D/>` bằng `<HomepageStage/>` (giữ shell + SiteHeader = navbar kế thừa L2). — Done
  + Giữ nguyên `Scene3D.tsx`/`Homepage3D.tsx` (M3.3, không đụng).

## Kết quả Testing (M3.4 — làm lại)
- `tsc --noEmit`: pass (exit 0). `next build`: pass — homepage `/` **static (○)** (fallback mobile SSR ra HTML thuần; 3D chỉ swap client-side trên desktop). Đã `rm -rf .next` sau build (gotcha font manifest).
- **Three.js KHÔNG nạp trên mobile (kiến trúc):** `HomepageStage` chỉ *render* `Homepage3D` khi `use3D=true`; chunk three nằm sau `dynamic(ssr:false)` của Scene3D → chỉ tải khi Scene3D mount (desktop).
- **Visual:** KHÔNG dùng Playwright phiên này (engineer chỉ định) → chờ engineer xem trên browser (mobile <1024px) và xác nhận trước khi Git.

### Sửa visual vòng 1 (engineer feedback + screenshot)
*Issue:* (1) Bỏ 2 dòng chữ trên/dưới ("Không gian học của bạn" + "Chạm vào màn hình để bắt đầu"). (2) CTA hơi to + đang căn giữa CẢ ẢNH (top-1/2) nên không nằm giữa màn hình (ảnh có chân đế → tâm màn hình cao hơn). (3) Máy nằm hơi lùi.
*Fixing process (HomepageMobile.tsx):*
- Xóa 2 `<p className="eyebrow">`. Glow chuyển vào trong "sân khấu" (bám theo máy thay vì container).
- CTA nhỏ ~10%: `px-5 py-2.5 text-xs tracking-[0.16em]` → `px-[18px] py-2 text-[11px] tracking-[0.14em]`. Căn tâm màn hình: `top-1/2` → `top-[38%]` (giữ `-translate-y-1/2`; 38% ≈ tâm vùng màn hình của computer.png 256×256).
- Máy nhích lên/forward ~5%: overlap bàn `-mt-6` (24px) → `-mt-[33px]` (+9px ≈ 5% chiều cao máy).
- `tsc` + `next build` pass. Đã `rm -rf .next`.
- ⚠️ Con số `top-[38%]` và overlap là ước lượng (không Playwright phiên này) — chờ engineer xem lại, lệch thì chỉnh tiếp.

> **Còn lại GĐ 3 sau M3.4:** M3.5 Personalization, M3.6 Transitions & SEO + Lighthouse.

> **M3.4 TẠM GÁC (2026-06-16):** engineer yêu cầu bỏ qua M3.4, chuyển sang làm theme. Code M3.4 giữ nguyên (chưa Git), quay lại sau.

---
---

# [Layer 2: Core Loop] — Task: Theming hệ thống — EBP Theme (Exam Browser Page)

- **Latest prompt:** "Bắt đầu tạo theme cho từng UI Layer. UI Layer 2 — EBP Theme (Exam Browser Page): Navbar RGB(26,54,93); Background White; Block content bg RGB(47,133,90); Hover RGB(255,249,69); Text trắng. Lưu ý: chỉ đổi theme không đổi thiết kế; mỗi UI Layer một theme riêng, không kế thừa (trừ vài trường hợp)."
- **Latest step:** Testing ✅ (tsc + next build pass; KHÔNG Playwright phiên này) — **chờ engineer xác nhận visual để Git**.
- **Layer status:** Layer 2 — thêm hệ thống theme (per-trang/per-layer, scope CSS variables).

### Quyết định C&D (engineer chốt — 3 câu hỏi)
- Q1=A: Theme áp dụng **chỉ trang /exams** (Exam Browser). Trang L2 khác giữ nguyên, làm theme riêng sau.
- Q2=A: Navbar xanh đậm **chỉ trong scope theme này**; homepage L1 + trang L2 ngoài scope GIỮ navbar trắng (đúng "không kế thừa").
- Q3=A: Hover vàng → **viền + tiêu đề block chuyển vàng**, giữ nền block xanh, chữ thân trắng (tương phản tốt).

### Quyết định kỹ thuật — hệ thống theme
- **Theme hooks bằng CSS variables** (`globals.css`): biến `--nav-*` (navbar) + `--block-*` (ExamCard). **Mặc định ở `:root` = đúng token giao diện hiện tại** → component dùng chung (SiteHeader, ExamCard) KHÔNG đổi ở mọi nơi NGOÀI scope. Mỗi trang/layer override trong class scope riêng (`.theme-*`) → "không kế thừa".
- `.theme-ebp` override: nav-bg `rgb(26 54 93 /.95)` + nav-fg trắng; block-bg `rgb(47 133 90)` + block-fg trắng + block-hover `rgb(255 249 69)`.
- KHÔNG override token toàn cục (`--background/--foreground/--card`) → ExamFilters (sheet trắng, chữ đậm) + empty-state KHÔNG bị ảnh hưởng (đúng "chỉ đổi theme, không đổi thiết kế"). Filter là control overlay, không phải content block nên không tô xanh.
- Text trắng = trên bề mặt có màu (navbar + block xanh). Chữ trên nền trắng (filter, empty-state) giữ đậm để đọc được (white-on-white là vô nghĩa).

## UI Module: EBP Theme
- **State:** Done (chờ engineer confirm visual)
  + `app/globals.css` — thêm khối "THEME HOOKS": biến mặc định `--nav-*`/`--block-*` ở `:root` + scope `.theme-ebp`. — Done
  + `_components/SiteHeader.tsx` — header dùng `bg-[var(--nav-bg)]` + `border-[color:var(--nav-border)]`; logo `text-[var(--nav-fg)]`; "Menu"+chevron `text-[var(--nav-fg-muted)]`. (Dropdown panel giữ trắng/chữ đậm — readable, không đổi.) — Done
  + `_components/ExamCard.tsx` — block dùng `bg-[var(--block-bg)]`, `border-[color:var(--block-border)]`, hover/focus `border-[color:var(--block-hover)]`; eyebrow+meta `text-[var(--block-fg-muted)]`; tiêu đề `text-[var(--block-fg)]` + `group-hover:text-[var(--block-hover)]`. — Done
  + `exams/page.tsx` — bọc toàn trang trong `<div className="theme-ebp min-h-dvh bg-white">` (thay fragment) → kích hoạt scope + nền trắng. — Done

## Kết quả Testing (EBP Theme)
- `tsc --noEmit`: pass. `next build`: pass (routes không đổi). Đã `rm -rf .next`.
- **Không ảnh hưởng ngoài scope (kiến trúc):** biến mặc định `:root` = token cũ → SiteHeader trên homepage L1 / Detail / Player / Result vẫn trắng như trước.
- **Visual:** KHÔNG dùng Playwright phiên này (engineer chỉ định) → chờ engineer xem /exams trên browser.

> **Bước tiếp theo:** Engineer confirm visual EBP theme → Git. Sau đó theme tiếp các trang/layer khác (mỗi cái 1 scope `.theme-*`).

### Sửa bố cục EBP + hover shadow (engineer feedback)
*Yêu cầu:* (1) Main content = một block gồm filter + lưới ExamCard **2 cột × n hàng** (n theo số đề DB), block căn giữa. (2) Hover ExamCard → shadow transition độ đậm ~15%. (3) Hover filter → hiệu ứng tương tự.
*Fixing process:*
- `exams/page.tsx` — `max-w-2xl` → `max-w-3xl` (đủ rộng cho 2 cột); giữ `mx-auto` (block căn giữa) + cấu trúc `flex items-start` (filter trái + grid phải).
- `ExamBrowser.tsx` — `ul` từ `flex flex-col gap-4` → `grid grid-cols-2 gap-4` (2 cột, hàng tự theo số đề).
- `ExamCard.tsx` — `li` + `Link` thêm `h-full` (cao bằng nhau trong hàng); `transition-colors` → `transition-all duration-200` + `hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]` (bóng đen 15%).
- `ExamFilters.tsx` — tay nắm master toggle thêm `rounded-md transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)]` (hover shadow giống ExamCard).
- `tsc` + `next build` pass. Đã `rm -rf .next`.
- ⚠️ Lưu ý: lưới để `grid-cols-2` cố định (đúng "2 cột") — trên màn rất hẹp (375px) 2 cột + tay nắm filter sẽ chật; nếu muốn mobile về 1 cột thì đổi `grid-cols-1 sm:grid-cols-2` (hỏi engineer). Không Playwright phiên này → chờ engineer xem.

### Đảo dark theme thành ROOT — áp dụng toàn bộ Layer ngoài L1 (engineer feedback)
*Yêu cầu:* (1) Đảo màu shadow + background của page: black ↔ white. (2) Đặt dark theme này làm **root**, để toàn bộ Layer NGOÀI L1 dựa vào (based on) — đây là "trường hợp ngoại lệ" được phép kế thừa theme đã nói ở task EBP Theme phía trên.
*C&D (1 câu hỏi):* Hỏi engineer phạm vi root dark có áp dụng ngay cho các trang L2 đã build (Detail/Player/Result — đang "tờ giấy trắng") hay chỉ /exams + tương lai. Engineer chọn: **áp dụng toàn bộ ngay**.
*Fixing process:*
- `globals.css` — gộp giá trị `.dark` (cũ, không ai dùng — không `next-themes`/toggle nào trong codebase) vào `:root` làm mặc định mới: `--background`/`--card`/`--popover` tối, `--foreground` sáng, `--border`/`--input` trắng mờ, `--brand` tông sáng hơn cho đủ tương phản trên nền tối. Xoá class `.dark` (dead code, root đã là dark).
  - ⚠️ Cập nhật/ghi đè quyết định cũ ở mục "EBP Theme" phía trên ("KHÔNG override token toàn cục `--background/--foreground/--card`") — quyết định đó đã hết hiệu lực theo yêu cầu mới này.
- `exams/page.tsx` — `bg-white` (hardcode) → `bg-background` (kế thừa root dark, đúng yêu cầu "dựa vào root").
- `ExamCard.tsx` + `ExamFilters.tsx` — hover shadow `rgba(0,0,0,0.15)` (đen) → `rgba(255,255,255,0.15)` (trắng) — đảo đúng yêu cầu, hợp lý trên nền tối.
- L1 (Homepage3D/HomepageMobile/Scene3D) — KHÔNG đụng, vẫn dùng nền riêng (`#0d0d11`/space) như cũ, đúng yêu cầu "ngoài UI L1".
- `tsc --noEmit` + `next build`: pass (routes không đổi). Đã `rm -rf .next`.
- Không Playwright phiên này → chờ engineer xem `/exams` (và các trang L2 khác: Detail/Player/Result) trên browser để confirm trước khi Git.

### Bổ sung — tăng độ sáng shadow ExamCard hover (engineer feedback)
*Yêu cầu:* tăng độ đậm (độ sáng trong dark theme) của shadow khi hover ExamCard, chỉ việc này.
*Fixing process:* `ExamCard.tsx` hover shadow `rgba(255,255,255,0.15)` → `rgba(255,255,255,0.35)`. `tsc --noEmit` pass.

### Git — Done (2026-06-16)
Commit `6f9c803` (push lên `origin/main`), gộp: M3.3 hover CTA follow-up, M3.4 mobile fallback (HomepageMobile/HomepageStage + computer.png), EBP theme + layout fix, dark root theme, shadow hover tăng sáng. **Latest step: Git ✅.** Chờ TE1 cho task tiếp theo.

---
---

# [Layer 1 + 2 + Infra] — Task: Polish follow-ups + Sự cố Supabase paused (S#14, 2026-07-08)

- **Latest prompt:** chuỗi TE1 nhỏ chỉnh UI (Overview/Filter/Navbar/Homepage) + báo lỗi `AuthRetryableFetchError: fetch failed` khi vào L2 + cung cấp lại Supabase keys.
- **Latest step:** ✅ **Git — commit `eea5056`, push `origin/main`.**
- **Layer status:** L2 polish tiếp (visual Focused/EBP); L1 navbar tách riêng khỏi L2; infra auth chịu lỗi offline.

### Các thay đổi UI/logic (gộp trong commit `eea5056`)
- **Exam Detail (`exams/[id]/page.tsx`)** — "← Trang trước" (giữ link `/exams`) canh TRÁI block; bỏ eyebrow môn/lớp + dòng "Khi bắt đầu…"; nội dung (tên đề + 2 ô meta + nút) căn giữa. `StartAttemptButton`: nhãn "Bắt đầu", chữ `text-white`, hover glow `shadow-[0_0_24px_rgba(129,140,248,.65)]`.
- **Navbar navy toàn L2** — tạo `app/(layer2)/layout.tsx` bọc `.theme-l2` (globals.css: chỉ override `--nav-*` = navy RGB 26,54,93). `.theme-ebp` bỏ phần nav (thừa hưởng từ layout), giữ block xanh. → mọi trang L2 navbar navy từ một nguồn.
- **SiteHeader (dùng chung L2/3/4) viết lại** — bỏ dropdown "Menu" (Trang chủ/Đề luyện/Đăng xuất); thẻ nav độc lập: **Phân tích** (`/me/dashboard`, L3) · **Nhập đề** (`/admin/import`, L4) · **Tài khoản** (dropdown: Đăng ký `/login?mode=signup`, Đăng nhập `/login`). Bỏ import `signOut`.
- **Navbar L1 riêng** — `app/(layer1)/_components/HomeHeader.tsx` (MỚI): "Về chúng tôi" (`href="#"` placeholder — chưa có trang About) + "Tài khoản" (Đăng ký/Đăng nhập). `page.tsx` dùng `HomeHeader` thay `SiteHeader` → L1 KHÔNG đồng bộ navbar L2 (đúng "ngoại trừ Layer 1").
- **login `?mode=signup`** — `login/page.tsx` đọc searchParams truyền `initialMode` → `AuthForm` mở sẵn form Đăng ký.
- **ExamFilters — 3 ô lọc nhanh** (Mới nhất/Cũ nhất/Khó nhất): checkbox tĩnh **chưa gắn hành vi** (đã thử wire `?sort=` rồi engineer yêu cầu gỡ). Đặt **NGOÀI** dropdown, `absolute right-0 top-full` trong `.relative` + `w-max` → mép phải mỗi ô canh đúng viền phải tay nắm (verify Playwright: handleRight=295px = 3 checkbox right=295px).
- **Homepage desktop — bỏ glow hover** — `Scene3D.tsx`: gỡ hẳn component `AioLight` (đèn màn hình hắt sáng khi hover máy AIO) + usage. Giữ hover-scale + CTA "Nhấn để bắt đầu".
- **Book texture (làm rồi HOÀN TÁC)** — glb `stack_of_books.glb` KHÔNG nhúng texture (chỉ material phẳng `cover` xanh tím/`paper` xám); có UV nên đã thử gán tay texture từ `ASSETS/models/BOOK/textures` (BookModel). Engineer yêu cầu hoàn tác → đã revert Scene3D về `Model` thường + xoá `public/models/book/`.

### ⚠️ Sự cố backend Supabase (ghi để KHÔNG chẩn nhầm lần sau)
- **Triệu chứng:** vào L2 → `AuthRetryableFetchError: fetch failed` tại `getUser()` (getCurrentUser/middleware).
- **Chẩn đoán:** không phải lỗi code. Host `hynwleaxtbtjzkvpjsug.supabase.co` trả **NXDOMAIN** qua Google DNS (internet chung OK) → project Supabase đang **paused** (free-tier tự pause sau ~1 tuần không hoạt động).
- **Khắc phục:** engineer restore project trong dashboard → host sống lại (DNS resolve, HTTP 404 API root). `.env.local` **vốn đã đúng** (URL + anon + service_role khớp key engineer cung cấp — cùng ref, chỉ thêm publishable key làm comment dự phòng). DB **nguyên vẹn**: 2 đề + 10 câu + 2 user test (`+rlstesta/+rlstestb`, pass `rls-test-password-123`). KHÔNG cần chạy lại schema/seed.
- **Phòng ngừa (đã thêm code):** try/catch quanh `getUser()` trong `getCurrentUser.ts` + `lib/supabase/middleware.ts` → backend offline ⇒ coi như chưa đăng nhập, redirect `/login` thay vì crash. Smoke test: `/login`→200, `/exams`→307 `/login`.

### Files (commit `eea5056`, 13 file, +394/−219)
Sửa: `AuthForm.tsx`, `Scene3D.tsx`, `login/page.tsx`, `ExamFilters.tsx`, `SiteHeader.tsx`, `StartAttemptButton.tsx`, `exams/[id]/page.tsx`, `globals.css`, `page.tsx`, `getCurrentUser.ts`, `middleware.ts`. Tạo: `HomeHeader.tsx`, `(layer2)/layout.tsx`.
(`exams/page.tsx` không vào commit: thêm rồi gỡ `?sort=` net-zero so với HEAD.)

### Nợ / cần biết
- **Phân tích/Nhập đề** trỏ `/me/dashboard` `/admin/import` — L3/L4 **chưa build** → 404 tới khi dựng. Khi dựng, bọc theme navy như `(layer2)/layout.tsx` để đồng bộ navbar.
- "Về chúng tôi" (`href="#"`) chờ trang About (cần thêm vào PUBLIC_PATHS nếu công khai).
- "Tài khoản" hiện cả khi đã đăng nhập (đúng yêu cầu đồng bộ). Nếu muốn navbar authed đổi thành "Đăng xuất" → task riêng.
- Untracked chưa commit (ngoài scope): `SOURCE/public/images/{wall,floor}-texture.jpg` (Scene3D Room dùng — nên commit riêng kẻo homepage 3D thiếu texture khi deploy), `public/models/Lightswitch.glb` (không dùng), stray `ASSETS/images/*.eps` + `License *.txt`, xoá `ASSETS/images/computer.png`.
- **M3.4 vẫn TẠM GÁC**; M3.5 Personalization, M3.6 Transitions & SEO chưa bắt đầu.

**Latest step: Git ✅.** Chờ TE1 cho task tiếp theo.

---
---

# [Layer 1 + cross-layer] — Task: Navbar 8vw + Style trang Login/Signup (S#15, 2026-07-09)

- **Latest prompt:** "(1) Đảm bảo các thẻ nav trong navbar của mọi UI Layer đều là 8% chiều dài màn hình. (2) Style signup/login page theo ảnh tham chiếu signup_login_page_form.jpe: tab sign in có input tạo tài khoản mới; thêm transition." + làm rõ: ảnh tham chiếu chỉ cho `<main>` (card), navbar login KẾ THỪA HomeHeader của homepage.
- **Latest step:** Coding ✅ → Updating → Testing
- **Layer status:** Layer 1 — style login/signup; cross-layer — nav width chuẩn hoá 8vw.

### Quyết định C&D (engineer chốt — bảng Q1–Q4)
- Q1: Mỗi thẻ nav width = **8vw**, text-center (kèm min-width để mobile không bóp chữ). Áp cho HomeHeader (L1) + SiteHeader (L2/3/4).
- Q2: Trang login **trắng/đen tạm thời** (không bê tông hồng template, không ép brand indigo). Lấy BỐ CỤC từ ảnh, màu neutral.
- Q3: Google/Facebook + "Quên mật khẩu" = **placeholder disabled** (giống Save/Share ở Result). Không làm OAuth/reset thật.
- Q4: Tab tiếng Việt **"Đăng nhập" / "Đăng ký"**; giữ nguyên signIn/signUp actions (không đụng Logic).
- Bổ sung (TE sau C&D): ảnh tham chiếu = main của trang; navbar login **kế thừa HomeHeader** (không tạo header riêng).

### Quyết định kỹ thuật
- Icons = inline SVG (đồng bộ SiteHeader vốn dùng SVG; tránh lệ thuộc phiên bản lucide).
- Card login trên nền tối L1 `#0d0d11` (đúng "thế giới" Entry) + HomeHeader trên cùng; bản thân card trắng/đen.
- Transition: chuyển tab dùng `animate-in fade-in slide-in` (tw-animate-css có sẵn) key theo mode; field "Tên hiển thị" hiện/ẩn theo remount keyed; underline input `focus-within` đổi màu; hover nút + tab active.

## UI Module: Navbar 8vw (Mảng A)
- **State:** Done
  + `(layer1)/_components/HomeHeader.tsx` — nav "Về chúng tôi" + "Tài khoản" mỗi thẻ `w-[8vw] min-w-[5.5rem]` text-center, gap-6→gap-2 — Done
  + `(layer2)/_components/SiteHeader.tsx` — nav "Phân tích"/"Nhập đề"/"Tài khoản" mỗi thẻ `w-[8vw] min-w-[5.5rem]` text-center — Done

## UI Module: Login/Signup card (Mảng B)
- **State:** Done
  + `(layer1)/_components/AuthForm.tsx` — viết lại: card 2 panel (trái tabs đen + mũi tên CSS; phải form trắng), avatar tròn, Field underline+icon (User/Mail/Lock inline SVG), tab Đăng nhập/Đăng ký, placeholder Quên MK + Google/Facebook (disabled), transition tab (animate-in fade+slide key mode) + focus-within underline + hover — Done
  + `(layer1)/login/page.tsx` — HomeHeader + main căn giữa card, nền tối L1 `#0d0d11` — Done

### Tinh chỉnh responsive navbar (phát hiện qua visual test)
- 8vw + min-w-[5.5rem] ban đầu áp mọi breakpoint → mobile 375px: chữ eyebrow (~110px) TRÀN khỏi box 88px (chồng chữ), và L2 (3 thẻ) làm logo "Trạng Nguyên" wrap 2 dòng.
- **Fix:** (1) Ép `8vw + min-w` chỉ từ `sm:` trở lên (desktop — nơi yêu cầu 8vw có nghĩa); mobile để thẻ theo content-width. (2) `max-sm:text-[10px] max-sm:tracking-[0.04em]` cho nhãn nav → mobile chữ gọn, không chồng. Áp cả HomeHeader + SiteHeader.

## Kết quả Testing (S#15)
- `tsc --noEmit`: pass (2 lần — sau coding + sau tinh chỉnh className). `next build`: pass — 8 routes không đổi.
- **Visual (Playwright, dev :3001, login test user `+rlstesta`):**
  + **Login desktop 1280** signin/signup: khớp bố cục template — panel trái tabs (Đăng nhập/Đăng ký, active pill trắng) + mũi tên CSS; panel phải avatar + heading + fields underline icon + Quên MK/nút + Google/Facebook. Chuyển tab: field "Tên hiển thị" hiện/ẩn + animate fade+slide, heading/nút/social đổi theo mode. **0 console errors.**
  + **Login mobile 375**: card stack (tab strip trên + form dưới) đẹp, navbar không chồng chữ.
  + **Navbar 8vw desktop 1280**: đo JS — cả 3 thẻ L2 = **102px = đúng 8.0vw**. **0 console errors.**
  + **Navbar mobile 375**: L1 (2 thẻ) + L2 (3 thẻ) — không h-scroll (`scrollWidth=375`), logo 1 dòng, nhãn nav không chồng.
- Screenshot lưu `TEMP_SCREENSHOT/s15-*.png` trong lúc test; **đã dọn sạch TEMP_SCREENSHOT sau khi test pass** (theo WORKFLOW Bước 4.3 mục 7).

> **Chờ engineer xác nhận visual** (pattern milestone UI + navbar không có ảnh tham chiếu → engineer tự kiểm trên browser). Dev server đang chạy tại **http://localhost:3001** (port 3000 bị tiến trình cũ chiếm). Chưa Git.

### Sửa vòng 1 (engineer feedback — bố cục nav)
*Issue:* Nav dùng `gap-2` cố định (8px) — không phải "space-around" theo yêu cầu; khoảng cách giữa item chưa theo chuẩn phổ biến.
*Fixing process:*
- `HomeHeader.tsx` + `SiteHeader.tsx` — nav: `flex items-center gap-2` → `flex flex-1 items-center justify-around` (bỏ gap cứng). Nav giờ chiếm hết phần còn lại của header (`flex-1` — đơn vị co giãn tự nhiên theo Responsive Design, không cần breakpoint riêng), các item tự giãn đều khoảng cách hai bên theo `justify-around`. Giữ nguyên width 8vw/min-w-5.5rem của từng thẻ ở desktop (`sm:`).
- `tsc --noEmit` + `next build`: pass (8 routes không đổi).
- **Không chạy Playwright lần này** — engineer yêu cầu "Engineer tự test" (đúng WORKFLOW Bước 4.3: để engineer tự kiểm khi được yêu cầu). Dev server Turbopack hot-reload tại chỗ, engineer đã tự thao tác qua `/login`, `/exams`, làm đề, xem kết quả trong log — không lỗi.
- Chờ engineer xác nhận visual lần 2 trước khi Git.

### Sửa vòng 2 (engineer feedback — sai phạm vi flexbox)
*Issue:* Vòng 1 áp `flex-1 justify-around` LÊN CHÍNH `<nav>`, khiến từng thẻ nav con (Về chúng tôi/Tài khoản, hay Phân tích/Nhập đề/Tài khoản) bị coi là item và giãn cách nhau trên TOÀN BỘ phần còn lại của header — sai phạm vi. Yêu cầu đúng: logo = 1 item, toàn bộ khối nav = 1 item khác; flexbox phải phân bổ giữa 2 item NÀY.
*Fixing process:*
- `HomeHeader.tsx` + `SiteHeader.tsx` — outer header row: `justify-between` → `justify-around` (áp cho đúng 2 item: logo, nav-block). `<nav>` bỏ `flex-1 justify-around`, quay về `flex items-center gap-6 sm:gap-8` (block tự nhiên theo nội dung, gap chuẩn phổ biến 24/32px giữa các thẻ con — không stretch/space-around trên toàn header nữa). Width 8vw của từng thẻ giữ nguyên.
- `tsc --noEmit` + `next build`: pass (8 routes không đổi).
- **Tự verify bằng Playwright (đo JS, desktop 1280):** header row width 1152px, logo+nav content 356px, free space 796px chia đối xứng 2 bên logo/nav-block (211px mỗi bên) — đúng "logo và nav là 2 item ngang hàng". Nội bộ nav: 2 thẻ 102px (8vw) cách nhau đúng 32px (gap-8). Không h-scroll. **0 console errors.** Screenshot xác nhận bố cục đúng — đã xoá sau khi verify.
- Chờ engineer xác nhận lần cuối trước khi Git.

### Sửa vòng 3 (engineer feedback — ảnh tham chiếu navbar Google)
*Issue:* `justify-around` ở cấp header (vòng 2) đẩy logo + nav-block ra xa 2 mép màn hình (padding đối xứng dư thừa) — không đúng ý engineer. Ảnh Google minh hoạ: logo sát trái, nav-block ("Đăng nhập") sát phải, chỉ còn padding container bình thường.
*Fixing process:*
- `HomeHeader.tsx` + `SiteHeader.tsx` — outer header row: `justify-around` → `justify-between` (logo và nav-block ra 2 mép, chỉ padding container `px-6`). Nav bên trong giữ nguyên `gap-6 sm:gap-8` + width 8vw từng thẻ (không đổi từ vòng 2).
- `tsc --noEmit` + `next build`: pass. Tự verify Playwright desktop 1280: logo sát trái, nav-block sát phải, 0 console errors. Screenshot xoá sau verify.
- Engineer xác nhận visual ✅ ("Tốt, chuyển sang Git").

### Git — Done (2026-07-09)
- Git identity chưa cấu hình trên máy này → set global `undetecteddeveloper <smithnguyen247@gmail.com>` (khớp lịch sử commit cũ, engineer xác nhận trước khi set).
- Commit `418107c`, push `origin/main` ✅. Staged đúng 4 file thuộc task: `AuthForm.tsx`, `HomeHeader.tsx`, `login/page.tsx`, `SiteHeader.tsx`.
- **KHÔNG stage** (đúng quy tắc cũ): `PROCESS.md`, `WORKFLOW.md`, `.claude/`, `.mcp.json`, `.playwright-mcp/`, `TEMPLATE/homepage/signup_login_page_form.jpe`, và các nợ kỹ thuật cũ từ S#14 (`ASSETS/images/computer.png` deleted, textures, `.eps`/`License *.txt`, `Lightswitch.glb`) — ngoài phạm vi task này, giữ nguyên untracked/unstaged để xử lý riêng sau.

**Task S#15 — DONE ✅.**

---

*Issue (nếu có):* —
*Fixing process:* —

---
---

# [Layer 1: Identity — IAM] — Task: Profile dropdown (Chỉnh sửa + Đăng xuất) + auth-aware navbar

- **Latest prompt:** "Thêm function cho module IAM. Đảm bảo flow dữ liệu thực sự hoạt động như một trang web thật. Sau khi account đã được tạo, thay thế tag nav 'tài khoản' thành profile dropdown (đăng xuất, chỉnh sửa) với icon blank-user-circles. Bố cục: agent chọn phổ biến nhất. Engineer tự test visual, Agent test function (đăng xuất trước khi test)."
- **Latest step:** Testing (function, Agent thực hiện qua Playwright)
- **Layer status:** Layer 1 — IAM có thêm update-profile; cross-layer — navbar giờ auth-aware.

### Quyết định C&D (engineer chốt — 2 câu hỏi)
- Q1: "Chỉnh sửa" chỉ đổi **Tên hiển thị** (display_name) — khớp schema/RLS hiện có, không đổi email/mật khẩu.
- Q2 (engineer tự chỉnh hướng khi trả lời): sửa tên **ngay trong dropdown** (inline), không điều hướng sang trang riêng — bỏ phương án route `/account/edit` ban đầu tôi đề xuất.

### Quyết định kỹ thuật
- Icon `ASSETS/images/blank-user-circles.zip` (EPS+JPG preview stock) → dùng `sharp` script cắt 1 icon, trim viền trắng, threshold nền trắng→trong suốt, xuất `SOURCE/public/images/user-avatar-placeholder.png` (6.3KB, không watermark).
- Component dùng chung MỚI `components/shared/AccountMenu.tsx` (đúng vị trí theo UI-LAYER-MAP Mục 2.3 "Shared feature ≥2 layer") — thay hẳn khối "Tài khoản" trong cả HomeHeader/SiteHeader. Guest giữ nguyên hành vi cũ; authed: avatar → dropdown (tên, Chỉnh sửa inline-edit qua `updateProfile` Server Action, Đăng xuất qua `signOut` có sẵn).
- **Refactor cấu trúc:** dời `<SiteHeader/>` vào `(layer2)/layout.tsx` (fetch `getCurrentUserProfile()` 1 lần, render 1 lần) — trước đó lặp lại ở 5 nơi (`exams/page.tsx`, `exams/[id]/page.tsx`, `result/page.tsx`, `result/detail/page.tsx`, và bên trong **client component** `ExamPlayer.tsx`) — tránh phải khoan `user` prop xuyên qua client component. Gỡ `min-h-dvh` khỏi 5 trang con (chuyển lên layout) để không cộng dồn chiều cao với header 56px (tránh lặp lại bug scrollbar thừa đã gặp ở M3.3).
- L1 (`HomeHeader`, 2 nơi: `app/page.tsx` + `login/page.tsx`) không có layout chung khả dụng (root `/` nằm ngoài route group `(layer1)`) → fetch riêng ở `app/page.tsx`; `login/page.tsx` không cần đổi vì luôn redirect trước khi render nếu đã đăng nhập (mặc định `user=null` là đúng).
- **Đánh đổi được ghi nhận:** trang chủ `/` chuyển từ **static (○)** sang **dynamic (ƒ)** vì giờ đọc cookie auth mỗi request để biết hiện avatar hay "Tài khoản" — đúng tinh thần "flow dữ liệu hoạt động như 1 trang web thật" (cá nhân hoá theo user), đánh đổi hợp lý.

## Logic Module: IAM (updateProfile + profile fetch)
- **State:** Done
  + `lib/auth/getCurrentUser.ts` — thêm `getCurrentUserProfile()` (join auth.users + user_profiles.display_name) — Done
  + `(layer1)/actions.ts` — thêm `updateProfile(prev, formData)` Server Action, dùng RLS `profiles_update_own` có sẵn — Done

## UI Module: AccountMenu + navbar auth-aware
- **State:** Done
  + `public/images/user-avatar-placeholder.png` (MỚI) — icon cắt từ ASSETS blank-user-circles, nền trong suốt — Done
  + `components/shared/AccountMenu.tsx` (MỚI) — dropdown dùng chung, guest/authed 2 nhánh, inline edit tên — Done
  + `HomeHeader.tsx` + `SiteHeader.tsx` — nhận prop `user`, dùng `<AccountMenu>` thay khối cũ — Done
  + `app/page.tsx` — async, fetch `getCurrentUserProfile()`, truyền `HomeHeader` — Done
  + `(layer2)/layout.tsx` — async, fetch profile 1 lần, render `<SiteHeader user={user}/>` bọc children — Done
  + Gỡ `<SiteHeader/>` + import khỏi: `exams/page.tsx`, `exams/[id]/page.tsx`, `result/page.tsx`, `result/detail/page.tsx`, `ExamPlayer.tsx`; bỏ `min-h-dvh` trùng ở 5 nơi này — Done

## Kết quả Testing (tsc + build)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi, `/` chuyển ƒ (dynamic, có chủ đích).

## Kết quả Testing (function — Agent, Playwright, dev :3002)
- **Đăng xuất account cũ trước khi test** (session Playwright còn active từ phiên trước) — xác nhận qua `/exams` không redirect (đang login) → thao tác Đăng xuất qua AccountMenu → redirect `/login` → `/exams` sau đó redirect `/login` (session xoá thật, không phải ảo).
- **Guest state (L1 + L2):** cả `HomeHeader` và trang `/login` hiện nút text "Tài khoản" (không phải avatar) → click mở đúng menuitem "Đăng ký"/"Đăng nhập" — hành vi cũ giữ nguyên 100%.
- **Đăng nhập** (`smithnguyen247+rlstesta@gmail.com`) → cả `/` (L1) và `/exams` (L2) đổi sang **avatar icon** thay "Tài khoản" — xác nhận `getCurrentUserProfile()` + prop-drilling qua layout hoạt động đúng trên cả 2 kiến trúc khác nhau (L1 per-page fetch, L2 layout fetch 1 lần).
- **Dropdown authed:** hiện đúng tên/email hiện tại + "Chỉnh sửa" + "Đăng xuất".
- **Chỉnh sửa inline:** click → input pre-fill giá trị hiện tại → đổi thành "Trạng Nguyên Test" → Lưu → dropdown cập nhật ngay, form tự đóng, 0 console error.
- **Xác nhận ghi DB thật** (không phải state ảo client): **reload toàn trang** (`/exams`) → mở lại dropdown → vẫn hiện "Trạng Nguyên Test" (fetch mới từ server qua layout) → đồng thời kiểm tra chéo trên `/` (L1) cũng hiện đúng tên mới → nhất quán mọi layer.
- **Đăng xuất lần 2:** redirect `/login` đúng, header trở lại guest state.
- **Console:** 0 errors xuyên suốt toàn bộ luồng test.
- Không sửa lại display_name test user về trạng thái cũ (test data vô hại, không ảnh hưởng test khác).

> **Chờ engineer tự test phần visual** (đúng phân công "Engineer tự test visual, Agent test function"). Dev server đang chạy tại **http://localhost:3002**. Chưa Git.

### Sửa vòng 1 (engineer feedback — 3 việc)
*Issue 1 (bug):* `Runtime TypeError: Cannot read properties of undefined (reading 'apply')` tại HomeHeader khi đang sửa tên + nhấn Enter.
*Chẩn đoán:* Tái hiện đúng thao tác trên dev server MỚI restart sạch → **0 lỗi, lưu thành công** — code không sai logic. Nguyên nhân: `updateProfile` là Server Action MỚI thêm vào file `actions.ts` đã tồn tại NGAY TRONG LÚC dev server đang chạy (Turbopack Fast Refresh) — lỗi desync manifest Server Action đã biết của Next.js dev mode khi thêm action mới vào file "use server" cũ mà không restart hẳn. Phát hiện thêm: 3 tiến trình dev server cũ (port 3000/3001/3002) tồn đọng từ các phiên trước — đã kill 2 cái thừa (14100, 18804), chỉ giữ 1.
*Fixing process:* Restart hẳn dev server (kill toàn bộ tiến trình cũ + `rm -rf .next` + `npm run dev` mới) sau MỌI lần sửa `actions.ts` từ giờ trở đi (không dựa vào HMR cho Server Action). Verify lại: sửa tên qua Enter (không click Lưu) → **0 console error**.

*Issue 2 (UI):* Căn giữa các mục trong profile dropdown (tên, Chỉnh sửa, Đăng xuất, form input) — trước đó `text-left`.
*Fixing process:* `AccountMenu.tsx` — đổi toàn bộ `text-left` → `text-center` cho paragraph tên + 2 button (view mode); form edit: `items-center` + input `text-center` + các dòng con `text-center`. (Dropdown GUEST — Đăng ký/Đăng nhập — không đụng, ngoài phạm vi "profile dropdown".)

*Issue 3 (ràng buộc mới):* Tên hiển thị tối đa 12 ký tự, chỉ chữ cái (kể cả có dấu) và dấu chấm.
*Fixing process:*
- Client (`AccountMenu.tsx`): `onChange` lọc ngay lúc gõ bằng regex `/[^\p{L}.]/gu` (giữ chữ cái Unicode + dấu chấm) rồi `.slice(0, 12)`; thêm `maxLength={12}` + dòng hint "Tối đa 12 ký tự, chỉ chữ cái và dấu chấm."; nút Lưu disable khi rỗng.
- Server (`actions.ts`, `updateProfile`): validate lại (authoritative, chống bypass) — `length > 12` và regex `^[\p{L}.]+$/u` → trả lỗi tương ứng nếu vi phạm.
- **Không đổi** form "Tên hiển thị" ở Đăng ký (`AuthForm.tsx`) — ngoài phạm vi yêu cầu (chỉ áp cho tính năng chỉnh sửa vừa làm).

## Kết quả Testing (sửa vòng 1)
- `tsc --noEmit` + `next build`: pass (8 routes, không đổi).
- **Playwright, dev server restart sạch (port 3000):**
  + Chỉnh sửa → gõ tên → **Enter** (không click Lưu): lưu thành công, **0 console error** — bug không tái hiện sau restart, xác nhận chẩn đoán đúng.
  + Dropdown căn giữa: xác nhận qua screenshot (tên, Chỉnh sửa, Đăng xuất đều center).
  + Validation: gõ "Nguyễn.Văn" (có dấu + chấm) → giữ nguyên, không bị lọc nhầm. Gõ "Nguyenvananhthat" (16 ký tự hợp lệ) + Enter → tự cắt còn "Nguyenvananh" (12 ký tự) → lưu đúng, 0 lỗi.
  + Reload lại `/` sau khi lưu: tên mới vẫn còn (persist DB thật) + 0 console error.

> **Chờ engineer tự test lại phần visual (đặc biệt bug Enter đã báo).** Dev server sạch tại **http://localhost:3000**. Chưa Git.

### Sửa vòng 2 (engineer feedback — 2 việc, kèm screenshot)
*Issue 1:* Khoảng cách giữa các item trong navbar không đều (do mỗi thẻ text là 1 box rộng cố định 8vw, còn avatar không có box → khoảng trống nhìn khác nhau dù cùng `gap`). Yêu cầu: khoảng cách đồng bộ = 12% chiều ngang màn hình.
*Fixing process:*
- `HomeHeader.tsx` + `SiteHeader.tsx` — bỏ hẳn `sm:w-[8vw] sm:min-w-[5.5rem]` trên từng thẻ (nguồn gốc lệch); `AccountMenu.tsx` nhánh guest cũng bỏ. Nav đổi `gap-6 sm:gap-8` → **`gap-[12vw]`** duy nhất, mọi item giờ auto-width theo nội dung → khoảng cách luôn đều tuyệt đối bất kể text hay avatar.
- **Regression phát hiện khi tự verify:** gap 12vw chiếm nhiều chỗ hơn (2×45px ở mobile 375) → logo "Trạng Nguyên" bị đẩy xuống 2 dòng. Fix: giảm padding header mobile `px-6`→`px-4` (giữ `sm:px-6` desktop) + `shrink-0 whitespace-nowrap` cho logo — đo chính xác bằng JS (logo cần 114px, sau fix có 122px) trước khi sửa, không đoán mò.
- Đo Playwright xác nhận: desktop 1280 gap=154px=12.0vw; mobile 375 gap=45px=12.0vw đúng cả 2 breakpoint, không h-scroll, logo về lại 1 dòng (28px height) ở cả L1 và L2.

*Issue 2:* Trang Result — khoảng trống hở giữa 2 nút "save"/"share" và nút "Trang chủ" (do `justify-between` kéo giãn theo chiều cao cột trái "Theo chủ đề" cao hơn via `items-stretch`); cần đổi tên 4 nhãn.
*Fixing process:*
- `TopicBreakdown.tsx` — thu gọn: `p-5`→`p-4`, `mt-4`→`mt-3`, `gap-4`→`gap-3` (giữa các dòng topic), `gap-1.5`→`gap-1` (label↔thanh tiến độ); nhãn "Theo chủ đề" → **"Chủ đề"**.
- `ResultActions.tsx` — nhãn "save"→**"Lưu"**, "share"→**"Chia sẻ"**.
- `result/page.tsx` — cột phải: `justify-between`→`justify-start` (đã có sẵn `gap-3`) → 2 nhóm nút nằm sát nhau, không còn bị kéo giãn hở khoảng trống dù cột trái cao hơn (fix robust, không phụ thuộc đúng bằng chiều cao); nhãn "Trang chủ" → **"Trở về"**.

## Kết quả Testing (sửa vòng 2)
- `tsc --noEmit` + `next build`: pass (8 routes không đổi).
- Playwright: đo JS xác nhận gap 12vw đúng tuyệt đối ở cả 2 breakpoint × 2 layer (L1/L2), logo hết wrap; screenshot xác nhận trang Result hết khoảng hở + nhãn mới hiển thị đúng ("CHỦ ĐỀ", "lưu", "chia sẻ", "Trở về"). 0 console error.

> **Chờ engineer xác nhận lần cuối.** Dev server tại **http://localhost:3000**. Chưa Git.

### Git — Done (2026-07-09)
Commit `e238d6b`, push `origin/main` ✅. Staged đúng 16 file thuộc phạm vi task (IAM + navbar + result page):
- Sửa: `HomeHeader.tsx`, `SiteHeader.tsx`, `(layer1)/actions.ts`, `lib/auth/getCurrentUser.ts`, `ExamPlayer.tsx`, `ResultActions.tsx`, `TopicBreakdown.tsx`, `result/page.tsx`, `result/detail/page.tsx`, `exams/[id]/page.tsx`, `exams/page.tsx`, `(layer2)/layout.tsx`, `app/page.tsx`.
- Tạo: `components/shared/AccountMenu.tsx`, `public/images/user-avatar-placeholder.png`, `ASSETS/images/blank-user-circles.zip` (source asset icon).
- **KHÔNG stage** (đúng quy tắc cũ): `PROCESS.md`, `WORKFLOW.md`, `.claude/`, `.mcp.json`, `.playwright-mcp/`, `TEMPLATE/`, và nợ kỹ thuật cũ từ S#14 (`ASSETS/images/computer.png` deleted, textures, `.eps`/`License *.txt`, `Lightswitch.glb`, thư mục `blank-user-circles/` giải nén dư thừa).

**Task S#16 (Profile dropdown IAM + navbar 12vw + Result page) — DONE ✅.**

## Tiến độ tổng thể (cuối phiên 2026-07-09)
```
GĐ 0 — Nền Móng              : [x] Done
GĐ 1 — Functional Prototype  : [x] Done
GĐ 2 — Connected Prototype   : [x] Done
GĐ 3 — Polish (MVP ship)     : [ ] In Progress
  M3.1 Visual language L2    : [x] Done
  M3.2 Responsive L2         : [x] Done
  M3.3 Homepage 3D           : [x] Done
  M3.4 Homepage Mobile       : [ ] TẠM GÁC (chờ engineer quay lại)
  M3.5 Personalization       : [ ] Not Started
  M3.6 Transitions & SEO     : [ ] Not Started
─────────────────────────────
Ngoài roadmap gốc — đã làm thêm trong GĐ3:
  Navbar chuẩn hoá (8vw → 12vw gap, space-between logo/nav) : [x] Done
  Login/Signup style (card 2 panel)                          : [x] Done
  IAM: profile dropdown (avatar, chỉnh sửa, đăng xuất)        : [x] Done
─────────────────────────────
Post-MVP A — Layer 3         : [ ] Not Started
Post-MVP B — Layer 4         : [ ] Not Started
```

**Kết thúc phiên 2026-07-09.** Chờ TE1 cho phiên tiếp theo.

---
---

# [Layer 1: Entry] — Task: Bỏ Homepage 3D + Mobile fallback, thay placeholder "Đang thiết kế"

- **Latest prompt:** "(Đã xóa toàn bộ md files trong TEXT, chỉ giữ lại các md files cần thiết) *Xóa bỏ: thiết kế homepage mobile riêng, thiết kế homepage 3D hiện tại, các đoạn code chết. *Thay thế: tạm ghi 'Đang thiết kế' cho page chưa thiết kế. *Giữ: navbar hiện tại."
- **Latest step:** Coding
- **Layer status:** Layer 1 — homepage quay về placeholder, chờ thiết kế mới. Ghi chú: `TEXT/docs/UI-LAYER-MAP.md`, `BACK-END-ARCHITECTURE-MAP.md`, `PROJECT_ROADMAP.md` đã bị engineer xóa khỏi dự án — không còn blueprint để tham chiếu từ phiên này trở đi.

### Quyết định C&D (engineer chốt qua 3 câu hỏi)
- Q1: **Bỏ hẳn hướng 3D** (không phải tạm reset) → gỡ luôn `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` khỏi `package.json`.
- Q2: Asset mồ côi (`public/models/*.glb`, `public/images/{computer.png,floor-texture.jpg,wall-texture.jpg}`) → **xóa luôn**.
- Q3: Placeholder "Đang thiết kế" → **chỉ áp dụng trang chủ `/`** (không tạo page cho `/me/dashboard`, `/admin/import`).
- Giữ nguyên `HomeHeader.tsx` (navbar L1) — không đụng.

## UI Module: Homepage placeholder
- **State:** Done (chờ engineer confirm visual)
  + Xóa `app/(layer1)/_components/Scene3D.tsx` — Done
  + Xóa `app/(layer1)/_components/Homepage3D.tsx` — Done
  + Xóa `app/(layer1)/_components/HomepageMobile.tsx` — Done
  + Xóa `app/(layer1)/_components/HomepageStage.tsx` — Done
  + `app/page.tsx` — bỏ `<HomepageStage/>`, `<main>` giờ `flex items-center justify-center` text mono "Đang thiết kế" (giữ `HomeHeader` + nền tối `#0d0d11`) — Done

## Logic/Chore Module: Gỡ dependency + asset mồ côi
- **State:** Done
  + `npm uninstall three @react-three/fiber @react-three/drei @types/three` (trong `SOURCE/`) — 52 packages removed — Done
  + Xóa `public/models/all_in_one_pc.glb`, `Pencil.glb`, `stack_of_books.glb`, `Lightswitch.glb` — Done
  + Xóa `public/images/computer.png`, `floor-texture.jpg`, `wall-texture.jpg` — Done
  + Xóa `ASSETS/images/floor-texture.jpg`, `wall-texture.jpg` (nguồn, mồ côi theo) — Done
  + Verify không còn import nào tới `three`/`@react-three` trong `SOURCE/` (grep sạch) — Done

## Kết quả Testing
- `tsc --noEmit`: pass. `next build`: pass — **8 routes không đổi**, `/` vẫn dynamic (ƒ, đã dynamic từ task IAM trước). Đã `rm -rf .next` sau build.
- **Visual (Playwright, dev server có sẵn tại :3001):**
  + Desktop 1280×800: navbar HomeHeader nguyên vẹn (logo, "Về chúng tôi", "Tài khoản"), `<main>` nền tối `#0d0d11` + text mono "ĐANG THIẾT KẾ" căn giữa. **0 console errors.**
  + Mobile 375×812: cùng bố cục, không h-scroll, navbar không vỡ. **0 console errors.**
  + Screenshot đã xóa khỏi `TEMP_SCREENSHOT/` sau khi verify xong (đúng WORKFLOW Bước 4).

> **Chờ engineer xác nhận visual để Git.** Dev server đang chạy sẵn tại **http://localhost:3001**.

---
---

# [Layer 1: Entry] — Task: Thiết kế Homepage (bố cục Hyperspace + theme DESIGN.md)

- **Latest prompt:** "Thiết kế homepage (L1) — 'homepage.png' đã cung cấp trong TEMPLATE\homepage; agent tự test bằng playwright; sử dụng theme trong DESIGN.md." (model Opus)
- **Latest step:** Testing ✅ (tsc + build + visual Playwright desktop 1280 / mobile 375) — **chờ engineer xác nhận visual để Git** (pattern milestone UI).
- **Layer status:** Layer 1 — homepage có thiết kế thật (thay placeholder "Đang thiết kế"), visual language Spatial→Editorial (theme Mực & Sơn mài).

### Quyết định C&D (engineer chốt — bảng Q1–Q4)
- Q1 (Navbar): **Thay HomeHeader bằng sidebar nav DỌC** như template trên homepage. Đánh đổi: mất avatar/AccountMenu auth ở trang chủ (login vẫn tới được qua mục "Đăng nhập" trong sidebar). → `/` quay lại **static (○)** vì bỏ fetch `getCurrentUserProfile`.
- Q2 (Theme): **Two-tone** — sidebar đen sơn mài `#1B1512`, hero nền ngà `#EDE1C8` (đúng DESIGN.md: surface cho khối đảo ngược).
- Q3 (Phạm vi): các mục sidebar là **nav LINK thật** (Trang chủ `/`, Đề luyện `/exams`, Về chúng tôi `#` placeholder, Đăng nhập `/login`) — KHÔNG dựng section Who-we-are/What-we-do/Contact. Chỉ hero first-fold.
- Q4 (Nội dung): agent tự viết copy tiếng Việt; CTA → `/exams`.

### Quyết định kỹ thuật
- **Màu đặt cục bộ** (Tailwind arbitrary hex `#1B1512`/`#EDE1C8`/`#B8863B`/`#A62C2B`/`#6B655C`), KHÔNG đụng `globals.css` → không ảnh hưởng root dark theme mà L2/L3/L4 dựa vào. Palette lấy đúng DESIGN.md "Mực & Sơn mài".
- **Font:** giữ Merriweather (`font-serif`) cho tiêu đề + Geist (`font-sans`) thân bài + Geist Mono nhãn — đúng phân vai typography DESIGN.md; KHÔNG thêm Source Serif 4/Be Vietnam Pro (tránh nạp font mới cho 1 trang; Merriweather phủ tiếng Việt tốt). Engineer không phản đối.
- **Lệch có chủ đích so với template (ưu tiên DESIGN.md):** nút bo góc 4px (`rounded-[4px]`) thay pill của template — quy tắc "Shapes"; KHÔNG đổ bóng/gradient — quy tắc "Elevation & Depth" (chỉ hairline + màu phẳng). Gạch chân gradient tím→hồng của template → vàng đồng phẳng (rule-divider/accent).
- **Responsive:** `flex-col lg:flex-row`. Desktop: sidebar `lg:h-dvh lg:w-80` nav căn giữa dọc. Mobile: sidebar thành dải trên, nav xếp dọc. Không cần client JS (active tĩnh, hover thuần CSS) → sidebar là server component.
- Hoa văn nền: SVG `<line>` hairline `#1B1512` opacity .06, `vector-effect=non-scaling-stroke` giữ nét 1px dù `preserveAspectRatio=none` kéo giãn.

## UI Module: Homepage L1 (bố cục Hyperspace)
- **State:** Done (chờ engineer confirm visual)
  + `app/(layer1)/_components/HomeSidebar.tsx` (MỚI) — nav dọc, 4 link thật, active "Trang chủ" gạch vàng đồng, mục khác hairline ngà mờ + hover sáng. Server component. — Done
  + `app/page.tsx` (viết lại) — bỏ HomeHeader + `getCurrentUserProfile`; layout 2 cột sidebar|hero; hero: eyebrow mono + rule-divider vàng đồng + h1 serif "Trạng Nguyên" + đoạn mô tả (2 cụm gạch chân vàng đồng "cập nhật liên tục"/"tức thì") + CTA outline→đỏ son hover `/exams` + `<HeroLines>` SVG nền. — Done
  + Giữ nguyên `HomeHeader.tsx` (vẫn dùng ở `login/page.tsx`) — không đụng.

## Kết quả Testing (Homepage L1)
- `tsc --noEmit`: pass (exit 0). `next build`: pass — 8 routes; `/` chuyển **static (○)** (bỏ auth fetch). Đã `rm -rf .next` + rebuild cho `next start`.
- **Visual (Playwright CLI `npx playwright screenshot`, server `next start` :3100):**
  + Desktop 1280×800: sidebar đen sơn mài (nav phải, TRANG CHỦ active gạch vàng đồng, hairline mờ các mục khác) + hero ngà (eyebrow, rule-divider, tiêu đề serif dấu tiếng Việt chuẩn, gạch chân accent, nút outline, hoa văn kẻ mờ). Khớp bố cục `homepage.png`, màu theo DESIGN.md.
  + Mobile 375×812: sidebar thành dải trên (nav dọc, active gạch vàng đồng); hero dưới, tiêu đề wrap 2 dòng, không h-scroll.
  + Screenshot: `TEMP_SCREENSHOT/home-{desktop,mobile}.png` (giữ cho engineer đối chiếu; dọn khi Git).
- ⚠️ Playwright MCP chưa nạp trong session này (`.mcp.json` có config nhưng server chưa connect) → dùng Playwright CLI qua `npx @playwright/mcp`→`playwright screenshot`. Không bắt được console log qua CLI; trang static JS tối thiểu, rủi ro thấp.

> **Chờ engineer xác nhận visual để Git.** Server production đang chạy tại **http://localhost:3100** (port 3000 có tiến trình cũ chiếm). Chưa Git.

### Sửa vòng 1 (engineer feedback — 4 việc)
*Yêu cầu:* (1) h1 → "An Exam Practice Engine Integrated with a Chart-Based Analytics System, Capable of Generating New Data from PDF Files". (2) Toàn bộ chữ tiếng Việt → tiếng Anh, dùng **font DESIGN.md** (Source Serif 4 tiêu đề, Be Vietnam Pro thân bài/label). (3) Các mục nav dưới "Home" → "Analytics", "History", "Import". (4) Border mục active ("Home") → xám như các mục khác (bỏ gạch vàng đồng).
*Fixing process:*
- `app/layout.tsx` — nạp `Source_Serif_4` (`--font-source-serif`, subset latin, variable) + `Be_Vietnam_Pro` (`--font-be-vietnam`, subset latin+vietnamese, weight 400/500/600/700) qua `next/font/google`; thêm 2 var vào `<html>`. KHÔNG đổi font mặc định L2/L3/L4 (vẫn Merriweather/Geist qua token riêng) — chỉ homepage dùng 2 font mới.
- `HomeSidebar.tsx` — NAV đổi nhãn tiếng Anh: **Home** (`/`, active) · **Analytics** (`/me/dashboard`) · **History** (`#`) · **Import** (`/admin/import`). Bỏ `border-[#B8863B]` ở mục active → mọi mục dùng chung `border-[#EDE1C8]/12` (xám); active chỉ còn phân biệt bằng chữ sáng (`#EDE1C8` vs `/55`). Font nhãn `font-mono`→`font-[family-name:var(--font-be-vietnam)]` medium (label-caps DESIGN.md).
- `app/page.tsx` — h1 = câu dài mới, cỡ giảm `text-2xl sm:text-3xl lg:text-4xl` (câu ~20 từ, tránh quá lớn), font Source Serif 4 semibold; eyebrow "ONLINE EXAM PRACTICE PLATFORM"; đoạn mô tả tiếng Anh (giữ 2 cụm gạch chân vàng đồng "continuously updated"/"instant grading"); CTA "GET STARTED"→`/exams`. Eyebrow/CTA `font-mono`→Be Vietnam Pro. `max-w-2xl`→`max-w-3xl` (chứa h1 dài).
- ⚠️ Nav mới: Analytics/Import trỏ route L3/L4 **chưa build → 404** (đồng bộ với SiteHeader L2 vốn cũng vậy); History = `#` (chưa có route). Homepage KHÔNG còn link trực tiếp tới `/exams` (qua CTA) và `/login` — login vẫn tới được gián tiếp qua proxy khi vào route cần auth. Ghi nhận để engineer chỉnh đích nếu muốn.

## Kết quả Testing (sửa vòng 1)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes, `/` vẫn static (○). Verify prerendered `.next/server/app/index.html` chứa "Exam Practice Engine" + "Analytics", KHÔNG còn tiếng Việt.
- **Visual (Playwright CLI, `next start` :3200 — build sạch):** desktop 1280 + mobile 375 khớp: sidebar HOME/ANALYTICS/HISTORY/IMPORT (border xám đồng nhất, Home chữ sáng), hero Source Serif 4 h1 dài, Be Vietnam Pro thân bài, eyebrow + rule-divider + gạch chân accent + CTA outline→đỏ son hover. Không h-scroll mobile.
- ⚠️ **Gotcha đã gặp & xử lý:** `rm -rf .next` + rebuild nhưng tiến trình `next start` CŨ còn sống trên :3100 → phục vụ HTML cũ + CSS 404 (screenshot ra tiếng Việt không style). Fix: kill tiến trình cũ + start server sạch trên **:3200**. Bài học: sau `rm -rf .next` phải restart hẳn `next start` (kill process cũ), không chỉ rebuild.
- Screenshot: `TEMP_SCREENSHOT/home3-{desktop,mobile}.png`.

> **Chờ engineer xác nhận visual để Git.** Server production đang chạy tại **http://localhost:3200**. Chưa Git.

### Sửa vòng 2 (engineer feedback — ô account góc trái dưới)
*Yêu cầu:* Thêm một ô ở góc trái bên dưới màn hình hiển thị **avatar tài khoản + tên tài khoản**; tên quá dài → cắt bằng dấu "…".
*Fixing process:*
- `HomeSidebar.tsx` — nhận prop `user: { displayName: string } | null`. Thêm **ô account ghim đáy sidebar** (dưới nav): viền hairline `border-[#EDE1C8]/12`, avatar `user-avatar-placeholder.png` (32px, đĩa xám sáng — hiện rõ trên nền tối) + tên. Truncation bằng `min-w-0 flex-1 truncate` (ellipsis "…" khi vượt bề rộng ô — sidebar `lg:w-80`). Guest: ô là `<Link href="/login">` nhãn "Sign in"; authed: `<div>` tĩnh hiện `displayName`. Font Be Vietnam Pro.
- `app/page.tsx` — `export default async function` + `getCurrentUserProfile()` truyền `user` xuống sidebar. → `/` chuyển lại **dynamic (ƒ)** (đọc cookie auth mỗi request để cá nhân hoá ô account) — đánh đổi hợp lý, giống task IAM.
- Vị trí "góc trái dưới": desktop = đáy cột sidebar full-height (đúng nghĩa góc trái-dưới màn hình); mobile = đáy dải sidebar trên cùng (sau nav). Nếu engineer muốn ghim `fixed` đáy màn hình trên mobile → follow-up.

## Kết quả Testing (sửa vòng 2)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes, `/` chuyển **dynamic (ƒ)** (có chủ đích).
- **Visual (Playwright, `next start` :3300):**
  + **Guest** (không session): ô hiện avatar + "Sign in" ở đáy sidebar (desktop 1280) và đáy dải trên (mobile 375). `home4-{desktop,mobile}-guest.png`.
  + **Authed** (login test user `+rlstesta` qua script Playwright — Supabase đang UP, health 401 = sống): ô hiện avatar + tên hiển thị "quángon". `home5-{desktop,mobile}-authed.png`. Xác nhận flow dữ liệu thật (fetch profile từ DB).
- ⚠️ Playwright: MCP chưa nạp session này → chạy trực tiếp module `playwright` từ cache npx (`$env:NODE_PATH`) bằng script `scratchpad/login-shot.js` (login → screenshot authed). Browser dùng cache global ms-playwright.

> **Chờ engineer xác nhận visual để Git.** Server production đang chạy tại **http://localhost:3300**. Chưa Git.

---
---

# [Layer 1 + cross-layer] — Task: Auth transition trong homepage + đồng bộ theme Mực & Sơn mài (S#17, 2026-07-09)

- **Latest prompt:** "(cập nhật memory: xóa bỏ blueprint, chỉ dựa md files hiện tại + prompt engineer) *Transition giữa form auth và homepage — tạo transition giữa content area của homepage và form auth thay vì tách 2 page riêng. *Đồng bộ theme cho mọi UI Layer. *Engineer tự kiểm."
- **Latest step:** Testing ✅ (tsc + build pass; KHÔNG Playwright — engineer tự kiểm) — **chờ engineer xác nhận visual để Git**
- **Layer status:** Layer 1 — auth nhập vào homepage; cross-layer — theme Mực & Sơn mài (DESIGN.md) thành root cho toàn site.

### Quyết định C&D (engineer chốt — bảng Q1–Q4, chọn cả 4 recommended)
- Q1=A: **Một page duy nhất** — hero ⇄ AuthForm swap trong content area của `/` với animation 2 chiều; URL sync `?auth=signin|signup` (deep-link + proxy redirect); `/login` cũ thành redirect tương thích.
- Q2=A: **Đổi toàn bộ root tokens** (`globals.css`) sang palette Mực & Sơn mài — nền ngà `#EDE1C8`, chữ đen sơn mài `#1B1512`, primary đỏ son `#A62C2B`, accent vàng đồng `#B8863B`, hairline `#D8C9A8`. XÓA `.theme-l2` (navbar navy) + `.theme-ebp` (block xanh) — navbar mọi layer = đen sơn mài.
- Q3=A: **Font toàn site theo DESIGN.md** — Source Serif 4 (heading, thêm subset vietnamese) + Be Vietnam Pro (body). Gỡ Merriweather + Geist Sans khỏi layout (TTF vẫn giữ trong ASSETS); Geist Mono giữ cho `--font-mono` (timer, nhãn chữ cái).
- Q4=A: **Restyle AuthForm** theo Mực & Sơn mài (panel tab đen sơn mài + form ngà, nút đỏ son, focus underline vàng đồng, bỏ shadow/pill theo DESIGN.md).

### Quyết định kỹ thuật
- Transition: cả hero + AuthForm cùng mount trong 1 grid cell (`col-start-1 row-start-1`), swap bằng CSS transition opacity/translate; panel ẩn có `inert` (không tab vào được, a11y). Điều hướng bằng Link `/?auth=signin` (soft navigation — server re-render, client component không remount) → transition chạy mượt 2 chiều.
- `signOut` redirect `/login` → `/?auth=signin`. Middleware route guard redirect `/login` → `/?auth=signin`. AccountMenu guest links → `/?auth=signin|signup`. `/login/page.tsx` giữ lại làm redirect 1 dòng (link cũ không gãy, giữ trong PUBLIC_PATHS).
- `HomeHeader.tsx` thành dead code (chỉ login page cũ dùng) → XÓA.
- DESIGN.md "Elevation & Depth" (không shadow) → gỡ mọi hover shadow rgba trắng còn lại ở L2 (ExamCard, ExamFilters, StartAttemptButton glow) thay bằng border/màu phẳng; dropdown AccountMenu bỏ `shadow-sm`.

## Logic Module: Redirect wiring
- **State:** Done
  + `lib/supabase/middleware.ts` — guard redirect → `/?auth=signin` — Done
  + `(layer1)/actions.ts` — signOut → `/?auth=signin` — Done
  + `(layer1)/login/page.tsx` — thin redirect `/login[?mode=signup]` → `/?auth=...` — Done
  + `components/shared/AccountMenu.tsx` — guest links đích mới — Done

## UI Module: Homepage auth transition (L1)
- **State:** Done (chờ engineer confirm visual)
  + `(layer1)/_components/HomeStage.tsx` (MỚI) — client, hero + AuthForm cross-fade theo prop `auth` — Done
  + `app/page.tsx` — đọc `searchParams.auth`, authed + auth param → redirect `/exams`, render HomeStage — Done
  + `HomeSidebar.tsx` — "Sign in" → `/?auth=signin` — Done
  + `AuthForm.tsx` — restyle Mực & Sơn mài — Done
  + Xóa `HomeHeader.tsx` — Done

## UI Module: Theme đồng bộ (cross-layer)
- **State:** Done (chờ engineer confirm visual)
  + `globals.css` — root tokens Mực & Sơn mài + nav/block hooks + xóa .theme-l2/.theme-ebp + .eyebrow sang Be Vietnam Pro — Done
  + `app/layout.tsx` — gỡ Merriweather/Geist Sans, Source Serif 4 + subset vietnamese — Done
  + `(layer2)/layout.tsx` — bỏ class theme-l2 — Done
  + `exams/page.tsx` — bỏ class theme-ebp — Done
  + `ExamCard.tsx` / `ExamFilters.tsx` / `StartAttemptButton.tsx` / `result/detail/page.tsx` — gỡ shadow, màu phẳng theo theme — Done

## Kết quả Testing (S#17)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes; `/login` chuyển ƒ (chỉ còn redirect đọc searchParams). Đã `rm -rf .next` sau build (gotcha font manifest).
- Kill tiến trình dev server cũ tồn đọng trên port 3000 (PID 15796 — phiên trước) + start dev server SẠCH (bắt buộc vì có sửa `actions.ts` — gotcha Server Action HMR). `GET /` 200.
- **Visual + function: ENGINEER TỰ KIỂM** (theo phân công trong TE1). Checklist gợi ý: (1) `/` hero → click "Sign in" ở sidebar → form trượt/fade vào tại chỗ, sidebar đứng yên; (2) "← Back" quay về hero (transition ngược); (3) đăng nhập → về `/exams`; (4) đăng xuất từ L2 → về `/` với form mở; (5) truy cập `/exams` khi chưa login → redirect `/?auth=signin`; (6) `/login?mode=signup` cũ → mở đúng tab Đăng ký; (7) toàn bộ L2 (Browser/Detail/Player/Result) nền ngà + navbar đen sơn mài + font Source Serif 4/Be Vietnam Pro, chữ Việt có dấu chuẩn.

> **Chờ engineer xác nhận để Git.** Dev server sạch đang chạy tại **http://localhost:3000**.
> ⚠️ Lưu ý khi Git: các file homepage Hyperspace của task TRƯỚC (`HomeSidebar.tsx`, `page.tsx`, `layout.tsx`…) chưa từng được commit — task này sửa đè tiếp lên chúng, nên commit tới sẽ gộp cả hai đợt thay đổi (homepage mới + auth transition + theme sync).

### Sửa vòng 1 (engineer feedback — bổ sung + sửa)
*Yêu cầu:* (1) Ô profile → dropdown "Edit"/"Sign out" function thật. (2) Sidebar: tag nav "Account" khi CHƯA có account. (3) Nền panel trái form auth dùng `ASSETS/images/brand_logo.png`. (4) Transition auth⇄hero đổi hướng dưới-lên → PHẢI-TRÁI. (5) Đã đăng nhập: tag "Account" ẩn, thay bằng ô profile riêng góc dưới-trái. (6) Homepage không cần cuộn trang. (Bullet "Thêm" cuối để trống — bỏ qua, chờ engineer bổ sung nếu có.)
*Fixing process:*
- `SidebarProfile.tsx` (MỚI, client) — ô profile đáy sidebar, click mở **dropup** (mở lên trên vì ô nằm đáy màn hình): "Edit" = đổi display_name inline qua `updateProfile` (ràng buộc ≤12 ký tự chữ+chấm như AccountMenu, router.refresh sau khi lưu); "Sign out" = form `signOut`. Panel ngà trên sidebar đen (phân lớp bằng màu, không shadow). Nhãn tiếng Anh.
- `HomeSidebar.tsx` — guest: nav thêm tag "Account" (→ `/?auth=signin`), KHÔNG có ô đáy; authed: tag "Account" không render, ô `SidebarProfile` hiện ở góc dưới-trái. Nav mobile nén `py-2.5` (desktop giữ `lg:py-3.5`).
- `AuthForm.tsx` — bỏ hoạ tiết mũi tên CSS; nền panel trái = `brand_logo.png` watermark (absolute center, opacity 25%, w-3/4). Logo gốc có viền trắng bao quanh → đã **trim bằng sharp** (715×650) xuất `SOURCE/public/images/brand_logo.png`. Form nén dọc nhẹ (py-9→7, avatar 16→14, social mt-8→6).
- `HomeStage.tsx` — transition đổi trục: hero ẩn `-translate-x-6`, form ẩn `translate-x-6` (phải→trái, giữ 500ms fade). Container thêm `my-auto w-full` (căn giữa dọc trong main scrollable). Hero nén: h1 `text-xl` mobile, mt/CTA gọn lại.
- `app/page.tsx` — root `min-h-dvh` → **`h-dvh overflow-hidden`** (trang KHÔNG cuộn); main `overflow-y-auto min-h-0` + padding giảm (`py-8 lg:py-10` thay `py-20/24`) — nội dung tự cuộn NỘI BỘ chỉ khi màn quá thấp, không cắt nội dung.

## Kết quả Testing (sửa vòng 1)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi.
- Dev server restart SẠCH (stop task cũ + kill child PID 9504 chiếm :3000 + `rm -rf .next` — build vừa chạy chung `.next` với dev server nên phải dọn) → `GET /` 200.
- **Visual + function: ENGINEER TỰ KIỂM** tại **http://localhost:3000**. Điểm mới cần xem: tag Account (guest) / ô profile dropup Edit+Sign out (authed, đăng nhập test user `+rlstesta`), transition ngang phải-trái, logo PAGS mờ trên panel trái form, trang không có scrollbar dọc ở cả hero lẫn form view (1280×800 + 375×812).

> **Chờ engineer xác nhận để Git.**

---
---

# [Cross-layer: App Shell] — Task: SPA hoá + tối ưu first-load + hệ thống transition (S#18, 2026-07-09)

- **Latest prompt:** "Chuyển website thành SPA. Kiến trúc UI tối ưu giảm tối đa độ trễ lần load đầu. Transition giữa các component ≥1–1.8s + cubic bezier (chậm đầu → đỉnh vận tốc t=1/2 → giảm → dừng). Lưu ý: làm từng bước một, chặt chẽ, không nhảy cóc."
- **Latest step:** Testing ✅ (tsc + build pass; engineer kiểm 1 lần cuối theo Q4) — **chờ engineer xác nhận để Git**
- **Layer status:** Cross-layer — app shell (routing/transition/perf), không đổi business logic.

### Quyết định C&D (engineer chốt — bảng Q1–Q4)
- Q1=A: **SPA = SSR shell + điều hướng client 100%** (giữ Next.js; first-load SSR nhanh, sau đó mọi navigation soft không reload — trải nghiệm SPA). KHÔNG chuyển one-route/Vite CSR.
- Q2=B: `/` **giữ dynamic** (đọc cookie auth mỗi request) — không đưa về static.
- Q3=A: Transition 1.4s áp cho **mọi chuyển màn lớn** (homepage⇄auth, browser→detail→player→result), **TRỪ chuyển câu trong ExamPlayer** (giữ instant — Focus Mode).
- Q4=B: Chạy liền 3 bước, engineer kiểm 1 lần cuối.

### Quyết định kỹ thuật
- Curve theo mô tả engineer (chậm đầu, đỉnh vận tốc t=1/2, chậm cuối) = ease-in-out đối xứng **`cubic-bezier(0.65, 0, 0.35, 1)`**; duration **1.4s** (giữa khoảng 1–1.8s). Đặt thành token `--stage-duration`/`--stage-ease` ở `:root` — chỉnh một chỗ.
- Transition route-level = **entry animation qua `template.tsx`** (Next remount template mỗi lần đổi route segment; searchParams đổi KHÔNG remount → HomeStage hero⇄auth giữ cơ chế riêng, chỉ đồng bộ duration/curve). KHÔNG dùng View Transitions API (experimental flag + React unstable API — rủi ro với Next 16.2.7; ghi nhận làm nâng cấp sau nếu muốn cross-fade cả màn cũ).
- **Không animate lần load đầu** (mâu thuẫn mục tiêu first-load): flag module-scope client — lần mount đầu tiên sau page load bỏ animation, các navigation sau mới animate.
- Đặt template ở `app/(layer2)/template.tsx` (animate vùng page DƯỚI navbar — navbar sticky đứng yên) + bọc `StageEnter` cho homepage. Chuyển câu trong Player là client state (không đổi route) → tự động ngoài phạm vi ✓.

## Bước 1 — SPA hoá điều hướng
- **State:** Done — **audit KHÔNG phát hiện gì phải sửa**: 100% điều hướng qua `next/link` (auto-prefetch mặc định, không chỗ nào tắt) + Server Action `redirect()` (soft navigation); grep sạch `<a>` thuần / `window.location` / `location.href`. Kiến trúc hiện tại đã đạt chuẩn SPA-experience trên SSR shell.

## Bước 2 — First-load
- **State:** Done
  + `app/layout.tsx` — Be Vietnam Pro weight ["400","500","600","700"] → **["400","500"]** (grep xác nhận: `font-bold`/700 không dùng ở đâu; `font-semibold`/600 chỉ trên h1 serif = Source Serif 4 variable tự phủ) → bớt 4 file font preload ở first paint. — Done
  + Nền tảng có sẵn giữ nguyên (đã tối ưu từ trước): route-level code splitting (KaTeX/react-markdown chỉ nằm trong bundle Player/Result), `next/image` cho mọi ảnh (brand_logo 497KB nguồn → serve WebP resize), `next/font` self-host. `/` giữ dynamic theo Q2=B. — Done

## Bước 3 — Hệ thống transition
- **State:** Done
  + `globals.css` — token `--stage-duration: 1.4s` + `--stage-ease: cubic-bezier(0.65,0,0.35,1)`; keyframes `stage-enter` (fade + trượt phải→trái 28px); class `.stage-enter` (entry) + `.stage-swap` (swap tại chỗ) — Done
  + `components/shared/StageEnter.tsx` (MỚI, client) — bọc màn, animate entry khi navigate; **KHÔNG animate lần load đầu** (cờ module-scope `hasNavigated`; initializer thuần + set cờ trong useEffect — an toàn StrictMode) — Done
  + `app/(layer2)/template.tsx` (MỚI) — Next remount template mỗi lần đổi route trong L2 → mọi chuyển màn Browser→Detail→Player→Result animate; navbar ở layout (trên template) đứng yên như app shell; đổi searchParams (filter) KHÔNG remount → lọc đề vẫn instant — Done
  + `app/page.tsx` — bọc `<HomeStage>` trong `<StageEnter className="relative z-10 my-auto w-full">` (homepage animate khi navigate về từ L2) — Done
  + `HomeStage.tsx` — 2 panel hero/auth đổi `duration-500 ease-out` → class `stage-swap` (cùng 1.4s + curve, một nguồn token) — Done
  + Chuyển câu ExamPlayer: client state, không đổi route → tự động NGOÀI phạm vi (đúng Q3) — Done

## Kết quả Testing (S#18)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi. Đã stop dev server TRƯỚC khi build (tránh chung `.next`), `rm -rf .next` sau build, restart dev sạch.
- Smoke: `GET /` 200; `GET /exams` (guest) 307 → redirect auth đúng.
- **Visual + cảm nhận transition: ENGINEER KIỂM 1 LẦN CUỐI (Q4=B)** tại **http://localhost:3000**. Checklist: (1) first load `/` KHÔNG có animation (vào thẳng); (2) CTA "Get started" → /exams: vùng dưới navbar trượt vào 1.4s chậm-nhanh-chậm; (3) exams → detail → player → result → detail-câu: mỗi bước 1.4s, navbar đứng yên, KHÔNG full reload (network chỉ fetch RSC); (4) chuyển câu trong player + lọc đề: instant; (5) hero⇄auth: cùng nhịp 1.4s; (6) quay về `/` từ L2: homepage trượt vào.
- ⚠️ Ghi chú kỹ thuật: transition là ENTRY animation (màn mới trượt vào, màn cũ rời instant). Nếu engineer muốn cross-fade cả màn cũ lẫn mới → cần View Transitions API (Next experimental flag) — để dành nâng cấp riêng, không gộp vào đây (API còn unstable trên Next 16.2.7).

> **Chờ engineer xác nhận để Git.** Dev server sạch tại **http://localhost:3000**.


### ⏪ HOÀN TÁC TOÀN BỘ S#18 (engineer yêu cầu — "đưa mọi thứ về như lúc chưa làm SPA")
- Task chưa Git nên revert thủ công đủ 6 thay đổi: (1) `app/layout.tsx` — Be Vietnam Pro về lại weight ["400","500","600","700"]; (2) `globals.css` — xóa khối STAGE TRANSITION (token `--stage-*`, keyframes, `.stage-enter`, `.stage-swap`); (3) XÓA `components/shared/StageEnter.tsx`; (4) XÓA `app/(layer2)/template.tsx`; (5) `app/page.tsx` — bỏ import + bọc StageEnter, HomeStage render trực tiếp như cũ; (6) `HomeStage.tsx` — root về `relative z-10 my-auto grid w-full`, 2 panel về `transition-all duration-500 ease-out`.
- Grep xác nhận không còn tham chiếu `StageEnter`/`stage-enter`/`stage-swap`/`--stage-` trong SOURCE.
- `tsc --noEmit` pass; `next build` pass (8 routes). `rm -rf .next` + restart dev server sạch.
- **Trạng thái code = đúng cuối S#17 vòng sửa 1** (auth transition trong homepage + theme Mực & Sơn mài + profile dropup + no-scroll) — vẫn chờ engineer xác nhận S#17 để Git.
- Section S#18 giữ nguyên phía trên làm lịch sử (quy tắc PROCESS.md không xóa section cũ).

**Latest step (S#18): REVERTED ⏪.** Chờ TE1 tiếp theo.

### Sửa vòng 2 — S#17 (engineer feedback kèm screenshot login)
*Yêu cầu:* (1) Tab "Đăng nhập"/"Đăng ký": bg đỏ son, trong suốt ~50%. (2) Nhấn tag nào trong sidebar → tag đó highlight đỏ son.
*Fixing process:*
- `AuthForm.tsx` (TabButton) — tab active: `bg-[#EDE1C8] text-[#1B1512]` → **`bg-[#A62C2B]/50 text-[#EDE1C8]`** (đỏ son 50%, chữ ngà cho đủ tương phản trên nền panel đen).
- `HomeSidebar.tsx` — tag active theo URL: nhận prop `authOpen` (page.tsx truyền `authMode !== null`); `activeLabel = authOpen ? "Account" : "Home"`. Tag active = **`bg-[#A62C2B] text-[#EDE1C8]`** (nền đỏ son + chữ ngà — KHÔNG dùng chữ đỏ trên nền đen vì DESIGN.md cấm đỏ son trên đen sơn mài ở cỡ chữ nhỏ, thiếu tương phản). Mọi tag thêm `active:bg-[#A62C2B]/60` (pseudo-class) → phản hồi đỏ son NGAY lúc nhấn, kể cả tag dẫn đi route khác (Analytics/Import). Bỏ field `active` tĩnh trong NavItem; rows thêm `px-3` đồng nhất.
- `tsc --noEmit` pass; dev server HMR (chỉ sửa className client components, không đụng Server Action). `GET /` 200.
- Chờ engineer kiểm visual.

### Sửa vòng 3 — S#17 (engineer chỉnh lại vòng 2)
*Yêu cầu:* (1) Sidebar: highlight CHỮ đỏ son, KHÔNG thêm bg cho tag. (2) Tab Đăng ký/Đăng nhập: bg đổi sang VÀNG ĐỒNG, giữ nguyên transparent (50%).
*Fixing process:*
- `HomeSidebar.tsx` — tag active: bỏ `bg-[#A62C2B]` → **`text-[#A62C2B]`** (chữ đỏ son); pseudo `active:` cũng chỉ đổi chữ (`active:text-[#A62C2B]`); bỏ `px-3`.
- `AuthForm.tsx` (TabButton) — tab active: `bg-[#A62C2B]/50` → **`bg-[#B8863B]/50`** (vàng đồng 50%), chữ ngà giữ nguyên.
- `tsc` pass, HMR áp tại chỗ, `GET /` 200. Chờ engineer kiểm visual.

### Git — Done (2026-07-09, kết phiên)
Commit `e039f06`, push `origin/main` ✅ — 51 file (+569/−1271), gộp trọn chuỗi chưa-Git từ 2 phiên: bỏ homepage 3D (xóa 4 component + models/textures ASSETS & public, gỡ deps three trong package.json) → homepage Hyperspace (`HomeSidebar.tsx`) → S#17 auth transition trong homepage (`HomeStage.tsx`, `SidebarProfile.tsx`, `/login` redirect, xóa `HomeHeader.tsx`) + đồng bộ theme Mực & Sơn mài toàn site (globals.css root tokens, font Source Serif 4/Be Vietnam Pro, xóa .theme-l2/.theme-ebp) + brand_logo (ASSETS nguồn + public trimmed) + 3 vòng sửa (dropup profile, tab vàng đồng 50%, highlight chữ đỏ son).
**KHÔNG stage** (đúng quy tắc): `PROCESS.md`, `WORKFLOW.md`, `DESIGN.md`, `(only for engineer) UX-FEEL-CHECKLIST.md`, deletions `TEXT/`+`TEMPLATE/homepage/homepage_desktop.png`, `TEMPLATE/homepage/homepage.png`, `.claude/`, `.mcp.json`, `.playwright-mcp/`, stray `ASSETS/images/*.eps`+`License *.txt`+`blank-user-circles/` — engineer xử lý riêng.

## Tiến độ tổng thể (kết phiên 2026-07-09 — S#17/S#18)
```
GĐ 0 — Nền Móng              : [x] Done
GĐ 1 — Functional Prototype  : [x] Done
GĐ 2 — Connected Prototype   : [x] Done
GĐ 3 — Polish (MVP ship)     : [ ] In Progress
  M3.1 Visual language L2    : [x] Done
  M3.2 Responsive L2         : [x] Done
  M3.3 Homepage 3D           : [x] ĐÃ BỎ HẲN (thay bằng homepage Hyperspace + theme DESIGN.md)
  M3.4 Homepage Mobile       : [x] Không còn cần (homepage mới responsive sẵn)
  M3.5 Personalization       : [ ] Not Started
  M3.6 Transitions & SEO     : [ ] Not Started
─────────────────────────────
Ngoài roadmap gốc — phiên này:
  Homepage Hyperspace (sidebar + hero, Mực & Sơn mài)  : [x] Done (e039f06)
  Auth transition in-place + /login redirect            : [x] Done (e039f06)
  Theme Mực & Sơn mài đồng bộ toàn site                 : [x] Done (e039f06)
  SidebarProfile dropup (Edit/Sign out)                 : [x] Done (e039f06)
  SPA/transition 1.4s (S#18)                            : [⏪] REVERTED theo yêu cầu
─────────────────────────────
Post-MVP A — Layer 3         : [ ] Not Started
Post-MVP B — Layer 4         : [ ] Not Started
```

**✅ Git hoàn thành. Kết thúc phiên 2026-07-09.** Chờ TE1 phiên sau.

---
---

# [Layer 2: Core Loop] — Task: Redesign ExamBrowser — navbar kiểu homepage (top) + grid 3 cột (S#19, 2026-07-10)

- **Latest prompt:** "*Thiết kế lại UI Layer 2 - trang ExamBrowser. - Sửa lại navbar theo mẫu của homepage nhưng nằm phía trên thay vì là một sidebar. - Đặt lại vị trí của các element sao cho ở section hiển thị CardExam, nó có thể hiển thị tới 3 card trên cùng một hàng với gap đều nhau."
- **Latest step:** Testing ✅ (tsc + build + visual Playwright) — **chờ engineer xác nhận visual để Git**
- **Layer status:** Layer 2 — style (GĐ 3 Polish, ngoài roadmap gốc — tiếp chuỗi đồng bộ theme S#17).

### Quyết định C&D (engineer chốt qua AskUserQuestion)
- Q1: Sửa thẳng **SiteHeader dùng chung** (L2/L3/L4 đồng bộ style navbar mới) — không tạo navbar riêng cho /exams.
- Q2: **Đổi hẳn nav items sang bộ của HomeSidebar** — Home / Analytics / History / Import + Account, nhãn tiếng Anh, đồng bộ 100% homepage.
- Q3: Grid 3 card/hàng — **nới container** (max-w-3xl → rộng hơn), GIỮ *Filter tay nắm sticky-trái + overlay như hiện tại.

### Quyết định kỹ thuật
- Active tag xác định bằng `usePathname()` (header sống trên nhiều route, khác homepage dùng prop tĩnh); style active = CHỮ đỏ son (đúng chốt S#17 vòng 3 — không bg).
- Authed: tag "Account" thay bằng ô profile (avatar + tên + dropdown Edit/Sign out MỞ XUỐNG — header ở đỉnh màn, ngược với SidebarProfile dropup) → component MỚI `components/shared/HeaderProfile.tsx`, tái dùng Server Actions `updateProfile`/`signOut`.
- `AccountMenu.tsx` không còn nơi nào dùng sau thay thế → XÓA (type `MenuUser` chuyển vào HeaderProfile).
- Giữ `h-14` + sticky top-0 → KHÔNG phải sửa offset `top-14` ở ExamFilters/ExamPlayer top bar.

## UI Module: SiteHeader kiểu homepage (dùng chung L2/3/4)
- **State:** Done (chờ engineer confirm visual)
  + `components/shared/HeaderProfile.tsx` (MỚI) — ô profile (avatar + tên truncate + chevron) dropdown MỞ XUỐNG Edit/Sign out, panel ngà trên navbar đen; cùng logic/Server Actions với SidebarProfile; export `MenuUser` (chuyển từ AccountMenu). Tên ẩn max-sm (tránh h-scroll 375px). — Done
  + `SiteHeader.tsx` — viết lại: logo trái (ẩn max-sm — tag Home gánh vai trò neo) + dãy tag Home/Analytics/History/Import (+Account guest / HeaderProfile authed); style chép HomeSidebar (uppercase tracking-[0.2em], muted 55% → hover ivory, active = CHỮ đỏ son theo `usePathname()`, bỏ hairline chia dòng vì nằm ngang); giữ h-14 sticky (offset top-14 của ExamFilters/ExamPlayer không đổi). — Done
  + XÓA `components/shared/AccountMenu.tsx` (không còn nơi dùng) — Done

## UI Module: ExamBrowser grid 3 cột
- **State:** Done (chờ engineer confirm visual)
  + `exams/page.tsx` — nới main max-w-3xl → **max-w-6xl** (khớp bề ngang navbar) — Done
  + `ExamBrowser.tsx` — grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, gap-4 đều — Done

## Updating
- Comment trỏ AccountMenu → HeaderProfile/SidebarProfile: `lib/auth/getCurrentUser.ts`, `(layer1)/actions.ts`, `SidebarProfile.tsx`. Grep sạch `AccountMenu`/`MenuUser` mồ côi.

## Kết quả Testing (S#19)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi (kill PID cũ chiếm :3000 + `rm -rf .next` trước build, dọn `.next` + dev server sạch sau build — đúng gotcha đã ghi).
- **Visual (Playwright MCP, login test user `+rlstesta`):**
  + Desktop 1280 `/exams`: navbar ngang kiểu homepage (logo · HOME/ANALYTICS/HISTORY/IMPORT · ô profile "kháhay"), lưới 3 cột — 2 đề trong DB mỗi card chiếm đúng 1/3, gap đều; tay nắm Bộ lọc + 3 checkbox lọc nhanh giữ nguyên vị trí.
  + Dropdown profile mở xuống: panel ngà Edit/Sign out ✓.
  + Mobile 375: 1 cột card; navbar 4 tag + avatar (tên + logo ẩn max-sm). **Fix trong phiên:** bản đầu ô profile tràn mép phải gây h-scroll → ẩn tên ở max-sm + gap-3; verify JS `scrollWidth=375=clientWidth` (không h-scroll).
  + Desktop `/exams/exam-toan-10` (Detail): thừa hưởng navbar mới qua (layer2)/layout, layout nguyên vẹn.
  + **0 console errors.**
- Screenshot: `TEMP_SCREENSHOT/s19-{exams-desktop,exams-desktop-profile-open,exams-mobile,exam-detail-desktop}.png`.
- ⚠️ **Issue TỒN TẠI TỪ TRƯỚC (không do S#19):** ở mobile 375px, nhãn 3 ô lọc nhanh ("Mới nhất/Cũ nhất/Khó nhất") bị cắt mép trái ("…ất") — khối absolute `right-0 w-max` neo mép phải tay nắm, text nở sang trái vượt viewport (không gây h-scroll, chỉ bị cắt). Chờ engineer quyết cách xử lý (đổi neo sang trái ở mobile / rút gọn nhãn / chấp nhận).

> **Chờ engineer xác nhận visual để Git.** Dev server sạch đang chạy tại **http://localhost:3000**.

---
---

# [Cross-layer] — Task: English hoá toàn site + đề Hóa Học 10 + logo ảnh navbar (S#20, 2026-07-10)

- **Latest prompt:** "*Đổi ngôn ngữ và chỉnh sửa vài chỗ: - Ngoài tên của đề ôn, mọi component khác trong website đều phải chuyển sang tiếng Anh. - Bổ sung thêm một đề ôn vào DB để kiểm thử bố cục mới của trang. - Ở item logo trong navbar, sử dụng 'brand_logo.png' để thay thế. - Engineer tự test. Áp dụng cho toàn website."
- **Latest step:** Testing ✅ (tsc + build + seed live-DB) — **ENGINEER TỰ TEST visual, chờ xác nhận để Git**
- **Layer status:** Cross-layer — i18n strings (UI) + seed data (Logic), tiếp sau S#19.

### Quyết định C&D (engineer chốt qua AskUserQuestion + approach confirm)
- Q1: **Dịch cả data subject trong DB** — "Toán"→"Math", "Vật Lý"→"Physics" (sửa fake-data + re-seed). UI thuần English trừ title đề.
- Q2: Đề mới = **Hóa Học 10** — `exam-hoa-10`, subject "Chemistry", title tiếng Việt "Đề luyện Hóa Học 10 — Nguyên tử & Bảng tuần hoàn", 5 câu tiếng Việt.
- Ranh giới data: nội dung câu hỏi + đáp án + topics giữ TIẾNG VIỆT (nội dung đề, gắn với title); subject là metadata filter → English.
- Comment code nội bộ giữ tiếng Việt (không phải UI string).
- Logo navbar: text "Trạng Nguyên" → `next/image` brand_logo.png (public/images, bản trimmed), giữ ẩn max-sm.
- Visual: engineer TỰ TEST (theo TE1) — agent chỉ tsc + build + seed + dev server sạch.

## Logic Module: Data + server messages
- **State:** Done
  + `lib/fake-data/exams.ts` — subject "Toán"→"Math", "Vật Lý"→"Physics"; THÊM đề `exam-hoa-10` "Đề luyện Hóa Học 10 — Nguyên tử & Bảng tuần hoàn" (subject "Chemistry", 5 câu q-h10-1…5, đáp án verify tay A/C/B/D/A, topics "Nguyên tử"/"Bảng tuần hoàn") — Done
  + Chạy `npx tsx supabase/seed.ts` — **✓ Seed 15 câu hỏi, ✓ 3 đề** (upsert live-DB) — Done
  + `(layer1)/actions.ts` — 4 validation messages updateProfile → English; `(layer2)/actions.ts` không có UI string (chỉ comment) — Done

## UI Module: English hoá strings + logo navbar
- **State:** Done (engineer tự test visual)
  + AuthForm — tabs/heading Sign in/Sign up, placeholders Display name/Password, Forgot password?, Processing…, "Or sign in/sign up with", title Coming soon — Done
  + ExamPlayer — "N questions unanswered", Submit/Submitting…; ExamTimer aria "Time remaining"; FlagButton titles Flag/Unflag; QuestionRenderer "Question N / M" + legend "Choose an answer"; QuestionPagination aria "Question N (answered/flagged)" — Done
  + ExamCard — "Grade N", School/Level; ExamBrowser empty state "No matching exams"; ExamFilters — Filters/·active, Subject/Grade/School/Year/Semester/Level, All/"Grade N", Newest/Oldest/Hardest, Clear filters, "Coming soon — available in a future release" — Done
  + Detail — ← Back, Questions/Duration/min, StartAttemptButton "Start" — Done
  + Result — eyebrow Result, Correct/Wrong/Time, Topics (bỏ prefix "Câu" trước topic — topic giữ tiếng Việt là data), save/share, Home, View details/Try again — Done
  + Result Detail — Attempt details, "N/M correct", Correct/Wrong/Skipped, Question N, Correct answer/Your choice, ← Back to results — Done
  + `app/layout.tsx` — metadata description English + `lang="vi"` → `lang="en"` — Done
  + `SiteHeader.tsx` — logo text "Trạng Nguyên" → `next/image` brand_logo.png (h-9 w-auto, alt giữ tên thương hiệu), aria-label Home — Done

## Kết quả Testing (S#20)
- Quét lại: không còn UI string tiếng Việt ngoài comment code (grep diacritics, loại trừ comment + fake-data). Data giữ tiếng Việt đúng chốt: title đề, nội dung câu hỏi/đáp án, topics.
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi. Kill dev server cũ trước build + `rm -rf .next` sau build + dev server sạch (gotcha).
- Seed live-DB: **pass** — 15 câu + 3 đề (2026-07-10). Đề Chemistry sẽ hiện làm card thứ 3 trên lưới 3 cột /exams.
- Smoke: `GET /` 200; `GET /exams` (guest) 307 redirect auth đúng.
- **Visual + function: ENGINEER TỰ TEST** tại **http://localhost:3000** (test account `smithnguyen247+rlstesta@gmail.com` / `rls-test-password-123`). Checklist gợi ý: (1) /exams lưới 3 card/hàng (Math/Physics/Chemistry) desktop 1280; (2) logo ảnh navbar (desktop, ẩn mobile); (3) filter Subject=Chemistry → 1 đề; (4) full loop đề Hóa: Start → làm 5 câu → Submit → Result/Details — toàn bộ chrome English, đề + topics tiếng Việt; (5) form auth Sign in/Sign up; (6) Edit tên quá 12 ký tự → error English.

> **Chờ engineer xác nhận để Git.** Dev server sạch đang chạy tại **http://localhost:3000**.

---
---

# [Cross-layer: App Shell] — Task: Navbar cao hơn + logo +6% · rename PAGS · preloader stagger (S#21, 2026-07-10)

- **Latest prompt:** "Sửa: - Tăng chiều cao navbar để tăng kích thước logo (~6%). - Đổi tên project trong source code thành 'PAGS'. Bổ sung: - Preloader: từ trên xuống dưới, các element fade in lần lượt trong 1.5 giây, cubic bezier 'bình thường ở đầu, chậm dần ở cuối'."
- **Latest step:** Testing ✅ (tsc + build + verify JS/screenshot) — **chờ engineer xác nhận để Git**
- **Layer status:** Cross-layer — app shell (navbar/branding/animation), không đổi business logic.

### Quyết định C&D (engineer chốt)
- Preloader áp dụng **TOÀN BỘ trang** (homepage + mọi trang L2); element remount khi đổi route → chuỗi fade chạy lại mỗi lần vào trang (kiêm transition vào trang).
- PAGS = **package.json (`"pags"`) + metadata title tab ("PAGS")**.
- Navbar `h-14`→`h-15` (60px), logo `h-9` (36px) → `h-[38px]` (+6%); sửa 2 sticky offset `top-14`→`top-15` (ExamFilters + ExamPlayer top bar).
- Preloader thuần CSS: token `--preload-duration: 750ms` + `--preload-step: 250ms` + `--preload-ease: cubic-bezier(0.25,0.46,0.45,0.94)` (ease-out); order 0–3 → phần tử cuối kết thúc đúng 1.5s. `prefers-reduced-motion` → tắt.

## UI Module: App shell
- **State:** Done (chờ engineer confirm)
  + `globals.css` — token `--preload-{duration,step,ease}` + keyframes `preload-fade` (opacity + translateY -8px→0) + class `.preload-fade` (delay = order × 250ms, fill-mode `both` chống nháy trước delay) + `prefers-reduced-motion` tắt animation — Done
  + `SiteHeader.tsx` — `h-15`, logo `h-[38px]` (width 42), preload order 0 — Done
  + `ExamFilters.tsx` — `top-15`, preload order 1; **NHÂN TIỆN gỡ `shadow-lg`/`shadow-md` sót lại** ở panel + options (vi phạm quy tắc "không đổ bóng" DESIGN.md, lọt lưới đợt S#17) — Done
  + `ExamPlayer.tsx` — top bar `top-15` order 1, vùng câu hỏi order 2, pagination + submit order 3 — Done
  + `HomeSidebar.tsx` order 0 + `app/page.tsx` main order 1 — Done
  + exams (lưới order 2) · detail (back 1, khối 2) · result (score 1, grid 2, nav 3) · result/detail (header 1, list 2, back 3) — Done
  + `package.json` `"name": "pags"` + `layout.tsx` title `"PAGS"` — Done

## Kết quả Testing (S#21)
- `tsc --noEmit`: pass. `next build`: pass — 8 routes không đổi. Kill dev server cũ trước build + `rm -rf .next` + dev server sạch (gotcha).
- **Verify bằng JS trên browser (Playwright, /exams authed):** navbar `60px` ✓ · logo `38px` (+6% từ 36) ✓ · animation `preload-fade 0.75s cubic-bezier(0.25,0.46,0.45,0.94)` ✓ · filter sticky `top: 60px` khớp navbar mới ✓ · lưới 3 card đều `349.66px × 3` (Chemistry/Physics/Math) ✓ · không h-scroll ✓ · **0 console errors** ✓ · `<title>PAGS</title>` ✓.
- Screenshot: `TEMP_SCREENSHOT/s21-exams-desktop.png`.
- **Cảm nhận chuỗi fade (nhịp/độ mượt) + mobile: ENGINEER TỰ KIỂM** tại **http://localhost:3000**. Checklist: (1) mỗi trang load → các khối fade lần lượt trên→dưới, kết thúc ~1.5s; (2) chuyển route → chuỗi fade chạy lại; (3) homepage sidebar→content; (4) player: navbar→top bar→câu hỏi→pagination/submit; (5) tab trình duyệt hiện "PAGS".

> **Chờ engineer xác nhận để Git.** Dev server sạch đang chạy tại **http://localhost:3000**.

---
---

# [Layer 1 + 2] — Task: Sửa filter (align/dropdown/Clear) · logo cạnh h1 · h1 mới · rename MS-MOLAR (S#22, 2026-07-10)

- **Latest prompt:** "*Sửa filter: - Edge trên của filter ngang hàng với ExamCard. - Dropdown menu của filter nằm kề edge phải của filter button thay vì đè lên. - Thêm nút 'Clear' bên phải ngang hàng tiêu đề trong dropdown. *Bổ sung homepage: - Brand logo ngang hàng bên phải h1, gap vừa đủ, kích thước (15vh, 15vw). *Sửa homepage: - h1 → 'Multi-Subject & Multi-Grade Online Learning Platform with Digital Footprint Analytics and User-Generated Content Synthesis'. *Sửa source: - Đổi tên dự án thành 'MS-MOLAR'."
- **Latest step:** Testing ✅ (tsc + build + verify browser) — **chờ engineer xác nhận để Git**
- **Layer status:** Layer 2 (filter) + Layer 1 (hero) + branding.

### Quyết định C&D (engineer chốt)
- Logo hero: khung 15vw×15vh + **object-contain** (giữ tỉ lệ ảnh 715×650, không méo — engineer chọn qua AskUserQuestion).
- Panel filter: đổi `left-0` (đè tay nắm) → **`left-full`** (kề mép phải tay nắm), vẫn overlay đè list.
- Nút "Clear" trong header panel (phải, ngang tiêu đề) — GỠ nút "Clear filters" cũ cuối panel (tránh trùng), dọn `ClearButton`.
- Align filter: thêm `pt-5` wrapper sticky khớp `py-5` cột card.
- MS-MOLAR = package.json `"ms-molar"` + metadata title "MS-MOLAR" (pattern PAGS S#21).

## UI Module: ExamFilters (L2)
- **State:** Done (chờ engineer confirm)
  + `ExamFilters.tsx` — wrapper sticky thêm `pt-5` (edge trên tay nắm ngang hàng ExamCard, khớp `py-5` cột card); panel `left-0` → **`left-full`** (kề mép phải tay nắm, không đè filter button); header panel thành hàng `justify-between`: toggle (tam giác + "Filters") trái · nút **"Clear"** phải ngang tiêu đề (disabled khi chưa lọc); GỠ nút "Clear filters" cũ cuối panel + component `ClearButton` (hết nơi dùng) — Done

## UI Module: Homepage hero (L1)
- **State:** Done (chờ engineer confirm)
  + `HomeStage.tsx` — h1 đổi content "Multi-Subject & Multi-Grade Online Learning Platform with Digital Footprint Analytics and User-Generated Content Synthesis"; bọc h1 + logo trong `flex flex-wrap items-center gap-6 lg:gap-8`; logo `next/image` brand_logo.png khung `15vw×15vh` + `object-contain` (giữ tỉ lệ, không méo), `flex-wrap` để logo xuống dòng khi màn quá hẹp — Done

## Chore: Rename MS-MOLAR
- **State:** Done
  + `package.json` `"name": "ms-molar"` + `layout.tsx` title `"MS-MOLAR"` — Done

## Kết quả Testing (S#22)
- `tsc --noEmit`: pass. `next build`: pass. Kill dev server cũ + `rm -rf .next` trước/sau build + dev server sạch (gotcha).
- **Verify browser (Playwright, /exams authed):** tay nắm Filters `top: 81px` = card `top: 81px` (ngang hàng ✓); panel mở KỀ mép phải tay nắm, tay nắm vẫn hiện, overlay đè card + scrim ✓; header panel "▼ FILTERS · Clear" (Clear mờ khi chưa lọc) ✓; homepage h1 mới + logo PAGS bên phải ngang hàng giữ tỉ lệ (128×120 tại 1280×800 — contain trong khung 192×120) ✓; `<title>MS-MOLAR</title>` ✓; **0 console errors** ✓.
- Screenshot: `TEMP_SCREENSHOT/s22-{filter-open,home-desktop}.png`.
- Lưu ý: grep sạch `ClearButton`/`PAGS`/`"pags"` — không còn tham chiếu sót.

> **Chờ engineer xác nhận để Git.** Dev server sạch đang chạy tại **http://localhost:3000**.

### Sửa vòng 1 — S#22 (engineer feedback kèm screenshot đánh dấu X)
*Yêu cầu:* (1) Di chuyển logo ra vị trí gạch chéo trắng (sát mép phải content area) để h1 không bị dồn — chữ trải đều 2–3 hàng. (2) Logo tăng thêm 10%, không méo.
*Fixing process (`HomeStage.tsx`):*
- Section hero bỏ `max-w-3xl` → `w-full` (hàng h1+logo trải full bề ngang content; các khối text khác có max-w riêng nên không ảnh hưởng).
- h1: `flex-1 max-w-3xl` (trải rộng, không bị logo dồn); logo `ml-auto` đẩy sát mép phải content area; khung logo 15 → **16.5vw × 16.5vh (+10%)**, giữ `object-contain` (không méo).
- ⚠️ Lỗi tự phát hiện giữa chừng: bản đầu lỡ bỏ `flex-1` khỏi h1 → h1 kẹt ở flex-basis 256px, mỗi dòng 1 từ (12 dòng) — trả lại `flex-1` là hết.
- **Verify JS (viewport 1570×860 ≈ màn engineer):** h1 = **3 dòng**, width 768px; logo box sát mép phải content (cách đúng padding 64px); trang KHÔNG cuộn; 0 console errors. Screenshot: `TEMP_SCREENSHOT/s22-home-desktop-final.png`.
- Lưu ý trade-off: ở màn hẹp hơn (~1280) h1 xuống 4 dòng (bề ngang row không đủ) — flex-wrap vẫn giữ layout không vỡ; nếu engineer muốn cứng 3 dòng ở mọi màn thì cần giảm font-size lg — chờ ý kiến.

**✅ Engineer chốt: coi các component S#19–S#22 (navbar/grid 3 cột, English hoá + đề Hóa Học, navbar cao hơn/PAGS/preloader, filter align+dropdown+Clear/logo hero/MS-MOLAR) đã HOÀN THIỆN.** Gói lại — **KHÔNG Git ngay**, sẽ commit gộp một lượt ở phiên sau (theo yêu cầu 2026-07-10). Danh sách file đổi từ S#19 vẫn còn nguyên trong working tree, chưa `git add`.

> **Latest step: Packaged — chờ Git gộp (phiên sau).**

---
---

# [Layer 1: Account & Entry] — Task: Hoàn thiện Auth Module — signup hardening + OAuth + password reset (S#23, 2026-07-10)

- **Latest prompt:** "*Hoàn thiện auth module: - Đảm bảo user có thể tạo mới account ở đăng ký. - Đảm bảo user có thể đăng nhập hoặc đăng ký bằng Google và Facebook. - Tạo một hệ thống hỗ trợ reset mật khẩu theo tiêu chuẩn phổ biến. — Làm phần agent đảm nhận được trước, sau đó hướng dẫn engineer phần còn lại."
- **Latest step:** Testing ✅ (tsc + build + Playwright smoke) — **chờ engineer external setup + xác nhận, Git gộp batch S#19–S#23**
- **Layer status:** Layer 1 — auth logic + UI code DONE; OAuth chờ credentials engineer.

### Quyết định C&D (engineer chốt)
- OAuth: **code trước** (nút + callback route hoàn chỉnh), engineer cấu hình Google Cloud Console / Meta for Developers / Supabase Dashboard **sau** theo checklist — nút chưa hoạt động thật cho tới khi có credentials.
- Email reset: dùng **email built-in Supabase** (không SMTP riêng) — chấp nhận rate limit thấp ở free tier, nâng cấp Resend/SMTP sau nếu cần.
- signUp: check `data.session` — null (project bật Confirm email) → hiện info "check your email", KHÔNG redirect mù (tránh middleware bounce).
- `AuthState` mở rộng `{ error?: string; info?: string } | null` (backward-compatible với updateProfile/HeaderProfile/SidebarProfile).
- Reset flow chuẩn: Forgot password → email link (PKCE `?code=`) → `/auth/callback?next=/reset-password` → trang set mật khẩu mới (`updateUser`) → `/exams`. Callback route dùng CHUNG cho OAuth + recovery, whitelist `next` ∈ {/exams, /reset-password}.
- Middleware: thêm `/auth/callback` vào PUBLIC_PATHS (request đến chưa có session). `/reset-password` KHÔNG cần public — user tới từ email link đã có recovery session; page tự guard + redirect.

## Logic Module: Auth actions + callback
- **State:** Done
  + `(layer1)/actions.ts` — `AuthState = { error?; info? }`; signUp check `data.session` (null → info "check your email", không redirect mù); `signInWithOAuth` (provider từ formData google|facebook, redirectTo `origin/auth/callback?next=/exams`, PKCE cookie do @supabase/ssr quản); `requestPasswordReset` (luôn info chung — không lộ email tồn tại; lỗi thật chỉ console.warn); `updatePassword` (≥6 ký tự + confirm khớp → `updateUser` → /exams) — Done
  + `app/auth/callback/route.ts` (MỚI) — GET `?code=` → `exchangeCodeForSession` → redirect `next` (whitelist /exams | /reset-password, chống open-redirect); thiếu/hết hạn code → `/?auth=signin` — Done
  + `lib/supabase/middleware.ts` — PUBLIC_PATHS + `/auth/callback` (`/reset-password` không public — cần recovery session) — Done

## UI Module: AuthForm + Reset password page
- **State:** Done
  + `AuthForm.tsx` — nút Google/Facebook THẬT (1 form chung, button `name="provider"`, disabled khi pending, lỗi OAuth hiện inline); "Forgot password?" mở view reset trong card (email + Send reset link + ← Back, tab nào bấm cũng thoát view); hiển thị `state.info` tông trung tính — Done
  + `(layer1)/reset-password/page.tsx` + `_components/ResetPasswordForm.tsx` (MỚI) — card set mật khẩu mới (password + confirm, hiện email đang đăng nhập), guard 2 lớp (middleware + page redirect `/?auth=signin`) — Done

## Kết quả Testing (S#23)
- `tsc --noEmit`: pass. `next build`: pass — **10 routes** (thêm ƒ `/auth/callback` + ƒ `/reset-password`). Kill dev cũ + `rm -rf .next` + dev sạch (actions.ts đổi → bắt buộc restart, gotcha).
- Smoke: `/` 200; `/reset-password` guest → 307 redirect ✓; `/auth/callback` không code → 307 về `/?auth=signin` ✓.
- **Playwright:** Forgot password → view reset mở đúng; submit email test → info "If an account exists… reset link has been sent" ✓ (email THẬT đã gửi tới `smithnguyen247+rlstesta@gmail.com` — engineer dùng link đó test bước cuối được). Click Google → Supabase authorize URL đúng (PKCE challenge + `redirect_to=…/auth/callback?next=/exams`) → 400 `"provider is not enabled"` — ĐÚNG KỲ VỌNG khi chưa cấu hình provider.
- ⚠️ Ghi nhận: khi provider CHƯA bật, click nút OAuth đáp xuống trang JSON lỗi của Supabase (signInWithOAuth phía server chỉ dựng URL, không validate provider) — hết ngay khi engineer bật provider (sẽ sang trang consent Google/Facebook).
- Signup live-test: BỎ QUA có chủ đích — tránh đốt email rate limit free tier (đã dùng 1 mail cho reset); nhánh logic mới chỉ là check `data.session`, engineer tự test theo checklist.

## ⚠️ VIỆC CỦA ENGINEER (external — agent không có quyền truy cập)
1. **Google OAuth:** [console.cloud.google.com](https://console.cloud.google.com) → tạo project → APIs & Services → OAuth consent screen (External, điền tên app) → Credentials → Create OAuth Client ID (Web application) → Authorized redirect URI = `https://hynwleaxtbtjzkvpjsug.supabase.co/auth/v1/callback` → copy Client ID + Secret.
2. **Facebook OAuth:** [developers.facebook.com](https://developers.facebook.com) → Create App (Consumer) → thêm product "Facebook Login" → Settings: Valid OAuth Redirect URIs = `https://hynwleaxtbtjzkvpjsug.supabase.co/auth/v1/callback` → copy App ID + App Secret.
3. **Supabase Dashboard** → Authentication → **Providers**: bật Google (dán Client ID/Secret) + bật Facebook (dán App ID/Secret).
4. **Supabase Dashboard** → Authentication → **URL Configuration**: Site URL = `http://localhost:3000` (đổi thành domain thật khi deploy); Redirect URLs thêm `http://localhost:3000/auth/callback` (và `https://<domain>/auth/callback` sau này).
5. **Test sau khi cấu hình:** (a) Sign up email mới → nếu bật Confirm email sẽ thấy info "check your email" → bấm link → đăng nhập được; (b) nút Google/Facebook → consent → về `/exams`; (c) mở mail reset đã gửi tới `+rlstesta` → bấm link → trang Set a new password → đổi → vào `/exams`, đăng nhập lại bằng mật khẩu mới. (Nếu đổi mật khẩu user test, nhớ password mới — script `test-rls.ts` sẽ tự reset về `rls-test-password-123` khi chạy lại.)

> **Chờ engineer làm external setup + tự test, xác nhận để Git** (gộp chung batch S#19–S#23 theo yêu cầu "gói lại, git một lượt").

**Debug session (external setup xong, phát sinh 2 bug lúc engineer tự test thật):**
- *Google:* log dev server → `error=server_error&error_description=Unable+to+exchange+external+code` — Supabase (không phải code app) đổi code lấy token với Google thất bại → do Client Secret dán sai/copy lỗi. Engineer copy lại chính xác từ Google Console → Supabase Dashboard → **FIXED, verify lại bằng Playwright: redirect đúng sang accounts.google.com với client_id thật**.
- *Facebook:* lỗi "Invalid Scopes: email" ngay trên trang Facebook — app chưa thêm permission `email` ở bước "Tùy chỉnh trường hợp sử dụng". Engineer thêm permission → **FIXED, verify: redirect đúng sang facebook.com/login.php với app_id thật**.
- **Cả 2 OAuth provider hoạt động — engineer xác nhận "Mọi thứ đều ngon lành".**

---
---

# [Layer 1: Account & Entry] — Task: Sửa display name Google + trang trí AuthForm + toggle hiện mật khẩu (S#24, 2026-07-10)

- **Latest prompt:** "*Sửa: - Đối với người dùng Google, cắt bỏ đuôi '@gmail.com' để tên hiển thị không hiển thị cả email. - Ở form auth, đổi ảnh nền left side bằng các con chữ Latinh phóng to font serif để trang trí + transition nhỏ khi chuyển tab. *Bổ sung: - Nút toggle xem mật khẩu ở AuthForm + ResetPasswordForm."
- **Latest step:** Testing ✅ (tsc + build + Playwright visual) — **chờ engineer chạy SQL trigger fix + xác nhận**
- **Layer status:** Layer 1 — auth UI polish DONE; DB trigger chờ engineer chạy SQL.

### Quyết định kỹ thuật (agent tự quyết, không có ambiguity chặn)
- Google OAuth không set `display_name` trong `raw_user_meta_data` (chỉ có `full_name`/`name`/`email`) → trigger `handle_new_user()` hiện fallback thẳng xuống `email` (email đầy đủ). Sửa fallback chain: `display_name → full_name → name → phần trước "@" của email`. Đây là **DB trigger — cần engineer chạy lại SQL trong Supabase SQL Editor** (agent không có kết nối Postgres trực tiếp, chỉ service_role REST). Kèm 1 câu UPDATE backfill cho account Google đã tạo (display_name hiện đang = email đầy đủ).
- Trang trí panel trái AuthForm: bỏ watermark `brand_logo.png`, thay bằng 2 chữ cái serif phóng to ("M"/"S" — khớp MS-MOLAR) màu đỏ son mờ (theo tinh thần `drop-cap` DESIGN.md: font `display`, color `primary`). Remount theo `key={mode}` + `animate-in fade-in zoom-in-95` (lib `tw-animate-css` đã có sẵn, cùng pattern đang dùng cho form fields) — transition nhẹ khi đổi tab.
- Toggle xem password: icon mắt (Eye/EyeOff, local SVG cùng style các icon khác trong file) — state riêng từng field (AuthForm password field; ResetPasswordForm CẢ 2 field New/Confirm — độc lập nhau).

## Logic Module: DB trigger display_name
- **State:** Done (code) — ⚠️ chờ engineer chạy SQL trong Supabase SQL Editor
  + `supabase/schema.sql` — `handle_new_user()` fallback chain: `display_name → full_name → name → split_part(email,'@',1)` — Done
  + Backfill UPDATE cho account Google đã tạo trước đó (display_name hiện = email đầy đủ) — Done (câu SQL đưa cho engineer bên dưới)

## UI Module: AuthForm decor + password toggle
- **State:** Done (chờ engineer confirm visual)
  + `AuthForm.tsx` — bỏ Image watermark logo; thêm "M"/"S" serif phóng to (9rem→11rem theo breakpoint) đỏ son mờ 16%, `key={mode}` + `animate-in fade-in zoom-in-95 duration-500` (transition khi đổi tab); `Field` thêm toggle Eye/EyeOff khi `type="password"` (state riêng/field) — Done
  + `ResetPasswordForm.tsx` — `Field` viết lại (input + toggle trong 1 hàng), mỗi field (New/Confirm) toggle độc lập — Done

## Kết quả Testing (S#24)
- `tsc --noEmit`: pass. `next build`: pass — 10 routes không đổi.
- ⚠️ Gotcha lúc dọn dev server: taskkill qua Bash tool timeout/silent-fail nhiều lần khiến 3 tiến trình `next dev` cũ chạy song song (port 3000/3001/3002). Phát hiện qua `netstat`, dọn dứt điểm bằng `Stop-Process -Force` (PowerShell tool, đáng tin hơn taskkill qua Bash trên máy này) — verify lại `netstat` sạch trước khi start 1 server duy nhất. **Bài học: ưu tiên PowerShell `Stop-Process` thay taskkill qua Bash khi cần kill tiến trình Windows chắc chắn.**
- **Visual (Playwright, /?auth=signin):** panel trái hiện "M"/"S" serif đỏ son mờ đúng vị trí (không đè lên tabs); ô Password có icon mắt bên phải, bấm → `input.type` đổi "password"→"text" xác nhận qua JS ✓; chuyển tab Sign in→Sign up: form đổi đúng (Display name xuất hiện), chữ trang trí remount lại (transition fade+zoom chạy). **0 console errors.**
- Screenshot: `TEMP_SCREENSHOT/s24-authform-{signin,signup}.png`.
- ResetPasswordForm: verify qua code review + tsc/build (không test visual trực tiếp được — cần recovery session thật từ link email, không có quyền đọc hộp mail).
- Display name Google: **KHÔNG test sống được** — trigger chưa chạy trong DB (chờ engineer). Logic fallback đã review kỹ bằng tay.

## ⚠️ VIỆC CỦA ENGINEER — chạy SQL trong Supabase SQL Editor
1. Chạy lại toàn bộ `supabase/schema.sql` (idempotent, chỉ phần `handle_new_user()` thay đổi — an toàn chạy lại).
2. Chạy thêm câu **backfill** (một lần, sửa account Google đã tạo trước đó đang có `display_name` = email đầy đủ):
   ```sql
   update public.user_profiles p
   set display_name = coalesce(
     u.raw_user_meta_data ->> 'full_name',
     u.raw_user_meta_data ->> 'name',
     split_part(u.email, '@', 1)
   )
   from auth.users u
   where p.id = u.id
     and p.display_name = u.email;  -- chỉ sửa những row đang lộ email đầy đủ
   ```
3. Vào lại app, kiểm tra ô profile (navbar / homepage sidebar) — tên hiển thị của account Google giờ không còn dạng email đầy đủ.
4. Tự kiểm visual AuthForm (chữ M/S nền, toggle mắt) + thử luồng reset password trọn vẹn (chưa test được ở phiên trước).

> **Chờ engineer chạy SQL + tự test, xác nhận để Git** (batch dồn: S#19–S#24). Dev server sạch (1 tiến trình duy nhất) tại **http://localhost:3000**.

---
---

# [Layer 1: Account & Entry] — Task: Transition chiều cao AuthForm khi đổi tab (S#25, 2026-07-10)

- **Latest prompt:** "Khi chuyển sang tab Đăng ký và ngược lại, do hai tab có số input field khác nhau nên chiều cao form khác nhau — cần transition giãn nở từ từ để mượt mà." + hướng dẫn chi tiết SQL Editor.
- **Latest step:** Testing ✅ (tsc + Playwright đo trực tiếp) — **chờ engineer xác nhận cảm nhận transition**
- **Layer status:** Layer 1 — polish AuthForm, không đổi logic.

### Quyết định kỹ thuật
- CSS thuần không animate được `height: auto`, nên dùng kỹ thuật đo bằng JS: `AutoHeightPanel` (component mới, `AuthForm.tsx`) — outer div height CỐ ĐỊNH (px) + `transition-[height] duration-500 ease-out` + `overflow-hidden`; inner div height tự nhiên, `ResizeObserver` theo dõi inner → mỗi lần nội dung đổi (chuyển tab / mở-đóng reset) tự cập nhật height của outer, CSS transition lo phần animate.
- Áp dụng cho CẢ 3 trạng thái thân form (Sign in / Sign up / Reset password) — không chỉ 2 tab như prompt nói, vì view Reset cũng đổi số field tương tự.
- `useIsomorphicLayoutEffect` (useEffect trên server, useLayoutEffect trên client) — tránh warning SSR, set height ngay trước paint đầu (không nháy lúc mount).

## UI Module: AutoHeightPanel
- **State:** Done (chờ engineer confirm cảm nhận)
  + `AuthForm.tsx` — component mới `AutoHeightPanel`; bọc phần thân thay đổi (reset view ⇄ sign-in/sign-up+OAuth) — Done

## Kết quả Testing (S#25)
- `tsc --noEmit`: pass.
- **Verify bằng JS (Playwright, đo `outer.style.height` sau mỗi lần đổi view):** Sign in = **227px** → Sign up = **292px** (thêm field Display name) → Reset password = **181px** (chỉ email). Cả 3 số đúng thứ tự tăng/giảm theo số field — xác nhận `ResizeObserver` bắt đúng và set height tương ứng mỗi lần. `outer` có `transition: height 0.5s` — browser tự animate giữa các giá trị này (giá trị px chỉ đo được TRẠNG THÁI CUỐI qua JS, bản thân chuyển động mượt/giật cần mắt người xem trực tiếp).
- Screenshot sau transition: `TEMP_SCREENSHOT/s25-authform-signup-after-transition.png` — layout không vỡ, không bị clip nội dung. **0 console errors** suốt 3 lần chuyển.
- ⚠️ Gotcha lúc test: Playwright MCP báo "Browser is already in use" (session cũ treo) — retry sau vài giây tự kết nối lại được, không cần can thiệp thêm.
- **Cảm nhận độ mượt thật sự: ENGINEER TỰ KIỂM** (JS chỉ đo được số, không đo được "mượt hay giật" bằng mắt).

## Hướng dẫn SQL Editor đã gửi cho engineer (S#24 dở dang)
Đã hướng dẫn chi tiết từng bước qua chat: vào Supabase Dashboard → SQL Editor → chạy lại `schema.sql` → chạy câu backfill display_name. Engineer đang thực hiện.

> **Chờ engineer xác nhận transition mượt + hoàn tất SQL S#24, rồi xác nhận để Git** (batch dồn: S#19–S#25). Dev server sạch tại **http://localhost:3000**.

---
---

# [Layer 1 + 2] — Task: Batch polish vi mô 9 mục (S#26, 2026-07-10)

- **Latest prompt:** "Chỉnh sửa, bổ sung và xóa (vi mô): L1: xóa transition M-S; sidebar border tag đỏ son khi click; đường kẻ trang trí đậm lên ~8%; logo +12%. L2: hover shadow ExamCard; bỏ tam giác trong dropdown filter; ô info độ khó (hàng dưới, căn giữa) ở trang overview exam; auto-chuyển câu khi chọn đáp án; icon + tooltip cho save/share + nút Home→Return→ExamBrowser; câu đúng ở attempt details → xanh lá hợp theme. Note: agent visual test + clear TEMP_SCREENSHOT + dùng todo list."
- **Latest step:** Testing ✅ (tsc + build + visual Playwright full-loop + dọn TEMP_SCREENSHOT) — **chờ engineer xác nhận**
- **Layer status:** L1 + L2 polish, không đổi business logic.

### Quyết định kỹ thuật (batch nhỏ, tự quyết trong scope)
- Hover shadow ExamCard: engineer CHỦ ĐỘNG yêu cầu — override quy tắc "không đổ bóng" DESIGN.md cho riêng element này (ghi nhận exception); shadow tông ấm `rgba(27,21,18,0.12)` thay đen lạnh.
- Tam giác trong dropdown: bỏ CẢ RowTriangle (từng filter row) lẫn Triangle ở header panel — "trong dropdown menu" = mọi thứ bên trong panel; tam giác ở tay nắm (nút filter) GIỮ NGUYÊN.
- Ô Difficulty (trang overview exam): data model chưa có độ khó → giá trị tượng trưng "—" (đồng bộ ExamCard "Level —"); layout `col-span-2 justify-self-center w-[calc(50%-0.5rem)]` = đúng bề rộng 1 cột, nằm giữa.
- Auto-advance player: chọn đáp án → delay 250ms (thấy được selection) rồi `next()`; timeout ref + clear chống double-fire khi đổi đáp án nhanh; câu cuối không advance (reducer đã clamp).
- Màu xanh "correct": mở rộng nhất quán — MỌI marking correct (status, row đáp án đúng, tag "Correct answer") sang xanh lá ấm `#4F7942` (fern, hợp tông ngà/sơn mài); sai giữ destructive. Green = correct là convention chuẩn, đồng thời thỏa "câu được đánh dấu đúng thành xanh".
- Save/share: icon SVG inline (download + share chuẩn), text thay bằng `title` tooltip native + text sr-only (a11y).

## Todos (theo TodoWrite) — TẤT CẢ DONE
L1: M-S bỏ transition (`AuthForm.tsx` — bỏ key={mode}+animate-in khỏi decor) · sidebar border đỏ son khi click (`HomeSidebar.tsx` — isActive + pseudo `active:` cùng đổi border) · HeroLines strokeOpacity 0.06→0.08 (`page.tsx`) · logo 16.5→18.5vw/vh +12% (`HomeStage.tsx`).
L2: ExamCard hover shadow ấm `0 8px 24px rgba(27,21,18,.12)` · Filter dropdown bỏ tam giác (header + RowTriangle, xóa component; tay nắm GIỮ) · Detail ô Difficulty (col-span-2 justify-self-center, giá trị "—" tượng trưng) · Player auto-advance (delay 250ms + timeout ref, clamp câu cuối) · ResultActions icon download/share + title tooltip + sr-only, nút Home→"Return"→`/exams` · Detail kết quả: mọi marking correct → xanh fern `#4F7942` (status/row/badge/tag), wrong giữ destructive.

## Kết quả Testing (S#26)
- `tsc --noEmit`: pass. `next build`: pass — 10 routes không đổi. Kill dev cũ (PowerShell Stop-Process — bài học S#24) + `rm -rf .next` + dev sạch.
- **Visual full-loop (Playwright, login `+rlstesta`):**
  + Homepage: tag ACCOUNT active có chữ + border-b đỏ son ✓; đường kẻ nền đậm hơn thấy rõ ✓; M-S tĩnh ✓.
  + /exams: hover card → `boxShadow rgba(27,21,18,0.12) 0 8px 24px` (đo computed style) ✓; dropdown filter không còn tam giác nào bên trong, tay nắm giữ tam giác ✓.
  + Detail exam-hoa-10: ô Difficulty hàng dưới căn giữa, đúng bề rộng 1 cột ✓.
  + Player: chọn đáp án 5 câu liên tiếp — mỗi lần tự sang câu kế sau 250ms (đo qua JS: Q1→Q2→…→Q5), câu cuối KHÔNG nhảy ✓.
  + Submit → Result 8.0/10 (cố ý sai Q2: 4/5 — điểm đúng): icon save/share không text, tooltip "Save/Share — coming soon", nút "Return" href `/exams` ✓.
  + Details: câu đúng nền/viền/badge/tag xanh fern; Q2 sai hiện tương phản đỏ (Your choice) vs xanh (Correct answer) rõ ràng ✓.
  + **0 console errors** toàn bộ luồng.
- **TEMP_SCREENSHOT đã dọn sạch** (22 file → 0, kể cả screenshot các phiên trước — đúng WORKFLOW Bước 4 + note engineer).

> **Engineer xác nhận, chuyển Git** (batch dồn: S#19–S#26).

## Git ✅ (2026-07-10)
- Staged: toàn bộ `SOURCE/` (loại trừ MD gốc, TEMPLATE/, TEXT/, ASSETS thừa, `.claude/`, `.mcp.json`, `.playwright-mcp/` theo quy tắc chuẩn).
- Commit `bba92a7`: `feat(layer1-2/auth-browser): complete auth module, redesign ExamBrowser navbar, English i18n + MS-MOLAR rebrand` — 35 files changed, 1314(+)/564(-).
- Push thành công: `e039f06..bba92a7 main -> main`.
- Git identity local chưa từng set trên máy này → set lại `user.name`/`user.email` khớp commit trước (`undetecteddeveloper <smithnguyen247@gmail.com>`) trước khi commit.

---
---

# [Layer 2: Core Loop] — Task: DB field mapping cho Filter/ExamCard (School/Year/Semester) (S#27, 2026-07-10)

- **Latest prompt:** "PROCESS.md đã có ghi chú về việc thay đổi data field trong DB - Bắt đầu thực hiện. Skip C&D step" (TE2 — C&D đã chốt ở phiên trước).
- **Latest step:** Testing ✅ (tsc + build pass) — ⚠️ **chờ engineer chạy `schema.sql` trong Supabase SQL Editor** → agent re-seed → engineer confirm → Git
- **Layer status:** Layer 2 — mở rộng schema `exams`, không đổi Core Loop hiện có.

### Hiện trạng đối chiếu DB ↔ UI (khảo sát trước khi đề xuất)
DB hiện có 6 bảng: `user_profiles`, `questions`, `exams`, `exam_attempts`, `attempt_answers`, `exam_results`.
UI đã có sẵn ô/placeholder cho data **CHƯA tồn tại** trong DB:
- `ExamCard.tsx` — School, Level đang hard-code `"—"`.
- `ExamFilters.tsx` — 4 `FilterRow` (School/Year/Semester/Level) đang `symbolic` ("Coming soon"); Quick sort (Newest/Oldest/Hardest) checkbox chưa gắn hành vi.
- Trang overview exam (`exams/[id]/page.tsx`) — ô Difficulty đang `"—"`.
- `exams` table hiện **không có `created_at`** → không có gì để sort Newest/Oldest.

### Quyết định (engineer chốt qua AskUserQuestion — 4 câu)
1. **School** = trường biên soạn/nguồn đề — cột free-text trên `exams`, KHÔNG tách bảng riêng.
2. **Level/Difficulty** = sẽ tính từ rating của user làm đề (tính năng tương lai) — **TẠM BỎ QUA**, không thêm field lúc này.
3. **Year + Semester** = năm học (niên khóa, số, vd `2024`) + học kỳ (`HK1`/`HK2`) ra đề — 2 cột riêng trên `exams`.
4. **Hardest sort** = **TẠM BỎ QUA** (chưa code), chờ có data rating ở quyết định #2.

### Mapping đề xuất — sẽ triển khai ở phiên Coding kế tiếp
- `schema.sql` — `ALTER TABLE exams`: thêm `school text`, `school_year int`, `semester text check (semester in ('HK1','HK2'))`, `created_at timestamptz not null default now()`.
- `types/exam.ts` — thêm `school?: string`, `schoolYear?: number`, `semester?: string`.
- `queries.ts` — `toExam` mapper + `ExamFilters` interface + `listExams` (thêm `eq` cho 3 field mới + `order("created_at")` cho Newest/Oldest) + `listExamFacets` (distinct school/schoolYear).
- `ExamFilters.tsx` — School/Year/Semester: `symbolic` → dropdown thật (cùng pattern Subject/Grade); Newest/Oldest gắn `setParam("sort", …)`. **Level giữ symbolic, Hardest giữ chưa gắn** (đúng quyết định #2, #4).
- `ExamCard.tsx` — hiện `exam.school ?? "—"`. **Level giữ `"—"`** (deferred).
- Seed giá trị demo cho 3 đề hiện có (Toán/Lý/Hóa 10) — chốt giá trị cụ thể ở phiên Coding.

## Logic Module: Schema + queries (Coding — TE2 nhận 2026-07-10)
- **State:** Done (code) — ⚠️ DB chưa apply
  + `supabase/schema.sql` — CREATE TABLE exams thêm 4 cột (DB mới) + khối ALTER idempotent riêng (migration DB hiện có): `school text`, `school_year int`, `semester text` + constraint `exams_semester_check (null | 'HK1' | 'HK2')`, `created_at timestamptz not null default now()` — Done
  + `types/exam.ts` — thêm `school?`, `schoolYear?`, `semester?` (optional — nullable trong DB) — Done
  + `queries.ts` — `EXAM_COLUMNS` const dùng chung (listExams + getExam); `ExamRow`/`toExam` map 3 cột mới (null → undefined); `ExamSort = "newest" | "oldest"`; `ExamFilters` interface thêm school/schoolYear/semester/sort; `listExams` thêm 3 `.eq` + order theo `created_at` (newest desc / oldest asc / mặc định giữ order id); `listExamFacets` trả thêm `schools` (sort vi), `years` (desc — năm mới nhất đầu), `semesters` — Done
  + `lib/fake-data/exams.ts` — 3 đề nhận giá trị DEMO đa dạng có chủ đích (test đủ nhánh filter): Toán = THPT Trần Phú/2024/HK1, Lý = THPT Nguyễn Huệ/2024/HK2, Hóa = THPT Lê Quý Đôn/2025/HK1. Engineer đổi tùy ý. — Done
  + `supabase/seed.ts` — examRows map 3 cột mới + `created_at` lệch ngày theo thứ tự đề (2026-07-01 + i ngày; Hóa mới nhất) để sort Newest/Oldest phân biệt được — Done

## UI Module: Filter thật + ExamCard School
- **State:** Done (code) — chờ DB apply để test sống
  + `ExamFilters.tsx` — props thêm `schools`/`years`/`semesters`/`sort`; School/Year/Semester chuyển `symbolic` → `FilterRow` dropdown thật (option All + facets, cùng pattern Subject/Grade); Level GIỮ symbolic; `hasFilters` tính cả 3 filter mới (Clear phủ hết); Quick checkbox: Newest/Oldest controlled theo `?sort=` (toggle — chọn lại thì bỏ; loại trừ nhau vì chung param), Hardest controlled `false` + title "Coming soon" (click không tick — hết misleading) — Done
  + `ExamCard.tsx` — School hiện `exam.school ?? "—"`; Level giữ "—" — Done
  + `exams/page.tsx` — SearchParams thêm school/year/semester/sort; sort validate whitelist (`newest`|`oldest`, "hardest" bị bỏ qua); truyền đủ filters vào `listExams` + facets/selected/sort vào `ExamFilters` — Done

## Kết quả Testing (S#27)
- `tsc --noEmit`: pass (exit 0). `next build`: pass — 10 routes không đổi. Kill dev server cũ (PID 11364) trước build + `rm -rf .next` sau build + dev server sạch (gotcha chuẩn).
- Updating: grep toàn bộ usage `Exam`/`listExams`/`listExamFacets`/`ExamFilters` — ExamBrowser/ExamCard/Detail nhận field optional mới, không chỗ nào gãy. RLS: policy `exams_select_authenticated` phủ luôn cột mới (RLS theo row, không theo column) — không cần policy thêm.
- Seed thử live-DB: questions ✓ 15 câu; **exams ❌ ĐÚNG DỰ ĐOÁN** — `Could not find the 'created_at' column of 'exams' in the schema cache` → DB chưa có cột mới, chờ engineer chạy SQL.
- ⚠️ **App /exams sẽ LỖI RUNTIME cho tới khi SQL được apply** (query select cột chưa tồn tại) — engineer chạy SQL TRƯỚC khi mở trang.

## ⚠️ VIỆC CỦA ENGINEER — chạy SQL trong Supabase SQL Editor
1. Dashboard → SQL Editor → paste toàn bộ `SOURCE/supabase/schema.sql` → Run (idempotent — phần mới là khối ALTER exams + constraint semester).
2. Báo agent chạy lại `npx tsx supabase/seed.ts` (đẩy school/year/semester + created_at demo cho 3 đề).
3. Test trên browser `/exams`: filter School/Year/Semester lọc thật; Newest/Oldest đổi thứ tự card (Hóa mới nhất); ExamCard hiện tên trường; Clear xóa hết; Hardest + Level vẫn "Coming soon".

> **Chờ engineer chạy SQL + confirm → agent seed → Git.**

### Re-seed sau khi engineer chạy SQL — Done (2026-07-10)
- Engineer xác nhận đã chạy `schema.sql` trong Supabase SQL Editor, không lỗi.
- Chạy lại `npx tsx supabase/seed.ts`: **✓ Seed 15 câu hỏi, ✓ Seed 3 đề, ✅ Seed hoàn tất** — không còn lỗi `created_at` column.
- Smoke: `GET /exams` (guest, dev server sạch tại :3000) → **307** redirect auth đúng, server không crash với cột mới.
- ⚠️ Playwright MCP không kết nối trong phiên này → **chưa tự verify trực quan** (filter School/Year/Semester lọc thật, Newest/Oldest đổi thứ tự card, ExamCard hiện tên trường). Đúng theo lưu ý TE1 mới nhất ("chỉ code khi có lệnh, engineer tự kiểm") — bàn giao engineer tự kiểm trên browser.

> **Chờ engineer tự kiểm trên browser (đăng nhập, xem `/exams`) → xác nhận → Git.**

---
---

# [Layer 1 + 2] — Task: Filter checkbox combos · 'None' placeholders · Anti-cheat nav guard & randomize (S#28, 2026-07-10)

- **Latest prompt:** "Đã chạy và không lỗi. *Thêm các logic module vào UI Layer 2: (1) 3 ô checkbox filter — kết hợp gồm newest+hardest và oldest+hardest, KHÔNG có oldest+newest. (2) Điền data DB vào UI Component; chưa có data → 'None'. (3) Trang attempt: bấm thẻ nav khác → popup cảnh báo; random câu hỏi + đáp án (không cố định) — feature khó, dự định thành tùy chọn khi import đề, chừa chỗ hoàn thiện dần. Lưu ý: chỉ code khi có lệnh, engineer tự kiểm."
- **Latest step:** Testing ✅ (tsc + build pass, smoke 200) — **ENGINEER TỰ KIỂM visual/function, chờ xác nhận để Git**.
- **Layer status:** Layer 2 (filter/randomize/nav-guard) + cross-cutting text 'None'.

### Quyết định C&D (engineer chốt qua AskUserQuestion — 4 câu)
- Q1=B: Hardest chỉ sửa **luật tương tác checkbox** (cho tick đồng thời Hardest+Newest hoặc Hardest+Oldest; Newest+Oldest loại trừ nhau) — Hardest **CHƯA thực sự sort** (không có data độ khó; giữ nguyên quyết định S#27 #2/#4).
- Q2=A: 'None' chỉ áp cho field **đã có trong DB** và đang null (School/Year/Semester) — Level/Hardest (tính năng chưa xây) giữ nguyên "Coming soon"/"—".
- Q3=B: Popup cảnh báo áp dụng **cả** click nav trong app (modal tuỳ biến theo theme) **lẫn** refresh/đóng tab (`beforeunload` native).
- Q4=A: Random câu hỏi + đáp án **bật ngay cho mọi đề**, KHÔNG đổi schema DB lúc này; seed theo `attemptId` (ổn định trong 1 lượt làm, không đổi khi F5); tách hàm thuần riêng để Import (L4) tương lai dễ gắn cờ bật/tắt theo từng đề.

### Kế hoạch kỹ thuật đề xuất (đã khảo sát code hiện tại — CHƯA áp dụng)

**A. Filter checkbox — tách 2 chiều lọc độc lập** (`ExamFilters.tsx`)
- `?sort=newest|oldest` (loại trừ nhau, giữ như hiện tại) tách khỏi `?hardest=1` (độc lập, KHÔNG truyền vào `listExams` — chưa có cột difficulty để ORDER BY, tránh giả vờ hoạt động). QUICK checkbox: Newest/Oldest giữ hành vi loại trừ; Hardest đổi từ `wired:false/controlled false` → tickable độc lập, chỉ lưu URL.

**B. 'None' cho field DB rỗng**
- `ExamCard.tsx` — `exam.school ?? "None"` (thay `"—"`).
- `exams/[id]/page.tsx` (Detail) — hiện CHƯA hiển thị School/Year/Semester (chỉ Questions/Duration/Difficulty placeholder) → thêm hiển thị 3 field thật, null → "None". Difficulty (chưa có field) giữ nguyên theo Q2.
- `ExamFilters.tsx` `FilterRow selectedLabel` khi user chưa chọn → KHÔNG đổi (là "chưa lọc", khác bản chất với "dữ liệu rỗng").

**C. Cảnh báo rời trang khi đang làm bài** (hook mới, dùng trong `ExamPlayer.tsx`)
- `useLeaveGuard(active: boolean)`: `beforeunload` khi `active` (chặn refresh/đóng tab — browser hiện prompt mặc định, không tuỳ biến nội dung được, giới hạn của Web API) + document-level click interceptor (capture phase) bắt click `<a>` nội bộ khi `active` → `preventDefault()` + modal tự thiết kế (theme Mực & Sơn mài) Hủy/Rời trang → xác nhận thì tắt guard rồi điều hướng tới href đã chặn.
- `active = true` từ lúc mount Player đến khi bắt đầu submit (`submittedRef.current = true`, kể cả auto-submit hết giờ) — tắt guard ngay lúc đó để không tự chặn luồng chuyển sang `/result`.
- Bắt ở tầng `document` → không cần sửa `SiteHeader`/`HeaderProfile`.

**D. Random câu hỏi + đáp án theo attempt** (module mới `lib/random/shuffle.ts`)
- Hàm thuần `shuffleForAttempt<T>(items: T[], seed: string): T[]` — PRNG seed từ `attemptId` (deterministic, F5 vẫn ra cùng thứ tự).
- Áp dụng ở `exams/[id]/attempt/[attemptId]/page.tsx` (đã có `attemptId`): shuffle thứ tự `questions` VÀ shuffle riêng `choices` mỗi câu trước khi truyền `<ExamPlayer>`.
- An toàn chấm điểm (đã verify code): `useExamPlayer` lưu đáp án theo `questionId → ChoiceId` (chữ cái, không theo vị trí); mỗi `Choice` tự mang `id` riêng → xáo mảng không ảnh hưởng logic chấm, nhãn A/B/C/D đi theo đúng lựa chọn gốc — đúng mục đích chống đoán theo vị trí cố định.
- Không đổi schema (đúng Q4=A); khi Import (L4) ra đời chỉ cần đọc thêm 1 cờ DB rồi if/else quanh lời gọi `shuffleForAttempt`.

> ~~Chưa code gì trong lượt này — chờ TE2 ("Bắt đầu code").~~ **TE2 nhận 2026-07-10 — đã code xong theo đúng kế hoạch trên.**

## Logic Module: Seeded shuffle (D)
- **State:** Done
  + `lib/random/shuffle.ts` (MỚI) — `shuffleWithSeed<T>(items, seed)`: FNV-1a hash seed → mulberry32 PRNG → Fisher–Yates trên bản sao (không mutate). Deterministic: cùng attemptId → cùng thứ tự (F5 không đổi bài đang làm); attempt khác → thứ tự khác. Hàm thuần — Import (L4) tương lai chỉ cần if/else quanh lời gọi theo cờ per-đề. — Done
  + `attempt/[attemptId]/page.tsx` — shuffle thứ tự câu theo `attemptId` + shuffle choices mỗi câu theo seed riêng `` `${attemptId}:${q.id}` `` (các câu không dùng chung một hoán vị) trước khi truyền `<ExamPlayer>`. Server-side — client không thấy thứ tự gốc. — Done

## UI Module: Nhãn đáp án theo vị trí (D)
- **State:** Done
  + `QuestionRenderer.tsx` — nhãn chữ cái đánh theo VỊ TRÍ hiển thị (`String.fromCharCode(65+i)`) thay vì `choice.id` gốc (sau xáo trộn A/C/D/B nhìn như lỗi). Value radio giữ `choice.id` gốc → `answers` lưu `questionId → ChoiceId` gốc, `computeScore` server-side không ảnh hưởng (đã verify logic). — Done
  + `AnswerChoice.tsx` — thêm prop `label` (nhãn hiển thị), tách khỏi `choice.id` (value chấm điểm). — Done
  + ⚠️ **Trade-off ghi nhận:** trang Result Details render choices theo thứ tự + nhãn GỐC từ DB (không dùng AnswerChoice) → chữ cái trong player ≠ chữ cái trong details (text đáp án thì khớp — user click gì thấy đúng cái đó được đánh dấu). Muốn đồng bộ nhãn theo lượt làm thì phải persist hoán vị vào DB — để engineer quyết sau nếu cần.

## UI Module: Filter checkbox combos (A) + 'None' (B)
- **State:** Done
  + `ExamFilters.tsx` — QUICK tách 2 chiều độc lập: Newest/Oldest chung `?sort=` (loại trừ nhau, toggle); Hardest sang `?hardest=1` riêng → tick đồng thời được với Newest HOẶC Oldest, KHÔNG bao giờ Newest+Oldest (đúng yêu cầu combo). Hardest chỉ lưu URL, chưa đổi thứ tự (title "Difficulty ranking coming soon"). — Done
  + `exams/page.tsx` — parse `?hardest=1` → prop `hardest` cho ExamFilters; KHÔNG truyền vào `listExams` (tránh giả vờ sort khi không có data). — Done
  + `ExamCard.tsx` — School null → **"None"** (thay "—"); Level giữ "—" (tính năng chưa xây — đúng Q2). — Done
  + `exams/[id]/page.tsx` (Detail) — thêm 3 ô **School / Year / Semester** data thật từ DB (null → "None", màu muted); lưới 6 ô = 2×3 đều → bỏ hack `col-span-2` căn giữa của ô Difficulty (S#26 — chỉ cần khi lẻ ô); Difficulty giữ "—". — Done

## UI Module: Leave guard trang làm bài (C)
- **State:** Done
  + `hooks/useLeaveGuard.ts` (MỚI) — 2 tầng khi `active`: (1) click `<a>` nội bộ bắt ở `document` CAPTURE phase (chạy trước onClick của next/link) → preventDefault + lưu `pendingHref`; bỏ qua click phụ/modifier keys/target=_blank/link ngoài origin/cùng trang. (2) `beforeunload` cho refresh/đóng tab (browser chỉ cho prompt mặc định — giới hạn Web API, đã chốt Q3). Xác nhận rời → `router.push(pendingHref)` (không phải click `<a>` nên không bị chặn lại). Không đụng SiteHeader/HeaderProfile. — Done
  + `_components/LeaveExamDialog.tsx` (MỚI) — modal theme Mực & Sơn mài: scrim đen sơn mài mờ + card hairline KHÔNG shadow (DESIGN.md); "Leave" đỏ son + "Cancel" outline; Esc/click scrim = Cancel; z-50 (trên navbar z-30). — Done
  + `ExamPlayer.tsx` — `useLeaveGuard(!submitting)` (tắt khi đang submit → không chặn redirect sang /result, kể cả auto-submit hết giờ); render `<LeaveExamDialog>`. — Done
  + Ghi chú phạm vi: nút "Sign out" trong HeaderProfile là form Server Action (không phải `<a>`) → KHÔNG bị guard chặn — ngoài phạm vi "thẻ nav"; nêu để engineer quyết có mở rộng không.

## Kết quả Testing (S#28)
- `tsc --noEmit`: pass. `next build`: pass — 10 routes không đổi. Kill dev cũ trước build + `rm -rf .next` sau build + dev sạch (gotcha chuẩn). Smoke `GET /` → 200.
- **Visual + function: ENGINEER TỰ KIỂM** (đúng phân công TE1) tại **http://localhost:3000**. Checklist gợi ý:
  1. `/exams`: tick Newest → tick Hardest (cả 2 cùng tick); tick Oldest → Newest tự bỏ, Hardest GIỮ; URL dạng `?sort=oldest&hardest=1`.
  2. ExamCard + trang Detail: School/Year/Semester hiện data thật (THPT Trần Phú/2024/HK1…); muốn thấy "None" thì xóa tạm giá trị 1 đề trong DB.
  3. Vào làm bài: thứ tự câu + đáp án bị xáo (so với lượt trước); F5 giữa chừng → thứ tự KHÔNG đổi; "Làm lại" (attempt mới) → thứ tự khác.
  4. Đang làm bài bấm Home/Analytics/logo → modal "Leave this exam?" (Cancel ở lại, Leave rời đúng trang đích); F5/đóng tab → prompt mặc định browser.
  5. Submit bình thường + hết giờ auto-submit → sang Result KHÔNG bị modal chặn.
  6. Result Details: đáp án đúng/sai đánh dấu chính xác (đã đổi thứ tự trong player nhưng chấm theo id gốc).

> **Chờ engineer tự kiểm + xác nhận để Git** (gộp S#27 + S#28 nếu muốn — cả 2 đang chưa commit). Dev server sạch tại **http://localhost:3000**.

---
---

# ⏸️ KẾT PHIÊN 2026-07-10 (engineer yêu cầu tạm dừng — lưu tiến độ)

## Trạng thái bàn giao cho phiên sau
- **S#27 (DB field mapping School/Year/Semester):** code Done + engineer ĐÃ chạy SQL migration + agent ĐÃ re-seed thành công (15 câu + 3 đề, có school/year/semester + created_at lệch ngày). **CHƯA Git.** Còn thiếu: engineer tự kiểm visual filter/sort trên browser.
- **S#28 (checkbox combos + 'None' + leave guard + random đề):** code Done, tsc + build pass, smoke 200. **CHƯA Git.** Còn thiếu: engineer tự kiểm theo checklist 6 bước ghi ở section S#28 phía trên.
- **Việc đầu tiên của phiên sau:** nhận kết quả tự kiểm của engineer → sửa nếu có feedback → **Git gộp S#27 + S#28** (theo quy tắc staging chuẩn: KHÔNG stage MD gốc, TEMPLATE/, .claude/, .mcp.json, .playwright-mcp/).
- Files chưa commit (working tree): `supabase/schema.sql`, `supabase/seed.ts`, `types/exam.ts`, `lib/fake-data/exams.ts`, `lib/random/shuffle.ts` (MỚI), `hooks/useLeaveGuard.ts` (MỚI), `app/(layer2)/queries.ts`, `app/(layer2)/exams/page.tsx`, `app/(layer2)/exams/[id]/page.tsx`, `app/(layer2)/exams/[id]/attempt/[attemptId]/page.tsx`, `app/(layer2)/_components/{ExamFilters,ExamCard,ExamPlayer,QuestionRenderer,AnswerChoice,LeaveExamDialog(MỚI)}.tsx`.
- Dev server đang chạy tại http://localhost:3000 (background — có thể đã tắt khi máy restart; phiên sau start lại nếu cần, nhớ `rm -rf .next` nếu vừa build).

## Tiến độ tổng thể (kết phiên 2026-07-10 — S#27/S#28)
```
GĐ 0 — Nền Móng              : [x] Done
GĐ 1 — Functional Prototype  : [x] Done
GĐ 2 — Connected Prototype   : [x] Done
GĐ 3 — Polish (MVP ship)     : [ ] In Progress
  M3.1 Visual language L2    : [x] Done
  M3.2 Responsive L2         : [x] Done
  M3.3 Homepage 3D           : [x] ĐÃ BỎ (thay homepage Hyperspace + theme DESIGN.md)
  M3.4 Homepage Mobile       : [x] Không còn cần (homepage mới responsive sẵn)
  M3.5 Personalization       : [ ] Not Started
  M3.6 Transitions & SEO     : [ ] Not Started
─────────────────────────────
Ngoài roadmap gốc — 2 phiên 2026-07-10:
  S#19–S#26 (navbar/grid/i18n/auth/preloader/polish)   : [x] Done (commit bba92a7)
  S#27 DB fields School/Year/Semester + filter/sort     : [x] Code+seed Done — CHƯA Git (chờ engineer kiểm)
  S#28 Checkbox combos + None + leave guard + random đề : [x] Code Done — CHƯA Git (chờ engineer kiểm)
─────────────────────────────
Post-MVP A — Layer 3         : [ ] Not Started
Post-MVP B — Layer 4         : [ ] Not Started
```

**Tạm dừng phiên. Chờ TE tiếp theo (kết quả tự kiểm S#27/S#28 của engineer → Git).**

---
---

# ⏪ [Layer 2] — HOÀN TÁC feature random câu hỏi/đáp án (mục D của S#28) — 2026-07-11

- **Latest prompt:** "Tôi muốn hoàn tác việc thêm feature random câu hỏi. Hãy đảm bảo nó được xóa sạch và không liên đới đến toàn bộ kiến trúc."
- **Latest step:** Testing ✅ (tsc pass, build pass 10 routes, grep sạch) — revert hoàn tất.
- **Phạm vi:** CHỈ gỡ random (S#28 mục D). Các phần còn lại của S#28 GIỮ NGUYÊN: checkbox combos (A), 'None' placeholders (B), leave guard + LeaveExamDialog (C).

## Các thay đổi revert (4 điểm chạm — đủ toàn bộ liên đới)
- XÓA `lib/random/shuffle.ts` (+ thư mục `lib/random/` rỗng theo).
- `exams/[id]/attempt/[attemptId]/page.tsx` — bỏ import `shuffleWithSeed` + khối xáo trộn; truyền thẳng `data.questions` như trước S#28; comment đầu file về lại mô tả M2.6.
- `QuestionRenderer.tsx` — bỏ prop `label={String.fromCharCode(65+i)}` + comment S#28; map choices về dạng cũ.
- `AnswerChoice.tsx` — gỡ prop `label` khỏi interface + destructure; nhãn chữ cái hiển thị về lại `choice.id` gốc.
- Không có liên đới nào khác: schema DB chưa từng đổi cho feature này (Q4=A chốt không đổi schema); `useExamPlayer`/`computeScore`/`submitExam` chưa từng bị sửa cho random.

## Kết quả Testing (revert)
- Grep toàn SOURCE: không còn tham chiếu `shuffle`/`shuffleWithSeed`/`lib/random`; các `label=` còn lại thuộc component khác (AuthForm/ExamFilters/FilterRow…), không liên quan.
- `tsc --noEmit`: pass (exit 0). `next build`: pass — 10 routes không đổi. Đã `rm -rf .next` sau build; dev server không chạy (đã tắt từ trước, không cần restart).

> **Trạng thái chờ Git (đã verify bằng `git status`):** revert SẠCH TUYỆT ĐỐI — `attempt/[attemptId]/page.tsx`, `QuestionRenderer.tsx`, `AnswerChoice.tsx` về đúng HEAD (không còn diff), `lib/random/shuffle.ts` đã xóa. Batch chưa commit = đúng S#27 + S#28(A/B/C): Modified `ExamCard/ExamFilters/ExamPlayer/exams·[id]·page/exams·page/queries/fake-data/schema.sql/seed.ts/types·exam.ts` + Untracked `LeaveExamDialog.tsx`, `useLeaveGuard.ts`.
> ⚠️ Gotcha máy/user Windows mới: git báo "dubious ownership" → đã fix `git config --global --add safe.directory E:/StemWeb_project/MS-MOLAR`. Khi Git nhớ kiểm tra `git config user.name/user.email` (máy này có thể chưa set — pattern S#15/S#26).
> Chờ engineer tự kiểm S#27 + S#28(A/B/C) → xác nhận → Git.

## Git — Done (2026-07-11)
- Diff review `ExamPlayer.tsx` trước khi stage — xác nhận đúng phần leave-guard wiring (S#28 C), không dính tàn dư random.
- Stage đúng 12 file: `ExamCard.tsx`, `ExamFilters.tsx`, `ExamPlayer.tsx`, `LeaveExamDialog.tsx` (mới), `exams/[id]/page.tsx`, `exams/page.tsx`, `queries.ts`, `useLeaveGuard.ts` (mới), `lib/fake-data/exams.ts`, `supabase/schema.sql`, `supabase/seed.ts`, `types/exam.ts`.
- **KHÔNG stage** (đúng quy tắc chuẩn): `PROCESS.md`, `WORKFLOW.md`, `DESIGN.md`, `(only for engineer) UX-FEEL-CHECKLIST.md`, xóa `TEXT/`+`TEMPLATE/homepage_desktop.png`, `TEMPLATE/homepage/homepage.png`, `.claude/`, `.mcp.json`, `.playwright-mcp/`, stray `ASSETS/images/*.eps`+`License *.txt`+`blank-user-circles/`.
- Commit `50b8c65`, push `bba92a7..50b8c65 main -> main` ✅.

**S#27 + S#28(A/B/C) — DONE ✅.** Chờ TE1 cho task tiếp theo.

---
---

Document creating process (conversation)

"
The document-reviewer is still running on the UI Spec in the background. While it works, there are two decisions the ADR (the next doc in the chain) must resolve that the PRD explicitly reserves for the product owner — that's you. Getting these now means I can launch the ADR the moment the review lands, instead of serializing.

Both come straight from the UI Spec's Open Items (TBD-01 and TBD-02), and TBD-01 carries a PRD escalation condition that requires your confirmation before the Design Doc can be approved.

● User answered Claude's questions:
· UGC questions collect no per-question topic, but questions.topic is NOT NULL and feeds the result page's topic breakdown. How should topic be handled for user-submitted exams? → Default to subject name
· UGC pasted text must render as plain text (PRD security NFR), but the existing exam player renders questions through RichText (markdown + KaTeX). How should the published exam page render question content? → Sanitized markdown+KaTeX for all

Both decisions recorded. Key implications I'm noting for the downstream docs:

- Topic = subject name — this is the option that triggers the PRD's escalation condition (the result-page topic breakdown becomes a single uninformative bucket for UGC exams). You've now confirmed that trade-off as product owner, which satisfies the escalation. The ADR will document it as confirmed.
- Sanitized markdown+KaTeX for all — this is a bigger call than it looks: it means UGC (untrusted) content now flows through RichText, so the ADR/Design Doc must specify a sanitization layer + XSS fixture suite, and it creates a consequence for the UI Spec's D8 (which currently renders the author preview as plain text — for true WYSIWYG the preview may now need to show sanitized markdown too). The ADR will resolve that.

Let me persist these confirmed decisions to memory so they survive regardless of how the async agents land.

  Recalled 1 memory, wrote 4 memories

● Agent "Review UGC exam upload UI Spec" finished · 6m 41s

The reviewer came back: Approved with conditions — AC coverage is complete (all 31), Gate 0 passes, and it confirmed the 5 open items are correctly scoped as downstream. It found 3 required fixes (I001–I003) and 2 recommended (I004–I005), all surgical. It also independently flagged exactly the preview-rendering consequence I called out from your TBD-02 answer.

I'll apply all five conditions and fold in your two product decisions, bumping the UI Spec to v1.1. Doing the edits now.

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 3 lines, removed 3 lines

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-07-13 |
| **Status** | Draft — for review before ADR / Desig
| **Version** | 1.1 |
| **Date** | 2026-07-14 |
| **Status** | Accepted — reviewed by document-reviewer 2026-07-14 (approved with conditions I001–I005; all applied in v1.1). TBD-01 & T
BD-02 received product-owner decisions 2026-07-14, formalized in the ADR. |
| **PRD** | `docs/prd/ugc-exam-upload-prd.md` (v1.1,

## Overview

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line

## Overview

This UI Specification defines the screens, componentor the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers PRD requirements R1–R8 and R11–R13 plus the UI rdening) and R10 (backfill) have no UI surface and are
owned by the Design Doc.
This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admind exams join the catalog with author attribution. It co
vers the UI surfaces of PRD requirements R1–R8 and R11–R13; R7's author-attribution UI is included here while its `display_name` read-pa
th mechanism remains Design Doc scope. R9 (RLS hardening) and R10 (backfill) have no UI surface and are owned by the Design Doc.

All new screens use the site-wide "Ink & Lacquer" theme (`DESIGN.md`) and the existing layer-2 component conventions — no new design lan
guage is introduced.


● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D5 | **Preview confirmation** (AC-009): the per-question preview itself is the confirmation step. "Submit for review" is a distinct bu
tton that stays disabled until the current paste parses cleanly AND the preview is rendered from that exact text (any edit to the textar
ea invalidates the preview and re-disables submit). t action on a visible preview satisfies AC-009 with les
s friction than a second dialog |
| D6 | **Withdrawn submissions stay visible** in My exams with status "Withdrawn" and an "Edit & submit again" action that opens `/me/ex
ams/[id]/edit` pre-filled. This satisfies the PRD wicess to metadata and raw text"). Storage representation
 (status column vs. other) remains Design Doc scope, but hard delete without retention is excluded by this observable behavior | The PRD
's "without re-typing their exam" qualitative metric requires post-withdrawal access; keeping the item in the list is the simplest disco
verable mechanism |
| D7 | **Navigation**: in both `SiteHeader` (L2/3/4) and `HomeSidebar` (L1), the nav item `{ label: "Import", href: "/admin/import" }` b
ecomes `{ label: "Upload", href: "/upload" }` for all users; an additional item `{ label: "Review", href: "/admin/review" }` is appended
 **only when the current user's role is `admin`**. A "My exams" entry is added to the `HeaderProfile` / `SidebarProfile` dropdown (betwe
en "Edit" and "Sign out") linking to `/me/exams` | AC-001/AC-003; the profile dropdown is the natural home for self-service without addi
ng a fifth top-level tag |
| D8 | **Preview / review rendering of pasted content**: the author preview (S-01/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: ML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through `RichText` (markdown + KaTeX) — see Gap G1 in Open Items; the ADR must decide the pu
blished-path treatment. This spec fixes only the preted input rule (PRD Security NFR); flagging rather than
 silently deciding the player path keeps the ADR in control |
| D8 | **Preview / review rendering of pasted conten/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through `RichText` (markdown + KaTeX). Product owner decided 2026-07-14 (resolving Gap G1 /
TBD-02): the published path renders **sanitized** markdown + KaTeX for ALL exams, including UGC — no plain-text branch. Consequence for
this spec: the author preview (S-01/S-03) and admin review (S-05) still render **plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view;sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sanitized markdown | Untrusted input rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending review = border `#6B655C` + glyph `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text int input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required; matches `Exam.gr
ade` contract). Duration = number input, minutes, min 1 (required). School = free text (optional). School year = number input, 4-digit y
ear (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB constraint and the filter voca
bulary) | Mirrors browse-filter vocabularies as requallowing catalog growth (subjects are free-text in DB)
|
| D11 | **No per-question topic marker in the paste liberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a defaulting strategy — the ADR must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% firsxtra required markup |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D7 | **Navigation**: in both `SiteHeader` (L2/3/4) and `HomeSidebar` (L1), the nav item `{ label: "Import", href: "/admin/import" }` b
ecomes `{ label: "Upload", href: "/upload" }` for al{ label: "Review", href: "/admin/review" }` is appended
 **only when the current user's role is `admin`**. A "My exams" entry is added to the `HeaderProfile` / `SidebarProfile` dropdown (betwe
en "Edit" and "Sign out") linking to `/me/exams` | AC-001/AC-003; the profile dropdown is the natural home for self-service without addi
ng a fifth top-level tag |
| D8 | **Preview / review rendering of pasted content**: the author preview (S-01/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through . Product owner decided 2026-07-14 (resolving Gap G1 /
TBD-02): the published path renders **sanitized** markdown + KaTeX for ALL exams, including UGC — no plain-text branch. Consequence for
this spec: the author preview (S-01/S-03) and admin review (S-05) still render **plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view;sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sanitized markdown | Untrusted input rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending revi `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `#D8C9A8` (hairline) + glyph `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required; matches `Exam.gr
ade` contract). Duration = number input, minutes, mi text (optional). School year = number input, 4-digit y
ear (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB constraint and the filter voca
bulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subjects are free-text in DB)
|
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required). NOTE: this rang
e is a business assumption (Vietnamese secondary grade contract — `schema.sql` has `grade int not null` wit
h no range check and `types/exam.ts` types it as plain `number`; the Design Doc should confirm the range with the product owner and deci
de whether to add a DB check constraint. Duration = number input, minutes, min 1 (required). School = free text (optional). School year
= number input, 4-digit year (optional). Semester =  (optional; mirrors the `exams_semester_check` DB const
raint and the filter vocabulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subje
cts are free-text in DB) |
| D11 | **No per-question topic marker in the paste format**. The format in D2 deliberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a defaulting strategy — the ADR must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% firsxtra required markup |
| D12 | **Approve is one click** (no confirmation dialog); Reject always opens a dialog because the mandatory reason (AC-016) requires i
nput anyway. Approve/Reject are only rendered on the full-content preview screen (S-05), never on the queue list — the admin must have s
een the content to decide (PRD qualitative metric 3) | Single-admin throughput; the reject dialog already provides the "are you sure" pa
use for the destructive path |
| D13 | **Post-submit feedback**: successful submission redirects to `/me/exams?submitted=1`, which renders a dismissible `role="status"
` banner "Your exam was submitted for review." above cap) stays on the form with all data intact | Lands th
e author on the screen where they'll track status; avoids a bespoke success page |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D8 | **Preview / review rendering of pasted conten/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through `RichText` (markdown + KaTeX). Product owner decided 2026-07-14 (resolving Gap G1 /
TBD-02): the published path renders **sanitized** ma including UGC — no plain-text branch. Consequence for
this spec: the author preview (S-01/S-03) and admin review (S-05) still render **plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view; the ADR/Design Doc owns the sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sainput rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending revi `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `#D8C9A8` (hairline) + glyph `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required). NOTE: this rang
e is a business assumption (Vietnamese secondary grades 6–12), not an existing code contract — `schema.sql` has `grade int not null` wit
h no range check and `types/exam.ts` types it as plain `number`; the Design Doc should confirm the range with the product owner and deci
de whether to add a DB check constraint. Duration = (required). School = free text (optional). School year
= number input, 4-digit year (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB const
raint and the filter vocabulary) | Mirrors browse-fi by the task brief while allowing catalog growth (subje
cts are free-text in DB) |
| D11 | **No per-question topic marker in the paste liberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a defaulting strategy — the ADR must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% first-try parse) argues against extra required markup |
| D11 | **No per-question topic marker in the paste liberately omits topic to keep author burden low. Produ
ct owner decided 2026-07-14 (resolving TBD-01): every UGC question's `topic` defaults to the exam's **subject name**; the PRD escalation
 trade-off (a single, uninformative topic bucket on the UGC result page) was explicitly confirmed. The ADR formalizes this — no change t
o FormatGuide/parser needed | PRD metric 3 (≥80% firextra required markup |
| D12 | **Approve is one click** (no confirmation dialog); Reject always opens a dialog because the mandatory reason (AC-016) requires i
nput anyway. Approve/Reject are only rendered on the full-content preview screen (S-05), never on the queue list — the admin must have s
een the content to decide (PRD qualitative metric 3)he reject dialog already provides the "are you sure" pa
use for the destructive path |
| D13 | **Post-submit feedback**: successful submission redirects to `/me/exams?submitted=1`, which renders a dismissible `role="status"
` banner "Your exam was submitted for review." above the list. Failure (including cap) stays on the form with all data intact | Lands th
e author on the screen where they'll track status; avoids a bespoke success page |


Now the remaining four edits — the Accent token, the transitItems, and the Update History.

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| Card surface | `--block-bg` / `bg-card` | ivory c preview cards, panels |
| Primary action | `--brand` | `#A62C2B` | Submit/Approve/Reject/Withdraw/Send primary buttons, error text, correct-answer tag, rejecti
on left rule |
| On primary | `--brand-foreground` | `#EDE1C8` | Text on vermillion buttons (never pure white) |
| Accent | accent (gold) | `#B8863B` | `rule-divider`, focus underline on inputs, Published badge border, success-banner left rule — ne
ver as small text color |
| Accent (gold rule/underline) | DESIGN.md gold (hardcoded hex) | `#B8863B` | `rule-divider`, focus underline on inputs, Published badg
e border, success-banner left rule — never as smallT the Tailwind `bg-accent` / `--accent` CSS variable, w
hich is `#e3d5b6` (`globals.css`). The inherited Cancel-button hover (`hover:bg-accent`, from `LeaveExamDialog`) uses `#e3d5b6`, not `#
B8863B` — do not apply the gold hex there |
| Muted text | `muted-foreground` | `#6B655C` | Capisabled hints |
| Border | `border` | `#D8C9A8` | Hairlines, card borders, Withdrawn badge |
| Nav surface | `--nav-bg` | `rgb(27 21 18 / 0.97)` | SiteHeader (unchanged) |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 2 lines
| S-04 | S-05 | Queue row click / Enter | Submissio
| S-05 | S-04 | Approve confirmed by server, or Reject dialog submitted with reason | Reject requires non-empty reason (AC-016) |
| S-06 | S-06 | Report dialog submitted | Reason non-empty; server accepts (not duplicate) |
| S-07 | S-06 | ExamCard click | Existing entry conditions unchanged (published exams only) |
| S-05 | S-07 | Approve confirmed by server | Published exam becomes query-visible in the catalog |

## Component Decomposition


● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line

| ID | Description | Owner | Deadline |
|----|-------------|-------|----------|
| TBD-01 | Per-question `topic` resolution (PRD undpaste format (D2/D11) contains no topic marker, which p
re-constrains toward a defaulting strategy. If the ADR instead requires per-question topic input, the FormatGuide rules/example and par
ser errors in this spec must be revised, and the PRD escalation condition (product-owner confirmation) applies | ADR (`docs/adr/`) | Be
fore Design Doc approval (target 2026-07-20) |
| TBD-01 | ~~Per-question `topic` resolution~~ **DECIDED 2026-07-14**: defaults to the exam subject name; PRD escalation trade-off conf
irmed by product owner (see D11). ADR to formalize;ser needed | ADR (`docs/adr/`) | Resolved |
| TBD-02 | **Gap G1 — published-path rendering conflict**: PRD Security NFR says pasted text is "rendered as text, never as HTML/markup
" in preview, review queue, and published views; bunders question content through `RichText` (markdown + K
aTeX). This spec fixes plain-text rendering for preview (S-01/S-03) and review (S-05); the ADR must decide the published-view path (pla
in-text branch for UGC vs. sanitized markdown for aeeded exams | ADR / Design Doc | Before Design Doc appr
oval (target 2026-07-20) |
| TBD-03 | Author `display_name` read path (widened RLS select vs. denormalized `author_display_name`) — required by AuthorByline (both
), ReviewQueueList, ReportsPanel reporter names (D3dmin, which extends the same read-path question to repo
rters) | ADR / Design Doc | Before Design Doc approval (target 2026-07-20) |
| TBD-04 | Input limits: max questions/exam, max lengths for title/stem/choice/rejection reason/report reason; parser grammar tolerance
 beyond the fixed on-page example | Design Doc | Design Doc draft (target 2026-07-24) |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| ID | Description | Owner | Deadline |
|----|-------------|-------|----------|
| TBD-01 | ~~Per-question `topic` resolution~~ **DECIDED 2026-07-14**: defaults to the exam subject name; PRD escalation trade-off conf
irmed by product owner (see D11). ADR to formalize;ser needed | ADR (`docs/adr/`) | Resolved |
| TBD-02 | **Gap G1 — published-path rendering conflict**: PRD Security NFR says pasted text is "rendered as text, never as HTML/markup
" in preview, review queue, and published views; but the existing exam player renders question content through `RichText` (markdown + K
aTeX). This spec fixes plain-text rendering for preS-05); the ADR must decide the published-view path (pla
in-text branch for UGC vs. sanitized markdown for all) and its blast radius on seeded exams | ADR / Design Doc | Before Design Doc appr
oval (target 2026-07-20) |
| TBD-02 | ~~Gap G1 — published-path rendering conf: published view renders **sanitized markdown + KaTeX f
or all exams** (incl. UGC) — see D8. The resolution keeps the exam-attempt/player screen uniform (no UGC-only branch), so no new player
-screen UI states and no UI Spec player addendum are required; the ADR/Design Doc owns the sanitization layer + XSS fixtures. Remaining
 ADR sub-question: whether to later make the author preview render the same sanitized markdown (WYSIWYG) instead of the plain text this
 spec fixes | ADR / Design Doc | Resolved (sanitiza
| TBD-03 | Author `display_name` read path (widened RLS select vs. denormalized `author_display_name`) — required by AuthorByline (both
), ReviewQueueList, ReportsPanel reporter names (D3dmin, which extends the same read-path question to repo
rters) | ADR / Design Doc | Before Design Doc approval (target 2026-07-20) |
| TBD-04 | Input limits: max questions/exam, max leejection reason/report reason; parser grammar tolerance
 beyond the fixed on-page example | Design Doc | Design Doc draft (target 2026-07-24) |
| TBD-05 | `docs/project-context/external-resourcesing protocol requires interactive user input. Run the p
roject-tier hearing in an interactive session and reconcile the feature-tier table above | User + next interactive agent session | Befo
re Design Doc creation |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line
| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-07-13 | 1.0 | Initial version from PRD v1.1
| 2026-07-14 | 1.1 | Applied document-reviewer conditions I001–I005 (added two transition-table rows; corrected D10 grade rationale to
a business assumption; disambiguated the Accent tokr; reworded TBD-02 and the Overview scope line). Record
ed product-owner decisions for TBD-01 (topic → subject name) and TBD-02 (sanitized markdown + KaTeX for all exams) and updated D8/D11 a
ccordingly | Claude (Opus 4.8) |

All nine edits landed — the UI Spec is now v1.1, Accepted (ad, both your decisions folded into D8/D11 and the Open Items). Updating the memory status, then launching the ADR — the next document in the chain.

  Wrote 1 memory

● dev-workflows-fullstack:technical-designer(Create UGC exam u
Backgrounded agent (↓ to manage · ctrl+o to expand)

The ADR is now being written in the background (it's a meaty one — it owns the sanitization architecture for your "markdown for all" decision, the RLS/lifecycle strategy, and the display_name read-path choice). That'll take a few minutes.

Rather than sit idle, let me knock out the one interactive prerequisite the Design Doc needs — TBD-05, the external-resources hearing (docs/project-context/external-resources.md doesn't exist yet). This is independent of the ADR, so doing it now means the Design Doc won't be blocked
when the ADR lands. Let me load the protocol for that.

● Skill(dev-workflows-fullstack:external-resource-context)
Successfully loaded skill

This is a fullstack feature (Next.js + Supabase), so the hearing spans frontend, backend, and infra axes. Let me read those domain references so I ask
the right questions.

  Read 4 files

Most of these axes I can determine straight from the repo raconfirm the few facts I can't see — env/secret handling,deployment, and whether a Supabase MCP exists — before asking you only what's genuinely unknown.

  Searched for 2 patterns, read 1 file

Good — that tells me a lot: Supabase SSR client setup (lib/supabase/{client,server,middleware}.ts), env-var-based config, only the Playwright MCP (no
Supabase DB MCP), and notably an existing SOURCE/supabase/teto the PRD's RLS-verification success metric). Let me confirmthe access mechanisms in these small files.

  Read 3 files

I've now determined almost every axis directly from the repo and the PRD — I don't need to ask you about those. Here's what I found and will record:

- Design origin / guidelines: DESIGN.md (repo) — file read
- Design system: in-repo components + components/ui/button (base-ui/cva), tokens in globals.css; no Storybook
- Visual verification: npm run dev + the Playwright MCP (.mc
- DB schema source: SOURCE/supabase/schema.sql (file read); no Supabase DB MCP — live DB reached manually via the Supabase dashboard SQL Editor
- Migrations: none — single idempotent schema.sql
- Secret store: SOURCE/.env.local (gitignored, dev-only) — N key, and a service_role key used only by local scripts
- RLS verification harness: SOURCE/supabase/test-rls.ts (cd SOURCE && npx tsx supabase/test-rls.ts) — directly supports the PRD's zero-leak success
metric
- Background jobs / IaC / separate API schema: none (Server Actions + Supabase client directly)

Only two things I genuinely can't tell from the repo:
## Overview

This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers PRD requirements R1–R8 and R11–R13 plus the UI rdening) and R10 (backfill) have no UI surface and are
owned by the Design Doc.
This UI Specification defines the screens, componentor the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers the UI surfaces of PRD requirements R1–R8 and R11–R13; R7's author-attribution UI is included here while its `display_name` read-pa
th mechanism remains Design Doc scope. R9 (RLS harde no UI surface and are owned by the Design Doc.

  Searched for 1 pattern, read 2 files

Yes, the dev-workflows-fullstack plugin is active (its skills/agents are showing in my available list).

I found your two docs and see where the chain stopped:

- PRD (docs/prd/ugc-exam-upload-prd.md) — v1.1, Accepted (reviewed & approved 2026-07-13)
- UI Spec (docs/ui-spec/ugc-exam-upload-ui-spec.md) — v1.0, Draft — for review before ADR/Design Doc

The doc chain for this LARGE-scale feature is PRD → UI Spec → ADR → Design Doc → Work Plan. The UI Spec exists but is still in Draft status — it hasn't gone through document-reviewer yet, and no ADR exists. Let me check the remaining Open Items section of the UI Spec before deciding the next step.

  Read 1 file

Both docs are in good shape. Current state:

- PRD — v1.1, Accepted ✅
- UI Spec — v1.0, Draft — for review before ADR/Design Doc (this is where the process stopped)
- ADR — not created yet
- No docs/project-context/external-resources.md (TBD-05 flag

The UI Spec itself flags 5 open items to resolve downstream (TBD-01–05), the most relevant now being TBD-05: it needs an interactive
"external-resources hearing" before Design Doc creation, whie questions.

The natural next step in the PRD→UI Spec→ADR→Design Doc→Work Plan chain is to run the document-reviewer on the UI Spec (it's still Draft, not yet
reviewed) before moving to the ADR. Let me kick that off.

● dev-workflows-fullstack:document-reviewer(Review UGC exam upload UI Spec)
Backgrounded agent (↓ to manage · ctrl+o to expand)

I've kicked off the document-reviewer agent in the background to review the UI Spec against the PRD (checking AC coverage, consistency, and whether the 5 open TBD items should block sign-off). I'll let you know when it finishes and we'll move to the ADR step next.

✻ Cogitated for 39s

❯ /effort
  ⎿  Set effort level to high (saved as your default for new sessions): Comprehensive implementation with extensive testing and documentation · burns fastest — medium handles most tasks

❯ /model
  ⎿  Set model to Opus 4.8 and saved as your default for new sessions

❯ ok, lets go on this work: complete document creating

The document-reviewer is still running on the UI Spec in the background. While it works, there are two decisions the ADR (the next doc in the chain)
must resolve that the PRD explicitly reserves for the produc these now means I can launch the ADR the moment the review
❯ ok, lets go on this work: complete document creating

The document-reviewer is still running on the UI Spec in thethere are two decisions the ADR (the next doc in the chain)must resolve that the PRD explicitly reserves for the product owner — that's you. Getting these now means I can launch the ADR the moment the review lands, instead of serializing.

Both come straight from the UI Spec's Open Items (TBD-01 and TBD-02), and TBD-01 carries a PRD escalation condition that requires your confirmation before the Design Doc can be approved.

● User answered Claude's questions:
· UGC questions collect no per-question topic, but questions.topic is NOT NULL and feeds the result page's topic breakdown. How should topic be handled for user-submitted exams? → Default to subject name
· UGC pasted text must render as plain text (PRD securityplayer renders questions through RichText (markdown + KaTeX).How should the published exam page render question content? → Sanitized markdown+KaTeX for all

Both decisions recorded. Key implications I'm noting for the

- Topic = subject name — this is the option that triggers th(the result-page topic breakdown becomes a singleuninformative bucket for UGC exams). You've now confirmed that trade-off as product owner, which satisfies the escalation. The ADR will document it as confirmed.
- Sanitized markdown+KaTeX for all — this is a bigger call tntrusted) content now flows through RichText, so theADR/Design Doc must specify a sanitization layer + XSS fixture suite, and it creates a consequence for the UI Spec's D8 (which currently renders the author preview as plain text — for true WYSIWYG the preview may now need to show sanitized markdown too). The ADR will resolve that.

Let me persist these confirmed decisions to memory so they survive regardless of how the async agents land.

  Recalled 1 memory, wrote 4 memories

● Agent "Review UGC exam upload UI Spec" finished · 6m 41s

The reviewer came back: Approved with conditions — AC coverage is complete (all 31), Gate 0 passes, and it confirmed the 5 open items are correctly scoped as downstream. It found 3 required fixes (I001–I003) and 2 recommended (I004–I005), all surgical. It also independently flagged exactly the
preview-rendering consequence I called out from your TBD-02

I'll apply all five conditions and fold in your two product decisions, bumping the UI Spec to v1.1. Doing the edits now.

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 3 lines, removed 3 lines

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-07-13 |
| **Status** | Draft — for review before ADR / Design Doc |
| **Version** | 1.1 |
| **Date** | 2026-07-14 |
| **Status** | Accepted — reviewed by document-reviewer 2026-07-14 (approved with conditions I001–I005; all applied in v1.1). TBD-01 & T
BD-02 received product-owner decisions 2026-07-14, f
| **PRD** | `docs/prd/ugc-exam-upload-prd.md` (v1.1, Accepted) |

## Overview

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line

## Overview

This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers PRD requirements R1–R8 and R11–R13 plus the UI rdening) and R10 (backfill) have no UI surface and are
owned by the Design Doc.
This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admind exams join the catalog with author attribution. It co
vers the UI surfaces of PRD requirements R1–R8 and R11–R13; R7's author-attribution UI is included here while its `display_name` read-pa
th mechanism remains Design Doc scope. R9 (RLS hardening) and R10 (backfill) have no UI surface and are owned by the Design Doc.

|---|---|
| **Version** | 1.0 |
| **Date** | 2026-07-13 |
| **Status** | Draft — for review before ADR / Design Doc |
| **Version** | 1.1 |
| **Date** | 2026-07-14 |
| **Status** | Accepted — reviewed by document-reviewer 2026-07-14 (approved with conditions I001–I005; all applied in v1.1). TBD-01 & T
BD-02 received product-owner decisions 2026-07-14, formalized in the ADR. |
| **PRD** | `docs/prd/ugc-exam-upload-prd.md` (v1.1, Accepted) |

## Overview

1 line, removed 1 line

## Overview

This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers PRD requirements R1–R8 and R11–R13 plus the UI touchpoints of R7; R9 (RLS hardening) and R10 (backfill) have no UI surface and are
owned by the Design Doc.
This UI Specification defines the screens, components, states, and interactions for the UGC exam upload feature: authors submit complete
 multiple-choice exams as plain text, a single admin moderates them, and published exams join the catalog with author attribution. It co
vers the UI surfaces of PRD requirements R1–R8 and R11–R13; R7's author-attribution UI is included here while its `display_name` read-pa
th mechanism remains Design Doc scope. R9 (RLS hardening) and R10 (backfill) have no UI surface and are owned by the Design Doc.

All new screens use the site-wide "Ink & Lacquer" theme (`DESIGN.md`) and the existing layer-2 component conventions — no new design lan
guage is introduced.


● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D5 | **Preview confirmation** (AC-009): the per-question preview itself is the confirmation step. "Submit for review" is a distinct bu
tton that stays disabled until the current paste pars rendered from that exact text (any edit to the textar
ea invalidates the preview and re-disables submit). No additional modal | Explicit action on a visible preview satisfies AC-009 with les
s friction than a second dialog |
| D6 | **Withdrawn submissions stay visible** in My  and an "Edit & submit again" action that opens `/me/ex
g a fifth top-level tag |
| D8 | **Preview / review rendering of pasted content**: the author preview (S-01/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through `RichText` (markdown + KaTeX) — see Gap G1 in Open Items; the ADR must decide the pu
blished-path treatment. This spec fixes only the preview/review surfaces | Untrusted input rule (PRD Security NFR); flagging rather than
 silently deciding the player path keeps the ADR in control |
| D8 | **Preview / review rendering of pasted content**: the author preview (S-01/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through `RichText` (markdown + KaTeX). Product owner decided 2026-07-14 (resolving Gap G1 /
TBD-02): the published path renders **sanitized** markdown + KaTeX for ALL exams, including UGC — no plain-text branch. Consequence for
this spec: the author preview (S-01/S-03) and admin review (S-05) still render **plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view; the ADR/Design Doc owns the sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sanitized markdown | Untrusted input rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending review = border `#6B655C` + glyph `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `#D8C9A8` (hairline) + glyph `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `swed. Grade = select of 6–12 (required; matches `Exam.gr
ade` contract). Duration = number input, minutes, min 1 (required). School = free text (optional). School year = number input, 4-digit y
ear (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB constraint and the filter voca
bulary) | Mirrors browse-filter vocabularies as requallowing catalog growth (subjects are free-text in DB)
|
| D11 | **No per-question topic marker in the paste format**. The format in D2 deliberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a  must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% first-try parse) argues against extra required markup |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D7 | **Navigation**: in both `SiteHeader` (L2/3/4) and `HomeSidebar` (L1), the nav item `{ label: "Import", href: "/admin/import" }` b
ecomes `{ label: "Upload", href: "/upload" }` for all users; an additional item `{ label: "Review", href: "/admin/review" }` is appended
 **only when the current user's role is `admin`**. A the `HeaderProfile` / `SidebarProfile` dropdown (betwe
en "Edit" and "Sign out") linking to `/me/exams` | AC-001/AC-003; the profile dropdown is the natural home for self-service without addi
ng a fifth top-level tag |
| D8 | **Preview / review rendering of pasted content**: the author preview (S-01/S-03) and the admin full-content preview (S-05) render
 stems and choices as **plain text** (`white-space: pre-wrap`, no markdown, no HTML, no LaTeX) per the PRD security NFR. NOTE: the exist
ing published-exam player renders questions through . Product owner decided 2026-07-14 (resolving Gap G1 /
TBD-02): the published path renders **sanitized** markdown + KaTeX for ALL exams, including UGC — no plain-text branch. Consequence for
this spec: the author preview (S-01/S-03) and admin plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view; the ADR/Design Doc owns the sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sainput rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending revi `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `#D8C9A8` (hairline) + glyph `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required; matches `Exam.gr
ade` contract). Duration = number input, minutes, mi text (optional). School year = number input, 4-digit y
ear (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB constraint and the filter voca
bulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subjects are free-text in DB)
|
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required). NOTE: this rang
e is a business assumption (Vietnamese secondary grade contract — `schema.sql` has `grade int not null` wit
ear (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB constraint and the filter voca
bulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subjects are free-text in DB)
|
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required). NOTE: this rang
e is a business assumption (Vietnamese secondary grades 6–12), not an existing code contract — `schema.sql` has `grade int not null` wit
h no range check and `types/exam.ts` types it as plain `number`; the Design Doc should confirm the range with the product owner and deci
de whether to add a DB check constraint. Duration = number input, minutes, min 1 (required). School = free text (optional). School year
= number input, 4-digit year (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB const
raint and the filter vocabulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subje
cts are free-text in DB) |
| D11 | **No per-question topic marker in the paste format**. The format in D2 deliberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a defaulting strategy — the ADR must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% first-try parse) argues against extra required markup |
| D12 | **Approve is one click** (no confirmation didialog because the mandatory reason (AC-016) requires i
nput anyway. Approve/Reject are only rendered on the full-content preview screen (S-05), never on the queue list — the admin must have s
een the content to decide (PRD qualitative metric 3) | Single-admin throughput; the reject dialog already provides the "are you sure" pa
use for the destructive path |
een the content to decide (PRD qualitative metric 3) | Single-admin throughput; the reject dialog already provides the "are you sure" pa
use for the destructive path |
| D13 | **Post-submit feedback**: successful submissubmitted=1`, which renders a dismissible `role="status"
` banner "Your exam was submitted for review." above the list. Failure (including cap) stays on the form with all data intact | Lands th
e author on the screen where they'll track status; avoids a bespoke success page |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| D8 | **Preview / review rendering of pasted conten/S-03) and the admin full-content preview (S-05) render
his spec: the author preview (S-01/S-03) and admin review (S-05) still render **plain text** here for untrusted-input safety, so they a
re deliberately NOT WYSIWYG with the published view; the ADR/Design Doc owns the sanitization layer + XSS fixtures and decides whether a
 later addendum makes the preview render the same sanitized markdown | Untrusted input rule (PRD Security NFR); the sanitization design
is delegated to the ADR |
| D9 | **Status badge treatment**: text-label badge, `rounded-sm` (4px), 1px colored border, transparent background, text in `foreground
` `#1B1512` with a small leading glyph. Pending review = border `#6B655C` + glyph `◌`; Published = border `#B8863B` + glyph `✓`; Rejecte
d = border `#A62C2B` + glyph `✕`; Withdrawn = border `#D8C9A8` (hairline) + glyph `−`. The word itself is always present — status is nev
er conveyed by color alone (PRD a11y NFR) | Bronze gold `#B8863B` as *text* on ivory fails AA contrast (~2.5:1); using it only for the b
order keeps text at 12.9:1 |
| D10 | **Metadata input controls**: Title = text input (required). Subject = text input with `datalist` suggestions from the existing c
atalog facet values (same source as `ExamFilters` `subjects`) — new subjects allowed. Grade = select of 6–12 (required). NOTE: this rang
e is a business assumption (Vietnamese secondary grades 6–12), not an existing code contract — `schema.sql` has `grade int not null` wit
h no range check and `types/exam.ts` types it as plain `number`; the Design Doc should confirm the range with the product owner and deci
de whether to add a DB check constraint. Duration = number input, minutes, min 1 (required). School = free text (optional). School year
= number input, 4-digit year (optional). Semester = select `HK1` / `HK2` / "None" (optional; mirrors the `exams_semester_check` DB const
raint and the filter vocabulary) | Mirrors browse-filter vocabularies as required by the task brief while allowing catalog growth (subje
cts are free-text in DB) |
| D11 | **No per-question topic marker in the paste format**. The format in D2 deliberately omits topic to keep author burden low. This
pre-constrains the PRD's open "topic" item toward a defaulting strategy — the ADR must resolve it and the PRD escalation condition appli
es (see Open Items TBD-01) | PRD metric 3 (≥80% first-try parse) argues against extra required markup |
| D11 | **No per-question topic marker in the paste liberately omits topic to keep author burden low. Produ
ct owner decided 2026-07-14 (resolving TBD-01): every UGC question's `topic` defaults to the exam's **subject name**; the PRD escalation
 trade-off (a single, uninformative topic bucket on the UGC result page) was explicitly confirmed. The ADR formalizes this — no change t
o FormatGuide/parser needed | PRD metric 3 (≥80% first-try parse) argues against extra required markup |
| D12 | **Approve is one click** (no confirmation dialog); Reject always opens a dialog because the mandatory reason (AC-016) requires i
nput anyway. Approve/Reject are only rendered on the full-content preview screen (S-05), never on the queue list — the admin must have s
een the content to decide (PRD qualitative metric 3)he reject dialog already provides the "are you sure" pa
use for the destructive path |
| D13 | **Post-submit feedback**: successful submission redirects to `/me/exams?submitted=1`, which renders a dismissible `role="status"
` banner "Your exam was submitted for review." above cap) stays on the form with all data intact | Lands th
e author on the screen where they'll track status; avoids a bespoke success page |


Now the remaining four edits — the Accent token, the transitItems, and the Update History.

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| Card surface | `--block-bg` / `bg-card` | ivory card variant | SubmissionCard, preview cards, panels |
| Primary action | `--brand` | `#A62C2B` | Submit/Approve/Reject/Withdraw/Send primary buttons, error text, correct-answer tag, rejecti
on left rule |
| On primary | `--brand-foreground` | `#EDE1C8` | Tver pure white) |
| Accent | accent (gold) | `#B8863B` | `rule-divider`, focus underline on inputs, Published badge border, success-banner left rule — ne
ver as small text color |
| Accent (gold rule/underline) | DESIGN.md gold (hardcoded hex) | `#B8863B` | `rule-divider`, focus underline on inputs, Published badg
e border, success-banner left rule — never as smallT the Tailwind `bg-accent` / `--accent` CSS variable, w
hich is `#e3d5b6` (`globals.css`). The inherited Cancel-button hover (`hover:bg-accent`, from `LeaveExamDialog`) uses `#e3d5b6`, not `#
B8863B` — do not apply the gold hex there |
| Muted text | `muted-foreground` | `#6B655C` | Captions, bylines, timestamps, disabled hints |
| Border | `border` | `#D8C9A8` | Hairlines, card borders, Withdrawn badge |
| Nav surface | `--nav-bg` | `rgb(27 21 18 / 0.97)`

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 2 lines
| S-04 | S-05 | Queue row click / Enter | Submission still `pending_review` |
| S-05 | S-04 | Approve confirmed by server, or Reject dialog submitted with reason | Reject requires non-empty reason (AC-016) |
| S-06 | S-06 | Report dialog submitted | Reason noduplicate) |
| S-07 | S-06 | ExamCard click | Existing entry conditions unchanged (published exams only) |
| S-05 | S-07 | Approve confirmed by server | Published exam becomes query-visible in the catalog |

## Component Decomposition


ser errors in this spec must be revised, and the PRD escalation condition (product-owner confirmation) applies | ADR (`docs/adr/`) | Be
fore Design Doc approval (target 2026-07-20) |
| TBD-01 | ~~Per-question `topic` resolution~~ **DECIDED 2026-07-14**: defaults to the exam subject name; PRD escalation trade-off conf
irmed by product owner (see D11). ADR to formalize; no change to FormatGuide/parser needed | ADR (`docs/adr/`) | Resolved |
| TBD-02 | **Gap G1 — published-path rendering conflict**: PRD Security NFR says pasted text is "rendered as text, never as HTML/markup
" in preview, review queue, and published views; but the existing exam player renders question content through `RichText` (markdown + K
aTeX). This spec fixes plain-text rendering for preview (S-01/S-03) and review (S-05); the ADR must decide the published-view path (pla
in-text branch for UGC vs. sanitized markdown for all) and its blast radius on seeded exams | ADR / Design Doc | Before Design Doc appr
oval (target 2026-07-20) |
| TBD-03 | Author `display_name` read path (widened RLS select vs. denormalized `author_display_name`) — required by AuthorByline (both
), ReviewQueueList, ReportsPanel reporter names (D3 shows reporter identity to admin, which extends the same read-path question to repo
rters) | ADR / Design Doc | Before Design Doc approval (target 2026-07-20) |
| TBD-04 | Input limits: max questions/exam, max lengths for title/stem/choice/rejection reason/report reason; parser grammar tolerance
 beyond the fixed on-page example | Design Doc | Design Doc draft (target 2026-07-24) |

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| ID | Description | Owner | Deadline |
|----|-------------|-------|----------|
| TBD-01 | ~~Per-question `topic` resolution~~ **DECIDED 2026-07-14**: defaults to the exam subject name; PRD escalation trade-off conf
irmed by product owner (see D11). ADR to formalize;ser needed | ADR (`docs/adr/`) | Resolved |
| TBD-02 | **Gap G1 — published-path rendering conflict**: PRD Security NFR says pasted text is "rendered as text, never as HTML/markup
" in preview, review queue, and published views; but the existing exam player renders question content through `RichText` (markdown + K
aTeX). This spec fixes plain-text rendering for preview (S-01/S-03) and review (S-05); the ADR must decide the published-view path (pla
in-text branch for UGC vs. sanitized markdown for all) and its blast radius on seeded exams | ADR / Design Doc | Before Design Doc appr
oval (target 2026-07-20) |
| TBD-02 | ~~Gap G1 — published-path rendering conflict~~ **DECIDED 2026-07-14**: published view renders **sanitized markdown + KaTeX f
or all exams** (incl. UGC) — see D8. The resolutionr screen uniform (no UGC-only branch), so no new player
| 2026-07-13 | 1.0 | Initial version from PRD v1.1 | ui-spec agent (Claude) |
| 2026-07-14 | 1.1 | Applied document-reviewer conditions I001–I005 (added two transition-table rows; corrected D10 grade rationale to
a business assumption; disambiguated the Accent token from the `--accent` CSS var; reworded TBD-02 and the Overview scope line). Record
ed product-owner decisions for TBD-01 (topic → subject name) and TBD-02 (sanitized markdown + KaTeX for all exams) and updated D8/D11 a
ccordingly | Claude (Opus 4.8) |

All nine edits landed — the UI Spec is now v1.1, Accepted (all reviewer conditions applied, both your decisions folded into D8/D11 and the Open Items). Updating the memory status, then launching the ADR — the next document in the chain.

  Wrote 1 memory

● dev-workflows-fullstack:technical-designer(Create UGC exam upload ADR)
Backgrounded agent (↓ to manage · ctrl+o to expand)

The ADR is now being written in the background (it's a meaty one — it owns the sanitization architecture for your "markdown for all" decision, the RLS/lifecycle strategy, and the display_name read-path choice). That'll take a few minutes.

Rather than sit idle, let me knock out the one interactive prerequisite the Design Doc needs — TBD-05, the external-resources hearing (docs/project-context/external-resources.md doesn't exist yet). This is independent of the ADR, so doing it now means the Design Doc won't be blocked when the ADR lands. Let me load the protocol for that.

● Skill(dev-workflows-fullstack:external-resource-context)
Successfully loaded skill

This is a fullstack feature (Next.js + Supabase), so the hearing spans frontend, backend, and infra axes. Let me read those domain references so I ask
the right questions.

  Read 4 files

Most of these axes I can determine straight from the repo rather than asking you. Let me confirm the few facts I can't see — env/secret handling, deployment, and whether a Supabase MCP exists — before asking you only what's genuinely unknown.

  Searched for 2 patterns, read 1 file

Good — that tells me a lot: Supabase SSR client setup (lib/supabase/{client,server,middleware}.ts), env-var-based config, only the Playwright MCP (no
Supabase DB MCP), and notably an existing SOURCE/supabase/teto the PRD's RLS-verification success metric). Let me confirmthe access mechanisms in these small files.

  Read 3 files

I've now determined almost every axis directly from the repoo ask you about those. Here's what I found and will record:

- Design origin / guidelines: DESIGN.md (repo) — file read
- Design system: in-repo components + components/ui/button (base-ui/cva), tokens in globals.css; no Storybook
- Visual verification: npm run dev + the Playwright MCP (.mcp.json)
- DB schema source: SOURCE/supabase/schema.sql (file read); reached manually via the Supabase dashboard SQL Editor
- Migrations: none — single idempotent schema.sql
- Secret store: SOURCE/.env.local (gitignored, dev-only) — N key, and a service_role key used only by local scripts
- RLS verification harness: SOURCE/supabase/test-rls.ts (cd SOURCE && npx tsx supabase/test-rls.ts) — directly supports the PRD's zero-leak success
metric
- Background jobs / IaC / separate API schema: none (Server Actions + Supabase client directly)

Only two things I genuinely can't tell from the repo:

● User answered Claude's questions:
· Is MS-MOLAR deployed anywhere, or local-only pre-launchno traffic' — I want to confirm the hosting/environment
- Design origin / guidelines: DESIGN.md (repo) — file read
- Design system: in-repo components + components/ui/button (base-ui/cva), tokens in globals.css; no Storybook
- Visual verification: npm run dev + the Playwright MCP (.mcp.json)
- DB schema source: SOURCE/supabase/schema.sql (file read); no Supabase DB MCP — live DB reached manually via the Supabase dashboard SQL Editor
- Migrations: none — single idempotent schema.sql
- Secret store: SOURCE/.env.local (gitignored, dev-only) — NEXT_PUBLIC_SUPABASE_URL, anon key, and a service_role key used only by local scripts
- RLS verification harness: SOURCE/supabase/test-rls.ts (cd SOURCE && npx tsx supabase/test-rls.ts) — directly supports the PRD's zero-leak success metric
- Background jobs / IaC / separate API schema: none (Server ectly)

Only two things I genuinely can't tell from the repo:
 everything

Everything's confirmed: local-only pre-launch, single Supabase project, no other external resources. I can now write the project-tier file with every axis filled in — this resolves TBD-05, the last prerequisite for the Design Doc.

● Write(docs\project-context\external-resources.md)
Wrote 96 lines to docs\project-context\external-resources.md
# External Resources

Last updated: 2026-07-14
This file records the external resources available to this project and how to access them. AI agents and contributors consult this file wh
en work depends on resources outside the repository. Feature-specific identifiers belong in the consuming UI Spec or Design Doc, not here
— this file holds environment-stable facts only.

> Environment summary: MS-MOLAR is a Next.js (App Router) + Supabase app, **local-only and pre-launch** (no hosted environment, no CI/CD,

## Frontend
… +99 lines

Now updating the UI Spec to reflect that TBD-05 is resolved (its "External Resources Used" note and the Open Items row).

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line

ve user input that was not available in this session. The table below records feature-tier facts derivable from the repository itself;
running the project-tier hearing is listed in Open Items (TBD-05).
> Note: the project-tier file `docs/project-context/external-resources.md` now exists (created 2026-07-14 via the external-resource-cont
ext hearing — TBD-05 resolved). The table below records feature-tier identifiers only; project-tier access methods (URLs, MCP names, com
mands) and the full environment picture (local-only pre-launch, single Supabase project) live in that file.

| Resource (project-tier label) | Feature-specific identifier | Notes |
|-------------------------------|-----------------------------|-------|

● Update(docs\ui-spec\ugc-exam-upload-ui-spec.md)
Added 1 line, removed 1 line
| TBD-02 | ~~Gap G1 — published-path rendering conflict~~ **DECIDED 2026-07-14**: published view renders **sanitized markdown + KaTeX f
or all exams** (incl. UGC) — see D8. The resolution keeps the exam-attempt/player screen uniform (no UGC-only branch), so no new player
-screen UI states and no UI Spec player addendum are required; the ADR/Design Doc owns the sanitization layer + XSS fixtures. Remaining
 ADR sub-question: whether to later make the author preview render the same sanitized markdown (WYSIWYG) instead of the plain text this
 spec fixes | ADR / Design Doc | Resolved (sanitization design → ADR) |
| TBD-03 | Author `display_name` read path (widened RLS select vs. denormalized `author_display_name`) — required by AuthorByline (both
), ReviewQueueList, ReportsPanel reporter names (D3 shows reporter identity to admin, which extends the same read-path question to repo
rters) | ADR / Design Doc | Before Design Doc approval (target 2026-07-20) |
| TBD-04 | Input limits: max questions/exam, max lengths for title/stem/choice/rejection reason/report reason; parser grammar tolerance
 beyond the fixed on-page example | Design Doc | De7-24) |
| TBD-05 | `docs/project-context/external-resources.md` does not exist; the hearing protocol requires interactive user input. Run the p
roject-tier hearing in an interactive session and reconcile the feature-tier table above | User + next interactive agent session | Befo
re Design Doc creation |
| TBD-05 | ~~`docs/project-context/external-resources.md` does not exist~~ **RESOLVED 2026-07-14**: project-tier external-resources hea
ring completed; file created and the feature-tier table reconciled. Environment: local-only pre-launch, single Supabase project, DDL ap
plied manually via the Supabase SQL Editor | User (
| TBD-05 | ~~`docs/project-context/external-resources.md` does not exist~~ **RESOLVED 2026-07-14**: project-tier external-resources hea
ring completed; file created and the feature-tier table reconciled. Environment: local-only pre-launch, single Supabase project, DDL ap
plied manually via the Supabase SQL Editor | User (

## Update History


Now let me update the memory status to reflect TBD-05 resolv stand while the ADR finishes.

  Wrote 1 memory

Here's where the document chain stands. While the ADR is stiround, I've cleared everything else that was blockingdownstream work:

Progress

┌───────────────────────┬──────────────────────────────────────────┐
│       Document        │                  Status
├───────────────────────┼──────────────────────────────────────────┤
│ PRD                   │ v1.1 — Accepted (unchanged)
├───────────────────────┼──────────────────────────────────────────┤
│ UI Spec               │ v1.1 — Accepted ✅ (was Draft)
├───────────────────────┼──────────────────────────────────────────┤
│ external-resources.md │ Created ✅ (new — docs/project-con
├───────────────────────┼──────────────────────────────────────────┤
│ ADR                   │ ⏳ Being written now
├───────────────────────┼──────────────────────────────────────────┤
│ Design Doc            │ Not started                              │
├───────────────────────┼───────────────────────────────────
 — TBD-03 resolved: denormalize author_display_name/reporter_display_name onto the rows rather than loosening the owner-only profiles RLS (staleness-on-rename accepted).
- ADR-0004 — Shared isomorphic parser, server-authoritative re-parse, topic defaulting to subject.

The reviewer is checking cross-ADR consistency (they share a schema), feasibility under the idempotent-schema.sql constraint, and that the security ACs are actually satisfiable by the ADR-0001 mechanisms. Once it lands, I'll apply any conditions and move to the Design Doc — which now has all prerequisites in place. I'll report back when the review completes.

✻ Cogitated for 59s

● Agent "Review UGC exam upload ADRs" finished · 4m 31s

ADR review is back: Approved with conditions. Gate 0 passed on all four, both locked decisions recorded faithfully, cross-ADR schema consistent. But it caught two important correctness bugs in ADR-0001 that the Design Doc would otherwise inherit — one is a genuinely serious catch:

- I001 (feasibility) — the role-preservation trigger would deadlock admin bootstrap: it forces NEW.role := OLD.role unless is_admin(), but the manual UPDATE ... role='admin' runs in the SQL Editor where auth.uid() is NULL, so the trigger reverts the very update that creates your only admin — moderation could never be enabled.
- I002 (consistency) — exam_reports SELECT is admin-only, but the UI Spec's ReportButton needs a non-admin to read their own report row to show the "✓ You reported this exam" state. Fix: reporter_id = auth.uid() OR is_admin().
- I003 / I004 (recommended) — a stale "Known Unknown" that'sing re-parse principle for question rows.

Let me read the two affected ADRs and apply all four fixes precisely.

  Read 1 file

Now applying the fixes to ADR-0001 (I001, I002, I003) plus a review note in the Status line.

● Update(docs\adr\ADR-0001-ugc-content-lifecycle-and-rls-enforcement.md)
Added 1 line, removed 1 line

## Status

Accepted — 2026-07-14. Formalizes product-owner decisions locked 2026-07-14 and the PRD/UI Spec constraints for the UGC Exam Upload featu
re.
Accepted — 2026-07-14. Reviewed by document-reviewer ditions I001–I004; all applied). Formalizes product-own
er decisions locked 2026-07-14 and the PRD/UI Spec constraints for the UGC Exam Upload feature.

- PRD: `docs/prd/ugc-exam-upload-prd.md` (v1.1, Accepted) — R4, R5, R6, R8, R9, R10.
- UI Spec: `docs/ui-spec/ugc-exam-upload-ui-spec.md` (v1.1, Accepted) — D6 (withdraw retention), D3 (reports).

● Update(docs\adr\ADR-0001-ugc-content-lifecycle-and-rls-enforcement.md)
Added 1 line, removed 1 line
| **Decision** | Extend `exams` with a `status` lifecycle (`pending_review`/`published`/`rejected`/`withdrawn`), authorship, raw text, a
nd reject reason; add an `exam_reports` table; enforce visibility, the pending cap, reject-reason, one-report-per-user, admin-only actio
ns, role-preservation, and pending-content confinement entirely at the DB layer; backfill seeded exams to `published`. |
| **Why now** | UGC turns two dormant RLS gaps into active vulnerabilities and requires a publication state the schema cannot express; b
oth must land with the feature, in the single idempotent `schema.sql`. |
| **Why this** | DB-layer enforcement is the only gate that survives a direct Supabase-client bypass (the PRD's hard requirement). Statu
s-based `withdrawn` preserves metadata + raw text for resubmission (UI Spec D6). |
| **Known unknowns** | Exact RLS predicate form for the pending-content read fix (subquery over the `question_ids` array vs. a helper),
and whether the cap and status-transition guards arecheck` or as triggers — resolved in the Design Doc. Inp
ut limits (TBD-04) are Design Doc scope. |
| **Known unknowns** | Exact RLS predicate form for the pending-content read fix (subquery over the `question_ids` array vs. a helper fu
nction) — resolved in the Design Doc. (The cap and s*decided** as triggers; see Enforcement placement.) Inp
ut limits (TBD-04) are Design Doc scope. |
| **Kill criteria** | If the DB-layer RLS verification suite (PRD success metric 1) cannot demonstrate zero pending-content leakage for
anonymous + non-author authenticated clients, this end must be reworked before launch. |

### Data model additions (principle-level; exact DDL in Design Doc)

● Update(docs\adr\ADR-0001-ugc-content-lifecycle-and-rls-enforcement.md)
Added 1 line, removed 1 line
- **Admin identity.** Add `public.is_admin()` as a `SECURITY DEFINER` function returning `role='admin'` for `auth.uid()`, so RLS predica
tes can reference admin status without a recursive R
- **Pending cap of 3 (AC-011, AC-012).** Only `pending_review` counts. Enforce with a `BEFORE INSERT`/`BEFORE UPDATE` trigger on `exams`
 that raises a named error when a transition **into** `pending_review` would make the author's `pending_review` count exceed 3. A trigge
r (not a bare RLS `with check`) is chosen so the ser error the UI maps to the "max 3 exams awaiting review"
 message.
- **Status transitions.** Author-initiated transitio, `rejected → pending_review`, `pending_review|rejected
 → withdrawn`, `withdrawn → pending_review`) and admin-initiated transitions (`pending_review → published|rejected`) are the only legal
moves. Enforce via RLS `update` policies split by ac vs. `public.is_admin()`) plus a transition-guard trigg
er that rejects illegal `status` moves. Published exams are immutable to the author in MVP (AC-021).
- **Reports (AC-023–AC-026).** `exam_reports` insert allowed for any authenticated user against a `published` exam, with `with check (re
porter_id = auth.uid())`; duplicate blocked by the uwed only when `public.is_admin()`. No trigger side effe
cts — reporting never changes exam status (passive list).
- **Reports (AC-023–AC-026).** `exam_reports` insert allowed for any authenticated user against a `published` exam, with `with check (re
porter_id = auth.uid())`; duplicate blocked by the unique constraint. **Select** allowed when `reporter_id = auth.uid()` **or** `public.
is_admin()` — the admin reads all reports (D3 passive list, AC-025/AC-026) while a non-admin can read only their own report rows, and no
 non-admin can read another user's reports (least preport read is required by the UI Spec ReportButton's pr
imary already-reported state (`✓ You reported this exam`), which is derived from a server-side query at page render; an admin-only selec
t would leave only the unique-constraint refusal falunservable. No trigger side effects — reporting never c
hanges exam status (passive list).
- **Role self-escalation fix (AC-027).** Add a `BEFOrofiles` that forces `NEW.role := OLD.role` unless the
caller `is_admin()`, and add `with check (id = auth.uid())` to `profiles_update_own`. The trigger (rather than an RLS `with check` compa
ring to the old value) is chosen because RLS `with check` cannot reference the pre-update row directly and the subquery idiom is fragile
; the trigger is unambiguous and idempotent in the s

### Backfill (R10, AC-029)

● Update(docs\adr\ADR-0001-ugc-content-lifecycle-and-rls-enforcement.md)
Added 1 line, removed 1 line
- **Pending cap of 3 (AC-011, AC-012).** Only `pendith a `BEFORE INSERT`/`BEFORE UPDATE` trigger on `exams`
 that raises a named error when a transition **into** `pending_review` would make the author's `pending_review` count exceed 3. A trigge
r (not a bare RLS `with check`) is chosen so the server returns a distinguishable error the UI maps to the "max 3 exams awaiting review"
 message.
- **Status transitions.** Author-initiated transitions (`insert → pending_review`, `rejected → pending_review`, `pending_review|rejected
 → withdrawn`, `withdrawn → pending_review`) and admin-initiated transitions (`pending_review → published|rejected`) are the only legal
moves. Enforce via RLS `update` policies split by ac vs. `public.is_admin()`) plus a transition-guard trigg
er that rejects illegal `status` moves. Published exams are immutable to the author in MVP (AC-021).
- **Reports (AC-023–AC-026).** `exam_reports` insert allowed for any authenticated user against a `published` exam, with `with check (re
porter_id = auth.uid())`; duplicate blocked by the uallowed when `reporter_id = auth.uid()` **or** `public.
is_admin()` — the admin reads all reports (D3 passive list, AC-025/AC-026) while a non-admin can read only their own report rows, and no
 non-admin can read another user's reports (least privilege preserved). The own-report read is required by the UI Spec ReportButton's pr
imary already-reported state (`✓ You reported this exam`), which is derived from a server-side query at page render; an admin-only selec
t would leave only the unique-constraint refusal falunservable. No trigger side effects — reporting never c
hanges exam status (passive list).
- **Role self-escalation fix (AC-027).** Add a `BEFORE UPDATE` trigger on `user_profiles` that forces `NEW.role := OLD.role` unless the
caller `is_admin()`, and add `with check (id = auth.wn`. The trigger (rather than an RLS `with check` compa
### Backfill (R10, AC-029)


ADR-0001's three fixes are in. Now I004 in ADR-0004 — the question-row re-parse lifecycle principle. Let me read the relevant section.

  Read 1 file

Adding the I004 re-parse lifecycle principle to ADR-0004 (three edits: status note, the mapping section, and the constraint line).

● Update(docs\adr\ADR-0004-ugc-parser-architecture-and-question-mapping.md)
Added 1 line, removed 1 line

## Status

Accepted — 2026-07-14. Resolves the parser architecture (PRD R3) and formalizes product-owner decision TBD-01 (locked 2026-07-14): every
UGC question's `topic` defaults to the exam's subject name.
Accepted — 2026-07-14. Reviewed by document-reviewer 2026-07-14 (condition I004 applied: question-row re-derivation on re-parse). Resolve
s the parser architecture (PRD R3) and formalizes product-owner decision TBD-01 (locked 2026-07-14): every UGC question's `topic` default
s to the exam's subject name.

- PRD: `docs/prd/ugc-exam-upload-prd.md` (v1.1) — R3 (parse + preview), R4 (raw text retention), Undetermined Items (topic default, escal
ation confirmed).
- UI Spec: `docs/ui-spec/ugc-exam-upload-ui-spec.md` (v1.1) — D2 (paste format), D11 (no topic marker; topic → subject), FormatGuide (fix
ed example the parser must accept verbatim), ParseErr

● Update(docs\adr\ADR-0004-ugc-parser-architecture-and-question-mapping.md)
Added 1 line

- **exam row**: metadata from the form (title/subject/grade/duration; optional school/school_year/semester); `author_id = auth.uid()`; `
author_display_name` per ADR-0003; `status='pending_sted text; `question_ids` = the generated ids in paste
- **each question row**: `id` generated deterministically in order (e.g., `<examId>-q<n>`); `content` = the stem (verbatim, rendered lat
er per ADR-0002); `choices` = jsonb `[{id:'A',text},id:'D',text}]`; `correct_answer` = the letter whose cho
ice line carried `*` (guaranteed A–D, satisfies the CHECK); `subject` = exam.subject; `grade` = exam.grade; **`topic` = exam.subject** (
TBD-01).
- **re-parse lifecycle (AC-019)**: on edit-and-reparbmission the question count can change, so the exam's p
ersisted question rows are **fully re-derived** from the server's re-parse of the new `raw_text` — prior rows are replaced wholesale (de
lete-then-insert, or upsert-and-prune of any trailing `<examId>-q<n>` rows beyond the new N) and `exams.question_ids` is rewritten to th
e new ordered set. This keeps `raw_text`↔question rosions and prevents orphaned or id-colliding rows from t
he deterministic id scheme. Exact mechanics (delete-then-insert vs. upsert-and-prune, transaction boundary) are Design Doc scope.

### Topic default (TBD-01) and its result-page conse










● Update(docs\adr\ADR-0004-ugc-parser-architecture-and-question-mapping.md)
Added 1 line, removed 1 line

- **New**: a `lib/`-level parser module (isomorphic,ror contract; server action that re-parses `raw_text` a
nd performs the exam+questions insert; client wiring in `UploadExamForm`/`PasteArea` (UI Spec).
- **Changes**: none to `computeScore`/`TopicBreakdowt code); question insert path is new.
- **Constraint added**: persisted questions are always derived from the server's re-parse of `raw_text`; client-parsed structures are ne
ver persisted.
- **Constraint added**: persisted questions are alware-parse of `raw_text`; client-parsed structures are ne

## Implementation Guidance






















All four reviewer conditions are applied — the ADR set is now fully Accepted with conditions resolved. Every prerequisite for the Design Doc is now in place. Launching it, and updating memory.

  Wrote 1 memory

● dev-workflows-fullstack:technical-designer(Create UGC exam upload Design Doc)
Backgrounded agent (↓ to manage · ctrl+o to expand)

The Design Doc is now being written in the background — this is the biggest step, turning all four ADRs into implementable detail (exact idempotent SQL with the two reviewer fixes baked in, the sanitization pipeline + fixture suites, the parser contract, server actions, and resolving the last open item TBD-04 on input limits). It'll take a few minutes.

Chain status

- PRD v1.1 — Accepted
- UI Spec v1.1 — Accepted
- external-resources.md — Created
- ADRs ×4 — Accepted, all reviewer conditions (I001–I004) ap
- Design Doc — ⏳ Being written now
- Work Plan — last step, after the Design Doc is reviewed

The serious catch from the ADR review — the role-preservation trigger that would have deadlocked your admin bootstrap — is now fixed in ADR-0001 and explicitly carried into the Design Doc's SQL, so the generated schema won't have that trap.

I'll review the Design Doc when it lands (same gate), then generate the final Work Plan. Reporting back on completion.

✻ Waiting for 1 background agent to finish

● Agent "Create UGC exam upload Design Doc" finished · 14m 41s

The Design Doc landed — docs/design/ugc-exam-upload-design.md (v1.0, Draft), with all eight areas turned into implementable detail and TBD-04 resolved. The agent flagged one genuine trade-off for attention (O-2: RLS-orchestrated writes vs. a SECURITY DEFINER RPC — atomicity vs. minimal privileged surface). I'll get the reviewer's independent take on it before surfacing it to you, rather than interrupt twice.

Confirming the file and launching the review gate.

  Searched for 1 pattern, wrote 1 memory

● dev-workflows-fullstack:document-reviewer(Review UGC exam upload Design Doc)
Backgrounded agent (↓ to manage · ctrl+o to expand)

The Design Doc is now under review — the reviewer is specifically assessing SQL correctness/idempotency, that both ADR-0001 fixes are correctly encoded
in the actual SQL, the sanitization allowlist, and giving anO-2 atomicity trade-off so I can bring you a clearrecommendation rather than a raw question.

Chain status

- PRD v1.1 · UI Spec v1.1 · external-resources.md — all Accepted/created
- ADRs ×4 — Accepted, conditions applied
- Design Doc v1.0 — ⏳ under review now
- Work Plan — final step

While it reviews, one thing surfaced that will need a small ss: the repo has no test runner in package.json, so the Design Doc selects vitest+jsdom for the parser/sanitization unit tests (the RLS suite stays as the existing tsx script). I'll fold that into the Work Plan.

I'll report back with the review outcome, the O-2 recommendaork Plan.

✻ Waiting for 1 background agent to finish

● Agent "Review UGC exam upload Design Doc" finished · 4m 1s

Design Doc review is back: Approved with conditions. Strong fidelity to the ADRs (both I001 fixes and I004 correctly encoded in the SQL, sanitization sound, all ACs mapped, TBD-04 concrete). Critically, the revon for us — so I don't need to interrupt you on it:

▎ Keep the RLS-orchestrated writes (they're ADR-consistent, 't available via supabase-js anyway). The real gap isn't thewrite model — it's that approveExam has no integrity guard, so a partial/zero-question exam could be published and the player would silently drop the
▎ missing questions. Fix: guard at approve-time (question ro > 0), surface partial submissions in review, and correct the inaccurate "self-heals on resubmit" wording.

Three conditions total (the O-2 guard, one extra sanitizatioy, and a getResult-path annotation). These are substantiveedits best applied by the agent that wrote the doc and has its full structure in context. Let me continue that agent with the reviewer's conditions.
Agent "a3e3c7271286be65e" had no active task; resumed from transcript in the background with your message. You'll be notified when it finishes.
Output:C:\Users\PC-PC\AppData\Local\Temp\claude\E--StemWeb-project-MS-MOLAR\1e18733d-0f44-49c2-a647-489011b5285c\tasks\a3e3c7271286be65e.output

The Design Doc agent is applying the three conditions in thetime integrity guard + corrected wording, the extraKaTeX-advisory sanitization fixture, and the getResult annotation), bumping the doc to v1.1.

Chain status

- PRD v1.1 · UI Spec v1.1 · external-resources.md · ADRs ×4 — all Accepted
- Design Doc — ⏳ applying reviewer conditions → will be v1.1 Accepted
- Work Plan — next and final

Notably, the O-2 atomicity question resolved itself through review — no decision needed from you: the write model stays as designed; the fix is a cheap approve-time guard so a partial exam can never be published. the edits, I'll generate the Work Plan (including thevitest+jsdom setup task) and that completes the document chain. Reporting back shortly.

---
---

# [UGC Exam Upload] — Doc chain hoàn tất + bắt đầu implement 20% (S#29, 2026-07-14)

## Doc chain — HOÀN TẤT (5/5)
- PRD v1.1 · UI Spec v1.1 · `docs/project-context/external-resources.md` — Accepted (từ phiên trước).
- ADR ×4 (`docs/adr/ADR-0001..0004`) — Accepted, điều kiện reviewer I001–I004 đã áp.
- **Design Doc `docs/design/ugc-exam-upload-design.md` — v1.1 Accepted** (document-reviewer: approved-with-conditions → đã sửa). Điều kiện C1: thêm RLS policy `exams_delete_author` (thiếu policy này thì bước dọn dẹp bù-trừ khi insert questions lỗi sẽ bị RLS chặn ngầm, để lại row rỗng chiếm slot pending-cap). Điều kiện C2: thống nhất lại narrative phục hồi sau lỗi ghi dở dang (compensating DELETE là chính; orphan hiếm gặp cứu bằng withdraw→edit→resubmit hoặc admin reject, không tự lành). Thêm RLS case R-o/R-p, ghi chú I004 (client chỉ gửi rawText), bảng Minimal-Surface→ADR (I005).
- **Work Plan `docs/plans/ugc-exam-upload-work-plan.md`** — tạo bởi work-planner. 7 phase / 15 task đơn-commit. Hai gate: (1) schema+RLS suite R-a…R-p (Phase 1, chặn mọi phase UI); (2) XSS/regression fixtures (Phase 3, chặn publish-render).

## Task decomposition
- `docs/plans/tasks/` — decompose thủ công (không spawn agent, tiết kiệm token) toàn bộ 15 task + README index. Mỗi task file: goal / depends-on / files / acceptance, executor-ready.

## Implement 20% — Phase 2 (Parser + Tooling) — ĐÃ XONG, verify XANH
Chọn Phase 2 làm lát cắt 20% vì tự chứa hoàn toàn (không cần bước apply SQL thủ công của Phase 1).
- **Mới**: `SOURCE/lib/ugc/limits.ts`, `parseExam.ts`, `errorCopy.ts`, `__tests__/parseExam.test.ts`; `SOURCE/vitest.config.ts`.
- **Sửa**: `SOURCE/package.json` — thêm vitest 4 + jsdom + @testing-library/react/jest-dom/user-event (dev deps), script `test`/`test:watch`.
- **Deviation cần nhớ cho Phase 3**: `@vitejs/plugin-react@6` KHÔNG cài được (ép `@babel/core@8`, ERESOLVE conflict với cây phụ thuộc hiện tại). Phase 2 không cần (parser thuần/node env). Task 3.1 (RichText/jsdom) phải dùng esbuild `jsx:'react-jsx'` của vitest hoặc bản plugin tương thích.

## Kết quả Testing (S#29)
```
npx vitest run lib/ugc   → Test Files 1 passed | Tests 14 passed
npx tsc --noEmit          → 0 lỗi trên lib/ugc/**
npx prettier --check      → sạch (đã --write 2 file lệch format)
```
14 fixture bao phủ: ví dụ FormatGuide verbatim (2 câu, đúng C→B), grammar khoan dung (`Câu 1.`/`1)`/`A)`/`* C`/chữ thường/không dấu/nhiều dòng/CRLF), đủ 10 mã lỗi parser với `code`+`questionNumber` literal, biên MAX_STEM/MAX_CHOICE/MAX_QUESTIONS (đúng biên pass, +1 fail), determinism (kill criterion ADR-0004).

## Git — CHƯA COMMIT
Working tree hiện có (chưa stage/commit, chờ engineer xác nhận):
- Modified: `SOURCE/package.json`
- New: `SOURCE/lib/ugc/`, `SOURCE/vitest.config.ts`, `docs/adr/`, `docs/design/`, `docs/plans/` (gồm `docs/plans/tasks/`)

## Trạng thái bàn giao cho phiên sau
- **Việc đầu tiên của phiên sau**: chạy **Phase 1** (`docs/plans/tasks/task-1.1-schema-ddl.md` + `task-1.2-rls-suite.md`) — đây là gate sớm chặn mọi phase UI (Phase 4/5/6). Task 1.1 cần engineer tự tay apply DDL trong Supabase SQL Editor (không có migration framework), sau đó agent chạy `cd SOURCE && npx tsx supabase/test-rls.ts` để verify R-a…R-p xanh.
- Task 2.1/2.2 (Phase 2) đã DONE — không cần làm lại; xem `docs/plans/tasks/task-2.2-parser.md` để biết các quyết định đã chốt (thứ tự ưu tiên lỗi, regex choice dùng `(.*)` không phải `(.*\S)`, v.v.) trước khi Phase 4 (actions.ts) import `parseExam`.
- Nhớ deviation `@vitejs/plugin-react` ở trên trước khi bắt đầu Task 3.1.
- Toàn bộ roadmap chi tiết (15 task, 2 gate, traceability) nằm ở `docs/plans/ugc-exam-upload-work-plan.md` + `docs/plans/tasks/README.md`.

## Tiến độ tổng thể (kết phiên 2026-07-14 — S#29)
```
GĐ 0–3 (nền tảng, prototype, polish L1/L2)      : [x] Done (không đổi phiên này)
UGC Exam Upload (Post-MVP, Layer 4, doc-driven) :
  Doc chain (PRD→UISpec→ADR→DesignDoc→WorkPlan) : [x] Done — 5/5 Accepted
  Task decomposition (docs/plans/tasks/)         : [x] Done — 15 task + README
  Phase 1 DB Foundation + RLS gate                : [ ] Not Started (early gate — cần engineer apply SQL tay)
  Phase 2 Parser + Tooling                        : [x] Done — vitest xanh 14/14
  Phase 3 Render Safety (sanitization gate)       : [ ] Not Started
  Phase 4 Server Actions + Queries + Layout       : [ ] Not Started
  Phase 5 Catalog Reads + Byline + Report channel : [ ] Not Started
  Phase 6 Navbar/Profile + Screens S-01..S-05     : [ ] Not Started
  Phase 7 QA                                      : [ ] Not Started
─────────────────────────────
Post-MVP A — Layer 3         : [ ] Not Started
Post-MVP B — Layer 4         : [ ] Not Started (UGC = phần lớn Layer 4, đang chạy ở trên)
```

**Tạm dừng phiên (engineer yêu cầu). Chờ phiên sau: bắt đầu Phase 1 (schema apply-by-hand + RLS suite), rồi Git commit gộp khi engineer xác nhận.**
"
---
---

# [Layer 2] Sửa trang làm bài (Exam Player) theo tham chiếu Claude Design "ExamPage" (S#30, 2026-07-15)

## Bối cảnh
Engineer yêu cầu chạy lại pipeline cũ (đã archive khỏi CLAUDE.md nhưng vẫn dùng khi được gọi trực tiếp): lấy ảnh tham chiếu từ project Claude Design "ExamPage" → mở trang làm bài thật bằng Playwright → so sánh → sửa cho khớp.

## Reference
- Claude Design project "ExamPage" (`8e6bdfeb-ce02-4aae-9ced-d12d85ce8658`), file `Trang On Luyen.dc.html` — chính là TEMPLATE/L2/ExamPage được nhắc trong docstring `ExamPlayer.tsx`.
- Ảnh lưu: `SCREENSHOT/design_reference/ExamPage/exampage_reference.png`.

## So sánh & phát hiện lỗi
- Đăng nhập test user `+rlstesta` (mật khẩu lấy từ `SOURCE/supabase/test-rls.ts`), mở `/exams/exam-toan-10/attempt/<id>`, chụp full-page screenshot đối chiếu với ảnh tham chiếu.
- **Bug chính**: `QuestionPagination.tsx` — các ô số câu hỏi chưa làm/chưa đang xem bị co lại thành hình chữ nhật ~11×22px (vừa khít chữ số) thay vì ô vuông đầy đủ ~48.5×48.5px như ảnh tham chiếu. Nguyên nhân: `<button>` trong `<li>` (grid cell) thiếu `w-full` nên co theo nội dung (intrinsic sizing) thay vì lấp đầy ô lưới — `aspect-square` không có chiều rộng cố định để tính theo. Viền (`border-border`) vẫn đúng màu nhưng box quá nhỏ nên nhìn như mất viền — xác nhận qua `getComputedStyle` (width thực tế 11–12px so với 48.5px của `<li>`).
- **Lệch phụ**: `ExamPlayer.tsx` có thêm eyebrow "Practice exam" phía trên tiêu đề — không có trong bản thiết kế tham chiếu, không có quyết định nào ghi nhận trong PROCESS.md giải thích cho phần thêm này → gỡ bỏ để khớp tham chiếu.

## Fix
- `SOURCE/app/(layer2)/_components/QuestionPagination.tsx` — thêm `w-full` vào class của button ô số câu hỏi.
- `SOURCE/app/(layer2)/_components/ExamPlayer.tsx` — gỡ span eyebrow "Practice exam" + `mt-1` thừa trên `<h1>`.

## Verify
- `npx tsc --noEmit` (SOURCE) — 0 lỗi.
- Playwright: chụp lại `/exams/exam-toan-10/attempt/<id>` sau fix — sidebar câu hỏi hiện đúng lưới 4 cột ô vuông có viền; câu đang xem viền accent 2px; test chọn đáp án câu 1 → ô tô nền brand đỏ (đã làm) + auto-advance sang câu 2 đúng hành vi cũ. Khớp bố cục/màu với ảnh tham chiếu (nội dung tiếng Anh giữ nguyên — đã là quyết định i18n có chủ đích từ trước, không phải lệch cần sửa). 0 console error (2 warning cũ về `loading="eager"` trên logo — không liên quan, có từ trước).
- Đã dọn `SCREENSHOT/temporary_screenshot/*` sau khi verify xong (giữ lại `SCREENSHOT/design_reference/ExamPage/`).

## Git
- Kiểm tra working tree trước khi stage: phát hiện `ExamPlayer.tsx`/`QuestionPagination.tsx` đã có sẵn một diff lớn CHƯA COMMIT từ trước (redesign 2 cột đồng bộ TEMPLATE/L2/ExamPage — không có log phiên nào ghi nhận, có vẻ dở dang từ một phiên cũ). Đối chiếu thì `QuestionRenderer.tsx`/`AnswerChoice.tsx`/`FlagButton.tsx`/`ExamTimer.tsx` cũng đã sửa sẵn, phụ thuộc lẫn nhau với `ExamPlayer.tsx` (vd. `QuestionRenderer` đã nhận prop `flagged`/`onToggleFlag` mới) — bắt buộc đi cùng nhau để build được (`tsc --noEmit` chỉ sạch khi có đủ 6 file).
- **Commit `7957cee`**: 6 file trên — coi là một thay đổi hoàn chỉnh, đã verify (tsc + Playwright). Đã kiểm riêng `globals.css` (thêm CSS cho tab Layer 4/Import — không liên quan Layer 2, loại khỏi commit) và `package.json`/`package-lock.json` (vitest cho UGC, không liên quan, loại khỏi commit).
- **KHÔNG** gộp: xoá TEMPLATE/`WORKFLOW.md`/`TEXT/docs`, `SOURCE/lib/ugc/`, `SOURCE/app/(layer4)/`, `docs/`, `globals.css`, `package.json`/lock (UGC exam upload S#29 — đang **chờ engineer xác nhận riêng**), giữ nguyên untracked/unstaged.
- PROCESS.md tiếp tục **KHÔNG stage** theo quy ước cũ của repo.
- **Push bị auto-mode chặn** (main branch, agent tự đánh giá là thay đổi rộng hơn dự kiến ban đầu) — chờ engineer xác nhận trực tiếp trước khi push.

---
---

# [Layer 4] Sửa trang Import Content Management — bỏ eyebrow, chống page-scroll, cuộn nội bộ Upload History (S#31, 2026-07-15)

## Yêu cầu (engineer, kèm ảnh chụp trang hiện tại)
1. Bỏ dòng "Content Import" phía trên tiêu đề.
2. Đảm bảo không cần cuộn để thấy hết trang ở Layer 4.
3. Ở tab Upload History, danh sách item cuộn được nội bộ — không phải cuộn cả trang để xem hết.
- Engineer nêu rõ không cần Playwright cho việc này — verify bằng tsc/prettier + smoke curl.

## Fix — `SOURCE/app/(layer4)/_components/ImportContentManagement.tsx`
- Gỡ `<span className="eyebrow">Content Import</span>` phía trên `<h1>`.
- `<main>`: đổi `pt-20 pb-[120px]` (rất rộng, dư ra so với viewport) → cấu trúc flex-column cao cố định `h-[calc(100dvh-3.75rem)]` (3.75rem = h-15 của SiteHeader) + `overflow-hidden` — tổng chiều cao trang luôn khớp đúng 100dvh, không phát sinh scroll dọc bất kể nội dung. Thu gọn padding phụ (`pt-10 pb-8`, tabs `mt-6 mb-6 pt-5`, dropzone `py-14`→`py-10`).
- Tab Upload: wrapper `flex-1 min-h-0` — chiếm phần còn lại, không ép giãn nội dung dropzone.
- Tab Upload History: cấu trúc lại thành cột flex — heading+đếm số item cố định phía trên, bảng bọc trong `<div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">` (chỉ vùng này cuộn khi danh sách dài) + `<thead>` `sticky top-0 bg-background` để header bảng không trôi khi cuộn. Thêm padding ngang cho ô đầu/cuối (`pl-4`/`pr-4`) để khớp viền bọc mới.

## Verify (không dùng Playwright theo yêu cầu)
```
npx tsc --noEmit                                            → 0 lỗi
npx prettier --check ImportContentManagement.tsx (sau --write) → sạch
curl -o /dev/null -w "%{http_code}" /admin/import            → 307 (redirect /login đúng kỳ vọng cho guest — route compile OK, không lỗi 500)
```

## Git
- `SOURCE/app/(layer4)/` (3 file: `_components/ImportContentManagement.tsx`, `admin/import/page.tsx`, `layout.tsx`) trước giờ **chưa từng được add vào git** (untracked từ khi tạo, thuộc đống dở dang S#29) — để push được fix thì bắt buộc add cả thư mục lần đầu (tự chứa, không phụ thuộc gì ngoài `SiteHeader.tsx`/`getCurrentUser.ts` đã tracked sẵn).
- Soát lại thấy `ImportContentManagement.tsx` dùng class `.fade-slide-in` (hiệu ứng chuyển tab) — định nghĩa nằm trong phần `globals.css` đã sửa sẵn nhưng trước đó bị coi là "không liên quan" (ở fix Layer 2 S#30). Lần này đúng là phụ thuộc thật của file đang commit → add kèm đúng đoạn `globals.css` đó (25 dòng, đúng 1 block `fade-slide-in`).
- **KHÔNG** đụng: `SOURCE/lib/ugc/`, `docs/`, `SOURCE/vitest.config.ts`, `package.json`/lock (UGC exam upload S#29, chờ engineer xác nhận riêng), và các xoá file cũ (`TEMPLATE/`, `WORKFLOW.md`, `TEXT/docs/`).

---

# [UGC Upload — Tái thiết kế sang AI] — Viết lại bộ tài liệu

- **Latest prompt:** "Bắt đầu viết lại doc. Hãy tạo một todo list trước, lưu vào PROCESS.md..."
- **Ngày bắt đầu:** 2026-07-15
- **Bối cảnh thay đổi:** Chuyển tính năng UGC exam upload từ mô hình cũ (người dùng DÁN VĂN BẢN thuần → parser tất định → admin duyệt) sang mô hình mới:
  + Người dùng **tải 2 tệp** (ảnh/PDF): tệp câu hỏi + tệp đáp án ánh xạ từng câu.
  + **AI (qua API Claude) đảm nhận** trích xuất: 1 AI đọc tệp câu hỏi → JSON cấu trúc + tọa độ ảnh; 1 AI đọc tệp đáp án → bảng ánh xạ đáp án.
  + **Code** (không phải AI) cắt ảnh, lắp ghép theo form, kiểm tra logic.
  + **Ảnh chỉ ở thân câu hỏi, tối đa 1 ảnh/câu** → thêm cột `image_url`.
  + **Bỏ hoàn toàn admin duyệt** — tác giả tự xem lại & xác nhận, đề vào thẳng bảng tác giả; chủ site gỡ thủ công sau nếu cần.
  + Câu tự luận: **lưu** nhưng chấm điểm là feature khác (chưa làm).
  + Chỉ gọi AI phía máy chủ (bảo vệ khóa API). AI không tất định → **bước tác giả xem lại là bắt buộc**.

## Todo — viết lại bộ doc (đánh dấu [x] khi xong để nhớ qua các phiên)

- [x] **T1 — PRD** (`docs/prd/ugc-exam-upload-prd.md`): mở lại phạm vi ảnh/media + xử lý tự động; tải 2 tệp; AI trích xuất; ảnh ở thân câu; bỏ admin; tác giả tự xem lại; lưu câu tự luận (hoãn chấm). — ✅ 2026-07-15 (bản 2.0)
- [x] **T2 — ADR-0004** (`docs/adr/ADR-0004-*.md`): THAY nội dung — parser tất định → kiến trúc trích xuất bằng AI + cắt ảnh (bounding box do AI, code cắt) + ánh xạ câu↔ảnh↔đáp án theo số câu. — ✅ 2026-07-15 (thay hoàn toàn, đáp án lấy từ tệp đáp án, review bắt buộc)
- [x] **T3 — ADR-0001** (`docs/adr/ADR-0001-*.md`): vòng đời & RLS bỏ admin; giữ bản vá chống lộ nội dung; bỏ bản vá chống tự nâng quyền admin + hàng đợi duyệt. — ✅ 2026-07-15 (thêm Storage bucket RLS cho ảnh, cột question_type/image_url/essay_answer)
- [x] **T4 — ADR-0002** (`docs/adr/ADR-0002-*.md`): cho phép ảnh từ domain Supabase Storage trong đường render đã làm sạch (sanitization allowlist). — ✅ 2026-07-15 (ảnh là trường image_url dạng `<img>` origin-allowlist, bỏ màn admin review, thêm fixture ảnh)
- [x] **T5 — ADR-0003** (`docs/adr/ADR-0003-*.md`): rà soát tên tác giả — chỉnh nhỏ nếu cần. — ✅ 2026-07-15 (giữ denormalize; bỏ nhắc admin/review-queue; reporter_display_name owner đọc out-of-band)
- [x] **T6 — UI Spec** (`docs/ui-spec/ugc-exam-upload-ui-spec.md`): màn tải 2 tệp + trạng thái xử lý AI + tác giả xem lại/sửa; bỏ màn admin (S-04, S-05). — ✅ 2026-07-15 (bản 2.0: S-01 upload 2 tệp, S-03 review&edit có ảnh, Delete thay Withdraw, bỏ hết màn admin)
- [x] **T7 — Design Doc** (`docs/design/ugc-exam-upload-design.md`): schema `image_url`/`question_type`/đáp án tự luận; Storage bucket + RLS; hợp đồng các lời gọi AI; bỏ admin. — ✅ 2026-07-15 (bản 2.0: DDL mới bỏ is_admin/cap/role/transition trigger, 2 Storage bucket, hợp đồng extractQuestions/extractAnswers/assembleExam, QuestionFigure, test RLS+Storage)
- [x] **T8 — Work Plan + task files** (`docs/plans/**`): cập nhật kế hoạch & task theo kiến trúc mới. — ✅ 2026-07-15 (work plan v2.0 + README index mới; xóa 17 task file v1.1, tạo 16 task file v2.0; giữ vitest tooling, đánh dấu parseExam lỗi thời)

## Trạng thái: HOÀN TẤT viết lại toàn bộ chuỗi doc (T1–T8) — 2026-07-15

---

# [UGC Exam Upload v2.0] — Thực hiện Work Plan (S#32, 2026-07-16)

## Yêu cầu
- "Thực hiện Work Plan" — đọc lại các md file hiện có (Work Plan v2.0, Design Doc, ADR, task files) rồi triển khai theo `docs/plans/tasks/README.md` (17 task, Phase 1→7).

## Todo — triển khai Work Plan (đánh dấu [x] khi xong để nhớ qua các phiên)

- [x] **Task 1.1 — Schema + Storage DDL** (`SOURCE/supabase/schema.sql`): append DDL UGC v2.0 (cột lifecycle exams/questions, `exam_reports`, select/write policies, Storage policies, backfill) + `SOURCE/supabase/setup-storage.ts` tạo 2 bucket `exam-images`/`exam-uploads` (đã chạy — 2 bucket private tạo thành công qua service_role).
- [x] **Task 1.2 — RLS + Storage suite (GATE A)** (`SOURCE/supabase/test-rls.ts`): mở rộng thêm fixture UGC (author A / non-author B, không có admin) + case R-a…R-o (non-published table/image/upload confinement, published positive control, author-only write, report own-only + duplicate, backfill count).
- [x] **Apply schema thủ công + GATE A XANH** — engineer đã dán `schema.sql` vào Supabase SQL Editor và Run (2026-07-16). Chạy `npx tsx supabase/test-rls.ts` → **TẤT CẢ PASS**: 6 check attempts cũ + 22 check UGC (R-a…R-l bảng + R-m…R-o Storage). Storage policies trên `storage.objects` được SQL Editor chấp nhận bình thường (không cần tạo qua Dashboard). Backfill giữ nguyên 3/3 đề seed published, `question_type='mcq'`. **Gate A mở — được phép làm các phase UI.**
- [x] **Task 2.1 — Types/limits/errorCopy/assembleExam + fixtures** (`SOURCE/lib/ugc/{types,limits,errorCopy,assembleExam}.ts` + `__tests__/assembleExam.test.ts`): assembler thuần, join theo số câu, đáp án từ file đáp án, topic=subject; 17/17 test pass (answer fidelity, image mapping, mọi error code, boundary).
- [x] **Task 2.2 — AI extractors + cropImages (server-only)** (`SOURCE/lib/ugc/{anthropic,extractQuestions,extractAnswers,cropImages,fileRef}.ts` + `__tests__/extractors.test.ts`): `@anthropic-ai/sdk` (model câu hỏi `claude-opus-4-8`, đáp án `claude-haiku-4-5`), structured outputs, `import "server-only"`; crop bằng `sharp` + render PDF bằng `mupdf`; build-time check `scripts/check-ai-key-bundle.mjs` (`npm run check:bundle`); 12/12 test pass (mock SDK boundary).
- [x] **Task 3.1 — Harden RichText + XSS/regression fixtures (GATE B — phần text)** (`SOURCE/components/shared/RichText.tsx` + `__tests__/RichText.{xss,regression}.test.tsx`): thêm `rehype-sanitize@6` chạy SAU `rehype-katex` (backstop cả output KaTeX); `KATEX_SAFE_OPTIONS` (trust:false, throwOnError:false, maxExpand:100, maxSize:50, strict:false); `SANITIZE_SCHEMA` mở rộng defaultSchema cho tag/attr MathML+SVG của KaTeX (className/style chỉ trên tag KaTeX phát ra). Quy trình snapshot: tạo 13 snapshot baseline TRƯỚC khi harden → harden → chạy lại giữ nguyên 13/13 (seeded rendering không regress). 18 XSS fixture (raw HTML script/img-onerror/iframe/style/svg-onload; javascript:/entity-smuggled/data:-phi-ảnh/reference-definition; KaTeX \href/\includegraphics/\htmlData/\edef-đệ-quy/macro-bùng-nổ/\rule-khổng-lồ/lỗi-cú-pháp) — mỗi vector render cả block lẫn inline, assert không script/on*/javascript:/data:-phi-ảnh, không throw. Public props RichText KHÔNG đổi. Xác nhận `rehype-raw` không có trong deps (`npm ls` empty).
- [x] **Task 3.2 — QuestionFigure + image-origin fixtures (GATE B — phần hình)** (`SOURCE/components/shared/QuestionFigure.tsx` + `__tests__/QuestionFigure.test.tsx`): render `<img>` CHỈ khi origin URL = origin Supabase Storage (từ `NEXT_PUBLIC_SUPABASE_URL`, tính lười để test set env được); mọi origin khác/javascript:/data:/null/URL hỏng/subdomain giả mạo → render KHÔNG GÌ (fail closed); alt luôn non-empty (mặc định `Figure for Câu {n}`); export `isAllowedImageUrl()` cho queries/review tái dùng. 8 test pass. Sửa kèm: `vitest.config.ts` thêm alias `@/` (trước đó vitest không resolve tsconfig paths — lộ ra khi QuestionFigure import `@/lib/utils`). **GATE B XANH TRỌN VẸN (text 31 + image 8).**
- [x] **Task 4.1 — (layer4)/actions.ts — 5 server actions** (`SOURCE/app/(layer4)/actions.ts` + hỗ trợ mới `lib/ugc/{validateInput,pdf}.ts`, patch types trong `lib/ugc/types.ts`):
  + `extractAndAssemble(formData)`: validate metadata (AC-003, `validateExamMeta` thuần) + 2 file bắt buộc/loại/kích thước/số trang PDF qua mupdf (AC-005/006) **trước mọi lời gọi AI**; guard MAX_UPLOADS_PER_DAY; snapshot `author_display_name`; tạo row exams `processing` TRƯỚC upload (Storage policy cần row); upload 2 file gốc vào `exam-uploads`; 2 call AI song song; crop hình (`cropImagesLenient`); assemble + validate; **persist cả bản nháp lỗi** (status `failed`, đáp án thiếu = null) để tác giả sửa ở S-03; sạch → `review`; redirect `/me/exams/[id]`. Fail giữa chừng → compensating delete (đề mới) / giữ `failed` (re-run). Hỗ trợ re-run qua formData `examId` (re-derive toàn phần, subject/grade cố định lấy từ đề cũ).
  + `saveExam(examId, patch)`: đề published validate TRƯỚC khi ghi (đề công khai luôn sạch); đề chưa published ghi tự do rồi tính lại status (sạch→review, lỗi→failed).
  + `publishExam`: own + status review/draft + `validateAssembledExam` SẠCH → `published` + `reviewed_at` (AC-013/016/017).
  + `deleteExam`: dọn Storage 2 bucket → xoá questions TRƯỚC exams (policy questions cần row exams còn) → xoá exams.
  + `reportExam`: trim + clamp reason; 23505 → "duplicate"; snapshot reporter_display_name.
  + **Refactor hỗ trợ**: `assembleExam` tách thành `assembleExamLenient` (join không chặn — dựng được bản nháp) + `validateAssembledExam` (validate thuần, dùng chung bởi assemble/publish/S-03) + wrapper giữ nguyên hợp đồng (29 test cũ giữ nguyên xanh); `cropImages` tách tương tự (`cropImagesLenient`).
  + **⚠️ VÁ SCHEMA §8b (phải DÁN LẠI schema.sql vào SQL Editor):** (1) `questions.correct_answer` nới thành nullable + CHECK `null hoặc A–D` — trước đó NOT NULL làm câu essay và câu thiếu đáp án (nháp failed) KHÔNG THỂ lưu; toàn vẹn đề published do publishExam cưỡng chế, catalog/player chỉ đọc published nên không bao giờ gặp null. (2) Thêm policy `exam_images_update`/`exam_images_delete` (tác giả) — thiếu thì re-crop (upsert) và deleteExam bị RLS chặn im lặng. Sau khi dán lại: chạy lại `npx tsx supabase/test-rls.ts` (quy ước re-run sau mọi lần sửa schema).
  + Test mới: `lib/ugc/__tests__/validateInput.test.ts` (13 test — metadata/file/boundary + validateAssembledExam cho publish gate). Nhánh action với mocked Supabase client đầy đủ KHÔNG viết (trade-off: helper thuần đã cover logic validate; nhánh DB/Storage sẽ được kiểm bằng integration thật ở Task 7 QA).
- [x] **Task 4.2 — (layer4)/queries.ts — read queries** (`SOURCE/app/(layer4)/queries.ts` + helper thuần mới `lib/ugc/{fromRows,imageUrl}.ts`): `listMyExams()` (đề của mình mọi status, order `created_at` desc — AC-020), `getMyExam(id)` (AssembledExam đầy đủ cho S-03 qua `assembledFromRows`; **đổi image_url đã lưu → SIGNED URL** vì bucket private, `createSignedUrl` TTL 1h qua client phiên user để RLS storage vẫn là tầng chặn), `hasReported(examId)` (đếm report của mình — `reports_select_own` giới hạn sẵn). Refactor: rút `assembledFromRows`/`questionNumberFromId` từ actions.ts ra `lib/ugc/fromRows.ts` để dùng chung. Test `fromRows.test.ts` (6 — mapping thứ tự/essay bỏ choices/row thiếu + `imagePathFromUrl`). Nhánh cần auth session → integration thật ở Task 7.
- [x] **Task 4.3 — (layer4)/layout.tsx** — ĐÃ CÓ SẴN từ S#31 (mirror `(layer2)/layout.tsx`, render `SiteHeader`, không admin gate) — đúng chính xác yêu cầu 4.3, không cần sửa. Guard auth là ở page (Task 6), không ở layout. Route `admin/import/` là di sản thiết kế cũ, sẽ xử lý khi dựng màn thật ở Task 6.
- [x] **Task 5.1 — Catalog reads: published filter + byline + image** (`SOURCE/app/(layer2)/queries.ts` + type `Exam`/`Question`): thêm `.eq('status','published')` cho `listExams`+`getExam` (R-7 guard tường minh trên nền RLS — đề chưa published của chính viewer không lọt catalog); `EXAM_COLUMNS`+`toExam` mang thêm `author_display_name`→`authorDisplayName`; `getExamForPlayer` select thêm `question_type`+`image_url` (KHÔNG select correct_answer/essay_answer — đáp án server-only), đổi image_url→signed URL. Type mở rộng additive: `Exam.authorDisplayName?`, `Question.{questionType?,imageUrl?,essayAnswer?}`; `PublicQuestion = Omit<Question,"correctAnswer"|"essayAnswer">` (essayAnswer = đáp án mẫu, KHÔNG lộ xuống player). tsc sạch, 87 test cũ giữ nguyên.
- [x] **Task 5.2 — Byline + QuestionFigure + Report channel** (component mới + wiring):
  + `components/shared/AuthorByline.tsx` — "by {tên}", render CHỈ khi có tên (đề seed → null, không chiếm chỗ). Chèn vào `ExamCard` (giữa title và dl) + exam detail (dưới h1).
  + `QuestionFigure` chèn vào `QuestionRenderer` (player) giữa nội dung và lựa chọn — chỉ khi `question.imageUrl` tồn tại + origin hợp lệ (fail closed từ Task 3.2).
  + `(layer2)/_components/ReportExam.tsx` (client) — nút "Report this exam" + dialog (khuôn LeaveExamDialog: scrim, Esc/click-scrim đóng, focus textarea); gọi `reportExam`; `duplicate`/thành công → trạng thái tĩnh "✓ You reported this exam". Wire vào exam detail: chỉ render khi có `getCurrentUser()` + truyền `hasReported()`.
  + tsc + eslint + prettier sạch. Kiểm tra thật (report ghi nhận, byline/hình hiện đúng) để dành integration Task 7 (cần DB có đề UGC published).
- [x] **Task 6.1 — Navbar/profile (Import→Upload, My exams, no admin)**: `SiteHeader`+`HomeSidebar` đổi mục nav `Import /admin/import`→`Upload /upload` cho MỌI user (không thêm mục admin); `HeaderProfile`+`SidebarProfile` thêm link "My exams"→`/me/exams` giữa Edit và Sign out (D7).
- [x] **Task 6.2 — S-01 Upload** (`app/(layer4)/upload/page.tsx` + `_components/{UploadForm,MetadataFields,FileUploadFields,UploadGuide,ExtractionProgress}.tsx`): page guard `getCurrentUser`→`/?auth=signin`. `UploadForm` (client) giữ MỘT state metadata+2 file, KHÔNG clear khi lỗi; Extract disabled tới khi metadata hợp lệ (check client nhẹ) + đủ 2 file; gọi `extractAndAssemble` trong `useTransition` (thành công action tự redirect; thất bại hiện `UgcActionError` + fieldErrors, giữ form). `ExtractionProgress` role=status polite (AC-029). `UploadGuide` mô tả tệp tốt + ví dụ + limit (AC-028). File picker hiện chip tên + gỡ, accept=ALLOWED_MIME.
- [x] **Task 6.3 — S-02 My exams** (`app/(layer4)/me/exams/page.tsx` + `_components/{MyExamsList,ExamRow,StatusBadge,DeleteDialog}.tsx` + `loading.tsx`): guard auth; `listMyExams` newest-first. `StatusBadge` (D9) — glyph+CHỮ riêng mỗi status (phân biệt được cả grayscale, không chỉ màu). `ExamRow` action theo status: processing→none, failed→Review&fix, review→Continue review, draft→Continue, published→Edit (tiêu đề published link đề live); luôn có Delete. `DeleteDialog` (khuôn LeaveExamDialog + focus nút xoá + trả focus về trigger) gọi `deleteExam`. Empty → khối gạch đứt + Upload. Banner `?published=1` (D13).
- [x] **Task 6.4 — S-03 Review & edit + Publish** (`app/(layer4)/me/exams/[id]/page.tsx` + `_components/{ReviewScreen,ExtractionErrorPanel,AssembledQuestionList,QuestionEditor,PublishBar}.tsx`): guard auth + `getMyExam` null→`/me/exams` (RLS+author), processing→`/me/exams`. `ReviewScreen` (client) giữ bản sao AssembledExam sửa được, validate LIVE bằng `validateAssembledExam` (thuần, client-safe) để bật/tắt Publish + đổ `ExtractionErrorPanel` (lỗi toàn-file + từng Câu N, link #q{n}, role=alert). `QuestionEditor` xem/sửa tại chỗ: stem plain-text, `QuestionFigure` cho hình, lựa chọn A–D + đáp án đúng chú thích "from your answer file", essay → đáp án mẫu + "Essay — stored, not auto-scored yet". `PublishBar` sticky: Save changes (`saveExam`) + Publish (disabled tới khi sạch; save trước rồi `publishExam`→`/me/exams?published=1`) + Delete. **Giới hạn phạm vi (deviation)**: THÊM/THAY hình từ màn review CHƯA hỗ trợ (cần action upload hình riêng ngoài 5 action Task 4.1); MVP chỉ cho GỠ hình. Hình ban đầu đến từ trích xuất.
- [~] **Task 7 — QA (một phần)** — Phần KHÔNG cần bước manual đã chạy XANH:
  + `next build` (Next 16.2.7 Turbopack) — **compile + TypeScript pass**, không lỗi RSC/client boundary; 3 route mới `/upload`, `/me/exams`, `/me/exams/[id]` sinh đúng (dynamic).
  + `npm run check:bundle` (sau build) — **PASS**: AI key + `@anthropic-ai/sdk` + `api.anthropic.com` KHÔNG nằm trong `.next/static` (PRD metric 6).
  + `vitest run` 87/87, `tsc` 0 lỗi, eslint/prettier sạch.
  + **CÒN LẠI (chặn bởi 2 bước manual + cần browser)**: axe/keyboard a11y các màn S-01/02/03, e2e upload→extract→review→publish→attempt→report (cần ANTHROPIC_API_KEY thật + schema §8b đã áp), AC-027 count trước/sau. Đây là phần cần engineer chạy sau khi hoàn tất 2 bước manual.

## Verify (tới thời điểm này)
```
npx tsx supabase/test-rls.ts      → GATE A: 6 attempts + 22 UGC (R-a…R-o) TẤT CẢ PASS
npx vitest run                     → 7 test file, 87/87 pass
                                     (assembleExam 17 + extractors 12 + validateInput 13
                                      + fromRows 6 + RichText regression 13 + xss 18
                                      + QuestionFigure 8)
npx tsc --noEmit                   → 0 lỗi (toàn bộ Task 1–6)
prettier + eslint (mọi file mới)   → sạch
npm ls rehype-raw                  → empty (không có trong pipeline/deps)
next build                          → compile + TS pass; /upload, /me/exams, /me/exams/[id] OK
npm run check:bundle (sau build)    → PASS (AI key/SDK không trong .next/static — metric 6)
```
✅ Vá §8b: engineer đã dán lại `schema.sql` vào SQL Editor (2026-07-17) → re-run `test-rls.ts` → **TẤT CẢ PASS** (6 attempts + 22 UGC R-a…R-o, kể cả 8 check Storage R-m…R-o). Gate A xanh với bản schema có vá.
✅ `next build` production đã chạy (Task 7) — compile+TS pass, không lỗi RSC/client boundary.

## Trạng thái Task (Work Plan v2.0)
- **XONG code (unit+tsc+lint xanh)**: Task 1.1/1.2, 2.1/2.2, 3.1/3.2, 4.1/4.2/4.3, 5.1/5.2, 6.1/6.2/6.3/6.4 — toàn bộ 17 task code đã viết. Task 7 (build+no-bundle+unit+tsc) xanh.
- **Provider AI đổi từ Anthropic → Gemini** (S#33, 2026-07-17) — xem section riêng bên dưới. **Key thật đã dán + smoke-test pipeline AI đầu-cuối PASS.**
- **CÒN NỢ trước khi khép Work Plan**:
  1. Task 7 QA phần còn lại: axe/keyboard các màn S-01/02/03 + e2e upload→extract→review→publish→attempt→report **qua browser thật** (pipeline AI phía dưới đã xác nhận chạy được — phần chưa test là UI/luồng người dùng) + AC-027 count trước/sau.

## Ghi chú quan trọng cho phiên sau
- **Gate A ĐÃ XANH** (2026-07-16) với bản schema TRƯỚC vá §8b. **CÒN NỢ**: bản schema hiện tại có vá §8b (correct_answer nullable + policy exam_images update/delete) CHƯA dán lại vào SQL Editor → chưa chạy được integration của actions/queries (extractAndAssemble/saveExam/deleteExam cần các thay đổi này). Việc chặn: dán lại `schema.sql` + re-run `test-rls.ts`. Cũng cần thêm `ANTHROPIC_API_KEY` vào `SOURCE/.env.local` trước khi test luồng extract thật.
- 2 bucket Storage (`exam-images`, `exam-uploads`) đã tạo thật trên Supabase (private) qua `setup-storage.ts` — không cần chạy lại (idempotent, script tự bỏ qua nếu đã tồn tại).
- **Quyết định image URL**: DB lưu URL dạng getPublicUrl (origin+path ổn định) nhưng bucket private → tầng đọc (`getMyExam`, và sắp tới catalog 5.1) đổi sang **signed URL** qua `lib/ugc/imageUrl.ts::resolveSignedImageUrl` trước khi render; `QuestionFigure` allowlist origin Supabase nên signed URL đi qua. RLS storage vẫn là tầng chặn thật (non-author không sign được hình đề chưa published).
- Dependency mới đã cài vào `SOURCE/package.json`: `@anthropic-ai/sdk`, `server-only`, `sharp`, `mupdf`, `rehype-sanitize`.
- Test component dùng jsdom qua docblock `// @vitest-environment jsdom` từng file (KHÔNG cần `@vitejs/plugin-react` — vitest 4/esbuild tự transform JSX automatic; đúng như deviation ghi ở S#29). Snapshot regression nằm ở `components/shared/__tests__/__snapshots__/` — KHÔNG regenerate bừa; nếu đổi pipeline RichText mà snapshot lệch tức là ĐÃ regress seeded rendering.
- Task 2.2 chọn hướng bbox-crop-từ-trang-render thống nhất (PDF dùng `mupdf` render trang rồi crop bbox bằng `sharp`, không trích ảnh nhúng PDF riêng) — đơn giản hoá so với Design Doc §O-4 (ưu tiên ảnh nhúng PDF là tối ưu hoá để sau).
- Chưa git add/commit gì trong phiên này — toàn bộ là file mới/sửa trong working tree.


Bước tiếp theo (khi triển khai code): theo Work Plan v2.0 → Phase 1 (schema+Storage+RLS gate) trước tiên. Lưu ý: `SOURCE/lib/ugc/parseExam.ts` (code v1.1 đã có) sẽ bị gỡ ở Task 2.1.

---

# [UGC Exam Upload v2.0] — Đổi AI provider Anthropic → Gemini free tier (S#33, 2026-07-17)

## Bối cảnh
Sau khi Gate A xanh (schema §8b đã dán lại, xác nhận PASS) và thêm `ANTHROPIC_API_KEY` vào `.env.local`, verify key thật thì phát hiện tài khoản Anthropic **không có credit** (lỗi 400 "Your credit balance is too low"). Engineer hỏi phương án đổi sang LLM miễn phí trước khi quyết định, cân nhắc có phải sửa kiến trúc không. Đã trình bày trade-off (Gemini free tier: kỹ thuật khả thi nhưng rate-limit theo project không theo user + chất lượng OCR có thể kém ổn định hơn; phương án nạp $5 Anthropic: không sửa code) → **engineer chọn đổi sang Gemini free tier**.

## Việc đã làm
- **Xác minh SDK bằng type definition thật** (không tin tóm tắt web — docs Google đang mâu thuẫn nhau giữa "Interactions API" mới và `ai.models.generateContent` cổ điển): cài `@google/genai@2.12.0`, đọc trực tiếp `node_modules/@google/genai/dist/genai.d.ts` → xác nhận `ai.models.generateContent({model, contents, config})`, `config.responseMimeType`+`config.responseJsonSchema` (nhận JSON Schema chuẩn — tái dùng gần như nguyên schema cũ), `Part.inlineData: {data, mimeType}` (PDF và ảnh đều dùng inlineData, không tách document/image như Anthropic), `response.candidates[0].finishReason === "STOP"` (tương đương `stop_reason "end_turn"`), `response.text` getter.
- `SOURCE/lib/ugc/anthropic.ts` → **thay bằng `SOURCE/lib/ugc/gemini.ts`**: `getGeminiClient()` đọc `GEMINI_API_KEY`; model chọn ban đầu theo rate-limit công bố (`gemini-2.5-flash`/`gemini-2.5-flash-lite`) — **KHÔNG dùng được với key thật** (2.5-flash → 404 "no longer available to new users"; dòng 2.0-flash → 429 quota). Xác nhận bằng `client.models.list()` + gọi thử trực tiếp (2026-07-17): chỉ dòng 3.x hoạt động với tài khoản mới. **Model cuối cùng**: `QUESTION_MODEL="gemini-3.5-flash"` (đọc ảnh/PDF đề), `ANSWER_MODEL="gemini-3.1-flash-lite"` (đọc đáp án, rẻ hơn) — cả 2 đều bản ổn định (không `-preview`).
- `SOURCE/lib/ugc/fileRef.ts`: `toContentBlock` (Anthropic document/image block) → `toGeminiPart` (một hàm, luôn trả `{inlineData:{data,mimeType}}` — Gemini không phân biệt PDF/ảnh ở tầng Part).
- `SOURCE/lib/ugc/extractQuestions.ts` + `extractAnswers.ts`: đổi sang `client.models.generateContent` (bỏ streaming — Anthropic dùng stream để tránh HTTP timeout với output tới 50 câu, Gemini call thẳng với `maxOutputTokens` đủ lớn, giữ đơn giản); check `finishReason==="STOP"` thay `stop_reason==="end_turn"`; đọc `response.text` thay vì tìm block `type:"text"`. Schema JSON (`QUESTIONS_SCHEMA`/`ANSWERS_SCHEMA`, `mapQuestionsPayload`/`mapAnswersPayload`) **giữ nguyên** — tương thích `responseJsonSchema`.
- `SOURCE/lib/ugc/__tests__/extractors.test.ts`: mock `@google/genai` (`GoogleGenAI.models.generateContent`) thay `@anthropic-ai/sdk`; response giả lập đổi shape (`candidates[0].finishReason` + `text`) — 12 test giữ nguyên số lượng và ý nghĩa, chỉ đổi shape mock.
- `SOURCE/scripts/check-ai-key-bundle.mjs`: marker quét đổi `ANTHROPIC_API_KEY`/`@anthropic-ai/sdk`/`api.anthropic.com` → `GEMINI_API_KEY`/`@google/genai`/`generativelanguage.googleapis.com`.
- `SOURCE/.env.local`: xoá `ANTHROPIC_API_KEY` (key thật không có credit), thêm `GEMINI_API_KEY=PASTE_YOUR_GEMINI_KEY_HERE` (placeholder — engineer cần lấy key thật tại aistudio.google.com/apikey, miễn phí không cần thẻ).
- `npm uninstall @anthropic-ai/sdk`; `@google/genai` đã có trong `package.json`.

## Verify
```
npx vitest run        → 7 file, 87/87 pass (không đổi số lượng test)
npx tsc --noEmit       → 0 lỗi
next build             → compile+TS pass, 13 route sinh đúng (kể cả /upload, /me/exams, /me/exams[id])
npm run check:bundle   → PASS (GEMINI_API_KEY/@google/genai/generativelanguage.googleapis.com KHÔNG trong .next/static)
```

**Smoke test pipeline thật với key GEMINI_API_KEY thật (2026-07-17)** — engineer dán key xong, verify bằng script tsx tạm thời (không lưu vào repo) gọi thẳng `extractQuestions`→`extractAnswers`→`assembleExam` với 1 ảnh đề (2 câu MCQ + 1 tự luận) + 1 ảnh đáp án tự tạo (sharp render SVG→PNG):
- `client.models.list()` cho thấy model chọn ban đầu (`gemini-2.5-flash`/`-flash-lite`) không dùng được → đổi sang `gemini-3.5-flash`/`gemini-3.1-flash-lite` (xem mục "Việc đã làm" — model constant trong `lib/ugc/gemini.ts` đã cập nhật, test assertion trong `extractors.test.ts` đã cập nhật theo, 87/87 vẫn xanh).
- `extractQuestions` map đúng 3 câu (2 mcq + 1 essay), tách đúng "Câu N" khỏi stem, công thức ra LaTeX (`$x + 3 = 5$`), **KHÔNG tự đánh dấu đáp án đúng** (đúng ADR-0004 — không có `correctAnswer` ở output extractor).
- `extractAnswers` đọc đúng đáp án B/A + văn bản tự luận từ file đáp án riêng.
- `assembleExam` ghép đúng theo số câu, gán `correctAnswer` CHỈ từ file đáp án, `topic` mặc định = tên môn ("Toán") đúng quyết định [[ugc-topic-decision]].
- **Kết luận: pipeline AI đầu-cuối (ngoài UI/browser) hoạt động đúng thiết kế với Gemini.** Chưa test với ảnh/PDF chụp/scan thật (chỉ test với ảnh render sạch từ SVG) — chất lượng OCR trên file thật (ảnh chụp, viết tay, scan mờ) vẫn là ẩn số, xem mục Rủi ro.

## Rủi ro đã ghi nhận (KHÔNG chặn — engineer đã chấp nhận trade-off)
- Free tier Gemini giới hạn theo **project**, không theo user — nhiều user upload đồng thời có thể chạm trần và làm nghẽn toàn app. `MAX_UPLOADS_PER_DAY=30`/user trong `lib/ugc/limits.ts` KHÔNG bảo vệ khỏi rủi ro này (giới hạn per-user, không phải per-project); nếu lên production thật cần theo dõi hoặc nâng lên gói trả phí. Rate-limit cụ thể của dòng 3.x (model cuối cùng đang dùng) CHƯA được xác nhận công khai (rate-limit đọc được trước đó là của dòng 2.x, đã bị rút quyền dùng — xem "Việc đã làm").
- Chất lượng OCR chữ Việt + công thức toán trên **ảnh/PDF chụp/scan thật** (không phải ảnh render sạch) CHƯA được xác minh — smoke test ở trên chỉ dùng ảnh text render sạch từ SVG, không đại diện cho ảnh chụp đề thi thật của người dùng.
- Tài khoản Gemini mới (như của engineer) không có quyền dùng dòng model 2.x (404 "no longer available to new users") lẫn quota free cho dòng 2.0 (429) — hành vi này có thể thay đổi theo thời gian/theo tài khoản; nếu model 3.x sau này cũng bị rút, cần chạy lại `client.models.list()` để tìm model thay thế (không hard-code giả định).

## Ghi chú quan trọng cho phiên sau
- Dependency: `@anthropic-ai/sdk` đã gỡ khỏi `package.json`; `@google/genai@2.12.0` là SDK AI duy nhất còn lại trong `lib/ugc/`.
- File `lib/ugc/anthropic.ts` KHÔNG còn tồn tại — mọi import cũ đã chuyển sang `lib/ugc/gemini.ts`.
- **`GEMINI_API_KEY` trong `.env.local` là key thật của engineer, đã xác nhận hoạt động** (không còn placeholder). Pipeline AI đầu-cuối đã smoke-test PASS — mục CÒN NỢ giờ chỉ còn Task 7 QA phần browser (a11y/e2e thật qua UI, chưa chạy).
- Chưa git add/commit — toàn bộ thay đổi trong working tree.

## Bug tìm thấy khi engineer test browser thật (2026-07-17)

- **`Body exceeded 1 MB limit`** khi bấm Extract với 2 file thật ở `/upload`. Nguyên nhân: `extractAndAssemble` là Server Action, Next.js giới hạn mặc định body Server Action = **1MB** — không hề liên quan tới `LIMITS.MAX_FILE_BYTES=15MB` mà app tự validate (validate phía app KHÔNG BAO GIỜ chạy tới vì request bị Next.js chặn trước ở tầng framework). Lỗ hổng này không bị bắt bởi bất kỳ unit test nào vì test chỉ gọi hàm TS trực tiếp, không đi qua HTTP boundary thật của Server Action.
- **Fix**: `SOURCE/next.config.ts` — thêm `experimental.serverActions.bodySizeLimit: "35mb"` (đủ cho 2 file × 15MB + overhead multipart). Lưu ý: field này còn nằm dưới `experimental` ở Next 16.2.7 (xác nhận bằng cách đọc `node_modules/next/dist/server/config-shared.d.ts` — chưa "graduate" ra top-level dù URL doc Next.js trỏ thẳng tới `serverActions#bodySizeLimit`).
- **⚠️ CẦN RESTART dev server** — `next.config.ts` chỉ được đọc lúc khởi động, sửa xong phải tắt/bật lại `npm run dev` mới có hiệu lực.
- tsc sạch sau khi sửa. Chưa re-test qua browser (đang chờ engineer restart + thử lại).

- **`Question file: the PDF could not be read`** khi upload PDF thật (đề thi TN THPT 2025, 17 trang). Chẩn đoán từng bước: (1) `mupdf.Document.openDocument` chạy standalone bằng node script với PDF tối giản → **OK, đếm trang đúng** (mupdf/WASM bản thân không lỗi); (2) đây là **LẦN ĐẦU mupdf thực sự chạy trong Next.js server runtime** — trước giờ chỉ test qua unit mock + smoke test standalone bên ngoài Next; (3) `mupdf`+`sharp` là package WASM/native, KHÔNG có trong `serverExternalPackages` → Turbopack cố bundle → file `.wasm`/`.node` không nạp được lúc chạy → `openDocument` throw → bị `catch {}` ở `toFileRef` nuốt thành message chung.
- **Fix**: (a) `SOURCE/next.config.ts` — thêm `serverExternalPackages: ["mupdf", "sharp"]` (config top-level ổn định của Next 16, xác nhận trong `config-shared.d.ts` dòng 1231; áp dụng cho cả Turbopack). (b) `SOURCE/app/(layer4)/actions.ts` — `catch {}` → `catch (err) { console.error(...) }` để lần sau lỗi mupdf hiện ra ở console server (message cho user giữ nguyên an toàn). **CẦN RESTART dev server.**
- **⚠️ Cảnh báo về CHÍNH file PDF này (tách biệt với bug read)**: file đề TN THPT 2025 chứa **4 mã đề (0101–0104) + 1 trang bảng đáp án** trong 1 PDF = ~88 câu (4 × [12 TN + 4 đúng-sai + 6 trả-lời-ngắn]). Vượt `MAX_QUESTIONS=50` → kể cả khi đọc được PDF, extractor sẽ trả `TOO_MANY_QUESTIONS`. Feature thiết kế cho **1 đề đơn** (file câu hỏi riêng + file đáp án riêng), không phải bộ nhiều mã đề. Đây là vấn đề dữ liệu đầu vào, không phải bug — cần hướng dẫn engineer test bằng 1 mã đề (4 trang) + tách trang đáp án làm file đáp án riêng.

## Công cụ quan sát pipeline (thêm 2026-07-17 theo yêu cầu engineer)

- Engineer muốn thấy website xử lý file PDF tới đâu, đang làm gì, trạng thái ra sao. Đã thêm **logger có cấu trúc** in ra terminal dev server, cắm vào chính pipeline thật (KHÔNG viết file mô phỏng tách rời để tránh lệch với code).
- File mới `SOURCE/lib/ugc/pipelineLog.ts` — `createPipelineLogger(runId?)` trả logger `{stage,ok,fail,info,done,now}`; tự tắt ở production trừ khi `UGC_PIPELINE_LOG=1` (bật khi `NODE_ENV!=="production"`). KHÔNG log token/raw payload (nguyên tắc §12) — chỉ số lượng/mã lỗi/thời gian.
- Cắm vào `SOURCE/app/(layer4)/actions.ts::extractAndAssemble` — 8 công đoạn đánh số `[N/8]`: (1) metadata → (2) kiểm 2 file + số trang PDF → (3) tạo/reset row đề → (4) upload file gốc → (5) AI extract (2 call song song, log riêng từng model + thời gian) → (6) crop hình (log từng câu) → (7) ghép+validate → (8) lưu DB; kết thúc bằng `DONE` + tổng thời gian + trạng thái cuối (review/failed). `toFileRef` nhận logger để log loại/kích thước file + số trang PDF. `cropImagesLenient` nhận optional logger để log từng hình cắt.
- Định dạng ví dụ (đã chạy thử demo): mỗi dòng `[ugc-pipeline] <runId> [N/8] <việc> … / ✓ OK <chi tiết> (<thời gian>)`. Xem terminal `npm run dev` khi bấm Extract.
- Verify: tsc 0 lỗi, vitest 87/87 (logger optional param không phá test cropImages/extractors cũ), eslint sạch.


---

# [UGC v2.1] — Chuỗi doc sửa đổi: format đề quốc gia 3 phần + giao thức Gemini (S#34, 2026-07-17)

## Yêu cầu
Engineer chốt sửa 2 issue lớn phát hiện qua test thật (S#33): (1) kiến trúc không xử lý được format đề chuẩn quốc gia từ 2025 (3 phần, đánh số lặp theo phần, 2 dạng câu hỏi mới); (2) code hỏi bounding-box sai "phương ngữ" so với dữ liệu training của Gemini (0/21 câu phát hiện hình). Yêu cầu: chạy lại quy trình viết doc (sửa cho khớp), rồi chia nhỏ vấn đề thành task. Đã tra cứu tài liệu chính thức của Bộ GD&ĐT (vqa.moet.gov.vn, moet.gov.vn) để viết doc chính xác.

## Quyết định sản phẩm đã chốt với engineer (2026-07-17)
- Hỗ trợ MỌI format đề (cũ 1-phần lẫn mới 3-phần) qua CÙNG một pipeline — đề cũ = trường hợp suy biến 1 phần, không có code path riêng.
- 2 dạng câu hỏi mới (`true_false` đa-ý, `short_answer`): **lưu + hiển thị, KHÔNG tự chấm điểm** — auto-scoring là feature riêng trong tương lai ("Đó là một feature khác. Tạm thời bỏ qua").

## Doc đã viết/sửa (chuỗi PRD → ADR → Design → Work Plan → tasks)
- **MỚI `docs/adr/ADR-0005-multi-part-national-exam-format.md`** — parts là trục dữ liệu hạng nhất; khoá join composite `(part, number)` (sửa tận gốc bug ghi đè đáp án); 4 question type; `sub_answers` jsonb server-only (kỷ luật che giấu như `correct_answer`); `exams.parts` jsonb; id row mới `<examId>-p<part>q<n>` (parser chấp nhận cả dạng cũ); kill criterion: fixture Toán 2025 phải join sạch.
- **MỚI `docs/adr/ADR-0006-gemini-extraction-protocol.md`** — ghi nhận chính thức provider = Gemini (swap 2026-07-17, trước đó chưa vào ADR chain); bbox chuyển sang format native Gemini được train: `box2d [ymin,xmin,ymax,xmax]` số nguyên 0–1000; quy đổi pixel MỘT chỗ duy nhất (`boxToPixels`); fallback bậc thang nếu vẫn yếu (call định vị riêng → gửi từng trang) — CHỈ leo thang khi đo được là chưa đủ; kill criterion Gate D: >0 hình phát hiện trên fixture thật.
- **`docs/prd/ugc-exam-upload-prd.md` → v2.1** — thêm §v2.1 Amendment: R18 (multi-part, AC-030) / R19 (true_false, AC-031) / R20 (short_answer, AC-032) / R21 (old-format regression, AC-033); sửa dependency Claude→Gemini.
- **`docs/design/ugc-exam-upload-design.md` → v2.1** — thêm §v2.1 Amendment đầy đủ: DDL delta (part_number, sub_answers, widen CHECK, exams.parts — idempotent, re-run Gate A), types delta (QuestionType×4, SubItemId, BoundingBox box2d, partNumber trên error, 2 error code + 2 limit mới), assembly delta (khoá composite cho cả đáp án LẪN hình), extraction delta (2 extractor đọc phần + 4 dạng + lưới Đ/S), persistence/read delta (PublicQuestion omit thêm subAnswers — leak = compile error), UI delta (S-03 group theo phần + 2 editor mới; player Đ/S toggle + ô nhập ngắn, nhãn "Not auto-scored yet"; result loại non-MCQ khỏi điểm), test delta. Sửa dòng AI provider trong External Resources.
- **`docs/plans/ugc-exam-upload-work-plan.md` → v2.1** — extension 5 phase (A foundation → B AI protocol → C persistence → D UI → E QA), 2 gate mới: **Gate C** (composite join — fixture chéo-phần 0 ghi đè + fixture v2.0 nguyên trạng) và **Gate D** (bbox — >0 hình trên file thật, fail thì leo thang theo ADR-0006 chứ KHÔNG chỉnh lớp khác).
- **`docs/plans/tasks/README.md`** — bảng 11 task v2.1 (A1 A2 A3 B1 B2 C1 C2 D1 D2 D3 E1) + dependency; đánh dấu 17 task v2.0 ALL DONE.
- **11 task file mới `docs/plans/tasks/task-v21-*.md`** — mỗi task 1 commit, có Goal/Files/Verification, theo khuôn task v2.0.

## Thứ tự thực hiện đề xuất (dependency)
A1 (schema, cần engineer dán SQL + re-run Gate A) và A2 (types) có thể song song → A3 (assembler, GATE C) → B1 (bbox, GATE D — có kill criterion, fail thì dừng leo thang) → B2 (extraction phần + 4 dạng) → C1 → C2 → D1/D2 → D3 → E1 (QA file thật + regression).

## Trạng thái
- Chuỗi doc v2.1 HOÀN CHỈNH — chưa code task nào. Task đầu tiên khi bắt đầu: A2 (thuần code) hoặc A1 (cần bước manual dán SQL của engineer).
- Chưa git add/commit gì (kể cả code v2.0 + fix S#33) — toàn bộ trong working tree.

## Ghi chú quan trọng cho phiên sau
- Workflow chuẩn của engineer vẫn là: làm TỪNG task → cập nhật PROCESS.md → verify → task kế.
- Fixture chuẩn cho B1/B2/E1: file `de-chinh-thuc-ky-thi-tot-nghiep-thpt-nam-2025-mon-toan.pdf` (17 trang = 4 mã đề + 1 trang đáp án) — khi test chỉ dùng **1 mã đề (4 trang)** làm file câu hỏi + **trang đáp án** làm file đáp án; cả file 17 trang vượt MAX_QUESTIONS=50 và trộn 4 mã đề. Trang đáp án mã 0101: I gồm C C C D A C D B A C B D; II Câu1 Đ-S-S-S, Câu2 Đ-S-Đ-S, Câu3 Đ-S-Đ-S, Câu4 Đ-Đ-S-Đ; III: 1260, 1536, 2650, 1,04, 1008, 96,5.
- short_answer tái dùng cột `essay_answer` (không thêm cột mới); true_false tái dùng `choices` cho statement + cột MỚI `sub_answers` cho đáp án (server-only).

## Tiến độ CODE v2.1 (cùng phiên 2026-07-17, tiếp ngay sau doc)

Engineer chốt "bắt đầu code". Các task được code theo nhóm compile được (types v2.1 ràng buộc lẫn nhau nên A2→A3→B→C phải liền mạch để tsc xanh):

- **A1 (code) ✅** — §8c dán vào `schema.sql`: `questions.part_number` (default 1), `questions.sub_answers` jsonb, widen `questions_type_check` (4 loại), `exams.parts` jsonb, **nới `attempt_answers_answer_check`** (từ CHECK A–D → text ≤500 ký tự; người làm bài giờ nhập cả Đ/S từng ý + giá trị ngắn — tính đúng/sai mcq do computeScore server-side, CHECK cũ không phải tầng bảo vệ). **⚠ CHỜ ENGINEER: dán lại schema.sql vào SQL Editor + re-run `npx tsx supabase/test-rls.ts` (Gate A).**
- **A2 ✅** — `types.ts` (QuestionType×4, SubItemId, SubAnswers, BoundingBox→`{page, box2d:[ymin,xmin,ymax,xmax]}` 0–1000, part trên Extracted*/Assembled*, `UgcError.partNumber`, SaveQuestionPatch.subItems/subAnswers, `AssembledExam.parts`); `limits.ts` (+MAX_PARTS 5, MIN/MAX_SUB_ITEMS 2/4, MAX_SHORT_ANSWER 100); `errorCopy.ts` (nhãn "Phần P Câu N" khi caller truyền partNumber — đề 1 phần giữ "Câu N" y v2.0; +2 code WRONG_SUB_ITEM_COUNT/SHORT_ANSWER_TOO_LONG).
- **A3 (GATE C) ✅** — `assembleExam.ts`: khoá join composite `qKey(part,number)`=`"p:n"` cho map đáp án VÀ map hình; sort (part, number); validate 2 loại mới (TF: 2–4 ý distinct a–d + đủ boolean từng ý; short: non-empty ≤ MAX_SHORT_ANSWER); type-mismatch → ANSWER_MISSING. **Test Gate C**: "Câu 1" ở cả 3 phần giữ đáp án+hình riêng (0 ghi đè); đề 2025 thu nhỏ join sạch; nhãn lỗi part-aware; fixture v2.0 chỉ thêm `part: 1` cơ học (assertions nguyên trạng).
- **B1+B2 ✅** — `extractQuestions.ts`: schema/prompt mới — `{parts:[{number,title}], questions:[...]}`, part đánh trong phần, 4 loại (TF cluster subItems a–d), bbox `box2d` [ymin,xmin,ymax,xmax] int 0–1000 theo convention Google (`parseBox` validate arity/range/thứ tự); trả `ExtractedQuestionFile`. `extractAnswers.ts`: 4 variant part-qualified, prompt đọc bảng đáp án theo phần (hàng chữ cái/lưới Đ-S/hàng giá trị). `cropImages.ts`: `boxToPixels` quy đổi box2d/1000 (điểm quy đổi DUY NHẤT), path hình `p{part}q{n}.png`, map khoá `qKey`, log part-aware.
- **C1 ✅** — `actions.ts`: id row `-p{part}q{n}`; persist part_number/sub_answers/exams.parts; multiPart flag cho crop+log; **saveExam khớp patch theo DANH TÍNH (questionIdentityFromId) chứ không theo chuỗi id** — patch id v2.1 vá được row v2.0 cũ (`-q{n}`), không silent-skip. `fromRows.ts`: `questionIdentityFromId` (nhận CẢ 2 dạng id) + assembledFromRows carry part/subItems/subAnswers/parts (cột choices chứa subItems khi TF; `part_number` DB là nguồn chân lý).
- **C2 ✅** — `(layer4)/queries.getMyExam`: select + part_number/sub_answers/parts (surface tác giả — được xem đáp án). `(layer2)/queries.getExamForPlayer`: select part_number, KHÔNG BAO GIỜ select sub_answers/essay_answer/correct_answer; TF map cột choices→subItems. `types/question.ts`: Question + questionType×4/partNumber/subItems/subAnswers; **`PublicQuestion = Omit<..., "correctAnswer"|"essayAnswer"|"subAnswers">`** (leak = lỗi compile). `types/exam.ts`: `Exam.parts?`.
- **D1 ✅** — `QuestionEditor`: +variant TF (ý a–d editable + toggle Đ/S per ý theo file đáp án) + short_answer (input giá trị mong đợi); anchor `#p{part}q{n}`. `AssembledQuestionList`: nhóm theo phần (heading từ exams.parts, fallback "Phần N"; đề 1 phần render phẳng y v2.0); khoá lỗi composite. `ExtractionErrorPanel`: link `#p{p}q{n}`. `ReviewScreen`: toPatch id composite + subItems/subAnswers; onChangeQuestion theo (part, number).
- **D2 ✅** — `useExamPlayer`: answers `Record<string,string>`. `QuestionRenderer` ("use client"): TF = mỗi ý segmented Đ/S (input mã hoá `lib/ugc/tfCodec.ts` "a:Đ,b:S,..."); short = ô nhập ≤100; essay = ghi chú; đều "stored, not auto-scored yet". `ExamPlayer`: nhãn PHẦN của câu hiện tại (aria-live); **tự chuyển câu CHỈ với mcq** (TF/short nhập nhiều lần). Attempt page truyền `exam.parts`.
- **D3 ✅** — `computeScore`: CHỈ mcq vào mẫu số điểm + topic breakdown (đề trộn 22 câu chấm /12, không /22); non-mcq vẫn trong perQuestion (`scored:false`, giữ input user). `types/result.PerQuestionResult`: selected string, correct optional, +scored (row cũ không có = true). `submitExam`: select +question_type, answer cắt 500 ký tự. `getResult`/`ResultQuestion`: +questionType/subItems/subAnswers/essayAnswer (màn SAU NỘP — xem được đáp án lưu trữ). Result detail: câu không chấm hiển thị "Your answer" (TF decode từ tfCodec) + "Stored answer" + nhãn "Not auto-scored".
- File mới: `lib/ugc/tfCodec.ts` (encode/decode/format Đ/S — thuần, client-safe). `types/attempt.ts` không đâu import (legacy) — không đổi.
- Test đã cập nhật: assembleExam (fixture +part:1 cơ học + bộ Gate C/TF/short mới), extractors (payload v2.1), validateInput (parts/part), fromRows (+questionIdentityFromId 2 dạng).
- **Verify tới checkpoint giữa chừng**: tsc 0 lỗi + vitest 99/99 (sau A→C); các sửa D1–D3 sau đó CHƯA chạy lại verify do classifier tool tạm sập — **việc đầu tiên phiên sau: `tsc --noEmit` + `vitest run` + `next build` + `npm run check:bundle`**, sửa nốt lỗi compile nếu có (nghi vấn còn sót: chỗ nào đó còn dùng answers Record<string,ChoiceId>).

---

# [UGC v2.1] — Verify cuối, dọn dead code, commit + push (S#35, 2026-07-18)

## Yêu cầu
"Kiểm tra task còn dang dở thì hoàn thiện, xong thì push. Dọn repo (xoá file/folder không vai trò, không chức năng runtime)." Sau đó: "Gỡ dead code + chỉ cách chạy lại query."

## Việc đã làm
- **Verify lại toàn bộ (đúng như dặn ở checkpoint D1–D3)** — phát hiện tsc **KHÔNG sạch** như PROCESS ghi (S#34 chưa verify lại sau D1–D3): đúng nghi vấn "answers Record<string,ChoiceId>" — `(layer2)/actions.ts::submitExam` dựng `Map` với `questionType` narrower nên type-predicate `q is Question` fail. **Fix**: khai báo `new Map<string, Question>(...)` tường minh. Gỡ luôn import `ChoiceId` thừa trong `computeScore.ts`.
- **Sau fix**: `tsc` 0 lỗi · `vitest run` 102/102 (7 file) · `next build` OK · `npm run check:bundle` PASS. Lỗi eslint `ExamTimer.tsx` ("ref during render") là **có sẵn từ commit 7957cee**, không thuộc UGC, không chặn build → để nguyên.
- **Dọn repo**: xoá rác tạm `.playwright-mcp/` (log debug), `dap_an.png`, `prompt.txt`; gitignore `.playwright-mcp/` + `.claude/settings.local.json` + `SCREENSHOT/temporary_screenshot/`. GIỮ `docs/`, `DESIGN.md`, `ASSETS/images/*` (design source + license), `SCREENSHOT/design_reference/`. `parseExam.ts` đã không còn (không cần gỡ).
- **Gỡ dead code** (commit `8fc6ea3`): route chết `/admin/import` + `ImportContentManagement.tsx` (mock UI thiết kế cũ, nav đã trỏ `/upload` từ Task 6.1) + khối CSS `fade-slide-in` độc quyền trong `globals.css`. Route 11 → 10. Lưu ý: build đầu báo lỗi từ cache route-type cũ trong `.next/` → xoá `.next` build lại là sạch.
- **Commit + push lên `origin/main`** (repo `undetecteddeveloper/TrangNguyenDigi`): `a3a7466` chore hygiene → `257b03a` feat UGC (v2.0+v2.1) → `8fc6ea3` chore gỡ dead code. **Toàn bộ code v2.0+v2.1 giờ ĐÃ nằm trên remote** (trước đây mọi phiên đều chưa commit).

## ✅ GATE A XANH VỚI SCHEMA v2.1 (§8c) — 2026-07-18
Engineer đã dán `schema.sql` (có §8c) vào Supabase SQL Editor + Run, rồi chạy `npx tsx supabase/test-rls.ts` → **TẤT CẢ PASS**: 7 check attempt cũ + 22 check UGC (R-a…R-l bảng + R-m…R-o Storage). **Dependency manual lớn nhất (dán schema + Gate A) đã xong.**

## CÒN NỢ (chỉ còn phần browser/real-file — cần engineer chạy tay hoặc playwright MCP)
- **Gate D** (bbox — >0 hình phát hiện trên file PDF/ảnh THẬT): chưa xác minh trên file thật (mới chỉ smoke test ảnh render sạch từ SVG ở S#33). Đây là kill criterion của B1 — phải đo trên fixture thật (1 mã đề 4 trang + trang đáp án của đề TN THPT 2025).
- **Task 7 / E1 QA**: a11y (axe/keyboard) S-01/02/03 + e2e đầy đủ upload→extract→review→publish→attempt→report qua browser thật + AC-027 count trước/sau. GEMINI_API_KEY thật đã có trong `.env.local`.
- Rủi ro OCR chữ Việt + công thức trên ảnh/PDF chụp/scan thật vẫn là ẩn số (xem S#33 mục Rủi ro).

## Cách chạy lại query Gate A (ghi để nhớ)
1. Copy toàn bộ `SOURCE/supabase/schema.sql` → Supabase Dashboard → SQL Editor → Run (idempotent, dán lại an toàn). Bắt buộc mỗi khi sửa schema.
2. `cd SOURCE` rồi `npx tsx supabase/test-rls.ts` (script tự đọc `SOURCE/.env.local`, đủ 3 key URL/ANON/SERVICE_ROLE — không cần export shell; `tsx` chưa cài local nên npx tự tải bản tạm).

---

# [UGC v2.1] — Sự cố "Failed to fetch" + GATE D XANH + tách distDir prod/dev (S#36, 2026-07-18)

## Sự cố & chẩn đoán
Engineer upload 2 PDF fixture ở `/upload` → browser báo `TypeError: Failed to fetch` tại `fetchServerAction`. Rà theo giả thuyết:
- ❌ Bug pipeline (mupdf/sharp/body-limit/Gemini) — LOẠI: agent tái hiện y hệt (đăng nhập test account, upload đúng 2 file đó qua Playwright) → pipeline chạy trọn 8/8 bước trong 11.58s, redirect màn review thành công.
- ❌ Native crash node.exe — LOẠI: Windows Error Reporting không có record.
- ✅ **Nguyên nhân lõi: dev server của engineer ĐÃ CHẾT tại thời điểm bấm Extract** — curl :3000 → HTTP 000, netstat không có listener; log `.next/dev/logs/next-development.log` dừng đột ngột ở giây 18 (không kịp ghi GET /upload). "Failed to fetch" = browser không kết nối được server, không phải lỗi HTTP từ app.
- Điều kiện nghi vấn nhất: server 09:58 khởi động đè lên `.next` đang chứa **production build** (S#35 chạy `next build` verify mà không dọn) — đúng gotcha trộn prod/dev đã ghi trong PROCESS/memory từ trước.

## ✅ GATE D XANH (kill criterion B1 đạt) — 2026-07-18
Trên fixture PDF thật (đề 3 phần, 5 câu, 1 hình tam giác vẽ vector): `extractQuestions` nhận diện **5 câu / 3 phần đúng cấu trúc**, bbox `box2d` phát hiện **1/1 hình** (phần 1 câu 2) → crop & lưu OK (3KB). So với 0/21 trước ADR-0006 — giao thức native Gemini hoạt động. Toàn bộ đáp án ghép khớp 100% file đáp án (C, A / Đ-Đ-Đ-S / 4, 40), LaTeX transcribe đúng, trạng thái cuối `review`, màn S-03 render đủ (nhóm phần, hình, 3 loại editor). **Một phần lớn của e2e Task 7/E1 coi như đã chạy: upload→extract→review OK qua browser thật.**

## Fix bền vững: tách distDir prod/dev
- `next.config.ts`: `distDir = NODE_ENV==="production" ? ".next-build" : ".next"` — `next build`/`next start` dùng `.next-build`, `next dev` giữ `.next`. Gotcha "kill server → build → rm -rf .next → dev" bị loại BỎ TẬN GỐC (2 bên không còn giẫm nhau; không cần dọn thủ công nữa).
- `scripts/check-ai-key-bundle.mjs`: quét `.next-build/static` (bundle production thật).
- `.gitignore` (root + SOURCE): thêm `.next-build/`.
- `tsconfig.json`: Next build tự append include `.next-build/types/**` (hành vi chuẩn, commit kèm).
- Verify: build → chỉ tạo `.next-build` (`.next` không bị đụng); `check:bundle` PASS; dev server mới → `.next` chỉ có `dev/`; site chạy đủ (/, /upload, /me/exams, màn review).

## Fixture PDF (tạo ở S#35b, đang ở root repo — UNTRACKED)
`de_kiem_tra_toan.pdf` (đề: PHẦN I 2 mcq [câu 2 có hình tam giác], PHẦN II 1 true_false 4 ý, PHẦN III 2 short_answer) + `dap_an_toan.pdf` (đáp án: C, A / Đ-Đ-Đ-S / 4, 40). Tạo bằng fpdf2 (script trong scratchpad phiên; gotcha fpdf2: phải `set_x(l_margin)` trước mỗi `multi_cell` width=0). Dùng làm fixture chuẩn cho Gate D/E1 — cân nhắc commit vào repo nếu muốn giữ lâu dài.

## ⚠️ SỬA KẾT LUẬN — NGUYÊN NHÂN LÕI THẬT (cùng phiên, ngay sau đó)
Sau khi commit fix distDir, dev server MỚI của agent cũng chết (exit 1) — lần này log bắt được thủ phạm thật:
```
Error: Could not load the "sharp" module using the win32-x64 runtime
ERR_DLOPEN_FAILED: The specified procedure could not be found.
...@img\sharp-win32-x64\lib\sharp-win32-x64-0.35.3.node
```
**Nguyên nhân lõi: HAI phiên bản sharp trong một tiến trình** — app cài `sharp@^0.35.3` (S#32) nhưng `next@16.2.7` mang `sharp@^0.34.5` riêng (optionalDependencies, dùng cho next/image). Cả 2 bundle `libvips-42.dll` CÙNG TÊN khác version (8.17 vs 8.18); Windows chỉ nạp 1 DLL/tên/tiến trình → bản nạp TRƯỚC thắng:
- User duyệt trang có ảnh trước (Next optimize brand_logo → sharp 0.34 + libvips 8.17 nạp) → bấm Extract → sharp 0.35 của app đòi symbol 8.18 trong DLL 8.17 → ERR_DLOPEN_FAILED → **CHẾT CẢ TIẾN TRÌNH** → "Failed to fetch". (Log của user có warning ảnh logo ngay trước khi chết — khớp.)
- Chiều ngược lại (Extract trước như lần tái hiện đầu) → libvips 8.18 nạp trước, sharp 0.34 chạy được trên 8.18 (ABI cộng dồn) → không crash. **Giải thích trọn tính không tất định.**

**Fix (commit cùng S#36b):** hạ app về `sharp@^0.34.5` — trùng range của Next → npm **dedupe còn 1 bản vật lý duy nhất** (`npm ls sharp`: `sharp@0.34.5 deduped`) → cùng module instance, xung đột DLL bất khả thi về cấu trúc. API dùng (`extract/png/toBuffer/metadata`) không đổi giữa 0.34/0.35.
**Verify quyết định:** ép đúng thứ tự kill — curl `/_next/image` (Next-sharp nạp trước, optimize thật 11.7KB webp) → chạy full upload flow → pipeline 8/8 OK (11.93s), crop [6/8] OK, server SỐNG. Thêm: `next build` chạy SONG SONG dev server không sao (nhờ distDir tách — S#36a vẫn là fix vệ sinh đúng, chỉ không phải nguyên nhân lõi). Đề test "Fixture v2" tạo trong lần verify đã xóa qua UI (tiện verify luôn flow Delete e2e).
**⚠️ QUY TẮC MỚI: sharp của app PHẢI cùng range `^0.34.x` với optionalDependencies của next** — khi nâng Next, kiểm tra `node -e "console.log(require('next/package.json').optionalDependencies.sharp)"` rồi chỉnh theo; sau mọi thay đổi sharp/next chạy `npm ls sharp` phải thấy "deduped" duy nhất.

## CÒN NỢ sau S#36
- Task 7/E1 phần còn lại: a11y (axe/keyboard) S-01/02/03; e2e đoạn publish→attempt→report (upload→extract→review + delete ĐÃ pass); AC-027 count; OCR trên ảnh CHỤP/scan thật (fixture hiện là PDF text sạch).
- Nhắc vận hành: nếu gặp "Failed to fetch" → kiểm tra terminal dev server còn sống trước tiên (`curl localhost:3000`).

---

# [UGC] — extractQuestions EXTRACTION_FAILED, root cause 503 transient + bật SDK retry (S#37, 2026-07-20)

## Sự cố & chẩn đoán
`extractQuestions` (stage 5/8 upload đề) fail mã generic `EXTRACTION_FAILED`, rollback cả pipeline; 2 call khác (`gemini-3.1-flash-lite`) sống. Log `[ugc-extract] extractQuestions:catch` xác nhận `ApiError status 503 UNAVAILABLE "high demand… try again later"` — model `gemini-3.5-flash` quá tải tạm thời, retryable. Các giả thuyết ban đầu (MAX_TOKENS/429 quota/404/concurrency) đều sai.
Lý do 503 thoáng qua thành chí mạng: SDK `@google/genai` 2.12.0 có sẵn retry cho 408/429/500/502/503/504 nhưng **TẮT mặc định** — chỉ chạy khi truyền `httpOptions.retryOptions`. Client tạo bằng `{ apiKey }` trơn ⇒ 0 retry ⇒ 1 cú 503 rollback cả pipeline.

## Fix đã áp
1. `lib/ugc/gemini.ts` — tạo client với `httpOptions: { retryOptions: { attempts: 3 } }`.
2. Nới `FATAL_CALL_DEADLINE_MS` 15s→30s (để chuỗi retry chạy xong trước khi AbortController deadline cắt).
3. Thêm `logExtractorExit`/`sdkErrorDetail` + instrument 4 lối thoát ở cả 3 extractor (log server-side, không log payload) — chính nhờ đây mới đọc được 503.

## Verify & kết quả
tsc sạch, 102 UGC test pass (+4 test hồi quy). Probe trực tiếp 3 vòng cùng key: `gemini-3.5-flash` 503 mọi lần, `gemini-3.1-flash-lite` OK mọi lần <1s ⇒ Google overload riêng model 3.5-flash, code sạch. **Đã commit + push origin/main** (`971a4fe` feat(layer4/ugc), `227e3c3` chore(assets)). Quyết định: không thêm fallback model — theo dõi tiếp nếu 503 lặp lại thường xuyên trên `gemini-3.5-flash` thì mới cân nhắc ADR fallback.

---

# [Rating System] — Frontend teardown + rebuild toàn bộ thành academic-rubric layout (S#38, 2026-07-27, branch `feat/rating-system`)

## Yêu cầu
Xoá toàn bộ UI Rating Page cũ (không để dead code), redesign sau khi nghiên cứu layout minimalist/academic. Backend (`actions.ts`/`queries.ts`/`lib/rating`) giữ nguyên xuyên suốt.

## Việc đã làm (cùng 1 phiên, nhiều bước nối tiếp)
1. **Redesign nền tảng**: xoá `RatingForm`/`RatingOverview`/`PartCard`/`PartDetail`/`RatingModal`/`RatingModalController`/`CircleScale` (port demo dark-sidebar bubble-expand cũ) → xây lại khớp ngôn ngữ "paper" sẵn có của app (ScoreCard/TopicBreakdown/DifficultyBadge). Component mới: `ScoreScale.tsx`, `RatingRubric.tsx` (gộp Form+Overview+PartCard+PartDetail), `RatingEntry.tsx` (gộp Modal+Controller).
2. **Phân trang từng phần**: `RatingRubric` đổi từ hiển thị cả 3 phần → 1 phần/lần + Prev/Next ("Part n of 3"), Overall + Submit luôn hiện. Bug ARIA phát hiện qua Playwright (không phải vitest): `aria-labelledby` đè `aria-label` cùng element → tên group luôn sai — fix bằng cách bỏ `aria-labelledby`.
3. **Fix phụ cùng phiên**: `computeScore.ts` chưa implement true_false re-enable scoring (fix, 8/8 test); `lib/fake-data/analytics.ts` thiếu hoàn toàn làm block `next build` (tạo lại tối giản — xem mục Analytics Layer 3 bên dưới, CHƯA đầy đủ theo design doc).
4. **Audit tích hợp Layer 2 ↔ rating**: không có regression ở `RateButton`/`DifficultyBadge`/`ExamBrowser`/`ExamFilters`. Thêm toggle hướng sort (`?dir=asc|desc`) cho "Hardest" trong `ExamFilters.tsx` + `queries.ts` (`SortDirection`, `DEFAULT_ASCENDING`), backward-compatible khi thiếu `dir`.
5. **Điều tra "Level không có data"** — KHÔNG phải bug: ngưỡng N=3 rating (ADR-0008) đúng thiết kế, chỉ chưa đủ dữ liệu thật trong DB dev. Test thật bằng 2 tài khoản se2rater, xác nhận `exam-hoa-10` đạt 3 rating → hiển thị đúng "Hard · 7.9", filter/sort đúng.
6. **UX nút Submit**: rút còn 2 state ("Submit rating"/"Submitting…", bỏ "Saved"); thêm `SuccessToast.tsx` (bottom-center, aria-live) thay label thứ 3. Thêm transition motion-safe cho Prev/Next + dialog entrance. Bug timing phát hiện qua Playwright: bỏ state `announcement` nội bộ của RatingRubric (bị unmount trước khi commit DOM trong biến thể dialog) — dùng SuccessToast làm nguồn thông báo accessible duy nhất.
7. **Xoá popup kết quả, chuyển sang điều hướng thẳng**: xoá hẳn `RatingEntry.tsx` (dialog) và `TopicBreakdown.tsx` (Result page). Entry point Result page giờ là `<Link href="/exams/[id]/rate">` server-rendered thuần, không còn `?rate=auto`. `ResultActions` sửa thành 3 nút đều nhau (Save/Share/Return).
8. **Back có ngữ cảnh**: `/rate` nhận `?returnTo=` từ nơi gọi, validate chống open-redirect (`safeBackHref` — chỉ nhận path bắt đầu `/`, chặn `//`/`://`/backslash). Từ ExamBrowser (không `returnTo`) → mặc định `/exams`.

## Verify & kết quả
223/223 vitest pass, `tsc --noEmit` sạch, `next build` chạy được. Verified live nhiều lần bằng Playwright (`exam-hoa-10`/`exam-ly-10`). **CHƯA COMMIT** — toàn bộ vẫn nằm trên branch `feat/rating-system`.

## CÒN NỢ / lưu ý cho phiên sau
- Chưa commit nhánh `feat/rating-system` — cần rà lại diff tổng thể trước khi commit/PR.
- Bước 7 (bỏ auto-open dialog sau khi submit) là quyết định tạm — chưa xác nhận lại với engineer liệu có cần giữ nudge "vừa nộp bài xong thì tự mời rate" hay không.
- **Analytics Layer 3 (`/me/dashboard`) — CHƯA HOÀN THÀNH**, phát hiện tình cờ khi build bị block bởi module thiếu. Chỉ tồn tại `layout.tsx`, `BarChartCard.tsx`, `DonutChartCard.tsx`. `AnalyticsDashboard.tsx` và `me/dashboard/page.tsx` KHÔNG tồn tại dù 2 design doc (`docs/design/analytics-layer3-design.md` UI-only, `analytics-layer3-data-logic-design.md` real-data) liệt kê chúng là "existing". `lib/fake-data/analytics.ts` được tạo lại tối giản (chỉ 6 export mà 2 chart component cần) chỉ để unblock build — thiếu `ANALYTICS_BY_RANGE`/`getSubjectStats`/`TimeRange`/... theo design doc. Khi làm tiếp: đọc lại cả 2 design doc, đừng giả định phần UI-only đã xong.

---

# [Layer HM: History] — Doc chain đầy đủ + implement 18 task (7 phase) — trang History + Save/Share PDF (S#39, 2026-07-31, branch `feat/rating-system`)

## Yêu cầu
"Tạo page History có chức năng lưu lịch sử làm bài (attempt) của user, có thể share + lưu về máy một PDF file format riêng." Navbar đã có navlink "History" (trỏ `#`). Page tính là Layer riêng, tên **HM** trong `SOURCE/app/`. Trước khi vào workflow chính, research UX pattern trên internet (không chỉ đọc doc nội bộ) để có context. Feature cỡ trung — hạn chế viết doc dài, chỉ vừa đủ để implement. Playwright + Supabase MCP đang bật.

## Doc chain (đầy đủ, theo quy trình chuẩn của repo)
`docs/prd/history-prd.md` (R1-R10, AC-001→019) → `docs/ui-spec/history-ui-spec.md` (8 component, quyết định D1-D5) → `docs/adr/ADR-0009-pdf-generation-library-choice.md` (chọn **jsPDF + html2canvas**, không dùng `@react-pdf/renderer` vì rủi ro tương thích Next 16/React 19) → `docs/design/history-backend-design.md` + `docs/design/history-frontend-design.md` → `docs/plans/history-work-plan.md` (7 phase) → 18 task file (`docs/plans/tasks/history-work-plan-task-01..18.md` + 6 file `*-phaseN-completion.md`). `PROJECT_OVERVIEW.md` đã sửa §3/§5/§10 (thêm Layer HM).

## Việc đã làm (18 task, TDD Red-Green-Refactor từng task)
1. **Backend**: `app/(layer2)/queries.ts` — `getResult()` mở rộng thêm `startedAt`/`submittedAt`. `app/(HM)/queries.ts` (mới) — `listMyHistory()`: 3 select tuần tự (exam_results → exam_attempts lọc `status='submitted'` order `submitted_at desc` → exams lọc **`.eq("status","published")`** — bug D001 phát hiện khi thiết kế: thiếu filter này thì History có thể hiện dòng attempt của đề đã unpublish, link "View details" 404; đã sửa trước khi code).
2. **Route Layer HM**: `app/(HM)/layout.tsx` (nhại `(layer3)`/`(layer4)`, user nullable, `<SiteHeader>`), `app/(HM)/history/page.tsx` (guard `getCurrentUser()` + `redirect("/?auth=signin")` trước khi query — chặn guest theo AC), `loading.tsx`, `error.tsx` (role="alert" + nút Retry).
3. **UI History**: `HistoryList.tsx`/`HistoryRow.tsx` (row-list theo pattern `ExamRow`/`MyExamsList`, empty-state CTA → `/exams`).
4. **Module PDF dùng chung** (`lib/pdf/generateAttemptPdf.ts` — `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile`; `components/pdf/AttemptPdfTemplate.tsx` — style hex/rgba thuần, không Tailwind/oklch theo ràng buộc ADR-0009): import `jspdf`/`html2canvas`/`react-dom` **chỉ dynamic-import trong thân hàm** (kỷ luật bundle-size). `lib/history/format.ts` (`formatSubmittedDate`/`formatCompletionTime`/`buildPdfFilename` — nguồn format duy nhất).
5. **`ActionButton.tsx`** (atom Save/Share dùng chung, state machine 4 phase idle/busy/error/fallback-confirmed): bug D002 (CSS thật) phát hiện qua test — span lỗi/status là **sibling** của `TooltipTrigger` (Tooltip base-ui không render wrapper) nên lọt vào `grid-cols-3` của caller làm lệch layout 2/4 phase; sửa bằng cách đưa span thành `position:absolute` descendant của chính button (`position:relative`).
6. **Rewire Result page**: `ResultActions.tsx` (bỏ placeholder disabled "coming soon", giờ render 2 `ActionButton` Save/Share thật), `ScoreCard.tsx` (thêm `completionTimeLabel` thay `"—"` cứng), `exams/[id]/attempt/[attemptId]/result/page.tsx` (tính `pdfInput`/`completionTimeLabel` truyền xuống).
7. **Nav wiring**: `SiteHeader.tsx:27` + `HomeSidebar.tsx:22` — `href: "#"` → `href: "/history"` (literal-value only, `isActive` không đổi).
8. **RLS regression thật**: `supabase/test-rls.ts` — thêm case **H-a** (exams-visibility edge case) chạy trên Postgres local thật, pass 2 lần liên tiếp (idempotency).
9. **Fixture-e2e**: `tests/e2e/fixture/history.fixture.e2e.test.ts` (mới, 500+ dòng, pattern `HistoryDriver`/`FixtureBackend` nhại `rating.fixture.e2e.test.ts`) — HE1/HE2/HE3, phát hiện + sửa 1 assertion cũ (HE1(f) hardcode "expected-pending" từ lúc nav chưa wire, nay thay bằng assertion `aria-current="page"` thật).

## Gate chặn: Task 11 (Early Verification Point) — user chọn dừng chờ MCP thay vì evidence cấp code
Task 11 cần xác minh live-browser nhưng subagent `task-executor-frontend` **không có quyền Playwright MCP** (gap propagation tool đã biết, lặp lại nhiều lần trong phiên). Hỏi user: chấp nhận evidence cấp code (đọc code + suy luận) hay dừng chờ MCP reconnect — **user chọn "Dừng lại, chờ Playwright MCP kết nối lại"**. Sau khi user báo "Đã reconnect", agent chính (không phải subagent) tự chạy Playwright MCP thật (navigate/click/snapshot/console/screenshot) để verify Task 11, 12, và về sau luôn dùng agent chính cho mọi bước cần browser thật — không fabricate pass/fail.

## Verify & kết quả
**285/285 vitest pass** · `test-rls.ts` (kể cả case H-a) exit 0 · `tsc`/ESLint sạch trên toàn bộ file chạm tới · bundle-size: `/exams` 225,331B vs `/history` 226,939B (+0.7%), Result route +0.3% — xác nhận jspdf/html2canvas không lọt vào initial bundle · grep `from "jspdf"`/`"html2canvas"` ngoài dynamic-import = 0 match. Verify live bằng Playwright MCP thật (Chromium, không có Firefox/Safari/Android engine thật trong môi trường): PDF thật tạo & tải được từ cả 2 điểm vào (History row + Result page), nav History active-highlight đúng, keyboard-only hoạt động (Tab→Enter tải PDF thật), axe-core audit thật, CDP 4x CPU throttle mô phỏng Android tầm trung (2.15s→9.2s, cả 2 đều thành công).

## 2 phát hiện escalate — KHÔNG sửa trong task này (site-wide, có sẵn từ trước, ngoài scope History)
1. **Color contrast (WCAG AA, serious)**: text `#a62c2b` active-nav trên nền `#211b17` (2.44:1, cần 4.5:1) + `text-muted-foreground` `#6b655c` trên `#ede1c8` (4.45:1, hụt sát nút). Tái hiện y hệt trên `/exams` đã ship — token `globals.css`/DESIGN.md toàn site, sửa cần quyết định design-system ảnh hưởng mọi trang.
2. **Mobile horizontal scroll 360px**: nút profile "AnhPhat" trong `SiteHeader` tràn ~17px. Tái hiện y hệt trên `/exams`.

## CÒN NỢ / lưu ý cho phiên sau
- **CHƯA COMMIT** — toàn bộ nằm trên branch `feat/rating-system` cùng với Rating System (S#38) chưa commit. Cần rà diff tổng thể (2 feature gộp) trước khi commit/PR.
- Cross-browser thật (Firefox/Safari/Android) chưa test được — môi trường chỉ có Chromium qua Playwright MCP. Nếu cần verify trước khi ship, phải nhờ engineer tay hoặc CI thật.
- 2 phát hiện a11y/layout escalate ở trên chưa quyết định fix khi nào/ai làm.
- Work Plan `docs/plans/history-work-plan.md` còn đúng 1 checkbox mở: "User review approval obtained" — chờ engineer sign-off.

---

# [Layer HM: History] — front-adjust: sửa bug scroll vô tận + filter sidebar + gộp 3 nút thành menu ⋯ (S#40, 2026-07-31, branch `feat/rating-system`)

## Yêu cầu (qua `/recipe-front-adjust`)
"Làm riêng một scroll side bar cho History, nhất quán với design hiện tại + gộp ba nút 'save', 'share' và 'view detail' vào một tooltip button (dấu ba chấm) + trình duyệt bị kéo dài vô tận dù content trong page không dài như thế + filter component." Hỏi lại qua AskUserQuestion: user chọn (1) sidebar kiểu **sticky filter rail giống ExamFilters** (không phải sidebar-luôn-mở kiểu HomeSidebar), (2) filter theo **cả 4 tiêu chí** (đề thi, khoảng điểm, môn học, khoảng ngày nộp bài).

## Chẩn đoán bug "scroll vô tận" — root cause thật, không phải D3's bounded-list
Đo trực tiếp qua Playwright MCP (`document.documentElement.scrollHeight` = 4142px dù `body.scrollHeight`/viewport chỉ 709px, dù `<ul>` nội bộ đã có `max-h-[30rem] overflow-y-auto` từ D3 — cái đó vẫn hoạt động đúng, KHÔNG phải nguyên nhân). Truy theo `getBoundingClientRect`/`getComputedStyle` từng phần tử `position:absolute`: `ActionButton.tsx`'s sr-only `reasonId` span (aria-describedby target) là **sibling của `TooltipTrigger`**, không phải descendant — theo đúng comment cũ "safe vì sr-only", nhưng comment đó SAI: không có ancestor `position:relative` nào chứa span này (`@base-ui/react`'s Tooltip Root không render wrapper), nên browser đặt nó theo "hypothetical static position" so với containing block gốc = `<html>`. Với tài khoản test có 36 dòng lịch sử thật, dòng cuối cùng đẩy span đó xuống ~4000px trong flow CHƯA bị cắt bởi `overflow-y:auto` của `<ul>` (vì "static position" tính trên toàn bộ flow trước khi container cha clip) → `documentElement.scrollHeight` bị kéo giãn theo, dù nội dung HIỂN THỊ chỉ cao ~700px — đúng y hệt mô tả của user. Bug này ẩn ở Result page (chỉ 2 button, lệch không đáng kể) nhưng lộ rõ ở `/history` (30+ dòng).

## Việc đã làm
1. **Fix D2 thật**: `ActionButton.tsx` — dời `<span id={reasonId}>` vào bên TRONG `<TooltipTrigger>` (descendant của chính button, được `position:relative` của button chứa) thay vì sibling. `aria-describedby` không đổi hành vi a11y (resolve theo id, không phụ thuộc vị trí DOM) — chỉ đổi layout.
2. **Tách `usePdfAction` hook** (`components/history/usePdfAction.ts` — KHÔNG đặt trong `lib/pdf/` vì `generateAttemptPdf.test.ts` có tripwire ADR-0009 khoá cứng "lib/pdf/ chỉ chứa đúng 1 module + test của nó"): gộp state machine busy/error/fallback-confirmed + `busyRef` guard từ `ActionButton` cũ, dùng chung cho `ActionButton` (Result page) VÀ `HistoryRowMenu` (History) — vẫn đúng AC-007 (một pipeline PDF duy nhất).
3. **`HistoryRowMenu.tsx`** (mới): gộp Save/Share/View details thành 1 trigger "⋯" (`MoreHorizontal`) + dropdown `role="menu"`, nhại đúng pattern dropdown có sẵn của `HeaderProfile.tsx` (scrim + panel ivory) thay vì thêm primitive Menu mới. Busy/error/fallback render thành text TRONG DÒNG bên trong menu item (không phải overlay absolute) — nhờ vậy không lặp lại lớp bug D2 ở component mới này. Auto-đóng menu khi Save/Share xong thành công; giữ mở khi lỗi (retry được) hoặc fallback (đọc được thông báo) — dùng pattern "adjust state during render" (so sánh phase trước/sau) thay vì `useEffect` set-state (repo bật `react-hooks/set-state-in-effect`, chặn thẳng nếu dùng effect).
4. **`HistoryRow.tsx`**: bỏ 2×`ActionButton` + `Link` "View details" cũ, thay bằng 1 `<HistoryRowMenu>`.
5. **Backend**: `app/(HM)/queries.ts` — `listMyHistory()`/`MyHistoryEntry` thêm field `subject` (mở rộng `.select("id, title, subject")`, không đổi filter/RLS hiện có).
6. **`lib/history/filterEntries.ts`** (mới, pure function): lọc mảng `MyHistoryEntry[]` đã fetch theo subject/examId/scoreMin/scoreMax/dateFrom/dateTo (AND). Chủ ý lọc client-side-của-server-fetch (không thêm WHERE-clause cho `listMyHistory()`) vì lịch sử của 1 user vốn đã nhỏ/bounded qua RLS.
7. **`HistoryFilters.tsx`** (mới, `app/(HM)/history/_components/`): sticky filter rail — copy 1:1 ngôn ngữ thị giác của `ExamFilters.tsx` (tay nắm ▶ + nhãn dọc "FILTERS", overlay panel ngà đè lên list, `FilterRow` dropdown). Thêm mới: Subject/Exam là `FilterRow` dropdown; Score/Submitted là cặp input number/date commit-on-blur (key theo value để tự re-sync khi Clear điều hướng). State lọc qua URL searchParams → Server Component re-query, đúng convention `sort`/`level` của `ExamsPage`.
8. **`history/page.tsx`/`HistoryList.tsx` viết lại layout**: `page.tsx` giờ sở hữu `<main className="mx-auto max-w-6xl">` + `relative flex items-start` (y hệt `ExamsPage`), chứa `HistoryFilters` (trái) + `HistoryList` (phải, flex-1) — `HistoryList` không còn tự render `<main>` riêng (tránh 2 `<main>` landmark). Thêm `isFiltered` để phân biệt "chưa có lịch sử" (CTA Browse exams) với "lọc ra 0 kết quả" (chỉ gợi ý bỏ filter, không có CTA sai ngữ cảnh).
9. **Cập nhật test đi kèm** (TDD, không có test nào bị nới lỏng để né lỗi): `ActionButton.test.tsx` (8/8 vẫn xanh, sửa lại obligation "(g cross-file)" theo kiến trúc mới — trỏ qua `usePdfAction` thay vì `ActionButton`/`HistoryRow` trực tiếp), `HistoryRowMenu.test.tsx` (mới, 8/8 — mở/đóng menu, Save/Share/fallback/error/retry/scrim-click/AC-010), `history.int.test.ts` (9/9, thêm field `subject` vào fixture + expected literal), `filterEntries.test.ts` (mới, 6/6). `tests/e2e/fixture/history.fixture.e2e.test.ts` (driver script thủ công, không chạy qua `npm test`) cũng được cập nhật để không còn dạy sai — obligation (b)/(c) của HE1 và HE3(b) giờ mở menu "⋯" trước khi tìm nút Save/Share/View details thay vì tìm trực tiếp.

## Sự cố nhỏ trong lúc làm
- Đặt `usePdfAction.ts` vào `lib/pdf/` lúc đầu → vỡ ngay tripwire ADR-0009 ("lib/pdf/ contains only this module and its test file") — dời sang `components/history/usePdfAction.ts`, sửa lại toàn bộ import.
- `HistoryRowMenu`'s auto-close-on-success viết bằng `useEffect` lúc đầu → ESLint chặn (`react-hooks/set-state-in-effect`, rule mới của React Compiler). Sửa theo pattern React khuyến nghị: so sánh phase hiện tại với phase lưu ở state trước đó NGAY TRONG render, gọi `setState` trực tiếp (không qua effect) khi phát hiện transition.

## Verify & kết quả
299/299 vitest pass (tăng từ 285 — +8 HistoryRowMenu, +6 filterEntries, +1 test H-a giữ nguyên từ trước) · `tsc --noEmit` sạch · ESLint sạch trên toàn bộ file History-feature (kể cả rule mới `set-state-in-effect`) · `next build` qua · `check:bundle` PASS · grep xác nhận 0 static import `jspdf`/`html2canvas` ngoài dynamic-import. Verify LIVE bằng Playwright MCP thật trên tài khoản có 36 dòng lịch sử thật:
- `documentElement.scrollHeight` = 709px (đúng bằng viewport), so với 4142px TRƯỚC fix — bug scroll vô tận đã hết, kể cả khi mở filter panel.
- Filter sidebar render đúng design (ivory overlay, tay nắm sticky) — chọn Subject "Toán" → URL đổi `?subject=To%C3%A1n` → danh sách lọc còn đúng 3/36 dòng khớp subject đó (real round trip, không phải state ảo client).
- Click "⋯" → menu hiện Save/Share/View details → Save tải PDF thật (`ki-m-tra-h-c-k-i_20260727.pdf`) → menu tự đóng sau khi thành công.

## CÒN NỢ / lưu ý cho phiên sau
- Vẫn **CHƯA COMMIT** — cùng branch `feat/rating-system` với S#38/S#39, 3 feature (Rating System + History + front-adjust này) đang gộp chung, chưa tách/commit.
- Dữ liệu `exams.subject` trong DB dev không nhất quán (vừa có "Toán" tiếng Việt vừa có "Math" tiếng Anh cho nội dung tương tự) — không phải bug của filter, filter chỉ phản ánh đúng data thật; nếu cần chuẩn hoá là việc của seed/authoring exam, ngoài phạm vi front-adjust này.
- `docs/design/history-frontend-design.md`/`history-ui-spec.md` KHÔNG được cập nhật theo layout mới (filter sidebar, menu ⋯) — đúng tinh thần "feature cỡ trung, hạn chế viết doc dài" của `/recipe-front-adjust`, nhưng nghĩa là 2 doc đó giờ mô tả UI cũ (3 nút rời, không sidebar). Nếu sau này cần đối chiếu Design Doc ↔ code, cần biết điểm lệch này trước.

## Bổ sung cùng phiên — custom scrollbar TOÀN SITE (engineer feedback kèm ảnh)
Engineer chê thanh cuộn mặc định của hệ điều hành (to bản, có nút mũi tên trắng) hiện ra trên `<ul>` nội bộ của HistoryList — "trông giống cái lấy sẵn", yêu cầu 1 thanh cuộn tự thiết kế tối giản (chỉ 1 hình chữ nhật kéo, không bo góc, màu ít nổi bật) và áp dụng đồng bộ cho toàn site chứ không riêng History.
- `app/globals.css`: thêm rule global (`* { scrollbar-width: thin; scrollbar-color: ...; } *::-webkit-scrollbar{...}`) — track trong suốt, thumb `rgb(107 101 92 / 0.35)` (tông `--muted-foreground`) không bo góc, đậm hơn khi hover (`/0.55`), rộng 8px (so với ~17px mặc định OS). Áp dụng qua bộ chọn `*` nên MỌI phần tử `overflow` trên toàn site đều nhận, không cần sửa từng component.
- **Sự cố dev server**: sau khi sửa, đổi CSS không lên dù đã reload — điều tra bằng cách fetch trực tiếp CSS chunk qua Playwright (bypasses browser cache) thấy chunk phục vụ KHÔNG chứa "scrollbar" dù đã save file. Log `.next/dev/logs/next-development.log` cho thấy compile cuối cùng dừng từ nhiều giờ trước dù nhiều file khác vẫn đổi được qua HMR trong phiên — dev server (`next dev`, đã chạy liên tục suốt session) bị "kẹt", không compile lại nữa. Fix: kill process cũ (PID trên port 3000) + `npm run dev` lại — chunk mới có "scrollbar" ngay, verify lại bằng screenshot thật: thanh cuộn giờ mảnh, không nút mũi tên, màu mờ hợp tông ngà.
- **Lưu ý cho phiên sau**: nếu một thay đổi (đặc biệt CSS/global file) không lên dù code đã sửa đúng và đã reload trình duyệt, nghi ngay dev server bị kẹt (không phải bug code) — kiểm bằng cách fetch trực tiếp asset chunk qua `page.evaluate`/`fetch` (bypass cache của `<link>`) thay vì chỉ nhìn UI, rồi khởi động lại `next dev` nếu xác nhận đúng.

---

# [Layer 3: Analytics] — Dựng route /me/dashboard thật (real data, không fake) (S#41, 2026-07-31)

## Yêu cầu
Engineer: "Thêm route cho Layer 3" — `(layer3)` route group tồn tại từ trước (layout.tsx + 2 chart component `BarChartCard`/`DonutChartCard`) nhưng chưa có `page.tsx` nào, nên `/me/dashboard` (đích có sẵn của nav "Analytics") 404. Đây là nợ kỹ thuật đã ghi nhận từ S#38.

## Đọc lại 2 design doc có sẵn trước khi làm (đã tồn tại, chưa từng implement)
- `docs/design/analytics-layer3-design.md` (UI-only, v1.0) — kế hoạch 6 file, 8 hidden feature (tooltip bám chuột, "NEEDS REVIEW" tự động <75%, trục Y nice-number, màu cố định theo môn, filter "Filter" placeholder cho tới khi chạm, dim hover 35%/200ms, 3 dataset độc lập theo range...).
- `docs/design/analytics-layer3-data-logic-design.md` (v1.0, **supersedes** doc trên phần "Non-scope: Real data") — bản đầy đủ hơn, bỏ qua fake-data hoàn toàn, dựng thẳng pipeline thật: Supabase → reducer thuần → chart. Có sẵn AC-01..13, thuật toán tham chiếu, edge case, risk — bám sát 100% theo đây thay vì tự thiết kế lại.
- Quan trọng: `lib/fake-data/analytics.ts` hiện tại (từ S#38, tạo lại tối giản khi cứu build) **cố tình KHÔNG có** `ANALYTICS_BY_RANGE`/`getSubjectStats`/`TimeRange`/`RANGE_LABELS`/`DEFAULT_RANGE` — comment đầu file ghi rõ "không thêm để tránh export không ai gọi". Vì data-logic doc đã chốt đi thẳng real-data, bỏ qua bước fake-data-trước-rồi-thay-sau — tiết kiệm được một vòng làm-rồi-bỏ.

## Việc đã làm (bám sát data-logic doc, KHÔNG đụng 2 file chart đã "frozen")
1. **`lib/fake-data/analytics.ts`**: bổ sung `RANGE_ORDER`/`TimeRange`/`RANGE_LABELS`/`DEFAULT_RANGE` (chưa tồn tại, cần cho AnalyticsDashboard) — giữ nguyên mọi export cũ (`SUBJECT_ORDER`, `SubjectStats`, `SUBJECT_COLORS`, `NEEDS_REVIEW_THRESHOLD`, `niceCeil`, `computeShares`). Sửa lại comment đầu file (không còn nói "chưa dựng tiếp"), không rename path (giữ nguyên naming-smell đã ghi nhận — 3 file import, rename sẽ lan diff không cần thiết, đúng khuyến nghị doc).
2. **`lib/analytics/aggregateAttempts.ts`** (mới, pure reducer, KHÔNG I/O — đặt ngoài `app/**` vì `vitest.config.ts`'s include glob không quét `app/**`): `aggregateAttemptsByRange(rows, now)` — loại môn ngoài union 7 môn (không có bucket "Other"), bỏ qua môn 0 lượt trong range, thứ tự luôn theo `SUBJECT_ORDER` (không theo thứ tự row đến), `wrong` luôn tính `total-correct` chứ không đọc field lưu sẵn, quy tắc phòng thủ `submittedAt` null (tính vào "all", bỏ qua "week"/"month", không throw).
3. **`lib/analytics/__tests__/aggregateAttempts.test.ts`** (mới, 7/7): cover AC-01/02/03 (sum/wrong/sessions), AC-04 (loại môn ngoài union), AC-05 (bỏ qua 0-lượt + đúng thứ tự SUBJECT_ORDER dù row đến ngược), AC-06 (biên range 3/20/200 ngày trước), quy tắc phòng thủ submittedAt null, input rỗng.
4. **`app/(layer3)/queries.ts`** (mới, server-only): `getAnalyticsByRange()` — 1 query duy nhất `exam_results.select("correct, total, exam_attempts!inner(submitted_at, status, exams!inner(subject))").eq("exam_attempts.status","submitted")`, RLS tự scope theo `auth.uid()` (không cần predicate thủ công, giống `getResult()`), normalize → gọi reducer thuần → trả `Record<TimeRange, SubjectStats[]>` (fetch 1 lần cho cả 3 range, không round-trip riêng mỗi lần đổi filter).
5. **`app/(layer3)/_components/AnalyticsDashboard.tsx`** (mới, client — file này CHƯA từng tồn tại dù cả 2 design doc coi là "đã có"): state `tab`/`range`/`filterTouched`; tab bar BAR/DONUT kiểu underline giống SiteHeader nav; `filterSlot` (`<select>` native) hiện placeholder "Filter" cho tới khi user chạm (hidden feature #1) dù `range` nội bộ đã mặc định "week" ngay từ đầu; nhánh empty-state ("No data yet") thay hẳn chart card khi `data.length===0`, KHÔNG bao giờ gọi `DonutChartCard`/`BarChartCard` với mảng rỗng (tránh `computeShares` chia 0 phiên).
6. **`app/(layer3)/me/dashboard/page.tsx`** (mới — route đích thật của nav "Analytics" có sẵn từ lâu, route group pathless nên không cần sửa nav): auth guard `getCurrentUser()`+redirect trước fetch (giống `(HM)/history/page.tsx`), gọi `getAnalyticsByRange()`, render `<AnalyticsDashboard>`.

## Verify & kết quả
306/306 vitest pass (tăng từ 299, +7 aggregateAttempts) · `tsc --noEmit` sạch · ESLint sạch · `next build` qua, route `/me/dashboard` xuất hiện thật trong bảng route (trước đây không có, 404) · **`git diff --stat` của `BarChartCard.tsx`/`DonutChartCard.tsx` rỗng** (AC-12, xác nhận 2 file chart "frozen" không bị đụng). Verify LIVE bằng Playwright MCP trên tài khoản có lịch sử thật:
- Tab BAR: cột Correct/Wrong thật theo môn (Math/Physics/Chemistry), auto-tag "NEEDS REVIEW" hiện đúng cho các môn <75% accuracy, nav "Analytics" active (đỏ son + underline).
- Tab DONUT: donut + legend % thật (Math 50%/Physics 25%/Chemistry 25% ở range Week).
- Đổi filter sang "All time" (dispatch real `change` event qua Playwright, không phải giả lập tay) → dữ liệu đổi NGAY không reload/loading state (Physics 61%/Math 24%/Chemistry 15%) — xác nhận round-trip fetch-1-lần-cho-cả-3-range hoạt động đúng, filter hiện đúng giá trị thật ("All time") thay placeholder sau khi đã chạm (hidden feature #1 xác nhận đúng).

## CÒN NỢ / lưu ý cho phiên sau
- Vẫn **CHƯA COMMIT** — cùng branch `feat/rating-system`, giờ đã gộp 4 mảng việc (Rating System + History + front-adjust History + Analytics Layer 3) chưa tách/commit.
- Chưa test account nào có 0 lịch sử thật để xác nhận trực quan nhánh empty-state ("No data yet") — logic đã có unit test (input rỗng → mọi range `[]`) và code review (`data.length===0` guard trước khi gọi chart), nhưng chưa tận mắt xác nhận qua browser thật với 1 tài khoản trắng.
- Chưa test tooltip bám chuột (hidden feature #2) và hover-dim 35%/200ms (#7) qua Playwright — 2 hành vi này thuộc `BarChartCard.tsx` (file "frozen", không đụng tới ở pass này) nên rủi ro thấp, nhưng chưa xác nhận trực quan trong phiên này.
- Text subtitle DonutChartCard khi range="All time" đọc hơi gượng ("...this all time") — do template `this {rangeLabel.toLowerCase()}` trong file "frozen" ghép với nhãn "All time" mình chọn; cosmetic nhỏ, không sửa vì sẽ phải đụng file chart đã chốt không đổi.
