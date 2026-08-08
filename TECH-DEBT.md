# Technical Debt Register

Sổ ghi nợ kỹ thuật — CHỈ dùng để ghi nhận nợ, không phải nơi thiết kế giải pháp.
Mỗi mục: nó là gì, tại sao chấp nhận, và cái gì sẽ nổ nếu quên.

Không ghi vào đây: lỗi bảo mật đang mở (thuộc `docs/security-review-*.md`), cảnh
báo đã tự viết trong header của chính file code, và những lệch pha không có
đường nào chạm tới được trong thực tế. Ghi mục mới lên ĐẦU phần "Đang mở"; khi
trả nợ thì CHUYỂN mục đó xuống "Đã trả" (không xoá — bối cảnh của một món nợ đã
trả vẫn có giá trị tra cứu sau này) kèm ngày trả và cách verify.

*(Trước 2026-08-07, quy trình này ghi "xoá mục khi đã trả nợ, ghi lại trong
PROCESS.md" — file đó đã bị xoá. Tiến độ theo phiên nay ghi ở Notion (database
MS-MOLAR), còn sổ nợ này CHỈ ghi nội dung nợ như tiêu đề file đã nói — không
còn nơi nào khác giữ lịch sử nợ ngoài chính file này.)*

---

## Đang mở

### TD-016 — 10 câu hỏi mang `questions.subject = 'Toán'` thay vì canonical `'Math'`
**Từ:** 2026-08-08 (phát hiện khi đếm dữ liệu thật cho Engine 1 — `requirement-analyzer`
cần biết corpus môn Toán lớn cỡ nào, không phải đi tìm bug)
**Loại:** dữ liệu bẩn, im lặng

Đếm trực tiếp trên DB **dev** (`service_role`, không phải suy đoán từ code):
57 câu hỏi tổng, `subject = 'Math'` có 37, và **10 câu mang `subject = 'Toán'`** —
giá trị không nằm trong `SUBJECTS` (`lib/ugc/subjects.ts`). `normalizeSubject()`
lẽ ra chặn được việc này ở đường UGC (map "Toán" → canonical `"Math"` qua bảng
`ALIASES`), nhưng 10 câu này đã lọt — khả năng cao đến từ `seed.ts` hoặc một
đường ghi tay không đi qua `normalizeSubject`, chưa xác minh đường nào.

**Sẽ nổ thế nào:** mọi filter theo môn ("Toán") trên `/exams`, mọi thống kê
theo `subject`, và giờ cả taxonomy kỹ năng Engine 1 (tagging chỉ nhắm
`subject = 'Math'`) đều **âm thầm bỏ sót 10 câu này** — không lỗi, không log,
chỉ thiếu. Không ai thấy vì kết quả vẫn "đúng dạng", chỉ thiếu vài dòng.

**Cách trả:** một script one-off `update questions set subject = 'Math' where
subject = 'Toán'` (paste tay qua Supabase SQL Editor như mọi DDL khác — xem
TD-005), sau đó tìm đường ghi đã tạo ra 10 dòng này và bọc nó bằng
`normalizeSubject`/`isSubject` để không tái diễn. Ngoài phạm vi Engine 1 Sprint 1
— ghi lại để không quên, không phải để làm ngay trong nhánh này.

### TD-013 — Không có rate limit nào cho lưu lượng CHƯA đăng nhập
**Từ:** 2026-08-07 (tách ra khi trả TD-008; trước đó nằm lẫn trong mục đó)
**Loại:** phòng thủ còn thiếu hẳn một mảng, có vật cản cụ thể

TD-008 đã trả xong phần "trần chính xác theo user across-instance". Phần này là
mảng còn lại, và nó KHÔNG phải cùng một bài toán: mọi guard hiện có đều khoá
theo `user.id`, nên **một client chưa đăng nhập không bị đếm bởi bất cứ thứ gì.**
Redis không sửa được — không có khoá để đếm.

**Vật cản, đo 2026-08-07:** project `ms-molar` ở plan **Hobby**.
`vercel firewall overview` trả `IP Bypass is unavailable for this plan (404)`;
Firewall custom rules + rate limit ở biên cần **Pro** (~$20/tháng). Đây là nợ
chặn bởi QUYẾT ĐỊNH CHI PHÍ, không phải bởi việc chưa ai viết code — đừng đi tìm
cách lách bằng code ứng dụng, vì mọi thứ chạy trong function thì đã tốn tiền và
tốn thời gian trước khi kịp từ chối.

**Sẽ nổ thế nào:** không phải lỗi sai kết quả mà là hoá đơn và thời gian chết —
một vòng lặp nện `/exams` hay `/login` sẽ đốt invocation cho tới khi hết hạn mức
Hobby, rồi site tắt. Mức độ hiện tại thấp vì site chưa có ai chú ý tới; nó tăng
đúng lúc site bắt đầu có người dùng, tức là đúng lúc tệ nhất.

**Cách trả:** nâng Pro rồi cấu hình Vercel Firewall rate limit (config, không
phải code), hoặc đặt site sau Cloudflare free tier — cái sau không tốn tiền
nhưng đổi DNS và thêm một tầng vào đường đi.

### TD-014 — `ADMIN_USER_IDS` mất scope Preview trên Vercel
**Từ:** 2026-08-04 (S#46), phát hiện lại và XÁC NHẬN CÒN SỐNG 2026-08-07
**Loại:** vận hành, cấu hình

`vercel env ls` (2026-08-07): `ADMIN_USER_IDS` chỉ còn scope **Production**.
Nguyên nhân đã biết từ S#46: `vercel env rm` gỡ biến khỏi **mọi** scope chứ
không chỉ scope được chỉ định — một lần `rm` rồi `add` lại vô tình làm mất
Preview. Hệ quả: `/admin` trên **mọi** Preview deploy (mọi feature branch) luôn
404 cho tất cả mọi người, kể cả tài khoản đúng quyền — không phân biệt được với
đăng nhập nhầm tài khoản (đúng hình dạng lỗi mà TD-009 mô tả: fail-closed im
lặng).

**Vì sao chưa vá ngay:** không chặn được gì hôm nay — không ai đang cần test
`/admin` trên Preview. Nhưng đây là bẫy cho người TIẾP THEO: họ sẽ thấy 404 và
tưởng mình đăng nhập sai tài khoản, mất thời gian debug nhầm hướng trước khi
nghĩ tới env scope.

**Cách trả:** thêm lại `ADMIN_USER_IDS` cho scope Preview, dùng UUID của tài
khoản admin trên project Supabase **dev** (Preview trỏ dev, không phải prod —
xem TD-005/DEPLOYMENT.md). Sau đó test bằng cách mở một Preview deploy bất kỳ
và xác nhận `/admin` vào được với tài khoản đó.

### TD-015 — `eslint-config-next` lệch phiên bản với `next`
**Từ:** 2026-08-04 (ghi nhận lần đầu trong PROCESS.md, chưa từng vào sổ)
**Loại:** phụ thuộc, im lặng

`package.json` ghim `eslint-config-next@16.2.7` trong khi `next` đã lên
`16.3.0` (xác nhận qua `package-lock.json`, và `eslint-config-next@16.3.0` đã
có sẵn trên npm — không phải chờ bản phát hành). Không ai cố ý để lệch: TD-007
(2026-08-04) nâng `next` bằng `npm audit fix`, việc đó không đụng
`eslint-config-next` vì nó không nằm trong đường phụ thuộc bị advisory.

**Vì sao chưa nổ:** `npm run lint` (`--max-warnings 0`, chặn CI từ khi TD-010
đóng) vẫn chạy sạch — bản 16.2.7 chưa flag sai hay bỏ sót gì quan sát được.

**Vì sao vẫn ghi lại:** một bộ rule ESLint đặc thù Next.js đi sau chính bản
Next đang chạy có thể bỏ sót cảnh báo cho pattern MỚI của 16.3.0, hoặc lỗi thời
với pattern đã đổi — và vì lint là cổng CHẶN merge (TD-010), một khoảng hở ở
đây là khoảng hở im lặng trên chính cổng được kỳ vọng bắt lỗi. Độ trễ càng lâu,
khoảng cách phiên bản càng doãng.

**Cách trả:** `npm install -D eslint-config-next@16.3.0` rồi chạy đủ 4 cổng
verify. Rủi ro thấp (chỉ nâng đúng 1 minor version, khớp `next` đang chạy) —
việc trì hoãn trước đó (ghi trong PROCESS.md) là do mạng không ổn định lúc đó,
không phải rủi ro kỹ thuật.

### TD-005 — `schema.sql` áp bằng tay, không có migration tool
**Từ:** trước 2026-08-03 (nợ cũ, ghi lại cho rõ)
**Loại:** vận hành
**Trạng thái:** **đã trả PHẦN PHÁT HIỆN (2026-08-07)** — phần QUẢN LÝ vẫn nguyên

> **Cập nhật 2026-08-07 — nợ này đã nổ thật, lần thứ ba.** Bản vá cascade
> 2026-08-04 (bug xoá đề) chỉ được áp lên **prod**. Trên **dev**,
> `exam_attempts.exam_id` và `attempt_answers.question_id` vẫn là `no action`
> suốt 3 ngày: Preview deploy (trỏ dev) vẫn chết `23503` khi xoá đề, trong khi
> tsc, vitest, `next build` và CI đều xanh. Không cổng nào biết hỏi câu "DB này
> đang ở bản nào". Cùng lúc phát hiện §16 **chưa từng được apply lên bất kỳ DB
> nào** — cảnh báo ⚠ cũ ở mục này là đúng, không phải đã cũ.
>
> **Đã trả phần phát hiện:** `schema.sql` §17 tạo `public.schema_version` và tự
> ghi VÂN TAY của chính nó vào đó ở câu lệnh CUỐI CÙNG của file (paste đứt giữa
> chừng thì không ghi gì — DB thà không biết còn hơn khai nhận một bản nó chưa
> chạy hết). Ba cổng đọc vân tay đó:
> - `lib/schema/__tests__/schemaFingerprint.test.ts` — so ba bên (hằng số TS ↔
>   giá trị §17 khai ↔ giá trị tính lại từ nội dung). Chạy trong CI, không cần
>   DB, không cần credential. Sửa schema.sql mà quên cập nhật vân tay → FAIL kèm
>   đúng giá trị phải dán vào.
> - `verify:schema` mục 7 — so với DB THẬT.
> - `instrumentation.ts` → `lib/schema/checkSchemaVersion.ts` — chạy lúc server
>   khởi động. Phân biệt `mismatch` với `unknown` (mất mạng ≠ lệch bản): gộp hai
>   cái là cách nhanh nhất giết một cổng bằng báo động giả. Fail-open, không
>   throw — cùng quyết định với TD-009.
>
> Vân tay băm phần THỰC THI (bỏ comment, gộp khoảng trắng), có chủ đích: file
> này viết rất nhiều comment giải thích, nếu mỗi dòng chữ thêm vào lại đòi paste
> lại 2 DB thì cổng sẽ bị tắt đi vì nhiễu. Đổi một chữ trong `on delete`, hay
> một dòng trong thân hàm `$$...$$`, thì vân tay đổi.
>
> Là VÂN TAY chứ không phải số phiên bản người tự tăng, vì số tự tăng vẫn quên
> được — mà quên chính là hình dạng của nợ này.
>
> **Đã áp và xác minh 2026-08-07:** dev + prod cùng ở `bbe1ee9326c9`. `verify:schema`
> trên dev xanh cả 7 mục. Kèm theo: bỏ bước swap file `.env` bằng tay khi kiểm
> prod — `verify-schema.ts` nay nhận `SCHEMA_ENV_FILE`.
>
> **VÌ SAO MỤC NÀY CHƯA XOÁ:** cái vừa dựng là cơ chế **phát hiện** lệch, KHÔNG
> phải migration tool. Không có thứ tự áp, không rollback, không biết đi từ bản A
> sang bản B. Nó trả lời đúng một câu — "DB này có chạy đúng file trong git
> không?" — và im lặng về mọi câu khác. Trả nợ trọn vẹn vẫn là Supabase CLI
> migrations (cần DB password của cả 2 project).

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
*(Vế thứ hai đã làm 2026-08-07 — xem khối ở đầu mục. Vế "phải NHỚ chạy" nay do
test CI và check khởi động gánh; vế Supabase CLI vẫn còn nguyên.)*

**Phủ rộng thêm 2026-08-04 (TD-011):** script nay còn so `on delete` của TOÀN BỘ
khoá ngoại với schema.sql, qua RPC chỉ-đọc `public.schema_foreign_keys()` (§16a).
Đối chiếu hai chiều — khai-mà-DB-không-có, và DB-có-mà-không-khai.

~~⚠ **§16 CHƯA ĐƯỢC APPLY lên DB nào**~~ — **đã áp 2026-08-07 lên cả dev lẫn
prod.** Cảnh báo này đứng nguyên 3 ngày và nó ĐÚNG suốt 3 ngày đó: `verify:schema`
thật sự FAIL với `PGRST202`, và không ai thấy vì không ai chạy. Ghi lại vì nó là
bằng chứng cho chính TD-005 — một cảnh báo viết đúng, đặt đúng chỗ, vẫn không cứu
được gì khi việc chạy nó phụ thuộc vào trí nhớ người.

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

### ~~TD-008 — Rate limit nằm trong RAM tiến trình, không dùng chung giữa instance~~
`lib/security/rateLimit.ts` đếm trong RAM của tiến trình đang chạy: nhiều
instance → trần thực tế = limit × số instance; cold start → bộ đếm về 0. Đánh
giá 2026-08-03 là "chấp nhận được, vì thêm round-trip vào đường người dùng đang
chờ là đánh đổi tệ cho một guard mức Low".

**Đã trả 2026-08-07** — bộ đếm có thẩm quyền chuyển sang **Upstash for Redis**
(Vercel Marketplace, gói free, region `sin1`, `autoUpgrade=false` để không âm
thầm nhảy sang gói trả phí). `lib/security/rateLimitStore.ts`.

Ba chi tiết đáng giữ lại, vì mỗi cái đều là một chỗ dễ làm sai:

- **Vì sao Redis chứ không phải một bảng Postgres — lý do là ĐỊA LÝ.** Functions
  chạy ở `sin1` (Singapore, `vercel.json`); Supabase prod ở `ap-south-1`
  (Mumbai). Bộ đếm trên Postgres = ~50–60ms xuyên vùng mỗi lần gọi guard. Upstash
  provision tại Singapore = cùng vùng với function. Đánh giá cũ ("đừng thêm
  round-trip") đúng ở mức nguyên tắc và sai ở mức số liệu: **round-trip không có
  một giá cố định, nó phụ thuộc bạn đặt cái gì ở đâu.**
- **MỘT lượt mạng, không phải bốn.** Cửa sổ trượt cần dọn hạn + đếm + đọc mốc cũ
  nhất + ghi mốc mới. Làm bằng 4 lệnh rời thì vừa tốn 4 lượt vừa KHÔNG nguyên tử
  (hai request song song cùng đọc `count = limit-1` rồi cùng ghi). Gói vào một
  script Lua thì Redis chạy trọn gói.
- **Redis hỏng → tụt về lớp RAM, KHÔNG mở cổng.** Nuốt lỗi thành "ok" sẽ biến
  một sự cố Upstash thành việc lặng lẽ gỡ bỏ guard — không ai biết cho tới khi
  có người lợi dụng. Kèm một dòng `console.warn`: chạy dài ngày với Redis chết mà
  im lặng thì nợ quay lại y như cũ, chỉ khác là nay có một file bảo rằng đã trả.
  Lớp RAM còn giữ vai thứ hai: chặn sớm, để một vòng lặp đang nện không tốn lượt
  Redis nào.

Kiểm bằng Redis THẬT (không phải mock): trần 3/60s → 3 lượt đầu qua, lượt 4 trả
`{ok:false, retryAfterSeconds:60}`. Thiếu `KV_REST_API_*` thì hành vi lùi về
đúng bản trước 2026-08-07 — 11 test mới ghim cả nhánh đó.

**Phần KHÔNG trả được, đã tách thành TD-013:** khoá là user id nên client CHƯA
đăng nhập vẫn không bị đếm bởi bất cứ thứ gì. Redis không sửa được cái đó, và
tầng biên thì bị khoá sau plan Pro của Vercel.

### ~~TD-012 — Xoá tài khoản `auth.users` sẽ bị chặn, nếu sau này làm tính năng đó~~
`exams.author_id` và `exam_moderation_log.actor_id` là hai khoá ngoại duy nhất
trỏ `auth.users` mà không cascade; `no action` nghĩa là xoá một tài khoản đã đăng
đề hoặc đã từng bấm gỡ/khôi phục đề sẽ chết `23503` — **đúng hình dạng bug
2026-08-04 nhưng ở tầng tài khoản.** Mục này từng được xếp "chưa chạm tới được,
để ngày làm tính năng xoá tài khoản hẵng đổi".

**Đã trả 2026-08-07** — đổi cả hai sang `on delete set null` (§16b), sớm hơn dự
tính, vì lý do xếp nó là "để sau" không đứng vững khi soi lại: `no action`
KHÔNG mua được gì ở hiện tại (app không có đường xoá tài khoản — đã grep
`deleteUser`/`admin.deleteUser`), nó chỉ hẹn giờ một lần `23503` cho người viết
tính năng đó. `set null` ở hiện tại cũng không đổi hành vi gì, vì không có lệnh
xoá nào chạm tới. **Hai lựa chọn cùng giá hôm nay; một cái đúng sẵn ngày mai** —
và cái giá của việc chọn sai chỉ hiện ra khi đã quên mất là mình có chọn.

KHÔNG cascade, và lý do phải nằm lại đây vì cascade là thứ người ta sẽ thử đầu
tiên: đề sống sót qua tác giả nhờ snapshot `author_display_name` (ADR-0003), nên
cascade sẽ xoá đề CÔNG KHAI của người khác đang làm dở; còn với nhật ký kiểm
toán, cascade biến "xoá tài khoản" thành "xoá luôn dấu vết mình đã làm gì".
`set null` giữ DÒNG nhật ký và chỉ bỏ danh tính actor.

Đã áp lên **cả dev lẫn prod** 2026-08-07 (`confdeltype = 'n'` trên cả hai). Test
hồi quy của TD-011 ghim giá trị CHÍNH XÁC chứ không chỉ "khác cascade" — hai giá
trị sai theo hai kiểu khác nhau, và nó đã FAIL đúng lúc §16b đổi.

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
Phát hiện lần đầu 2026-08-02 khi `security-reviewer` rà một feature khác (auto-
chấm `short_answer`) và thấy `essay_answer` lộ được qua REST API cùng nhóm với
`correct_answer`/`sub_answers` đã hở từ MVP; nâng lên Critical #1 trong
`docs/security-review-2026-08-03.md`.
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
