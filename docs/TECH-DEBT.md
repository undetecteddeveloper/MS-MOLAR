# Technical Debt Register

Sổ ghi nợ kỹ thuật — CHỈ dùng để ghi nhận nợ, không phải nơi thiết kế giải pháp.
Mỗi mục: nó là gì, tại sao chấp nhận, và cái gì sẽ nổ nếu quên.

Không ghi vào đây: lỗi bảo mật đang mở (thuộc `docs/security-review-*.md`), cảnh
báo đã tự viết trong header của chính file code, và những lệch pha không có
đường nào chạm tới được trong thực tế. Ghi mục mới lên ĐẦU phần "Đang mở"; xoá
mục khi đã trả nợ (ghi lại trong PROCESS.md).

---

## Đang mở

### TD-008 — Rate limit nằm trong RAM tiến trình, không dùng chung giữa instance
**Từ:** 2026-08-03 (bản vá Security review Low)
**Loại:** phòng thủ chỉ đúng một phần

`lib/security/rateLimit.ts` đếm trong bộ nhớ của tiến trình đang chạy. Hệ quả
thật, không phải lý thuyết:
- Deploy nhiều instance (Vercel serverless) → trần thực tế = limit × số instance.
- Cold start / redeploy → bộ đếm về 0.
- Khoá là user id nên KHÔNG chặn được flood từ client chưa đăng nhập.

**Vì sao vẫn làm vậy:** nó giải quyết đúng thứ đang thiếu — một tài khoản đã
đăng nhập gọi dồn dập submitExam/rateExam/reportExam/updateProfile — mà không
thêm bảng DB hay round-trip nào vào đường người dùng đang chờ (dự án đã tối ưu
round-trip khá kỹ, xem getResult).

**Cách trả:** rate limit ở BIÊN (Vercel Firewall / Cloudflare) cho lưu lượng
chưa đăng nhập; nếu cần chính xác theo user across-instance thì chuyển bộ đếm
sang Redis/Upstash hoặc một bảng Postgres. Đừng nhầm cái hiện tại là chống DoS.

### TD-009 — `ADMIN_USER_IDS` là cấu hình bắt buộc, không có ở đâu ngoài env
**Từ:** 2026-08-03 (bản vá Security review Medium #7)
**Loại:** cấu hình ngầm

Trang `/admin` chỉ hoạt động khi biến môi trường `ADMIN_USER_IDS` chứa user id
(UUID Supabase, phân cách bằng dấu phẩy). Không đặt → không ai là admin →
`/admin` trả 404. Fail-closed là chủ đích, nhưng nghĩa là:
- Dự án KHÔNG có file `.env.example`, nên biến này không được ghi ở đâu ngoài
  đây và trong `lib/auth/admin.ts`.
- Đổi môi trường (máy mới, deploy mới) mà quên → công cụ gỡ nội dung im lặng
  biến mất, và chỉ phát hiện ra đúng lúc cần gỡ gấp.

**Cách trả:** thêm `.env.example` liệt kê đủ biến bắt buộc
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ADMIN_USER_IDS`), và một check
lúc khởi động cảnh báo khi thiếu.

### TD-007 — `npm audit` còn 3 high, KHÔNG được "sửa" bằng `npm audit fix --force`
**Từ:** 2026-08-03 (bản vá Security review High #3)
**Loại:** cảnh báo còn sót, đã đánh giá là không với tới được

Sau khi nâng `next` 16.2.7→16.2.12 và `sharp` 0.34.5→0.35.3, `npm audit` vẫn báo
3 high. Chúng nằm ở BẢN LỒNG bên trong `next`, không phải bản top-level:

```
next/node_modules/sharp    0.34.5   (libvips CVEs)
next/node_modules/postcss  8.4.31   (XSS </style>, đọc file qua sourceMappingURL)
```

⚠ **Đừng chạy `npm audit fix --force` lần nữa.** npm hiện đề xuất "fix" bằng cách
hạ `next` xuống **9.3.3** — phá nát dự án để làm sạch một cảnh báo.

**Vì sao chấp nhận được (đã kiểm 2026-08-03, không phải phỏng đoán):**
- `sharp` mà CODE CỦA DỰ ÁN dùng (`lib/ugc/cropImages.ts` — đường duy nhất xử lý
  file người dùng tải lên) resolve về **top-level 0.35.3, đã vá**. Xác nhận bằng
  `require.resolve('sharp')`.
- Bản `sharp` lồng trong next chỉ phục vụ image optimizer của `next/image`. Toàn
  bộ `next/image` trong repo chỉ nạp 2 file tĩnh của chính dự án
  (`/images/brand_logo.png`, `/images/user-avatar-placeholder.png`), và
  `next.config.ts` KHÔNG cấu hình `images.remotePatterns` → next/image từ chối
  mọi URL từ xa. Ảnh đề do người dùng tải lên đi bằng `<img>` thường trong
  `QuestionFigure` (có allowlist origin), KHÔNG qua optimizer.
- `postcss` chỉ chạy lúc BUILD trên CSS do lập trình viên viết, không nhận đầu
  vào từ người dùng.

**Cách trả:** chờ next phát hành bản nâng 2 dependency lồng đó, rồi nâng `next`
là hết. Kiểm lại bằng `npm audit` + `require.resolve('sharp')`.

### TD-006 — CSP còn `'unsafe-inline'` cho script (chưa làm nonce)
**Từ:** 2026-08-03 (bản vá Security review Medium #5, `SOURCE/next.config.ts`)
**Loại:** phòng thủ chưa đầy đủ

`script-src` phải giữ `'unsafe-inline'` vì Next.js chèn script inline để hydrate;
chặn mà không có nonce là trang trắng. Nghĩa là CSP hiện tại KHÔNG chặn được
inline-XSS — nó chỉ chặn script từ domain lạ, clickjacking, `<base>` hijack,
form bẻ hướng, và plugin embed.

**Vì sao chấp nhận được (hiện tại):** rủi ro mà review lo — "XSS = chiếm tài
khoản" — đã đóng ở NGUỒN chứ không nhờ CSP: cookie session nay là `httpOnly`
(`lib/supabase/cookieOptions.ts`), đã kiểm thực tế trên trình duyệt
`document.cookie === ""` khi đang đăng nhập. Cộng thêm: không có
`dangerouslySetInnerHTML` nào trong repo, và RichText đã sanitize.

**Cách trả:** proxy.ts sinh nonce mỗi request, set vào cả request header lẫn
response header để Next gắn nonce cho script của nó, rồi bỏ `'unsafe-inline'`.
Phải kiểm lại bằng trình duyệt thật (build + `next start` + xem console) vì sai
một bước là trang trắng toàn site.

### TD-005 — `schema.sql` áp bằng tay, không có migration tool
**Từ:** trước 2026-08-03 (nợ cũ, ghi lại cho rõ)
**Loại:** vận hành
**Trạng thái:** đã có cách PHÁT HIỆN lệch (2026-08-03), chưa có cách QUẢN LÝ

`schema.sql` idempotent và được paste tay vào Supabase SQL Editor. Không có bản
ghi "môi trường nào đang ở phiên bản nào", không có thứ tự áp, không rollback.

**Sẽ nổ thế nào:** một bản vá bảo mật nằm trong git mà chưa hề chạy trên prod —
code và DB lệch nhau, không có gì báo. Đúng chuyện đã xảy ra với bản vá §10: code
đã chuyển sang RPC trong khi DB còn chưa có hàm.

**Đã giảm nhẹ:** `npm run verify:schema` (`SOURCE/supabase/verify-schema.ts`) so
schema.sql với hành vi thật của DB cho phần khoá đáp án (§10) và khoá ghi điểm
(§11), fail kèm chỉ dẫn. Nó soi MÃ LỖI chứ không chỉ "có lỗi hay không" — vd
`23503` (vướng khoá ngoại, quyền INSERT vẫn còn) không được tính là đã vá, chỉ
`42501` mới tính. Chạy sau mỗi lần apply schema.sql và trước khi deploy.

**Còn thiếu:** script chỉ phủ §10/§11, và vẫn phải nhớ chạy nó. Trả nợ thật =
Supabase CLI migrations, hoặc tối thiểu bảng `schema_version` + check lúc khởi
động ứng dụng.

**Đã tái phát 2026-08-03 (lần 2):** §12a dùng `drop function` cho
`exam_rating_aggregate()`, nhưng view `exams_with_difficulty` phụ thuộc nó → lần
chạy thứ hai chết với `2BP01: cannot drop function ... because other objects
depend on it`. Đã sửa sang `create or replace`. Hai lần vấp cùng một chỗ trong
một ngày: **không có cách nào biết schema.sql còn chạy lại được, ngoài việc
THỰC SỰ chạy lại nó trên DB có dữ liệu thật.**

**Hệ quả kèm theo — tính idempotent của schema.sql không ai kiểm chứng.** File tự
khai "chạy lại nhiều lần không lỗi" ở header, nhưng vì không ai chạy lại nó bao
giờ, lời khai đó mục lúc nào không hay. Ngày 2026-08-03 phát hiện §2 add
`questions_type_check` bản HẸP (`mcq`/`essay`) trong khi §8c nới ra 4 giá trị:
mọi DB đã có dữ liệu v2.1 sẽ chết ở §2 với `23514`, và §8c không bao giờ chạy
tới. Đã sửa (§2 nhường quyền sở hữu constraint cho §8c), nhưng cùng kiểu mục nát
đó sẽ tái diễn ở mỗi "narrow rồi widen" tiếp theo. Chỉ có migration thật, hoặc
một lần chạy lại toàn file trên DB có dữ liệu đại diện, mới phát hiện được.

---

## Đã trả

### ~~TD-001 — Quyền cột trên `questions` không tự áp cho cột mới~~
Postgres không tự cấp cột mới cho column-level GRANT, nên thêm cột vào
`questions` sẽ gây `42501` ở production dưới dạng trang trắng — mà chỉ ở môi
trường có RLS thật, test mock vẫn xanh.
**Đã trả 2026-08-03** — `verify-schema.ts` lấy danh sách cột THẬT từ DB (không
hard-code) rồi đối chiếu với `grant select (...)` §10c và `returns table` §10a.
Cột mới chưa phân loại làm script fail kèm đúng câu phải sửa ở đâu. Bẫy vẫn còn
trong Postgres, nhưng nay nó kêu to thay vì im lặng.

### ~~RLS lọc dòng chứ không lọc cột — đáp án lộ qua REST API~~
Ghi nhận trong PROCESS.md (~dòng 3511) khi `security-reviewer` phát hiện; nâng
lên Critical #1 trong `docs/security-review-2026-08-03.md`.
**Đã vá 2026-08-03** — `schema.sql` §10 (quyền cột + 2 hàm SECURITY DEFINER),
gate hồi quy R-v…R-z2 trong `SOURCE/supabase/test-rls.ts`.

---

## Đã loại khỏi sổ (không phải nợ)

- **Chuỗi "claim → bịa điểm" phụ thuộc Critical #2** — không phải nợ kỹ thuật mà
  là một lỗi bảo mật đang mở, đã theo dõi ở `docs/security-review-2026-08-03.md`
  mục Critical #2 (ghi chú về tương tác đã chuyển sang đó). Hai chỗ theo dõi cùng
  một việc thì chỗ nào cũng sẽ bị bỏ quên.
- **`getResult` lấy đáp án theo đề thay vì theo `per_question`** — không có
  đường nào trong code hiện tại làm hai tập này lệch nhau (`extractAndAssemble`
  xoá hẳn row cũ khi ráp lại đề), và dư câu thì UI bỏ qua vì tra cứu theo
  `questionId`. Ghi lại một lệch pha không chạm tới được chỉ làm loãng sổ.
- **`perf-layers.ts` chép query thay vì import** — đã được cảnh báo bằng khối
  chữ ⚠ ngay đầu chính file đó, đúng nơi người sửa sẽ đọc. Chép sang đây không
  làm ai đọc nó sớm hơn.
