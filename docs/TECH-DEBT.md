# Technical Debt Register

Sổ ghi nợ kỹ thuật — CHỈ dùng để ghi nhận nợ, không phải nơi thiết kế giải pháp.
Mỗi mục: nó là gì, tại sao chấp nhận, và cái gì sẽ nổ nếu quên.

Không ghi vào đây: lỗi bảo mật đang mở (thuộc `docs/security-review-*.md`), cảnh
báo đã tự viết trong header của chính file code, và những lệch pha không có
đường nào chạm tới được trong thực tế. Ghi mục mới lên ĐẦU phần "Đang mở"; xoá
mục khi đã trả nợ (ghi lại trong PROCESS.md).

---

## Đang mở

### TD-012 — Xoá tài khoản `auth.users` sẽ bị chặn, nếu sau này làm tính năng đó
**Từ:** 2026-08-04 (lộ ra khi dựng cổng khoá ngoại của TD-011)
**Loại:** ràng buộc đã biết, chưa chạm tới được

`exams.author_id` và `exam_moderation_log.actor_id` là hai khoá ngoại duy nhất
trỏ `auth.users` mà KHÔNG cascade. §16b nay ghi rõ `on delete no action` (trước
đó là mặc định ngầm, tức là cùng hành vi nhưng không ai chọn nó cả). Hệ quả:
xoá một tài khoản đã đăng đề hoặc đã từng bấm gỡ/khôi phục đề sẽ chết với
`23503` — **đúng hình dạng bug 2026-08-04 nhưng ở tầng tài khoản.**

**Vì sao chưa phải nợ phải trả ngay:** không có đường nào trong app xoá tài
khoản (đã grep: không có `deleteUser`/`admin.deleteUser`). Chỉ chạm tới được
bằng cách xoá tay trên Supabase dashboard.

**Vì sao vẫn ghi lại:** ngày làm tính năng "xoá tài khoản của tôi", nó sẽ hỏng
ngay lần thử đầu, và người sửa cần biết cascade KHÔNG phải câu trả lời — cascade
sẽ cuốn theo đề công khai của người khác đang làm và toàn bộ nhật ký kiểm toán.
Đáp án đúng là `set null` (cả hai cột đều nullable; ADR-0003 snapshot
`author_display_name` chính là để đề sống sót qua tác giả).

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

**Còn thiếu:** vẫn phải NHỚ chạy nó. Trả nợ thật = Supabase CLI migrations, hoặc
tối thiểu bảng `schema_version` + check lúc khởi động ứng dụng.

**Phủ rộng thêm 2026-08-04 (TD-011):** script nay còn so `on delete` của TOÀN BỘ
khoá ngoại với schema.sql, qua RPC chỉ-đọc `public.schema_foreign_keys()` (§16a).
Đối chiếu hai chiều — khai-mà-DB-không-có, và DB-có-mà-không-khai.

⚠ **§16 CHƯA ĐƯỢC APPLY lên DB nào** (phiên 2026-08-04 không có quyền chạy SQL).
Cho tới khi paste `schema.sql` vào SQL Editor, `npm run verify:schema` sẽ FAIL ở
bước khoá ngoại với `PGRST202` — đó là hành vi đúng, không phải lỗi script.

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

### ~~TD-011 — `verify-schema.ts` không soi được `on delete` của khoá ngoại~~
Bug xoá đề 2026-08-04 (`exam_attempts.exam_id` + `attempt_answers.question_id`
thiếu `on delete cascade`) đi lọt qua MỌI cổng: tsc xanh, vitest xanh,
`verify:schema` xanh. Lý do: PostgREST không phơi `information_schema`, và cách
duy nhất suy ra `on delete` từ client là thật sự xoá một dòng cha — vi phạm
nguyên tắc chỉ-đọc làm script an toàn trên production.

**Đã trả 2026-08-04** — đóng ở HAI tầng, cố ý:
- **Tầng văn bản (không cần DB, chạy trong CI):**
  `lib/schema/parseForeignKeys.ts` đọc mọi khoá ngoại khai trong schema.sql;
  `lib/schema/__tests__/parseForeignKeys.test.ts` FAIL nếu có khoá ngoại nào
  không viết `on delete`. Đây là chỗ rẻ nhất để bắt — nó nổ lúc mở PR, trước khi
  SQL kịp chạy ở đâu. Quy ước mới: mọi `references` phải khai `on delete`, kể cả
  khi hành vi mong muốn đúng bằng mặc định.
- **Tầng DB:** §16a mở RPC chỉ-đọc `public.schema_foreign_keys()` (EXECUTE chỉ
  `service_role`); `verify-schema.ts` mục 6 so hai chiều với schema.sql và kiểm
  riêng chuỗi xoá đề trên DB THẬT — file đúng mà DB chưa apply thì bug vẫn sống,
  đó đúng là chuyện đã xảy ra.

Lỗ hổng của parser KHÔNG im lặng: khoá ngoại parser bỏ sót sẽ hiện ra ở chiều
"DB có mà schema.sql không khai" và làm script FAIL.
⚠ Còn một bước tay: **§16 phải được apply lên DB** thì tầng thứ hai mới sống.

### ~~TD-010 — 2 lỗi `react-hooks` trong source, nên bước lint ở CI không chặn được~~
`continue-on-error: true` ở bước ESLint nghĩa là lỗi lint MỚI lẫn vào giữa 2 lỗi
cũ mà không ai thấy.
**Đã trả 2026-08-04** — sửa cả hai bằng cách đổi cấu trúc, KHÔNG bằng
`eslint-disable`:
- `ExamTimer` → `useEffectEvent` thay latest-ref-ghi-trong-render. Ghi ref lúc
  render không an toàn với concurrent rendering; `useEffectEvent` cho đúng hai
  tính chất cần (thấy props mới nhất, không là dependency).
- `SuccessToast` → hiện/ẩn là giá trị DẪN XUẤT lúc render; state chỉ còn lưu
  "trigger nào đã hết hạn" và chỉ được set trong callback của `setTimeout`.
- Cảnh báo `<img>` cố ý của `AttemptPdfTemplate` tắt TẠI CHỖ kèm lý do, để
  `--max-warnings 0` bắt được cảnh báo mới.

Kèm 15 test hồi quy mới (`ExamTimer.test.tsx`, `SuccessToast.test.tsx`) — trước
đó cả hai component không có test nào, dù một cái nằm trên đường auto-submit.
`npm run lint` nay là `eslint --max-warnings 0` và bước ESLint trong CI đã bỏ
`continue-on-error` → lint CHẶN merge.

### ~~TD-009 — `ADMIN_USER_IDS` là cấu hình bắt buộc, không có ở đâu ngoài env~~
Mọi biến env của dự án fail-closed một cách IM LẶNG: quên `ADMIN_USER_IDS` thì
`/admin` trả 404 y hệt như khi đăng nhập nhầm tài khoản.
**Đã trả 2026-08-04** — nửa đầu là `.env.example` (đã có); nửa sau là
`instrumentation.ts` → `lib/env/checkEnv.ts`, chạy MỘT LẦN lúc server khởi động.
Phân biệt `error` (biến bắt buộc) với `warn` (mảng chức năng lặng lẽ tắt), và
bắt cả hai kiểu hỏng ngầm mà `.env.example` không bắt được: id không phải UUID
trong `ADMIN_USER_IDS` (không bao giờ khớp, không phân biệt được với "chưa cấu
hình"), và `NEXT_PUBLIC_SUPABASE_URL` sai định dạng (`next.config.ts` nuốt lỗi
parse → CSP rụng origin Supabase → ảnh đề biến mất). CỐ Ý không throw: một deploy
thiếu `GEMINI_API_KEY` mà làm sập trang chủ là đổi hỏng hóc cục bộ lấy sự cố toàn
site. Đã kiểm bằng `next start` thật với env cố tình sai.

### ~~TD-007 — `npm audit` còn 3 high trong bản lồng của `next`~~
Đánh giá 2026-08-03 là "không với tới được, chờ next phát hành bản nâng".
**Đã trả 2026-08-04** — bản đó đã có: `next` 16.3.0 nằm NGOÀI dải advisory
(`... - 16.3.0-preview.10`) và bỏ hẳn `next/node_modules/{sharp,postcss}`.
`npm audit fix` (KHÔNG `--force`) nâng next 16.2.12→16.3.0, postcss
8.5.19→8.5.23, undici 7.28.0→7.29.0, ip-address 10.2.0→10.4.0 → **0
vulnerabilities**. Kiểm sau khi nâng: tsc, lint, 396 test, `next build`,
`check:bundle`, và trình duyệt thật — tất cả xanh.

Ghi lại vì đánh giá cũ đã MỤC mà không ai biết: tới 2026-08-04, advisory postcss
nới lên `<=8.5.22`, tức bản TOP-LEVEL (8.5.19) cũng đã dính — câu "chúng chỉ nằm
ở bản lồng" đúng lúc viết và sai 1 ngày sau. Một đánh giá "chấp nhận được" có
hạn sử dụng; phải soi lại chứ không đọc lại.

⚠ Cảnh báo cũ vẫn giữ nguyên giá trị: **đừng chạy `npm audit fix --force`** — nó
từng đề xuất hạ `next` xuống 9.3.3.

### ~~TD-006 — CSP còn `'unsafe-inline'` cho script (chưa làm nonce)~~
CSP cũ KHÔNG chặn được inline-XSS; nó chỉ chặn script từ domain lạ, clickjacking,
`<base>` hijack, form bẻ hướng và plugin embed.
**Đã trả 2026-08-04** — `lib/security/csp.ts` là nguồn chân lý duy nhất;
`proxy.ts` sinh nonce 128-bit mỗi request, đặt CSP có nonce lên **request**
header (Next đọc header này để gắn `nonce=` vào script của nó) rồi đặt cùng chuỗi
đó lên response.
- `next.config.ts` giữ chính sách NỀN có `'unsafe-inline'`, nhưng chỉ còn hiệu
  lực ở path proxy.ts không chạy qua (`_next/static`, ảnh, `robots.txt`) — nơi
  không có script inline nào để bảo vệ. Giữ lại làm lưới an toàn: middleware
  không chạy → CSP yếu hơn, chứ KHÔNG phải trang trắng.
- KHÔNG dùng `'strict-dynamic'`: nó làm trình duyệt bỏ qua `'self'`, đổi lấy
  gần như không gì ở dự án không có script bên thứ ba.
- Dev vẫn `'unsafe-inline'`: Turbopack/HMR chèn script inline không qua đường
  gắn nonce của Next.

Đã kiểm trên bản production build + trình duyệt thật: đúng MỘT header CSP (đè
được nền), nonce khác nhau từng request, 17/17 thẻ script mang đúng nonce của
header, trang hydrate (điều hướng client-side chạy), 0 lỗi CSP trong console,
response 307 của route guard cũng mang CSP, `/robots.txt` giữ chính sách nền, và
`next dev` không hỏng.

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
