import "server-only";

// Hạn mức theo gói, và MỘT chỗ duy nhất suy ra mốc bắt đầu kỳ (backend DD I004).
//
// `PLAN_LIMITS` ở đây chứ KHÔNG ở `types.ts`: file đó là hợp đồng đóng băng của
// pha UI (`types.ts:4-8`), đổi nó phải đổi UI Spec trước. Bảng hạn mức là một
// tham số sản phẩm, không phải một hình dạng dữ liệu, nên nó không thuộc về đó.
//
// `periodStartEpoch()` là phần đắt hơn của file này. Bộ đếm kỳ sống trên Redis
// dưới khoá `quota:{kind}:{userId}:{periodStartEpoch}` — mốc kỳ nằm TRONG khoá,
// nên "reset" là một khoá mới chứ không phải một phép ghi đè, và không có job
// nào chạy ở biên kỳ (đúng cam kết "no scheduled infrastructure" của ADR-0013).
// Cái giá của thiết kế đó là: đường ĐỌC (`readEntitlement()` dựng `used` và
// `resetsAt`) và đường GHI (`consumeQuota()` INCR ở cổng) phải ghép RA CÙNG MỘT
// chuỗi. Hai lần suy ra độc lập — lệch một phép làm tròn, hay một bên tính bằng
// giây một bên bằng mili giây — làm màn hình báo "còn n lượt" trong khi cổng từ
// chối, và không có gì đỏ ở đâu cả. Vì thế đây là lời khai DUY NHẤT; cả hai
// phía `import` nó, không phía nào tự tính lại.

import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
import { BUDGET_TTL_SECONDS, pacificDay } from "./budgetDay";
import type { Entitlement, Plan } from "./types";

/** Hai loại thao tác có hạn mức. Khai ở đây vì `PLAN_LIMITS` và `quotaKey()`
 *  đều nói về cùng một tập — hai lời khai rời sẽ cho phép thêm một loại vào
 *  bảng hạn mức mà quên nó ở khoá đếm. */
export type QuotaKind = "tutor" | "upload";

/** Hạn mức mỗi kỳ 30 ngày, theo gói và theo loại thao tác (PRD R5/D5, R6/D7).
 *
 *  Đơn vị là **thao tác người dùng khởi xướng**, không phải request Gemini:
 *  một lượt upload ở chế độ `automatic` phát 3 request nhưng tiêu ĐÚNG MỘT suất
 *  upload — gói được bán bằng "lượt", còn ngân sách dự án mới đếm bằng request.
 *
 *  `satisfies Record<Plan, …>` để thêm một gói thứ ba mà quên điền hạn mức là
 *  lỗi biên dịch, không phải một `undefined` phát hiện được lúc chạy. */
export const PLAN_LIMITS = {
  free: { tutor: 5, upload: 3 },
  premium: { tutor: 500, upload: 15 },
} as const satisfies Record<Plan, Record<QuotaKind, number>>;

/** Độ dài một kỳ (PRD A4/A6, `record_payment_settlement(p_period_days => 30)`).
 *
 *  Export vì `readEntitlement()` dựng `resetsAt = periodStart + 30 ngày`. Nó
 *  `import` hằng này chứ KHÔNG khai lại 30 ngày — hai lời khai của cùng một
 *  khoảng thời gian là đúng hình dạng hỏng mà `periodStartEpoch()` bên dưới
 *  tồn tại để chặn. */
export const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Khoá bộ đếm kỳ trên Redis. **Đây là chỗ DUY NHẤT trong repo ghép chuỗi này.**
 *
 * Đường ĐỌC (`readEntitlement()` dựng `used`) và đường GHI (`consumeQuota()`
 * INCR ở cổng) phải cho ra chuỗi GIỐNG HỆT TỪNG BYTE cho cùng một người tại
 * cùng một thời điểm. Nếu mỗi bên tự ghép — thừa một dấu hai chấm, đổi thứ tự
 * hai đoạn giữa, hay một bên dùng giây còn bên kia mili giây — thì màn hình báo
 * "còn n lượt" trong khi cổng từ chối, và KHÔNG CÓ GÌ ĐỎ. Vì thế cả hai phía
 * gọi hàm này; không phía nào viết lại mẫu khoá.
 *
 * @param periodStartEpochMs giá trị `periodStartEpoch()` trả về, nguyên vẹn —
 *   không làm tròn lại, không quy đổi đơn vị.
 */
export function quotaKey(
  kind: QuotaKind,
  userId: string,
  periodStartEpochMs: number
): string {
  return `quota:${kind}:${userId}:${periodStartEpochMs}`;
}

/**
 * Mốc bắt đầu kỳ hiện tại của một người dùng, tính bằng **mili giây** kể từ
 * epoch — đúng đoạn `{periodStartEpoch}` của khoá `quota:{kind}:{userId}:{…}`.
 *
 * - `premium` ⇒ `subscriptions.period_anchor_at`. Kỳ đã trả tiền được neo tại
 *   thời điểm thanh toán, không trôi theo lịch tạo tài khoản.
 * - `free` ⇒ `created_at + 30d × floor((now − created_at) / 30d)`.
 *
 * **Ân hạn cấp QUYỀN, không bao giờ cấp HẠN MỨC (PRD D8/R4, AC-011).** Trong ân
 * hạn `plan` vẫn đọc là `premium` và `anchor` không đổi, nên hàm này trả đúng
 * giá trị cũ: bộ đếm tiếp tục tính vào kỳ TRƯỚC. Một người bước vào ân hạn với
 * 0 lượt còn lại bị từ chối vì **hết hạn mức**, không phải vì **hết hạn gói** —
 * hai thông báo khác nhau, và AC-011 kiểm đúng chỗ đó.
 *
 * Đơn vị là mili giây vì cả hai chỗ gọi đều đã cầm `Date`/`Date.now()` ở đơn vị
 * đó; chọn giây sẽ thêm một phép quy đổi ở mỗi đầu, và một phép quy đổi có mặt
 * ở đầu này mà thiếu ở đầu kia chính là lỗi im lặng nói ở đầu file.
 *
 * @param anchor `subscriptions.period_anchor_at`, hoặc `null` khi không có
 *   thuê bao. Cột đó là `not null` (schema.sql), nên `premium` + `null` chỉ tới
 *   được bằng dữ liệu hỏng và được ném ra thay vì âm thầm rơi về công thức
 *   Free — rơi lặng lẽ sẽ đẻ ra khoá thứ hai cho cùng một người.
 */
export function periodStartEpoch(
  plan: Plan,
  anchor: Date | null,
  createdAt: Date,
  now: Date
): number {
  if (plan === "premium") {
    if (anchor === null) {
      throw new Error(
        "periodStartEpoch: gói premium nhưng thiếu period_anchor_at — dữ liệu subscriptions hỏng"
      );
    }
    return anchor.getTime();
  }

  const createdAtMs = createdAt.getTime();
  const elapsedPeriods = Math.floor((now.getTime() - createdAtMs) / PERIOD_MS);
  return createdAtMs + elapsedPeriods * PERIOD_MS;
}

// ═══════════════ Đường GHI — consumeQuota() (backend DD I004) ════════════════

/**
 * Kết quả một lượt xin cấp phát.
 *
 * `unavailable` là một SỰ CỐ HẠ TẦNG của ta; hai giá trị còn lại là QUYẾT ĐỊNH
 * CHÍNH SÁCH. Chỗ gọi ánh xạ chúng sang mã telemetry (OK-04, plan Task 5.5) —
 * file này không biết gì về telemetry, đúng như `settleOrder()` không biết gì
 * về phạm vi sở hữu: quyết định và bản ghi của quyết định thuộc về tầng đang
 * cầm ngữ cảnh.
 */
export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "user_quota" | "project_budget" | "unavailable" };

/** Khoá kỳ sống thêm một ngày sau khi kỳ kết thúc. Dôi ra chứ không khít, vì
 *  TTL được đặt theo đồng hồ của tiến trình còn khoá thì thuộc về một kỳ đã
 *  được neo từ trước: cắt khít sẽ xoá bộ đếm của một người vẫn đang trong kỳ
 *  chỉ vì hai đồng hồ lệch nhau vài giây. */
const QUOTA_TTL_SLACK_MS = 24 * 60 * 60 * 1000;

/**
 * Suất ngân sách ngày mà lưu lượng gói FREE được phép tiêu (PRD AC-023).
 *
 * **CÁCH MÃ HOÁ ĐƯỢC CHỐT Ở ĐÂY: PHÂN SỐ, KHÔNG PHẢI PHẦN TRĂM.** `0.5` = 50%,
 * khoảng hợp lệ là `(0, 1]`, ngoài khoảng thì rơi về `0.5`. `checkEnv.ts` cố ý
 * chỉ bắt thứ "sai dưới mọi cách mã hoá" và ghi rõ rằng chỗ ĐỌC ghim việc này —
 * đây là chỗ đọc đó, và câu hỏi không được để mở thêm một lần nữa.
 *
 * Lý do chọn phân số là HƯỚNG HỎNG khi người vận hành gõ theo cách kia, chứ
 * không phải sở thích. Cả hai chuỗi mà một người định nói "50%" có thể gõ —
 * `0.5` và `50` — đều lọt qua `checkEnv` (`checkEnv.test.ts` liệt kê đúng hai
 * chuỗi đó là "im lặng"), nên cả hai sẽ xảy ra thật:
 *
 *   · Đọc theo PHẦN TRĂM mà người ta gõ `0.5` ⇒ Free được 0,5% của ngân sách
 *     ⇒ `floor(20 × 0,005) = 0` ⇒ TỪ CHỐI TOÀN BỘ lưu lượng Free, tức gần như
 *     toàn bộ người dùng, ngay từ request đầu tiên của ngày. `0.5` là một giá
 *     trị HỢP LỆ dưới cách đọc đó, nên không có gì bắt được nó.
 *   · Đọc theo PHÂN SỐ mà người ta gõ `50` ⇒ 50 nằm ngoài `(0, 1]` ⇒ rơi về
 *     `0.5` = ĐÚNG con số họ định nói. Cách mã hoá sai tự sửa.
 *
 * Nói gọn: phân số + khoảng hợp lệ làm CẢ HAI cách gõ cùng cho ra 50%; phần
 * trăm thì một trong hai cách gõ cho ra một sự cố toàn phần và im lặng.
 *
 * Ngoài khoảng ⇒ mặc định chứ KHÔNG ném: thiếu hay sai suất bảo lưu làm suy yếu
 * một CHÍNH SÁCH, nó không gỡ bỏ trần chi. Trần chi là `AI_BUDGET_DAILY_LIMIT`
 * ngay dưới đây, và nó hỏng theo hướng ngược lại.
 */
const FREE_SHARE_DEFAULT = 0.5;

/** Khoá ngân sách ngày của Gemini. Phép suy NGÀY sống ở `./budgetDay` — một
 *  lời khai duy nhất, dùng chung với bộ đếm ngân sách của nhà cung cấp thứ hai
 *  (backend DD § MSA-3).
 *
 *  MẪU KHOÁ thì ở LẠI đây, viết nguyên vẹn. Hai lý do: cổng canh
 *  `quota.test.ts:868` quét VĂN BẢN NGUỒN tìm `ai:budget:` đứng ngay sau một
 *  dấu nháy, nên đẩy chuỗi này sang tham số của một hàm dựng khoá sẽ khiến
 *  cổng khớp KHÔNG file nào — tức THÔI CANH chứ không chỉ đỏ; và một
 *  `pacificDayKey(prefix, now)` sẽ đòi prefix không kèm dấu hai chấm cuối mà
 *  không cưỡng chế được, tức một cái bẫy im lặng cho consumer thứ hai. */
function budgetKey(now: Date): string {
  return `ai:budget:${pacificDay(now)}`;
}

/**
 * Trần chi Gemini mỗi ngày cho cả dự án, hoặc `null` khi không dùng được.
 *
 * `null` ⇒ TỪ CHỐI, không phải "không giới hạn" (AC-025, cùng lối fail-closed
 * với `GEMINI_PAID_TIER_ENABLED`). Điều kiện hợp lệ trùng với `checkEnv.ts` một
 * cách CỐ Ý và hai chỗ đó không dùng chung code: `checkEnv` trả lời "có nói ra
 * lúc khởi động không", hàm này trả lời "có phục vụ request này không". Gộp
 * chúng lại sẽ buộc cổng khởi động phải import đường ghi hạn mức.
 */
function dailyBudgetLimit(): number | null {
  const raw = process.env.AI_BUDGET_DAILY_LIMIT?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

function freeShare(): number {
  const raw = process.env.AI_BUDGET_FREE_SHARE?.trim();
  if (!raw) return FREE_SHARE_DEFAULT;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : FREE_SHARE_DEFAULT;
}

/**
 * Trần áp cho lượt gọi này. Chỉ có MỘT khoá đếm mỗi ngày cho cả dự án; cái
 * khác nhau giữa hai gói là NGƯỠNG so với khoá đó. Vì thế lưu lượng Free bị từ
 * chối khi TỔNG chi của ngày chạm suất của nó, còn Premium đi tiếp tới trần
 * đầy — đúng "Free bị từ chối khi đã tiêu hết phần của mình trong khi Premium
 * tiếp tục" (AC-023), và là cách đọc chặt hơn trong hai cách.
 */
function budgetCeiling(plan: Plan, dailyLimit: number): number {
  return plan === "premium" ? dailyLimit : Math.floor(dailyLimit * freeShare());
}

/**
 * Mốc bắt đầu kỳ cho lượt GHI này, hoặc `null` khi không dựng được.
 *
 * Hai nhánh, và cả hai đều cho ra ĐÚNG con số mà đường ĐỌC đã dựng hoặc sẽ
 * dựng — không có nhánh nào đoán, và không có nhánh nào rơi về một khoá trần:
 *
 *   · hạn mức `known` ⇒ `Date.parse(resetsAt) − PERIOD_MS`. Đây là phép NGHỊCH
 *     ĐẢO CHÍNH XÁC của `resetsAt = periodStart + PERIOD_MS` mà
 *     `readEntitlement()` vừa tính, ở cùng đơn vị mili giây và cùng độ chính
 *     xác ISO — không phải một phép suy lại, mà là cùng một con số đi ngược.
 *     0 lượt I/O trên đường người dùng đang chờ.
 *   · hạn mức `unknown` (Redis không trả lời lúc ĐỌC, nên không có `resetsAt`
 *     để đi ngược) ⇒ đọc `period_anchor_at` + `created_at` rồi gọi
 *     `periodStartEpoch()`, đúng hàm mà đường đọc gọi. `unknown` là trạng thái
 *     HIỂN THỊ, không bao giờ là trạng thái KHOÁ: một khoá thứ hai sẽ chia đôi
 *     bộ đếm của một kỳ và phát cho người dùng một suất mới sau mỗi lần Redis
 *     chớp — một lỗ rò capacity đã trả tiền, và im lặng.
 *
 * Lượt đọc ở nhánh hai KHÔNG dùng lại `readEntitlement()`: nó lấy đúng hai cột
 * dựng khoá (không có `expires_at`) và hỏng theo hướng NGƯỢC LẠI — từ chối
 * fail-closed, chứ không phải rơi về `FREE_FALLBACK`. Cùng miền và cùng thư
 * mục, khác đầu ra và khác hợp đồng lỗi.
 */
async function resolvePeriodStart(
  kind: QuotaKind,
  userId: string,
  ent: Entitlement,
  now: Date
): Promise<number | null> {
  const quota = ent[kind];
  if (quota.state === "known") {
    const resetsAtMs = Date.parse(quota.resetsAt);
    if (Number.isFinite(resetsAtMs)) return resetsAtMs - PERIOD_MS;
  }

  try {
    const supabase = await createClient();
    const [subscription, profile] = await Promise.all([
      supabase.from("subscriptions").select("period_anchor_at").eq("user_id", userId).maybeSingle(),
      supabase.from("user_profiles").select("created_at").eq("id", userId).maybeSingle(),
    ]);

    if (subscription.error || profile.error) return null;

    const createdAt = profile.data?.created_at as string | undefined;
    if (!createdAt) return null;

    const row = subscription.data as { period_anchor_at: string } | null;
    // `periodStartEpoch()` NÉM khi premium mà thiếu anchor — cố ý, và cái ném
    // đó rơi vào `catch` bên dưới thành một lời từ chối. Đoán một mốc kỳ ở đây
    // chính là thứ hàm kia ném lỗi để chặn.
    return periodStartEpoch(
      ent.plan,
      row?.period_anchor_at ? new Date(row.period_anchor_at) : null,
      new Date(createdAt),
      now
    );
  } catch (err) {
    console.warn("[consumeQuota] không dựng được mốc kỳ, từ chối:", err);
    return null;
  }
}

/**
 * Xin cấp phát MỘT thao tác người dùng, và ĐẶT CHỖ trước số request Gemini mà
 * thao tác đó sẽ phát.
 *
 * Hai bộ đếm, hai ĐƠN VỊ, và đó là toàn bộ điểm của hàm này (DD I004):
 *   · `quota:{kind}:{userId}:{periodStart}` **+1 mỗi thao tác** — gói được bán
 *     bằng lượt (D5 "5 lượt gia sư", D7 "3 lượt upload"), nên một lượt upload
 *     ở chế độ `automatic` tiêu ĐÚNG MỘT suất dù nó phát 3 request;
 *   · `ai:budget:{ngày Pacific}` **+`geminiCalls`** — trần của nhà cung cấp
 *     đếm bằng REQUEST. Đếm bằng thao tác ở đây là đúng cái under-count 2–3×
 *     mà bản thiết kế v1.4 sinh ra để sửa.
 *
 * @param geminiCalls **BẮT BUỘC, không có giá trị mặc định.** Một mặc định `1`
 *   tái tạo y nguyên cái under-count đó, và tái tạo nó IM LẶNG; bắt buộc thì
 *   việc gộp hai bộ đếm lại là một LỖI BIÊN DỊCH. Giá trị phải đến từ chính
 *   biểu thức quyết định số request sẽ phát (`metaCall ? 3 : 2`), không phải
 *   một lần đọc lại `entryMode` thứ hai.
 *
 * Ngân sách nhích bằng ĐÚNG MỘT lệnh `INCRBY` phát TRƯỚC mọi request, tức một
 * ĐẶT CHỖ chứ không phải một cái tích từng lượt gọi: ba request của pipeline
 * upload chạy trong một `Promise.all`, nên một lời từ chối rơi vào giữa chúng
 * sẽ bỏ lại một lượt bóc đề dở dang đã tiêu cả tiền nhà cung cấp lẫn suất của
 * người dùng. Đặt chỗ có thể ĐẾM DƯ khi một request được đặt chỗ rồi không bao
 * giờ ra tới mạng — đó là hướng sai an toàn, và được chấp nhận không bù trừ.
 *
 * Bị từ chối thì cả hai bộ đếm được TRẢ LẠI: người dùng không trả giá bằng một
 * suất hạn mức cho một sự cố ở tầm dự án, và một lượt bị chặn không được tự
 * kéo dài thời gian bị chặn của chính nó.
 *
 * Redis không tới được ⇒ `unavailable` ⇒ TỪ CHỐI (AC-024). Hàm này cố ý KHÔNG
 * thừa kế lớp đệm RAM của `rateLimit.ts`: bộ đếm process-local nhân lên theo
 * số instance và về 0 ở mỗi cold start, nên nó không bao giờ chặn nổi một ngân
 * sách toàn dự án. Cái giá chấp nhận là PRD R-h (Upstash sự cố ⇒ AI tắt với cả
 * người đã trả tiền); cái từ chối trả là một khoản chi không có trần.
 */
export async function consumeQuota(
  kind: QuotaKind,
  userId: string,
  ent: Entitlement,
  geminiCalls: number
): Promise<ConsumeResult> {
  // Trần chi được kiểm TRƯỚC mọi phép ghi: một deploy quên biến môi trường
  // không được phép đốt hạn mức của người dùng trong lúc từ chối phục vụ họ.
  const dailyLimit = dailyBudgetLimit();
  if (dailyLimit === null) return { ok: false, reason: "unavailable" };

  // Đọc env LÚC GỌI và không cache client giữa các lượt, cùng lý do
  // `readEntitlement()` ghi ở chỗ tương ứng: `next build` nạp module với env
  // giả của CI, và một client dựng lúc đó sẽ ghim cấu hình sai. Đây là tiền lệ
  // cùng thư mục và cùng vòng đời (một lần mỗi request); `rateLimitStore.ts`
  // cache client vì nó được gọi nhiều lần trong một request, và cái giá của
  // lựa chọn đó là một hàm reset chỉ tồn tại cho test.
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return { ok: false, reason: "unavailable" };

  const now = new Date();
  const periodStart = await resolvePeriodStart(kind, userId, ent, now);
  if (periodStart === null) return { ok: false, reason: "unavailable" };

  const userKey = quotaKey(kind, userId, periodStart);
  const userLimit = PLAN_LIMITS[ent.plan][kind];
  const budget = budgetKey(now);
  const ceiling = budgetCeiling(ent.plan, dailyLimit);

  try {
    const redis = new Redis({ url, token });

    // `INCR` rồi so, chứ không đọc rồi ghi: hai request song song cùng đọc
    // `limit − 1` rồi cùng ghi sẽ vượt trần mà không lệnh nào sai. Cùng lý do
    // `rateLimitStore.ts` gói cửa sổ trượt vào một script Lua.
    const used = await redis.incr(userKey);
    await redis.pexpire(
      userKey,
      Math.max(periodStart + PERIOD_MS + QUOTA_TTL_SLACK_MS - now.getTime(), QUOTA_TTL_SLACK_MS)
    );
    if (used > userLimit) {
      await redis.decr(userKey);
      return { ok: false, reason: "user_quota" };
    }

    const spent = await redis.incrby(budget, geminiCalls);
    await redis.expire(budget, BUDGET_TTL_SECONDS);
    if (spent > ceiling) {
      await redis.decrby(budget, geminiCalls);
      await redis.decr(userKey);
      return { ok: false, reason: "project_budget" };
    }

    return { ok: true };
  } catch (err) {
    console.warn("[consumeQuota] bộ đếm không ghi được, từ chối:", err);
    return { ok: false, reason: "unavailable" };
  }
}
