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
// handler tự huỷ) sẽ bật lớp phủ nhầm. Đúng trường hợp đó ĐÃ tồn tại — màn làm
// bài — nên nó không còn là giả định nữa. Xem khối CHỐT ĐIỀU HƯỚNG bên dưới.

// ============================================================================
// CHỐT ĐIỀU HƯỚNG — khi có ai đó đang chặn mọi cú bấm rời trang
// ============================================================================
// `useLeaveGuard` (màn làm bài) nghe `click` trên `document` ở pha CAPTURE và
// `preventDefault()` MỌI liên kết nội bộ để hỏi xác nhận trước khi rời trang.
// Trong lúc nó còn sống, KHÔNG cú bấm liên kết nào thật sự đi đâu cả — nên lớp
// phủ "đang tải" không được bật cho bất kỳ cú nào trong số đó.
//
// ⚠ ĐỌC TRƯỚC KHI ĐỔI CƠ CHẾ NÀY — đây là bản ghi của một lần đã sửa SAI ⚠
//
// Bản sửa đầu (2026-08-21, sáng): đánh dấu từng EVENT bị huỷ vào một WeakSet,
// rồi bên lớp phủ hoãn quyết định bằng `queueMicrotask` để "chờ bên kia kịp
// đánh dấu". Nó KHÔNG chạy, và nó qua được cả test lẫn lượt kiểm thủ công —
// đó mới là phần đáng nhớ:
//
//   - Sự kiện do TRÌNH DUYỆT phát (người dùng chạm thật): sau MỖI listener,
//     stack JS rỗng ⇒ trình duyệt chạy một microtask checkpoint NGAY TẠI ĐÓ.
//     Microtask của lớp phủ vì thế chạy TRƯỚC listener thứ hai, tức trước khi
//     bên huỷ kịp đánh dấu. Đo được:
//         ["microtask saw marked=false", "guard marked"]
//   - Sự kiện do SCRIPT phát (`element.click()`): dispatch nằm TRONG một lượt
//     gọi JS nên stack chưa rỗng ⇒ không có checkpoint nào giữa chừng, cả hai
//     listener chạy xong rồi microtask mới chạy. Đo được:
//         ["guard marked", "microtask saw marked=true"]
//     jsdom cũng cư xử đúng kiểu này.
//
//   ⇒ Một bug CHỈ tồn tại với cú chạm thật, mà cả unit test (jsdom) lẫn lượt
//     xác minh bằng `element.click()` đều báo xanh. Muốn kiểm lại lớp này thì
//     phải dùng cú bấm THẬT của trình duyệt (Playwright `locator.click()`),
//     đừng dùng `element.click()`.
//
// Nên cơ chế nay KHÔNG dựa vào thứ tự hay thời điểm gì hết: bên chặn giữ một
// CHỐT suốt thời gian nó còn sống, bên lớp phủ hỏi chốt đó ĐỒNG BỘ ngay đầu
// handler. Thứ tự hai listener chạy ra sao cũng cho cùng một kết quả.
//
// Đếm chứ không phải cờ boolean: hai màn làm bài không bao giờ cùng mount,
// nhưng một cái đếm thì đúng cả khi StrictMode gắn/tháo effect hai lần, còn
// một cờ boolean sẽ bị lượt tháo thứ nhất tắt mất trong khi lượt gắn thứ hai
// vẫn đang cần nó.
let navigationGuards = 0;

/** Bên chặn giữ chốt suốt thời gian nó chặn. Trả hàm nhả — gọi trong cleanup
 *  của effect. Hàm nhả tự chống gọi trùng, nên StrictMode không làm âm bộ đếm. */
export function acquireNavigationGuard(): () => void {
  navigationGuards += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    navigationGuards -= 1;
  };
}

/** `true` khi đang có ai đó chặn mọi cú bấm rời trang ⇒ lớp phủ phải im. */
export function isNavigationGuarded(): boolean {
  return navigationGuards > 0;
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
