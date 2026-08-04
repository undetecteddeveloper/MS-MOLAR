// Rate limit tối giản, trong bộ nhớ tiến trình (Security review 2026-08-03, Low).
//
// ⚠ ĐỌC PHẦN NÀY TRƯỚC KHI TIN VÀO NÓ ⚠
//
// Đây là sliding-window đếm trong RAM của TIẾN TRÌNH ĐANG CHẠY. Nghĩa là:
//   - Deploy nhiều instance (Vercel serverless, autoscale) → mỗi instance một
//     bộ đếm riêng; trần thực tế = limit × số instance.
//   - Cold start / restart → bộ đếm về 0.
//   - KHÔNG chống được flood từ client CHƯA đăng nhập, vì khoá là user id.
//
// Nó KHÔNG phải tầng chống DoS thật. Tầng đó là hạ tầng (Vercel/Cloudflare rate
// limit ở biên). Cái này giải quyết đúng một việc, và giải quyết tốt: chặn một
// tài khoản ĐÃ ĐĂNG NHẬP gọi dồn dập một Server Action — spam report, spam
// rating, nộp bài liên tục — mà không cần thêm bảng DB hay round-trip nào.
//
// Chọn RAM thay vì DB có chủ đích: mọi action ở đây đều nằm trên đường người
// dùng đang chờ, và dự án đã tối ưu round-trip khá kỹ (xem getResult). Thêm một
// query đếm cho MỖI lần gọi là đánh đổi tệ cho một guard mức Low.

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

/** Tiện ích gộp: `guard("reportExam", userId)`. */
export function guard(
  action: keyof typeof RATE_LIMITS,
  userId: string
): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[action];
  return checkRateLimit(`${action}:${userId}`, limit, windowMs);
}
