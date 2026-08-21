# Task: Mount `EntitlementProvider` in `(layer2)/layout.tsx` and `(layer4)/layout.tsx` (D005 / I1)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.2**
Layer: **frontend** (`SOURCE/app/**` layout files)

Metadata:
- Dependencies: backend-task-14 (plan Task 2.1 — `readEntitlement()` returning real values)
- Provides: real entitlement context for every gated component — the precondition for plan Tasks 2.4, 2.5 and 5.1
- Size: Small (2 files + tests)

## Implementation Content

Mirror `(billing)/layout.tsx:27,33` **line for line**. Both layouts already `await getCurrentUserProfile()` (`(layer2)/layout.tsx:18`, `(layer4)/layout.tsx:12`), so the change is **one `await readEntitlement(user?.id ?? null)` plus one wrapping element per file**.

- **No `React.cache()`** and **no extra round trip**: route groups are siblings, so **exactly one `readEntitlement()` call happens per request**.
- **Discipline this task must also record**: **no page or component below these layouts may call `readEntitlement()`** — they read context.
- `SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/billing/entitlement.tsx` and `SOURCE/lib/billing/types.ts` are **not** edited.

## Target Files
- [x] `SOURCE/app/(layer2)/layout.tsx`
- [x] `SOURCE/app/(layer4)/layout.tsx`
- [x] `SOURCE/app/(layer2)/__tests__/layout.test.tsx` and `SOURCE/app/(layer4)/__tests__/layout.test.tsx` (one render test per route group)

## Investigation Targets
- `SOURCE/app/(billing)/layout.tsx` (`:27`, `:33` — the shipped mount to mirror line for line; **not edited**)
- `SOURCE/app/(layer2)/layout.tsx` (`:18` — the existing `await getCurrentUserProfile()`)
- `SOURCE/app/(layer4)/layout.tsx` (`:12` — the existing `await getCurrentUserProfile()`)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — `EntitlementProvider` and `useEntitlement`)
- `SOURCE/lib/billing/types.ts` (**frozen** — `FREE_FALLBACK`, the value a gated child must **not** receive)
- `SOURCE/lib/billing/readEntitlement.ts` (plan Task 2.1)
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (a gated child under `(layer2)`; **read only**)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `EntitlementProvider` / `useEntitlement` — C-01 — verify default + error (degrades to `FREE_FALLBACK`) + partial (`plan` known, quotas `unknown`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PlanComparison` — C-02 — verify default + partial (current plan marked, CTA suppressed) states)
- `docs/design/subscription-backend-design.md` (§ Provider coverage / MSA-3 / I1)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact) | dependency_direction | "One entitlement calculation, used by everything … defined once and consumed through the frozen-contract `useEntitlement()` hook" — no second read path | Both layouts consume `readEntitlement()` and pass its value through `EntitlementProvider`; no page or component below them calls `readEntitlement()` |

## Boundary Context (from the plan Connection Map)

**Boundary — Server render → RSC payload → client context.**
- Owners: `SOURCE/lib/billing/readEntitlement.ts` + the three route-group layouts ↔ `useEntitlement()` consumers (`PlanSummary`, `TutorQuotaNote`, `ExplainStepAffordance`, `PlanComparison`).
- **Serialized Format**: the frozen `Entitlement` object; `expiresAt` as ISO 8601 string or `null`; `tutor`/`upload` as the three-valued `Quota` union.
- **Consumer Parse Rule**: the discriminant must be narrowed — reading `resetsAt` outside the `known` branch is a compile error.
- **Expected Signal**: **a gated child does not receive `FREE_FALLBACK`; exactly one `readEntitlement()` call per request.**
- **Roundtrip check**: the object the layout serialises into the RSC payload is the object the consumer hook reads — asserted by rendering the **real** layout tree, not a wrapped unit.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record the `(billing)` mount lines verbatim
- [x] Write **one render test per route group**, rendering the **real layout tree** (a mocked provider would assert the mock), asserting a gated child does **not** receive `FREE_FALLBACK`; confirm both fail first
### 2. Green Phase
- [x] Add one `await readEntitlement(user?.id ?? null)` and one wrapping element per layout; run only the added tests
### 3. Refactor Phase
- [x] Confirm exactly one `readEntitlement()` call per request and that no `React.cache()` was introduced

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: one render test per route group against the **real layout tree**, plus the ★ early verification observation (a seeded Premium row makes a gated component render a real plan and a real remaining count).
- **Success criteria**: a gated child does **not** receive `FREE_FALLBACK` in either route group; a new account reads `free`; a seeded Premium row reads `premium`.
- **Failure response**: if `PlanSummary` (or any gated component) shows Free for a Premium user, **stop** — the route group or the provider mount is wrong and **every downstream test would pass while the screen lied**. This is not a defect to work around.
- **Verification level**: L1 (the ★ early verification point for the whole feature).

## Proof Obligations
- **Claim (shared-state dependency)**: a consumer that renders outside the provider subtree silently receives the fail-closed default — and after this task, no gated consumer does.
- **Primary failure mode**: **nothing fails to compile, no test goes red, and the UI simply keeps saying "Free"**. The same shape one layer down makes `TutorQuotaNote` a permanent no-op.
- **Boundary to exercise**: the **real** route-group layout tree — rendering the actual layout, not a test wrapper that supplies the provider.
- **State assertion**: the gated child receives an `Entitlement` that is **not** `FREE_FALLBACK`; `readEntitlement()` invocation count per request is exactly 1.
- **Mock boundary rationale**: `readEntitlement()` data sources may be stubbed; **the provider itself must not be mocked** — a mocked provider would assert the mock.
- **Residual**: AC-042 (the `TutorQuotaNote` render) is discharged by FE-2 (plan Task 2.5) and the manual pass (plan Task 6.5), not by these render tests.

## Completion Criteria
- [x] One render test per route group asserting a gated child does **not** receive `FREE_FALLBACK`, both green
- [x] Exactly one `readEntitlement()` call per request; no `React.cache()` added
- [x] The discipline is recorded in both layouts: no page or component below may call `readEntitlement()`
- [x] `SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/billing/entitlement.tsx` and `SOURCE/lib/billing/types.ts` unmodified
- [x] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred** — this code reads `subscriptions`, which production does not have until plan Task 5.8

## Notes
- Impact scope: two layouts; downstream, every gated component in `(layer2)` and `(layer4)`.
- Scope boundary (must remain unmodified): `SOURCE/lib/billing/types.ts`, `SOURCE/lib/billing/entitlement.tsx`, `SOURCE/app/(billing)/layout.tsx`, `SOURCE/components/tutor/ExplainStepAffordance.tsx`.
- `PlanComparison` (C-02) is **shipped and unchanged**; its `useEntitlement()` read at `:57` first sees a real plan after this task. It is **verified by the provider render test, not re-implemented**.

## Investigation Notes

### 1. The `(billing)` mount, verbatim (the lines mirrored)

`SOURCE/app/(billing)/layout.tsx` — read, **not edited**:

```
14  import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
15  import { readEntitlement } from "@/lib/billing/readEntitlement";
16  import { EntitlementProvider } from "@/lib/billing/entitlement";
...
22  export default async function BillingLayout({ children }: { children: React.ReactNode }) {
23    const user = await getCurrentUserProfile();
24    // Doc quyen loi DUNG MOT LAN cho ca nhanh cay, roi truyen xuong bang context
25    // -- cung cach root layout lam voi locale. Nho vay `useEntitlement()` o moi
26    // component con la mot luot doc context, khong phai mot round-trip (UI-D1).
27    const entitlement = await readEntitlement(user?.id ?? null);
...
33        <EntitlementProvider value={entitlement}>
36          <div id="main-content" tabIndex={-1} className="pb-bottom-nav">
37            {children}
38          </div>
39        </EntitlementProvider>
```

The wrapping element goes **between** `<SiteHeader>` and `<div id="main-content">`, i.e. it wraps
`#main-content` only — `SkipLink`, `SiteHeader`, `BottomNav` and `SupportWidget` stay outside it.
Both target layouts already have that exact `#main-content` div (`(layer2):28-30`, `(layer4):22-24`),
so the mirror is one import line pair, one `await`, and one wrapping element per file.

### 2. Investigation Targets — what each contributed

| Target | Observed |
|---|---|
| `(layer2)/layout.tsx:18` | `const user = await getCurrentUserProfile();` already present — the user id the read needs is in hand. |
| `(layer4)/layout.tsx:12` | Same line, same shape. |
| `lib/billing/entitlement.tsx` (frozen) | `EntitlementProvider({value, children})` is a `"use client"` component over `createContext<Entitlement \| null>`; `useEntitlement()` = `use(ctx) ?? FREE_FALLBACK`. **No provider above a consumer is indistinguishable from a Free user** — this is the whole failure mode. |
| `lib/billing/types.ts` (frozen) | `FREE_FALLBACK = {plan:"free", expiresAt:null, inGracePeriod:false, tutor:{state:"unknown"}, upload:{state:"unknown"}}`. |
| `lib/billing/readEntitlement.ts` | Signature unchanged; real body. Supabase failure/missing row ⇒ **exactly `FREE_FALLBACK`** (fail-closed). Redis unconfigured/unreachable/`period_anchor_at` null ⇒ only the quota fields degrade to `{state:"unknown"}`, plan preserved (fail-open). Never throws to the layout. `expiresAt` normalised through `toISOString()`. |
| `lib/billing/quota.ts` | `PLAN_LIMITS.premium = {tutor:500, upload:15}`; `periodStartEpoch("premium", anchor, …) = anchor.getTime()`; `PERIOD_MS = 30d`. |
| `components/tutor/ExplainStepAffordance.tsx:52` (read only) | `useEntitlement().tutor` — the blocked-quota branch is unreachable while `tutor.state === "unknown"`, which is what an absent provider guarantees. |
| `components/billing/TutorQuotaNote.tsx:30` | `if (tutor.state !== "known") return null;` — the permanent no-op under a missing provider. Used as the **real shipped gated child** in the `(layer2)` render test. |
| UI Spec C-01 (`:559`) | Frozen contract; Partial state = `plan` known + quotas `unknown`; Error state degrades to `FREE_FALLBACK`, *"indistinguishable from Free by design"* — hence the test must produce a genuine **Premium** value, or a badly-stubbed data source looks identical to an unmounted provider. |
| UI Spec C-02 (`:618`) | `PlanComparison` marks the card matching `useEntitlement().plan` as current and suppresses its CTA. Shipped and unchanged; it renders under `(billing)`, so it is verified by the provider contract, not re-implemented here. |
| backend DD § Provider coverage (`:870`) / MSA-3 (`:323`) / I1 (`:1067`) | Selected fix = mount in both layouts mirroring `(billing):27,33`. Sibling route groups ⇒ **exactly one** `readEntitlement()` per request; `React.cache()` deliberately absent repo-wide. Discipline: *"no page or component below these layouts may call `readEntitlement()`"*. |
| ADR-0013 § Architecture Impact (`:159`) | *"One entitlement calculation, used by everything … defined once and consumed through the frozen-contract `useEntitlement()` hook."* |

### 3. Planned approach (per Binding Decisions axis)

**Axis `dependency_direction`** — each layout calls the single existing
`readEntitlement(user?.id ?? null)` once and passes the awaited value to `EntitlementProvider`;
no second read path is introduced, no `React.cache()`, no memoisation, and no page or component
below the layouts imports `readEntitlement`. Every consumer below reads context through
`useEntitlement()`.

**Pre-implementation Compliance Check evaluation: `Y`** — the planned change adds exactly one call
site per layout and adds no import of `readEntitlement` anywhere below them. Re-evaluated at the
Exit Gate against the final implementation (§ 6).

### 4. Test design — and why the obvious test would have proved nothing

`readEntitlement()` fails **closed to exactly `FREE_FALLBACK`**. A test that stubs Supabase badly
therefore produces the same value an *unmounted provider* produces, and passes for the wrong
reason. So the data sources are stubbed to yield a genuine **Premium** entitlement with **`known`**
quotas, and the assertion is full-object equality against that value:

- `@/lib/supabase/server` `createClient` stubbed (the precedent harness of
  `lib/billing/__tests__/readEntitlement.test.ts:39-56`): `subscriptions` row with
  `expires_at = NOW + 10d`, `period_anchor_at = NOW - 20d`; `user_profiles.created_at` seeded.
- `@upstash/redis` `Redis.mget` stubbed to `[7, 2]`, env pinned on.
- `getCurrentUserProfile` stubbed to a fixed profile — it is a **data source** of the layout, not
  the thing under test.
- **`readEntitlement` itself is NOT mocked, and `EntitlementProvider` is NOT mocked** — a mocked
  provider would assert the mock. The layout module, the provider, the hook and the real gated
  child all run.

Expected value: `premium | 2026-08-28T12:00:00.000Z | false | tutor known 7/500 | upload known 2/15`,
`resetsAt = anchor + 30d`.

Call-count measurement: the stub counts `from("subscriptions")` invocations. One `readEntitlement()`
call issues exactly one such query, so **the count of `subscriptions` selects per render is the
count of `readEntitlement()` calls per request** — measured, not asserted on a spy of a mocked
function.

### 5. Kết quả — RED trước, GREEN sau

Cả hai file test được chạy **trước** khi sửa layout, và cả hai đỏ vì đúng lý do
mà task này tồn tại: cây layout THẬT render (header, nav, widget đều có trong
DOM dump), nhưng đứa con bị gate nhận đúng `FREE_FALLBACK`.

**RED — `app/(layer2)/__tests__/layout.test.tsx` (6 failed / 3 passed):**

| Ca | Thông điệp đỏ nguyên văn |
|---|---|
| giao đúng giá trị Premium thật | `expected 'free\|null\|false\|unknown\|unknown' to be 'premium\|2026-08-28T12:00:00.000Z\|false\|known:7/500@2026-08-26T12:00:00.000Z\|known:2/15@2026-08-26T12:00:00.000Z'` |
| KHÁC hẳn FREE_FALLBACK | `expected 'free\|null\|false\|unknown\|unknown' not to be 'free\|null\|false\|unknown\|unknown'` |
| TutorQuotaNote thôi trả null | `Unable to find an element with the text: 7/500 tutor hints used this period.` |
| đúng user id | `expected [] to deep equally contain [ 'user_id', '2222…' ]` |
| 1 lượt readEntitlement() | `expected +0 to be 1` |
| nguồn: gọi đúng một lần | `expected [] to have a length of 1 but got +0` |

**RED — `app/(layer4)/__tests__/layout.test.tsx` (7 failed / 2 passed):** cùng
hình dạng, với bộ số riêng —
`expected 'free\|null\|false\|unknown\|unknown' to be 'premium\|2026-09-02T06:30:00.000Z\|false\|known:11/500@2026-08-24T06:30:00.000Z\|known:4/15@2026-08-24T06:30:00.000Z'`;
`expected 'free\|…' to contain 'known:4/15@2026-08-24T06:30:00.000Z'`;
`Unable to find an element with the text: 11/500 tutor hints used this period.`;
`expected [] to deep equally contain [ 'user_id', '4444…' ]`; `expected +0 to be 1`;
`expected [] to have a length of 1 but got +0`.

**Ba ca XANH SẴN trước khi sửa** — ghi ra để không ai đọc nhầm chúng là bằng
chứng của mount: "không có phép ghi nào", "không có `React.cache()`", và ca quét
phạm vi repo. Chúng là rào chắn hồi quy, không phải khẳng định về provider.

**GREEN sau khi sửa:** 18/18 xanh trên hai file. Toàn bộ suite: **1012 pass /
10 skip / 93 file** (nền trước đó 994 / 10 / 91 — đúng +18 và +2 file, không ca
nào cũ bị ảnh hưởng). `npx tsc --noEmit` 0 lỗi. `npx eslint . --max-warnings 0`
sạch.

### 6. Kiểm tra đột biến — bảng bắt/sót

Mỗi đột biến được áp vào code thật, chạy test, rồi khôi phục (`git status` xác
nhận cây làm việc trở lại đúng tập thay đổi dự kiến).

| # | Đột biến | Kết quả | Ca nào bắt |
|---|---|---|---|
| M1 | Gỡ `EntitlementProvider` **chỉ** ở `(layer2)` | **BẮT** — (layer2) 3 đỏ, (layer4) xanh | 3 ca "không nhận FREE_FALLBACK" của đúng file (layer2) |
| M2 | Gỡ `EntitlementProvider` **chỉ** ở `(layer4)` | **BẮT** — (layer4) 4 đỏ, (layer2) xanh | 4 ca của đúng file (layer4), gồm ca hạn mức `upload` |
| M3 | Truyền `FREE_FALLBACK` thay cho giá trị đã `await` | **BẮT** — 3 đỏ | so khớp toàn bộ object + TutorQuotaNote |
| M4 | Thêm một lời gọi `readEntitlement()` THỨ HAI | **BẮT** — 2 đỏ (`expected 2 to be 1`) | đếm lúc chạy **và** ca đọc mã nguồn |
| M5 | Một đường đọc thứ hai dưới layout (`upload/page.tsx` import `readEntitlement`) | **BẮT** — 1 đỏ | ca quét phạm vi repo (binding decision) |
| M6 | Đưa `React.cache()` vào `(layer2)` | **BẮT** — 2 đỏ | ca "KHÔNG có React.cache()" + ca đếm lời gọi trong file |

**0 đột biến sống sót.** M1 và M2 là cặp quan trọng nhất: chúng chứng minh hai
file test phân biệt được HAI route group, chứ không phải cùng khẳng định một
thứ hai lần.

### 7. Số lượt `readEntitlement()` mỗi request — cách ĐO

Không dùng spy trên `readEntitlement` (nó không bị mock — mock nó là bỏ mất
chính thứ đang kiểm). Thay vào đó `createClient()` bị stub và mọi lời gọi
`from(table)` được ghi lại; mỗi lượt `readEntitlement()` phát **đúng một** truy
vấn `subscriptions` (`readEntitlement.ts:119-126`), nên số truy vấn
`subscriptions` trong một lượt render CHÍNH LÀ số lượt gọi.

Đo được: **1** ở cả hai route group, với hai component đọc context dưới layout.
M4 đẩy con số đó lên 2 và ca kiểm đỏ, nên phép đo có sức phân biệt thật.

**Không có `React.cache()` nào được thêm.** Xác nhận hai lớp: (a) ca kiểm mã
nguồn `/cache\s*\(/` trên các dòng KHÔNG phải comment của từng layout — M6
làm nó đỏ; (b) `grep -rn "cache(" SOURCE/app SOURCE/lib SOURCE/components` (bỏ file
test) trả về ĐÚNG ba dòng, cả ba đều là **comment**: `entitlement.tsx:11`
nói repo không dùng nó, cộng hai comment mới ở `(layer2)/layout.tsx:32` và
`(layer4)/layout.tsx:26` nhắc lại lý do. Không có lời gọi thật nào.

### 8. Binding Decisions — đánh giá lại tại Exit Gate

| Source | Axis | Compliance Check | Đánh giá | Bằng chứng |
|---|---|---|---|---|
| `ADR-0013` § Architecture Impact | dependency_direction | Cả hai layout dùng `readEntitlement()` và truyền giá trị đó qua `EntitlementProvider`; không page/component nào bên dưới gọi `readEntitlement()` | **`Y`** | `(layer2)/layout.tsx:35` + `:41`/`:49`; `(layer4)/layout.tsx:29` + `:35`/`:43` — cùng hình dạng `(billing):27,33`. Không có lời gọi nào khác: ca quét repo (app/ + components/, trừ ba layout) trả mảng rỗng, và M5 làm nó đỏ nên nó có sức phân biệt. Lúc chạy: đúng 1 truy vấn `subscriptions` mỗi lượt render. Không thêm module, export hay phép tính quyền lợi thứ hai. |

Đánh giá trước khi làm là `Y` (§ 3) và đánh giá lại tại Exit Gate vẫn là `Y`;
implementation không lệch khỏi phương án đã ghi.

### 9. Ranh giới phạm vi — xác nhận không đụng

`git status` sau khi hoàn tất: chỉ `SOURCE/app/(layer2)/layout.tsx`,
`SOURCE/app/(layer4)/layout.tsx`, file task này và hai file test mới.
`SOURCE/app/(billing)/layout.tsx`, `SOURCE/lib/billing/entitlement.tsx`,
`SOURCE/lib/billing/types.ts` và `SOURCE/components/tutor/ExplainStepAffordance.tsx`
**không bị sửa**.

**Chưa có lượt deploy production nào của nhánh này.** Code ở đây đọc bảng
`subscriptions`, thứ mà production chưa có cho tới plan Task 5.8; đường hỏng-ĐÓNG
(`readAccount()` trả `null` ⇒ `FREE_FALLBACK`) là thứ giữ cho trang vẫn render
nếu điều đó xảy ra, nhưng nó không phải giấy phép để deploy sớm.

### 10. Residual — thứ task này KHÔNG kết luận

- **AC-042** (bản render thật của `TutorQuotaNote` cạnh cả hai chỗ gọi
  `ExplainStepAffordance`) do FE-2 (plan Task 2.5) và lượt kiểm thủ công (Task
  6.5) giải quyết. Ca kiểm ở đây chỉ chứng minh component thôi trả `null` khi
  có provider — nó không nói gì về vị trí mount trên trang result-detail.
- **`SkipLink` bị stub trong cả hai file test**: nó là async Server Component,
  bộ render client của React 19 từ chối thẳng và làm CẢ CÂY ra rỗng. Đây là giới
  hạn môi trường jsdom, không phải một lựa chọn ranh giới mock; nó nằm NGOÀI
  provider nên không đứng giữa khẳng định nào.
- **Lượt xác minh L1 bằng dữ liệu thật** (một dòng `subscriptions` Premium gieo
  trên dev làm màn hình hiện gói thật) chưa chạy được: DDL `subscriptions` mới
  chỉ có trên dev theo TD-005 và bước đó thuộc lượt kiểm thủ công. Thay thế ở
  đây là một giá trị Premium dựng từ nguồn dữ liệu bị stub đi qua ĐÚNG hàm
  `readEntitlement()` thật và ĐÚNG cây layout thật.

### 11. Lượt sửa sau review — bịt chỗ ca kiểm xanh trên cây RỖNG

`integration-test-reviewer` chứng minh bằng thực nghiệm (không phải suy luận):
gỡ **đúng một dòng** `vi.mock("@/components/shared/SkipLink")` làm CẢ CÂY render
ra rỗng, `probeText()` trả `""` qua nhánh `?? ""`, và ca **mang tên D005** —
"giá trị nhận được KHÁC hẳn FREE_FALLBACK" — **vẫn XANH** (2 failed / 7 passed).
Chuỗi rỗng đúng là "khác FREE_FALLBACK". Ca duy nhất tự nhận là bằng chứng D005
lại là ca duy nhất sống sót qua một lượt render không tạo ra gì.

Bốn sửa đổi, mỗi sửa đổi kèm một lượt chứng minh có sức phân biệt:

| # | Sửa | Chứng minh ĐỎ | Khôi phục |
|---|---|---|---|
| 1 | Ca D005 ở cả hai file khẳng định **sự hiện diện** của probe TRƯỚC khi so giá trị (`expect(container.querySelector('[data-testid="probe"]')).not.toBeNull()`) | Gỡ mock `SkipLink`: `(layer2)` `AssertionError: expected null not to be null` tại `:266`; `(layer4)` cùng thông điệp tại `:244`. Ca D005 **ĐỎ ở cả hai file** | Mock khôi phục ⇒ 18/18 xanh |
| 2 | `probeText()` đổi từ `querySelector(...)?.textContent ?? ""` sang `within(container).getByTestId("probe")` (ném) + chặn `textContent === null` | Cùng lượt gỡ mock: `TestingLibraryElementError: Unable to find an element by: [data-testid="probe"]`. Tổng `(layer2)` 3 failed / 6 passed (trước khi sửa: 2/7), `(layer4)` 4 failed / 5 passed | như trên |
| 3 | Ca quét phạm vi repo thêm gốc `SOURCE/lib`, thêm `lib/billing/readEntitlement.ts` vào `ALLOWED`, và lọc qua `codeLines()` (đã nâng lên phạm vi module) | Thêm `__secondReadPathProbe()` gọi `readEntitlement()` vào `lib/billing/pricing.ts`: `AssertionError: expected [ 'lib/billing/pricing.ts' ] to deeply equal []` | `git checkout` ⇒ `git diff` rỗng, `git status` sạch |
| 4 | Header § 5 sửa "5 failed / 4 passed" → **"6 failed / 3 passed"** (bảng 6 dòng bên dưới và danh sách ba ca xanh-sẵn vốn đã đúng; chỉ con số ở header sai) | — | — |

**Vì sao sửa 3 là một lỗ thật, không phải hình thức**: một đường đọc thứ hai đặt
trong một helper dưới `SOURCE/lib` mà một page import thì **vô hình với cả hai
lớp bảo vệ**: vô hình với ca quét (nó chỉ đi `app/` + `components/`) và vô hình
với bộ đếm `subscriptions` lúc chạy, vì bộ đếm ấy chỉ quan sát các lời gọi phát
ra trong lượt render layout với `children` do test cấp. Lọc `codeLines()` là bắt
buộc kèm theo: `quota.ts` nhắc `readEntitlement()` ba lần trong văn xuôi
(`:11`, `:40`, `:49`) và không lời nào là một đường đọc.

Implementation (`(layer2)/layout.tsx`, `(layer4)/layout.tsx`) **không đổi một
byte** trong lượt này. Cổng sau khi sửa: **1012 pass / 10 skip / 93 file**,
`npx tsc --noEmit` 0 lỗi, `npx eslint . --max-warnings 0` sạch — đúng nền cũ.
