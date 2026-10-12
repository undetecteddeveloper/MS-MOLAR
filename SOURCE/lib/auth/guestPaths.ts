// Những trang KHÁCH chưa đăng nhập được VÀO (chỉ xem), và "đăng nhập xong về
// đâu" — một nguồn cho cả hai (2026-10-12, brief
// docs/plans/20261012-feature-guest-browse-subpages.md T1 + T7).
//
// Vì sao chung một danh sách: `?next=` là đầu vào do người dùng gõ được, nên
// nó chỉ được trỏ về đúng những trang mà khách ĐÃ vào được. Hai danh sách riêng
// sẽ có ngày lệch — một `next` hợp lệ trỏ tới trang proxy lại đá về form đăng
// nhập, tức vòng lặp, hoặc ngược lại một trang mới mở cho khách mà đăng nhập
// xong không quay về được.
//
// KHÔNG nằm trong PUBLIC_PATHS (lib/supabase/middleware.ts): danh sách đó canh
// bất biến "đúng một đường GHI chưa-đăng-nhập" (ADR-0017). Server Action là
// POST tới chính URL của trang, nên mở trang theo path là mở luôn POST. Proxy
// chỉ dùng danh sách này cho GET/HEAD.
//
// File THUẦN (không import next/*): proxy chạy trong sandbox riêng.

/** Trang khớp BẰNG (không phải tiền tố): `/exams` không phủ `/exams-evil`,
 *  `/exams/x/attempt/y` hay `/me/exams`. */
export const GUEST_READABLE_EXACT_PATHS = [
  "/exams",
  "/history",
  "/me/dashboard",
  "/upload",
  // Trang ẩn Maxwell (2026-10-12): không có dữ liệu, không có Server Action —
  // khách có đường link thì xem được, giống mọi trang trong danh sách này.
  "/maxwell",
] as const;

/** `/exams/{id}` — đúng MỘT đoạn sau `/exams/`, id đề là `text` (chữ, số, gạch).
 *  Không phủ `/exams/{id}/attempt|rate|solutions|result`: làm bài, đánh giá,
 *  bài giải vẫn sau đăng nhập. */
const EXAM_DETAIL_PATH = /^\/exams\/[A-Za-z0-9_-]{1,100}$/;

/** Ký tự được phép trong phần query của `next`. Cố ý hẹp: không `/`, `\`, `:`,
 *  `#`, khoảng trắng, ký tự điều khiển — thứ cần gửi (giá trị lọc, số trang) đã
 *  được mã hoá `%xx` sẵn. */
const SAFE_QUERY = /^[A-Za-z0-9_=&%.,+~-]*$/;

const MAX_NEXT_LENGTH = 512;

/** Đích mặc định sau đăng nhập khi không có `next` hợp lệ — hành vi cũ. */
export const DEFAULT_POST_AUTH_PATH = "/exams";

/** Cookie mang `next` qua vòng OAuth (Google/Facebook). Không dùng query của
 *  `redirectTo`: danh sách redirect cho phép của Supabase không đọc được từ
 *  repo, và `?next=/exams` hiện có chỉ chứng minh đúng MỘT giá trị khớp. Cookie
 *  httpOnly, sống ngắn; `/auth/callback` đọc, kiểm lại bằng `safeNextPath`, rồi
 *  xoá. */
export const POST_AUTH_COOKIE = "ms-molar-post-auth";
export const POST_AUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/** `pathname` (không query) có phải trang khách được xem không. */
export function isGuestReadablePath(pathname: string): boolean {
  return (
    (GUEST_READABLE_EXACT_PATHS as readonly string[]).includes(pathname) ||
    EXAM_DETAIL_PATH.test(pathname)
  );
}

/**
 * Chuẩn hoá `next` từ URL/form/cookie. Trả đường dẫn tương đối an toàn, hoặc
 * `null` nếu không hợp lệ — người gọi quyết định đích mặc định.
 *
 * Phần path phải thuộc danh sách trên (nên luôn bắt đầu bằng đúng một `/`, không
 * thể là `//evil.com`, `/\evil.com`, `https://…`, `javascript:…`); phần query
 * chỉ gồm ký tự an toàn. Không bao giờ nhận fragment.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_NEXT_LENGTH) return null;
  const q = raw.indexOf("?");
  const path = q === -1 ? raw : raw.slice(0, q);
  const query = q === -1 ? "" : raw.slice(q + 1);
  if (!isGuestReadablePath(path)) return null;
  if (!SAFE_QUERY.test(query)) return null;
  return raw;
}

/** Đích sau đăng nhập: `next` hợp lệ, hoặc `/exams`. */
export function postAuthPath(raw: string | null | undefined): string {
  return safeNextPath(raw) ?? DEFAULT_POST_AUTH_PATH;
}

/**
 * Liên kết mở form đăng nhập / đăng ký trên trang chủ, kèm `next` để quay lại
 * trang khách đang xem. `next` không hợp lệ bị BỎ (không đưa vào URL), nên
 * không bao giờ dựng ra một liên kết mà trang chủ phải từ chối.
 */
export function authHref(mode: "signin" | "signup", next?: string | null): string {
  const safe = safeNextPath(next);
  return safe ? `/?auth=${mode}&next=${encodeURIComponent(safe)}` : `/?auth=${mode}`;
}
