# Task: Named values and environment registration (incl. the one `periodStartEpoch()`)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.4**
Layer: **backend** (`SOURCE/lib/billing/**`, `SOURCE/lib/env/**`, `SOURCE/.env.example`)

Metadata:
- Dependencies: none inside Phase 1 (independent of the DDL); ordered here because plan Tasks 2.1, 3.3, 3.4, 5.1 and 5.6 all consume its exports
- Provides: `PREMIUM_PRICE_VND`, `ORDER_PENDING_WINDOW_MS`, `PLAN_LIMITS`, **the single exported `periodStartEpoch()`**, and five registered environment variables
- Size: Medium (4–5 files)

## Implementation Content

**`SOURCE/lib/billing/pricing.ts` (new)**
- `PREMIUM_PRICE_VND = 39000`
- `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000` — the **one** constant that feeds `payment_orders.pending_until`, payOS `expiredAt`, **and** `createOrder()` step (0) reuse predicate.

**`SOURCE/lib/billing/quota.ts` (new)**
- `PLAN_LIMITS = { free: { tutor: 5, upload: 3 }, premium: { tutor: 500, upload: 15 } }` — declared here, **not** in the frozen `types.ts`.
- **The one period-start derivation (I004)**, beside `PLAN_LIMITS`:
  `export function periodStartEpoch(plan, anchor, createdAt, now): number`
  implementing the backend DD `:841-842` formula **exactly once** — premium ⇒ `subscriptions.period_anchor_at`; free ⇒ `user_profiles.created_at + 30d × floor((now − created_at) / 30d)`; **unchanged during grace** (AC-011: grace grants access, never allowance). It returns the integer epoch that forms the `{periodStartEpoch}` segment of `quota:{kind}:{userId}:{periodStartEpoch}`.
  **Both the read path (plan Task 2.1, which needs it for `used` and `resetsAt`) and the write path (plan Task 5.1, which increments the key) import this function; neither re-derives it.** Two independent derivations three phases apart is the same two-producers-of-one-contract class as CL-01, but **silent**: a rounding or ms-vs-s difference makes the screen say *n* remaining while the gate refuses, and nothing goes red.

**`SOURCE/lib/env/checkEnv.ts`** — add five branches in the same change that first reads them:
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (level matching `GEMINI_API_KEY` precedent)
- `AI_BUDGET_FREE_SHARE` (**warn**, default 50% stated)
- `AI_BUDGET_DAILY_LIMIT` (**fail-closed, no default** — a missing spend ceiling must not read as an unlimited one)

**`SOURCE/.env.example`** — all five, each with **the consequence of leaving it blank**.

## Target Files
- [x] `SOURCE/lib/billing/pricing.ts` (new)
- [x] `SOURCE/lib/billing/quota.ts` (new — `PLAN_LIMITS` + `periodStartEpoch()`; `consumeQuota()` arrives in plan Task 5.1)
- [x] `SOURCE/lib/env/checkEnv.ts`
- [x] `SOURCE/.env.example`
- [x] `SOURCE/lib/billing/__tests__/quota.test.ts` and `SOURCE/lib/env/__tests__/checkEnv.test.ts` (added cases)

## Investigation Targets
- `SOURCE/lib/env/checkEnv.ts` (the existing per-variable branch shape and levels)
- `SOURCE/lib/billing/paidTier.ts` (`:26` — `GEMINI_PAID_TIER_ENABLED` fail-closed shape that `AI_BUDGET_DAILY_LIMIT` must match)
- `SOURCE/lib/billing/types.ts` (**frozen** — read to confirm what must *not* move there; `Quota`, `Entitlement`)
- `SOURCE/lib/billing/readEntitlement.ts` (`:34` — the future importer of `periodStartEpoch()`, plan Task 2.1)
- `SOURCE/.env.example` (existing entry style, incl. how consequences are worded)
- `SOURCE/lib/env/__tests__/` (existing env test shape)
- `docs/design/subscription-backend-design.md` (§ Named values (I012))
- `docs/design/subscription-backend-design.md` (§ Integration Point I5)
- `docs/design/subscription-backend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-backend-design.md` (§ The two counters count different things — the `:841-842` period-start formula)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance) | contract_schema | "Keep the pending-order window and the provider `expiredAt` **the same number**, set from one shared constant" | `ORDER_PENDING_WINDOW_MS` is declared once in `pricing.ts` and is the only source of the pending window and of payOS `expiredAt` |

## Boundary Context (from the plan Connection Map)

**Boundary**: *Read path ↔ write path of the same per-user counter key* (one serialized key string, two producers).
- **Owner (left)**: `SOURCE/lib/billing/readEntitlement.ts` (read: `used` and `resetsAt`)
- **Owner (right)**: `SOURCE/lib/billing/quota.ts` (write: `INCR` at the gate)
- **Serialized Format**: `quota:{kind}:{userId}:{periodStartEpoch}` — `periodStartEpoch` is the **integer epoch** returned by the single exported `periodStartEpoch(plan, anchor, createdAt, now)` in `SOURCE/lib/billing/quota.ts`; no second derivation, no re-rounding, no ms/s conversion at either call site.
- **Consumer Parse Rule**: Both sides **import** `periodStartEpoch()`; neither recomputes `period_anchor_at` or `created_at + 30d × floor(…)` locally. A repo-wide search for the key template must return **exactly one** construction site.
- **Expected Signal**: the key string produced on the read path and on the write path is **byte-identical** for the same user at the same instant — asserted for three fixtures: premium with an anchor; free at creation-day 15 / 29 / 31; a user inside grace (`periodStart` unchanged, AC-011). If they diverge, the screen says *n* remaining while the gate refuses and **nothing goes red**.
- **Roundtrip check this task must satisfy**: the epoch this function emits is the exact value both consumers will embed — this task ships the single producer; the byte-identity assertion across both call sites lands in plan Task 5.1, once both exist.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record `paidTier.ts:26` fail-closed shape verbatim
- [x] Write failing tests first: one per environment variable **absent and present**; `periodStartEpoch()` with **hardcoded literal expected epochs** (never read back from the implementation) for premium-with-anchor, free at creation-days 15 / 29 / 31, and a user inside grace whose value is **unchanged** from before the grace boundary
### 2. Green Phase
- [x] Implement `pricing.ts`, `quota.ts` (`PLAN_LIMITS` + `periodStartEpoch()`), the five `checkEnv.ts` branches and the five `.env.example` entries
- [x] Run only the added tests and confirm they pass
### 3. Refactor Phase
- [x] Confirm the free-user formula exists in exactly one place and no caller copies it
- [x] After exporting `PREMIUM_PRICE_VND` and `ORDER_PENDING_WINDOW_MS`, reconcile the two transcriptions in `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` — assert `FIXTURE_AMOUNT_VND === PREMIUM_PRICE_VND` and its local 30-minute window against `ORDER_PENDING_WINDOW_MS` (or import the real constants and delete both transcriptions) — until then, a price or window change leaves the service-lane fixture silently seeding the old value

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: every unit and text-side gate in the Test Boundaries tables — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: discriminated-union exhaustiveness on `Quota` — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs`
- `npm run build` -> `next build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with mocked boundaries per the backend DD Test Boundaries table — each env variable exercised absent and present; `periodStartEpoch()` compared against hardcoded literal epochs.
- **Success criteria**: every variable has a passing absent-case and present-case; **`AI_BUDGET_DAILY_LIMIT` absent fails closed**, matching `paidTier.ts:26`; all `periodStartEpoch()` literal-epoch cases green, including the grace case where the value is unchanged.
- **Failure response**: if the absent case for `AI_BUDGET_DAILY_LIMIT` reads as unlimited, **stop** — a missing spend ceiling that reads as no ceiling is the failure this registration exists to prevent.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
- **Claim (missing config)**: each configuration variable behaves correctly absent and present, and the spend ceiling and release flag fail **closed** when absent.
- **Primary failure mode**: `AI_BUDGET_DAILY_LIMIT` missing is treated as unlimited spend.
- **Boundary to exercise**: `checkEnv.ts` against a stubbed `process.env` (in-process unit).
- **State assertion**: N/A.
- **Mock boundary rationale**: only `process.env` is stubbed; no I/O.
- **Residual**: does not prove the budget is enforced — plan Task 5.1 does.

- **Claim (shared-state dependency, I004)**: the period-start derivation has **exactly one** implementation, so the display path and the enforcement path cannot disagree.
- **Primary failure mode**: a second derivation (a rounding or ms-vs-s difference) makes the screen report remaining allowance while the gate refuses — **and nothing goes red**.
- **Boundary to exercise**: in-process unit now; the cross-path byte-identity comparison lands in plan Task 5.1.
- **State assertion**: for a user inside grace, `periodStartEpoch()` before the grace boundary === after it (AC-011: grace grants access, never allowance).
- **Mock boundary rationale**: none — the function is pure over its four arguments; the clock is passed in as `now`.
- **Residual**: single-site ownership is proven here; **byte-identity across the two call sites is proven in plan Task 5.1**, once the write path exists.

## Completion Criteria
- [x] All added tests pass
- [x] One unit test **per environment variable, absent and present**, all green
- [x] `periodStartEpoch()` literal-epoch cases green (premium-with-anchor; free at days 15 / 29 / 31; grace unchanged)
- [x] `PLAN_LIMITS` is `{ free: { tutor: 5, upload: 3 }, premium: { tutor: 500, upload: 15 } }` and is **not** in `types.ts`
- [x] `PREMIUM_PRICE_VND = 39000` and `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000` declared once, in `pricing.ts`
- [x] All five variables in `SOURCE/.env.example` with the consequence of leaving each blank
- [x] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/**`, `SOURCE/lib/env/checkEnv.ts`, `SOURCE/.env.example`; downstream, plan Tasks 2.1, 3.3, 3.4, 5.1, 5.6.
- Scope boundary: `SOURCE/lib/billing/types.ts` is **frozen** and must not receive `PLAN_LIMITS` or anything else from this task.

## Investigation Notes
(Record the literal expected epochs used, the `paidTier.ts:26` shape, and the Binding Decision evidence here.)

### Đã đọc (Investigation Targets)

- **`SOURCE/lib/env/checkEnv.ts`** — hàm THUẦN `checkEnv(env)` nhận env làm tham số (không đọc `process.env`), trả `EnvProblem[]` với `level: "error" | "warn"`. `error` = "tính năng lõi hỏng"; `warn` = "một mảng chức năng lặng lẽ tắt" (định nghĩa ở `:22-24`). Hình dạng một nhánh: `if (!get(NAME)) problems.push({ level, name, impact })`, `impact` mô tả bằng thứ người vận hành quan sát được. Tiền lệ `GEMINI_API_KEY` `:77-80` = **warn**. Tiền lệ `GEMINI_PAID_TIER_ENABLED` `:142-154` = **hai nhánh** (vắng → warn "fail-closed, cố ý"; có nhưng không hợp lệ → warn kèm giá trị bị từ chối).
- **`SOURCE/lib/billing/paidTier.ts:26` (chép nguyên văn)**: `const AFFIRMATIVE = new Set(["1", "true"]);` — kèm docblock `:22-25`: *"Mọi thứ khác — kể cả không đặt, chuỗi rỗng, "yes", "on", hay một khoảng trắng — đều là TẮT. Quên đặt biến thì hậu quả là KHÔNG BÁN ĐƯỢC, chứ không phải BÁN NHẦM"*. Đọc env **một lần, lúc gọi**, mặc định fail-closed, không có default "mở". `AI_BUDGET_DAILY_LIMIT` lấy đúng hướng đó: vắng ⇒ **từ chối**, không bao giờ ⇒ *không giới hạn*.
- **`SOURCE/lib/billing/types.ts` (ĐÓNG BĂNG)** — chứa `Plan`, `Quota` (union có discriminant `unknown | known`), `Entitlement`, `FREE_FALLBACK`, `isQuotaExhausted`. **Không có** bảng hạn mức, **không có** kiểu "kind". Xác nhận: `PLAN_LIMITS` không được chuyển vào đây. Task này chỉ *đọc* kiểu `Plan` từ đó, không sửa một ký tự nào.
- **`SOURCE/lib/billing/readEntitlement.ts:34`** — `export async function readEntitlement(userId: string | null): Promise<Entitlement>`, thân hàm hiện trả `FREE_FALLBACK`. Chữ ký KHÔNG đổi; plan Task 2.1 chỉ thay thân và sẽ `import { periodStartEpoch }`.
- **`SOURCE/.env.example`** — mỗi khối có tiêu đề `# --- Tên khối (ADR/PRD) ---`, và mỗi biến nêu **hệ quả của việc để trống** (vd `ADMIN_USER_IDS` `:37-38`: "Để trống = KHÔNG AI là admin và /admin trả 404 (fail-closed, cố ý)"). Biến bí mật có tiền tố `⚠ BÍ MẬT`.
- **`SOURCE/lib/env/__tests__/checkEnv.test.ts`** — `goodEnv(over)` là bộ "không còn gì để báo"; docblock `:26-29` ràng buộc: *"mọi biến có nhánh warn khi vắng đều phải có mặt ở đây"*. Nên năm biến mới **bắt buộc** phải vào `goodEnv()`, nếu không ca "im lặng tuyệt đối" đỏ.
- **DD § Named values (I012) `:550-561`** — bảng bốn giá trị; `AI_BUDGET_FREE_SHARE` giữ default 50% + `warn`; `AI_BUDGET_DAILY_LIMIT` "integer, no default — absent ⇒ fail closed".
- **DD § Integration Point I5 `:1071`** — payOS credential ⇒ mức theo tiền lệ `GEMINI_API_KEY` (`:77-80`) = warn; `AI_BUDGET_FREE_SHARE` ⇒ warn kèm default; `AI_BUDGET_DAILY_LIMIT` ⇒ fail-closed theo tiền lệ `GEMINI_PAID_TIER_ENABLED` (`:142-154`).
- **DD § Field Propagation Map `:1119`** — `quota:{kind}:{userId}:{periodStartEpoch}`, "the period start is *in the key*, so reset needs no job".
- **DD `:858-866`** (công thức `:841-842` của bản cũ) — nguyên văn:
  `periodStart = premium ? subscriptions.period_anchor_at : userProfile.created_at + 30d × floor((now − created_at)/30d)`, và *"Grace grants access, never allowance … `periodStart` is unchanged"*.
- **`docs/adr/ADR-0013` § Implementation Guidance** — *"Keep the pending-order window and the provider's `expiredAt` **the same number**, set from one shared constant."*

### Quyết định đơn vị và hình dạng (ghim ở đây vì hai phía sau đều đọc lại)

- **`periodStartEpoch()` trả về MILLIGIÂY** (`Date.prototype.getTime()`), không phải giây. Lý do: cả hai phía gọi đều đã cầm `Date`/`Date.now()` ở đơn vị ms, nên chọn ms là chọn **không có phép quy đổi nào** ở hai đầu — đúng yêu cầu "no ms/s conversion at either call site" của Connection Map. Một lần `/1000` ở một phía mà không có ở phía kia chính là lỗi I004 mô tả.
- Tham số thời gian đều là `Date` (`anchor: Date | null`, `createdAt: Date`, `now: Date`). PostgREST trả ISO string ⇒ chỗ gọi làm `new Date(row.created_at)`; đó là một phép chuyển **toàn phần**, khác hẳn việc mỗi chỗ gọi tự chọn đơn vị.
- Giữ **chữ ký vị trí bốn tham số** `periodStartEpoch(plan, anchor, createdAt, now)` đúng như task file và Connection Map ghim, dù coding-principles gợi ý gộp ≥3 tham số vào object — hợp đồng đã ghim thắng gợi ý phong cách, và đổi nó sẽ là một thay đổi interface ngoài phạm vi task.
- `PERIOD_MS = 30 ngày` để **private** trong `quota.ts` (chưa có consumer nào ở task này). **Bàn giao cho plan Task 2.1**: `resetsAt = periodStart + 30d` cần đúng khoảng này — hãy *export* hằng đó từ `quota.ts` khi cần, **đừng khai lại 30d ở `readEntitlement.ts`**, vì hai lần khai 30d là đúng hình dạng I004.
- `quota.ts` và `pricing.ts` **không** có `import "server-only"` ở task này: cả hai chỉ là hằng + số học thuần, chưa chạm Redis hay bí mật nào. Plan Task 5.1 (thêm `consumeQuota()` + Redis) là chỗ thêm nó.
- **Không ghim cách mã hoá số của `AI_BUDGET_FREE_SHARE`** (0.5 hay 50). PRD `:218`/AC-023 chỉ nói "50%", DD chỉ nói "default 50%"; hai kỹ sư ngang nhau có thể chọn khác nhau, và nhánh mà I5 yêu cầu là nhánh **hiện diện**, không phải nhánh phân tích cú pháp. `checkEnv` vì thế chỉ đòi "một số hữu hạn > 0" — đúng dưới cả hai cách mã hoá — và test khẳng định cả `"0.5"` lẫn `"50"` đều im lặng, để việc không-ghim là một khẳng định chứ không phải một chỗ bỏ sót. Chỗ đọc (`quota.ts`, plan Task 5.1) ghim cách mã hoá.

### Epoch literal dùng trong test (tính độc lập bằng `Date.UTC`, không đọc ngược từ implementation)

`PERIOD_MS = 30 × 24 × 60 × 60 × 1000 = 2_592_000_000`

| Ca | Đầu vào | Epoch kỳ vọng (literal) | ISO |
|---|---|---|---|
| Free, ngày 15 | `createdAt = 1768468653123` | `1768468653123` | `2026-01-15T09:17:33.123Z` |
| Free, ngày 29 | `now = 1770974253123` | `1768468653123` | `2026-01-15T09:17:33.123Z` |
| Free, ngày 29.999 | `now = 1771060566723` | `1768468653123` | `2026-01-15T09:17:33.123Z` |
| Free, mili giây CUỐI của kỳ 1 (`created_at + 30d − 1`) | `now = 1771060653122` | `1768468653123` | `2026-01-15T09:17:33.123Z` |
| Free, đúng ngày 30 | `now = 1771060653123` | `1771060653123` | `2026-02-14T09:17:33.123Z` |
| Free, ngày 31 | `now = 1771147053123` | `1771060653123` | `2026-02-14T09:17:33.123Z` |
| Free, ngày 61 | `now = 1773739053123` | `1773652653123` | `2026-03-16T09:17:33.123Z` |
| Premium, có anchor | `anchor = 1772549110500` | `1772549110500` | `2026-03-03T14:45:10.500Z` |
| Premium trong ân hạn (`now` = hết hạn + 1 ngày = `1775227510500`) | cùng `anchor` | `1772549110500` — **không đổi** | `2026-03-03T14:45:10.500Z` |

`createdAt` cố ý ở `09:17:33.123Z` = **16:17:33.123 giờ máy này (Asia/Saigon, UTC+7)** — không phải nửa đêm ở *cả hai* múi. Nên epoch kỳ vọng mang theo phần giờ-phút-giây-ms, và **mọi** implementation cắt về mốc ngày (dù cắt theo UTC hay theo giờ địa phương) đều lệch, ở bất kỳ múi giờ nào máy chạy — đó là điều làm các ca này không thể xanh nhờ may mắn của múi giờ +7.

Ca **mili giây cuối** được thêm lúc kiểm chất lượng: ca ngày 29,999 còn cách biên 86,4 **giây**, nên tự nó không phân biệt được một implementation mở kỳ mới sớm vài mili giây (đã kiểm bằng đột biến `floor((now − created + 1)/PERIOD_MS)` — trước khi thêm ca này nó xanh, sau khi thêm nó đỏ). Hai lời gọi kẹp đúng biên: `created + 30d − 1` phải còn là kỳ cũ, `created + 30d` phải là kỳ mới.

### Bằng chứng Binding Decision (ADR-0013 § Implementation Guidance)

**Cách làm dự kiến (trục `contract_schema`)**: khai `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000` **đúng một lần**, ở `SOURCE/lib/billing/pricing.ts`, không có bản sao nào khác trong `SOURCE/`; ba chỗ tiêu thụ (`payment_orders.pending_until`, `expiredAt` của payOS, vị từ tái dùng bước (0) của `createOrder()`) đều `import` từ đó khi chúng ra đời (plan Task 3.3/3.4).

**Đánh giá Compliance Check: `Y`** — `grep -rn "ORDER_PENDING_WINDOW_MS\|30 \* 60 \* 1000" SOURCE/` sau thay đổi này trả về **đúng một lời khai** (`lib/billing/pricing.ts`), một chú thích trỏ tới nó (`supabase/schema.sql:1629`) và **một chỗ import** (`tests/e2e/service/subscriptionServiceFixtures.ts`, bản chép tay đã bị xoá theo bước Refactor). Không còn chỗ nào khai lại con số 30 phút.
