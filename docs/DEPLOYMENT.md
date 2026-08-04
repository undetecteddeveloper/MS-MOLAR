# Deployment — Vercel + Supabase (production)

Hướng dẫn đưa MS-MOLAR lên domain công khai. Viết cho lần deploy ĐẦU TIÊN;
các lần sau chỉ cần `git push` vào `main` là Vercel tự build.

**Quyết định kiến trúc đã chốt (2026-08-04):**

- Host: **Vercel** (Next.js 16 + Server Actions + proxy.ts chạy native, không cần adapter).
- Production branch: **`main`**. Feature branch push lên sẽ tự có Preview deploy riêng.
- Database: **Supabase project RIÊNG cho production**, tách hẳn khỏi project dev.
  Lý do: project dev đang chứa tài khoản test (`+rlstesta`, `+se2rater1..10`) và
  dữ liệu thí nghiệm; dùng chung nghĩa là mọi thử nghiệm local đập vào dữ liệu
  người dùng thật.

---

## Phần 1 — Tạo Supabase project production

Làm phần này TRƯỚC, vì Vercel cần key của nó ở Phần 2.

### 1.1 Tạo project

<https://supabase.com/dashboard> → **New project**.

- Region: chọn gần người dùng nhất (Singapore nếu user chủ yếu ở VN).
- Đặt tên phân biệt rõ với project dev, ví dụ `ms-molar-prod`.
- **Lưu lại Database Password** ngay lúc tạo — Supabase không cho xem lại.

### 1.2 Dựng schema

Dashboard → **SQL Editor** → New query → paste TOÀN BỘ `SOURCE/supabase/schema.sql`
→ **Run**.

File này idempotent (chạy lại nhiều lần không lỗi), gồm cả bảng, RLS policies,
trigger `user_profiles`, và storage policies (§8).

### 1.3 Tạo storage buckets

Script đọc key từ `SOURCE/.env.local`, nên phải tạm trỏ file đó sang project prod.

**PowerShell** (shell mặc định trên máy này — `mv`/`cp` là alias của
`Move-Item`/`Copy-Item`; `Move-Item` KHÔNG tự ghi đè, phải thêm `-Force` khi
trả file về, nếu không sẽ gặp lỗi "Cannot create a file when that file
already exists"):

```powershell
cd SOURCE
Copy-Item .env.local .env.local.dev-backup   # backup dev trước khi sửa
# Sửa .env.local → điền URL + service role key của project PROD
npx tsx supabase/setup-storage.ts   # tạo exam-images, exam-uploads (private)
npx tsx supabase/verify-schema.ts   # xác nhận schema khớp
Move-Item .env.local.dev-backup .env.local -Force   # trả về dev, -Force bắt buộc
```

**Git Bash / macOS / Linux**:

```bash
cd SOURCE
cp .env.local .env.local.dev-backup
# Sửa .env.local → điền URL + service role key của project PROD
npx tsx supabase/setup-storage.ts
npx tsx supabase/verify-schema.ts
mv .env.local.dev-backup .env.local   # cp/mv Unix ghi đè mặc định, không cần -f
```

⚠ Cả hai script đọc key TẠI THỜI ĐIỂM CHẠY — nếu quên bước "sửa .env.local"
ở giữa, script sẽ chạy nhầm vào project dev. Không nguy hiểm (bucket tạo
idempotent, bỏ qua nếu đã tồn tại) nhưng vô nghĩa: kiểm tra lại bằng
`curl "$URL/storage/v1/bucket" -H "apikey: $KEY"` xem bucket có xuất hiện ở
đúng project prod chưa.

Cả 2 bucket đều `public=false`; quyền đọc/ghi do RLS trên `storage.objects` quyết định.

### 1.4 Cấu hình Auth (LÀM SAU KHI CÓ DOMAIN VERCEL — xem Phần 3)

---

## Phần 2 — Tạo Vercel project

<https://vercel.com/new> → **Import Git Repository** → chọn
`undetecteddeveloper/TrangNguyenDigi`.

### 2.1 Build settings

| Trường | Giá trị |
| --- | --- |
| Framework Preset | Next.js |
| **Root Directory** | **`SOURCE`** ← BẮT BUỘC đổi. App không nằm ở repo root. |
| Build Command | *(để mặc định — `next build`)* |
| Output Directory | *(để mặc định)* |
| Install Command | *(để mặc định — `npm install`)* |
| Node.js Version | 22.x trở lên |

> Về Output Directory: `next.config.ts` có `distDir` tách prod/dev (`.next-build`)
> cho máy local, nhưng đã loại trừ Vercel bằng `!process.env.VERCEL` nên trên
> Vercel vẫn là `.next` mặc định. **Không** khai báo Output Directory thủ công.

### 2.2 Environment Variables

Thêm cả 5 biến, scope **Production** (và Preview nếu muốn preview deploy chạy được).
Lấy giá trị từ Supabase prod: Dashboard → Project Settings → **API**.

| Biến | Nguồn | Ghi chú |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API → Project URL | Public, xuống client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon/public key | Public, xuống client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role key | **BÍ MẬT** — bypass toàn bộ RLS |
| `GEMINI_API_KEY` | Google AI Studio | **BÍ MẬT** — dùng cho UGC extract |
| `ADMIN_USER_IDS` | uuid của user trong `auth.users` | Danh sách phân cách bằng dấu phẩy |

`ADMIN_USER_IDS` để trống thì trang `/admin` báo "chưa cấu hình" và không ai thao
tác được. Điền SAU khi đã đăng ký tài khoản admin trên site prod (Phần 3.3).

Hai key bí mật không có tiền tố `NEXT_PUBLIC_` nên không bao giờ xuống bundle
client — có `npm run check:bundle` gác việc này, chạy được ở CI.

### 2.3 Deploy

Bấm **Deploy**. Build đầu mất ~2–4 phút. Kết quả là domain
`<project>.vercel.app`.

---

## Phần 3 — Nối hai bên lại

### 3.1 Supabase Auth URLs

Không làm bước này thì **link xác nhận email và OAuth sẽ hỏng** (redirect về
localhost hoặc bị từ chối).

Supabase prod → **Authentication → URL Configuration**:

- **Site URL**: `https://<domain-thật-của-bạn>`
- **Redirect URLs** (thêm từng dòng):
  - `https://<domain>/auth/callback`
  - `https://<project>.vercel.app/auth/callback` (nếu dùng cả domain vercel)
  - `https://*-<team-slug>.vercel.app/auth/callback` (nếu muốn Preview deploy đăng nhập được)

Code KHÔNG hard-code domain: `app/(layer1)/actions.ts` lấy origin từ request
header, nên chỉ cần allowlist phía Supabase là đủ.

### 3.2 OAuth providers (nếu bật Google/Facebook)

Trong Google Cloud Console / Facebook App, thêm Authorized redirect URI:
`https://<supabase-project-ref>.supabase.co/auth/v1/callback`

### 3.3 Chỉ định admin

1. Vào site prod, đăng ký tài khoản admin bằng email thật.
2. Supabase prod → **Authentication → Users** → copy `id` (uuid) của tài khoản đó.
3. Vercel → Settings → Environment Variables → `ADMIN_USER_IDS` = uuid vừa copy.
4. **Redeploy** (đổi env var không tự động rebuild).

### 3.4 Custom domain

Vercel → Settings → **Domains** → Add. Vercel cấp SSL tự động.
Sau khi domain sống, quay lại **3.1 cập nhật Site URL**.

---

## Phần 4 — Kiểm tra sau deploy

- [ ] Trang chủ load, không lỗi console
- [ ] Đăng ký tài khoản mới → nhận email xác nhận → link trỏ về domain prod (không phải localhost)
- [ ] Đăng nhập → vào được `/exams`
- [ ] Upload đề PDF ở `/upload` → extract chạy xong (đường này gọi Gemini + mupdf WASM, dễ lỗi nhất trên serverless)
- [ ] Làm 1 đề → nộp → xem được `/result` và `/result/detail`
- [ ] `/admin` nhận đúng quyền admin, và từ chối tài khoản thường
- [ ] Response headers có `Content-Security-Policy` và `Strict-Transport-Security`
      (HSTS chỉ xuất hiện khi `NODE_ENV=production` — tức là trên Vercel, không có ở local)

---

## Đã biết trước — hạn chế của môi trường serverless

Không phải bug, nhưng cần biết trước khi có người dùng thật:

1. **Rate limit trở nên lỏng hơn.** `lib/security/rateLimit.ts` đếm trong RAM của
   một tiến trình. Vercel chạy nhiều instance → trần thực tế = `limit × số instance`,
   và cold start reset bộ đếm. Bản thân file đã ghi rõ điều này. Muốn siết thật thì
   dùng rate limit ở biên (Vercel Firewall / Cloudflare) hoặc chuyển sang Redis.

2. **UGC extract nằm gần trần thời gian function.** `FATAL_CALL_DEADLINE_MS = 150s`
   (`lib/ugc/gemini.ts:99`, commit `f3e4102`) là deadline cho RIÊNG call Gemini.
   Với fluid compute (Vercel bật mặc định) trần function là **300s ở cả Hobby lẫn
   Pro** — nên 150s vừa đủ, KHÔNG cần nâng plan.

   Nhưng biên mỏng hơn con số gợi ý: 300s phải bọc TOÀN BỘ Server Action —
   upload file, mupdf parse, extractQuestions (≤150s), extractAnswers (≤150s
   nữa), rồi ghi DB. Hai lần extract nối tiếp là đã 300s. Nếu `/upload` chết
   im lặng với đề dài, đây là nghi phạm số một.

   Hai việc cần làm nếu gặp:
   - Giữ **fluid compute BẬT** (Settings → Functions). Tắt đi là rơi về trần cũ
     thấp hơn nhiều và đường upload gãy ngay.
   - Đặt `export const maxDuration = 300` ở route/action tương ứng cho tường minh
     — hiện code KHÔNG export `maxDuration` ở đâu cả, đang sống nhờ mặc định.

3. **`serverExternalPackages: ["mupdf", "sharp"]`** — hai package này require ở
   runtime chứ không bundle. File tracing của Vercel thường bắt được, nhưng nếu
   `/upload` lỗi kiểu "cannot find module" hoặc "the PDF could not be read" thì
   nguyên nhân là file `.wasm`/`.node` không được đóng gói; xử lý bằng
   `outputFileTracingIncludes` trong `next.config.ts`.

4. **CSP `script-src` vẫn còn `'unsafe-inline'`** — đã ghi ở `docs/TECH-DEBT.md`.
   CSP hiện chưa chặn được inline-XSS; phòng thủ chính là cookie `httpOnly`
   (`lib/supabase/cookieOptions.ts`).
