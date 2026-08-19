# Subscription — bàn giao pha THỰC THI (phiên 3)

**Viết 2026-08-19.** Phiên 1–2 đóng pha thiết kế; phiên 2 chạy bước 15→16→phân rã và 8 task đầu.
Phiên này chạy tiếp vòng build, **xong 14/50 task, Pha 0 và Pha 1 đều đóng**, và **cổng chặn thủ công đã qua**.

Đọc file này trước. Nó tồn tại để phiên sau không phải suy lại một ngày ngữ cảnh.

---

## 1. Luồng đang ở đâu

`recipe-fullstack-implement`, luồng fullstack quy mô Large (`monorepo-flow.md`).

| Bước | Trạng thái |
|---|---|
| 1–14 | xong; kỹ sư duyệt cổng thiết kế 2026-08-18 |
| 15 acceptance-test-generator | xong — 3 làn đều sinh khung |
| 16 work-planner | xong — `docs/plans/subscription-work-plan.md` **v1.3** |
| **Batch approval** | **ĐÃ CẤP** 2026-08-18 ("full autonomous run") — vẫn còn hiệu lực |
| task-decomposer | xong — 50 task file + 7 phase-completion + 1 overview |
| Vòng build | **14/50 xong. Pha 0 ✅ Pha 1 ✅** |

**Hành động kế tiếp: `docs/plans/tasks/subscription-work-plan-backend-task-14.md`** (plan Task 2.1 — mở màn Pha 2).

## 2. Nhánh và commit

Nhánh **`feat/subscription`**. Cây làm việc **sạch**. 5 commit dọn nền + 14 commit task.

Phiên 3 (6 commit):

| Commit | Task | Nội dung |
|---|---|---|
| `ad4233b` | 0.9 | Leo thang **BU-6** (E-03), backend DD v1.7 → **v1.8** |
| `e578d5d` | 1.1 | 4 khối DDL + vân tay `d714c313fe1d` → `021dd1387945` |
| `afec955` | 1.2 | Cổng A — allowlist 11 cột, ghim CHECK theo construct, dây bẫy |
| `cc393e7` | 1.3 | **Apply dev + cổng B xanh** |
| `363daeb` | 1.4 | Hằng số có tên, 5 biến env, một `periodStartEpoch()` |
| `bed04e9` | 1.5 | **Phần 9** test-rls — 20 phép kiểm RLS trên dev thật |

## 3. ✅ CỔNG CHẶN TASK 1.3 ĐÃ QUA — đọc để không làm lại

Phiên trước ghi đây là cổng thủ công không agent nào làm được. **Kỹ sư đã chỉ định làm bằng Composio**, và nó chạy được.

- **Dev = `hynwleaxtbtjzkvpjsug`**. **Prod = `pebjdlbgbmizgfpuptjl`** (tên "MS-MOLAR-prod").
  `.mcp.json` trỏ PROD — đừng đọc nhầm ref rồi kết luận nhầm môi trường.
- Công cụ: `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, tool slug **`SUPABASE_BETA_RUN_SQL_QUERY`** (chạy được DDL, đặt `read_only: false`). Toolkit `supabase` đã ACTIVE.
- Quy trình đã dùng, **lặp lại y hệt cho Task 5.8 (apply prod)**: liệt kê project để xác nhận đích → chụp trạng thái TRƯỚC → apply theo thứ tự phụ thuộc, từng khối một (API timeout khoảng 60s) → **kiểm catalog TRƯỚC khi ghi vân tay** → ghi vân tay CUỐI CÙNG.
  Vân tay đi cuối là cố ý: paste đứt giữa chừng thì DB thà không biết mình là bản nào, còn hơn khai nhận một bản nó chưa chạy hết.
- Kết quả: dev có đủ 4 đối tượng; `npm run verify:schema` **8/8 xanh**; khoá ngoại **25 → 27**, mọi `on delete` khớp (TD-011 đóng); vân tay `021dd1387945` apply lúc `2026-08-18T13:53:05.77815+00:00`.
- **Prod vẫn KHÔNG có bảng nào.** Đó là Task 5.8.

Hệ quả: làn `test:localdb`, các ca integration và `test-rls.ts` giờ chạy được trên dev thật.

## 4. Giao thức vòng build (bắt buộc, đừng rút gọn)

Mỗi task: **task-executor → [integration-test-reviewer nếu `requiresTestReview: true`] → quality-fixer → orchestrator commit.**

Định tuyến **theo tên file**, không suy đoán:

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Nói rõ trong mọi prompt.

### Lớp lỗi tái phát — đã xuất hiện 6 lần, phải nói thẳng trong mọi prompt

**Tạo tác khẳng định một năng lực phân biệt mà nó không có.** Phiên này bắt thêm 3 ca:

- **Task 1.4** — ca "day 29.999" thực ra cách biên kỳ **86,4 giây**, nên bản cài đặt mở kỳ mới sớm 1ms **sống sót qua toàn bộ suite**. quality-fixer bắt được bằng đột biến.
- **Task 1.5** — `PS-b` nhận `PGRST202` làm bằng chứng "role không có EXECUTE", nhưng PostgREST trả mã đó cho **mọi** tham chiếu hàm không giải được (sai tên hàm, sai tên tham số). Vế "trạng thái còn nguyên" khi đó đúng một cách tầm thường vì thân hàm không hề chạy.
- **Task 1.5 (phụ)** — so `period_anchor_at` dạng chuỗi bị sai vì Postgres trả `+00:00` chứ không phải `…Z`. Đúng cái bẫy plan đã cảnh báo cho INT-2/CL-01.

Ba ca phiên trước: cơ chế sai bị chép vào UI Spec; lượt quét trích dẫn sót 8/15 chỗ; fixture timezone không thể đỏ trên máy dev; helper đếm dùng chung vị từ với teardown.

**Cách viết prompt có hiệu quả:** yêu cầu executor (a) quan sát ĐỎ thật trước khi xanh, (b) nêu rõ ca kiểm bắt được những bản cài đặt sai NÀO, (c) chạy đột biến trên bản sao trong bộ nhớ rồi khôi phục. Cả ba đều đã đẻ ra phát hiện thật trong phiên này.

## 5. Sự thật môi trường (tốn thời gian để phát hiện lại)

- **`TaskCreate` / `TaskUpdate` KHÔNG tồn tại.** Mọi agent sẽ báo thiếu. Bảo agent bỏ lệnh gọi nhưng vẫn làm phần việc bên dưới.
- **`next build` TREO vô hạn dưới sandbox mặc định** (turbopack node transform pool: khoảng 2.2 CPU-giây trong 20 phút, không ghi gì, không báo lỗi). Chạy với `dangerouslyDisableSandbox: true`. **Treo chứ không FAIL** — tốn 35 phút mới phát hiện. `vitest`/`tsc`/`eslint` chạy bình thường trong sandbox.
- **Bash tool bọc lệnh trong nháy đơn**, nên **nội dung có dấu nháy đơn sẽ phá cú pháp shell** ("unexpected EOF"). Viết file dài bằng Write tool, đừng heredoc. Commit message tránh dấu nháy đơn.
- **App root là `SOURCE/`**, không phải gốc repo. `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- **Nền xanh hiện tại: `vitest` 962 pass / 10 skip trên 90 file**, `tsc --noEmit` 0, `eslint --max-warnings 0` 0.
- `test-rls.ts` chạy độc lập bằng `npx tsx supabase/test-rls.ts` (93 phép kiểm), **không** qua vitest.
- **`npm run verify:schema` = `npx tsx supabase/verify-schema.ts`**, độc lập, chạm DB thật — **không** nằm trong `check:bundle`. Script ở `SOURCE/package.json:15` (task file ghi `:13`, sai).
- **Flake đã biết, đừng đuổi:** `components/tutor/ExplainStepAffordance.test.tsx` timeout 5000ms khi cache lạnh chạy song song; chạy riêng pass 5/5 dưới 1 giây.
- **`test:integration` và `test:localdb` thoát khác 0** với "No test suite found in file" — khung mới chỉ có comment. **Cố ý**, đừng thêm `--passWithNoTests`.
- **Vitest không có `setupFiles`:** không có matcher `jest-dom`; jsdom khai theo từng file bằng chỉ thị `@vitest-environment jsdom` ở **dòng 1**; `render()` **không** tự cleanup.
- Import thừa là **lỗi chí mạng** dưới `eslint --max-warnings 0`.
- Ghi tiến độ: **Notion** qua Composio, database `3b378ba6-ae12-803c-8500-c572b6fc745f`. `PROCESS.md` đã bị xoá khỏi repo.

## 6. Phiên bản tài liệu hiện tại

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.6** — thẩm quyền về UI, có mệnh đề Phase Inversion |
| `docs/design/subscription-backend-design.md` | **v1.8** (E-03 thêm ở Task 0.9) |
| `docs/design/subscription-frontend-design.md` | **v1.6** |
| `docs/plans/subscription-work-plan.md` | **v1.3** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — sửa nó phải sửa UI Spec trước, kèm lý do.

Frontend DD cố ý vẫn trỏ **UI Spec v1.2** ở mục "Referenced UI Spec" — đó là bản mà thiết kế đã tiêu thụ, kèm bảng liệt kê delta v1.3→v1.6 và quy tắc bác bỏ. **Đừng "sửa" nó.**

## 7. Việc mở thuộc về kỹ sư

| # | Mục | Chặn gì |
|---|---|---|
| **BU-1** | **TBD-02 nội dung pháp lý** | **bật bán + test webhook tiền thật.** `docs/legal/refund-policy.md` còn 3 chỗ chưa điền, chưa nêu pháp nhân bán; **chưa có bản Terms nào** dù R11 đòi 2 trang |
| **BU-2** | ADR-0018 thư viện QR | không chặn gì |
| **BU-3** | E-01 phạm vi AC-034 | không chặn gì |
| **BU-4** | U2 đơn giá thật | **bật bán** — chặn qua BU-6 |
| **BU-5** | Metric #9 baseline | **bật bán** — truy vấn `telemetry_log` 14 ngày, phải chạy TRƯỚC khi bật bán (AC-055) |
| **BU-6** | **Đích ghi bền cho AI usage chưa được thiết kế** | **Task 1.6** (không sinh file thực thi), rồi BU-4 |

Chuỗi: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Không gì trong Pha 2–5 phụ thuộc nó.

**BU-6 đã được ghi thành E-03 trong backend DD v1.8** (Task 0.9): nêu rõ mệnh đề nào bị rút, và yêu cầu một bản sửa DD thiết kế đủ 6 phần — tên bảng; danh sách cột đầy đủ gồm tách token vào/ra kèm `thoughtsTokenCount` tính theo giá output và chiều `role`; FK kèm `on delete`; RLS policy; tập revoke/grant nêu đích danh; ảnh hưởng vân tay §17. **Cấm mọi task tự chọn sink.**

## 8. Nợ kỹ thuật và việc dọn còn nợ

- **Transcription drift:** `subscriptionFixtureData.ts` và `subscriptionServiceFixtures.ts` chép tay type/hằng số của backend; **`tsc` KHÔNG thấy được** vì chúng qua PostgREST dạng chuỗi. Task 1.4 đã trả một phần (2 hằng trong làn service chuyển sang import). Dòng checklist còn cắm ở backend task **12, 15, 16, 17, 18, 19**. `subscriptionFixtureData.ts:203` vẫn chép tay `39_000`.
- **Trích dẫn `schema.sql` mục nát:** Task 1.1 làm dịch số dòng, nên backend DD (mục Schema `:1597`, telemetry `:1381-1382`) và thân Task 1.1 trong work plan giờ trỏ vị trí cũ. Lớp CL-05/CL-06. Gộp vào đợt vệ sinh tài liệu kế tiếp.
- **`docs/plans/subscription-backend-work-plan.md:50`** (bản **đã bị thay thế**) vẫn bảo implementer chọn sink và còn nêu ưu tiên bảng riêng — đúng cái BU-6 sinh ra để chặn. Không sửa vì work plan hiện hành ghi rõ việc khai tử file đó là quyết định của kỹ sư. **Chờ kỹ sư: vô hiệu hoá hay lưu trữ.**
- **Banner cũ** ở `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts:56` nói UI Spec "known-wrong / pending amendment" — đã sai từ khi Task 0.3 landing. Thuộc plan Task 2.5 (`frontend-task-05`).
- **Backend DD `:1199`** còn viết tắt `getPaymentStatus() === "paid"`. Reviewer xét là để được. Gộp vào Refactor của `backend-task-16`.
- **Checkbox trong `phase0-completion.md` và `phase1-completion.md`** còn nhiều ô trống dù task đã xong — chỉ là sổ sách, và Final Cleanup sẽ xoá các file này. Nội dung cổng đã được verify thật.
- **`backend-task-13.md`**: mục "Exit-gate evidence" liệt kê bộ ca TRƯỚC vòng revision (16 checks); mục "Revision after integration-test-reviewer" bên dưới mới là bộ cuối (20 checks). Task 6.4 re-walk nên biết.
- **Bàn giao trong code:** Task 2.1 phải **export `PERIOD_MS`** từ `lib/billing/quota.ts` cho `resetsAt` thay vì khai lại 30 ngày. Task 5.1 sở hữu cách mã hoá `AI_BUDGET_FREE_SHARE` (phân số 0.5 hay phần trăm 50 — chưa tài liệu nào nêu, `checkEnv` cố ý chỉ kiểm "số hữu hạn lớn hơn 0").

## 9. Thứ tự chạy còn lại (36 task)

Từ `docs/plans/tasks/_overview-subscription-work-plan.md`:

- **Pha 2**: `backend-14`, `frontend-02`, `frontend-03`, `frontend-04`, `frontend-05` ← **lần đầu chạm frontend**
- **Pha 3**: `backend-15` → `backend-19`, `frontend-06` → `frontend-09`
- **Pha 4**: `backend-20`, `frontend-10` → `frontend-14`
- **Pha 5**: `backend-21` → `backend-27`, **`backend-28` ⚠ apply prod (Task 5.8)**
- **Pha 6**: `backend-29` → `backend-33`, `frontend-15`, **`backend-34` ⚠ tiền thật**, **`backend-35` ⚠ bật bán**

Ràng buộc thứ tự còn hiệu lực: **`backend-17`/`backend-18` trước `backend-19`** (CL-01 — `getMyOrder()` phải dùng `toCheckoutOrder()`, nếu không INT-2 đỏ vì `pendingUntil` dạng `+00:00` khác chuỗi dạng `…Z`). Phiên này đã gặp đúng bẫy đó ở ca SB-f: bẫy **có thật**, không phải giả định.

## 10. Sau khi hết 50 task

Recipe đòi, đừng bỏ:

1. **code-verifier ×2** (một lần mỗi Design Doc, `doc_type: design-doc`) + **security-reviewer**, chạy **song song**.
2. Đạt: code-verifier `consistent`/`mostly_consistent`; security-reviewer `approved`/`approved_with_notes`. Trượt → gộp phát hiện thành 1 task file → executor → quality-fixer → chạy lại **chỉ** verifier đã trượt.
3. **Final Cleanup**: xoá `docs/plans/tasks/subscription-work-plan-*-task-*.md`, `*-phase*-completion.md`, `_overview-subscription-work-plan.md`. **Giữ** work plan.
