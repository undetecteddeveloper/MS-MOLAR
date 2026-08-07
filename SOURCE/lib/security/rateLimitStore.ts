// Bộ đếm rate limit DÙNG CHUNG giữa các instance (TECH-DEBT TD-008, 2026-08-07).
//
// Vì sao cần: `rateLimit.ts` đếm trong RAM của tiến trình đang chạy, nên trên
// Vercel trần thực tế = limit × số instance, và cold start làm bộ đếm về 0. Nó
// chặn được một vòng lặp ngây thơ, không chặn được một vòng lặp kiên nhẫn.
//
// Vì sao Redis chứ không phải một bảng Postgres — lý do là ĐỊA LÝ, không phải
// sở thích: functions chạy ở `sin1` (Singapore, xem vercel.json), còn Supabase
// prod ở `ap-south-1` (Mumbai). Bộ đếm trên Postgres tốn ~50–60ms xuyên vùng
// cho mỗi lần gọi guard, trên đúng đường người dùng đang chờ. Upstash Redis
// provision tại Singapore nên cùng vùng với function: ~1–5ms. Đánh giá cũ của
// TD-008 ("đừng thêm round-trip nào") đúng ở mức nguyên tắc và sai ở mức số
// liệu — round-trip không có một giá cố định, nó phụ thuộc đặt cái gì ở đâu.
//
// MỘT round-trip cho mỗi lần kiểm, không phải bốn: cửa sổ trượt cần dọn hạn,
// đếm, đọc mốc cũ nhất và ghi mốc mới — làm bằng 4 lệnh rời thì vừa tốn 4 lượt
// mạng vừa KHÔNG nguyên tử (hai request song song cùng đọc count = limit-1 rồi
// cùng ghi). Gói vào một script Lua thì Redis chạy trọn gói, một lượt mạng.

import { Redis } from "@upstash/redis";

export interface StoreResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * Cửa sổ trượt trên sorted set: score = mốc thời gian mili giây của mỗi lần gọi.
 *
 * KHÔNG ghi nhận lần gọi bị chặn — nếu ghi, kẻ spam sẽ tự đẩy dài vô hạn thời
 * gian chờ của chính mình, và trừng phạt luôn người dùng thật bấm nhầm hai lần
 * (cùng quyết định với bản RAM, xem rateLimit.ts).
 *
 * `member` phải DUY NHẤT cho mỗi lần gọi: sorted set coi member trùng là cập
 * nhật score chứ không phải thêm phần tử, nên hai lần gọi trong cùng một mili
 * giây sẽ nuốt mất một lần đếm nếu member chỉ là thời gian.
 */
const SLIDING_WINDOW = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, tonumber(oldest[2])}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

/** `null` = chưa cấu hình Redis; gọi bên gọi tự quyết định fallback. */
let client: Redis | null | undefined;

/**
 * Client dùng lại giữa các lần gọi trong cùng instance.
 *
 * Đọc env LÚC GỌI ĐẦU TIÊN chứ không phải lúc nạp module: `next build` nạp
 * module này với env giả của CI (xem .github/workflows/ci.yml), và dựng client
 * lúc đó sẽ ghim cấu hình sai vào bundle.
 */
function getClient(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();

  // Tên biến do integration Upstash trên Vercel Marketplace đặt (KV_*), không
  // phải tên mặc định của `Redis.fromEnv()` (UPSTASH_REDIS_REST_*) — dựng client
  // tường minh để không phụ thuộc vào việc hai bộ tên đó có trùng nhau không.
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** Có cấu hình Redis không — dùng để quyết định khi nào lớp RAM là câu trả lời
 *  cuối cùng chứ không phải cache. */
export function isSharedStoreConfigured(): boolean {
  return getClient() !== null;
}

/**
 * Ghi nhận một lần gọi vào bộ đếm dùng chung.
 *
 * Ném lỗi khi Redis không trả lời — bên gọi (`rateLimit.ts`) bắt và tụt về lớp
 * RAM. Nuốt lỗi ngay tại đây sẽ biến "Redis chết" thành "mọi request đều được
 * phép", tức là một sự cố hạ tầng lặng lẽ gỡ bỏ guard.
 */
export async function hitSharedStore(
  key: string,
  limit: number,
  windowMs: number
): Promise<StoreResult> {
  const redis = getClient();
  if (!redis) throw new Error("Redis chưa cấu hình");

  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  const [allowed, oldest] = (await redis.eval(
    SLIDING_WINDOW,
    [`rl:${key}`],
    [now, windowMs, limit, member]
  )) as [number, number];

  if (allowed === 1) return { ok: true, retryAfterSeconds: 0 };

  // Lần gọi cũ nhất còn trong cửa sổ sẽ rời cửa sổ trước tiên → thời điểm sớm
  // nhất được phép thử lại.
  const retryAfterMs = oldest + windowMs - now;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** CHỈ dùng trong test — quên client đã dựng để case sau đọc lại env. */
export function __resetSharedStoreForTests() {
  client = undefined;
}
