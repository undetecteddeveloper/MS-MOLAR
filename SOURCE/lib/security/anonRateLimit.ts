// Trần theo IP cho lưu lượng CHƯA ĐĂNG NHẬP (TECH-DEBT TD-013).
//
// VẤN ĐỀ TD-013 MÔ TẢ, nguyên văn: mọi guard hiện có đều khoá theo `user.id`,
// nên một client chưa đăng nhập KHÔNG bị đếm bởi bất cứ thứ gì. Redis không
// sửa được điều đó — không có khoá để đếm. Cái nổ không phải kết quả sai mà là
// HOÁ ĐƠN: một vòng lặp nện `/exams` hay `/login` đốt invocation cho tới khi
// hết hạn mức Hobby, rồi site tắt.
//
// ⚠ ĐỌC TRƯỚC KHI TIN: ĐÂY LÀ GIẢM THIỂU, KHÔNG PHẢI BẢN VÁ ⚠
//
// TD-013 tự cảnh báo đúng chỗ yếu của chính cách này: mọi thứ chạy TRONG
// function thì đã tốn tiền trước khi kịp từ chối. Điều đó vẫn đúng ở đây. Thứ
// khối này thật sự mua được, và đo được:
//   - MỘT lượt chạy middleware + MỘT round-trip Redis cùng vùng (~1–5ms), thay
//     cho một lượt render route đầy đủ kèm các lượt đọc Postgres xuyên vùng
//     (~50–60ms mỗi lượt) mà trang `/exams` phải làm.
//   - Nó KHÔNG cứu được invocation đầu tiên, và nó KHÔNG phải chống DoS.
// Bản vá thật vẫn là chặn ở BIÊN — Vercel Firewall (cần plan Pro) hoặc
// Cloudflare trước domain. TD-013 giữ nguyên hai đường đó; khối này chỉ hạ độ
// dốc của hoá đơn trong lúc chờ.
//
// CHỈ ĐẾM REQUEST KHÔNG CÓ COOKIE PHIÊN, có chủ ý ở cả hai chiều:
//   - Người ĐÃ đăng nhập vốn đã bị đếm theo `user.id` bởi `guard()`, nên đếm
//     lại theo IP là đánh thuế hai lần đúng nhóm người dùng thật, và nó sẽ
//     đánh nặng nhất vào một lớp học ngồi sau MỘT địa chỉ NAT.
//   - Đường đi nóng của người đã đăng nhập không nhận thêm round-trip nào.
//
// CGNAT / NAT TRƯỜNG HỌC LÀ RỦI RO ĐÃ BIẾT của mọi trần theo IP, và ở Việt Nam
// nó không phải giả thuyết: một trường học hay một nhà mạng di động có thể đẩy
// hàng trăm người dùng thật qua đúng một địa chỉ. Trần dưới đây được chọn để
// SỐNG CHUNG với điều đó thay vì phủ nhận nó — xem ANON_RATE_LIMIT.

import { hitSharedStore, isSharedStoreConfigured } from "./rateLimitStore";

/**
 * Trần cho MỘT địa chỉ IP chưa đăng nhập.
 *
 * 240 request / 60 giây, và con số này chọn theo khoảng cách giữa hai thứ có
 * thể ước lượng được, không theo cảm giác:
 *   - Một người thật duyệt web phát ra hàng CHỤC request/phút ở lúc bận nhất
 *     (mỗi lượt điều hướng là một document + vài lượt RSC; static asset đã bị
 *     `config.matcher` của proxy.ts loại khỏi middleware nên không tính vào
 *     đây). 240 chừa chỗ cho khoảng một tá người thật cùng ngồi sau một địa
 *     chỉ NAT, cùng bấm liên tục.
 *   - Một vòng lặp nện — thứ duy nhất mục này sinh ra để chặn — phát ra hàng
 *     NGHÌN request/phút. Nó chạm trần trong vài giây.
 * Khoảng cách giữa "hàng chục" và "hàng nghìn" rộng tới mức con số chính xác
 * không quan trọng; điều quan trọng là nó nằm GIỮA. Nếu về sau có báo cáo một
 * trường học bị chặn, cách chữa là NỚI con số này, không phải gỡ khối đi —
 * và lúc đó lý do nới sẽ là một quan sát thật, đúng thứ TD-013 nói là đang
 * thiếu.
 */
export const ANON_RATE_LIMIT = { limit: 240, windowMs: 60_000 } as const;

/** Tiền tố khoá, tách khỏi khoá của `guard()` (`${action}:${userId}`) để không
 *  IP nào va vào bucket của một user id và ngược lại. */
const KEY_PREFIX = "anon-ip";

export interface AnonLimitDecision {
  ok: boolean;
  retryAfterSeconds: number;
}

const ALLOW: AnonLimitDecision = { ok: true, retryAfterSeconds: 0 };

/**
 * Địa chỉ client, hoặc `null` khi không xác định được.
 *
 * `x-forwarded-for` được nền tảng đặt, và mục ĐẦU TIÊN là client gốc — các mục
 * sau là proxy trên đường đi. Đọc mục cuối (hoặc cả chuỗi) là mở đường cho kẻ
 * gọi tự khai thêm một địa chỉ vào đầu chuỗi và thay khoá của chính mình mỗi
 * request, tức là gỡ bỏ trần trong im lặng.
 *
 * `null` ⇒ KHÔNG đếm gì cả (xem `checkAnonRateLimit`). Một khoá dự phòng kiểu
 * `"unknown"` sẽ gộp mọi request không có header vào MỘT bucket, và bucket ấy
 * sẽ tự chạm trần rồi chặn những người chẳng liên quan tới nhau.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? real : null;
}

/**
 * `true` khi request KHÔNG mang cookie phiên Supabase.
 *
 * Nhận diện theo TIỀN TỐ `sb-` + hậu tố `-auth-token`, vì tên cookie chứa
 * project ref (`sb-<ref>-auth-token`) và ref đổi theo môi trường — viết cứng
 * tên cookie ở đây là ghim dev vào một chỗ prod không khớp. Phiên lớn còn bị
 * `@supabase/ssr` cắt thành `...-auth-token.0`, `.1`, nên phép khớp là "bắt đầu
 * bằng" chứ không phải "bằng".
 *
 * ĐÂY LÀ MỘT PHÉP ĐOÁN RẺ, KHÔNG PHẢI XÁC THỰC, và nó được phép sai theo đúng
 * một chiều: một cookie hết hạn vẫn làm request "trông như đã đăng nhập" và
 * thoát khỏi trần này. Chấp nhận — kẻ tấn công muốn lợi dụng điều đó phải tự
 * gắn một cookie phiên vào mỗi request, và khi ấy chính `updateSession()` sẽ
 * từ chối nó ở ngay bước sau. Chiều sai còn lại (chặn nhầm người đã đăng nhập)
 * thì KHÔNG xảy ra, vì cookie có mặt là điều kiện đủ để bỏ qua.
 */
export function isAnonymousRequest(cookieNames: readonly string[]): boolean {
  return !cookieNames.some((name) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Quyết định cho một request chưa đăng nhập.
 *
 * FAIL-OPEN khi Redis không cấu hình hoặc không trả lời, cùng quyết định với
 * `checkSchemaVersion()` (TD-009) và KHÁC hẳn `quota.ts` — sự khác nhau đó có
 * lý do: `quota.ts` canh TIỀN trả cho bên thứ ba nên một lượt lọt là một khoản
 * chi thật, còn khối này canh số lượt invocation của chính ta. Fail-closed ở
 * đây biến một sự cố Redis thành "toàn bộ khách chưa đăng nhập nhận 429" — tức
 * là tự tay gây ra đúng cái downtime mà mục này tồn tại để tránh.
 *
 * KHÔNG có lớp đệm RAM dự phòng như `rateLimit.ts`: bộ đếm process-local nhân
 * lên theo số instance, và với một trần chống-flood thì "limit × số instance"
 * là một trần không nói lên điều gì. Thà không đếm còn hơn đếm ra một con số
 * không ai giải thích được.
 */
export async function checkAnonRateLimit(ip: string | null): Promise<AnonLimitDecision> {
  if (ip === null) return ALLOW;
  if (!isSharedStoreConfigured()) return ALLOW;
  try {
    return await hitSharedStore(
      `${KEY_PREFIX}:${ip}`,
      ANON_RATE_LIMIT.limit,
      ANON_RATE_LIMIT.windowMs
    );
  } catch {
    return ALLOW;
  }
}
