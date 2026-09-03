# Task: AC-047 telemetry distinguishability (displaced proof obligation)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.7**
Layer: **backend** (test against a real Supabase client)

Metadata:
- Dependencies: backend-task-25 (plan Task 5.5 — the widened constant and the OK-04 mapping), backend-task-11 (gate B green on dev)
- Provides: the proof that the widened CHECK actually reached the database — a precondition for trusting plan Task 5.8 prod apply
- Size: Small (1 test file)

## Implementation Content

**Redis is mocked to force the refusals; the Supabase client is real.**

Three rows written by three causes, then queried:
- a **budget** refusal ⇒ `success = false`, `error_code = 'project_budget_exhausted'`;
- a **user-quota** refusal ⇒ `'user_quota_exhausted'`;
- a **simulated provider failure** ⇒ `'gemini_unavailable'`.

Assert that a `where error_code = …` query **separates them**, **and that all three inserts succeed** — which is what proves the widened CHECK actually reached the database. **A mocked Supabase client would assert the mock accepted a string, not that the constraint permits it.**

### Baseline caveat, recorded because before/after comparisons will be run against it

A real 429 records as `server` **today**, so every before/after comparison for R13 counts `success = false` **overall** and partitions the after-population by `error_code`. **Counting `gemini_unavailable` before and after reads as an improvement that did not happen.**

## Target Files
- [x] `SOURCE/tests/integration/telemetryDistinguishability.int.test.ts` (new — the config glob DID require the move; xem Investigation Notes § Chosen file location)

## Investigation Targets
- `SOURCE/lib/tutor/telemetry.ts` (the widened `TELEMETRY_ERROR_CODES` and the runtime filter at `:78`)
- `SOURCE/features/exams/tutorActions.ts` and `SOURCE/features/authoring/actions.ts` (the three refusal branches this test drives)
- `SOURCE/lib/billing/quota.ts` (the reasons Redis mocking must force)
- `SOURCE/supabase/schema.sql` (the widened `telemetry_log_error_code_check`)
- `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts` (the real-database test convention: fixture prefix, teardown)
- `SOURCE/vitest.integration.config.ts` (plan Task 0.1 — the lane this runs under)
- `docs/design/subscription-backend-design.md` (§ AC-047)

## Boundary Context (from the plan Connection Map)

**Boundary — Refusal branches → `telemetry_log`.**
- **Consumer Parse Rule**: the widened CHECK must already exist on the target database, or the insert fails and the best-effort write is lost **silently**.
- **Expected Signal**: three causes ⇒ three distinct `error_code` values, and **all three inserts are accepted**.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets; confirm gate B is green on dev before running anything
- [x] Write the three-cause case with a fixture prefix and idempotent teardown; confirm it fails before the CHECK is widened on the target database
  - **Cách nghĩa vụ này ĐƯỢC hoàn thành, nói thẳng:** CHECK đã nới trên dev từ gate B (2026-08-18) và **không được thu hẹp lại chỉ để lấy một lượt ĐỎ**. Mệnh đề tương đương đã đo được bằng ĐỘT BIẾN M3: cho một literal KHÔNG nằm trong CHECK đi lọt qua bộ lọc lúc chạy, Postgres THẬT từ chối lệnh insert với `23514 … violates check constraint "telemetry_log_error_code_check"`, dòng ấy KHÔNG vào bảng, và ca đi ĐỎ. Tức: nếu CHECK trên database đích chưa nới, ca này đỏ.
### 2. Green Phase
- [x] Run against dev; confirm all three inserts are **accepted** and the `where error_code = …` query separates them
### 3. Refactor Phase
- [x] Re-run twice in a row to confirm teardown idempotency

## Quality Assurance Mechanisms
- Real-Postgres integration tests — Enforces: the CHECK constraint actually admits the new literals — Config: `SOURCE/vitest.integration.config.ts`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: drive the three refusal branches with Redis mocked and the **real** Supabase client; query `telemetry_log` back.
- **Success criteria**: three rows, three distinct `error_code` values, **all three inserts accepted**; a `where error_code = …` query returns exactly one row each.
- **Failure response**: if an insert is rejected, the widened CHECK has not reached that database — **stop and re-run the apply**, do not relax the assertion.
- **Verification level**: L1 for the constraint (the real database accepts or rejects); L2 for the mapping.

## Proof Obligations
- **Claim (AC-047)**: a refusal is attributable — three causes produce three distinct `error_code` values and **all three inserts are accepted** by the widened CHECK.
- **Primary failure mode**: the telemetry write is best-effort, so a rejected insert is **silent**; a mocked client would assert the mock accepted a string rather than that the constraint permits it.
- **Boundary to exercise**: the real dev Postgres through the real Supabase client, under `telemetry_insert_own`.
- **State assertion**: before — zero fixture-prefixed rows; action — three refusals; after — exactly three rows, one per `error_code`, each retrievable by an equality filter.
- **Mock boundary rationale**: only Redis is mocked (to force the refusal branches deterministically); Supabase is real, because acceptance by the CHECK is the claim.
- **Residual**: proves the constraint on **dev**. Prod is proven in plan Task 5.8, with a real counting/inspection query rather than a fingerprint comparison.

## Completion Criteria
- [x] All three inserts accepted and separable by `error_code`
- [x] The baseline caveat is recorded in the test file header: **count `success = false` overall, partition the after-population by `error_code`**
- [x] Teardown is idempotent (the case passes twice in a row and in isolation)
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: test only; no product code.
- Scope boundary: the Supabase client stays real; do not substitute a mock to make the case run in CI.

## Investigation Notes (backend-task-27 execution)

### Chosen file location — and why it is NOT the path in Target Files
`SOURCE/vitest.integration.config.ts` khai `test.include: ["tests/integration/**/*.test.{ts,tsx}"]`,
còn `SOURCE/vitest.config.ts` (làn `npm test`, tức làn CI) thu `lib/**`. Đặt file ở
`SOURCE/lib/tutor/__tests__/` sẽ (1) KHÔNG chạy dưới `npm run test:integration` và
(2) chạy dưới `npm test` trong CI — nơi không có credential Supabase — nên nó sẽ đỏ
vì môi trường chứ không vì lỗi. Target Files đã lường trước đúng tình huống này
("under `SOURCE/tests/integration/` if the config glob requires it"). Vị trí đã chọn:
**`SOURCE/tests/integration/telemetryDistinguishability.int.test.ts`**.

### Investigation Targets — what each one determined
- `SOURCE/lib/tutor/telemetry.ts`: `TELEMETRY_ERROR_CODES` đã có đủ SÁU literal;
  `toErrorCode()` lọc LÚC CHẠY và trả `null` cho mã lạ — tức một bảng ánh xạ sai
  KHÔNG ném, nó ghi `null`. Đây là lối hỏng im lặng mà ca này phải bắt.
- `SOURCE/features/exams/tutorActions.ts`: ba nhánh từ chối đi qua `recordTutorInvoke()`,
  best-effort tuyệt đối (`console.warn` rồi nuốt). Thứ tự cổng: sở hữu → rate limit →
  `consumeQuota()` → tái kiểm tra sai-hai-lần → đọc câu hỏi → Gemini.
  `guard("explainStep")` = **3 lượt/24h/người** khi `GEMINI_PAID_TIER_ENABLED` không bật
  (`.env.local` không có biến này) → ngân sách của file là ĐÚNG 3 lượt gọi trên MỘT tài khoản.
- `SOURCE/features/authoring/actions.ts`: đường upload **không thể** sinh dòng `telemetry_log`
  nào — `telemetry_log_event_type_check` chỉ nhận `('adaptive_route','tutor_invoke')`,
  không có event type cho upload. Mã OK-04 của cổng upload chỉ quan sát được qua
  `console.warn` phía máy chủ (đúng như `int1CaptureWarnings()` của INT-1 đã ghi).
  Vì thế AC-047 chỉ chứng minh được trên **đường gia sư**, và cả ba nguyên nhân
  được lái qua `explainStep()`.
- `SOURCE/lib/billing/quota.ts`: `consumeQuota()` INCR khoá kỳ TRƯỚC, so với
  `PLAN_LIMITS[plan][kind]` (free/tutor = 5); chỉ khi qua được mới INCRBY khoá
  ngân sách ngày và so với `budgetCeiling()` = `floor(dailyLimit × freeShare)` cho Free.
  ⇒ nhánh `user_quota` KHÔNG BAO GIỜ chạm khoá `ai:budget:` — dấu vết thao tác Redis
  là bằng chứng độc lập rằng hai lời từ chối đến từ hai nguyên nhân KHÁC nhau.
- `SOURCE/supabase/schema.sql`: `telemetry_log.question_id` là FK tới `questions(id)`;
  `revoke select … from authenticated` ⇒ đọc ngược phải bằng service_role.
  `telemetry_insert_own` = `with check (user_id = auth.uid())` ⇒ client phải là
  phiên THẬT của chính tài khoản fixture.
- `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts`: quy ước
  `loadEnvLocal()` + prefix fixture + `cleanupFixtures()` chạy CẢ TRƯỚC lẫn SAU.
- `SOURCE/vitest.integration.config.ts`: không `setupFiles`, không `testTimeout` ⇒
  mặc định 5s. Ca này chạm Postgres thật + đăng nhập thật ⇒ khai timeout TƯỜNG MINH
  `120_000` ở tầm `describe` (đúng tiền lệ `subscription.int.test.ts:1368`), để không
  đẻ thêm một ca chập chờn kiểu `recordSkillMastery.int.test.ts`.
- `docs/design/subscription-backend-design.md` § AC-047 + work plan Connection Map:
  tín hiệu kỳ vọng = ba nguyên nhân ⇒ ba `error_code` phân biệt VÀ cả ba insert
  được CHẤP NHẬN.

### Preconditions verified before running
- Gate B xanh trên dev (`hynwleaxtbtjzkvpjsug`), apply `2026-08-18T13:53:05.77815+00:00`,
  vân tay `021dd1387945` — ghi trong work plan § Progress Tracking → Phase 1.
- Ảnh chụp dev TRƯỚC khi chạy: `telemetry_log` = 48 dòng (2 dòng `error_code` khác null,
  cả hai là `'server'` — đúng "baseline caveat" của task), `payment_orders` = 0 dòng.
- Prod (`pebjdlbgbmizgfpuptjl`) KHÔNG bị chạm tới; `.env.local.prod-backup` không được nạp.

### Mock boundary decided
Redis GIẢ (ép ba nguyên nhân), Gemini GIẢ ở đúng điểm phát duy nhất
(`generateContent`, ném lỗi `status: 503`), `@/lib/supabase/server` chỉ đổi ĐƯỜNG LẤY
PHIÊN — giá trị trả về là một client `@supabase/supabase-js` THẬT đã đăng nhập.
Postgres, RLS và CHECK constraint đều là bản THẬT.
