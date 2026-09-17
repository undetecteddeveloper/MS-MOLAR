// Subscription INT-1 — KHỐI KIỂM BỊ CÁCH LY (quarantine). KHÔNG chạy trong làn
// `npm run test:integration`.
// Tách ra ngày 2026-09-18 từ `SOURCE/tests/integration/subscription.int.test.ts`
// (khối INT-1: phần đặc tả + phần cài đặt, NGUYÊN VĂN, không một khẳng định nào
// bị sửa, làm yếu, skip hay xoá). Sổ nợ: `TECH-DEBT.md` TD-034.
//
// =============================================================================
// VÌ SAO KHỐI NÀY ĐỎ, VÀ VÌ SAO KHÔNG ĐƯỢC SỬA NÓ CHO XANH
// =============================================================================
// Commit `a77e03d` (2026-09-03, "fix(ugc): tat cong han muc upload (I3) vi
// Subscription chua trien khai") CỐ Ý gỡ lời gọi `consumeQuota("upload", …)`
// khỏi `extractAndAssemble`. Lý do ghi trong chính commit đó: cổng ấy khoá MỌI
// người dùng Free vào 3 lượt upload mỗi kỳ 30 ngày (`PLAN_LIMITS.free.upload`)
// trong khi `GEMINI_PAID_TIER_ENABLED` còn TẮT và KHÔNG có đường mua nào để mở
// khoá — nó chặn người dùng thật mà không bán được gì. `lib/billing/quota.ts`
// giữ nguyên, gọi lại được khi Subscription ra mắt thật.
//
// Tám ca dưới đây canh đúng cái cổng ấy, nên chúng đỏ vì một QUYẾT ĐỊNH SẢN
// PHẨM, không vì một lỗi. Chúng là test ĐÚNG khẳng định một cổng CỐ Ý vắng mặt.
// Làm chúng xanh bằng cách sửa kỳ vọng, `skip` hay xoá là xoá luôn thứ duy nhất
// còn nhớ rằng cổng ấy từng tồn tại và phải quay lại.
//
// Hai ca còn lại trong khối ((a) đường GIA SƯ và đối chứng dương của nó) vẫn
// XANH — đường gia sư chưa bị gỡ cổng. Chúng đi theo khối vì cả mười ca dùng
// CHUNG một ảnh chụp dựng trong `beforeAll`; tách đôi là viết lại fixture, tức
// là không còn "nguyên văn" nữa.
//
// =============================================================================
// ĐIỀU KIỆN BẬT LẠI, VÀ ĐÚNG MỘT BƯỚC ĐỂ BẬT
// =============================================================================
// ĐIỀU KIỆN: `consumeQuota("upload", user.id, ent, …)` quay lại đường upload
//   (`features/authoring/uploadActions.ts`) khi Subscription ship — tức khi đã
//   có đường mua thật và `GEMINI_PAID_TIER_ENABLED` bật.
//
// BƯỚC: xoá ĐÚNG MỘT DÒNG
//   `"tests/integration/pending/subscription-quota.int.test.ts",`
//   trong `test.exclude` của `SOURCE/vitest.integration.config.ts`. Không phải
//   sửa gì trong file này. Sau đó `npm run test:integration` phải trả về 31 ca
//   (21 + 10) và XANH hết.
//   (Muốn gộp lại đúng hình dạng cũ thì chép hai khối dưới đây trở lại
//   `tests/integration/subscription.int.test.ts` — chúng vẫn nguyên văn; trừ
//   `INT1_ACTIONS_PATH`, xem ghi chú tại chỗ.)
//
// VẪN ĐƯỢC SOI KIỂU: file nằm trong `**/*.ts` của `SOURCE/tsconfig.json`, nên
// `npx tsc --noEmit` (và `next build`) vẫn kiểm nó. Bị loại khỏi LÀN CHẠY chứ
// không bị bỏ ra khỏi cây mã — nó không thể mục trong im lặng.
//
// CHẠY TAY ĐỂ XEM TÁM CA ĐỎ CÒN NGUYÊN: xoá dòng `exclude` nói ở trên, rồi
//   `npm run test:integration`. KHÔNG có đường tắt bằng dòng lệnh, và chỗ này
//   ăn mất một buổi nếu chỉ đoán: một filter đường dẫn trên CLI chỉ LỌC TRONG
//   tập file mà `include` trừ `exclude` đã cho ra — nó không thêm lại được file
//   nào. Đo 2026-09-18:
//     npx vitest run --config vitest.integration.config.ts \
//       tests/integration/pending/subscription-quota.int.test.ts
//     → "No test files found", exit 1.
//   Và `--exclude` trên CLI CỘNG THÊM vào danh sách của config chứ không ghi
//   đè, nên cũng không gỡ cách ly bằng nó được. Một dòng trong config là bước
//   duy nhất, và đó là chủ đích: bật lại thì làn phải ĐỎ cho tới khi cổng hạn
//   mức thật sự quay lại — đúng vòng Red→Green của lượt làm Subscription.
//
// =============================================================================
// PHẦN DỰNG SẴN CHÉP THEO TỪ FILE GỐC — và phần CỐ Ý không chép
// =============================================================================
// Chép theo vì khối INT-1 cần: `loadEnvLocal()`, hai lệnh `delete` tắt bộ đếm
// rate limit dùng chung, `vi.mock("server-only")`, và cặp
// `sessionClientHolder` + `vi.mock("@/lib/supabase/server")`.
// KHÔNG chép: cửa chặn thiếu credential, mock payOS, `createOrder`,
// `ensureUser()`, `signedInClient()` — tất cả thuộc INT-2/INT-3, những ca cần
// Supabase dev THẬT. Khối này giả Redis, giả Gemini và giả client Supabase, nên
// nó chạy được mà không cần một credential nào.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Nạp `.env.local` vào `process.env` — chép từ file gốc, chỉ đổi độ sâu đường
 *  dẫn (file này nằm sâu hơn một cấp). Khối INT-1 không đòi credential nào,
 *  nhưng các module nó nạp thật (`lib/ugc/gemini`, `features/authoring/*`) đọc
 *  env, nên giữ lượt nạp này là giữ đúng môi trường mà tám ca kia từng chạy. */
function loadEnvLocal(): void {
  const path = resolve(__dirname, "../../../.env.local");
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

// Xoá TRƯỚC mọi lượt import: `rateLimitStore.ts` đọc env ở lần gọi ĐẦU TIÊN rồi
// nhớ lại kết quả, và khối INT-1 khẳng định ở tầm module rằng bộ đếm dùng chung
// chưa được cấu hình (xem `isSharedStoreConfigured()` bên dưới).
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

vi.mock("server-only", () => ({}));

/** Chỉ thay ĐƯỜNG LẤY SESSION (cookies của next/headers, không tồn tại ngoài
 *  một request Next). Ở file gốc, holder này nhận một client Supabase THẬT cho
 *  INT-2/INT-3; trong khối INT-1 nó luôn nhận client giả trong RAM mà
 *  `int1SupabaseClient()` dựng, nên không ca nào ở đây chạm database. */
const { sessionClientHolder } = vi.hoisted(() => ({
  sessionClientHolder: { current: null as SupabaseClient | null },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!sessionClientHolder.current) throw new Error("session client chưa sẵn sàng");
    return sessionClientHolder.current;
  },
}));

// =============================================================================
// INT-1 — The quota gate short-circuits Gemini emission and counts operations,
//         not rows
// =============================================================================
// AC-018: "Cho một lượt gọi bị chặn vì hạn mức, khi rà, thì 0 lần gọi adapter
//          Gemini xảy ra." (PRD :270 — gate placed ahead of the branch)
// AC-019: "Cho cổng hạn mức, khi đặt, thì nó nằm TRƯỚC nhánh rẽ ở actions.ts,
//          đếm trong Redis chứ không đếm số dòng." (PRD :271)
// AC-017: "Cho check LIMITS.MAX_UPLOADS_PER_DAY tại actions.ts:337, khi feature
//          này ship, thì nó bị XOÁ, không phải để lại song song." (PRD :269)
// EARS: (none / If-then) -> basic functionality + branch coverage.
// ROI: 89 (BV:9 x Freq:9 + Legal:0 + Defect:8)
// Behavior: user activates tutor/upload -> consumeQuota() decides at the action
//   -> on refusal the Gemini adapter is never reached; on grant exactly one
//   upload allowance is consumed in BOTH branches (rerunExamId set and unset).
// @category: core-functionality
// @lane: integration
// @dependency: features/authoring/actions.ts, features/exams/tutorActions.ts,
//   lib/billing/quota.ts (consumeQuota), lib/ugc/gemini.ts (emit chokepoint),
//   lib/billing/readEntitlement.ts
//   CORRECTED (was `features/exams/actions.ts`): `extractAndAssemble` — the
//   function AC-017/018/019 talk about — lives in `features/authoring/actions.ts`.
//   `features/exams/actions.ts` never mentioned `MAX_UPLOADS_PER_DAY`, so an
//   absence assertion written against it would have been permanently green.
// @complexity: high
// Mock boundary (backend DD Test Boundaries, `consumeQuota` row): Redis is
//   MOCKED — "fail-closed on unavailability is the claim". The Gemini adapter
//   is MOCKED AND INVOCATION-COUNTED. Everything between the action entry point
//   and those two boundaries is REAL (no mocking of quota.ts, no mocking of the
//   action itself) — mocking an internal module here would assert the mock.
// @real-dependency: none (both boundaries of this case are marked "mocked" in
//   the backend DD's Mock Boundary Decisions table)
//
// Primary failure mode: a refused call still reaches Gemini (the gate is placed
//   after the branch, or the refusal path falls through), so a user who is out
//   of allowance still spends supplier budget; and/or the re-run upload branch
//   consumes zero allowance because the deleted row-count check was replaced by
//   something that still counts rows created rather than operations performed.
//
// Proof obligation:
//   - Traverse the REFUSAL branch, not only the happy path. The main path stays
//     green through this regression: an ungated Gemini call succeeds and returns
//     a valid answer, so only the refusal branch exposes it.
//   - Observable state before/after for the counting claim: read the mocked
//     Redis counter for `quota:upload:{userId}:{periodStart}` BEFORE and AFTER
//     each upload, and assert the DELTA against a HARDCODED literal 1 — never a
//     value read back from the code under test (backend DD, `consumeQuota`
//     counting-unit row: "Expected values are hardcoded, never read back").
//   - The Gemini adapter is the only boundary that may be counted as a proxy for
//     "no emission"; assert the count, not merely that a rejection was returned.
// Verification points / expected results / pass criteria:
//   (a) Free user whose tutor allowance is exhausted activates the tutor action
//       => the action resolves with reason `user_quota`, AND the Gemini adapter
//       mock has EXACTLY 0 invocations. (AC-018)
//   (b) Same user, upload action, `rerunExamId` UNSET => resolves successfully,
//       `quota:upload:{user}:{period}` delta is EXACTLY 1. (AC-019, the
//       "expected non-difference" of the backend DD's output comparison)
//   (c) Same user, upload action, `rerunExamId` SET (the re-run branch) =>
//       resolves successfully, `quota:upload:{user}:{period}` delta is EXACTLY 1.
//       This is the backend DD's stated "expected difference": the deleted
//       row-count check counted rows created and a re-run creates none, so this
//       assertion fails against the OLD behaviour. (AC-017 + AC-019)
//   (d) `SOURCE/features/authoring/actions.ts` contains no surviving reference to
//       `LIMITS.MAX_UPLOADS_PER_DAY` — an absence assertion, so the old check
//       cannot be left running in parallel with the new gate. (AC-017)
//       CORRECTED (was `features/exams/actions.ts`): `extractAndAssemble` lives
//       in layer4, and `features/exams/actions.ts` never mentioned
//       `MAX_UPLOADS_PER_DAY` — the assertion as written would have been
//       permanently green while observing nothing. The implementation below
//       reads layer4 and opens with two PRESENCE assertions so that "string not
//       found" and "read the wrong file" cannot read identically.
//   (e) Redis unavailable (the mock throws) => the action refuses, and the
//       Gemini adapter mock has EXACTLY 0 invocations. Fail-CLOSED. (AC-024's
//       shape as it applies at this gate; the standalone AC-024 unit case is not
//       duplicated here)

// =============================================================================
// INT-1 — IMPLEMENTATION (plan Task 5.4, commit đặt cổng hạn mức lên đường
//         upload và xoá khối đếm dòng cũ)
// =============================================================================
// Đọc khối chú thích INT-1 ở đầu file trước: năm nghĩa vụ (a)…(e) nằm ở đó,
// nguyên văn, và các ca dưới đây mang đúng nhãn ấy. Ba điểm phải nói rõ vì
// chúng KHÁC khung, và khác có lý do:
//
// 1. KHUNG GHI SAI ĐƯỜNG DẪN Ở NGHĨA VỤ (d). Khung viết
//    `SOURCE/features/exams/actions.ts`, nhưng `extractAndAssemble` — hàm mà cả
//    AC-017/018/019 nói tới — sống ở `SOURCE/features/authoring/actions.ts`;
//    `features/exams/actions.ts` chưa từng nhắc `LIMITS.MAX_UPLOADS_PER_DAY` một lần
//    nào, nên một khẳng định vắng mặt viết cho nó sẽ XANH VĨNH VIỄN mà không
//    quan sát gì. Ca (d) vì thế đọc file layer4, và mở đầu bằng hai khẳng định
//    CÓ MẶT (file tồn tại, và nó chứa `extractAndAssemble`) — không có chúng
//    thì "không tìm thấy chuỗi nào" và "đọc nhầm file" đọc giống hệt nhau.
//
// 2. VÌ SAO CÁC CA ĐƯỢC CẤP PHÉP LẠI ĐỂ GEMINI HỎNG. Ba ca (b)/(c)/(f) chạy
//    với adapter Gemini ném lỗi, nên pipeline dừng ở stage 5 và trả
//    `kind: "extraction"`. Đó là CHỦ ĐÍCH: `consumeQuota()` ĐẶT CHỖ trước lời
//    gọi đầu tiên và cố ý KHÔNG hoàn lại khi lời gọi sau đó hỏng (backend DD
//    § "Where the budget increment lives"), nên một lượt hỏng ở Gemini vẫn phải
//    hiện đúng một suất kỳ và đúng số request đã đặt chỗ. Cho Gemini "thành
//    công" sẽ phải bịa ra hai payload JSON đúng schema — nhiều mã hơn, và cái
//    thêm được là stage 6–8, thứ không ca nào ở đây khẳng định.
//    Hệ quả quan trọng hơn: SỐ LƯỢT GỌI ADAPTER KHÁC 0 trên đường được cấp
//    phép. Không có nó thì "đúng 0 lượt gọi" ở (a)/(e)/(g) là một khẳng định
//    RỖNG — nó cũng xanh y hệt với một cổng từ chối tất cả, hoặc với một mock
//    không bao giờ được nối vào.
//
// 3. VÌ SAO PHẢI BA CA ĐƯỢC CẤP PHÉP CHỨ KHÔNG PHẢI HAI. Khung chỉ đòi (b)
//    `rerunExamId` unset và (c) set. Ghép mỗi nhánh với một chế độ thì hai biến
//    dính vào nhau: một bản cài đặt tính chi phí theo NHÁNH (`rerunExamId ? 3 :
//    2`) sẽ vượt qua đúng bộ ca đó. Ba ca tách hai biến ra:
//      (b) typed  + unset ⇒ 2 request      (f) automatic + unset ⇒ 3 request
//      (c) typed  + SET   ⇒ 2 request
//    (b) vs (f): cùng nhánh, khác chế độ, khác chi phí ⇒ chi phí đi theo CHẾ ĐỘ.
//    (b) vs (c): cùng chế độ, khác nhánh, cùng chi phí ⇒ nhánh không đổi chi
//    phí, còn suất kỳ vẫn đúng 1 ở cả hai. Mọi con số kỳ vọng (1, 2, 3) là
//    literal GÕ TAY; không ca nào đọc `GEMINI_CALLS_PER_OPERATION` để dựng kỳ
//    vọng của chính nó.
//
// RANH GIỚI MOCK (backend DD Test Boundaries, dòng `consumeQuota`):
//   · `@upstash/redis` — GIẢ, một Map trong RAM. "Từ chối khi hạ tầng không
//     tới được" là chính lời khẳng định, nên nó phải hỏng theo lệnh.
//   · `@/lib/ugc/gemini` — chỉ `generateContent()`, GIẢ VÀ ĐẾM. Đây là điểm
//     phát duy nhất của repo (plan Task 5.2), tức ranh giới hợp lệ duy nhất để
//     đếm "0 byte tới nhà cung cấp".
//   · `@/lib/supabase/server` — đã giả sẵn ở tầm file cho INT-2/INT-3; INT-1
//     chuyển `sessionClientHolder` sang một client giả trong RAM.
//   · KHÔNG giả `quota.ts`, KHÔNG giả `readEntitlement.ts`, KHÔNG giả chính
//     server action. Giả một module nội bộ ở đây là khẳng định cái mock.
//
// BỘ ĐẾM RATE LIMIT DÙNG CHUNG PHẢI TẮT SUỐT CẢ FILE, kể cả sau khi INT-1 đặt
// lại `KV_REST_API_*` cho `consumeQuota()`. `rateLimitStore.getClient()` đọc env
// ở lần gọi ĐẦU TIÊN rồi nhớ kết quả, nên lời gọi ghim bên dưới — phát ra lúc
// nạp module, khi env còn trống — khoá nó ở `null` vĩnh viễn. Không có nó,
// `guard()` của INT-1 sẽ dựng client Upstash bằng URL giả và INT-3 thừa hưởng
// một bộ đếm dùng chung mà khối "WHY THE SHARED RATE-LIMIT STORE IS SWITCHED
// OFF" ở đầu file đã cố ý tắt.
//
// TRẦN `guard("uploadExam")` LÀ 5 LƯỢT/24h TRÊN MỖI NGƯỜI, đếm trong RAM tiến
// trình. Ba ca được cấp phép dùng CHUNG một tài khoản (khung đòi "same user"),
// tức 3/5. Ca (g) và ca (e) mỗi ca một tài khoản RIÊNG — (g) bắt buộc phải
// riêng, vì nó gieo bộ đếm upload ở mức cạn (3/3) và dùng chung tài khoản sẽ
// phá đúng phép đo delta của (b)/(c)/(f). Thêm ca upload thứ tư vào tài khoản
// dùng chung là chạm trần: đổi tài khoản, đừng nới trần.

/** Điểm phát Gemini — GIẢ VÀ ĐẾM. Ném lỗi: xem lý do 2 ở khối trên. Ghi vào
 *  `int1State.events` để thứ tự "đặt chỗ trước lời gọi" đo được, chứ không chỉ
 *  suy ra từ giá trị cuối. */
const { int1State, int1GenerateContent } = vi.hoisted(() => {
  const state = {
    redis: new Map<string, number>(),
    redisDown: false,
    events: [] as string[],
  };
  return {
    int1State: state,
    int1GenerateContent: vi.fn(() => {
      state.events.push("gemini:emit");
      throw new Error("INT-1: adapter Gemini giả — không request nào ra mạng");
    }),
  };
});

vi.mock("@/lib/ugc/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ugc/gemini")>()),
  generateContent: int1GenerateContent,
}));

/** Upstash GIẢ, dùng chung cho `readEntitlement()` (đường ĐỌC) và
 *  `consumeQuota()` (đường GHI) — đúng như production, nơi hai đường nói
 *  chuyện với cùng một Redis. `consumeQuota()` dựng một instance MỚI mỗi lượt
 *  gọi, nên trạng thái phải nằm ngoài class. */
vi.mock("@upstash/redis", () => {
  const touch = (op: string, key: string) => {
    int1State.events.push(`redis:${op}:${key}`);
    if (int1State.redisDown) throw new Error("INT-1: Upstash không trả lời (mô phỏng AC-024)");
  };
  const bump = (key: string, by: number): number => {
    touch(by >= 0 ? "incr" : "decr", key);
    const next = (int1State.redis.get(key) ?? 0) + by;
    int1State.redis.set(key, next);
    return next;
  };
  return {
    Redis: class {
      async mget<T>(...keys: string[]): Promise<T> {
        touch("mget", keys.join("|"));
        return keys.map((k) => int1State.redis.get(k) ?? null) as T;
      }
      async incr(key: string): Promise<number> {
        return bump(key, 1);
      }
      async decr(key: string): Promise<number> {
        return bump(key, -1);
      }
      async incrby(key: string, by: number): Promise<number> {
        return bump(key, by);
      }
      async decrby(key: string, by: number): Promise<number> {
        return bump(key, -by);
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

const { extractAndAssemble } = await import("@/features/authoring/actions");
const { hintDuringAttempt } = await import("@/features/exams/tutorActions");

/** Hợp đồng lỗi của S-01 (`UgcActionFailure`), lấy TỪ CHÍNH chữ ký hàm thay vì
 *  import lại tên kiểu: một lần đổi kiểu trả về sẽ hiện ra ở đây là lỗi biên
 *  dịch, chứ không lặng lẽ trôi. */
type Int1UploadResult = Awaited<ReturnType<typeof extractAndAssemble>>;

// Ghim bộ đếm rate limit dùng chung về `null` NGAY BÂY GIỜ — env còn trống ở
// thời điểm này (hai lệnh `delete` ở đầu file), và `getClient()` nhớ kết quả
// lần gọi đầu tiên. Khẳng định luôn thay vì gọi suông: nếu một ngày ai đó đặt
// lại env sớm hơn dòng này thì INT-3 mất lớp cách ly của nó và phải đỏ ở đây,
// chứ không phải đỏ ở một ca nói về chuyện khác.
const { isSharedStoreConfigured } = await import("@/lib/security/rateLimitStore");
if (isSharedStoreConfigured()) {
  throw new Error(
    "INT-1: bộ đếm rate limit dùng chung đã được cấu hình trước khi file kịp ghim nó về null — " +
      "INT-3 sẽ chạy với một Upstash giả. Xem khối 'WHY THE SHARED RATE-LIMIT STORE IS SWITCHED OFF'."
  );
}

/** Bốn tài khoản, bốn vai — và chúng phải KHÁC NHAU: xem đoạn về trần
 *  `guard("uploadExam")` ở khối trên. Tài khoản thứ tư chỉ đi đường GIA SƯ
 *  (`guard("explainStep")`, một xô đếm khác), và nó là CHỨNG CỨ ĐỐI CHỨNG
 *  DƯƠNG của ca (a): xem `int1.tutorGranted`. */
const INT1_USER_ID = "1c3f0a10-0000-4000-8000-00000000a001";
const INT1_QUOTA_OUT_USER_ID = "1c3f0a10-0000-4000-8000-00000000a002";
const INT1_REDIS_DOWN_USER_ID = "1c3f0a10-0000-4000-8000-00000000a003";
const INT1_TUTOR_OK_USER_ID = "1c3f0a10-0000-4000-8000-00000000a004";

/** Lượt làm bài đang xem, và câu hỏi được hỏi. Cùng cặp cho cả hai lượt gia sư
 *  (ca (a) bị chặn, và đối chứng dương được cấp phép), nên khác biệt DUY NHẤT
 *  giữa hai lượt là trạng thái bộ đếm hạn mức. */
const INT1_TUTOR_ATTEMPT_ID = "int1-attempt";
const INT1_TUTOR_QUESTION_ID = "int1-question";

/** Đề của lượt gia sư — arm `exams` phải trả `question_ids` CHỨA câu được hỏi,
 *  và dòng attempt phải `in_progress`: từ 2026-09-13 `hintDuringAttempt()` gác
 *  bằng "lượt của mình, đang mở, câu thuộc đề" (không còn "sai hai lần" và
 *  không còn đọc `exam_results`).
 *
 *  Vì sao fixture này quan trọng hơn vẻ ngoài của nó: thiếu nó, đường gia sư
 *  từ chối ở stage 4 và KHÔNG BAO GIỜ gọi Gemini — nên `geminiCalls === 0` của
 *  ca (a) đúng kể cả khi cổng hạn mức bị gỡ sạch. Đo được, không phải suy: gỡ
 *  cổng và đổi kỳ vọng thành `toBe(999)` cho ra `expected +0 to be 999`. */
const INT1_TUTOR_EXAM_ID = "int1-exam";
const INT1_TUTOR_EXAM_ROW = { question_ids: [INT1_TUTOR_QUESTION_ID] };

/** `user_profiles.created_at` của cả ba: MỘT PHÚT TRƯỚC, tính lúc nạp module.
 *
 *  Không phải một literal cố định, và lý do là số học chứ không phải sở thích:
 *  mốc kỳ của gói Free là `created_at + 30 ngày × floor((now − created_at) /
 *  30 ngày)`, nên chỉ khi khoảng cách DƯỚI 30 ngày thì `floor(…) = 0` và mốc kỳ
 *  BẰNG ĐÚNG `created_at`. Một literal gõ cứng sẽ vượt 30 ngày sau vài tuần và
 *  biến cả khối này thành đỏ vì tờ lịch, không vì một lỗi. */
const INT1_CREATED_AT_MS = Date.now() - 60_000;
const INT1_CREATED_AT_ISO = new Date(INT1_CREATED_AT_MS).toISOString();

/** Mốc kỳ suy TAY từ dòng trên (xem lý lẽ ngay trên). KHÔNG gọi
 *  `periodStartEpoch()`, và khoá dưới đây KHÔNG gọi `quotaKey()`: một kỳ vọng
 *  dựng bằng chính hàm đang bị kiểm thì hai bên sai giống nhau vẫn xanh. */
const INT1_PERIOD_START_MS = INT1_CREATED_AT_MS;
function int1QuotaKey(kind: "tutor" | "upload", userId: string): string {
  return `quota:${kind}:${userId}:${INT1_PERIOD_START_MS}`;
}

/** Tổng mọi khoá ngân sách ngày. Cộng theo TIỀN TỐ chứ không dựng lại chuỗi
 *  `ai:budget:{ngày Pacific}`: dựng lại đòi một phép đổi múi giờ thứ hai trong
 *  file test, và một phép đổi múi giờ viết hai lần là đúng thứ `budgetKey()`
 *  tồn tại để chặn. Ca (h) khẳng định riêng rằng chỉ có MỘT khoá như vậy. */
function int1BudgetTotal(): number {
  let total = 0;
  for (const [key, value] of int1State.redis) {
    if (key.startsWith("ai:budget:")) total += value;
  }
  return total;
}

function int1BudgetKeys(): string[] {
  return [...int1State.redis.keys()].filter((k) => k.startsWith("ai:budget:"));
}

interface Int1QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count: number | null;
}

interface Int1Fixture {
  userId: string;
  /** Dòng `exams` mà nhánh re-run đọc được; `null` = không phải re-run. */
  ownExam: Record<string, unknown> | null;
  /** Dòng `exam_attempts` cho đường gia sư. */
  attempt: Record<string, unknown> | null;
  /** Dòng `exam_results`. Đường gia sư KHÔNG còn đọc bảng này (2026-09-13 —
   *  cổng "sai hai lần" bỏ); arm giữ lại để builder giả không ném nếu một đường
   *  khác chạm tới. Với đường gia sư, thứ quyết định "đủ điều kiện" nay là
   *  `attempt.status` + `ownExam.question_ids` (xem INT1_TUTOR_EXAM_ROW). */
  results: Record<string, unknown>[];
  /** Giá trị `count` mà truy vấn ĐẾM DÒNG cũ (`head: true`) trả về. Giữ lại để
   *  lượt chạy ĐỎ trên bản cài đặt cũ đi được tới cùng một chỗ như bản mới —
   *  nếu không, ca sẽ đỏ vì một lỗi đọc `count` chứ không vì cái nó khẳng định. */
  examRowCount: number;
}

/** Query builder giả — chuỗi hoá `.select().eq().gte().maybeSingle()` rồi
 *  `await`. Chỉ có `select` mới trả dữ liệu; `insert`/`update`/`delete` luôn
 *  `{error: null}` và chỉ ghi lại dấu vết, vì không ca nào ở đây khẳng định về
 *  nội dung ghi (INT-2/INT-3 mới nói về Postgres thật). */
class Int1Query implements PromiseLike<Int1QueryResult> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private head = false;

  constructor(
    private readonly table: string,
    private readonly fixture: Int1Fixture,
    private readonly trail: string[],
    private readonly telemetry: Record<string, unknown>[]
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }): this {
    this.head = options?.head === true;
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = "insert";
    this.trail.push(`${this.table}:insert`);
    if (this.table === "telemetry_log") this.telemetry.push(rows as Record<string, unknown>);
    return this;
  }
  update(): this {
    this.op = "update";
    this.trail.push(`${this.table}:update`);
    return this;
  }
  delete(): this {
    this.op = "delete";
    this.trail.push(`${this.table}:delete`);
    return this;
  }
  eq(): this {
    return this;
  }
  gte(): this {
    return this;
  }
  in(): this {
    return this;
  }
  maybeSingle(): this {
    return this;
  }
  single(): this {
    return this;
  }

  private result(): Int1QueryResult {
    if (this.op !== "select") return { data: null, error: null, count: null };
    this.trail.push(`${this.table}:select${this.head ? ":count" : ""}`);
    switch (this.table) {
      case "subscriptions":
        // Chưa từng mua ⇒ Free. `readEntitlement()` hỏng-ĐÓNG về Free ở đường
        // này, nên `PLAN_LIMITS.free` (tutor 5 / upload 3) là bảng đang áp.
        return { data: null, error: null, count: null };
      case "user_profiles":
        return {
          data: { created_at: INT1_CREATED_AT_ISO, display_name: "INT-1 fixture" },
          error: null,
          count: null,
        };
      case "exams":
        return this.head
          ? { data: null, error: null, count: this.fixture.examRowCount }
          : { data: this.fixture.ownExam, error: null, count: null };
      case "exam_attempts":
        return { data: this.fixture.attempt, error: null, count: null };
      case "exam_results":
        return { data: this.fixture.results, error: null, count: null };
      case "questions":
        // Đường gia sư đọc ĐÚNG ba cột an toàn (`TUTOR_QUESTION_COLUMNS`).
        // Thiếu arm này thì `data: null` ⇒ `explainStep()` từ chối
        // `not_eligible` ở stage 5 và không bao giờ tới stage 6, nên lượt gọi
        // adapter dương của chứng cứ đối chứng bên dưới không tồn tại.
        return {
          data: {
            content: "INT-1: 2 + 2 bằng mấy?",
            question_type: "mcq",
            choices: [
              { id: "A", text: "3" },
              { id: "B", text: "4" },
            ],
          },
          error: null,
          count: null,
        };
      default:
        return { data: null, error: null, count: null };
    }
  }

  then<TResult1 = Int1QueryResult, TResult2 = never>(
    onFulfilled?: ((value: Int1QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onFulfilled, onRejected);
  }
}

function int1SupabaseClient(
  fixture: Int1Fixture,
  trail: string[],
  telemetry: Record<string, unknown>[]
): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: fixture.userId } }, error: null }),
    },
    from: (table: string) => new Int1Query(table, fixture, trail, telemetry),
    storage: {
      from: (bucket: string) => ({
        upload: async () => {
          trail.push(`storage:${bucket}:upload`);
          return { error: null };
        },
        remove: async () => {
          trail.push(`storage:${bucket}:remove`);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

/** FormData của S-01. Hai file mang HAI dãy byte khác nhau, cố ý: một bản cài
 *  đặt lẫn file đề với file đáp án vẫn xanh nếu cả hai giống nhau. */
function int1UploadForm(mode: "manual" | "automatic", rerunExamId: string | null): FormData {
  const form = new FormData();
  form.set("entryMode", mode);
  form.set("title", "INT-1 đề kiểm tra");
  form.set("subject", "Math");
  form.set("grade", "10");
  form.set("durationMinutes", "45");
  form.set("questionFile", new File([new Uint8Array([1, 2, 3, 4])], "q.png", { type: "image/png" }));
  form.set("answerFile", new File([new Uint8Array([9, 8, 7, 6])], "a.png", { type: "image/png" }));
  if (rerunExamId) form.set("examId", rerunExamId);
  return form;
}

/** Bắt `console.warn` mà KHÔNG nuốt nó — cổng hạn mức của đường upload ghi mã
 *  telemetry đã ánh xạ ra đây (xem ca (e)/(g) và khối OK-04 trong actions.ts).
 *  Đường upload không có dòng `telemetry_log` nào để đọc: CHECK của §19 chỉ
 *  nhận `event_type in ('adaptive_route','tutor_invoke')`, nên console phía máy
 *  chủ là nơi DUY NHẤT mã ấy quan sát được hôm nay. */
function int1CaptureWarnings(sink: string[]): () => void {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    sink.push(args.map((a) => String(a)).join(" "));
    (original as (...a: unknown[]) => void)(...args);
  };
  return () => {
    console.warn = original;
  };
}

interface Int1UploadRun {
  result: Int1UploadResult;
  counterBefore: number;
  counterAfter: number;
  budgetBefore: number;
  budgetAfter: number;
  geminiCalls: number;
  events: string[];
  warnings: string[];
  trail: string[];
}

async function int1RunUpload(options: {
  userId: string;
  mode: "manual" | "automatic";
  rerunExamId: string | null;
  redisDown?: boolean;
}): Promise<Int1UploadRun> {
  const trail: string[] = [];
  const telemetry: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const ownExam = options.rerunExamId
    ? {
        id: options.rerunExamId,
        title: "INT-1 đề cũ",
        subject: "Math",
        grade: 10,
        duration_minutes: 45,
        school: null,
        school_year: null,
        semester: null,
        // Rỗng để nhánh re-run không phải xoá câu hỏi cũ — lượt xoá ấy không
        // thuộc điều ca này khẳng định.
        question_ids: [],
      }
    : null;

  sessionClientHolder.current = int1SupabaseClient(
    // `results: []` — đường upload không đọc `exam_results` ở lượt nào cả; chỉ
    // đường gia sư mới cần lịch sử (xem `int1RunTutor`).
    { userId: options.userId, ownExam, attempt: null, results: [], examRowCount: 0 },
    trail,
    telemetry
  );

  const key = int1QuotaKey("upload", options.userId);
  const counterBefore = int1State.redis.get(key) ?? 0;
  const budgetBefore = int1BudgetTotal();
  int1State.events.length = 0;
  int1GenerateContent.mockClear();
  int1State.redisDown = options.redisDown === true;
  const restoreWarn = int1CaptureWarnings(warnings);

  let result: Int1UploadResult;
  try {
    result = await extractAndAssemble(int1UploadForm(options.mode, options.rerunExamId));
  } finally {
    restoreWarn();
    int1State.redisDown = false;
  }

  return {
    result,
    counterBefore,
    counterAfter: int1State.redis.get(key) ?? 0,
    budgetBefore,
    budgetAfter: int1BudgetTotal(),
    geminiCalls: int1GenerateContent.mock.calls.length,
    events: [...int1State.events],
    warnings,
    trail,
  };
}

interface Int1TutorRun {
  result: Awaited<ReturnType<typeof hintDuringAttempt>>;
  telemetry: Record<string, unknown>[];
  geminiCalls: number;
}

/** Một lượt gia sư trên fixture ĐỦ ĐIỀU KIỆN. Hai lượt gọi hàm này khác nhau ở
 *  ĐÚNG MỘT thứ — bộ đếm `quota:tutor:{user}` đã gieo — nên chênh lệch số lượt
 *  gọi adapter giữa chúng quy được về cổng hạn mức và chỉ về nó. */
async function int1RunTutor(userId: string): Promise<Int1TutorRun> {
  const trail: string[] = [];
  const telemetry: Record<string, unknown>[] = [];
  sessionClientHolder.current = int1SupabaseClient(
    {
      userId,
      // Arm `exams` phục vụ cổng "câu thuộc đề" của đường gia sư (không phải
      // nhánh re-run của upload — lượt này không đi đường upload).
      ownExam: INT1_TUTOR_EXAM_ROW,
      attempt: { user_id: userId, exam_id: INT1_TUTOR_EXAM_ID, status: "in_progress" },
      results: [],
      examRowCount: 0,
    },
    trail,
    telemetry
  );
  int1GenerateContent.mockClear();
  const result = await hintDuringAttempt(INT1_TUTOR_ATTEMPT_ID, INT1_TUTOR_QUESTION_ID, "");
  return { result, telemetry, geminiCalls: int1GenerateContent.mock.calls.length };
}

/** SỬA KHI TÁCH KHỐI (2026-09-18) — đường dẫn, và CHỈ đường dẫn.
 *
 *  Khung gốc trỏ vào `features/authoring/actions.ts`. Commit `54c3079`
 *  (2026-09-03) cắt file 1.190 dòng ấy theo vòng đời của một đề, nên nay nó chỉ
 *  còn là một BARREL re-export (`export { extractAndAssemble } from
 *  "./uploadActions";`) — không chứa thân hàm nào. Giữ nguyên đường cũ thì ca
 *  (d) chết ngay ở khẳng định CÓ MẶT thứ hai, và ba khẳng định thật của nó
 *  (`MAX_UPLOADS_PER_DAY` vắng mặt, cổng mới có mặt, `metaCall` suy một lần)
 *  không bao giờ được chạy — đúng thứ âm tính giả mà chính comment của ca này
 *  cảnh báo. `extractAndAssemble` nay sống ở `uploadActions.ts`.
 *
 *  Tên ca (d) bên dưới vẫn ghi `features/authoring/actions.ts`: nó là NHÃN, và
 *  khối này được giữ nguyên văn để so byte với bản trong
 *  `tests/integration/subscription.int.test.ts` trước khi tách. Đổi tên ca là
 *  việc của lượt bật lại, không phải của lượt tách. */
const INT1_ACTIONS_PATH = resolve(__dirname, "../../../features/authoring/uploadActions.ts");

/** Ảnh chụp của dãy thao tác, chạy MỘT lần trong `beforeAll`; mỗi `it` chỉ đọc
 *  ảnh chụp — cùng lối INT-2/INT-3. */
const int1 = {
  tutor: null as Int1TutorRun | null,
  tutorGranted: null as Int1TutorRun | null,
  typedNew: null as Int1UploadRun | null,
  typedRerun: null as Int1UploadRun | null,
  autoNew: null as Int1UploadRun | null,
  quotaOut: null as Int1UploadRun | null,
  redisDown: null as Int1UploadRun | null,
};

function int1Upload(run: Int1UploadRun | null, label: string): Int1UploadRun {
  if (!run) throw new Error(`INT-1: ảnh chụp "${label}" chưa được dựng`);
  return run;
}

describe(
  "INT-1 — cổng hạn mức chặn TRƯỚC byte Gemini đầu tiên, và đếm THAO TÁC chứ không đếm DÒNG (AC-017/018/019/024)",
  () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeAll(async () => {
      for (const name of [
        "KV_REST_API_URL",
        "KV_REST_API_TOKEN",
        "AI_BUDGET_DAILY_LIMIT",
        "AI_BUDGET_FREE_SHARE",
      ]) {
        savedEnv[name] = process.env[name];
      }
      // `consumeQuota()`/`readEntitlement()` đọc env LÚC GỌI, nên đặt ở đây là
      // đủ và không chạm tới bộ đếm rate limit đã ghim `null` ở tầm module.
      // Trần ngày để rộng và suất Free = 100%: ca nào ở khối này cũng phải bị
      // từ chối vì lý do nó tuyên, không phải vì cạn ngân sách của ca trước.
      process.env.KV_REST_API_URL = "https://int1-upstash-gia.invalid";
      process.env.KV_REST_API_TOKEN = "int1-token-gia";
      process.env.AI_BUDGET_DAILY_LIMIT = "1000";
      process.env.AI_BUDGET_FREE_SHARE = "1";

      int1State.redis.clear();
      int1State.redisDown = false;

      // --- (a) Đường GIA SƯ, hạn mức kỳ đã cạn -----------------------------
      // Gieo 5 = `PLAN_LIMITS.free.tutor`, gõ tay. Lượt gọi thứ 6 phải bị chặn.
      int1State.redis.set(int1QuotaKey("tutor", INT1_USER_ID), 5);
      int1.tutor = await int1RunTutor(INT1_USER_ID);

      // --- Đối chứng DƯƠNG cho (a) — TÀI KHOẢN RIÊNG -----------------------
      // Gieo 4 = `PLAN_LIMITS.free.tutor` − 1, gõ tay: lượt này là lượt thứ 5,
      // tức lượt CUỐI CÙNG còn được cấp phép. Cùng fixture, cùng cặp
      // attempt/question với (a); khác biệt duy nhất là bộ đếm. Không có lượt
      // này thì "đúng 0 lượt gọi adapter" của (a) cũng xanh với một cổng từ
      // chối SẠCH mọi thứ — và đó không phải là điều AC-018 nói.
      int1State.redis.set(int1QuotaKey("tutor", INT1_TUTOR_OK_USER_ID), 4);
      int1.tutorGranted = await int1RunTutor(INT1_TUTOR_OK_USER_ID);

      // --- (b)(c)(f) Ba lượt upload ĐƯỢC CẤP PHÉP, cùng một tài khoản ------
      // THỨ TỰ BA LỜI GỌI DƯỚI ĐÂY LÀ MỘT PHẦN CỦA KHẲNG ĐỊNH, không phải cách
      // sắp xếp cho dễ đọc: (b)/(c)/(f) so `counterBefore`/`counterAfter` với
      // các literal TUYỆT ĐỐI 0→1, 1→2, 2→3 trên cùng một khoá kỳ của cùng một
      // tài khoản. Đảo hai lượt bất kỳ, hay chèn thêm một lượt upload cho
      // `INT1_USER_ID` vào giữa, làm ba ca ấy đỏ vì số học chứ không vì một lỗi.
      int1.typedNew = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "manual",
        rerunExamId: null,
      });
      int1.typedRerun = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "manual",
        rerunExamId: "int1-exam-rerun",
      });
      int1.autoNew = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "automatic",
        rerunExamId: null,
      });

      // --- (g) Hạn mức upload đã cạn — TÀI KHOẢN RIÊNG ---------------------
      // Gieo 3 = `PLAN_LIMITS.free.upload`, gõ tay.
      int1State.redis.set(int1QuotaKey("upload", INT1_QUOTA_OUT_USER_ID), 3);
      int1.quotaOut = await int1RunUpload({
        userId: INT1_QUOTA_OUT_USER_ID,
        mode: "automatic",
        rerunExamId: null,
      });

      // --- (e) Redis không trả lời — TÀI KHOẢN RIÊNG -----------------------
      int1.redisDown = await int1RunUpload({
        userId: INT1_REDIS_DOWN_USER_ID,
        mode: "manual",
        rerunExamId: null,
        redisDown: true,
      });
    }, 60_000);

    afterAll(() => {
      for (const [name, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      int1State.redis.clear();
      sessionClientHolder.current = null;
    });

    // ---------------------------------------------------------------------
    // (a) AC-018 — đường gia sư cạn hạn mức: 0 lượt gọi adapter, và lý do THẬT
    //     chỉ tồn tại trong telemetry
    // ---------------------------------------------------------------------
    it("(a) hạn mức gia sư Free đã cạn ⇒ 0 lượt gọi adapter Gemini, và `telemetry_log.error_code` mang `user_quota_exhausted`", () => {
      const snapshot = int1.tutor;
      if (!snapshot) throw new Error("INT-1: ảnh chụp đường gia sư chưa được dựng");

      // Bản cài đặt sai bị loại: một cổng đặt SAU lời gọi Gemini (hoặc một
      // nhánh từ chối "rơi xuyên"). Đếm lượt gọi, không đọc giá trị trả về —
      // giá trị trả về vẫn đúng khi request đã ra tới nhà cung cấp rồi mới bị
      // chặn, và tiền thì đã tiêu.
      expect(snapshot.geminiCalls).toBe(0);
      expect(snapshot.result).toEqual({ error: "not_eligible" });

      // Lý do PHÂN BIỆT chỉ sống ở đây (OK-04). Một hằng gộp cả ba lý do về
      // một chuỗi vẫn xanh nếu chỉ kiểm "có ghi telemetry" — nên kiểm giá trị.
      expect(snapshot.telemetry).toHaveLength(1);
      expect(snapshot.telemetry[0]).toMatchObject({
        event_type: "tutor_invoke",
        success: false,
        error_code: "user_quota_exhausted",
      });
    });

    // ---------------------------------------------------------------------
    // Đối chứng DƯƠNG của (a) — cổng gia sư KHÔNG từ chối tất cả
    // ---------------------------------------------------------------------
    it("đối chứng dương: cùng fixture, hạn mức gia sư còn ĐÚNG 1 suất ⇒ adapter Gemini được gọi ĐÚNG 1 lần", () => {
      const snapshot = int1.tutorGranted;
      if (!snapshot) throw new Error("INT-1: ảnh chụp đối chứng dương chưa được dựng");

      // Bản cài đặt sai bị loại: một cổng (bất kỳ cổng nào trên đường gia sư)
      // từ chối MỌI lượt. Nó làm `geminiCalls === 0` của ca (a) xanh mà không
      // quan sát gì về hạn mức — và đó chính là điều đã đo được: với fixture
      // lịch sử rỗng trước đây, gỡ sạch cổng hạn mức vẫn để ca (a) xanh.
      // `1` là literal gõ tay (= `GEMINI_CALLS_PER_OPERATION.tutor`), không đọc
      // từ bảng giá.
      expect(snapshot.geminiCalls).toBe(1);
      expect(snapshot.telemetry).toHaveLength(1);
      // Và lượt này KHÔNG bị cổng hạn mức chặn — nếu bị, mã dưới đây là
      // `user_quota_exhausted` và ca (a) mất chỗ dựa của nó.
      expect(snapshot.telemetry[0]).not.toMatchObject({ error_code: "user_quota_exhausted" });
    });

    // ---------------------------------------------------------------------
    // (b) AC-019 — nhánh TẠO MỚI: "expected non-difference" của phép so sánh
    // ---------------------------------------------------------------------
    it("(b) upload `rerunExamId` UNSET ⇒ bộ đếm kỳ của người dùng tăng ĐÚNG 1, và ngân sách đặt chỗ ĐÚNG 2 request", () => {
      const run = int1Upload(int1.typedNew, "typedNew");

      // Bản cài đặt sai bị loại: cổng vẫn đếm SỐ DÒNG (bộ đếm Redis không nhúc
      // nhích), hoặc cổng không được gọi. Đọc trước và sau, so với literal.
      expect(run.counterBefore).toBe(0);
      expect(run.counterAfter).toBe(1);
      expect(run.counterAfter - run.counterBefore).toBe(1);

      // Bản cài đặt sai bị loại: gộp hai bộ đếm về một ĐƠN VỊ (ngân sách +1
      // mỗi thao tác thay vì +số request) — dưới-đếm 2× đúng như thiết kế v1.4
      // sinh ra để sửa. `2` là literal gõ tay, không đọc từ bảng giá.
      expect(run.budgetAfter - run.budgetBefore).toBe(2);
      expect(run.geminiCalls).toBe(2);

      // Chứng cứ dương: cổng KHÔNG từ chối tất cả. Không có dòng này thì
      // "đúng 0 lượt gọi" ở (a)/(e)/(g) xanh cả với một cổng chặn sạch.
      expect(run.geminiCalls).toBeGreaterThan(0);
      expect(run.result.error.kind).toBe("extraction");
    });

    // ---------------------------------------------------------------------
    // (c) AC-017 + AC-019 — nhánh RE-RUN: "expected difference"
    // ---------------------------------------------------------------------
    it("(c) upload `rerunExamId` SET ⇒ bộ đếm kỳ vẫn tăng ĐÚNG 1 — nhánh mà bản cũ (đếm số dòng TẠO MỚI) không tính lượt nào", () => {
      const run = int1Upload(int1.typedRerun, "typedRerun");

      // Bản cài đặt sai bị loại: khối đếm cũ, hoặc bất kỳ bản thay thế nào vẫn
      // lấy "số dòng exams tạo trong 24h" làm cơ sở — một lượt xử lý lại không
      // tạo dòng nào, nên delta của nó là 0 và ca này đỏ.
      expect(run.counterBefore).toBe(1);
      expect(run.counterAfter).toBe(2);
      expect(run.counterAfter - run.counterBefore).toBe(1);

      // Cùng CHẾ ĐỘ với (b), khác NHÁNH ⇒ cùng chi phí. Cặp (b)/(c) một mình
      // vẫn hợp với một bản tính chi phí theo nhánh; (f) mới đóng chỗ đó lại.
      expect(run.budgetAfter - run.budgetBefore).toBe(2);
      expect(run.geminiCalls).toBe(2);
      expect(run.trail).toContain("exams:update");
      expect(run.result.error.kind).toBe("extraction");
    });

    // ---------------------------------------------------------------------
    // (f) Chi phí đi theo CHẾ ĐỘ, không theo nhánh, và không phải một hằng
    // ---------------------------------------------------------------------
    it("(f) upload chế độ `automatic`, `rerunExamId` UNSET ⇒ vẫn ĐÚNG 1 suất kỳ, nhưng ĐÚNG 3 request đặt chỗ", () => {
      const run = int1Upload(int1.autoNew, "autoNew");

      // Bản cài đặt sai bị loại: chi phí là một HẰNG (2 hoặc 3 cho mọi lượt),
      // hoặc chi phí đọc theo `rerunExamId` thay vì theo `entryMode`. Cả hai
      // đều vượt qua (b)+(c) và cùng chết ở đây.
      expect(run.budgetAfter - run.budgetBefore).toBe(3);
      expect(run.geminiCalls).toBe(3);

      // Và ĐƠN VỊ của bộ đếm người dùng vẫn là THAO TÁC: 3 request, 1 suất.
      // Trộn hai đơn vị (`+geminiCalls` vào khoá kỳ) làm số này thành 3.
      expect(run.counterBefore).toBe(2);
      expect(run.counterAfter).toBe(3);
    });

    // ---------------------------------------------------------------------
    // Đặt chỗ, không phải tích từng lượt gọi
    // ---------------------------------------------------------------------
    it("ngân sách nhích bằng MỘT lệnh, và lệnh đó phát TRƯỚC lời gọi Gemini đầu tiên — chỉ thứ tự chứng minh được đó là ĐẶT CHỖ", () => {
      const run = int1Upload(int1.autoNew, "autoNew");
      const reservation = run.events.findIndex((e) => e.startsWith("redis:incr:ai:budget:"));
      const firstEmit = run.events.indexOf("gemini:emit");

      // Bản cài đặt sai bị loại: một cái tích +1 mỗi lời gọi đặt trong
      // `gemini.ts`. Nó cho ra CÙNG tổng 3, nên chỉ so tổng thì không thấy —
      // nhưng lệnh đầu tiên của nó nằm SAU lời gọi đầu tiên, và một lời từ
      // chối rơi vào giữa `Promise.all` sẽ bỏ lại một lượt bóc đề dở dang.
      expect(reservation).toBeGreaterThanOrEqual(0);
      expect(firstEmit).toBeGreaterThanOrEqual(0);
      expect(reservation).toBeLessThan(firstEmit);

      // Đúng MỘT lệnh chạm khoá ngân sách trong cả lượt: ba lời gọi, một lần
      // nhích.
      expect(run.events.filter((e) => e.includes(":ai:budget:"))).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // (g) AC-018/AC-053 trên chính đường upload
    // ---------------------------------------------------------------------
    it("(g) hạn mức upload đã cạn ⇒ 0 lượt gọi adapter, bộ đếm kỳ KHÔNG bị trừ, và mã telemetry là `user_quota_exhausted`", () => {
      const run = int1Upload(int1.quotaOut, "quotaOut");

      expect(run.geminiCalls).toBe(0);
      // Hoàn lại: một lượt bị chặn không được tính phí. INCR rồi DECR ⇒ về đúng
      // giá trị đã gieo.
      expect(run.counterBefore).toBe(3);
      expect(run.counterAfter).toBe(3);
      expect(run.budgetAfter - run.budgetBefore).toBe(0);

      // BỀ MẶT NGƯỜI DÙNG, không chỉ bộ đếm và console. Không có hai dòng này
      // thì `return consumed.reason === "user_quota" ? … : …` trong actions.ts
      // đổi được thành `return false` mà cả làn vẫn xanh: người cạn hạn mức
      // nhận câu trả lời HẠ TẦNG (`kind: "server"`) thay vì câu trả lời CHÍNH
      // SÁCH mà AC-018/AC-053 đòi, và ca (e) — vốn khẳng định đúng
      // `kind === "server"` — không phân biệt nổi hai thứ ấy. Đo được: đột biến
      // ấy để lại nguyên 25 passed trước khi hai dòng này tồn tại.
      expect(run.result.error.kind).toBe("validation");
      expect(run.result.error.message).toContain("used every exam upload");

      // OK-04 tại chỗ từ chối của đường upload. GIÁ TRỊ KHÁC với ca (e) bên
      // dưới: một bảng ánh xạ thật ra là một hằng sẽ xanh ở một trong hai ca,
      // không bao giờ xanh ở cả hai.
      //
      // Lọc về ĐÚNG MỘT dòng từ chối thay vì tìm trong cả luồng cảnh báo: sink
      // này còn nhận `console.warn` của chính `consumeQuota()` (quota.ts, nhánh
      // catch), nên một phép tìm chuỗi trên toàn luồng cũng xanh khi cùng chuỗi
      // ấy phát ra từ một chỗ khác hẳn — đúng hình dạng "nới rộng" của một phép
      // tìm chữ trên cả trang.
      // ⚠ TẠM: hai khẳng định console này ĐƯỢC LÊN LỊCH THAY THẾ bằng một khẳng
      // định trên `telemetry_log` ngay khi đường upload có `event_type` riêng
      // (CHECK §19 hôm nay chỉ nhận `adaptive_route`/`tutor_invoke`). Chúng
      // KHÔNG được thừa kế trong im lặng như bằng chứng rằng mã ấy TRUY VẤN
      // ĐƯỢC — console máy chủ không truy vấn được.
      const refusal = run.warnings.filter((w) =>
        w.startsWith("[extractAndAssemble] cổng hạn mức từ chối:")
      );
      expect(refusal).toHaveLength(1);
      expect(refusal[0]).toContain("error_code=user_quota_exhausted");
      expect(refusal[0]).not.toContain("error_code=server");
    });

    // ---------------------------------------------------------------------
    // (e) AC-024 — hỏng ĐÓNG
    // ---------------------------------------------------------------------
    it("(e) Redis không trả lời ⇒ upload bị TỪ CHỐI với 0 lượt gọi adapter, và mã telemetry là `server`", () => {
      const run = int1Upload(int1.redisDown, "redisDown");

      // Bản cài đặt sai bị loại: hỏng-MỞ (Upstash chết ⇒ cho qua), hoặc tụt về
      // một bộ đếm trong RAM như `rateLimit.ts` làm — bộ đếm ấy nhân lên theo
      // số instance nên không bao giờ chặn nổi một ngân sách toàn dự án.
      expect(run.geminiCalls).toBe(0);
      expect(run.result.error.kind).toBe("server");
      expect(run.counterAfter - run.counterBefore).toBe(0);
      expect(run.budgetAfter - run.budgetBefore).toBe(0);

      // `unavailable` KHÔNG có literal riêng: nó là sự cố hạ tầng của CHÍNH TA.
      //
      // Lọc về ĐÚNG MỘT dòng từ chối, cùng lý do như ca (g) — và ở ca này thì
      // chắc chắn: `consumeQuota()` tự ghi thêm một dòng `[consumeQuota] bộ đếm
      // không ghi được, từ chối:` ở nhánh catch, nên sink có ÍT NHẤT hai dòng
      // và một phép tìm trên toàn luồng là phép tìm rộng nhất có thể.
      // ⚠ TẠM: xem ghi chú cùng nội dung ở ca (g) — hai khẳng định console này
      // được lên lịch thay thế bằng một khẳng định `telemetry_log` khi đường
      // upload có `event_type` riêng, và không được thừa kế như bằng chứng
      // rằng mã ấy truy vấn được.
      const refusal = run.warnings.filter((w) =>
        w.startsWith("[extractAndAssemble] cổng hạn mức từ chối:")
      );
      expect(refusal).toHaveLength(1);
      expect(refusal[0]).toContain("error_code=server");
      expect(refusal[0]).not.toContain("error_code=user_quota_exhausted");
    });

    // ---------------------------------------------------------------------
    // (h) Hình dạng khoá — hai đường phải ghép ra cùng một chuỗi
    // ---------------------------------------------------------------------
    it("(h) cả ba lượt cấp phép ghi vào ĐÚNG MỘT khoá kỳ `quota:upload:{user}:{periodStart}`, và đúng MỘT khoá ngân sách ngày", () => {
      // Nếu đường GHI ghép khoá khác đường ĐỌC, mọi delta ở trên vẫn có thể
      // đúng bằng cách tình cờ (0 → 0), nên chỗ này khẳng định chính chuỗi —
      // gõ tay, không gọi `quotaKey()`.
      const uploadKeys = [...int1State.redis.keys()].filter((k) => k.startsWith("quota:upload:"));
      expect(uploadKeys.sort()).toEqual(
        [
          `quota:upload:${INT1_USER_ID}:${INT1_PERIOD_START_MS}`,
          `quota:upload:${INT1_QUOTA_OUT_USER_ID}:${INT1_PERIOD_START_MS}`,
        ].sort()
      );
      // Tài khoản của ca (e) KHÔNG có khoá nào: Redis chết trước lệnh ghi đầu
      // tiên, nên một khoá mang tên nó ở đây có nghĩa là đường ghi đã lách qua
      // được lớp hỏng — đúng cái AC-024 cấm.
      expect(uploadKeys).not.toContain(
        `quota:upload:${INT1_REDIS_DOWN_USER_ID}:${INT1_PERIOD_START_MS}`
      );
      // GIẢ ĐỊNH GÁNH TẢI: mọi lượt của khối này rơi vào CÙNG MỘT ngày lịch
      // Pacific. `budgetKey()` ghép khoá theo ngày Pacific, nên một lượt chạy
      // vắt qua nửa đêm Pacific (07:00/08:00 UTC) sinh khoá thứ hai và ca này
      // đỏ vì tờ lịch chứ không vì một lỗi. Chấp nhận có ý thức: hai khoá cũng
      // đúng là hình dạng hỏng cần bắt (`budgetKey()` ghép khác nhau giữa các
      // lượt), và không tách được hai nguyên nhân mà không đóng băng đồng hồ
      // của cả tiến trình — thứ sẽ phá luôn mốc kỳ suy từ `created_at`.
      expect(int1BudgetKeys()).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // (d) AC-017 — khẳng định VẮNG MẶT, kèm hai khẳng định CÓ MẶT
    // ---------------------------------------------------------------------
    it("(d) `features/authoring/actions.ts` không còn tham chiếu nào tới `LIMITS.MAX_UPLOADS_PER_DAY`, và cổng mới đứng ở chỗ của nó", () => {
      // Hai khẳng định CÓ MẶT trước đã: "không tìm thấy chuỗi" và "đọc nhầm
      // file / file rỗng" cho ra cùng một kết quả, và khung INT-1 ghi sai
      // đường dẫn ((exams)) đúng theo cách đó.
      expect(existsSync(INT1_ACTIONS_PATH)).toBe(true);
      const source = readFileSync(INT1_ACTIONS_PATH, "utf8");
      expect(source).toContain("export async function extractAndAssemble(");

      expect(source).not.toContain("MAX_UPLOADS_PER_DAY");

      // Thay thế, không phải chỉ xoá: cổng mới phải có mặt, đọc chi phí từ BẢNG
      // GIÁ (plan Task 5.2) chứ không từ một literal, và `metaCall` phải được
      // suy ĐÚNG MỘT LẦN — hai lời khai rời của cùng quy tắc chế-độ→chi-phí là
      // đúng hình dạng hỏng mà I004 tồn tại để xoá.
      expect(source).toMatch(
        /consumeQuota\(\s*"upload",\s*user\.id,\s*ent,\s*metaCall\s*\?\s*GEMINI_CALLS_PER_OPERATION\.uploadAutomatic\s*:\s*GEMINI_CALLS_PER_OPERATION\.uploadTyped\s*\)/
      );
      expect(source.match(/const metaCall\b/g)).toHaveLength(1);
      expect(source).not.toMatch(/consumeQuota\([^)]*\?\s*3\s*:\s*2/);
    });
  },
  120_000
);
