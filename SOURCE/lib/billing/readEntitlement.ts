import "server-only";

// Đường ĐỌC quyền lợi phía server — UI Spec C-01, backend DD § "readEntitlement
// .ts — the read-time derivation".
//
// Toàn bộ phần "chưa xong" của pha UI được gói vào ĐÚNG một hàm, ở đúng một
// file, để khi backend lên thì thứ phải đổi là thân hàm này — không phải mỗi
// màn hình đi đoán lại một lần. Đây là lượt đổi đó: chữ ký ở `:34` không đổi,
// nên `(billing)/layout.tsx:27` đi qua thay đổi này mà không phải sửa gì.
//
// Ba bước, đúng thứ tự header cũ đã hẹn:
//   1. đọc `subscriptions` theo userId → `expires_at`, `period_anchor_at`;
//   2. suy `plan`/`inGracePeriod` LÚC ĐỌC bằng cách so với now() + ân hạn 3
//      ngày (PRD R2/R4) — không đọc cột boolean nào, vì không có cột nào như
//      vậy và sẽ không bao giờ có (ADR-0013 Decision: một mốc thời gian, đánh
//      giá ở MỌI lượt đọc; 0 tiến trình nền tham gia vào việc hạ cấp);
//   3. đọc bộ đếm kỳ trên Redis → `tutor`/`upload` chuyển từ `unknown` sang
//      `known`.
// Nó nhận `userId` đã có sẵn từ lời gọi trước đó thay vì tự `auth.getUser()`
// lần nữa — tiền lệ ở tutorActions.ts:139-143.
//
// HAI HƯỚNG HỎNG NGƯỢC NHAU, CỐ Ý (types.ts:22-26). Supabase không trả lời ⇒
// `plan` fail-CLOSED về Free: cấp nhầm Premium là cho không thứ có người phải
// trả tiền. Redis không trả lời ⇒ hạn mức fail-OPEN về `unknown`, KHÔNG phải 0:
// báo nhầm "hết lượt" sẽ TẮT tính năng gia sư đang chạy của người có quyền dùng
// (UI-D2). Hàm này KHÔNG BAO GIỜ ném ra layout — một sự cố hạ tầng chỉ được
// phép làm trang hiển thị ít đi, không được phép làm trang không render.
//
// Không có mẫu khoá `quota:` nào ở file này và không có công thức mốc kỳ thứ
// hai: cả hai `import` từ `quota.ts`, nơi đường GHI (`consumeQuota()`) cũng lấy
// chúng ra. Đó là điều kiện để chuỗi khoá hai bên ghép ra giống hệt từng byte.

import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
import { PERIOD_MS, PLAN_LIMITS, periodStartEpoch, quotaKey } from "./quota";
import { FREE_FALLBACK, type Entitlement, type Plan, type Quota } from "./types";

/** Ân hạn sau `expires_at` (PRD D8/R4, AC-010). Ân hạn cấp QUYỀN chứ không cấp
 *  HẠN MỨC — nên nó chỉ xuất hiện ở phép suy `plan` dưới đây, tuyệt đối không
 *  đi vào `periodStartEpoch()`. */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

type Account = {
  /** `subscriptions.expires_at`, hoặc `null` khi chưa từng mua. */
  expiresAtMs: number | null;
  /** `subscriptions.period_anchor_at`, hoặc `null` khi chưa từng mua. */
  anchor: Date | null;
  /** `user_profiles.created_at` — mốc neo kỳ của người dùng Free (PRD A6). */
  createdAt: Date;
};

/**
 * Quyền lợi của người dùng hiện tại cho lượt render này.
 *
 * `userId` là `null` cho khách chưa đăng nhập (hai trang Điều khoản/Hoàn tiền
 * công khai vẫn render qua layout này) — câu trả lời cho họ là Free, và không
 * có lượt I/O nào được phát: một trang công khai không được trả giá bằng hai
 * truy vấn cho một câu trả lời đã biết trước.
 */
export async function readEntitlement(userId: string | null): Promise<Entitlement> {
  if (!userId) return FREE_FALLBACK;

  const account = await readAccount(userId);
  if (!account) return FREE_FALLBACK;

  const now = new Date();
  const { plan, expiresAt, inGracePeriod } = derivePlan(account.expiresAtMs, now.getTime());
  const usage = await readPeriodUsage(userId, plan, account, now);

  return {
    plan,
    expiresAt,
    inGracePeriod,
    tutor: usage?.tutor ?? { state: "unknown" },
    upload: usage?.upload ?? { state: "unknown" },
  };
}

/**
 * Bước 2 — `entitlement = f(expires_at, ân hạn, now())`, và không gì khác.
 *
 * Một phép so sánh duy nhất quyết định cả ba trường. Biên là `<` chứ không phải
 * `<=`: ĐÚNG tại `expires_at + 3 ngày` người dùng đã về Free. `inGracePeriod`
 * là trường RIÊNG chứ không suy được từ `plan`, vì trong ân hạn `plan` vẫn đọc
 * là `premium` (types.ts:52-55).
 */
function derivePlan(
  expiresAtMs: number | null,
  nowMs: number
): { plan: Plan; expiresAt: string | null; inGracePeriod: boolean } {
  if (expiresAtMs === null || nowMs >= expiresAtMs + GRACE_MS) {
    return { plan: "free", expiresAt: null, inGracePeriod: false };
  }
  return {
    plan: "premium",
    // `toISOString()` chứ không phải chuỗi thô của PostgREST: nó trả `+00:00`
    // còn hợp đồng đóng băng nói ISO 8601 — hai chuỗi cùng chỉ một thời điểm mà
    // so sánh chuỗi thì khác nhau.
    expiresAt: new Date(expiresAtMs).toISOString(),
    inGracePeriod: nowMs >= expiresAtMs,
  };
}

/**
 * Bước 1 — hai lượt đọc, song song, KHÔNG lượt ghi nào.
 *
 * `user_profiles.created_at` đọc cùng lúc chứ không đọc sau khi đã biết `plan`:
 * người dùng Free là số đông, nên nhánh "hỏi tiếp" sẽ thành hai vòng round-trip
 * nối tiếp cho hầu hết mọi lượt render. Song song thì luôn là hai truy vấn
 * nhưng chỉ một khoảng chờ.
 *
 * `null` = không dựng được câu trả lời thật ⇒ bên gọi rơi về `FREE_FALLBACK`.
 * Nhánh này CHẠY THẬT trên môi trường chưa apply DDL `subscriptions` (TD-005:
 * schema apply bằng tay), nên nó phải im lặng và fail-closed, không được ném.
 */
async function readAccount(userId: string): Promise<Account | null> {
  try {
    const supabase = await createClient();
    const [subscription, profile] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("expires_at, period_anchor_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("user_profiles").select("created_at").eq("id", userId).maybeSingle(),
    ]);

    if (subscription.error || profile.error) {
      // Chỉ log MÃ lỗi PostgREST, không log dữ liệu người dùng — cùng lối
      // getCurrentUserProfile() đã đi (getCurrentUser.ts:66).
      console.warn(
        "[readEntitlement] đọc quyền lợi hỏng:",
        subscription.error?.code ?? profile.error?.code
      );
      return null;
    }

    const createdAt = profile.data?.created_at as string | undefined;
    if (!createdAt) return null;

    const row = subscription.data as { expires_at: string; period_anchor_at: string } | null;
    return {
      expiresAtMs: row?.expires_at ? new Date(row.expires_at).getTime() : null,
      anchor: row?.period_anchor_at ? new Date(row.period_anchor_at) : null,
      createdAt: new Date(createdAt),
    };
  } catch (err) {
    console.warn("[readEntitlement] Supabase không kết nối được:", err);
    return null;
  }
}

/**
 * Bước 3 — `used` từ bộ đếm kỳ, `limit` từ `PLAN_LIMITS`, `resetsAt` từ mốc kỳ.
 *
 * `null` = không đọc được ⇒ bên gọi để hạn mức ở `unknown`. Ba đường tới đây và
 * cả ba đều là "chưa biết", không phải "bằng 0": chưa cấu hình Redis, Redis
 * không trả lời, và `periodStartEpoch()` ném vì dữ liệu `subscriptions` hỏng
 * (premium mà thiếu `period_anchor_at`). Đoán một mốc kỳ trong ca thứ ba sẽ đẻ
 * ra khoá THỨ HAI cho cùng một người, đúng thứ hàm kia ném lỗi để chặn.
 *
 * `mget` một lượt cho cả hai loại: cùng một kỳ, cùng một người, nên tách thành
 * hai lượt chỉ thêm một vòng mạng vào đúng đường người dùng đang chờ.
 */
async function readPeriodUsage(
  userId: string,
  plan: Plan,
  account: Account,
  now: Date
): Promise<{ tutor: Quota; upload: Quota } | null> {
  // Đọc env LÚC GỌI chứ không phải lúc nạp module, và không cache client giữa
  // các lượt: `next build` nạp module với env giả của CI, và một client dựng ở
  // thời điểm đó sẽ ghim cấu hình sai (cùng lý do rateLimitStore.ts:61-67).
  // Hàm này chạy MỘT lần mỗi request nên cái giá của việc dựng lại là một
  // object bọc `fetch`, không phải một kết nối.
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;

  try {
    const periodStart = periodStartEpoch(plan, account.anchor, account.createdAt, now);
    const resetsAt = new Date(periodStart + PERIOD_MS).toISOString();
    const redis = new Redis({ url, token });
    const [tutorUsed, uploadUsed] = await redis.mget<(number | null)[]>(
      quotaKey("tutor", userId, periodStart),
      quotaKey("upload", userId, periodStart)
    );

    return {
      // Khoá chưa tồn tại ⇒ `null` ⇒ 0 lượt đã dùng. Đó KHÔNG phải một suy
      // đoán: mốc kỳ nằm trong khoá, nên một kỳ mới bắt đầu bằng một khoá chưa
      // ai ghi — không có job nào chạy ở biên kỳ (AC-016).
      tutor: { state: "known", used: tutorUsed ?? 0, limit: PLAN_LIMITS[plan].tutor, resetsAt },
      upload: { state: "known", used: uploadUsed ?? 0, limit: PLAN_LIMITS[plan].upload, resetsAt },
    };
  } catch (err) {
    console.warn("[readEntitlement] bộ đếm kỳ không đọc được, hạn mức để unknown:", err);
    return null;
  }
}
