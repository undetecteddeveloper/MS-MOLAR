// AC-047 — MỘT lời từ chối phải QUY được về nguyên nhân: ba nguyên nhân khác
// nhau ⇒ ba `telemetry_log.error_code` PHÂN BIỆT, và cả ba lệnh insert được
// Postgres THẬT **chấp nhận** (plan Task 5.7, nghĩa vụ chứng minh bị dời khỏi
// khung `subscription.int.test.ts`).
//
// Design Doc: docs/design/subscription-backend-design.md § AC-047
// Work plan:  docs/plans/subscription-work-plan.md § Connection Map, dòng
//             "Refusal branches → telemetry_log"
// Task file:  docs/plans/tasks/subscription-work-plan-backend-task-27.md
//
// =============================================================================
// VÌ SAO CLIENT SUPABASE Ở ĐÂY LÀ THẬT, VÀ VÌ SAO ĐÓ LÀ TOÀN BỘ ĐIỂM CỦA FILE
// =============================================================================
// Lệnh ghi telemetry là BEST-EFFORT tuyệt đối: `recordTutorInvoke()` bắt lỗi,
// `console.warn` một dòng, rồi trả về như không có gì (tutorActions.ts:126-140)
// — vì một lệnh ghi quan sát không được phép trở thành điểm hỏng thứ hai của
// luồng học sinh đang chờ. Hệ quả: nếu CHECK `telemetry_log_error_code_check`
// trên database ĐÍCH chưa được nới ra sáu literal, mọi dòng mang hai mã mới bị
// từ chối và **mất trong im lặng** — không ai ở phía người dùng thấy gì cả.
//
// Một client Supabase GIẢ sẽ khẳng định rằng cái mock đã nhận một chuỗi, chứ
// KHÔNG khẳng định rằng constraint cho phép chuỗi ấy. Hai câu đó khác nhau, và
// câu thứ hai mới là thứ plan Task 5.8 (apply lên prod) dựa vào. Vì thế:
//   · `@/lib/supabase/server` chỉ bị thay ĐƯỜNG LẤY PHIÊN (cookies của
//     next/headers, không tồn tại ngoài một request Next) — giá trị trả về là
//     một client `@supabase/supabase-js` THẬT đã đăng nhập bằng mật khẩu của
//     tài khoản fixture, tức đúng JWT và đúng danh tính RLS mà production dùng;
//   · Postgres, RLS (`telemetry_insert_own`), FK `question_id → questions(id)`
//     và CHECK constraint đều là bản THẬT trên dev `hynwleaxtbtjzkvpjsug`;
//   · chỉ Redis và ĐIỂM PHÁT Gemini bị giả, và chỉ để ÉP ba nguyên nhân xảy ra
//     một cách tất định — không nhánh nào của `consumeQuota()`/`explainStep()`
//     bị bỏ qua.
//
// =============================================================================
// BASELINE CAVEAT — ghi ở đây vì mọi phép so trước/sau của R13 sẽ chạy trên nó
// =============================================================================
// Một lỗi 429 THẬT hôm nay được ghi là `server`, không phải `rate_limited` và
// cũng không phải `gemini_unavailable`. Cho nên phép so trước/sau của R13 phải:
//   **đếm `success = false` TỔNG THỂ, rồi PHÂN HOẠCH quần thể SAU theo
//   `error_code`.**
// Đếm riêng `gemini_unavailable` trước và sau sẽ đọc ra một cải thiện KHÔNG HỀ
// XẢY RA (dân số trước vốn nằm ở `server`, không nằm ở `gemini_unavailable`).
// Ca cuối trong file này dựng đúng hình dạng so sánh ấy trên quần thể fixture.
// Ảnh chụp dev lúc viết ca này: `telemetry_log` 48 dòng, trong đó ĐÚNG 2 dòng
// có `error_code` khác null và cả hai là `'server'` — nên mọi khẳng định dưới
// đây LUÔN lọc theo `user_id` của tài khoản fixture, không bao giờ đếm toàn bảng.
//
// =============================================================================
// VÌ SAO CẢ BA NGUYÊN NHÂN ĐỀU ĐI ĐƯỜNG GIA SƯ (và đường upload thì không thể)
// =============================================================================
// `telemetry_log_event_type_check` chỉ nhận `('adaptive_route','tutor_invoke')`
// — KHÔNG có event type nào cho upload. Cổng hạn mức của `app/(authoring)/
// actions.ts` vì thế không ghi nổi một dòng `telemetry_log` nào; mã OK-04 của
// nó chỉ quan sát được qua `console.warn` phía máy chủ (đúng như
// `int1CaptureWarnings()` trong `subscription.int.test.ts` đã ghi). AC-047 do
// đó chứng minh được trên đường GIA SƯ, và cả ba nguyên nhân ở đây đều đi qua
// `explainStep()`. Cố ghi một dòng telemetry cho đường upload sẽ bị chính CHECK
// của `event_type` từ chối — đó là một phát hiện, không phải một chỗ để lách.
//
// =============================================================================
// NGÂN SÁCH RATE LIMIT: ĐÚNG 3 LƯỢT, KHÔNG DƯ MỘT LƯỢT NÀO
// =============================================================================
// `RATE_LIMITS.explainStep` = `isPaidTierEnabled() ? 50 : 3` trong cửa sổ 24h,
// tính theo `explainStep:{userId}`. `.env.local` không đặt
// `GEMINI_PAID_TIER_ENABLED`, nên trần đang áp là **3**, và file này tiêu đúng
// 3 lượt trên MỘT tài khoản. Thêm một lượt gọi thứ tư vào cùng tài khoản sẽ bị
// `guard()` chặn và sinh một dòng `rate_limited` — **đổi tài khoản, đừng nới
// trần** (cùng luật mà khối INT-1 của `subscription.int.test.ts` đã ghi cho
// `guard("uploadExam")`). Lỗi ấy cũng không im lặng: ca 2 khẳng định mỗi lượt
// để lại ĐÚNG MỘT dòng và ca 5 khẳng định tổng đúng 3 dòng.
//
// MỘT tài khoản chứ không phải ba, có chủ đích: quần thể "một người dùng, ba
// nguyên nhân" chính là hình dạng mà truy vấn AC-047 phải phân hoạch được. Ba
// tài khoản sẽ khiến `where error_code = …` tách được nhờ danh tính, chứ không
// nhờ mã lỗi.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Nạp `.env.local` vào `process.env` — vitest không tự nạp và
 *  `vitest.integration.config.ts` không khai `setupFiles` nào. Chép nguyên quy
 *  ước của `features/exams/__tests__/recordSkillMastery.int.test.ts` và
 *  `tests/integration/subscription.int.test.ts`, kể cả việc bóc cặp nháy bao
 *  ngoài. KHÔNG bao giờ nạp `.env.local.prod-backup`: file ấy nằm ngay cạnh và
 *  giữ credential PROD. */
function loadEnvLocal(): void {
  const path = resolve(__dirname, "../../.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

// Bộ đếm rate limit DÙNG CHUNG phải tắt suốt cả file, kể cả sau khi `beforeAll`
// đặt lại `KV_REST_API_*` cho `consumeQuota()`. `rateLimitStore.getClient()`
// đọc env ở lần gọi ĐẦU TIÊN rồi nhớ kết quả, nên xoá TRƯỚC mọi lượt import là
// đủ để ghim nó ở `null` vĩnh viễn — nếu không, `guard()` sẽ dựng một client
// Upstash trên chính cái `@upstash/redis` đã bị giả ở dưới, và trần rate limit
// của file sẽ do một Map trong RAM quyết định theo một đường khác.
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MISSING_CREDENTIALS = (
  [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([name]) => name);
// Ném ở TẦM MODULE (lúc THU THẬP) chứ không đăng ký một ca canh gác — cùng lý
// lẽ đã ghi trong `subscription.int.test.ts`: một ca canh gác chịu bộ lọc `-t`
// của vitest và có thể bị loại đi cùng mọi ca khác rồi trả mã thoát 0 y hệt một
// lượt chạy xanh. Cả file này CHỈ có giá trị khi chạm database thật.
if (MISSING_CREDENTIALS.length > 0) {
  throw new Error(
    `Làn integration thiếu ${MISSING_CREDENTIALS.join(", ")}. AC-047 chỉ chứng ` +
      "minh được khi chạy với Supabase dev THẬT (ref hynwleaxtbtjzkvpjsug, " +
      "credential lấy từ SOURCE/.env.local): khẳng định của ca này là CHECK " +
      "constraint chấp nhận hai literal mới, và một mock không nói được điều đó."
  );
}

vi.mock("server-only", () => ({}));

/** Trạng thái của Redis GIẢ. `seed` là "sàn" gieo theo TIỀN TỐ khoá, không theo
 *  khoá đầy đủ: khoá kỳ có dạng `quota:{kind}:{userId}:{periodStartEpoch}` và
 *  `periodStartEpoch` suy ra từ `user_profiles.created_at` của tài khoản thật,
 *  nên dựng lại chuỗi khoá trong test đòi phải chép công thức mốc kỳ — đúng thứ
 *  `quotaKey()`/`periodStartEpoch()` tồn tại để chặn. Gieo theo tiền tố ép được
 *  đúng hai nguyên nhân mà không cần biết mốc kỳ. */
const { redisState } = vi.hoisted(() => ({
  redisState: {
    store: new Map<string, number>(),
    seed: { quota: 0, budget: 0 },
    ops: [] as string[],
  },
}));

/** Upstash GIẢ, dùng chung cho `readEntitlement()` (đường ĐỌC) và
 *  `consumeQuota()` (đường GHI) — đúng như production, nơi hai đường nói
 *  chuyện với cùng một Redis. `consumeQuota()` dựng instance MỚI mỗi lượt gọi
 *  nên trạng thái phải nằm ngoài class. */
vi.mock("@upstash/redis", () => {
  const initial = (key: string): number => {
    if (key.startsWith("quota:")) return redisState.seed.quota;
    if (key.startsWith("ai:budget:")) return redisState.seed.budget;
    return 0;
  };
  const current = (key: string): number =>
    redisState.store.has(key) ? redisState.store.get(key)! : initial(key);
  const bump = (op: string, key: string, by: number): number => {
    redisState.ops.push(`${op}:${key}`);
    const next = current(key) + by;
    redisState.store.set(key, next);
    return next;
  };
  return {
    Redis: class {
      async mget<T>(...keys: string[]): Promise<T> {
        redisState.ops.push(`mget:${keys.join("|")}`);
        return keys.map((k) => current(k)) as T;
      }
      async incr(key: string): Promise<number> {
        return bump("incr", key, 1);
      }
      async decr(key: string): Promise<number> {
        return bump("decr", key, -1);
      }
      async incrby(key: string, by: number): Promise<number> {
        return bump("incrby", key, by);
      }
      async decrby(key: string, by: number): Promise<number> {
        return bump("decrby", key, -by);
      }
      async expire(): Promise<number> {
        return 1;
      }
      async pexpire(): Promise<number> {
        return 1;
      }
    },
  };
});

/** Điểm phát Gemini DUY NHẤT của repo — GIẢ VÀ ĐẾM. Ném một lỗi mang
 *  `status: 503`, tức đúng hình dạng mà `classifyCallError()` xếp vào
 *  `gemini_unavailable` (RETRYABLE_HTTP_STATUSES, callTutor.ts). `message` do
 *  chính file test đặt, không phải nội dung câu hỏi UGC. */
const { geminiState, fakeGenerateContent } = vi.hoisted(() => {
  const state = { calls: 0 };
  return {
    geminiState: state,
    fakeGenerateContent: vi.fn(async () => {
      state.calls += 1;
      const err = new Error("AC-047 fixture: nhà cung cấp mô phỏng sự cố 503") as Error & {
        status: number;
      };
      err.status = 503;
      throw err;
    }),
  };
});

vi.mock("@/lib/ugc/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ugc/gemini")>()),
  generateContent: fakeGenerateContent,
}));

/** Chỉ thay ĐƯỜNG LẤY PHIÊN. Giá trị gán vào holder là client Supabase THẬT. */
const { sessionClientHolder } = vi.hoisted(() => ({
  sessionClientHolder: { current: null as SupabaseClient | null },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!sessionClientHolder.current) throw new Error("session client chưa sẵn sàng");
    return sessionClientHolder.current;
  },
}));

const { explainStep } = await import("@/features/exams/tutorActions");

// Ghim bộ đếm rate limit dùng chung về `null` NGAY BÂY GIỜ, khi env còn trống.
// Khẳng định luôn thay vì gọi suông: nếu một ngày ai đó đặt lại env sớm hơn
// dòng này thì file phải đỏ ở ĐÂY, chứ không đỏ ở một ca nói chuyện khác.
const { isSharedStoreConfigured } = await import("@/lib/security/rateLimitStore");
if (isSharedStoreConfigured()) {
  throw new Error(
    "AC-047: bộ đếm rate limit dùng chung đã được cấu hình trước khi file kịp ghim nó về null."
  );
}

// ----------------------------------------------------------------------------
// Kỳ vọng — GÕ TAY, không đọc ngược từ bảng ánh xạ đang bị kiểm
// ----------------------------------------------------------------------------
// KHÔNG import `TELEMETRY_ERROR_CODES` cũng KHÔNG import
// `QUOTA_REFUSAL_TELEMETRY_CODE`: một kỳ vọng suy ra từ chính bảng ánh xạ đang
// được kiểm thì bảng ấy sai kiểu gì hai bên cũng sai giống nhau và ca vẫn xanh.
const EXPECTED_BUDGET_CODE = "project_budget_exhausted";
const EXPECTED_USER_QUOTA_CODE = "user_quota_exhausted";
const EXPECTED_PROVIDER_CODE = "gemini_unavailable";
/** Mã của "baseline caveat" — dùng làm ĐỐI CHỨNG ÂM cho phép lọc, và cũng là
 *  giá trị mà một bảng ánh xạ bị bẹp về hằng số hay rơi vào. */
const BASELINE_SERVER_CODE = "server";
/** Đúng bằng `PLAN_LIMITS.free.tutor` — gõ tay như một THAM SỐ FIXTURE (mức
 *  gieo bộ đếm), không phải như một kỳ vọng. Ca không khẳng định gì về con số
 *  này; nếu bảng hạn mức đổi thì ca hỏng ồn ào ở khẳng định "mã phải là
 *  user_quota_exhausted", chứ không âm thầm đổi nghĩa. */
const FREE_TUTOR_LIMIT = 5;
/** Trần ngân sách ngày của lưu lượng Free = `floor(1000 × 0.5)`. Gieo khoá
 *  `ai:budget:` ĐÚNG bằng trần ⇒ lượt INCRBY kế tiếp vượt trần. */
const BUDGET_DAILY_LIMIT = "1000";
const BUDGET_FREE_SHARE = "0.5";
const BUDGET_CEILING_FREE = 500;

// ----------------------------------------------------------------------------
// Fixture
// ----------------------------------------------------------------------------
const PREFIX = "tel-int-";
const FIXTURE_EMAIL = "smithnguyen247+telemetryint@gmail.com";
const FIXTURE_PASSWORD = "telemetry-int-password-123";
const EXAM_ID = `${PREFIX}exam`;
const QUESTION_ID = `${PREFIX}q1`;

let admin: SupabaseClient;
let fixtureUserId: string;
/** `exam_attempts.id` là uuid do DB sinh — đọc lại sau khi seed. */
let attemptId: string;
let previousAttemptId: string;

interface TelemetryRow {
  id: string;
  user_id: string | null;
  event_type: string;
  question_id: string | null;
  success: boolean;
  error_code: string | null;
}

interface TutorRun {
  label: string;
  result: Awaited<ReturnType<typeof explainStep>>;
  geminiCalls: number;
  redisOps: string[];
  warnings: string[];
  /** Các dòng `telemetry_log` XUẤT HIỆN THÊM sau đúng lượt gọi này — đọc lại
   *  bằng service_role, không phải suy từ giá trị trả về. */
  newRows: TelemetryRow[];
}

const runs = {
  budget: null as TutorRun | null,
  userQuota: null as TutorRun | null,
  provider: null as TutorRun | null,
};
const snapshot = { rowsBefore: -1 };

function runOf(run: TutorRun | null, label: string): TutorRun {
  if (!run) throw new Error(`AC-047: ảnh chụp "${label}" chưa được dựng`);
  return run;
}

/** Tạo (hoặc đặt lại) tài khoản fixture đã confirm — cùng quy ước
 *  `ensureUser()` của `subscription.int.test.ts`. */
async function ensureFixtureUser(): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === FIXTURE_EMAIL);
  if (!existing) throw created.error;
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
  return existing.id;
}

/** Dọn fixture — chạy CẢ TRƯỚC lẫn SAU nên idempotent (quy ước
 *  `recordSkillMastery.int.test.ts`).
 *
 *  PHẠM VI XOÁ HẸP CÓ CHỦ ĐÍCH: `telemetry_log` xoá theo `user_id` của tài
 *  khoản fixture — một danh tính chỉ file này dùng — chứ TUYỆT ĐỐI KHÔNG theo
 *  `error_code`. Một lệnh `delete where error_code = 'server'` sẽ cuốn theo cả
 *  hai dòng lịch sử của baseline caveat, thứ file này không tạo ra.
 *
 *  Thứ tự: attempt trước exam (FK `exam_attempts.exam_id`); `exam_results` đi
 *  theo attempt bằng `on delete cascade`. `telemetry_log.question_id` là
 *  `on delete set null` nên không chặn lệnh xoá câu hỏi, nhưng vẫn xoá
 *  telemetry TRƯỚC để không bỏ lại dòng mồ côi nếu một bước sau ném lỗi. */
async function cleanupFixtures(): Promise<void> {
  await admin.from("telemetry_log").delete().eq("user_id", fixtureUserId);
  await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
  await admin.from("exams").delete().eq("id", EXAM_ID);
  await admin.from("questions").delete().eq("id", QUESTION_ID);
}

/** Seed qua service_role (bypass RLS).
 *
 *  Đề phải `published` và phải CHỨA câu hỏi trong `question_ids`:
 *  `questions_select_visible` (§UGC v2.0) chỉ cho đọc câu thuộc một đề mà người
 *  gọi thấy được, nên thiếu một trong hai thì `explainStep()` từ chối ở bước 5
 *  bằng `not_eligible` và ca "sự cố nhà cung cấp" không bao giờ tới Gemini.
 *
 *  HAI dòng `exam_results` với HAI `attempt_id` KHÁC NHAU:
 *  `computeWrongTwiceQuestionIds()` đếm theo attempt phân biệt với ngưỡng 2, và
 *  `explainStep()` còn đòi câu này đang sai TRONG CHÍNH lượt đang xem. Thiếu
 *  fixture này thì cả ba lượt đều dừng ở bước 4 và ba dòng telemetry sẽ mang
 *  cùng một mã `not_eligible` — tức bài kiểm tra tự làm mình vô hiệu. */
async function setupFixtures(): Promise<void> {
  const question = await admin.from("questions").insert({
    id: QUESTION_ID,
    content: "[tel-int] 2 + 2 bằng mấy?",
    choices: [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
    ],
    correct_answer: "B",
    subject: "Toán",
    grade: 10,
    topic: "Fixture telemetry",
    question_type: "mcq",
  });
  if (question.error) throw question.error;

  const exam = await admin.from("exams").insert({
    id: EXAM_ID,
    title: "[tel-int] Đề fixture telemetry",
    question_ids: [QUESTION_ID],
    duration_minutes: 15,
    subject: "Toán",
    grade: 10,
    status: "published",
  });
  if (exam.error) throw exam.error;

  const attempts = await admin
    .from("exam_attempts")
    .insert([
      { exam_id: EXAM_ID, user_id: fixtureUserId, status: "submitted" },
      { exam_id: EXAM_ID, user_id: fixtureUserId, status: "submitted" },
    ])
    .select("id");
  if (attempts.error) throw attempts.error;
  const ids = (attempts.data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length !== 2) throw new Error(`AC-047: cần 2 attempt fixture, nhận ${ids.length}`);
  [attemptId, previousAttemptId] = ids;

  const wrong = [{ questionId: QUESTION_ID, isCorrect: false, scored: true }];
  const results = await admin.from("exam_results").insert([
    {
      attempt_id: attemptId,
      user_id: fixtureUserId,
      total_score: 0,
      correct: 0,
      total: 1,
      per_question: wrong,
      topic_breakdown: [],
    },
    {
      attempt_id: previousAttemptId,
      user_id: fixtureUserId,
      total_score: 0,
      correct: 0,
      total: 1,
      per_question: wrong,
      topic_breakdown: [],
    },
  ]);
  if (results.error) throw results.error;
}

/** Đọc ngược bằng service_role: `revoke select … from anon, authenticated` nên
 *  chính phiên học sinh KHÔNG đọc được bảng này. Luôn lọc theo `user_id` fixture. */
async function readFixtureRows(): Promise<TelemetryRow[]> {
  const { data, error } = await admin
    .from("telemetry_log")
    .select("id, user_id, event_type, question_id, success, error_code")
    .eq("user_id", fixtureUserId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TelemetryRow[];
}

/** Bắt `console.warn` mà KHÔNG nuốt nó: `recordTutorInvoke()` báo một lệnh
 *  insert bị từ chối bằng đúng kênh này và không bằng kênh nào khác. */
function captureWarnings(sink: string[]): () => void {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    sink.push(args.map((a) => String(a)).join(" "));
    (original as (...a: unknown[]) => void)(...args);
  };
  return () => {
    console.warn = original;
  };
}

/**
 * MỘT lượt gia sư. Khác biệt DUY NHẤT giữa ba lượt là `seed` của Redis giả, nên
 * mã `error_code` đọc được quy về đúng nguyên nhân và chỉ về nguyên nhân ấy.
 */
async function runTutor(label: string, seed: { quota: number; budget: number }): Promise<TutorRun> {
  const before = new Set((await readFixtureRows()).map((r) => r.id));

  redisState.store.clear();
  redisState.seed = seed;
  redisState.ops.length = 0;
  geminiState.calls = 0;

  const warnings: string[] = [];
  const restoreWarn = captureWarnings(warnings);
  let result: Awaited<ReturnType<typeof explainStep>>;
  try {
    result = await explainStep(attemptId, QUESTION_ID);
  } finally {
    restoreWarn();
  }

  const rows = await readFixtureRows();
  return {
    label,
    result,
    geminiCalls: geminiState.calls,
    redisOps: [...redisState.ops],
    warnings,
    newRows: rows.filter((r) => !before.has(r.id)),
  };
}

describe(
  "AC-047 — ba nguyên nhân từ chối ⇒ ba error_code phân biệt, và Postgres THẬT chấp nhận cả ba",
  () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeAll(async () => {
      admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      fixtureUserId = await ensureFixtureUser();
      await cleanupFixtures();
      await setupFixtures();

      const session = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await session.auth.signInWithPassword({
        email: FIXTURE_EMAIL,
        password: FIXTURE_PASSWORD,
      });
      if (signIn.error) throw signIn.error;
      sessionClientHolder.current = session;

      for (const name of [
        "KV_REST_API_URL",
        "KV_REST_API_TOKEN",
        "AI_BUDGET_DAILY_LIMIT",
        "AI_BUDGET_FREE_SHARE",
      ]) {
        savedEnv[name] = process.env[name];
      }
      // `consumeQuota()`/`readEntitlement()` đọc env LÚC GỌI, nên đặt ở đây là
      // đủ; hai giá trị URL/TOKEN chỉ cần khác rỗng vì `@upstash/redis` đã giả.
      process.env.KV_REST_API_URL = "https://ac047-fake-upstash.invalid";
      process.env.KV_REST_API_TOKEN = "ac047-fake-token";
      process.env.AI_BUDGET_DAILY_LIMIT = BUDGET_DAILY_LIMIT;
      process.env.AI_BUDGET_FREE_SHARE = BUDGET_FREE_SHARE;

      snapshot.rowsBefore = (await readFixtureRows()).length;

      // Thứ tự ba lượt không tạo phụ thuộc: mỗi lượt xoá sạch Redis giả và đọc
      // lại DELTA dòng telemetry của riêng nó.
      runs.budget = await runTutor("budget", { quota: 0, budget: BUDGET_CEILING_FREE });
      runs.userQuota = await runTutor("user_quota", { quota: FREE_TUTOR_LIMIT, budget: 0 });
      runs.provider = await runTutor("provider", { quota: 0, budget: 0 });
    }, 120_000);

    afterAll(async () => {
      for (const [name, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      if (admin && fixtureUserId) await cleanupFixtures();
    }, 120_000);

    // =========================================================================
    // Ca 1 — ĐỐI CHỨNG: ba lượt đã chạy BA NHÁNH KHÁC NHAU
    // =========================================================================
    // Không có ca này thì "ba mã khác nhau" vẫn có thể xanh vì một lý do sai:
    // ba lượt cùng dừng ở một cổng và mã khác nhau vì một chuyện khác. Bằng
    // chứng ở đây độc lập với `error_code`:
    //   · từ chối vì HẠN MỨC NGƯỜI DÙNG xảy ra TRƯỚC khi `consumeQuota()` chạm
    //     khoá ngân sách ⇒ lượt ấy KHÔNG có thao tác `ai:budget:` nào;
    //   · từ chối vì NGÂN SÁCH DỰ ÁN xảy ra SAU ⇒ lượt ấy có cả INCRBY lẫn
    //     DECRBY trên `ai:budget:`;
    //   · sự cố nhà cung cấp là lượt DUY NHẤT đi tới điểm phát Gemini.
    it("ca 1 — dấu vết Redis và số lượt gọi Gemini chứng minh ba nhánh khác nhau đã chạy", () => {
      const budget = runOf(runs.budget, "budget");
      const userQuota = runOf(runs.userQuota, "user_quota");
      const provider = runOf(runs.provider, "provider");

      // Hai lời từ chối hạn mức KHÔNG phân biệt được từ phía client — đó là
      // hợp đồng UI (UI-D3), và cũng chính là lý do AC-047 tồn tại.
      expect(budget.result).toEqual({ error: "not_eligible" });
      expect(userQuota.result).toEqual({ error: "not_eligible" });
      expect(provider.result).toEqual({ error: "gemini_unavailable" });

      const budgetOps = (run: TutorRun) => run.redisOps.filter((op) => op.includes("ai:budget:"));
      expect(budgetOps(userQuota)).toEqual([]);
      expect(budgetOps(budget).some((op) => op.startsWith("incrby:"))).toBe(true);
      expect(budgetOps(budget).some((op) => op.startsWith("decrby:"))).toBe(true);

      // ĐÚNG 0 lượt phát ở hai lượt bị chặn, và ĐÚNG 1 ở lượt được cấp phép.
      // Con số 1 là chứng cứ đối chứng DƯƠNG: không có nó thì "0 lượt" cũng
      // xanh y hệt với một mock chưa bao giờ được nối vào.
      expect(budget.geminiCalls).toBe(0);
      expect(userQuota.geminiCalls).toBe(0);
      expect(provider.geminiCalls).toBe(1);
    });

    // =========================================================================
    // Ca 2 — CẢ BA LỆNH INSERT ĐƯỢC POSTGRES CHẤP NHẬN
    // =========================================================================
    // "Lệnh insert không ném" KHÔNG bằng "dòng đã nằm trong bảng với giá trị
    // ấy": `recordTutorInvoke()` nuốt mọi lỗi. Ca này đọc NGƯỢC bằng
    // service_role và đếm DELTA của từng lượt, cộng thêm khẳng định vắng mặt
    // trên kênh cảnh báo — kênh DUY NHẤT mà một lệnh insert bị CHECK từ chối
    // phát ra tín hiệu.
    it("ca 2 — mỗi lượt để lại ĐÚNG MỘT dòng tutor_invoke thất bại, không cảnh báo telemetry nào", () => {
      expect(snapshot.rowsBefore).toBe(0);

      for (const run of [
        runOf(runs.budget, "budget"),
        runOf(runs.userQuota, "user_quota"),
        runOf(runs.provider, "provider"),
      ]) {
        expect(run.newRows, `lượt "${run.label}"`).toHaveLength(1);
        const row = run.newRows[0];
        expect(row.user_id).toBe(fixtureUserId);
        expect(row.event_type).toBe("tutor_invoke");
        expect(row.question_id).toBe(QUESTION_ID);
        expect(row.success).toBe(false);
        // Lọc theo TIỀN TỐ của đúng call site (`tutorActions.ts:133/137`) chứ
        // không tìm một chuỗi con chung chung: mọi `console.warn` khác trong
        // lượt chạy (readEntitlement, consumeQuota) không được phép làm ca này
        // đỏ, và cũng không được phép làm nó xanh hộ.
        expect(
          run.warnings.filter((w) => w.includes("[explainStep] telemetry_log")),
          `lượt "${run.label}" có cảnh báo telemetry`
        ).toEqual([]);
      }
    });

    // =========================================================================
    // Ca 3 — BA MÃ PHÂN BIỆT, khẳng định bằng BẤT ĐẲNG THỨC chứ không chỉ ba
    //        phép so giá trị rời
    // =========================================================================
    // Một bảng ánh xạ bị bẹp về HẰNG SỐ (cả ba lý do → cùng một mã) vẫn qua
    // được một bộ ca kiểm từng giá trị một nếu mỗi ca chỉ nhìn thấy mã của
    // chính nó. Khẳng định phải nói ra rằng ba mã KHÁC NHAU.
    it("ca 3 — ba nguyên nhân ⇒ ba error_code khác nhau đôi một", () => {
      const budgetCode = runOf(runs.budget, "budget").newRows[0]?.error_code;
      const userQuotaCode = runOf(runs.userQuota, "user_quota").newRows[0]?.error_code;
      const providerCode = runOf(runs.provider, "provider").newRows[0]?.error_code;

      // BẤT ĐẲNG THỨC ĐỨNG TRƯỚC, có chủ đích: đây là tính chất KHÔNG phụ
      // thuộc vào ba literal gõ tay ở đầu file, nên nó là chỗ một bảng ánh xạ
      // bẹp về hằng số phải lộ ra ĐẦU TIÊN. Ba phép so giá trị ngay dưới mới
      // ghim từng cặp (nguyên nhân → mã) vào đúng literal của CHECK.
      expect(budgetCode).not.toBe(userQuotaCode);
      expect(userQuotaCode).not.toBe(providerCode);
      expect(budgetCode).not.toBe(providerCode);
      expect(new Set([budgetCode, userQuotaCode, providerCode]).size).toBe(3);

      expect(budgetCode).toBe(EXPECTED_BUDGET_CODE);
      expect(userQuotaCode).toBe(EXPECTED_USER_QUOTA_CODE);
      expect(providerCode).toBe(EXPECTED_PROVIDER_CODE);
    });

    // =========================================================================
    // Ca 4 — `where error_code = …` TÁCH được ba dòng
    // =========================================================================
    // Đây là truy vấn mà AC-047 hứa cho người vận hành. Kèm một ĐỐI CHỨNG ÂM:
    // cùng bộ lọc với mã `server` phải trả về 0 dòng. Không có nó thì "mỗi truy
    // vấn trả 1 dòng" cũng xanh với một bộ lọc bị bỏ qua — chỉ cần quần thể có
    // đúng một dòng cho mỗi mã. Đối chứng âm cũng chính là chỗ một bảng ánh xạ
    // bẹp về `server` lộ ra.
    it("ca 4 — truy vấn lọc theo error_code trả về ĐÚNG một dòng mỗi mã, và 0 dòng cho mã baseline", async () => {
      const expectedIds = {
        [EXPECTED_BUDGET_CODE]: runOf(runs.budget, "budget").newRows[0]?.id,
        [EXPECTED_USER_QUOTA_CODE]: runOf(runs.userQuota, "user_quota").newRows[0]?.id,
        [EXPECTED_PROVIDER_CODE]: runOf(runs.provider, "provider").newRows[0]?.id,
      };

      for (const [code, expectedId] of Object.entries(expectedIds)) {
        const { data, error } = await admin
          .from("telemetry_log")
          .select("id, error_code")
          .eq("user_id", fixtureUserId)
          .eq("error_code", code);
        expect(error, `truy vấn mã ${code}`).toBeNull();
        expect(data, `truy vấn mã ${code}`).toHaveLength(1);
        expect((data?.[0] as { id: string }).id).toBe(expectedId);
      }

      const baseline = await admin
        .from("telemetry_log")
        .select("id")
        .eq("user_id", fixtureUserId)
        .eq("error_code", BASELINE_SERVER_CODE);
      expect(baseline.error).toBeNull();
      expect(baseline.data).toHaveLength(0);
    }, 60_000);

    // =========================================================================
    // Ca 5 — HÌNH DẠNG SO SÁNH TRƯỚC/SAU CỦA R13
    // =========================================================================
    // Đếm `success = false` TỔNG THỂ, rồi PHÂN HOẠCH quần thể SAU theo
    // `error_code`. Đếm riêng `gemini_unavailable` trước và sau sẽ đọc ra một
    // cải thiện không hề xảy ra: trước R13 một lỗi 429 thật rơi vào `server`,
    // nên dân số "trước" của `gemini_unavailable` vốn đã thiếu nó.
    it("ca 5 — quần thể sau: 3 lượt thất bại, phân hoạch theo error_code là 1/1/1", async () => {
      const failures = await admin
        .from("telemetry_log")
        .select("error_code", { count: "exact" })
        .eq("user_id", fixtureUserId)
        .eq("success", false);
      expect(failures.error).toBeNull();
      expect(failures.count).toBe(3);

      const tally: Record<string, number> = {};
      for (const row of (failures.data ?? []) as { error_code: string | null }[]) {
        const key = row.error_code ?? "null";
        tally[key] = (tally[key] ?? 0) + 1;
      }
      expect(tally).toEqual({
        [EXPECTED_BUDGET_CODE]: 1,
        [EXPECTED_USER_QUOTA_CODE]: 1,
        [EXPECTED_PROVIDER_CODE]: 1,
      });
    }, 60_000);
  },
  120_000
);
