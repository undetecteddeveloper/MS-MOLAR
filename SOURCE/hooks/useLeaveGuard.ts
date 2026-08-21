// useLeaveGuard — cảnh báo rời trang khi đang làm bài (S#28 Q3, Layer 2).
// Hai tầng chặn khi `active`:
//  1. Click <a> nội bộ (thẻ nav navbar, Link bất kỳ): interceptor ở document
//     CAPTURE PHASE — chạy TRƯỚC onClick của next/link → preventDefault chặn
//     soft-navigation, lưu href lại và để UI hiện modal tuỳ biến (Hủy/Rời).
//     Không cần sửa SiteHeader/HeaderProfile — bắt ở tầng document.
//  2. Refresh / đóng tab: beforeunload — browser CHỈ cho hiện prompt mặc định
//     của hệ thống (Web API không cho tuỳ biến nội dung — giới hạn nền tảng).
// Khi user xác nhận rời: điều hướng tới href đã chặn qua router.push (không
// phải click <a> nên không bị chính interceptor chặn lại).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  markPageNavigationBlocked,
  startPageNavigationIndicator,
} from "@/lib/nav/pageNavigation";

export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  /** href nội bộ user vừa bấm và bị chặn — null = không có modal nào mở. */
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome cũ yêu cầu returnValue để kích hoạt prompt.
      e.returnValue = "";
    }

    function onClickCapture(e: MouseEvent) {
      // Tôn trọng hành vi mở tab mới / click phụ — không chặn.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(anchor.href, window.location.href);
      // Link ngoài site → full unload, đã có beforeunload lo.
      if (url.origin !== window.location.origin) return;
      // Cùng trang (vd link neo) → không phải "rời trang".
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      // `stopPropagation` KHÔNG chặn được các listener khác trên CÙNG node
      // (đó là việc của `stopImmediatePropagation`), mà RouteLoadingOverlay
      // cũng nghe click ở `document` pha capture. Không nói ra thì nó bật lớp
      // phủ "LOADING" toàn màn hình cho một lượt điều hướng vừa bị huỷ, đè lên
      // chính hộp thoại đang hỏi — và đứng đó hết 12 giây hẹn giờ vì chẳng có
      // route nào commit để tắt. Dùng `stopImmediatePropagation` thay cho dòng
      // này KHÔNG giải quyết được: nếu listener của lớp phủ đăng ký trước thì
      // nó đã chạy xong rồi.
      markPageNavigationBlocked(e);
      setPendingHref(url.pathname + url.search);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [active]);

  const cancelLeave = useCallback(() => setPendingHref(null), []);

  const confirmLeave = useCallback(() => {
    if (pendingHref) {
      // Lượt điều hướng THẬT bắt đầu ở đây, và nó không đi qua cú bấm <a> nào
      // nên lớp phủ chờ không tự thấy. Báo tay — nếu không thì đúng lượt người
      // dùng vừa xác nhận lại là lượt duy nhất bấm xong không có phản hồi gì.
      startPageNavigationIndicator();
      router.push(pendingHref);
    }
    setPendingHref(null);
  }, [pendingHref, router]);

  return { pendingHref, cancelLeave, confirmLeave };
}
