// Rate limit (Security review 2026-08-03, Low; nâng lên bộ đếm dùng chung
// 2026-08-07 khi trả TD-008).
//
// ⚠ ĐỌC PHẦN NÀY TRƯỚC KHI TIN VÀO NÓ ⚠
//
// File này giữ lớp sliding-window đếm trong RAM của TIẾN TRÌNH ĐANG CHẠY. Một
// mình nó thì:
//   - Deploy nhiều instance (Vercel serverless, autoscale) → mỗi instance một
//     bộ đếm riêng; trần thực tế = limit × số instance.
//   - Cold start / restart → bộ đếm về 0.
//
// Từ 2026-08-07, `guard()` KHÔNG còn chỉ dựa vào nó: bộ đếm có thẩm quyền nằm
// trên Upstash Redis (`rateLimitStore.ts`), lớp RAM còn lại hai vai — chặn sớm
// để khỏi tốn lượt mạng, và làm lưới khi Redis không trả lời. Hai giới hạn đầu
// vì thế KHÔNG còn đúng với `guard()`, nhưng vẫn đúng với `checkRateLimit()`
// nếu ai gọi thẳng nó.
//
// CÒN NGUYÊN, và Redis không sửa được: khoá là user id, nên đây KHÔNG chặn được
// flood từ client CHƯA đăng nhập. Tầng đó là hạ tầng (rate limit ở biên), và nó
// đang bị khoá sau plan Pro của Vercel — xem TECH-DEBT TD-008. Đừng nhầm cái
// này là chống DoS.
//
// Việc nó làm tốt, và vẫn là việc duy nhất nó nhận: chặn một tài khoản ĐÃ ĐĂNG
// NHẬP gọi dồn dập một Server Action — spam report, spam rating, nộp bài liên
// tục.

import { hitSharedStore, isSharedStoreConfigured } from "./rateLimitStore";

/** Bản ghi thời điểm các lần gọi gần đây của một khoá. */
const hits = new Map<string, number[]>();

/** Trần số khoá giữ trong RAM — chặn map phình vô hạn nếu bị bơm nhiều user id.
 *  Vượt trần thì xoá bớt khoá cũ nhất (chúng sẽ tự khởi tạo lại nếu còn hoạt động). */
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  /** true = được phép đi tiếp. */
  ok: boolean;
  /** Số giây phải chờ trước khi thử lại; 0 khi ok. */
  retryAfterSeconds: number;
}

/**
 * Ghi nhận một lần gọi và cho biết có vượt trần không.
 *
 * Sliding window: chỉ đếm các lần gọi trong `windowMs` gần nhất, nên không có
 * hiệu ứng "đầu cửa sổ" như fixed-window (nơi 2× limit có thể lọt qua ở ranh
 * giới hai cửa sổ liền nhau).
 *
 * @param key    Định danh bucket — dùng `${action}:${userId}` để mỗi action một trần.
 * @param limit  Số lần tối đa trong cửa sổ.
 * @param windowMs Độ dài cửa sổ, mili giây.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    // Lần gọi cũ nhất còn trong cửa sổ sẽ rời cửa sổ trước tiên → thời điểm
    // sớm nhất được phép thử lại. Không ghi nhận lần gọi bị chặn (nếu ghi, kẻ
    // spam sẽ tự đẩy dài vô hạn thời gian chờ của chính mình — trừng phạt cả
    // người dùng thật bấm nhầm hai lần).
    hits.set(key, recent);
    const retryAfterMs = recent[0] + windowMs - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_TRACKED_KEYS) pruneOldest();

  return { ok: true, retryAfterSeconds: 0 };
}

/** Xoá các khoá không còn lần gọi nào còn hiệu lực; nếu vẫn quá trần thì bỏ
 *  tiếp những khoá có hoạt động cũ nhất. */
function pruneOldest() {
  const now = Date.now();
  for (const [k, times] of hits) {
    // Cửa sổ dài nhất đang dùng là 1 giờ; quá 1 giờ chắc chắn hết hiệu lực.
    if (times.length === 0 || times[times.length - 1] < now - 3_600_000) hits.delete(k);
  }
  if (hits.size <= MAX_TRACKED_KEYS) return;

  const byLastSeen = [...hits.entries()].sort(
    (a, b) => a[1][a[1].length - 1] - b[1][b[1].length - 1]
  );
  for (const [k] of byLastSeen.slice(0, hits.size - MAX_TRACKED_KEYS)) hits.delete(k);
}

/** CHỈ dùng trong test — xoá toàn bộ trạng thái giữa các case. */
export function __resetRateLimitForTests() {
  hits.clear();
}

/** Trần cho từng action. Đặt RỘNG RÃI: mục tiêu là chặn vòng lặp tự động, không
 *  phải làm phiền người dùng thật. Con số dưới đây đều cao hơn nhiều lần mức
 *  dùng bình thường (một người không thể nộp 30 bài thi trong một giờ). */
export const RATE_LIMITS = {
  submitExam: { limit: 30, windowMs: 60 * 60 * 1000 },
  rateExam: { limit: 40, windowMs: 60 * 60 * 1000 },
  reportExam: { limit: 15, windowMs: 60 * 60 * 1000 },
  updateProfile: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Tiện ích gộp: `await guard("reportExam", userId)`.
 *
 * HAI LỚP, và thứ tự có chủ đích (TD-008, 2026-08-07):
 *
 *   1. RAM trước. Nếu instance này đã thấy user vượt trần thì trả lời ngay —
 *      không tốn lượt mạng nào. Đây là lớp rẻ, và nó xử đúng trường hợp tốn
 *      kém nhất: một vòng lặp tự động đang nện liên tục.
 *   2. Redis sau, và nó là câu trả lời CÓ THẨM QUYỀN. RAM chỉ thấy phần lưu
 *      lượng đi qua đúng instance này; trần thật phải đếm chung.
 *
 * Redis hỏng thì tụt về kết quả của lớp RAM — KHÔNG mở cổng. Một sự cố Upstash
 * làm rate limit yếu đi (về đúng mức trước 2026-08-07) thì chấp nhận được; làm
 * nó biến mất thì không. Đổi lại, ta chấp nhận nói "ok" khi Redis chết dù bộ
 * đếm chung có thể đã đầy — đó là đánh đổi đúng cho một guard mức Low nằm trên
 * đường người dùng đang chờ nộp bài.
 *
 * ⚠ Lớp RAM ĐÃ ghi nhận lần gọi trước khi hỏi Redis. Nghĩa là một lần gọi bị
 * Redis chặn vẫn tốn một suất trong bộ đếm RAM của instance này. Cố ý chấp
 * nhận: RAM chỉ còn là lưới dự phòng, lệch một chút theo hướng CHẶT hơn không
 * gây hại, và sửa cho khớp sẽ cần một lượt ghi ngược làm phức tạp đường nóng.
 */
export async function guard(
  action: keyof typeof RATE_LIMITS,
  userId: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const key = `${action}:${userId}`;

  const local = checkRateLimit(key, limit, windowMs);
  if (!local.ok) return local;

  if (!isSharedStoreConfigured()) return local;

  try {
    return await hitSharedStore(key, limit, windowMs);
  } catch (err) {
    // Ồn một dòng là đúng: chạy dài ngày với Redis chết mà không ai biết thì
    // TD-008 quay lại y như cũ, chỉ khác là nay có một file bảo rằng đã trả.
    console.warn("! RATE LIMIT: Redis không trả lời, tụt về bộ đếm RAM —", err);
    return local;
  }
}
