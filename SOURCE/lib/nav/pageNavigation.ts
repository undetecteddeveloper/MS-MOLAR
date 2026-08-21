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
// handler tự huỷ) sẽ bật lớp phủ nhầm. Repo hiện không có thẻ nào như vậy, và
// lớp phủ `pointer-events-none` + hẹn giờ chặn trên nên trường hợp đó là phiền
// mắt trong vài giây, không phải khoá người dùng lại.

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
