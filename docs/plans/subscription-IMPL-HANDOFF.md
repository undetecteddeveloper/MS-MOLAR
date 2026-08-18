# Subscription — bàn giao pha THỰC THI (phiên 2)

**Viết 2026-08-18.** Phiên trước đã đóng pha thiết kế (xem `subscription-HANDOFF.md`).
Phiên này chạy `recipe-fullstack-implement` bước 15 → 16 → phân rã → vòng build, **xong 8/50 task**.

Đọc file này trước. Nó tồn tại để phiên sau không phải suy lại một ngày ngữ cảnh.

---

## 1. Luồng đang ở đâu

`recipe-fullstack-implement`, luồng fullstack quy mô Large (`monorepo-flow.md`).

| Bước | Trạng thái |
|---|---|
| 1–14 | xong ở các phiên trước; kỹ sư duyệt cổng thiết kế 2026-08-18 |
| **15** acceptance-test-generator | **xong** — 3 làn đều sinh khung, không làn nào null |
| **16** work-planner | **xong** — `docs/plans/subscription-work-plan.md` **v1.3** |
| work plan review | **xong** — `needs_revision` (2 critical) → sửa → `approved_with_conditions` → sửa nốt |
| **Batch approval** | **ĐÃ CẤP** 2026-08-18 (kỹ sư chọn "full autonomous run") |
| task-decomposer | **xong** — 50 task file + 7 phase-completion + 1 overview |
| Vòng build | **8/50 xong.** Phase 0 còn **1 task** |

**Hành động kế tiếp: `docs/plans/tasks/subscription-work-plan-backend-task-08.md`** (plan Task 0.9 — leo thang BU-6). Xong nó là hết Phase 0.

## 2. Nhánh và commit

Nhánh **`feat/subscription`** (tạo từ `feat/profile-and-about`). Cây làm việc **sạch**.

5 commit dọn nền + 8 commit task:

| Commit | Nội dung |
|---|---|
| `b47c734` | dọn 52 task file của 3 recipe cũ |
| `29affe4` | `recordUsage()` nối vào 4 call site (việc dở của phiên trước) |
| `4769c70` | bộ tài liệu thiết kế subscription |
| `69714ee` | 3 khung test từ bước 15 |
| `30d8856` | 50 task file phân rã |
| `62c2d06` | Task 0.1 — `vitest.integration.config.ts` |
| `5c04e3c` | Task 0.2 — `vitest.localdb.config.ts` |
| `d001359` | Task 0.3 — **CL-02**, `TutorQuotaNote` không nhận prop |
| `803f987` | Task 0.4 — **ST-01**, S2 khởi động được |
| `b765490` | Task 0.5 — vệ sinh đợt A |
| `bcb38d9` | Task 0.6 — vệ sinh đợt B |
| `6041f23` | Task 0.7 — khung fixture-e2e |
| `24588cb` | Task 0.8 — fixture làn service |

## 3. ⛔ CỔNG CHẶN Ở TASK 12/50 — cần chính kỹ sư

**`backend-task-11` (plan Task 1.3) là bước THỦ CÔNG.** Agent không làm được:
apply tay `schema.sql` lên **DB dev** qua Supabase SQL Editor, rồi chạy `npm run verify:schema` (gate B).

Không có migration tool trong repo này — `schema.sql` được **paste tay**. Đây là lý do dev/prod trôi lệch âm thầm, và mục Risks của work plan ghi việc đó **đã cắn repo 3 lần**.

Chuỗi bị chặn sau nó: làn `test:localdb` (SVC-1/SVC-2), 2 trong 3 ca integration, `test-rls.ts` Phần 8.

**Kỹ sư đã hỏi có bỏ được DB dev không** (cần slot cho dự án khác) — trả lời: **chưa bỏ được**, nó nằm ngay trên đường tới hạn. Nếu buộc phải bỏ, mọi thứ từ Phase 1 trở đi dừng; Phase 0 vẫn chạy hết bình thường.

## 4. Giao thức vòng build (bắt buộc, đừng rút gọn)

Mỗi task: **task-executor → [integration-test-reviewer nếu `requiresTestReview: true`] → quality-fixer → orchestrator commit.**

Định tuyến **theo tên file**, không suy đoán:

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Nói rõ điều này trong mọi prompt.

### Lớp review đang bắt lỗi thật — đừng bỏ

3/8 task bị trả `needs_revision`, và các lỗi đều thuộc **một lớp: khẳng định một năng lực phân biệt mà tạo tác không có.**

- **Task 0.6** — quality-fixer bắt 4 lỗi, gồm một **cơ chế sai đã bị viết vào UI Spec** (`order_code` là `bigint` nên ca vắng / không phân tích được bị accept-list chặn TRƯỚC khi đọc, không phải "đọc ra 0 dòng"), và một lượt quét trích dẫn thiếu 8/15 chỗ — trong đó `:103` sống sót 2 lần, trích đúng cái rule mà chính task vừa sửa ở mục khác.
- **Task 0.7** — reviewer bắt: fixture timezone **không thể đỏ trên máy dev** (ambient zone là `Asia/Saigon`, formatter thiếu pin vẫn render ra `2026-09-16` = đáp án đúng); stub đồng bộ **không có cửa sổ in-flight** nên guard chống dogpile của FE-3(f) bản ĐÚNG sẽ đếm 2 và trượt. Vòng 2 reviewer dùng **3 mutant** để chứng minh phép kiểm không rỗng.
- **Task 0.8** — reviewer bắt `countFixtureRows()` **dùng chung vị từ với teardown**, nên số 0 sau teardown là hệ quả logic chứ không phải quan sát.

Khi viết prompt cho executor, **nói thẳng lớp lỗi này**. Nó tự lặp lại.

## 5. Sự thật môi trường (tốn thời gian để phát hiện lại)

- **`TaskCreate` / `TaskUpdate` KHÔNG tồn tại trong môi trường này.** Recipe bảo đăng ký task là bắt buộc; mọi agent đều báo thiếu. Bảo agent bỏ lệnh gọi nhưng vẫn làm phần việc bên dưới.
- **App root là `SOURCE/`**, không phải gốc repo. Mọi script npm chạy từ đó. `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- **`npm run verify:schema` = `npx tsx supabase/verify-schema.ts`**, độc lập — **không** nằm trong `check:bundle` (`node scripts/check-ai-key-bundle.mjs`).
- **Nền xanh: `vitest` 914 pass / 10 skip, `tsc --noEmit` 0, `eslint --max-warnings 0` 0.** Làn CI gom đúng **89 file, 0 file dưới `tests/`**.
- **Flake đã biết, đừng đuổi:** `components/tutor/ExplainStepAffordance.test.tsx` timeout 5000ms khi cache lạnh chạy song song; chạy riêng pass 5/5 trong ~680ms. Gặp thì chạy lại.
- **`test:integration` và `test:localdb` thoát khác 0** với "No test suite found in file" — khung mới chỉ có comment. **Cố ý**, đừng thêm `--passWithNoTests`.
- **Vitest không có `setupFiles`:** không có matcher `jest-dom`; jsdom khai theo từng file bằng `// @vitest-environment jsdom` ở **dòng 1**; `render()` **không** tự cleanup.
- Import thừa là **lỗi chí mạng** dưới `eslint --max-warnings 0` — đó là lý do khung test nêu tên module fixture trong comment thay vì import.
- Dùng **Bash tool** với heredoc `<<'EOF'` cho commit message. **Đừng dùng cú pháp here-string PowerShell `@'...'@`** — nó để lại ký tự `@` trong subject (đã dính 2 lần, phải `reset --soft` làm lại).

## 6. Phiên bản tài liệu hiện tại

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.6** — thẩm quyền về UI, có mệnh đề Phase Inversion |
| `docs/design/subscription-backend-design.md` | **v1.7** |
| `docs/design/subscription-frontend-design.md` | **v1.6** |
| `docs/plans/subscription-work-plan.md` | **v1.3** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — sửa nó phải sửa UI Spec trước, kèm lý do.

Frontend DD cố ý vẫn trỏ **UI Spec v1.2** ở mục "Referenced UI Spec" — đó là bản mà thiết kế đã tiêu thụ, kèm bảng liệt kê delta v1.3→v1.6 và quy tắc bác bỏ. **Đừng "sửa" nó.**

## 7. Việc mở thuộc về kỹ sư

| # | Mục | Chặn gì |
|---|---|---|
| **BU-1** | **TBD-02 nội dung pháp lý** | **bật bán + test webhook tiền thật.** `docs/legal/refund-policy.md` còn 3 chỗ `[điền…]`, chưa nêu pháp nhân bán; **chưa có bản Terms nào** dù R11 đòi 2 trang |
| **BU-2** | ADR-0018 thư viện QR | không chặn gì |
| **BU-3** | E-01 phạm vi AC-034 | không chặn gì |
| **BU-4** | U2 đơn giá thật | **bật bán** — chặn qua BU-6 |
| **BU-5** | Metric #9 baseline | **bật bán** — truy vấn `telemetry_log` 14 ngày, phải chạy TRƯỚC khi bật bán (AC-055) |
| **BU-6** | **Đích ghi bền cho AI usage chưa được thiết kế** | **Task 1.6** (không sinh file thực thi), rồi BU-4 |

**BU-6 là mới của phiên này.** Backend DD tự mâu thuẫn: `:79` liệt kê Non-scope, `:145` nói "là việc của tài liệu này" — và **không mục schema nào thiết kế bảng đó**. Kỹ sư được hỏi và trả lời "mọi quyết định kỹ thuật là của bạn"; quyết định đã chọn: **giữ cách ly**, vì bán hàng dù sao vẫn bị BU-1 và BU-5 chặn, nên gỡ BU-6 không mua được gì trên đường tới hạn. `backend-task-08` ghi việc leo thang này vào backend DD.

Chuỗi: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Không gì trong Phase 1–5 phụ thuộc nó; Phase 1 hoàn tất mà không cần nó.

## 8. Nợ kỹ thuật đã ghi trong task file, phải trả khi tới

- **Transcription drift:** `subscriptionFixtureData.ts` và `subscriptionServiceFixtures.ts` chép tay type/hằng số của backend. **`tsc` KHÔNG thấy được trôi lệch** cho tới khi có liên kết biên dịch. Dòng checklist đã cắm vào backend task **09, 12, 15, 16, 17, 18, 19** — mỗi dòng nêu type phải nối và transcription phải xoá.
- **Banner cũ** ở `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts:56` nói UI Spec "known-wrong / pending amendment" — **đã sai** từ khi Task 0.3 landing. Thuộc plan Task 2.5 (`frontend-task-05`).
- **Backend DD `:1199`** còn viết tắt `getPaymentStatus() === "paid"` (đọc như union trần). Reviewer xét là **để được** — đó là văn xuôi trong mục Verification Strategy chứ không phải khối khai báo, và viết đúng nghĩa đen sẽ ra lỗi `tsc` ngay. Gộp vào Refactor của `backend-task-16`.
- **2 tiêu chí Phase 0 completion** còn `[ ]` dù task chủ (0.3, 0.5) đã `[x]`. Tick khi đóng Phase 0.

## 9. Thứ tự chạy còn lại

Từ `docs/plans/tasks/_overview-subscription-work-plan.md`:

- **Phase 0** (còn 1): `backend-08`
- **Phase 1**: `backend-09`, `backend-10`, **`backend-11` ⚠ THỦ CÔNG**, `backend-12`, `backend-13` — (Task 1.6 ⛔ không sinh file)
- **Phase 2**: `backend-14`, `frontend-02`, `frontend-03`, `frontend-04`, `frontend-05`
- **Phase 3**: `backend-15` → `backend-19`, `frontend-06` → `frontend-09`
- **Phase 4**: `backend-20`, `frontend-10` → `frontend-14`
- **Phase 5**: `backend-21` → `backend-27`, **`backend-28` ⚠ THỦ CÔNG**
- **Phase 6**: `backend-29` → `backend-33`, `frontend-15` ⚠, `backend-34` ⚠ tiền thật, `backend-35` ⚠ bật bán

Ràng buộc thứ tự còn hiệu lực: **`backend-17`/`backend-18` trước `backend-19`** (CL-01 — `getMyOrder()` phải dùng `toCheckoutOrder()`, nếu không INT-2 đỏ vì `pendingUntil` dạng `+00:00` khác chuỗi dạng `…Z`).

## 10. Sau khi hết 50 task

Recipe đòi, đừng bỏ:

1. **code-verifier ×2** (một lần mỗi Design Doc, `doc_type: design-doc`) + **security-reviewer**, chạy **song song**.
2. Đạt: code-verifier `consistent`/`mostly_consistent`; security-reviewer `approved`/`approved_with_notes`. Trượt → gộp phát hiện thành 1 task file → executor → quality-fixer → chạy lại **chỉ** verifier đã trượt.
3. **Final Cleanup**: xoá `docs/plans/tasks/subscription-work-plan-*-task-*.md`, `*-phase*-completion.md`, `_overview-subscription-work-plan.md`. **Giữ** work plan.
