// Quy tắc "cú bấm này có thật sự rời khỏi TRANG hiện tại không".
//
// Tách khỏi component (components/layout/RouteLoadingOverlay.tsx) vì đây là
// phần DUY NHẤT có thể sai âm thầm: một điều kiện lọt lưới không làm crash,
// nó chỉ khiến lớp phủ "Loading" bật lên rồi treo ở đó mãi — trên một cú bấm
// vốn dĩ chẳng điều hướng đi đâu, nên không có route mới nào commit để tắt nó.
// Hàm thuần ⇒ kiểm được từng nhánh mà không cần dựng DOM.
//
// KHÔNG so `href` nguyên chuỗi mà so `pathname`: đổi query hoặc hash là ở lại
// CÙNG một trang. Trang chủ là ví dụ sống — `/?auth=signin` chỉ swap hai panel
// trong HomeStage bằng CSS transition, không có lượt render route nào; bật lớp
// phủ ở đó vừa sai nghĩa vừa không bao giờ tắt được.

export type NavIntent = {
  /** `href` đã resolve về URL tuyệt đối; `null` khi thẻ <a> không có href. */
  href: string | null;
  /** Thuộc tính `target` của thẻ <a> (chuỗi rỗng nếu không khai). */
  target: string | null;
  /** Thẻ <a> có `download` — trình duyệt tải file, KHÔNG rời trang. */
  hasDownload: boolean;
  /** URL tuyệt đối của trang đang đứng. */
  currentUrl: string;
  /** `MouseEvent.button` — chỉ nút trái mới điều hướng trong tab hiện tại. */
  button: number;
  /** Ctrl/Meta/Shift/Alt — mở tab mới, cửa sổ mới, hoặc tải xuống. */
  modifierKey: boolean;
};

// CỐ Ý KHÔNG có `defaultPrevented` trong bộ lọc này, dù nó là điều kiện đầu
// tiên ai cũng nghĩ tới. Đo được trên trình duyệt thật 2026-08-17: `<Link>` của
// Next gọi `preventDefault()` cho MỌI điều hướng nội bộ — nó phải chặn hành vi
// mặc định thì mới tự làm soft navigation được. Nghĩa là cờ đó không phân biệt
// "cú bấm đã bị huỷ" với "Next đang xử lý cú bấm", và kiểm nó chính là tự tay
// tắt lớp phủ ở đúng 100% số <Link> trong repo (triệu chứng lúc đó: bấm tag nào
// cũng chuyển trang bình thường mà không có gì hiện lên).
//
// Hệ quả phải chấp nhận: một thẻ <a href> chỉ dùng làm nút JS (có href thật,
// handler tự huỷ) sẽ bật lớp phủ nhầm. Đúng trường hợp đó ĐÃ tồn tại — xem
// `markPageNavigationBlocked` bên dưới — nên nó không còn là giả định nữa.

// ============================================================================
// Cú bấm điều hướng BỊ HUỶ bởi một interceptor khác
// ============================================================================
// `useLeaveGuard` (màn làm bài) cũng nghe `click` trên `document` ở pha CAPTURE
// và `preventDefault()` mọi liên kết nội bộ để hỏi xác nhận trước khi rời trang.
// Hai interceptor cùng node, cùng pha ⇒ thứ tự chạy do thứ tự ĐĂNG KÝ quyết
// định, mà thứ tự đó lại do thứ tự mount của cây React quyết định (effect của
// con chạy trước effect của cha) — không có gì để dựa vào.
//
// Đo được 2026-08-21 ở 390×844: chạm ô "Đề thi" trong khi đang làm bài thì lớp
// phủ "LOADING" (z-90) bật lên ĐÈ LÊN hộp thoại xác nhận rời trang (z-50) và
// đứng đó tới hết hẹn giờ 12 giây — vì lượt điều hướng bị huỷ nên không có
// route nào commit để tắt nó. Người dùng nhìn thấy màn hình "đang tải" cho một
// thứ sẽ không bao giờ tải.
//
// `defaultPrevented` không dùng được (lý do ngay phía trên), nên bên huỷ phải
// NÓI RA. WeakSet chứ không phải gắn thuộc tính lên event: không đụng vào object
// của trình duyệt, không cần ép kiểu, và entry tự biến mất cùng event.
const blockedClicks = new WeakSet<Event>();

/** Bên chặn gọi ngay sau `preventDefault()`: "cú bấm này KHÔNG đi đâu cả". */
export function markPageNavigationBlocked(event: Event): void {
  blockedClicks.add(event);
}

/** Bên hiển thị hỏi lại — nhưng phải hỏi ở CUỐI lượt dispatch (queueMicrotask),
 *  không phải ngay trong handler: nếu bên chặn chạy sau thì lúc đó nó chưa kịp
 *  đánh dấu. Microtask chạy sau khi cả lượt dispatch kết thúc nên đúng ở cả hai
 *  thứ tự. */
export function isPageNavigationBlocked(event: Event): boolean {
  return blockedClicks.has(event);
}

// ============================================================================
// Điều hướng KHÔNG đi qua cú bấm nào
// ============================================================================
// Lớp phủ chỉ biết tới điều hướng bắt đầu từ một thẻ <a>. Nhưng `useLeaveGuard`
// khi người dùng bấm "Rời trang" lại đi bằng `router.push()` — không có cú bấm
// nào để bắt, nên nếu không có kênh này thì chính lượt điều hướng THẬT (lượt
// duy nhất người dùng đã xác nhận) là lượt duy nhất không có chỉ báo chờ.
type IndicatorListener = () => void;
const indicatorListeners = new Set<IndicatorListener>();

/** Gọi ngay trước một `router.push()` thủ công để lớp phủ chờ bật lên. */
export function startPageNavigationIndicator(): void {
  for (const listener of indicatorListeners) listener();
}

/** Lớp phủ đăng ký nhận tín hiệu trên. Trả hàm huỷ đăng ký. */
export function onPageNavigationIndicatorStart(listener: IndicatorListener): () => void {
  indicatorListeners.add(listener);
  return () => indicatorListeners.delete(listener);
}

/** `true` khi cú bấm sẽ đưa người dùng sang một PATH khác trong cùng site. */
export function startsPageNavigation(intent: NavIntent): boolean {
  if (intent.button !== 0 || intent.modifierKey) return false;
  if (intent.hasDownload) return false;
  if (intent.target && intent.target !== "_self") return false;
  if (!intent.href) return false;

  let target: URL;
  let current: URL;
  try {
    current = new URL(intent.currentUrl);
    target = new URL(intent.href, intent.currentUrl);
  } catch {
    return false;
  }

  // Ngoại site (kể cả `mailto:`/`tel:` — origin của chúng là "null") thì trang
  // hiện tại bị THAY THẾ hoàn toàn hoặc không đổi gì; cả hai đều không phải
  // lượt điều hướng mà lớp phủ này canh.
  if (target.origin !== current.origin) return false;

  return target.pathname !== current.pathname;
}
