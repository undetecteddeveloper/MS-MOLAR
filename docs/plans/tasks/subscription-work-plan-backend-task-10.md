# Task: Gate A — text-side assertions, including the two new ones

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.2**
Layer: **backend** (schema test code)

Metadata:
- Dependencies: backend-task-09 (plan Task 1.1 — the DDL text these assertions read)
- Provides: gate A green — the **precondition for plan Task 1.3** (the dev apply); also carries P-1 structural half for plan Task 3.1
- Size: Small (1–2 test files)

## Implementation Content

`npm test` must be green with **four** text-side assertions over `SOURCE/supabase/schema.sql`, using `readFileSync` — **no database, no credential**:

1. `parseForeignKeys.test.ts` — both new FKs declare `on delete`; the four `text` transfer columns add none.
2. `schemaFingerprint.test.ts` — the three fingerprint values agree.
3. **New allowlist assertion** — the `payment_orders` block column set is **exactly** the eleven declared. This is P-1 structural half: an **allowlist, not a blocklist**, so any twelfth column fails the case.
4. **New parse case** — every `error_code in ( … )` occurrence in `schema.sql` — **there are now two** — yields exactly `TELEMETRY_ERROR_CODES`.

## Target Files
- [x] `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` (new allowlist case; existing cases unmodified)
- [x] `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (new `error_code in ( … )` parse case; existing cases unmodified)

## Investigation Targets
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` (existing case shape and the `readFileSync` idiom)
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (existing case shape)
- `SOURCE/lib/schema/parseForeignKeys.ts` (the parser these cases drive)
- `SOURCE/supabase/schema.sql` (the `payment_orders` block from plan Task 1.1; **both** `error_code in ( … )` occurrences — the inline one near `:1381-1382` and the new drop/add pair)
- `SOURCE/lib/tutor/telemetry.ts` (`:35` `TELEMETRY_ERROR_CODES` — the constant the parse case compares against)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy)
- `docs/design/subscription-backend-design.md` (§ Security / P-1)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `payment_orders`) | structure-order | The `payment_orders` column set is **exactly** the eleven declared: `order_code`, `user_id`, `amount`, `status`, `created_at`, `pending_until`, `settled_at`, `qr_payload`, `account_number`, `account_name`, `memo` — an allowlist, not a blocklist | The allowlist assertion enumerates exactly these eleven names and fails on any twelfth column |
| `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1) | state-lifecycle-negative | **P-1 (normative).** No field of the provider `transactions[]` may be persisted to any column or reach any log. `settleOrder()` reads exactly **two** values from the provider response — the order `status` and its `amount` | The allowlist case is the structural half of P-1: a persisted `transactions[]`-derived column cannot pass it |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record both `error_code in ( … )` line locations
- [x] Write the allowlist case and the two-occurrence parse case; confirm each **fails** first against a deliberately perturbed copy of the schema text (a twelfth column; a one-literal-short list) — a case that cannot go red proves nothing
### 2. Green Phase
- [x] Point the cases at the real `schema.sql`; run `npm test` and confirm green
### 3. Refactor Phase
- [x] Confirm the existing `parseForeignKeys` and `schemaFingerprint` cases are unmodified and still pass

## Quality Assurance Mechanisms
- `parseForeignKeys.test.ts` (text-side, `readFileSync`, no DB) — Enforces: TD-011, every FK declares `on delete` — Config: `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`
- `schemaFingerprint.test.ts` (text-side) — Enforces: TD-005 — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: run `npm test` from `SOURCE/`. All four assertions read `schema.sql` from disk; no database is contacted.
- **Success criteria**: `parseForeignKeys.test.ts`, `schemaFingerprint.test.ts` and the two added cases are all green; the added `error_code in ( … )` case reports **two** matched occurrences.
- **Failure response**: a failure in **either** gate **stops the phase** — do not proceed to implementation and do not apply the DDL to any database.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
- **Claim**: the DDL text in git carries exactly the designed structure, and both telemetry literal lists agree with the code-side constant.
- **Primary failure mode**: **the parse case finds one occurrence and passes** — the drift this assertion exists to prevent, where the inline list is widened and the drop/add pair is not (or vice versa), and only one of the two databases ends up correct.
- **Boundary to exercise**: the schema file read from disk (`readFileSync`) — no DB boundary.
- **State assertion**: N/A (no state is written).
- **Mock boundary rationale**: none — the real file is read; mocking the file would assert the mock.
- **Residual**: gate A proves nothing about any database. Gate B (plan Tasks 1.3, 5.8) does, and a matching fingerprint proves which build is running, not that the content is present.

## Completion Criteria
- [x] All added tests pass; `npm test` green (gate A)
- [x] The added parse case asserts it matched **both** `error_code in ( … )` occurrences, not merely that one matched
- [x] The allowlist case fails against a fabricated twelfth column (demonstrated in the Red phase)
- [x] Existing assertions in both test files are unmodified
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: schema text-side tests; downstream, plan Task 1.3 may not start until this is green.
- Scope boundary: no DDL is edited here; `SOURCE/lib/tutor/telemetry.ts` is not edited (plan Task 5.5 owns it).

## Investigation Notes
(Record the two matched `error_code in ( … )` locations and the Red-phase perturbation results here.)

### Đọc Investigation Targets (2026-08-18)

**Hai vị trí `error_code in ( … )` trong `SOURCE/supabase/schema.sql`** (xác nhận
bằng `grep -n`, đúng **hai** lần, không hơn):

| # | Dòng | Câu lệnh chứa nó | Vai trò |
|---|---|---|---|
| 1 | `:1382` | `create table if not exists public.telemetry_log ( … error_code text check ( … ) … )` — CHECK inline | Để một lần provision **MỚI** là đúng |
| 2 | `:1813` | `alter table public.telemetry_log add constraint telemetry_log_error_code_check check ( … )` (đi sau `drop constraint if exists`) | Để một DB **ĐÃ** provision (dev + prod) là đúng — `create table if not exists` là no-op ở đó |

Cả hai đang mang **sáu** literal: `gemini_unavailable`, `rate_limited`, `server`,
`not_eligible`, `user_quota_exhausted`, `project_budget_exhausted`.

**Các mốc khác đã đọc**
- `parseForeignKeys.ts` — parser cố ý ngây thơ; `balancedBody`/`splitTopLevel`
  KHÔNG export (test phải tự có bản sao cục bộ; `parseForeignKeys.ts` ngoài
  Target Files nên không được sửa để export).
- `parseForeignKeys.test.ts` / `schemaFingerprint.test.ts` — idiom `readFileSync`
  + `resolve(__dirname, "../../../supabase/schema.sql")`, hai nhóm test: nhóm 1
  kiểm chính parser trên mẩu SQL dựng sẵn, nhóm 2 là cổng thật trên file thật.
  Ca mới bám đúng hình dạng này.
- `schema.sql:1610-1649` — khối `payment_orders`, mười một cột theo đúng thứ tự
  DD khai; không có ràng buộc mức bảng nào.
- `telemetry.ts:35` — `TELEMETRY_ERROR_CODES` còn **bốn** literal (Task 5.5 sở hữu).
- `telemetry.test.ts:49` `SCHEMA_ERROR_CODES` (bốn, chép tay) và `:261` equality —
  KHÔNG chạm.
- DD `:703` (P-1 → allowlist), `:575` (một ca **thêm** parse mọi `error_code in ( … )`),
  `:1192-1218` (§ Verification Strategy — gate A đọc FILE, gate B mới là DB).

### Xung đột trong đặc tả và cách giải đã chọn

Assert #4 viết nguyên văn là *"mỗi occurrence yields exactly `TELEMETRY_ERROR_CODES`"*.
**Không thể xanh hôm nay**: SQL có sáu, `TELEMETRY_ERROR_CODES` có bốn, và thứ tự
đó là ĐÚNG (nới CHECK trước, code phát mã sau — plan Task 5.5 sở hữu phía code).
Hai lối thoát bị cấm: sửa `telemetry.ts` (ngoài phạm vi) và làm nhẹ assert thành
`toContain`/so hai chỗ SQL với nhau (trả về cổng xanh không phân biệt được gì).

Cách giải đã chọn — **tách một assert không xanh nổi thành hai assert đều xanh
được và đều đỏ được**:

1. **Hợp đồng trên VĂN BẢN SQL (hiệu lực ngay)**: hằng `SCHEMA_TELEMETRY_ERROR_CODES`
   chép tay sáu literal (đúng lối `telemetry.test.ts:49`), rồi một `toEqual` duy
   nhất khoá cả ba việc: đúng **hai** site, đúng **hai loại câu lệnh** (`create
   table` và `add constraint`), và **mỗi** site đúng bằng sáu literal theo thứ tự.
2. **Bẫy bắt phía code (hiệu lực tại Task 5.5)**: ca ghim đúng độ lệch tạm thời
   `SQL \ TELEMETRY_ERROR_CODES === ['user_quota_exhausted','project_budget_exhausted']`
   và `TELEMETRY_ERROR_CODES \ SQL === []`. Ca này **đỏ ngay khi** Task 5.5 nới
   hằng số — thông điệp fail chứa sẵn đoạn thay thế (assert equality cuối cùng
   mà DD `:575` yêu cầu). Drift im lặng vì thế không tồn tại ở cả hai chiều.

**Cái nó bắt được**: mọi thay đổi tập literal ở một trong hai site SQL (thiếu,
thừa, sai thứ tự, sai chỗ đặt); và việc phía code nới ra mà không quay lại đóng
assert cuối. **Cái nó KHÔNG bắt được**: hôm nay nó chưa chứng minh
`TELEMETRY_ERROR_CODES === ` tập SQL — đó đúng là việc Task 5.5 phải làm, và bẫy
là thứ ép nó phải làm.

### Pha ĐỎ — ba mutant, chạy thật, output ghi lại (2026-08-18)

Mutant chỉ nằm trong BỘ NHỚ (script backup → vá → chạy → khôi phục; `git diff`
sau đó là 151/165 dòng THÊM, **0 dòng xoá**, tức không mutant nào còn trên đĩa).

| # | Perturbation | Ca đỏ | Output quan sát được |
|---|---|---|---|
| P1 | chèn cột thứ 12 `counter_account_name` vào khối `payment_orders` | `tập cột đúng bằng MƯỜI MỘT cột đã thiết kế` | `Tests 1 failed \| 18 passed (19)` — diff chỉ đúng một dòng `+ "counter_account_name"` xen giữa `settled_at` và `qr_payload` |
| P2 | xoá `'project_budget_exhausted'` khỏi **CHỈ** danh sách thứ hai (`add constraint`) | `đúng HAI occurrence, đúng hai loại câu lệnh, mỗi bên đúng sáu literal` | `Tests 1 failed \| 12 passed (13)` — diff chỉ ra `- "project_budget_exhausted"` **trong site `construct: "add constraint"`**, site `create table` vẫn đủ sáu. Đây đúng bằng chế độ hỏng chính mà Proof Obligations gọi tên |
| P3 | giả lập plan Task 5.5 nới `TELEMETRY_ERROR_CODES` lên sáu | `BẪY cho plan Task 5.5` | `Tests 1 failed \| 12 passed (13)` — `expected [] to deeply equal ['user_quota_exhausted','project_budget_exhausted']`, kèm nguyên đoạn assert cuối cùng phải dán vào thay ca bẫy |

Ngoài ra hai ca "bằng chứng đỏ" (P1 và P2 phiên bản rút gọn) nằm **thường trực**
trong hai file test và chạy mọi lần `npm test` — đúng lối nhóm-1/nhóm-2 mà hai
file này vốn dùng ("nếu parser mù một dạng cú pháp, cổng ở nhóm 2 sẽ xanh một
cách vô nghĩa").

### Đối chiếu Reference Contracts (Exit Gate)

| Source | Compliance Check | Kết quả | Bằng chứng |
|---|---|---|---|
| DD § Schema, `payment_orders` (structure-order) | allowlist liệt kê đúng mười một tên và đỏ với cột thứ mười hai | **Y** | `PAYMENT_ORDERS_COLUMNS` chép tay mười một tên đúng thứ tự; `toEqual` (không phải `toContain`/subset) nên thừa/thiếu/sai thứ tự đều đỏ; P1 chứng minh chiều "thừa" |
| DD § Sensitivity / P-1 (state-lifecycle-negative) | một cột phái sinh từ `transactions[]` không thể lọt qua | **Y** | Cột mutant P1 lấy đúng tên một trường `transactions[]` thật (`counter_account_name`) và bị chặn **vì nó là cột thứ 12**, không vì tên — nên trường mà DD v1.3 bỏ sót (`counterAccountBankName`, `virtualAccountName`) cũng bị chặn y hệt |

### Cổng đã chạy

- `npx vitest run` (toàn dự án): **919 pass / 10 skip, 88 pass + 1 skip trên 89 file** (nền trước đó 914 pass → +5 ca mới)
- `npx tsc --noEmit`: 0 lỗi
- `npm run lint` (`eslint --max-warnings 0`): sạch
- **KHÔNG** chạy `npm run verify:schema` (gate B — plan Task 1.3), không chạm DB, không dùng credential nào.

### Còn lại cho phía sau

- **plan Task 5.5**: nới `telemetry.ts:35` + `telemetry.test.ts:49` lên sáu literal → ca **BẪY** trong `schemaFingerprint.test.ts` sẽ ĐỎ; thông điệp fail chứa sẵn assert cuối cùng phải dán vào thay nó. Đỏ ở đó là TÍN HIỆU, không phải hồi quy.
- **plan Task 1.3**: gate A đã xanh, đây là điều kiện tiên quyết duy nhất mà task này nợ nó. Gate A không chứng minh gì về bất kỳ database nào.
