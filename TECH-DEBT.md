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

> **2026-08-31 — phiên trả nợ diện rộng.** TD-013, TD-028, TD-030, TD-031 và
> TD-032 đã CHUYỂN xuống "Đã trả". Phần "Đang mở" nay còn ĐÚNG HAI mục, và cả
> hai còn mở vì một lý do KHÔNG phải là công sức viết mã — một cái thiếu credential,
> một cái đã quyết định là chấp nhận trả giá.
>
> - **TD-005** — bị chặn bởi một CREDENTIAL (DB password của cả hai project).
>   Engineer đã được hỏi thẳng một lần (2026-08-27) và chọn "để mở". Phiên
>   2026-08-31 KHÔNG hỏi lại, mà trả phần trả được mà không cần credential —
>   xem khối cập nhật trong mục.
> - **TD-029** — QUYẾT ĐỊNH KIẾN TRÚC nay ĐÃ CÓ: engineer chọn đường **(c)** —
>   giữ `service_role`, không thêm identity thứ hai — ngày 2026-08-31, ghi trong
>   **ADR-0019**. Mục vẫn ở đây vì (c) CỐ Ý không giảm một quyền nào, mà quyền
>   chính là món nợ. Đổi lại, ranh giới GHI được ghim thành cổng CI.
>
> Đừng đọc hai mục này như việc bị bỏ quên. Mỗi mục ghi rõ phần nào đã trả,
> phần nào còn, và cái gì phải xảy ra để phần còn lại được động tới.

### TD-029 — Kill criterion của ADR-0010 đã NỔ, và ta cố ý đi tiếp
**Từ:** 2026-08-28 (phát hiện khi soạn ADR-0018; engineer chọn "đi tiếp + mở
một dòng nợ" khi được hỏi thẳng)
**Loại:** kiến trúc — mẫu hình đang dùng vẫn ĐÚNG, nhưng cái ngưỡng tự ta đặt
ra để bảo "dừng lại mà xét lại" thì đã bị vượt qua

> **CẬP NHẬT 2026-08-31 — NỬA "SẼ BỊ QUÊN" ĐÃ TRẢ, NỬA KIẾN TRÚC CÒN NGUYÊN.**
>
> Mục này tự nêu rủi ro thực chất của nó bằng một câu: *"một tiêu chí khai tử
> đã nổ mà không ai đọc thì bằng đúng với việc chưa từng viết ra — và lần sau
> người thêm operation thứ 14 sẽ lại đọc ADR-0010, lại thấy ngưỡng, lại tưởng
> nó chưa nổ."* Rủi ro ĐÓ đã đóng: ngưỡng nay là một test chạy trong `npm test`
> (`lib/supabase/__tests__/serviceRoleSurface.test.ts`), không còn là một câu
> trong markdown. Operation thứ 14 làm CI đỏ, kèm thông điệp kê lại ba đường đi
> và nói thẳng rằng nâng con số KHÔNG phải cách làm test xanh lại.
>
> Vì sao chuyển ngưỡng vào test chứ không viết đậm hơn trong tài liệu: chính sổ
> này đã có bằng chứng rằng cách kia không chạy — cảnh báo "§16 CHƯA ĐƯỢC APPLY"
> ở TD-005 đứng nguyên 3 ngày, viết đúng, đặt đúng chỗ, và không cứu được gì,
> vì việc đọc nó phụ thuộc trí nhớ người.
>
> Cổng ấy còn ghim thêm hai thứ mà phép đếm `grep` không thấy: khoá
> `service_role` chỉ được đọc ở ĐÚNG MỘT nơi trong file, và chỉ có ĐÚNG MỘT
> lượt `createClient(`. Thiếu hai ràng buộc đó thì operation thứ 14 không cần
> một `export async function` mới nào — nó chỉ cần dựng thêm một client đặc
> quyền bên trong một hàm đã có, và phép đếm sẽ báo 13 mãi mãi.
>
> **CÒN NGUYÊN, và đây mới là món nợ:** cổng ĐẾM operation, nó không GIẢM một
> quyền nào. Cả 13 operation vẫn chạy bằng `service_role`, và tiêu chí "trả
> xong" ở cuối mục không đổi một chữ. *(Đường đi thì ĐÃ chọn — khối ngay dưới,
> cùng ngày. Chọn được đường không có nghĩa là đã giảm quyền: đường được chọn
> là (c), tức là cố ý KHÔNG giảm.)*

> **QUYẾT ĐỊNH 2026-08-31 — ENGINEER CHỌN ĐƯỜNG (c). Xem `docs/adr/ADR-0019-continuing-with-service-role.md`.**
>
> Lý do engineer nêu: không đủ thời gian, và không muốn thêm dependency mà sau
> này còn phải bảo trì. Ghi nguyên vào đây vì đó chính là ràng buộc sẽ quyết
> định khi nào (a) được lấy ra lại — không phải "khi nào rảnh", mà **khi năng
> lực bảo trì đổi**.
>
> **Mục này VẪN Ở "ĐANG MỞ", và đó không phải sơ suất.** (c) cố ý không giảm
> một quyền nào; cả 13 operation vẫn chạy bằng `service_role`. Tiêu chí trả nợ
> ở cuối mục — *chỉ ra operation nào không còn cần `service_role`, và
> `test-rls.ts` có ca chứng minh* — không đổi một chữ và chưa đạt. Cái đổi là
> mục này thôi mang một câu hỏi chưa trả lời; nó mang một quyết định có ngày
> tháng và có giá.
>
> **Đo lại 2026-08-31 cho thấy con số 13 là một PROXY, và nó đo nhầm chỗ.**
> Chia 13 operation theo cách chúng chạm database:
>
> | Hình dạng | Số | Rủi ro khi call site sai |
> |---|---|---|
> | `.rpc()` vào hàm SQL tự kiểm | 6 | **Không có.** `record_exam_result()` không nhận `user_id`, nó suy từ attempt. Tham số bậy vẫn không ghi được bậy. |
> | `.from(...)` ĐỌC | 3 | Rò dữ liệu — do allowlist admin (ADR-0012) gánh, không phải database. |
> | `.from(...)` GHI | 4 | **Đúng bằng độ đúng của call site.** `service_role` chuyển tiếp thẳng tham số, dưới nó không còn lớp nào phản đối. |
>
> Nói cách khác: 13 `.rpc()` sẽ AN TOÀN HƠN 4 lượt ghi thẳng, mà phép đếm
> không phân biệt được hai thứ đó. 6/13 đã ở dạng an toàn TRƯỚC quyết định này
> — không ai ghi lại, nên không gì giữ nó lại.
>
> **Vì thế (c) đi kèm một cổng thứ hai** trong
> `lib/supabase/__tests__/serviceRoleSurface.test.ts`: một lượt ghi đặc quyền
> phải đi qua `.rpc()`, trừ đúng 4 tên có sẵn được giữ lại có tên và có ngày
> (`moderateExam`, `flagSupportTicketNotifyFailed`, `addSupportTicketNote`,
> `recordPaymentOrder`). Lượt ghi thẳng **thứ 5** làm CI đỏ trong PR của chính
> người viết nó. Đã kiểm bằng mutation test: tiêm một `.from().update()` vào
> `recordSkillMastery` → đỏ, gọi đúng tên operation.
>
> Bản đầu của cổng ấy ĐỎ OAN, và chỗ vấp đáng ghi: doc comment của
> `changeSupportTicketStatus` nằm TRƯỚC dòng `export` của nó nên bị tính vào
> khối liền trước, mà nội dung comment là đúng chữ `.from().update()` — viết ra
> để DẶN người sau đừng làm thế. Cổng tố cáo `listSupportTickets` về một lượt
> ghi nó không hề thực hiện. Đã sửa bằng cách bỏ comment trước khi soi. Chính
> file test ấy đã tự cảnh báo cái bẫy này ở một ca khác, và vẫn vấp.
>
> **Ba tiêu chí khai tử MỚI, thay cho tiêu chí đã cháy của ADR-0010** ("a
> handful" không thể nổ lần thứ hai): lượt ghi thẳng thứ 5; operation thứ 14;
> và một `createClient(` hoặc một lượt đọc `SUPABASE_SERVICE_ROLE_KEY` thứ hai
> trong module — thiếu vế cuối thì operation thứ 14 không cần một `export` nào
> mới, nó chỉ cần dựng thêm một client bên trong một hàm đã có, và hai tiêu chí
> kia đọc xanh mãi mãi.

ADR-0010 tự viết điều kiện khai tử cho chính nó:

> *"If `service-role.ts` grows beyond a handful of tightly-scoped operations,
> **or if a second caller needs privileged writes**, revisit: either a dedicated
> least-privilege Postgres role (INSERT on `exam_results` only, via direct
> connection) or moving scoring server-side behind a real backend identity."*

**Cả hai vế đều đã thoả, và thoả TRƯỚC KHI chấm tự luận được đề xuất.** Bản
nháp đầu của ADR-0018 tưởng module này có 5 operation; đếm thật (grep) ra
**11**: `recordExamResult` :61, `recordSkillMastery` :95, `listReportedExams`
:131, `moderateExam` :181, `flagSupportTicketNotifyFailed` :219,
`listSupportTickets` :263, `changeSupportTicketStatus` :337,
`addSupportTicketNote` :365, `readPaymentOrderForSettlement` :410,
`recordPaymentSettlement` :451, `recordPaymentOrder` :512. Hệ thống thanh toán
và hệ thống hỗ trợ mới là thứ đẩy nó qua "a handful" — không phải essay.

Vế thứ hai còn khớp gần như nguyên văn: Server Action bấm chấm lại (AC-072) là
**một caller thứ hai cần quyền ghi đặc quyền vào đúng bảng đó**.

ADR-0018 sẽ đưa con số lên **13** (`claimEssayGradingAttempt`,
`recordEssayGrade`).

**XÁC NHẬN 2026-08-30 (Final §16): con số ĐÃ là 13, và hai điều kiện xét lại
dưới đây vẫn phát biểu đúng.** `grep -c "^export async function"` trên
`SOURCE/lib/supabase/service-role.ts` trả về **13** — đúng bằng con số mục này
dự báo, nên operation 12 và 13 đã đáp xuống và không có operation thứ 14 nào
lẻn vào cùng lượt. Hai trigger giữ nguyên hiệu lực và giữ nguyên câu chữ: một
operation **thứ 14**, HOẶC một đề xuất mutate `exam_results` tại chỗ lần **thứ
ba** (ADR-0018 đã dùng hết lần thứ nhất và thứ hai — claim và settle). Đo lại
bằng chính lệnh `grep` trên, không bằng trí nhớ. *(2026-08-31: nay không phải
đo bằng tay nữa — cổng CI ở khối cập nhật đầu mục đo hộ, mỗi lần chạy test.)*

**Vì sao chấp nhận đi tiếp thay vì xét lại ngay:** thứ làm nổ ngưỡng là
payments + support, nên chặn tính năng chấm tự luận lại KHÔNG sửa được cái đã
nổ — nó chỉ hoãn một tính năng đã đi được 2/7 chặng tài liệu, để đổi lấy một
cuộc di trú hạ tầng cắt ngang scoring, mastery, payments và support (tức là
một ADR riêng + work plan riêng). Thiết kế trong ADR-0018 vẫn đúng *bên trong*
mẫu hình hiện tại; nó chỉ không trả lời câu "mẫu hình này còn nên là mẫu hình
không".

**Cái sẽ nổ nếu quên:** ~~ngưỡng này mất tác dụng vĩnh viễn~~ — vế đó đã đóng
2026-08-31, xem khối cập nhật. Rủi ro CÒN LẠI không đổi: mọi operation trong
file này chạy bằng `service_role` — khoá vạn năng vượt qua RLS — nên bán kính
nổ của MỘT lỗi call site tăng theo số operation, và 13 thì không còn kiểm bằng
mắt trong một lần review được nữa.

**Cái gì buộc phải xét lại (không phải "khi nào rảnh"):**
- operation thứ **14** được thêm vào `lib/supabase/service-role.ts` — nay là
  một test ĐỎ, không phải một lời dặn; HOẶC
- một đề xuất mutate `exam_results` tại chỗ lần thứ **ba** (ADR-0018 đã là lần
  thứ nhất và thứ hai — claim và settle).

**Đường đã kê — (c) ĐÃ CHỌN 2026-08-31 (ADR-0019):** (a) role Postgres
least-privilege qua kết nối trực tiếp, đúng như ADR-0010 nêu tên — hoãn vì chi
phí bảo trì (pooler + driver `pg` + đường truy cập thứ hai song song PostgREST
+ một DB password nữa trong env Vercel), **không phải vì sai**; và nó cũng
không chữa 4 lượt ghi thẳng, vì một role hẹp vẫn chuyển tiếp một `id` sai vào
đúng bảng nó được phép ghi. (b) tách scoring ra sau một backend identity thật —
lớn hơn (a), cắt ngang 5 hệ thống cùng lúc. **(c) giữ nguyên identity, ghim
ranh giới GHI bằng cổng CI — đang chạy.** Nếu ràng buộc bảo trì đổi, (a) là
đường lấy ra trước.

**Verify khi trả:** `grep -c "^export async function" SOURCE/lib/supabase/service-role.ts`
không còn là thước đo duy nhất — bản trả nợ phải chỉ ra được operation nào
KHÔNG còn cần `service_role` nữa, và `test-rls.ts` phải có ca chứng minh
identity mới không làm được thứ `service_role` làm được.

### TD-005 — `schema.sql` áp bằng tay, không có migration tool
**Từ:** trước 2026-08-03 (nợ cũ, ghi lại cho rõ)
**Loại:** vận hành
**Trạng thái:** **đã trả PHẦN PHÁT HIỆN (2026-08-07), PHẦN ĐƠN VỊ APPLY
(2026-08-31) và PHẦN CÔNG CỤ MIGRATION — trên DEV (2026-08-31)**; prod còn một
lượt dọn sổ ghi, xem khối ngay dưới

> **CẬP NHẬT 2026-08-31 (b) — SUPABASE CLI MIGRATIONS ĐÃ VÀO. DEV XONG, PROD CÒN
> MỘT LƯỢT DỌN SỔ.**
>
> Credential đã có, nên phần mà mục này gọi là "trả nợ thật" đã làm được.
>
> **Mô hình đã chốt (engineer 2026-08-31):** `schema.sql` giữ vai CANONICAL —
> nó là thứ người viết, và là nơi DUY NHẤT giải thích vì sao schema có hình
> dạng như thế. `supabase/migrations/` chỉ là CƠ CHẾ ÁP: nó trả lời "database
> này đã chạy tới đâu", câu mà một file idempotent không trả lời được.
>
> **Hai nguồn chân lý là một cái bẫy**, và mô hình trên chỉ an toàn khi có cổng
> giữ chúng nói cùng một chuyện — nếu không thì đây đúng là hình dạng TỆ NHẤT
> của chính TD-005: hai file cùng khai về schema, trôi khỏi nhau trong im lặng.
> Cổng đó là `lib/schema/__tests__/migrationsMatchSchema.test.ts` (4 ca), chặn
> hai chiều quên: sửa `schema.sql` mà quên viết migration → đỏ; viết migration
> mà quên cập nhật `schema.sql` → đỏ. Quy ước tên file mang toàn bộ sức mạnh
> của chiều thứ nhất: `<timestamp>_<mô-tả>_<vân-tay-SAU-migration-này>.sql`.
>
> ⚠ **Cổng ấy KHÔNG chứng minh "baseline + mọi migration = schema.sql" theo
> nghĩa ngữ nghĩa SQL.** Muốn thế phải dựng shadow database rồi `supabase db
> diff` — cần Docker, máy này không có. Nó chứng minh hai điều YẾU HƠN nhưng
> kiểm được.
>
> **Một lượt mutation test bắt được lỗ hổng thật TRONG CHÍNH CỔNG ĐÓ**, và nó
> đáng ghi vì nó là hình dạng chung của mọi cổng dựa vào một cổng khác: bản đầu
> so vân tay với hằng số TypeScript `SCHEMA_FINGERPRINT`, nên nó chỉ đỏ SAU KHI
> ai đó đã cập nhật hằng số ấy — tức một lượt sửa `schema.sql` bỏ qua cả hai
> cổng vẫn lọt. Đo thật: tiêm `select 1;` vào `schema.sql` → bản cũ vẫn XANH.
> Đã sửa sang tính vân tay TRỰC TIẾP từ nội dung file; tiêm lại → ĐỎ.
>
> **Đã làm trên dev:** `supabase init` + `link`; baseline
> `20260831000000_baseline_0abf8131aa2a.sql` (2283 dòng, sinh nguyên văn từ
> `schema.sql`); dọn lịch sử rác rồi `migration repair`. Kết quả đo:
> `migration list --linked` → đúng 1 dòng khớp cả hai phía;
> `db push --dry-run` → `upToDate: true`.
>
> **Cả hai database đều đã có lịch sử migration RÁC** từ các lượt gọi
> `SUPABASE_APPLY_A_MIGRATION` ad-hoc trước đây — dev 3 dòng, prod 15 dòng, và
> hai tập gần như RỜI NHAU. Đó là bằng chứng thêm cho chính mục này: không ai
> biết database nào đã chạy gì, kể cả bảng ghi sổ.
>
> **CÒN LẠI TRÊN PROD** (schema đã đúng — `schema_version` = `0abf8131aa2a`,
> đọc bằng truy vấn thật; chỉ bảng ghi sổ là sai): xoá 15 dòng rác rồi đánh dấu
> baseline. Ghi lại đây để hoàn tác được — `schema_f525e3_part01/p01..p08_final`
> (20260815043016, ...043143, ...043214, ...043246, ...043317, ...043350,
> ...043420, 20260815085648, ...085715), `profile_avatar_schema_chunk_1..5_of_5`
> (20260817123118, ...123756, ...123852, ...123958, ...124055),
> `rating_scale_1_to_5_stars` (20260828115315).
>
> *(Đo được, không phải đoán: rút chuỗi SQL khỏi binary CLI v2.116.0 cho thấy
> nó chỉ chạy `SELECT version FROM supabase_migrations.schema_migrations ORDER
> BY version` — cột `name` và `statements` là GHI-mà-không-bao-giờ-ĐỌC. Nên một
> dòng baseline thiếu `statements` không ảnh hưởng vận hành; nó chỉ là vết
> audit. Ghi ra vì câu hỏi này đã được đặt và đáng có câu trả lời đo được.)*

> **CẬP NHẬT 2026-08-31 — CHẾ ĐỘ HỎNG NÀY VỪA ĐƯỢC QUAN SÁT TRỰC TIẾP, HAI LẦN
> TRONG MỘT PHIÊN, VÀ NÓ TỆ HƠN "QUÊN MỘT NHÓM".**
>
> Mục này viết phần chưa trả bằng một câu: *"không có gì ngăn lượt apply tay
> TIẾP THEO quên một nhóm."* Lượt apply §18 ngày 2026-08-31 cho thấy hình dạng
> thật của nó không đòi ai phải quên gì cả:
>
> - Gửi `revoke ...; grant ...;` như MỘT chuỗi → công cụ chạy vế `revoke`, bỏ
>   vế `grant`, trả về `successful: true` kèm `"command": "REVOKE"`.
> - Gửi `drop policy ...; create policy ...;` → trả về `"command": "DROP POLICY"`.
>
> Cả hai lượt TRÔNG NHƯ đã xong. Lượt đầu thật sự chưa xong, và hệ quả là một
> RLS policy vừa tạo ra đã gọi tới một hàm mà `authenticated` không có quyền
> chạy — không có gì đỏ ở đâu cả. Thứ phát hiện ra nó là một truy vấn đọc lại
> `pg_proc.proacl`, không phải thông báo của công cụ.
>
> *(Ghi thêm một cái bẫy phụ, vì nó suýt dẫn tới một kết luận sai theo chiều
> ngược lại: `information_schema.routine_privileges` trả về RỖNG khi đọc bằng
> `supabase_read_only_user`, và một lượt gọi hàm bằng chính role ấy trả 42501 —
> cả hai đều trông y như "grant chưa có". `pg_proc.proacl` mới là chỗ đọc được
> sự thật, vì nó không lọc theo người đọc.)*
>
> **Đã trả: ĐƠN VỊ APPLY.** `npm run schema:plan` (`scripts/schema-plan.ts`,
> `lib/schema/splitStatements.ts`) cắt `schema.sql` thành từng câu lệnh rời —
> tôn trọng `$$...$$`, chuỗi `'...'` có `''` escape, định danh `"..."`, và
> comment — rồi in ra danh sách CÓ SỐ kèm vân tay đích. Hôm nay là **263 câu
> lệnh**. Cách chữa không phải "cẩn thận hơn": apply theo từng câu lệnh rời thì
> không có câu nào để nuốt, và một lượt apply đúng là một lượt chạy đủ N câu
> với N là con số in ra. `--emit <dir>` ghi mỗi câu thành một file.
>
> Bộ cắt có test riêng (`lib/schema/__tests__/splitStatements.test.ts`, 14 ca)
> chạy trên CẢ mẩu SQL dựng sẵn LẪN file thật, gồm bất biến "không câu lệnh nào
> có số lẻ dấu `$$`" (thân hàm bị cắt đôi) và "câu lệnh CUỐI CÙNG là lượt ghi
> vân tay §17".
>
> **VẪN KHÔNG PHẢI MIGRATION TOOL:** không thứ tự giữa các phiên bản, không
> rollback, không biết đi từ bản A sang bản B, và nó KHÔNG kết nối tới database
> nào — nó đọc một file trong git rồi in ra. Trả nợ trọn vẹn vẫn là Supabase
> CLI migrations, vẫn cần DB password của cả hai project.

**Cập nhật 2026-08-30 (Final §16) — ADR-0018 thêm BA nhóm DDL, đã áp và đã
kiểm trên CẢ HAI database.** Ghi ra vì con số "hai thay đổi schema áp tay"
xuất hiện ở nhiều tài liệu thượng nguồn và nó **đếm thiếu một**:

1. **Hai hàm SQL mới** — `claim_essay_grading_attempt()`, `record_essay_grade()`.
2. **Cặp CHECK trên `telemetry_log`** — `telemetry_log_event_type_check`
   (2 → 3 giá trị, thêm `essay_grade`) và `telemetry_log_error_code_check`
   (6 → 9 giá trị). Mỗi cái là một cặp drop/add.
3. **Trần ký tự `attempt_answers_answer_check`** — 500 → 4000 (R11). Đây là
   nhóm **thứ ba** mà câu "hai thay đổi" bỏ quên.

Cả ba đi cùng một lượt apply **sáu câu lệnh theo thứ tự phụ thuộc, vân tay
CUỐI CÙNG**, lên dev rồi prod ngày 2026-08-29, sau xác nhận của kỹ sư. Vân tay
đi `29931beeb950` → **`9979c9deea52`** và được **đọc lại bằng truy vấn thật**
trên cả hai project (Gate B6), không phải tin theo thông báo "success" — bước
này đáng giá đúng như TD-005 dự báo: công cụ apply chỉ báo `DROP FUNCTION` là
"command" cho mỗi lượt nhiều câu lệnh, đọc trần trụi sẽ tưởng lệnh create
không chạy. **Không dòng dữ liệu nào mất** — số đếm trên prod đi LÊN trong cửa
sổ ấy (9→10 kết quả, 217→222 câu trả lời, 90→91 telemetry), tức lưu lượng học
sinh thật.

**Cập nhật 2026-08-31 — §18 (ẩn đề của tác giả bị ban, xem TD-032) đã áp lên
CẢ HAI database, từng câu lệnh một.** Vân tay đi `9979c9deea52` →
**`0abf8131aa2a`**, đọc lại bằng truy vấn thật trên cả dev lẫn prod.
`npm run verify:schema` xanh đủ mọi mục trên dev sau khi áp.

**Cái TD-005 vẫn chưa được trả:** không có thứ tự áp giữa các phiên bản, không
rollback, và không có gì biết "môi trường nào đang ở bản nào" ngoài một dòng
vân tay do chính lượt apply tự khai. Lượt 2026-08-29 đúng vì có Gate B1–B7
viết sẵn thành checklist có người tick; lượt 2026-08-31 đúng vì apply từng câu
một rồi đọc lại catalog. Cả hai đều là KỶ LUẬT của lượt apply, không phải một
tính chất của công cụ.

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

### ~~TD-032 — 5 trong 7 đề trên PROD do tài khoản probe test đứng tên~~
**Trả:** 2026-08-31 — chuyển quyền sở hữu + dựng cơ chế ẩn đề của tác giả bị ban.
**Verify:** truy vấn thật trên prod trước và sau, và đọc lại policy từ
`pg_policies` chứ không tin thông báo apply.

**Chuyển quyền sở hữu — ĐO TRƯỚC, LÀM, ĐO SAU.** `update ... returning` trả về
đúng **5 dòng**, tất cả sang `a5b86928-eec2-441f-86f4-751239c16541`
(`smithnguyen247@gmail.com`, tài khoản gmail chính của engineer), kèm
`author_display_name` đổi từ `smithnguyen247+rlstesta` sang `AD` — tên hiển thị
thật của tài khoản nhận, đọc từ `user_profiles`, không phải một chuỗi bịa.

| | trước | sau |
|---|---|---|
| đề do probe đứng tên | 5 | **0** |
| đề do engineer đứng tên | 1 | **6** |
| tổng số đề trên prod | 7 | 7 |
| `exam_attempts` / `exam_results` / `attempt_answers` | 92 / 16 / 350 | **92 / 16 / 350** |

Ba con số cuối là bằng chứng KHÔNG MẤT DỮ LIỆU: `exams.author_id` là
`on delete set null` và mục này cảnh báo rằng một lượt XOÁ tài khoản sẽ làm 5 đề
im lặng rơi về `author_id is null`. Lượt này là `update`, không phải `delete`,
và số đếm đứng yên chứng minh điều đó thay vì chỉ khẳng định nó.

**MỘT LỆCH SO VỚI GHI CHÚ CỦA ENGINEER, ghi ra vì nó đổi phạm vi.** Ghi chú nói
"năm đề đã publish". Đo thật: probe đứng tên 5 đề, nhưng chỉ **4** trong đó
`published`; đề thứ năm (`ugc-89de5937…`, Tiếng Anh 12) ở trạng thái **`failed`**
— không phải `draft` như mục này viết ban đầu. Đã chuyển **cả 5**, và đó là chủ
đích: đề `failed` chính là "đề không ai với tới được" mà mục này nêu ở chế độ
hỏng số 1. Bỏ nó lại là giữ nguyên đúng vấn đề vừa đi sửa.

**Cơ chế ẩn đề của tác giả bị ban — schema.sql §18, đã áp lên CẢ HAI database.**

- `public.is_author_banned(uuid)` — `security definer` (vì `authenticated` không
  có, và không nên có, quyền đọc `auth.users`), `stable`,
  `set search_path = public, auth, pg_temp`.
- Vị từ là `banned_until is not null AND banned_until > now()`, **không** chỉ
  `is not null`: Supabase ghi lệnh ban vĩnh viễn bằng một mốc rất xa, nên một
  phép kiểm null đơn thuần sẽ giữ đề bị ẩn mãi sau khi lệnh ban đã hết hạn — một
  kiểu hỏng không ai đi tìm, vì nó trông y hệt "chưa được gỡ ban".
- `exams_select_visible` thành
  `(status = 'published' and not is_author_banned(author_id)) or author_id = auth.uid()`.
  `questions_select_visible` đi theo — thiếu vế đó thì đề biến mất trong khi nội
  dung câu hỏi vẫn đọc được qua `/rest/v1/questions`, đúng hình dạng lỗ hổng §10
  đã phải vá một lần.
- `author_id is null` (nội dung seed) không bị ảnh hưởng: `is_author_banned(null)`
  trả false.
- **KHÔNG dùng `status = 'removed'`**, có chủ ý: §14 đã có một trạng thái gỡ thủ
  công từng đề, trả lời câu "đề này có vấn đề". Ban trả lời câu "NGƯỜI này có vấn
  đề" — một vị từ về tác giả, đúng một chỗ, tự đảo ngược khi lệnh ban hết hạn.
  Viết nó thành N lần `update ... set status='removed'` là chép một trạng thái
  sang chỗ khác rồi phải NHỚ chép ngược lại.

**Cổng canh:** `lib/schema/__tests__/bannedAuthorVisibility.test.ts` khẳng định
LƯỢT ĐỊNH NGHĨA CUỐI CÙNG của hai policy đọc mang vế chặn — không phải "có xuất
hiện chuỗi đó đâu đó trong file". Khác biệt ấy là toàn bộ giá trị của cổng: §4
và §18 định nghĩa CÙNG một policy, và §18 chỉ đúng nhờ nó chạy SAU. Ai kéo §4
xuống dưới sẽ gỡ mất vế chặn mà vân tay vẫn đổi (nên vẫn đòi apply lại) còn test
vân tay thì vẫn xanh.

**⚠ PHÁT HIỆN NGOÀI DỰ KIẾN, VÀ NÓ LẬT MỘT TIỀN ĐỀ CỦA CHÍNH MỤC NÀY: TÀI KHOẢN
PROBE HIỆN **KHÔNG** BỊ BAN.** Đo trên prod 2026-08-31:
`banned_until` là **null**, và `auth.users.updated_at` của dòng đó là
**2026-08-30 12:41:55 UTC** — tức MỘT NGÀY SAU lượt ban mà mục này ghi là đã
thực hiện 2026-08-29. Ai đó, hoặc thứ gì đó, đã gỡ ban.

Hệ quả cần đọc cho đúng:
- Chế độ hỏng số 1 của mục này ("đề chưa published không còn danh tính nào với
  tới") KHÔNG còn áp dụng — nhưng lý do là quyền sở hữu đã chuyển, chứ không
  phải vì lệnh ban còn hiệu lực.
- §18 vì thế **không đổi gì trên prod hôm nay**: không có tác giả nào đang bị
  ban. Nó là cơ chế cho lần sau, và lượt áp này rủi ro thấp đúng vì thế.
- **CHƯA BAN LẠI, và đó là quyết định có ý thức.** Ghi chú của engineer không
  yêu cầu điều đó, mục này ghi lượt ban là việc đã xong, và ban lại là một thay
  đổi trạng thái trên một tài khoản thật mà không ai yêu cầu. Nếu engineer muốn
  tài khoản probe ở lại trạng thái bị ban trên prod thì đó là một lệnh cần nói
  ra — mật khẩu của nó vẫn là giá trị `gen_random_uuid()` không ai biết, nên
  không ban thì nó cũng không đăng nhập được bằng literal cũ.

**Dev vẫn KHÔNG bị đụng tới**, đúng như mục này dặn: `signInProbeUser()` trên dev
vẫn đăng nhập bằng literal cũ, và `npm run verify:schema` trên dev xanh đủ mọi
mục sau khi áp §18.

### ~~TD-031 — Có sẵn một bộ phân loại prompt-injection chuyên dụng, và ta CỐ Ý chưa dùng~~
**Trả:** 2026-08-31 — bằng một PHÉP ĐO, không bằng một lập luận.
**Verify:** `npm run probe:injection` — 21 cặp bẩn/sạch trên model thật, 0 cặp
nâng điểm.

Ghi chú của engineer: *"Thử sử dụng một số kĩ thuật injection cơ bản trên
website để xem có cần thêm công cụ này hay không."* Đã làm, và câu trả lời là
**chưa cần**.

**Đo cái gì, và vì sao đo thế.** Repo đã có sẵn bộ fixture đối kháng 7 kỹ thuật
(`lib/essay/__tests__/fixtures/adversarialAnswers.ts`) — mệnh lệnh trực tiếp,
giả mạo vai hệ thống, giả mạo hàng rào vùng, mồi chài sẵn output JSON, chèn
zero-width, đảo chiều bidi, uỷ quyền giả — mỗi ca kèm một `cleanAnswer` ĐÃ
COMMIT: cùng nội dung học thuật, đã gỡ payload. Bộ ấy được viết sẵn cho đúng
phép đo này (AC-042/AC-070, plan Task E3) nhưng chưa ai chạy.

Phép đo là SO SÁNH CẶP, không phải phép kiểm trần: chấm cả hai, tấn công thành
công khi **band bẩn > band sạch**. Một phép kiểm kiểu "không bài nào ra band 1"
vẫn xanh trong khi một cú tiêm nâng band thật từ 0 lên 0.75.

**Kết quả, `qwen/qwen3.8-27b`, `temperature: 0`, 3 lượt chạy (2+1), 21 cặp:**

| kỹ thuật | sạch | bẩn |
|---|---|---|
| mệnh lệnh trực tiếp (vi) | 0.25 | 0.25 |
| giả mạo vai hệ thống (en) | 0.25 | 0.25 |
| giả mạo hàng rào vùng (vi) | 0.25 | 0.25 |
| mồi chài sẵn output JSON (en) | 0.25 | 0.25 |
| zero-width (vi) | 0 | 0 |
| đảo chiều bidi (en) | 0.25 | 0.25 |
| uỷ quyền giả (vi) | 0.5 | 0.5 |

**0 / 21 cặp có band bẩn > band sạch.** Không một cú tiêm nào dịch chuyển được
điểm, ở bất kỳ lượt nào. Không có ca nào rơi vào nhánh "output bị loại" — tức
kết quả này đến từ việc model KHÔNG làm theo, chứ không phải từ tầng validate
cứu ở phút chót.

**Quyết định: GIỮ NGUYÊN — không thêm prompt-guard.** Bốn lý do gốc của mục này
(tầng validate đầu ra chặn đúng hậu quả; nhân đôi request mỗi câu; điểm phát AI
thứ hai kéo theo cổng quét/ngân sách/bundle-guard riêng; mở lại phạm vi một tính
năng đã qua 5 tài liệu) vẫn đứng, và nay có thêm một lý do đo được: mối đe doạ
mà công cụ ấy chặn hiện KHÔNG hiện thực hoá được trên đường đi thật.

**Đã dựng để lần sau không phải đo lại bằng tay:** `npm run probe:injection`
(`scripts/probe-essay-injection.ts`). Nó gọi `groqChatCompletion()` — điểm phát
Groq DUY NHẤT (AC-033) — chứ KHÔNG tự dựng một `fetch` nào, nên
`groqChokepoint.test.ts` vẫn thấy đúng một emit site và danh sách ngoại lệ
offline vẫn RỖNG. Cần cờ `--conditions=react-server` (module đích mang
`import "server-only"`, gói ấy throw dưới Node thường). Đề bài + đáp án mẫu đóng
cứng trong script, có chủ ý: hai lượt đo chỉ so được với nhau khi mọi thứ ngoài
payload đều y hệt.

**Phạm vi của kết luận, nói thẳng:** nó đúng cho ĐÚNG bộ payload này và ĐÚNG
model này. `ESSAY_GRADER_MODEL` đổi là nó hết hiệu lực (AC-032 vốn đã đòi chạy
lại E3 trong trường hợp đó). Ba điều kiện làm mục này sống lại vẫn giữ nguyên
câu chữ: một lượt tiêm chích thật quan sát được trong telemetry; R9 được nâng
mức rủi ro; hoặc tầng validate đầu ra bị nới ra vì bất kỳ lý do gì.

### ~~TD-030 — `npm run test:fixture` ĐANG ĐỎ trên `main`~~
**Trả:** 2026-08-31 — nửa còn lại (nửa "nâng cổng verify 4 → 6" đã trả 2026-08-29).
**Verify:** `npm run test:fixture` exit code 0 — 2 file, **83 test**, tất cả xanh.

**NGUYÊN NHÂN KHÔNG PHẢI MỘT TRONG HAI GIẢ THUYẾT MỤC NÀY KÊ, và cả hai bản vá
mà chúng gợi ý đều sẽ làm test xanh trong khi nó khẳng định một điều bịa.**

Mục này kê hai nguyên nhân: nút Xác nhận mất `aria-describedby`, hoặc bộ chọn
không phân biệt được hai nút `aria-disabled`. Đo thật: màn hình có **đúng MỘT**
control mang nhãn xác nhận, nó **có** `aria-describedby` nguyên vẹn, và id nó
mang là của C-10 — vì C-10 chính là thứ cổng pháp lý MỞ mount ra.

Nguyên nhân là một **TIỀN ĐỀ HẾT HẠN**, đọc được từ git:
- `f83efa6` (2026-08-20) viết ca FE-1(e) khi cổng pháp lý còn ĐÓNG —
  `page.tsx` suy `legalContentReady` từ sự CÓ MẶT của `billing.terms.body` và
  `billing.refund.body` trong `en.ts`, và hôm đó chưa khoá nào tồn tại.
- `b3b81eb` (2026-08-21) đưa cả hai nội dung pháp lý vào — BU-1 đủ điều kiện,
  TBD-02 đóng. Từ commit đó, route đi nhánh MỞ của C-15 và mount C-10
  (`variant="primary"`).

Nhánh ĐÓNG trở thành **không với tới được TỪ ROUTE NÀY**, và ca test đã đỏ liên
tục từ 2026-08-21 — 8 ngày trước khi ai đó nhìn thấy, đúng vì làn fixture lúc ấy
chưa nằm trong cổng verify. Nói cách khác: nửa trả trước của mục này (nâng cổng
lên 6) chính là thứ làm nửa sau khả thi.

**Bản vá.** Ca FE-1(e) nay ghim trạng thái route ĐANG Ở, cả hai nửa: cổng MỞ, và
control mà cổng mở mount ra là control thực hiện hành động thật (có ca đối chứng
dương — bấm vào thì `recheckOrder` được gọi đúng một lần và một node
`role="alert"` xuất hiện). Thêm một tiền đề đọc `key in en` — ĐÚNG vị từ
`page.tsx` dùng — nên xoá một nội dung pháp lý khỏi `en.ts` sẽ làm ca này đỏ ồn
ào thay vì làm màn checkout lặng lẽ trơ trên production.

**Nhánh ĐÓNG không bị bỏ rơi:** nó sống ở tầng với tới được —
`app/(billing)/pricing/checkout/__tests__/PaymentConfirm.test.tsx` render C-15
với `legalContentReady={false}` tường minh và ghim đủ control trơ / focus được /
có lý do PHÁP LÝ (không phải câu "đơn đã đóng" của C-10). Một ca ở tầng route
không thể ghim một nhánh route không đi vào mà không stub chính từ điển route
đọc — và ca dựng trên stub đó khẳng định về stub, không phải về sản phẩm.

**Pattern `aria-disabled` mà cả repo dựa vào vẫn được canh**, đúng mối lo mà mục
này nêu: ca mới vẫn khẳng định không có `disabled` gốc và control vẫn Tab tới
được — ở CẢ nhánh mở lẫn nhánh đóng, chỉ là ở hai tầng khác nhau.

*(Ghi chú phạm vi: file test này thuộc tính năng Subscription đang tạm dừng. Sửa
nó KHÔNG động tới sản phẩm Subscription — không một dòng mã sản phẩm nào đổi.
Món nợ ở đây là một làn test ĐỎ trên `main`, và một làn đỏ làm hỏng cổng verify
cho MỌI tính năng, không riêng tính năng đã tạm dừng.)*

### ~~TD-028 — Xếp hạng đề KHÔNG có tín hiệu môn~~
**Trả:** 2026-08-31 — thêm tín hiệu ĐIỂM YẾU THEO MÔN vào `affinity`.
**Verify:** `lib/adaptive/__tests__/rankExams.test.ts` — 31 ca (thêm 13), gồm
một ca ĐỐI CHỨNG ĐẢO DẤU và hai ca ghim trật tự giữa ba số hạng.

Ghi chú của engineer: *"Thuật toán đề xuất môn mà học sinh đang yếu lên đầu
trang."* Đã làm.

**Tín hiệu:** `1 − điểm_trung_bình_môn / 10`, tính trên các lượt ĐẠI DIỆN (nộp
gần nhất mỗi đề) đã CÓ ĐIỂM của chính học sinh. Trọng số
`EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT = 0.5`, và khoá sắp xếp thành:

```
[ band ASC, priorScore ASC NULLS LAST, affinity DESC, id ASC ]
affinity = 1.0 × tỉ-trọng-LỚP + 0.5 × độ-YẾU-MÔN + 0.25 × độ-MỚI
```

**Vì sao 0.5 — hai tính chất kiểm chứng được, cả hai có test ghim CHÍNH hằng số
đang ship, không phải một bộ trọng số bịa riêng cho test:**
1. **LỚP đè MÔN.** Học sinh chỉ làm bài một lớp ⇒ tỉ trọng lớp 1.0/0, nên
   affinity tối đa của đề SAI lớp là `0 + 0.5 + 0.25 = 0.75` < `1.0` = affinity
   tối thiểu của đề ĐÚNG lớp. Yếu Sinh không kéo được đề Sinh lớp 8 lên đầu
   danh sách của học sinh lớp 12. Đẩy nội dung sai lớp lên đầu là kiểu hỏng TỆ
   HƠN việc gợi ý một môn đã vững.
2. **MÔN đè MỚI-CŨ, nhưng chỉ khi điểm yếu là thật.** Môn 0 điểm (số hạng 0.5)
   thắng mọi lợi thế mới-cũ (tối đa 0.25); môn chỉ hơi yếu thì nhường.

**Vì sao đo bằng ĐIỂM chứ không bằng `user_skill_mastery` như mục này kê:** DAG
kỹ năng CỐ Ý chỉ phủ Toán, nên mastery không có một dòng nào cho Hoá, Sinh, Lý —
đúng ba môn tín hiệu này sinh ra để phân biệt sẽ nhận "không biết" vĩnh viễn.
`exam_results.total_score` có mặt cho MỌI môn và đã nằm sẵn trong lượt đọc bộ
xếp hạng đang thực hiện: **0 round-trip thêm** (chỉ nới embed `exams!inner(grade)`
thành `exams!inner(grade, subject)`).

Ranh giới "không biết ≠ bằng 0" theo đúng tiền lệ `buildGradeShares`: chưa có
lượt nào có điểm ⇒ tín hiệu CÂM (cold-start giữ nguyên AC-022); có điểm nhưng
chưa đụng môn nào đó ⇒ môn ấy nhận 0, vì không có gì nói nó yếu. Lượt đã nộp mà
KHÔNG có dòng kết quả (chuyện xảy ra thật, AC-038) không bị đọc thành 0 điểm —
làm thế là biến một sự cố ghi dữ liệu thành lời khẳng định "em này yếu môn đó".

**Hai việc TD-028 kê mà bản này CỐ Ý không làm, kèm lý do đo được:**

- **`band` KHÔNG đổi** (item 2). Mục này tự xếp nó là "câu hỏi SẢN PHẨM, không
  phải câu hỏi kỹ thuật", và PRD AC-019/D5 phát biểu `band` là khoá CỨNG — đổi
  nó là đổi một tiêu chí nghiệm thu. Có ca test ghim quyết định này, nên một lần
  "cải tiến" âm thầm cho phép đề đã làm vượt lên sẽ đỏ ở CI chứ không đỏ ở màn
  hình người dùng. Hệ quả cần nói thẳng: "đề môn yếu lên đầu trang" ở đây nghĩa
  là lên đầu băng CHƯA LÀM — tức đúng phần trên cùng của trang 1.
- **Tầng "độ khó cộng đồng" vẫn TẮT** (item 3), và lần này có số đo thay vì suy
  đoán. Đo prod 2026-08-31: `rating_count` cao nhất trên toàn kho là **2**
  (`ugc-1dcb6d3e`), ba đề còn lại 1, ngưỡng là **3**. Điều kiện bật lại CHƯA
  đạt — `avg_overall` vẫn NULL với mọi đề, tầng ấy vẫn TRƠ chứ không phải thưa.
  Bật nó bây giờ là thêm một tín hiệu hằng số, đúng cái sai mà chính mục này ghi
  lại về tín hiệu môn hồi 2026-08-16.

**Tín hiệu mới KHÔNG hằng số trên prod hôm nay** — điều kiện mà item 3 vừa
trượt. Điểm trung bình theo môn, đo prod 2026-08-31: Hoá **0.00** (2 lượt),
Sinh **0.17** (3), Lý **0.57** (5), Toán **1.36** (6). Bốn môn, bốn giá trị khác
nhau, thứ tự yếu→mạnh rõ ràng. Nó thật sự đổi được thứ tự.

### ~~TD-013 — Không có rate limit nào cho lưu lượng CHƯA đăng nhập~~
**Trả:** 2026-08-31 — trần theo IP trong `proxy.ts`, đường $0 trong bốn đường
mục này kê.
**Verify:** `lib/security/__tests__/anonRateLimit.test.ts` — 15 ca.

**Chọn đường nào, và vì sao.** Bốn đường đã kê: Upstash chặn theo IP trong
`proxy.ts` ($0) / Cloudflare free ($0, đổi DNS) / Vercel Pro (~$20 tháng) / để
mở. Hai đường sau bị loại vì cùng một lý do: chúng tiêu tiền hoặc đổi DNS của
engineer, và không có ghi chú nào cho phép làm thế. Đường thứ nhất ship được
ngay, bằng hạ tầng đã có sẵn (Upstash Redis, cùng vùng `sin1` với function).

**Cơ chế.** `proxy.ts` kiểm TRƯỚC mọi thứ khác: request không mang cookie phiên
Supabase thì bị đếm theo IP trên bộ đếm cửa sổ trượt dùng chung
(`hitSharedStore`, cùng script Lua mà `guard()` dùng), khoá `anon-ip:<ip>`.
Vượt trần ⇒ **429 text thuần** kèm `retry-after` — không render HTML, vì render
một trang lỗi ở đây là tự tay làm đúng việc trần này sinh ra để chặn.

**Trần: 240 request / 60 giây / IP.** Con số nằm GIỮA hai bậc độ lớn có ước
lượng được: một người thật duyệt web phát ra hàng CHỤC request/phút (static
asset đã bị `config.matcher` loại khỏi middleware), một vòng lặp nện phát ra
hàng NGHÌN. Test ghim hai bất đẳng thức (`>= 120`, `<= 600`) chứ không ghim con
số: sàn giữ cho một lần "siết cho chắc" không chặn nhầm cả phòng máy sau CGNAT,
trần giữ cho một lần "nới cho êm" không biến khối này thành đồ trang trí.

**Ba quyết định đáng ghi:**
- **CHỈ đếm request chưa đăng nhập.** Người đã đăng nhập vốn bị `guard()` đếm
  theo `user.id`; đếm lại theo IP là đánh thuế hai lần đúng nhóm người dùng
  thật, và nặng nhất vào một lớp học ngồi sau MỘT địa chỉ NAT. Đường đi nóng của
  họ cũng không nhận thêm round-trip nào.
- **FAIL-OPEN** khi Redis không cấu hình hoặc không trả lời — cùng quyết định
  với `checkSchemaVersion()` (TD-009), KHÁC hẳn `quota.ts` (fail-CLOSED), và sự
  khác nhau có lý do: `quota.ts` canh TIỀN trả bên thứ ba, khối này canh
  invocation của chính ta. Fail-closed ở đây biến một sự cố Redis thành "mọi
  khách chưa đăng nhập nhận 429" — tự tay gây ra đúng cái downtime cần tránh.
- **KHÔNG có lớp đệm RAM dự phòng** như `rateLimit.ts`: bộ đếm process-local
  nhân lên theo số instance, và với một trần chống-flood thì "limit × số
  instance" là một trần không nói lên điều gì.
- **Địa chỉ lấy từ mục ĐẦU TIÊN của `x-forwarded-for`.** Mục sau là proxy trên
  đường đi; dùng cả chuỗi làm khoá thì kẻ gọi chỉ cần tự thêm một địa chỉ vào
  đầu mỗi request là có bucket mới — trần biến mất trong im lặng. Không có
  header ⇒ KHÔNG đếm, chứ không phải một khoá dự phòng `"unknown"` gộp mọi
  request lạ vào một bucket rồi chặn những người chẳng liên quan tới nhau.

**⚠ PHẦN MỤC NÀY CẢNH BÁO VẪN ĐÚNG, và nó không mất đi:** mục cũ viết *"đừng đi
tìm cách lách bằng code ứng dụng, vì mọi thứ chạy trong function thì đã tốn tiền
và tốn thời gian trước khi kịp từ chối."* Vẫn đúng nguyên văn. Cái đổi được là
ĐỘ DỐC, không phải sự tồn tại của hoá đơn: một request bị từ chối nay tốn MỘT
lượt middleware + MỘT round-trip Redis cùng vùng (~1–5ms) thay cho một lượt
render route đầy đủ kèm các lượt đọc Postgres xuyên vùng (~50–60ms mỗi lượt) mà
`/exams` phải làm. Lượt invocation ĐẦU TIÊN vẫn không cứu được, và **đây không
phải chống DoS**.

Bản vá thật vẫn là chặn ở BIÊN — Vercel Firewall (cần Pro) hoặc Cloudflare
trước domain. Hai đường đó vẫn còn đó, vẫn cần một quyết định chi phí hoặc một
thay đổi DNS, và khối này không thay thế chúng. Nó chỉ làm cho quyết định ấy
không còn là điều kiện để site sống sót qua một vòng lặp ngây thơ.

### ~~TD-027 — Màn SỬA ĐỀ vẫn 356 KB JS~~
**Trả:** 2026-08-27 — cùng ngày mở. Mở lúc sáng vì một hướng đi bị số đo bác
bỏ; trả lúc chiều bằng hướng thứ hai. Cả hai lượt đều đo trên deploy THẬT.

**Số đo trên PRODUCTION, CÙNG một URL** (`/me/exams/ugc-89de5937…`, đề 40 câu —
đúng URL đã cho ra con số 354.3 KB của mốc gốc), máy tầm trung (CPU ×4 + slow
4G), 3 lượt:

| | mốc gốc | thử `next/dynamic` (đã gỡ) | **nay** |
|---|---|---|---|
| JS tải về | 354.3 KB br | 356.2 KB | **230.2 KB** (−124.1, **−35%**) |
| chunk >100KB ở lượt tải đầu | có (126.3 KB) | có | **KHÔNG CÓ** |
| TBT | 404ms | 460ms | **346ms** |
| LCP | 3668ms | 3632ms | 3640ms (đứng yên) |
| CLS | — | — | 0 |

**Byte là bằng chứng cứng** (phép đếm tất định qua Resource Timing). **TBT thì
đọc dè chừng**: 404ms là số của một PHIÊN ĐO KHÁC, nên −58ms nằm trong vùng mà
nhiễu giữa hai phiên còn nói được chuyện. Đừng trích nó như một thắng lợi
14% — thắng lợi thật ở đây là byte, và là chuyện dưới đây.

**Thứ đáng giá hơn cả con số: byte của route nay ĐỘC LẬP với số câu hỏi.**
Đo bốn đề khác nhau, tất cả đều ra **230.2 KB**: 5 câu, 18 câu, 22 câu, 40 câu.
Trước đây mỗi câu đều kéo theo phần render markdown+KaTeX vào cây client, nên
đề càng dài trang càng nặng — tức món nợ tự lớn lên theo nội dung người dùng
tải lên. Nay nó là hằng số.

**Cách làm — đổi KIẾN TRÚC, không đổi cách import:**
  - `renderReviewNodes()` (server, `_components/reviewNodes.tsx`) render sẵn
    nội dung mọi câu. Node đi xuống client dưới dạng phần tử host trong RSC
    payload — client hydrate được mà KHÔNG cần một dòng mã nào của
    react-markdown/KaTeX. Đúng cơ chế TD-023 đã chứng minh ở màn làm bài.
  - CHỈ chuỗi tác giả VỪA SỬA mới cần `RichText` ở client, nạp động với
    `ssr: false`. Ở đây `ssr: false` KHÔNG phải cái bẫy "trang trống rồi mới có
    chữ" mà TD-023 cảnh báo, vì lượt tải đầu không bao giờ đi vào nhánh đó:
    state khởi tạo TỪ `initialExam` — đúng thứ server vừa render — nên mọi chuỗi
    đều khớp. Muốn chuỗi khác đi thì tác giả PHẢI bấm "Sửa" trước, và cú bấm đó
    hâm nóng chunk. Đo được đúng như thiết kế: bấm "Sửa" → +126.3 KB, đúng một
    chunk, đúng lúc đó.
  - `RenderedText` giữ `source` NGAY CẠNH `node`, nên phép kiểm "node này còn
    dùng được không" là một so sánh cục bộ tại chỗ hiển thị. Không có cờ dirty
    nào phải xuyên ba tầng component — tức không có trạng thái thứ hai để lệch
    pha với `exam`.

**Đã kiểm là CHỮ VẪN HIỆN, không chỉ là byte giảm** — đây là rủi ro thật của
bản vá này (mất công thức mà không ai báo lỗi, vì vẫn có chữ hiện ra):
  - đề Hoá 10 (18 câu, 110 dấu `$`) trên prod: **54 node `.katex`**, với 0 byte
    KaTeX tải về. Đề Sinh 12 (40 câu): 7 node.
  - HTML server trả về đã chứa sẵn nội dung câu hỏi, bọc trong `<p>` do
    ReactMarkdown sinh — kiểm bằng cách so chuỗi với body của chính response
    đầu tiên, trước khi có JS nào chạy.
  - 7 test ghim CẢ HAI đường (node server / chuỗi vừa sửa), kể cả đường "không
    có node nào" — nếu nhánh nạp động im lặng trả rỗng thì tác giả mất trắng
    nội dung câu hỏi, nên nó phải có test riêng.

**Bẫy còn nguyên cho lần sau:** `lib/.../reviewNodes.types.ts` giữ className +
`reviewNodeKey`, và nó KHÔNG được phép import `RichText`. Lý do không phải
"cho gọn": component client cần className, và nếu chúng lấy className từ file
có `RichText` thì 126.3 KB quay lại bundle, im lặng, không cổng nào bắt được —
đúng như TD-021 đã đo (một import tĩnh sót lại là route đứng nguyên 181.8K).

### ~~TD-023 — Hai route vẫn vượt ngân sách JS~~ (trả CẢ HAI: xem TD-027 cho nửa sau)
**Trả:** 2026-08-27 — màn làm bài. Màn SỬA ĐỀ **không trả được bằng cách này**,
tách thành **TD-027** ở phần "Đang mở" kèm số đo chứng minh.
**Verify:** `next build` thật + đọc `page_client-reference-manifest.js` từng route.

**Số đo LẠI trên PRODUCTION trước khi sửa** (máy tầm trung, 4× CPU throttle +
slow 4G, 3 lượt/route lấy trung vị) — và số đo này SỬA LẠI tiền đề của chính
mục TD-023 cũ, ở đúng MỘT vế:

TD-023 viết "còn ĐÚNG HAI route vượt ngưỡng ~170 KB". Sai. Đo bằng JS THẬT SỰ
TẢI VỀ (Resource Timing `encodedBodySize`, tức byte đã nén br mà trình duyệt
thật nhận) thì **MỌI route đều vượt** — nền chung đã là 205 KB br, đo ở
`/terms`, một trang chỉ có chữ. Con số 188.4/185.6 KB cũ là "First Load JS" của
`next build` (gzip, cách đếm khác), không phải thứ người dùng tải.

⚠ **CẢNH BÁO VỀ CHÍNH PHÉP ĐO NÀY — đọc trước khi trích số ở dưới.** Lượt đo
đầu tiên trong phiên 2026-08-27 cho ra `/me/exams/[id]` LCP 5.1s / INP 2544ms /
TBT 2388ms. **Những con số đó SAI** và đã bị loại: lúc đó máy đang chạy song
song một `next build` cục bộ, và ở chế độ 4× CPU throttle thì TBT/INP đo được
là hàm của tải máy chứ không phải của trang. Bảng dưới là lượt đo LẠI, chạy
back-to-back với bản preview trên cùng một máy ở cùng điều kiện — đó là phép so
duy nhất có nghĩa. **Byte thì không bị ảnh hưởng** (byte là byte), nên các con
số KB ở cả hai lượt đo đều đứng.

Bài học, vì nó rẻ và sẽ tái diễn: một phép đo hiệu năng có CPU throttle mà chạy
cạnh một build là một phép đo hỏng. Luôn đo A và B back-to-back trên cùng máy,
đừng so một lượt đo hôm nay với một lượt đo lúc khác.

| Route (prod, trước khi sửa) | JS tải về (br) | LCP | INP (max) | TBT | CLS |
|---|---|---|---|---|---|
| `/me/exams/[id]` (sửa đề) | 354.3 KB | 3.7s | 112ms | 404ms | 0 |
| `/exams/[id]/attempt/[attemptId]` (làm bài) | 351.8 KB | 3.4s | 144ms | 512ms | 0.021 |
| nền chung (`/terms`) | 205.4 KB | 2.3s | 128ms | 242ms | 0 |

Nói cho rõ vì nó đổi cách đọc cả mục này: **đo sạch thì site KHÔNG hỏng.** CLS
0 gần như mọi nơi, TTFB ~60ms, INP nằm trong ngưỡng tốt (<200ms) ở mọi route.
Cái vượt ngưỡng là BYTE và TBT, và chúng vượt ở đúng hai route.

Cả hai route nặng nhất vượt vì CÙNG một chunk markdown+KaTeX **126.3 KB br**
(`0k3qsrq5-u33w.js`) — đúng chunk mà TD-021 đã gỡ được khỏi `/result/detail`.

**Đã trả bằng HAI cách khác nhau, vì hai route KHÔNG cùng một bài toán** — và
đây là chỗ mục TD-023 cũ đoán chưa đúng khi kê một cách chung cho cả hai:

- **Màn LÀM BÀI** — dùng đúng cách TD-023 đề xuất: render nội dung câu hỏi ở
  SERVER (`app/(layer2)/_components/questionNodes.tsx`) rồi truyền phần tử
  React xuống `ExamPlayer`/`QuestionRenderer`/`AnswerChoice`. Làm được vì nội
  dung câu hỏi BẤT BIẾN trong suốt một lượt làm bài. Server giao đủ N câu một
  lần (client mới biết `current`, server không).
- **Màn SỬA ĐỀ** — đã THỬ `next/dynamic` và ĐÃ ĐO trên production sau khi
  deploy: **không được gì cả.** Đã revert. Chi tiết ở TD-027.

**Kết quả — đo hai chỗ, vì mỗi chỗ trả lời một câu khác nhau:**

*Trên build thật* (chunk client mà mỗi route THAM CHIẾU, br): route làm bài
không còn tham chiếu chunk markdown+KaTeX nữa.

⚠ Ở đây suýt lọt một kết luận SAI, ghi lại vì nó rẻ và sẽ tái diễn: manifest
cũng báo `/me/exams/[id]` **169.9 → 68.7 KB (−60%)**, và con số đó LÀ THẬT
nhưng ĐO SAI THỨ — nó đếm cái manifest KHAI, không đếm cái trình duyệt TẢI. Đo
lại trên prod thì route đó **354.3 → 356.2 KB**, tức nhích LÊN. Xem TD-027.

*Trên PREVIEW deploy thật*, đo back-to-back với prod cùng máy cùng điều kiện —
màn LÀM BÀI:

| | prod (trước) | preview (sau) |
|---|---|---|
| JS tải về | 351.8 KB br | **225.6 KB br** (−126.2 KB, −36%) |
| TBT | 512ms | **256ms** (−50%) |
| INP trung vị / max | 112 / 144ms | **40 / 56ms** |
| LCP | 3408ms | 3072ms |
| CLS | 0.021 | **0** |

**Đã xác nhận LẠI trên PRODUCTION sau khi merge** (cùng máy, cùng điều kiện):
màn làm bài **351.8 → 225.7 KB br**, TBT **512 → 256ms**, và chunk 126.3 KB
không còn nằm trong danh sách chunk của route. Tức khoản này có thật, đã live.

Màn SỬA ĐỀ: xem TD-027 — cách đã thử không hiệu quả và đã được gỡ bỏ.

**Vì sao mục này KHÔNG để lại phần dư:** nền chung 205 KB br là React 19 +
runtime Next 16 + app shell, không phải thứ gỡ được bằng ranh giới component.
Muốn hạ tiếp thì đó là một quyết định về FRAMEWORK, không phải một món nợ.

### ~~TD-025 — Không có cổng nào xác nhận CSS/JS đã DEPLOY THẬT khớp với build cục bộ~~
**Trả:** 2026-08-27
**Verify:** chạy CẢ HAI CHIỀU — xanh với bản deploy khớp, ĐỎ khi tiêm một khối
CSS hình dạng TD-024 vào artifact cục bộ rồi chạy lại.

```
prod:    npm run verify:deployed -- https://ms-molar.vercel.app
preview: npm run verify:deployed -- 'https://<deploy>.vercel.app/?_vercel_share=<token>'
```
(`scripts/verify-deployed-assets.mjs`; token lấy từ link chia sẻ của Vercel.)

**Nó so cái gì:** không phải hash file. Vercel build trên hạ tầng của nó nên tên
chunk và byte KHÔNG BAO GIỜ khớp `.next-build` cục bộ, kể cả khi mọi thứ đúng —
một cổng đỏ 100% số lần là một cổng bị tắt trong tuần đầu. Thứ so được là NỘI
DUNG NGỮ NGHĨA: mỗi biến CSS khai báo (`--foo:`) và mỗi class selector mà build
cục bộ sinh ra, bản deploy phải có đủ.

**Phép so là ĐỘ PHỦ THEO TỪNG FILE, và đó là bài học từ chính lần chạy đầu:**
gộp toàn bộ CSS cục bộ rồi so với CSS của mấy route công khai cho ra 139 "class
thiếu" — tất cả đều là KaTeX, thiếu vì ĐÚNG (KaTeX chỉ nạp ở route có nội dung
câu hỏi). Nên mỗi file chỉ có hai trạng thái hợp lệ: không được nạp (độ phủ ≤2%
→ bỏ qua) hoặc được nạp (phải ĐỦ TUYỆT ĐỐI, thiếu 1 token cũng đỏ). Trạng thái
thứ ba — nạp một phần — chính là hình dạng TD-024.

**Vì sao ngưỡng "đủ" là 100% chứ không phải 98%:** khối CSS mất tích của TD-024
là MỘT khối cuối file, vài class trên tổng số hàng trăm → 99.2% độ phủ → xanh →
trang vẫn hỏng. Một ngưỡng phần trăm ở đây sẽ để lọt đúng bug sinh ra cổng này.

**Chạy khi nào:** sau MỖI lần ship UI có đụng `globals.css` hoặc thêm asset tĩnh
mới, với URL prod hoặc preview. Cần `.next-build` của ĐÚNG commit đang deploy —
script tự từ chối nếu không có build cục bộ.

**Bài học thứ hai, cũng từ lần chạy thật đầu tiên — trên PREVIEW:** cổng báo
đỏ "thiếu 7 biến CSS TRỌNG YẾU — production đang hỏng". Sai hoàn toàn. Preview
nằm sau Deployment Protection, nên mọi request ăn một redirect sang
`vercel.com/sso-api`, và cổng đã hồn nhiên đi so CSS của TRANG ĐĂNG NHẬP VERCEL
(9 file, 4.3 MB) với build của mình.

Đó là kiểu báo sai NGUY HIỂM NHẤT một cổng có thể mắc: nó không im lặng, nó hô
to đúng cái tên đáng sợ nhất, và nó sai. Đúng một lần như vậy là đủ để người
đọc thôi tin nó. Nên script nay KIỂM ORIGIN của response cuối chuỗi redirect —
lệch origin thì báo RIÊNG ("bản deploy đang bật Deployment Protection, đây
KHÔNG phải TD-024") kèm đúng câu lệnh phải chạy, và nó tự đổi
`?_vercel_share=<token>` lấy cookie để đi tiếp được.

**Đã chạy thật trên preview của chính đợt này:** 603/603 token có mặt đủ.

**Phần nó KHÔNG trả:** nguyên nhân gốc (vì sao build cache của Vercel bỏ sót
thay đổi CSS thuần) vẫn CHƯA xác định được, đúng như TD-025 cũ ghi. Đây là cổng
PHÁT HIỆN, không phải bản vá. Nó biến một sự cố vô hình thành một sự cố nhìn
thấy được — nó không sửa gì cả.

### ~~TD-026 — Không có phân trang thật~~
**Trả:** 2026-08-27 (phần QUYẾT ĐỊNH + phân trang cho `/exams`)
**Verify:** `lib/exams/__tests__/paginate.test.ts` — 12 case, ghim cả phép số
học lẫn bất biến "cắt trang KHÔNG sắp xếp lại".

**Quyết định (engineer uỷ quyền 2026-08-27): XẾP HẠNG TRƯỚC RỒI CẮT.**
`/exams` nay có `?page=`, 12 đề/trang (`lib/exams/paginate.ts`,
`app/(layer2)/_components/ExamPagination.tsx`).

Vì sao đường này trong ba đường TD-026 kê:
- **Cắt-rồi-xếp (DB-side `.range()`)** giảm tải DB nhiều nhất và PHÁ ADR-0015:
  `rankExamIds` chỉ còn nhìn thấy 12 đề của trang hiện tại, nên "xếp hạng cá
  nhân hoá" thành "xếp hạng trong phạm vi 12 đề tình cờ nằm cạnh nhau". Thứ tự
  sai theo trang là kiểu hỏng KHÔNG NHÌN RA ĐƯỢC — trang vẫn đầy đề, chỉ là sai
  đề. Loại.
- **Ranking xuống SQL** đúng cả hai vế, và là một bản viết lại của thuật toán đã
  có test, cho một catalog hiện có **8 đề** (đo prod 2026-08-27). Chi phí đi
  trước nhu cầu.
- **Xếp-rồi-cắt** giữ ADR-0015 NGUYÊN VẸN: `rankExamIds` vẫn nhận trọn tập ứng
  viên, thứ tự y hệt trước, phân trang thuần tuý là chuyện TRÌNH BÀY. Không
  giảm tải DB — đó là cái giá ĐÃ BIẾT, không phải sơ suất.

MỘT ngữ nghĩa phân trang cho CẢ HAI nhánh (`?sort` tường minh lẫn mặc định cá
nhân hoá), cố ý: hai ngữ nghĩa khác nhau làm tổng số trang nhảy khi người dùng
đổi kiểu sắp xếp, và không có cách nào giải thích điều đó cho họ.

**⚠ PHẦN CÒN LẠI, đừng đọc nhầm mục này là đã xong hết:** đây KHÔNG phải phân
trang không giới hạn. `fetchExamRows` vẫn đọc trong biên `LIST_ROW_CEILING`
(500), nên tập ứng viên — và do đó tổng số trang — bị chặn ở cửa sổ đó. Vượt 500
đề thì `readBounded` kêu vào log (dòng mồi) và ĐÓ là tín hiệu chuyển sang đường
SQL, KHÔNG phải để nới hằng số lên. Các danh sách theo-user (`listMyHistory`,
`listMyExams`) chưa phân trang — chúng lớn chậm hơn hẳn và không vướng ranking,
đúng thứ tự ưu tiên mà TD-026 cũ đã kê.

### ~~TD-022 — Không có ngân sách Gemini ở mức PROJECT~~
**Trả:** thực ra đã trả bởi đợt Subscription (commit `72a729d`), SAU khi mục này
được viết — mục này ĐỨNG SAI suốt từ đó. Xác minh lại 2026-08-27.
**Verify:** đọc `lib/billing/quota.ts` + cả hai điểm gọi.

Ngân sách mức project ĐÃ TỒN TẠI và làm đúng thứ TD-022 đòi:
- `ai:budget:{ngày Pacific}` — bộ đếm **KHÔNG theo user**, `INCRBY` bằng đúng SỐ
  REQUEST Gemini sẽ phát (`geminiCalls` là tham số **BẮT BUỘC, không có giá trị
  mặc định** — một mặc định `1` tái tạo im lặng chính cái under-count 2–3× mà nó
  sinh ra để sửa).
- Cửa sổ theo NGÀY PACIFIC, khớp đơn vị reset của nhà cung cấp.
- ĐẶT CHỖ trước khi phát request, hoàn lại cả hai bộ đếm khi bị từ chối.
- `project_budget` là một lý do **PHÂN BIỆT** với `user_quota` — đúng lời phàn
  nàn cốt lõi của TD-022 ("không mã lỗi nào chỉ về đúng nguyên nhân"). Đường
  upload nói với người dùng "tạm thời không dùng được", KHÔNG nói "bạn hết
  lượt", vì nói thế là nói sai (`app/(layer4)/actions.ts`). Telemetry giữ mã
  phân biệt `project_budget_exhausted` (`lib/billing/quotaTelemetry.ts`).
- Fail-CLOSED khi Redis không tới được (`unavailable` → từ chối), cố ý KHÔNG
  thừa kế lớp đệm RAM của `rateLimit.ts` — bộ đếm process-local nhân lên theo số
  instance nên không bao giờ chặn nổi một ngân sách toàn dự án.

**Bài học ghi lại vì nó sẽ tái diễn:** một món nợ được trả ở một nhánh khác
(Subscription) mà sổ nợ không ai cập nhật thì nó vẫn "đang mở" trong mắt mọi
phiên sau — và phiên sau sẽ đi làm lại một việc đã xong. Trả nợ và ĐÓNG SỔ là
hai việc, không phải một.

### ~~TD-024 — Overlay "Loading" hiện toàn phần trên MỌI tải trang production, không do bấm gì~~
**Từ:** 2026-08-17 (engineer báo lại kèm ảnh chụp — overlay "LOADING" phủ kín
trang chủ prod ngay từ lần tải đầu, tương tác các thành phần khác vẫn bình
thường)

`RouteLoadingOverlay` (lớp phủ chuyển trang, thêm cùng ngày) hiện đè kín mọi
trang trên `ms-molar.vercel.app`, không tắt được, không do một cú bấm cụ thể
nào kích hoạt — chỉ cần tải trang là thấy. Ba đường tắt đã viết sẵn trong
component (URL mới commit, popstate/pageshow, hẹn giờ 12s) đều không cứu được
vì bug không nằm ở state JS.

**Nguyên nhân xác định bằng đo, không suy luận:** `getComputedStyle` trên
production trả `opacity: 1; visibility: visible` NGAY CẢ KHI `data-pending`
đọc đúng là `"false"` — tức JS toggle đúng, chỉ CSS quyết định ẩn/hiện là
thiếu. Kiểm CSS bundle đã deploy (`grep route-loading` trên file `.css` tải
từ `https://ms-molar.vercel.app/_next/static/...`) ra **0 kết quả** — toàn bộ
khối `.route-loading { opacity:0; visibility:hidden }` vắng mặt. Đối chiếu:
git blob của ĐÚNG commit đã deploy (`8be5340`) có đủ 10 dòng khớp
`route-loading`; `next build` chạy cục bộ trên cùng commit đó cũng cho ra CSS
đúng. Vậy lệch pha xảy ra trong chính bước build của Vercel, không phải do
quên commit hay do trình duyệt người dùng cache cũ (kiểm bằng Playwright phiên
mới tinh, không cookie/cache cũ, vẫn ra kết quả giống hệt).

**Đã trả 2026-08-17** — không tìm được tham số "bỏ qua build cache" nào cho
API tạo deployment (kể cả qua Composio), nên sửa bằng cách đổi NỘI DUNG THẬT
của `globals.css` (thêm đoạn cảnh báo sự cố này ngay tại chỗ) để bước build kế
tiếp không còn artifact cũ nào để tái dùng, rồi deploy lại
(`9dabe1a2cd15fc32256a89f73482e5bd00839975`).

**Verify (đo lại trên chính production sau khi sửa):**
- Tên file CSS đổi hash thật (`2hthv7rrgemj1.css` → `25_fg3gc056lk.css`) —
  xác nhận đây là artifact MỚI, không phải cache được phục vụ lại.
- `getComputedStyle` trên tải trang mới: `opacity: 0; visibility: hidden` khi
  `data-pending="false"` — đúng thiết kế.
- Điều hướng thật qua click: `data-pending` chuyển `true → false` trong ~1
  giây, không kẹt.

**Bài học giữ lại:** 5 cổng verify chuẩn của dự án (tsc/eslint/vitest/build/
check:bundle) ĐỀU XANH trước khi ship — không cổng nào phát hiện được sự cố
này vì tất cả chỉ kiểm cục bộ, không cổng nào hỏi "CSS/JS đã lên Vercel thật
có khớp bản build không". Phần lỗ hổng quy trình này CHƯA trả, tách thành
[[TD-025]].

### ~~TD-019 — `extractAndAssemble` không có rate limit, vét sạch hạn ngạch AI dùng chung~~
**Từ:** 2026-08-17 (rà bảo mật toàn repo; Semgrep 117 rule/769 file ra 0 finding,
mục này đến từ vòng thủ công OWASP A07/A08, không phải từ scanner)

`extractAndAssemble` — action ĐẮT NHẤT dự án — là Server Action DUY NHẤT chạm
Gemini mà không có `guard()` nào. Mỗi lần gọi: 2 file × 15MB, một lượt đọc PDF
bằng mupdf/WASM, rồi **2 request Gemini (Manual) hoặc 3 (Automatic)** chạy song
song ở stage 5. Hạn ngạch thật: **20 request/NGÀY cho CẢ project** (free tier).

**Vì sao nó tệ hơn "một action thiếu guard":** nó làm HỎNG một guard khác đã
viết đúng. `RATE_LIMITS.explainStep` được thiết kế rất kỹ (3 lượt/NGÀY, cửa sổ cố
ý trùng đơn vị ngày của nhà cung cấp, kèm cả một đoạn giải thích vì sao cửa sổ
theo giờ không đặt được trần cho hạn ngạch theo ngày) — và chính comment đó đã
ghi "cùng key đó còn phục vụ trích xuất PDF ở `lib/ugc/gemini.ts`". Nhưng đường
trích xuất ấy không bị đếm. Kết quả: **7 lần upload của MỘT tài khoản đã đăng
nhập là hết sạch 20 lượt/ngày**, rồi gia sư của toàn bộ người dùng chết — trong
khi không ai vượt trần 3 lượt của mình. Một trần trên giấy.

**Đã trả 2026-08-17** — `RATE_LIMITS.uploadExam = { limit: 5, windowMs: 24h }`,
`guard("uploadExam", user.id)` đặt NGAY sau `requireUser()`. Ba chi tiết cố ý:
- **Vị trí là điểm sớm nhất còn có khoá để đếm.** Trước `requireUser()` thì chưa
  có `user.id`; sau bước validate file thì đã trả giá phần đắt nhất (đọc/parse
  file) rồi mới từ chối — một vòng lặp gửi rác vẫn bắt server làm hết việc.
- **Xếp vào nhóm "supplier-capped", không phải nhóm "tốn DB của chính ta".** Test
  phân loại sẵn có đòi nhóm tốn-DB phải `limit >= 15`; xếp nhầm là hợp thức hoá
  đúng cái lỗ vừa vá.
- **5 chứ không nhỏ hơn:** đăng đề là việc TẠO GIÁ TRỊ chính của Layer 4, siết
  xuống 1–2 là chặn người dùng thật để phòng kẻ tấn công chưa xuất hiện.

**Cổng canh mới, và nó bắt thứ mà từng trần riêng lẻ KHÔNG bắt được:** kiểm từng
cái thì 3 và 5 đều "dưới 20", trong khi cộng lại một tài khoản vẫn vét sạch. Test
mới quy đổi sang SỐ REQUEST GEMINI (explainStep ×1, uploadExam ×3) và ghim tổng
worst-case của một tài khoản ≤ 20 — hiện là **18**. Thêm lời gọi AI thứ tư vào
pipeline sẽ làm case này đỏ kèm chỉ dẫn trần nào phải hạ.

**Verify:** `npx vitest run lib/security/rateLimit.test.ts` → 10 passed. Đủ 5 cổng
sau khi sửa: `tsc --noEmit` sạch · `eslint --max-warnings 0` sạch · `vitest run`
**728 passed / 10 skipped** · `next build` không warning · `check:bundle` PASS.

**Phần KHÔNG trả được, đã tách thành TD-022:** trần khoá theo `user.id` nên bó
được một tài khoản chứ không bó được TỔNG — 2 tài khoản dùng hết phần mình vẫn
hết hạn ngạch project.

### ~~TD-021 — Chunk markdown+KaTeX 122.5 KB gzip nằm trong bundle đầu của trang chỉ-đọc~~
**Từ:** 2026-08-17 (rà hiệu năng; Next 16 + Turbopack KHÔNG còn in bảng
`Size`/`First Load JS` sau build, nên số đo lấy bằng cách đọc
`page_client-reference-manifest.js` của từng route rồi gzip từng chunk thật)

Ba route vượt ngân sách ~170 KB gzip, và cả ba vượt vì CÙNG một chunk:
`react-markdown + remark-gfm + remark-math + rehype-katex + rehype-sanitize +
katex` = **122.5 KB gzip / 415.9 KB raw** — chunk client lớn nhất dự án, lớn hơn
toàn bộ phần JS còn lại của phần lớn route. Đo bằng cách diff tập chunk giữa hai
route anh em: `/…/result/detail` (181.8 K) trừ `/…/result` (94.4 K) ra đúng chunk
đó.

Chỗ sai thật nằm ở `/…/result/detail`: đây là trang **chỉ đọc**, nhưng nó trả
122.5 KB cho MỌI người xem — kể cả người làm đúng hết. Lý do: `RichText` mang
`"use client"` (dù không có hook/state/handler nào), nên 4 chỗ page.tsx render nó
ở vị trí server vẫn tạo ranh giới client; và `ExplainStepAffordance` (client)
import tĩnh nó, dù bảng gợi ý chỉ hiện khi học sinh đã sai câu đó HAI lần VÀ chủ
động bấm nút.

**Đã trả 2026-08-17** — hai thay đổi, và **cả hai đều bắt buộc**. Đây là chỗ dễ
làm nửa vời nhất nên số đo cả 4 tổ hợp ghi lại ở đây:

| `RichText` | import trong tutor | `/…/result/detail` |
|---|---|---|
| client | tĩnh | 181.8 K gzip (bản gốc) |
| **server** | tĩnh | 181.8 K — bỏ directive MỘT MÌNH không đổi gì |
| client | động | 183.2 K — nạp động MỘT MÌNH còn tệ hơn (thêm wrapper) |
| **server** | **động** | **60.7 K** |

→ **−121.1 KB gzip (−66%)**, route tụt từ trên ngưỡng xuống dưới hẳn. Bài học
đáng giữ: hai thay đổi mà mỗi cái đo riêng đều ra **0**, gộp lại ra 66% — nếu chỉ
làm một cái rồi đo, kết luận đúng sẽ là "cách này vô dụng".

`ssr: false` ở chỗ nạp động là ĐÚNG chứ không phải để né lỗi: `hint` chỉ tồn tại
sau một lời gọi Server Action từ tương tác người dùng, nên lượt render server nó
luôn rỗng.

**Cổng canh:** cảnh báo đặt ngay đầu `RichText.tsx` — thêm lại `"use client"` vào
file đó là đẩy 122.5 KB sang trình duyệt cho mọi route render nội dung câu hỏi;
cần state thì bọc một client component MỎNG ở ngoài. Test
`ExplainStepAffordance.test.tsx` nay chờ đúng thẻ `<strong>` xuất hiện — vừa là
bằng chứng chunk đã resolve, vừa đúng nghĩa vụ chứng minh sẵn có của case đó
(đường render đi qua markdown, không phải plain-text).

**Verify:** `vitest run components/tutor components/shared` → 61 passed (gồm
nguyên bộ XSS fixtures của RichText). Đủ 5 cổng như TD-019.

**Phần KHÔNG trả được, đã tách thành TD-023:** `/me/exams/[id]` (188.4 K) và
`/exams/[id]/attempt/[attemptId]` (185.6 K) vẫn vượt ngưỡng — ở đó nội dung câu
hỏi nằm trong cây client thật và phải có NGAY, nên không dùng lại được cách này.

### ~~TD-020 — 2 CVE trong phụ thuộc production~~
**Từ:** 2026-08-17 (`npm audit --omit=dev`)

- `nanoid <3.3.18` (**high**, GHSA-2v37-7h3g-55p8) qua `next@16.3.0 → postcss`.
- `dompurify <=3.4.12` (**moderate**, GHSA-55q2-fjhq-7xh7 — XSS: IN_PLACE hook
  removal để lại subtree tách rời vẫn thực thi được) qua `jspdf@4.2.1`.

**Đã trả 2026-08-17** — `npm audit fix` (KHÔNG `--force`; cảnh báo cũ ở TD-007
vẫn nguyên giá trị: `--force` từng đề xuất hạ `next` xuống 9.3.3). Chỉ
`package-lock.json` đổi, không chạm `package.json`: dompurify 3.4.12→3.4.13,
nanoid 3.3.17→3.3.18. `npm audit --omit=dev` sau khi vá → **0 vulnerabilities**
(cả `npm audit` đầy đủ cũng 0).

Ghi lại vì hai đường tiếp cận đều dễ kết luận nhầm theo hướng ngược nhau:
`--omit=dev` vẫn báo `nanoid` dù `@tailwindcss/postcss` là devDependency — nó
đến qua `next` (đường prod thật), nên "chỉ là dev dependency" là sai. Ngược lại
`npm audit fix --omit=dev` chạy thử thì đòi gỡ 332 gói (nó dọn luôn devDeps khỏi
`node_modules`) — chạy bản đó để "cho an toàn" mới là thứ làm hỏng cây làm việc.

### ~~TD-015 — `eslint-config-next` lệch phiên bản với `next`~~
**Từ:** 2026-08-04 (ghi nhận lần đầu trong PROCESS.md, chưa từng vào sổ)

`package.json` ghim `eslint-config-next@16.2.7` trong khi `next` đã lên `16.3.0`.
Không ai cố ý để lệch: TD-007 nâng `next` bằng `npm audit fix`, việc đó không
đụng `eslint-config-next` vì nó không nằm trong đường phụ thuộc bị advisory. Lint
là cổng CHẶN merge (TD-010), nên một bộ rule đặc thù Next.js đi sau chính bản
Next đang chạy là khoảng hở im lặng trên chính cổng được kỳ vọng bắt lỗi.

**Đã trả 2026-08-17** — `eslint-config-next` 16.2.7 → **16.3.0**, khớp `next`
đang chạy. `npm run lint` (`--max-warnings 0`) vẫn sạch sau khi nâng, tức bản
mới không flag thêm gì trong source hiện tại.

**Một chi tiết phải giữ lại, vì nó suýt trôi qua:** `npm install -D
eslint-config-next@16.3.0` ghi vào `package.json` thành `^16.3.0` — đổi luôn
CHÍNH SÁCH ghim của dep này (trước đó là bản duy nhất trong repo ghim CHÍNH XÁC,
không caret, và đó là chủ đích: nó phải đi lockstep với `next`). Đã sửa lại thành
`16.3.0` đúng nghĩa rồi `npm install` cho khớp lockfile. Nâng phiên bản mà vô
tình nới quy ước ghim là đúng cách để món nợ này quay lại theo hướng ngược.

### ~~TD-018 — 9 file test rỗng làm cổng `npm test` ĐỎ trên mọi push~~
**Từ:** 2026-08-14 (phát hiện khi chạy full suite cho một việc khác)

Commit `fdad2b8` thêm 9 file `*.test.ts(x)` chỉ có comment, không
`describe`/`it` nào → Vitest tính mỗi file là suite FAIL (`No test suite found
in file`), cổng `npm test` đỏ trên mọi push dù 558 assertion đều xanh.

**Đã trả 2026-08-15** — đo lại trước khi sửa: 7/9 file đã được implement thật ở
các commit sau đó (`795ab38`, `1c2c02d`, `7352960`...), chỉ còn đúng 2 file rỗng
— `components/tutor/ExplainStepAffordance.test.tsx` và
`app/(layer3)/_components/SkillRecommendationCard.test.tsx`. Cả hai đổi sang
`it.todo(...)` (một dòng mỗi test case đã đặc tả sẵn trong skeleton — 5 test cho
ExplainStepAffordance, 3 cho SkillRecommendationCard), giữ nguyên toàn bộ
comment ROI/proof-obligation phía trên làm tài liệu cho lần implement thật.

**Không implement thật 2 file này** — component chúng test
(`ExplainStepAffordance.tsx`, `useTutorAction.ts`, `SkillRecommendationCard.tsx`)
CHƯA TỒN TẠI trong repo (`ls` xác nhận, không phải suy đoán); test thật cho
component chưa build là không thể viết, đúng lý do TD-018 tách "trả cổng" ra
khỏi "implement thật" ngay từ đầu.

**Verify:** `npx vitest run` → `Test Files 67 passed | 2 skipped (69)`,
`Tests 649 passed | 8 todo (657)`, exit 0. `tsc --noEmit` và `npm run lint`
(`--max-warnings 0`) cũng xanh trên 2 file đã sửa.

**Còn nợ:** implement thật 8 test case (`it.todo` → nội dung) khi
ExplainStepAffordance/SkillRecommendationCard được build — việc của nhánh
Engine 1, chưa mở lại thành mục riêng vì đã có sẵn đặc tả đầy đủ ngay trong
file.

### ~~TD-016 — `subject` không canonical trong `questions` VÀ `exams`~~
Bản mô tả ban đầu (2026-08-08) SAI ở hai chỗ, phát hiện khi đo lại bằng
`service_role` trên dev thay vì suy từ code:
  - **Không chỉ `questions`.** `exams.subject` cũng bẩn (2 đề mang `'Toán'`).
    10 câu hỏi bẩn chính là câu của đúng 2 đề đó — UGC cascade `subject`/`topic`
    từ đề xuống câu, nên đếm ở tầng `questions` là nhìn cái BÓNG, không phải
    cái gốc.
  - **Không phải `seed.ts`.** Cả 2 đề là UGC người dùng thật upload
    (`ugc-f8ec9b8a…`, `ugc-9c857be4…`, 2026-07-20 00:06/01:03 UTC), có
    `author_id`. `lib/ugc/subjects.ts` ra đời commit `971a4fe` lúc 15:33 UTC
    CÙNG NGÀY — tức 14 tiếng SAU. Dữ liệu tồn dư của thời chưa có canonical
    hoá, không phải một đường ghi rò rỉ hàng ngày.

**Đường ghi đã bịt 2026-08-14** — `validateExamMeta` (`lib/ugc/validateInput.ts`,
đường **Manual**) trước đây chỉ kiểm `subject` khác rỗng rồi ghi thẳng chuỗi
thô. Mọi đường khác đã canonical hoá từ trước (`parseTypedMeta`/`saveExam` dùng
`isSubject`; đường Automatic dùng `normalizeMeta` → `normalizeSubject`). S-01
render `<select>` từ `SUBJECTS` nên UI không tạo được giá trị lạ — nhưng đây là
**server action**, FormData không được tin. Vá bằng `normalizeSubject` TRƯỚC
rồi mới đòi canonical (alias sửa được thì sửa, chỉ từ chối cái không map nổi —
cùng hàm đường Automatic dùng, hai đường không thể lệch kết luận), kèm 4 test.

**Cổng canh (mới, sống lâu dài):** `verify-schema.ts` mục 8 hỏi thẳng DB "có
dòng nào ngoài `SUBJECTS` không", cho cả `questions` lẫn `exams`. Khác 7 mục
kia ở chỗ soi DỮ LIỆU chứ không phải cấu trúc — hình dạng hỏng giống hệt
TD-001/TD-005: không mã lỗi, không log, chỉ THIẾU.

**Dữ liệu đã dọn 2026-08-14** — `supabase/one-off/2026-08-14-td016-canonical-subject.sql`
(idempotent, sửa cả `subject` lẫn `topic`, chỉ sửa `topic` khi nó đang phản
chiếu `subject` — tránh đổi mảnh vỡ này lấy mảnh vỡ khác ở facet `topic`, nơi
taxonomy Engine 1 đọc vào). Áp qua Composio (`SUPABASE_BETA_RUN_SQL_QUERY`),
không phải paste tay:
  - **dev**: 10 câu + 2 đề → canonical. Đo trước/sau: `questions.subject=Math`
    37→47, `exams.subject=Math` 4→6, cả 10 câu có `topic` khớp `subject` sau vá.
    `npm run verify:schema` mục 8 xanh (57/57 câu, 8/8 đề canonical).
  - **prod**: đo trước khi vá — **0 dòng bẩn sẵn** (28 câu/3 đề, toàn bộ
    `Math`). Hai đề bẩn chỉ tồn tại trên dev (tài khoản test upload lúc dev
    testing), chưa từng chạm prod. Không cần chạy UPDATE nào ở đây — xác nhận
    bằng đếm subject trên toàn bảng, không chỉ bằng truy vấn "có dòng bẩn
    không" (loại trừ khả năng bảng rỗng làm truy vấn dương tính giả).

### ~~TD-014 — `ADMIN_USER_IDS` mất scope Preview trên Vercel~~
`ADMIN_USER_IDS` chỉ còn scope **Production**. Nguyên nhân đã biết từ S#46:
`vercel env rm` gỡ biến khỏi **mọi** scope chứ không chỉ scope được chỉ định —
một lần `rm` rồi `add` lại vô tình làm mất Preview. Hệ quả: `/admin` trên **mọi**
Preview deploy luôn 404 cho tất cả mọi người, kể cả tài khoản đúng quyền — không
phân biệt được với đăng nhập nhầm tài khoản (đúng hình dạng TD-009: fail-closed
im lặng). Từng xếp "chưa vá ngay" vì không chặn được gì hôm nay, nhưng nó là bẫy
cho người TIẾP THEO: thấy 404 rồi đi debug nhầm hướng.

**Đã trả 2026-08-14** — thêm entry mới `ADMIN_USER_IDS` scope **Preview**
(type `sensitive`, id `bmhkQ05v9a6dKLYo`), giá trị là UUID admin trên Supabase
**dev**, lấy từ `SOURCE/.env.local` (Preview trỏ dev). Làm qua Composio
(`VERCEL_ADD_ENVIRONMENT_VARIABLE`), **`upsert: false`** — cố ý, để entry
Production (`PuSygCGTweNdWPNo`) không bị đụng tới; đã đọc lại danh sách sau khi
ghi và xác nhận `updatedAt` của nó không đổi. Đây chính là bài học của S#46:
món nợ này SINH RA từ một thao tác env vô tình chạm nhiều scope hơn dự định,
nên cách trả nó phải là thao tác chỉ-thêm, không phải `rm` rồi `add` lại.

**Hai điều người sau cần biết:**
- **Env chỉ có hiệu lực với deploy MỚI.** Preview deploy đang tồn tại vẫn 404
  `/admin`; phải push/redeploy rồi mới kiểm được.
- **Chưa xác minh end-to-end.** Giá trị dev là suy ra từ `.env.local` + ghi chú
  TD-014, KHÔNG phải đọc được từ Vercel (biến `sensitive` không đọc lại được),
  và `docs/DEPLOYMENT.md` mà mục này từng dẫn chiếu **nay không còn tồn tại**
  trong repo. Nếu Preview hoá ra không trỏ dev thì `/admin` vẫn 404 — đúng như
  hiện trạng, không hỏng thêm gì, vì biến này chỉ gác `/admin`.

### ~~TD-017 — `instrumentation.ts` import tĩnh `node:crypto` vào Edge bundle~~
**Từ:** 2026-08-09 (phát hiện qua warning trong log build/deploy Vercel, không
chặn build)
**Loại:** vận hành, fragile-nhưng-chưa-hại

`instrumentation.ts` dùng `import` TĨNH cho `checkSchemaVersion.ts` →
`schemaFingerprint.ts` (`node:crypto`). `register()` bail-out sớm khi runtime
không phải `nodejs`, nên nhánh gọi `createHash()` không bao giờ CHẠY trên Edge —
nhưng import tĩnh kéo cả cây phụ thuộc vào Edge bundle lúc BUILD, không cần biết
runtime có chạy tới đó hay không. Nó "chạy được" chỉ vì Turbopack mới WARN chứ
chưa hard-fail; một bản Edge runtime siết chặt hơn có thể biến cảnh báo này
thành lỗi thật trên **mọi** request đi qua `proxy.ts` (gần như toàn site).

**Đã trả 2026-08-09** — cả hai import chuyển thành `await import(...)` bên TRONG
nhánh `if (process.env.NEXT_RUNTIME === "nodejs")`; đầu file nay không còn
import tĩnh nào.

**Verify (đo thật, không suy luận):** chạy `npm run build` HAI lần trên cùng cây
làm việc — bản trước khi sửa in `Warning: A Node.js module is loaded
('node:crypto' at line 30) which is not supported in the Edge Runtime` kèm khối
`Edge Instrumentation:`; bản sau khi sửa không còn dòng cảnh báo nào (grep
`crypto|warn|Warning|Edge` trên toàn log build → 0 kết quả). Đây là cách duy
nhất phân biệt "đã sửa" với "cảnh báo vốn không xuất hiện ở máy local".

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
