# ARCHITECTURE — cái gì để đâu, và vì sao

> Viết cho người nhận bàn giao. Đọc file này trước khi thêm màn hình, sửa một
> tính năng, hoặc tự hỏi "code của X nằm ở đâu". Chốt ngày 2026-09-03 (refactor
> B1–B5); trước ngày đó tài liệu trong `docs/` dùng tên nhóm route cũ
> (`(layer1)`…`(layer4)`, `(HM)`) — bảng đối chiếu ở §2.

## 1. Một quy tắc duy nhất

Next.js không quy định cách chia thư mục (xem
`SOURCE/node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`,
mục "Organize your project") — nó chỉ bảo *chọn một cách rồi giữ nhất quán*.
Repo này chọn cách **"`app/` chỉ chứa trang, mọi code khác nằm ngoài"**:

| Thư mục (trong `SOURCE/`) | Chứa gì | KHÔNG chứa gì |
|---|---|---|
| `app/` | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`, metadata (`sitemap.ts`, `robots.ts`, `opengraph-image.tsx`), `globals.css` | queries, actions, component riêng của tính năng |
| `features/<tên>/` | Toàn bộ code của MỘT tính năng: `queries.ts` (đọc), `actions.ts` (ghi, `"use server"`), `components/`, `__tests__/` | Trang. Code của tính năng khác (§4) |
| `components/` | UI dùng chung giữa ≥2 tính năng: `ui/` (primitive shadcn/base-ui), `layout/` (AppShell, SiteHeader, BottomNav), `shared/`, cùng vài nhóm theo chủ đề (`billing/`, `tutor/`, `essay/`, `support/`) | Component chỉ một tính năng dùng — cái đó ở `features/<tên>/components/` |
| `lib/` | Logic thuần và hạ tầng không có UI: Supabase client, security, i18n, scoring, ugc, schema, billing… | JSX (trừ `lib/i18n/client.tsx`, `lib/billing/entitlement.tsx` — provider mỏng) |
| `types/` | Kiểu dữ liệu dùng chung (`exam.ts`, `question.ts`) | |
| `hooks/` | Hook client dùng chung | |
| `supabase/` | `schema.sql` (canonical, có giải thích), `migrations/` (cơ chế áp), seed, test RLS | |
| `tests/` | Ba làn test cần Supabase thật hoặc cây route thật (§6) | |
| `scripts/` | Công cụ chạy tay (`schema:plan`, `perf-layers`, `verify:*`) | |

Vì sao chọn cách này chứ không phải "mọi thứ trong `app/`": trước 2026-09-03
repo làm CẢ BA cách cùng lúc (`lib/`+`components/` ngoài `app/`, `_components/`
trong `app/`, `queries.ts`/`actions.ts` trong `app/`), nên một tính năng như
billing nằm rải ở ba nơi. Kéo ra ngoài là hướng gần hiện trạng nhất.

## 2. Nhóm route ↔ tính năng

Tên nhóm route (dấu ngoặc) KHÔNG xuất hiện trên URL — đổi tên không đổi gì
người dùng thấy.

| `app/` | Tên cũ (docs trước 2026-09-03) | URL | Code ở |
|---|---|---|---|
| `(auth)` | (layer1) | `/login`, `/reset-password` (form đăng nhập nằm ở `/?auth=signin`, tức `app/page.tsx`) | `features/auth/` |
| `(exams)` | (layer2) | `/exams`, `/exams/[id]`, `/exams/[id]/attempt/...`, `.../rate` | `features/exams/` |
| `(analytics)` | (layer3) | `/me/dashboard`, `/profile` | `features/analytics/`, `features/profile/` |
| `(authoring)` | (layer4) | `/upload`, `/me/exams`, `/me/exams/[id]` | `features/authoring/` |
| `(history)` | (HM) | `/history` | `features/history/` |
| `(billing)` | — | `/pricing`, `/pricing/checkout`, `/me/orders`, `/terms`, `/refund-policy`, `/about` | `features/billing/` |
| `(admin)` | — | `/admin`, `/admin/tickets` | `features/admin/` |

Mỗi nhóm có một `layout.tsx` 3–5 dòng gọi `AppShell`
(`components/layout/AppShell.tsx`) — khung header + BottomNav + SupportWidget +
`EntitlementProvider`. Vì sao `readEntitlement()` chỉ được gọi ở khung và
KHÔNG ở page/component nào bên dưới: đọc comment trong `AppShell.tsx`; có test
cưỡng chế (`app/(exams)/__tests__/layout.test.tsx` quét cả `features/`).

## 3. Muốn thêm một màn hình mới thì tạo file ở đâu

Ví dụ: màn "Bảng xếp hạng" ở `/leaderboard`, thuộc tính năng exams.

1. **Trang**: `app/(exams)/leaderboard/page.tsx` — chỉ gọi vào tính năng, không
   truy vấn Supabase trực tiếp, không chứa component dài. Nếu là nhóm route
   mới: thêm `app/(tên)/layout.tsx` gọi `AppShell` như các nhóm khác.
2. **Đọc dữ liệu**: hàm mới trong `features/exams/queries.ts` (server-only,
   dùng `createClient()` của `lib/supabase/server.ts`; RLS là tầng authorization).
3. **Ghi dữ liệu**: hàm mới trong `features/exams/actions.ts` (file đã có
   `"use server"` ở dòng đầu — giữ nguyên). Ghi đặc quyền → xem
   `lib/supabase/service-role.ts` và ADR-0019 trước: file đó có cổng CI đếm số
   hàm, KHÔNG thêm hàm vào đó nếu chưa đọc TD-029.
4. **Component**: `features/exams/components/LeaderboardTable.tsx`. Client
   component chỉ khi cần state/sự kiện; mặc định là server component.
5. **Test**: `features/exams/components/__tests__/LeaderboardTable.test.tsx`
   và/hoặc `features/exams/__tests__/leaderboard.int.test.ts`. Quy ước: test
   nằm trong thư mục `__tests__/` cạnh code (131 file theo kiểu này, 24 file
   cũ còn đặt cạnh file — không di chuyển để tránh diff vô ích, file mới thì
   theo `__tests__/`).
6. **Chuỗi hiển thị**: thêm khoá vào `lib/i18n/dictionaries/en.ts` VÀ `vi.ts`;
   server dùng `getTranslate()`, client dùng `useT()`.
7. **Đường dẫn cần đăng nhập?** Mặc định là có. Trang công khai phải thêm vào
   `PUBLIC_PATHS` trong `lib/supabase/middleware.ts` — đọc comment ở đó trước
   (có ADR đứng sau con số mục cho phép ghi).
8. **Đổi schema**: sửa `supabase/schema.sql` (có giải thích) + một file
   `supabase/migrations/<timestamp>_<mô-tả>_<vân-tay>.sql`; `npm test` sẽ đỏ
   cho tới khi hai bên khớp và vân tay đúng (TD-005). Áp lên DB bằng CLI, đọc
   lại bằng truy vấn thật.

Tính năng MỚI hoàn toàn: tạo `features/<tên>/` với cùng bốn thứ trên, VÀ thêm
tên vào mảng `FEATURES` trong `SOURCE/eslint.config.mjs` — nếu không luật §4
không bảo vệ thư mục đó.

## 4. Import chéo — luật và ngoại lệ

Luật (`eslint.config.mjs`, khối B4): `features/<a>/` KHÔNG được import
`@/features/<b>/`. Phần dùng chung → `lib/` hoặc `components/`. `app/` được
import mọi tính năng (page là nơi ghép). Test được miễn (mock để dựng cây thật).

Ngoại lệ đang tồn tại, mỗi chỗ có `eslint-disable-next-line` kèm lý do ngay
tại dòng đó — chúng là NỢ, không phải tiền lệ:

| Từ | Tới | Vì sao còn |
|---|---|---|
| `features/exams/components/ReportExam.tsx` | `features/authoring/actions` | `reportExam` sống cạnh `moderateExam` |
| `features/profile/components/{AvatarUploader,ChangePasswordDialog,DisplayNameEditor}.tsx` | `features/auth/actions` | `changeAvatar`/`updateProfile`/`changePassword` còn chung file với `signIn`/`signUp` — tách thành `features/profile/actions.ts` là việc tiếp theo |
| `features/profile/components/SignOutButton.tsx` | `features/auth/actions` | `signOut` là của auth |
| `features/profile/components/ProfileTabs.tsx` | `features/billing/components/orders/PlanSummary` | tab Usage tái dùng thẻ gói của billing |

Chiều ngược — `lib/` hoặc `components/` import `features/` — hiện có ba chỗ
(`components/shared/HeaderProfile.tsx` → auth, `components/tutor/useTutorAction.ts`
→ exams, `lib/history/filterEntries.ts` → kiểu của history). Chưa bị luật chặn;
đừng thêm chỗ mới.

## 5. Những chỗ CẤM CHẠM (đã đo, sửa vào là hồi quy)

- `features/exams/components/questionNodes.tsx` và
  `features/authoring/components/reviewNodes.tsx` render markdown + LaTeX Ở
  SERVER để cây 126 KB không về trình duyệt (TD-021/TD-023). Không
  `next/dynamic`, không import chúng từ component `"use client"` — cần kiểu thì
  import từ `*.types.ts`.
- `lib/supabase/service-role.ts` — 13 hàm, đã vượt ngưỡng ADR-0010; có test đếm
  (ADR-0019). Di chuyển thì được, thêm hàm thì không.
- Bucket `exam-images`, `avatars` là PRIVATE (ADR-0016). Ký URL, không mở public.
- `lib/i18n` dùng cookie, không tiền tố `/vi/` (comment đầu `lib/i18n/server.ts`).
- Bốn làn vitest (§6) không gộp — lý do ở đầu mỗi `vitest.*.config.ts`.

## 6. Cổng kiểm tra trước mỗi commit (chạy trong `SOURCE/`)

```
npx tsc --noEmit
npx eslint --max-warnings 0
npx vitest run            # lib/, components/, app/, features/
npm run build             # duy nhất bắt lỗi ranh giới server/client
npm run test:fixture      # cây route thật, không cần DB
npm run test:localdb      # Supabase dev thật
```

Sau khi ĐỔI TÊN hoặc DI CHUYỂN route: chạy `npm run build` TRƯỚC `tsc`, vì
`tsconfig.json` gom cả `.next-build/types/` do build sinh ra; type validator cũ
còn trỏ đường dẫn cũ sẽ làm `tsc` đỏ oan cho tới khi build lại.

## 7. Tài liệu liên quan

- `PROJECT_OVERVIEW.md` — stack, quy ước commit, bảng nhóm route.
- `TECH-DEBT.md` — nợ đang mở (TD-029 service_role, TD-033 từ điển i18n).
- `docs/adr/` — mỗi quyết định có ngày và lý do; ADR thắng file này khi mâu thuẫn.
- `.claude/MEMORY.md` — quy trình 3 pha, tài khoản test, Notion ghi tiến độ.
