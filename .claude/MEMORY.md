# MS-MOLAR — Memory Consolidated (2026-08-06)

> File này thay thế phần lớn Claude Code auto-memory chi tiết trước đây. Toàn bộ lịch sử implementation + theme được lưu ở file này thay vì trong memory ẩn.

## 1. Nội dung được giữ lại trong Claude Code memory

- **Test accounts** (password chung `rls-test-password-123`):
  - `smithnguyen247+rlstesta@gmail.com` — tài khoản test chính, hiển thị tên "AnhPhat" trên navbar
  - `smithnguyen247+rlstestb@gmail.com`
  - `smithnguyen247+se2rater1@gmail.com` … `+se2rater10@gmail.com` — 10 tài khoản dùng để test rating threshold (N=3 raters)
  - ⚠️ KHÔNG đụng `smithnguyen247@gmail.com` và `nguyenphatbentre904@gmail.com` — đây là tài khoản thật của user (không có `+alias`)

## 2. Workflow tổng thể mỗi phiên

Ba pha, chạy theo thứ tự. Pha 2 tồn tại để pha 1 của phiên SAU tìm lại được việc dang dở.

### Pha 1 — Checking (đầu phiên)

1. **Tool**: xác nhận thứ sắp dùng còn sống, đừng giả định. 
   - `composio` MCP: Dùng Composio MCP (`COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, toolkit `notion`, `supabase`, `vercel`, `google drive` đã connected). Composio CLI không được hỗ trợ trên Window. Bỏ qua thay vì cố cài.
2. **Việc dang dở**: đọc Notion database **MS-MOLAR** (`3b378ba6-ae12-803c-8500-c572b6fc745f`) — lọc row khác trạng thái "Hoàn tất". Kèm `TECH-DEBT.md` + `docs/plans/` + git commited list.
3. Chỉ tiếp tục việc cũ khi engineer yêu cầu; mặc định hỏi trước khi tự nối tiếp.

### Pha 2 — Notion (ghi nhận)

Tạo/cập nhật row trong database MS-MOLAR. Thuộc tính: `Tên nhiệm vụ`, `Trạng thái` (Chưa bắt đầu/Đang thực hiện/Hoàn tất), `Mô tả`, `Loại nhiệm vụ`, `Mức độ ưu tiên`, `Mức độ công sức`, `Hạn chót` (hỏi nếu chưa biết). Thân page ghi **số đo và lý do**, không chỉ liệt kê việc — phiên sau đọc lại cần hiểu *tại sao*, không chỉ *cái gì*.

Mọi nợ kỹ thuật còn mở trong đó đã chuyển vào `TECH-DEBT.md`; các mục còn lại đều đã được phiên sau giải quyết. Quyết định cũ giờ tra ở Notion database MS-MOLAR (row đã đóng) hoặc git log.

### Pha 3 — Implementation

1. **Code**: nghiên cứu các thông tin liên quan đến mission hoặc task --> khởi động `dev-workflows-fullstack` với `/recipe-fullstack-implement` (hoặc skills `recipe-plan` / `recipe-implement` / `recipe-fullstack-build` / `recipe-front-*` / `recipe-review`; agent chuyên biệt như `quality-fixer`, `code-reviewer`. Chỉ inovke đối với mission - các task lớn).
2. **UI audit**: Thực hiện workflow kiểm tra UI theo `E:\StemWeb_project\MS-MOLAR\.claude\skills\ui-audit\ui-interaction-audit.skill` - Lưu ý: sử dụng Playwright CLI (thay vì bản MCP server như trong skill)
3. **Cổng verify** — chạy đủ **6**, trong `SOURCE/`, TRƯỚC khi commit:
   `npx tsc --noEmit` · `npx eslint --max-warnings 0` · `npx vitest run` ·
   `npm run build` · `npm run test:fixture` · `npm run test:localdb`
   `next build` bắt lỗi ranh giới server/client mà `tsc` không thấy — đừng bỏ.

   ⚠️ **Vì sao là 6 chứ không phải 4 (nâng 2026-08-29, TD-030).** `npx vitest run`
   chỉ chạy config MẶC ĐỊNH, và config đó chỉ gom `lib/**`, `components/**`,
   `app/**` (`vitest.config.ts:19`). Repo có **bốn** làn vitest:

   | Làn | Lệnh | Gom gì |
   |---|---|---|
   | mặc định | `npx vitest run` | `lib/`, `components/`, `app/` |
   | fixture | `npm run test:fixture` | `tests/e2e/fixture/**` (~5 giây) |
   | localdb | `npm run test:localdb` | `tests/e2e/service/**` (~31 giây) |
   | integration | `npm run test:integration` | `tests/integration/**` (cần credential — chạy khi đụng tới) |

   Bỏ ba làn sau nghĩa là một làn có thể **đỏ trên `main` bao lâu cũng được** mà
   mọi commit vẫn "qua đủ cổng". Đúng thế đã xảy ra: `test:fixture` đang đỏ 2 ca
   trên `main` khi phát hiện (TD-030), và hai ca đó kiểm đúng pattern
   `aria-disabled` mà cả repo dựa vào.

   **Kiểm bằng exit code THẬT, không suy từ chuỗi `&&`.** Đã có lần một lượt chạy
   nền cho kết quả vitest chập chờn mà lần chạy sạch bác bỏ — khi một làn đỏ, hãy
   xác định nó đỏ vì thay đổi của mình hay đã đỏ sẵn: bỏ file mới ra chạy lại, và
   `git checkout main` chạy lại. Hai chiều đó phân biệt được lỗi mình gây ra với
   lỗi mình vừa phát hiện.
4. **Commit + push**: branch trước, không commit thẳng `main` trừ khi engineer bảo thế.
   ⚠️ Cây làm việc thường có sẵn thay đổi CHƯA COMMIT của engineer. Trước mọi `git checkout -- <file>` / `git restore`, đối chiếu `git status` đầu phiên xem file đó đã bẩn từ trước chưa — revert nhầm là xoá việc của họ, không hoàn lại được.
5. **Deploy**: **tự làm bằng `vercel` qua `composio MCP`** (đã cài + đăng nhập + link sẵn), chạy trong `SOURCE/`:
   - Preview: `vercel` → trả link, gửi engineer duyệt.
   - Production: `vercel --prod`, hoặc promote bản preview đã duyệt.
   - Mặc định đi preview trước với thay đổi diện rộng (theme, i18n, auth); chỉ vào thẳng prod khi engineer bảo.
   - Push `main` cũng kích hoạt build prod tự động — coi chừng deploy hai lần.
   - Có skill `vercel:deploy` và `vercel:status`. Danh sách biến môi trường:
     `SOURCE/.env.example`; giá trị thật đặt ở Vercel → Settings → Environment
     Variables (Preview trỏ Supabase **dev**, Production trỏ **prod**).
6. **Đóng vòng**: cập nhật lại row Notion (trạng thái + kết quả verify + link deploy + việc còn lại).

### Pha 3.5 — Kiểm DB prod TRƯỚC khi launch (TD-005, đã nổ 4 lần)

Deploy Vercel **không đụng gì tới database**. "Code đã live trên prod" và "DB
prod có đủ bảng/cột cho code đó chạy" là hai trạng thái ĐỘC LẬP — CI (`tsc`,
`vitest`, `next build`) chỉ so khớp fingerprint **cục bộ trong repo**, không
hỏi database thật. Từng nổ 4 lần (TD-005, gần nhất 2026-08-15: prod thiếu
nguyên schema Support System + Engine 1 — 6 bảng — vì bước "apply schema.sql
lên prod trước launch" chỉ tồn tại dưới dạng câu ghi chú trong work plan,
không phải checklist item có ai tick).

**Bắt buộc TRƯỚC khi coi một feature có bảng/cột mới là "xong" trên production**
(không phải chỉ khi deploy code — ngay cả khi chỉ nghi ngờ, hoặc trước khi
đóng row Notion sang "Hoàn tất"):

1. So fingerprint: `select fingerprint from public.schema_version` trên prod
   (qua Composio `SUPABASE_RUN_READ_ONLY_QUERY`, ref lấy từ
   `SUPABASE_LIST_ALL_PROJECTS`) đối chiếu với literal ở cuối
   `SOURCE/supabase/schema.sql` (khối `insert into public.schema_version`).
   Lệch = prod đang tụt lại, bất kể code đã deploy hay chưa.
2. Nếu lệch: xác nhận với engineer trước khi apply DDL lên prod (dữ liệu thật,
   không tự quyết một mình) — kiểm trước `drop table`/`truncate`/`delete`/
   `update` nào chạm dữ liệu hiện có, rồi hậu kiểm bằng truy vấn thật (đếm
   bảng, thử insert/select qua phiên user thật) — đừng tin mỗi thông báo
   "success".
3. **MỖI LƯỢT APPLY ĐÚNG MỘT CÂU LỆNH.** Chạy `npm run schema:plan` trước để
   lấy danh sách có SỐ (`scripts/schema-plan.ts` cắt `schema.sql` theo ranh
   giới câu lệnh, tôn trọng `$$...$$`, chuỗi và comment) rồi apply từng câu
   theo đúng thứ tự đó.

   ⚠️ **Vì sao là quy tắc chứ không phải lời khuyên (đo 2026-08-31, hai lần
   trong một phiên):** gửi nhiều câu lệnh trong MỘT chuỗi thì công cụ apply
   chạy câu ĐẦU, bỏ phần còn lại, và trả về `successful: true` kèm tên của
   đúng câu đầu ấy — `revoke ...; grant ...;` → `"command": "REVOKE"`;
   `drop policy ...; create policy ...;` → `"command": "DROP POLICY"`. Lượt
   apply TRÔNG NHƯ đã xong. Hệ quả lần đó: một RLS policy vừa tạo ra đã gọi
   tới một hàm mà `authenticated` không có quyền chạy, và không có gì đỏ ở
   đâu cả.

   Hậu kiểm phải đọc CATALOG, không đọc `information_schema`: quyền trên hàm
   đọc ở `pg_proc.proacl`, policy đọc ở `pg_policies`.
   `information_schema.routine_privileges` trả RỖNG dưới
   `supabase_read_only_user` và trông y hệt "grant chưa có" — một dương tính
   giả theo chiều ngược lại.
4. Không đợi "trước khi launch" như một lời hứa mơ hồ — kiểm ngay khi
   `schema.sql` đổi trong cùng phiên đó, cho MỌI project Supabase đang connect
   (dev lẫn prod), không chỉ project đang test.

## 3. Theme — "Mực & Sơn mài" (Ink & Lacquer)

**Toàn bộ quy tắc theme nay nằm ở `PROJECT_OVERVIEW.md` §2** (chuyển tới đó
2026-09-03, cùng đợt xoá các trích dẫn tới `DESIGN.md` — file đã bị xoá có chủ
đích 2026-08-06, đừng khôi phục). Mục này rút thành con trỏ thay vì giữ bản thứ
hai: repo này đã trả giá nhiều lần cho hai nguồn chân lý nói khác nhau.

Ba điều cần nhớ mà không cần mở file:

1. **Nguồn giá trị token là `SOURCE/app/globals.css`** — khi nó lệch với văn xuôi
   trong `PROJECT_OVERVIEW.md` §2 thì `globals.css` thắng.
2. **Không hardcode hex.** Dùng token (`text-[color:var(--muted-foreground)]`).
   Vài giá trị trong bảng bản sắc KHÔNG đạt WCAG nên code cố ý dùng biến thể khác
   (`--ring`, `--input`, `--muted-foreground`, `--brand-on-dark`).
3. **Phẳng:** không box-shadow, không gradient, không pill; serif chỉ cho tiêu đề.
