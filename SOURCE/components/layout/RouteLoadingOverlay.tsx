"use client";

// RouteLoadingOverlay — lớp phủ "Loading" đè lên TRANG ĐANG ĐỨNG trong lúc
// chuyển sang trang khác. Mount một lần ở app/layout.tsx nên phủ mọi route.
//
// Vì sao không dùng `useLinkStatus` (next/link): hook đó chỉ chạy được bên
// TRONG cây con của một <Link> cụ thể, tức muốn phủ toàn màn hình thì phải sửa
// từng <Link> trong repo và mỗi <Link> mới thêm sau này lại là một chỗ quên.
// Ở đây bắt sự kiện click ở tầng document, một chỗ duy nhất, không đụng call
// site nào.
//
// Nghe ở pha CAPTURE, không phải bubble: `<Link>` gọi `preventDefault()` rồi tự
// điều hướng, nên tới lượt pha bubble thì mọi cú bấm nội bộ đều đã "bị huỷ" —
// xem khối chú thích trong lib/nav/pageNavigation.ts, đó là bản ghi của một lần
// đã làm sai và đo ra.
//
// Vì sao KHÔNG có `useEffect` nào set state: trạng thái hiện/ẩn là giá trị DẪN
// XUẤT lúc render (`pendingAt === locationKey`), đúng cách SuccessToast đã làm
// khi trả TD-010 — set state trong thân effect vừa bị `react-hooks/
// set-state-in-effect` chặn, vừa thêm một lượt render thừa vào đúng khoảnh
// khắc trình duyệt đang bận điều hướng. Khi URL mới commit, khoá vị trí đổi ⇒
// biểu thức tự thành false, không cần ai đi tắt nó.
//
// Khoá vị trí là pathname + QUERY, không phải pathname trơn. Đường làm lộ ra:
// khách chưa đăng nhập bấm "Exams" → middleware đá về `/?auth=signin`. Người
// dùng xuất phát từ `/` và cũng kết thúc ở `/`, nên nếu chỉ so pathname thì lớp
// phủ không có cách nào biết là đã tới nơi và sẽ đứng đó cho tới khi hết hẹn
// giờ chặn trên. Redirect về chính path cũ là chuyện thường của guard đăng nhập,
// không phải ca hiếm.
//
// BA đường tắt, vì "không bao giờ tắt được" là kiểu hỏng tệ nhất mà một lớp
// phủ toàn màn hình có thể mắc:
//   1. URL mới commit — đường thường.
//   2. popstate / pageshow — nút Back/Forward và bfcache không đi qua click
//      handler nào, và bfcache còn khôi phục nguyên trạng thái DOM cũ.
//   3. Hẹn giờ chặn trên — người dùng bấm Stop, mạng chết giữa chừng: không có
//      route nào commit, cũng không có sự kiện nào bắn. Sau ngần này mili giây
//      thì trả màn hình lại cho người dùng, thà mất chỉ báo còn hơn khoá cứng.
//
// Lớp phủ LUÔN nằm trong DOM (ẩn bằng `visibility`), CỐ Ý: không phải dựng cây
// DOM vào đúng khoảnh khắc trình duyệt đang bận điều hướng. Phần fade-in trễ
// 180ms (globals.css) làm nốt việc còn lại: điều hướng đã prefetch xong chạy
// nhanh hơn ngần đó sẽ không nháy gì lên màn hình cả.
//
// Theme "Sân trường" (2026-09-11): chỉ báo chờ là BA CHẤM nhấp nhô, vẽ bằng
// token màu, không còn ảnh nào. Bản trước quay `brand_logo.png` — 497KB, và
// hình trong đó là khối "PAGS" vàng viền đỏ, không phải mốc thương hiệu của
// MS-MOLAR (ô logo trên header đang để trống chờ logo mới). Một chỉ báo "đang
// tải" phải chờ tải nửa MB ảnh là tự mâu thuẫn, nhất là trên Android tầm trung
// và mạng yếu — nhóm người dùng chính (PROJECT_OVERVIEW §1).

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/copy";
import {
  isNavigationGuarded,
  onPageNavigationIndicatorStart,
  startsPageNavigation,
} from "@/lib/nav/pageNavigation";

/** Trần thời gian giữ lớp phủ khi không có tín hiệu kết thúc nào (xem §3). */
const SAFETY_TIMEOUT_MS = 12_000;

/** Chuỗi nhận dạng "đang ở đâu". Chuẩn hoá qua URLSearchParams để bản dựng từ
 *  `window.location` và bản dựng từ hook của Next không lệch nhau vì thứ tự
 *  tham số hay dấu `?` thừa. */
function locationKey(pathname: string, search: string): string {
  return `${pathname}?${new URLSearchParams(search)}`;
}

export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // URL người dùng ĐANG đứng lúc bấm. Còn khớp URL hiện tại nghĩa là lượt điều
  // hướng chưa tới nơi ⇒ vẫn đang chờ.
  const [pendingAt, setPendingAt] = useState<string | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending = pendingAt !== null && pendingAt === locationKey(pathname, `${searchParams}`);

  useEffect(() => {
    function clear() {
      if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
      setPendingAt(null);
    }

    /** Bật lớp phủ cho URL đang đứng, kèm hẹn giờ chặn trên (§3 đầu file). */
    function showOverlay() {
      clear();
      setPendingAt(locationKey(window.location.pathname, window.location.search));
      safetyTimer.current = setTimeout(() => {
        safetyTimer.current = null;
        setPendingAt(null);
      }, SAFETY_TIMEOUT_MS);
    }

    function onClick(event: MouseEvent) {
      // Có ai đó đang chặn mọi cú bấm rời trang (màn làm bài — useLeaveGuard)?
      // Thì cú bấm này không đi đâu cả, và lớp phủ phải im. Hỏi ĐỒNG BỘ ngay
      // đầu handler, KHÔNG hoãn: xem khối CHỐT ĐIỀU HƯỚNG trong
      // lib/nav/pageNavigation.ts — bản hoãn bằng queueMicrotask đã được thử
      // và nó sai với đúng thứ duy nhất đáng quan tâm, cú chạm thật.
      if (isNavigationGuarded()) return;

      // `closest` chứ không phải `event.target` trực tiếp: bấm vào chữ hay icon
      // bên trong <a> thì target là node con, phải leo lên mới thấy thẻ neo.
      // `instanceof HTMLAnchorElement` loại thẻ <a> của SVG — cùng selector
      // nhưng `.href` của nó là SVGAnimatedString, không phải chuỗi.
      const start = event.target;
      const anchor = start instanceof Element ? start.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const navigates = startsPageNavigation({
        // `.href` là bản đã resolve tuyệt đối; `getAttribute("href")` thì không.
        href: anchor.href,
        target: anchor.target,
        hasDownload: anchor.hasAttribute("download"),
        currentUrl: window.location.href,
        button: event.button,
        modifierKey: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      });
      if (!navigates) return;

      showOverlay();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clear);
    window.addEventListener("pageshow", clear);
    // Điều hướng bằng `router.push()` không có cú bấm nào để bắt — bên gọi tự
    // báo (useLeaveGuard khi người dùng xác nhận "Rời trang").
    const unsubscribe = onPageNavigationIndicatorStart(showOverlay);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clear);
      window.removeEventListener("pageshow", clear);
      unsubscribe();
      if (safetyTimer.current !== null) clearTimeout(safetyTimer.current);
    };
  }, []);

  const label = t("common.loading");

  return (
    <>
      {/* Phần NHÌN THẤY — aria-hidden vì vùng thông báo thật là khối sr-only
          bên dưới; để cả hai cùng đọc được thì trình đọc màn hình phát hai
          lần cùng một chữ. */}
      <div
        aria-hidden
        data-pending={pending ? "true" : "false"}
        // Nền surface 94%: đủ đục để ba chấm và chữ tách khỏi tiêu đề trang bên
        // dưới, vẫn còn thấy được trang cũ mờ mờ — đây là lớp phủ chờ, nếu che
        // kín 100% thì nó thành một trang trắng và người dùng mất mốc "mình vẫn
        // đang ở đâu đó". Xanh nhạt chứ không trắng: trang nền đã là trắng, một
        // lớp trắng phủ lên trắng thì không có ranh giới nào để mắt bắt vào —
        // đúng cách theme này phân lớp, bằng NỀN TÔ chứ không bằng viền.
        // KHÔNG dùng backdrop-blur: máy Android tầm trung (nhóm người dùng
        // chính, PROJECT_OVERVIEW §1) trả giá thật cho nó, đúng vào lúc thiết bị
        // đang bận điều hướng.
        className="route-loading bg-surface/94 pointer-events-none fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5"
      >
        {/* `items-end`: ba chấm nhấp nhô LÊN, nên mép dưới là đường chuẩn đứng
            yên để mắt đọc ra biên độ. `--motion-i` là số thứ tự chấm, globals.css
            nhân ra độ trễ — cùng khuôn với thanh biểu đồ ở Thống kê. */}
        <div className="flex items-end gap-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="route-loading-dot bg-primary size-3 rounded-full"
              style={{ "--motion-i": i } as React.CSSProperties}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
      </div>

      {/* aria-live chỉ được đọc khi NỘI DUNG đổi, không phải khi phần tử hiện
          ra — nên vùng này luôn mounted và chuỗi bên trong bật/tắt theo
          `pending` (cùng lý do đã ghi ở components/ui/SuccessToast.tsx). */}
      <div role="status" aria-live="polite" className="sr-only">
        {pending ? label : ""}
      </div>
    </>
  );
}
