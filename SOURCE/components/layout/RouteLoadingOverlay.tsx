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
// Lớp phủ LUÔN nằm trong DOM (ẩn bằng `visibility`), CỐ Ý: ảnh logo vì thế
// được tải xong từ lúc trang load: nếu chỉ mount lúc bấm thì chỉ báo "đang
// tải" của ta lại phải chờ tải một tấm ảnh — đúng thứ nó sinh ra để che.
// Phần fade-in trễ 180ms (globals.css) làm nốt việc còn lại: điều hướng đã
// prefetch xong chạy nhanh hơn ngần đó sẽ không nháy gì lên màn hình cả.

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { startsPageNavigation } from "@/lib/nav/pageNavigation";

/** Trần thời gian giữ lớp phủ khi không có tín hiệu kết thúc nào (xem §3). */
const SAFETY_TIMEOUT_MS = 12_000;

/** Chuỗi nhận dạng "đang ở đâu". Chuẩn hoá qua URLSearchParams để bản dựng từ
 *  `window.location` và bản dựng từ hook của Next không lệch nhau vì thứ tự
 *  tham số hay dấu `?` thừa. */
function locationKey(pathname: string, search: string): string {
  return `${pathname}?${new URLSearchParams(search)}`;
}

export function RouteLoadingOverlay() {
  const t = useT();
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

    function onClick(event: MouseEvent) {
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

      clear();
      setPendingAt(locationKey(window.location.pathname, window.location.search));
      safetyTimer.current = setTimeout(() => {
        safetyTimer.current = null;
        setPendingAt(null);
      }, SAFETY_TIMEOUT_MS);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", clear);
    window.addEventListener("pageshow", clear);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", clear);
      window.removeEventListener("pageshow", clear);
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
        // Nền ngà 94%: đủ đục để chữ "LOADING" và logo tách khỏi tiêu đề trang
        // bên dưới, vẫn còn thấy được trang cũ mờ mờ — đây là lớp phủ chờ, nếu
        // che kín 100% thì nó thành một trang trắng và người dùng mất mốc "mình
        // vẫn đang ở đâu đó". KHÔNG dùng backdrop-blur: máy Android tầm trung
        // (nhóm người dùng chính, PROJECT_OVERVIEW §1) trả giá thật cho nó,
        // đúng vào lúc thiết bị đang bận điều hướng.
        className="route-loading pointer-events-none fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-[#EDE1C8]/94"
      >
        {/* width/height = tỉ lệ gốc 715×650 ở mật độ 2× của cỡ hiển thị 72px,
            để logo không rỗ trên màn hình retina. Cỡ THẬT do class quyết. */}
        <Image
          src="/images/brand_logo.png"
          alt=""
          width={158}
          height={144}
          className="route-loading-mark h-[72px] w-auto"
        />
        <p className="font-sans text-xs font-medium tracking-[0.2em] text-[#1B1512]/70 uppercase">
          {label}
        </p>
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
