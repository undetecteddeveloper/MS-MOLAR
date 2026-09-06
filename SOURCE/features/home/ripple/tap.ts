// Phân loại cú chạm trên nền trang chủ (thuần DOM, test được bằng jsdom).
// Sóng chỉ nổi khi người dùng CHẠM VÀO KHOẢNG TRẮNG — engineer 2026-09-06:
// chạm vào chữ hay bất kỳ khối giao diện nào (thẻ, nút, thanh) thì không.

/** Phần tử tương tác: chạm vào đây là một hành động, không phải chạm nền. */
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(", ");

/** Phần tử là hình: chạm vào là chạm vào nội dung dù nền trong suốt. */
const MEDIA_SELECTOR = "svg, img, picture, video, canvas";

const TRANSPARENT = new Set(["rgba(0, 0, 0, 0)", "transparent", ""]);

/**
 * "Khoảng trắng" = mục tiêu chạm không tương tác, không phải hình, KHÔNG có
 * chữ trực tiếp bên trong, và từ nó dò ngược lên tới `root` (không tính root)
 * không gặp phần tử nào có nền tô. Root là khối có nền trắng của trang — nền
 * đó chính là "mặt nước", không phải vật che.
 */
export function isBackgroundTarget(target: EventTarget | null, root: Element): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(INTERACTIVE_SELECTOR) !== null) return false;
  if (target.closest(MEDIA_SELECTOR) !== null) return false;
  if (hasOwnText(target)) return false;

  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el === document.body || el === document.documentElement) break;
    const cs = getComputedStyle(el);
    if (!TRANSPARENT.has(cs.backgroundColor) || cs.backgroundImage !== "none") return false;
  }
  return true;
}

function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "") return true;
  }
  return false;
}

export type PointerPoint = { id: number; x: number; y: number; time: number };

/** Ngưỡng dịch chuyển (px) và thời gian (ms) để còn coi là "chạm" chứ không
 *  phải kéo/giữ. Cuộn bằng ngón tay thường phát pointercancel nên không tới
 *  đây, nhưng vuốt ngắn bằng chuột hoặc bút thì có. */
export const TAP_MAX_MOVE = 10;
export const TAP_MAX_MS = 600;

export function isTap(down: PointerPoint | null, up: PointerPoint): boolean {
  if (!down || down.id !== up.id) return false;
  if (up.time - down.time > TAP_MAX_MS) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE;
}
