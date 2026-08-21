# Task: Gate the upload path (I3) — and integration case INT-1

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.4**
Layer: **backend** (server action `SOURCE/app/(layer4)/actions.ts` + integration test)

Metadata:
- Dependencies: backend-task-22 (the chokepoint), backend-task-21 (`consumeQuota`), backend-task-01 (`test:integration`), backend-task-11 (gate B on dev)
- Provides: upload-side enforcement; **INT-1 filled in this same commit** — integration lane 3/3
- Size: Medium (2 files)

`Change Category: bug-fix, state-change`

This **replaces** the superseded `LIMITS.MAX_UPLOADS_PER_DAY` DB-count check (which counted rows created, so a re-run consumed nothing) with a counter-based gate. Sweep the adjacent cases sharing that path — both branches of the upload action (`rerunExamId` set and unset), the `metaCall` derivation at `:417`, and any other consumer of `LIMITS.MAX_UPLOADS_PER_DAY` — for the same class of defect.

## Implementation Content

In `SOURCE/app/(layer4)/actions.ts`:
- **hoist the `metaCall` derivation** (`entryMode === "automatic"`, today at `:417`) to a `const` immediately after `requireUser()`, and have `:417` consumer read it rather than re-deriving — **the value passed to `consumeQuota` and the value that gates the third call must be the same expression, evaluated once**;
- call `consumeQuota("upload", userId, ent, metaCall ? 3 : 2)` **once, ahead of the branch at `:268`**, alongside the existing `guard("uploadExam", user.id)` at `:181`;
- **delete** the superseded DB-count check at `:331-343` (`LIMITS.MAX_UPLOADS_PER_DAY`) rather than leaving it running in parallel.

### INT-1 — filled in **this** commit
(a) exhausted Free tutor allowance ⇒ reason `user_quota` **and** the Gemini adapter mock has **exactly 0** invocations;
(b) upload with `rerunExamId` **unset** ⇒ the per-user upload counter delta is **exactly 1** (hardcoded literal, read before and after);
(c) upload with `rerunExamId` **set** ⇒ delta **exactly 1** — this is the stated expected *difference*, and it **fails against the old behaviour**, which counted rows created and a re-run creates none;
(d) an **absence assertion** that `actions.ts` contains no surviving reference to `LIMITS.MAX_UPLOADS_PER_DAY`;
(e) Redis unavailable ⇒ refuse with **exactly 0** Gemini adapter invocations.

## Target Files
- [x] `SOURCE/app/(layer4)/actions.ts`
- [x] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-1 filled**)
- [x] `SOURCE/lib/billing/quotaTelemetry.ts` — **thêm ở vòng rà soát**: bảng OK-04 dùng chung, rút ra khỏi hai bản sao literal
- [x] `SOURCE/app/(layer2)/tutorActions.ts` — **thêm ở vòng rà soát**: xoá bản sao literal, import bảng dùng chung

## Investigation Targets
- `SOURCE/app/(layer4)/actions.ts` (`:181` `guard("uploadExam", …)`; `:268` the branch the gate must precede; `:331-343` the superseded DB-count check to delete; `:417` the `metaCall` derivation to hoist) — **adjacent cases for the bug-fix / state sweep**
- `SOURCE/lib/ugc/limits.ts` (`LIMITS.MAX_UPLOADS_PER_DAY` — confirm no other consumer survives)
- `SOURCE/lib/billing/quota.ts` (plan Task 5.1 — `consumeQuota` signature and its three reasons)
- `SOURCE/lib/ugc/gemini.ts` (plan Task 5.2 — the counted adapter boundary INT-1 asserts against)
- `SOURCE/tests/integration/subscription.int.test.ts` (**INT-1** `Proof obligation:` / `Primary failure mode:` annotation block)
- `docs/design/subscription-backend-design.md` (§ Integration Point I3)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy — the output-comparison clause for the one replaced behaviour)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record INT-1 annotation block verbatim
- [x] **Bug-fix / state sweep**: record the **before** behaviour of the `:331-343` check in **both** branches (`rerunExamId` set and unset) — the refusal reason string and the counter delta — so the output comparison has a baseline
- [x] Write INT-1 first and confirm case (c) **fails against the old behaviour**
### 2. Green Phase
- [x] Hoist `metaCall`; add the gate ahead of `:268`; delete `:331-343`; run `npm run test:integration` against dev
### 3. Refactor Phase
- [x] Confirm `metaCall` is derived exactly once and both consumers read the same `const`

## Quality Assurance Mechanisms
- Real-Postgres integration tests — Enforces: counter deltas and refusal reasons against a real database — Config: `SOURCE/vitest.integration.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: **the output comparison the Verification Strategy requires for the one replaced behaviour.** Compare the upload path `LIMITS.MAX_UPLOADS_PER_DAY` DB-count check at `actions.ts:337` before/after on identical input, in **both** branches (`rerunExamId` set and unset). The diff is taken on **the refusal reason string and the counter delta**, never on the response body.
- **Success criteria**: expected **difference** — the re-run branch now consumes exactly one upload allowance. Expected **non-difference** — a non-re-run upload still consumes exactly one. INT-1 (a)…(e) all green under `npm run test:integration` against dev.
- **Failure response**: if the re-run branch still consumes nothing, the old check is still running in parallel — **delete it**, do not add a second gate.
- **Verification level**: L2 (integration); L1 at phase level.

## Proof Obligations
- **Claim**: the plan is sold in operations, and a re-run is an operation.
- **Primary failure mode**: the old row-count semantics survive, so re-runs are free and the paid capacity leaks silently.
- **Boundary to exercise**: the upload server action against the real dev database, with the Gemini adapter mocked and **counted**.
- **State assertion**: per-user upload counter read **before** and **after** each upload; delta exactly **1** in both branches (hardcoded literal expectations).
- **Mock boundary rationale**: the Gemini adapter is external paid I/O and is mocked with a counter; Redis and the database are real, because the counter delta is the claim.
- **Residual**: budget-side literals (3 / 2 / 1) are proven in plan Task 5.1; this task proves the per-user delta and the refusal reasons at the gate.

- **Claim (absence)**: no surviving reference to `LIMITS.MAX_UPLOADS_PER_DAY` remains in `actions.ts`.
- **Primary failure mode**: two gates run in parallel and disagree, so a refusal reason depends on which fires first.
- **Boundary to exercise**: source-text assertion over `actions.ts`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: other consumers of the constant elsewhere in the repository are out of this task scope; record any found.

## Completion Criteria
- [x] All added tests pass; **INT-1 green from this commit**
- [x] `consumeQuota("upload", …)` called **once, ahead of the branch at `:268`**; `metaCall` derived once and shared
- [x] `:331-343` deleted; the absence assertion passes
- [x] Test-case resolution: **integration 3/3 (INT-1, INT-2, INT-3) — lane complete**
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: `SOURCE/app/(layer4)/actions.ts`; downstream, plan Task 5.5 maps its refusal reason to a telemetry code.
- Scope boundary: the diff is taken on the refusal reason string and the counter delta, **never on the response body**.

## Investigation Notes
(Record the before/after refusal reasons and counter deltas for both branches here.)

### Đọc Investigation Targets (2026-08-20)

**`SOURCE/app/(layer4)/actions.ts`** — `extractAndAssemble(formData)`, một hàm dài, các mốc thật (đo lúc bắt đầu task, file 1039 dòng):
- `:168` `const { supabase, user } = await requireUser();`
- `:181` `const rl = await guard("uploadExam", user.id);` — cổng chi phí thứ nhất, RAM + Upstash, 5 lượt/24h.
- `:192-193` `const entryMode: EntryMode = (formData.get("entryMode") …) === "automatic" ? "automatic" : "manual";` — **điểm SỚM NHẤT `metaCall` suy được**, vì `metaCall` là một hàm của `entryMode`.
- Stage 1 (`:196-236`) metadata; Stage 2 (`:238-262`) hai file (loại/kích thước/số trang). Cả hai đều **từ chối được** và cả hai đều **chưa chạm Gemini**.
- `:266` `const rerunExamId = …` — nhánh rẽ.
- `:331-343` khối đếm DB cũ: `since = now − 24h`, `exams` count `head:true` theo `author_id` + `created_at >= since`, rồi `if ((count ?? 0) >= LIMITS.MAX_UPLOADS_PER_DAY)` ⇒ `failure("validation", "Upload limit reached (30 per day). Try again tomorrow.")`. **Nằm TRONG nhánh `else`**, tức chỉ chạy khi tạo mới.
- `:417` `const metaCall = entryMode === "automatic";` → quyết định lời gọi thứ ba trong `Promise.all` ở `:423`.

**`SOURCE/lib/ugc/limits.ts`** — `MAX_UPLOADS_PER_DAY: 30` (`:41`). Rà toàn repo: **chỉ `actions.ts` tiêu thụ nó** (3 lần nhắc, `:337`/`:338`/`:341`). Sau task này hằng còn khai trong `LIMITS` nhưng **không còn chỗ gọi nào trong mã**; xoá hằng nằm ngoài Target Files nên không đụng, chỉ ghi lại.

**`SOURCE/lib/billing/quota.ts`** — `consumeQuota(kind, userId, ent, geminiCalls)`, `geminiCalls` **bắt buộc**. Ba lý do từ chối: `user_quota` / `project_budget` / `unavailable`. Hai bộ đếm hai đơn vị: `quota:{kind}:{userId}:{periodStart}` **+1 mỗi thao tác**, `ai:budget:{ngày Pacific}` **+geminiCalls**. Bị từ chối ⇒ hoàn lại cả hai. `PLAN_LIMITS.free = {tutor:5, upload:3}`.

**`SOURCE/lib/ugc/gemini.ts`** — `GEMINI_CALLS_PER_OPERATION = { tutor: 1, uploadTyped: 2, uploadAutomatic: 3 }`; `generateContent()` là **điểm phát duy nhất**, và cả bốn extractor gọi nó **đúng một lần** mỗi lượt (`extractQuestions.ts:262`, `extractAnswers.ts:163`, `extractMeta.ts:110`, `callTutor.ts:97`).

**`SOURCE/tests/integration/subscription.int.test.ts`** — khối chú thích INT-1 `:57-121`. Ghi nhận **hai sai lệch của khung**: (1) nghĩa vụ (d) và `@dependency` trỏ `app/(layer2)/actions.ts`, nhưng `extractAndAssemble` sống ở `app/(layer4)/actions.ts` (`(layer2)/actions.ts` không hề nhắc `MAX_UPLOADS_PER_DAY`) — khẳng định vắng mặt được viết cho **layer4**, tức file thật đang bị xử; (2) khung nói "Redis MOCKED … Supabase MOCKED", nhưng file này xoá `KV_REST_API_URL`/`KV_REST_API_TOKEN` ở tầm module cho INT-3, nên INT-1 phải tự đặt lại env và phải ghim `rateLimitStore` về `null` TRƯỚC đó.

**`docs/design/subscription-backend-design.md`** — `:1069` (I3), `:251` (Change map), `:974-980` (lỗ `rerunExamId` nói lại cho đúng), `:931` (đặt chỗ chứ không tích từng lượt).

### Bug-fix / state sweep — hành vi TRƯỚC của `:331-343`, hai nhánh

| Nhánh | Chuỗi lý do từ chối (trước) | Delta `quota:upload:{user}:{periodStart}` (trước) | Delta sau |
|---|---|---|---|
| `rerunExamId` **unset** | `kind:"validation"`, `"Upload limit reached (30 per day). Try again tomorrow."`, chỉ khi ≥ 30 dòng `exams` trong 24h | **0** — không có bộ đếm Redis nào trên đường này | **1** |
| `rerunExamId` **set** | **không có** — khối đếm nằm trong nhánh `else`, nhánh re-run không đi qua | **0** | **1** |

Đó là "expected difference" (nhánh re-run) và "expected non-difference" (nhánh tạo mới vẫn tiêu đúng một suất) mà § Verification Strategy đòi.

### Quyết định đặt cổng (ghi lại vì nó chọn trong khoảng cho phép)

DD ràng buộc: `consumeQuota("upload", …)` **một lần, TRƯỚC nhánh rẽ ở `:268`**. Trong khoảng `:194 … :265` mọi vị trí đều thoả. Chọn vị trí **cuối** khoảng — ngay sau khi stage 2 xác nhận cả hai file hợp lệ — chứ không phải ngay sau `requireUser()`, vì `consumeQuota()` INCR rồi mới so: đặt trước stage 1/2 sẽ **tính phí một suất kỳ cho một lượt bị chính validate từ chối** và không bao giờ chạm tới Gemini. Đó đúng là lý lẽ mà `tutorActions.ts` đã ghi khi xếp `consumeQuota` **sau** `guard()`. Mọi bất biến DD nêu vẫn giữ: một lần gọi, trước nhánh rẽ, trước byte Gemini đầu tiên, và nhánh re-run vẫn bị đếm.

`metaCall` được suy tại `:194` (ngay sau `entryMode`, điểm sớm nhất suy được — DD viết "immediately after `requireUser()`" nhưng `entryMode` chưa tồn tại ở đó), và `:417` **đọc lại** const ấy thay vì tự suy lần hai.

### Kết quả — output comparison, và cái đã đo được

Lượt chạy ĐỎ trên bản cài đặt CŨ (INT-1 viết trước, `npm run test:integration -t "INT-1"`):
`Tests 8 failed | 1 passed | 16 skipped`. Ca duy nhất xanh sẵn là **(a)** — đường
GIA SƯ, đã có cổng từ plan Task 5.3; ĐỎ của nó chỉ đến được bằng đột biến (M8a/M8b
dưới). Tám ca còn lại đỏ đúng theo hành vi cũ:

| Ca | Đo được trên bản CŨ | Kỳ vọng | Ý nghĩa |
|---|---|---|---|
| (b) tạo mới | delta bộ đếm kỳ = **0** | 1 | không có bộ đếm Redis nào trên đường upload |
| (c) xử lý lại | delta = **0** | 1 | **expected difference** — bản cũ đếm dòng, re-run không tạo dòng |
| (f) automatic | delta ngân sách = **0** | 3 | ngân sách chưa từng được đặt chỗ |
| đặt chỗ | chỉ số lệnh `INCRBY` = **−1** (không có) | trước lời gọi đầu | — |
| (g) cạn hạn mức | **3** lượt gọi Gemini | 0 | đúng chỗ dung lượng đã trả tiền rò ra |
| (e) Redis chết | **2** lượt gọi Gemini | 0 | hỏng-MỞ |
| (h) hình dạng khoá | 1 khoá (chỉ khoá gieo tay) | 2 | đường ghi không chạm khoá kỳ |
| (d) vắng mặt | còn `MAX_UPLOADS_PER_DAY` | 0 lần | hai cổng chạy song song |

Sau khi cài đặt: `npm run test:integration` ⇒ **25 passed** (16 cũ + 9 ca INT-1).

### Bảng đột biến (mỗi dòng: đúng MỘT anchor khớp, và không dòng nào tương đương ngữ nghĩa)

| # | Bản cài đặt SAI bị loại | Đột biến | Ca đỏ |
|---|---|---|---|
| M1 | chi phí là một HẰNG | bỏ ternary, luôn `uploadTyped` | (f), (d) |
| M2 | quy tắc chế-độ→chi-phí sai hướng | đảo hai nhánh ternary | (b), (c), (f), (d) |
| M3 | gộp HAI bộ đếm về MỘT đơn vị | `incr(userKey)` → `incrby(userKey, geminiCalls)` (quota.ts) | (b), (c), (f), đặt chỗ, (g) |
| M4 | lời từ chối "rơi xuyên", vẫn phát Gemini | `if (false && !consumed.ok)` | (g), (e) |
| M5 | bảng OK-04 thật ra là một hằng | ba lý do cùng một mã | (e) |
| M6a | hằng cũ còn sót (hai cổng song song) | chèn lại một tham chiếu | (d) |
| M6b | ca (d) đọc NHẦM file (đúng đường dẫn khung ghi sai) | trỏ sang `(layer2)/actions.ts` | (d) — bắt bằng khẳng định CÓ MẶT |
| M7 | cổng đặt SAU `Promise.all` | dời nguyên khối cổng xuống dưới stage 5 | đặt chỗ (`5 < 0` sai), (g), (e) |
| M8a | mã telemetry gia sư gộp | `user_quota` → `not_eligible` (tutorActions.ts) | (a) |
| M8b | cổng gia sư "rơi xuyên" | `if (false && !consumed.ok)` (tutorActions.ts) | (a) — ⚠ **BỊ THAY THẾ, xem § Vòng rà soát bên dưới**: đúng là (a) đỏ, nhưng đỏ ở khẳng định TELEMETRY, không ở khẳng định 0-lượt-gọi |
| M9 | đường GHI ghép khoá khác đường ĐỌC | `quotaKey()` thêm hậu tố (quota.ts) | (a), (b), (c), (f), (g), (h) |
| M10 | danh sách ADR-0013 bị nới lỏng | xoá entry `app/(layer4)/actions.ts` | `layout.test.tsx` — cổng Server Action |

Mọi probe ngoài Target Files (`quota.ts`, `tutorActions.ts`, `layout.test.tsx`) được
khôi phục bằng **chép byte** từ bản sao lấy trước; md5 sau khôi phục khớp bản trước
đột biến, và `git status` chỉ còn 4 file thật sự thay đổi.

### Vòng rà soát (revision round) — sửa theo `integration-test-reviewer`

Bản ghi ở trên là **bản ghi kiểm toán của điều đã TIN lúc ấy**; không xoá dòng
nào. Phần này ghi cái **đo lại được**, và cái đã sửa.

#### Đính chính bảng đột biến

| # | Điều đã ghi | Điều đo lại được | Trạng thái |
|---|---|---|---|
| M8b | "cổng gia sư rơi xuyên ⇒ ca (a) đỏ" | (a) đỏ **CHỈ ở khẳng định `telemetry_log.error_code`** (`expected 'not_eligible' … 'user_quota_exhausted'`). Khẳng định `expect(snapshot.geminiCalls).toBe(0)` **VẪN XANH**: fixture cũ không có arm `exam_results`, nên `computeWrongTwiceQuestionIds()` trả tập rỗng và `explainStep()` từ chối `not_eligible` ở stage 4 — **một cổng KHÁC** giữ cho số lượt gọi bằng 0, bất kể cổng hạn mức còn sống hay không. Đo bằng cách gỡ cổng rồi đổi kỳ vọng thành `toBe(999)`: kết quả `expected +0 to be 999` | **BỊ THAY THẾ** |

**Đã sửa** (fixture gia sư nay ĐỦ ĐIỀU KIỆN + thêm một đối chứng dương):
- `Int1Fixture.results` + arm `case "exam_results"` (hai dòng, **hai `attempt_id`
  khác nhau**, cùng chấm sai `int1-question`) + arm `case "questions"`
  (`content`/`question_type`/`choices`) để stage 6 dựng được prompt.
- Ca mới **đối chứng dương**: tài khoản thứ tư `…a004`, gieo `quota:tutor:` = **4**
  (literal gõ tay, một dưới trần Free 5) ⇒ `expect(geminiCalls).toBe(1)` và
  `expect(telemetry).toHaveLength(1)`.
- Chạy lại M8b **sau khi sửa**: (a) nay đỏ ở **chính khẳng định số lượt gọi** —
  `AssertionError: expected 1 to be +0` tại `expect(snapshot.geminiCalls).toBe(0)`.
- Probe "cổng gia sư từ chối MỌI lượt" (`if (true)`): **đối chứng dương đỏ** —
  `expected +0 to be 1`. Trước khi có ca ấy, một cổng như vậy không bị ca nào bắt.

#### Residual — bổ sung

| Residual | Nội dung | Xử lý trong vòng này |
|---|---|---|
| **MZ (survivor đã xác nhận)** | Đột biến `return consumed.reason === "user_quota"` → `return false` tại `actions.ts` (chỗ trả lời người dùng sau khi cổng từ chối) để lại **cả làn 25 passed, exit 0**. Người cạn hạn mức nhận `failure("server", "Exam uploads are temporarily unavailable…")` thay cho câu chính sách AC-018/AC-053; ca (g) chỉ khẳng định số lượt gọi/bộ đếm/console, còn ca (e) khẳng định đúng `kind === "server"` — nên cặp ấy không tách nổi một lời từ chối CHÍNH SÁCH khỏi một lời từ chối HẠ TẦNG trên bề mặt người dùng | **ĐÃ ĐÓNG** — ca (g) thêm hai khẳng định gõ tay `expect(run.result.error.kind).toBe("validation")` và `expect(run.result.error.message).toContain("used every exam upload")`. Chạy lại đúng đột biến ấy: **(g) ĐỎ**, `AssertionError: expected 'server' to be 'validation'` |
| **Bảng OK-04 nhân đôi, `project_budget` phía upload không được ghim** | Hai bản sao literal độc lập (`actions.ts` và `tutorActions.ts`); `satisfies Record<…>` chỉ khoá TẬP KHOÁ và MIỀN GIÁ TRỊ, không khoá từng cặp, nên `user_quota: "server"` biên dịch được ở một bên. Bản gia sư được ghim đủ 3/3; bản upload chỉ 2/3 — **cặp `project_budget` → `project_budget_exhausted` phía upload không có khẳng định nào** | **ĐÃ ĐÓNG bằng cách rút chung** — bảng chuyển sang module thường `SOURCE/lib/billing/quotaTelemetry.ts` (**không có `"use server"`**; chỉ thị ấy hạn chế EXPORT chứ không hạn chế IMPORT), cả hai file import và **xoá hẳn hai literal**. Nay đổi `project_budget` → `"server"` làm **2 ca đơn vị đỏ** trong `tutorActions.int.test.ts`, và vì hai chỗ dùng chung MỘT lời khai nên phía upload được ghim theo. Tính chất "lý do thứ tư = lỗi biên dịch" **còn nguyên sau khi dời**: thêm `"throttled"` vào `ConsumeResult` cho ra `TS1360` tại `quotaTelemetry.ts:34` **và** `TS7053` tại `actions.ts:314` + `tutorActions.ts:222` |
| **Hai khẳng định console quá rộng** (ca (g) và (e)) | `expect(run.warnings.join("\n")).toContain("error_code=…")` tìm trên **toàn luồng** cảnh báo, mà luồng ấy còn nhận `console.warn` của chính `consumeQuota()` (`quota.ts:381`) | **ĐÃ THU HẸP** — lọc về đúng một dòng `[extractAndAssemble] cổng hạn mức từ chối:`, `toHaveLength(1)`, rồi mới kiểm nội dung. Probe hai chỗ (cho `quota.ts` phát ra `error_code=server`, và bỏ `error_code=` khỏi dòng từ chối của `actions.ts`): **bản rộng cũ để ca (e) SỐNG SÓT**, bản hẹp mới làm (e) **ĐỎ** (`expected '[extractAndAssemble] cổng hạn mức từ chối: reason=unavailable' to contain 'error_code=server'`). Hai khẳng định này mang chú thích **ĐƯỢC LÊN LỊCH THAY THẾ** bằng một khẳng định `telemetry_log` khi đường upload có `event_type` riêng — không được thừa kế trong im lặng như bằng chứng "mã ấy truy vấn được" |
| **Khung INT-1 ghi sai đường dẫn** | `@dependency` và nghĩa vụ (d) vẫn đọc `app/(layer2)/actions.ts` trong khi phần cài đặt đọc `app/(layer4)/actions.ts` | **ĐÃ SỬA TẠI CHỖ** trong khối khung, cả hai nơi, kèm ghi chú `CORRECTED` nói rõ `extractAndAssemble` sống ở layer4 và `(layer2)/actions.ts` chưa từng nhắc `MAX_UPLOADS_PER_DAY`, nên khẳng định viết cho nó sẽ **xanh vĩnh viễn** |
| **Hai giả định gánh tải chưa ghi** | (1) thứ tự ba lời gọi `int1RunUpload` là điều kiện của các literal tuyệt đối `counterBefore`/`counterAfter` ở (b)/(c)/(f); (2) `expect(int1BudgetKeys()).toHaveLength(1)` ở ca (h) giả định mọi lượt rơi vào **cùng một ngày lịch Pacific** | **ĐÃ GHI** — mỗi giả định một chú thích tại chỗ |

Làn integration sau vòng này: **26 passed** (25 cũ + đối chứng dương của đường
gia sư).
