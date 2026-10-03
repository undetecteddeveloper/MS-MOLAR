# Ghi chú vùng: Database (Supabase)

## Hai project — xác nhận bằng TÊN, không bằng trí nhớ
- `pebjdlbgbmizgfpuptjl` = **MS-MOLAR-prod**. `hynwleaxtbtjzkvpjsug` = **dev**. `SOURCE/.env.local` trỏ dev.
- Project "linked" của Supabase CLI (`supabase/.temp`) là PROD: luôn kèm `--project-ref`, không bao giờ `supabase db push` (hook chặn).
- Trước mọi lệnh Composio Supabase: `SUPABASE_LIST_ALL_PROJECTS`, đối chiếu ref với tên (2026-09-06 từng truy vấn nhầm prod tưởng dev).
- `.mcp.json` có Supabase MCP gắn cứng ref PROD (`--read-only`): không dùng trực tiếp.
- Dữ liệu mẫu cho test/chụp màn hình lấy từ dev, chỉ đọc; tạo lượt làm bài bằng giao diện với tài khoản test, không bằng SQL.

## Quy trình đổi schema (đúng thứ tự)
1. Sửa `SOURCE/supabase/schema.sql` (bản chuẩn). Đặt DDL đúng chỗ DB mới cần (vd cột sinh ra trên `exams` phải đứng TRƯỚC §12b tạo lại `exams_with_difficulty`, vì `e.*` đóng băng cột lúc tạo view).
2. `npm run schema:plan` in fingerprint mới (exit 1 cho tới khi §17 khớp). Ghi fingerprint vào §17 (`insert into public.schema_version … values (1, '<fp>')`) VÀ `SCHEMA_FINGERPRINT` trong `lib/schema/schemaFingerprint.ts`.
3. Viết `supabase/migrations/<YYYYMMDDhhmmss>_<slug>_<fp>.sql`: các câu delta chép NGUYÊN VĂN từ schema.sql (test `migrationsMatchSchema` so câu đã chuẩn hoá) + upsert fingerprint cuối file. Upsert của migration được khác schema.sql miễn bằng fingerprint trong tên file.
4. Áp lên dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/<file>` (nhiều câu OK). Kiểm bằng truy vấn thật (`pg_extension`, `information_schema.columns`, `pg_indexes`, `schema_version`), rồi `npm run verify:schema` (chế độ behavioural chạy trên dev). RPC mới: thêm probe vào `verify-schema.ts` và test localdb trong `tests/e2e/service/`. CLI treo (từng hết giờ sau 90 giây) → áp dev qua Composio `SUPABASE_BETA_RUN_SQL_QUERY` (`read_only:false`).
5. Bước này KHÔNG đụng prod; ghi vào commit và PROGRESS.md. Không bao giờ sửa migration đã áp.

## Sửa hàm/ràng buộc đã có trong migration cũ: chỉ THÊM, không sửa tại chỗ
`migrationsMatchSchema` đòi MỌI câu của MỌI migration sau baseline vẫn còn nguyên văn trong schema.sql, nên sửa thân hàm cũ = đỏ. Để định nghĩa cũ yên; thêm mục mới trước §17 với `drop function if exists …; create function …` (ràng buộc: `drop constraint if exists` + `add constraint`; cột mới: `add column if not exists` thành câu riêng, không nhét vào `create table` cũ). Migration mới = mục đó chép nguyên văn + upsert fingerprint. Đổi `returns table` hay chữ ký cũng cần `drop`. Sinh file migration bằng script node cắt từ schema.sql (file CRLF: chuẩn hoá trước khi so). So thân hàm dev với prod: `md5(regexp_replace(pg_get_functiondef(oid) …))` bỏ comment.

## Áp lên PROD (rủi ro cao — chỉ khi người dùng yêu cầu rõ trong phiên, CLAUDE.md §5)
Qua Composio: xác nhận ref prod bằng TÊN → `SUPABASE_APPLY_A_MIGRATION` (ref, name, query) từng file một theo thứ tự tên file → sau MỖI file đọc lại `select fingerprint from public.schema_version;` bằng `SUPABASE_RUN_READ_ONLY_QUERY` để lỗi lộ đúng bước. Dữ liệu ngoài migration theo thiết kế (vd `admin_users`, ADR-0021) đi bằng `SUPABASE_BETA_RUN_SQL_QUERY` `read_only:false` như DML thường, không qua APPLY_A_MIGRATION. Tiền lệ: 2026-09-19 (kệ đề), 2026-09-27 (community-solutions task 52).

## Bẫy đã biết
- `unaccent()` là STABLE: bọc bằng từ điển nêu rõ (`extensions.unaccent('extensions.unaccent'::regdictionary, …)`) trong hàm IMMUTABLE trước khi dùng trong cột sinh ra/index. Toán tử `pg_trgm` cần `operator(extensions.<%)` và `extensions.word_similarity` khi `search_path = ''`; `word_similarity` khớp một đoạn LIÊN TỤC nên test mờ phải dùng cụm liên tục của tiêu đề.
- RLS trên `exams` còn kiểm `is_author_banned(author_id)` (false khi author null).
- Công cụ SQL của Composio chỉ chạy câu ĐẦU của chuỗi nhiều câu; CLI `db query` chạy được nhiều câu (dùng cho `set enable_seqscan = off; explain …`).
- Hàng nháp UGC rỗng trên dev từng làm đỏ cổng chủ đề chuẩn của `verify:schema` (TD-016); script TD-016 một lần không phủ chủ đề chuỗi rỗng (đã xử lý, không lặp lại).
