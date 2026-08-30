"use client";

// EssayGradingPoller — trang tự làm mới trong lúc band đang đáp xuống
// (UI Spec § Component: EssayGradingPoller, AC-021/AC-023/AC-061).
//
// ═══ `setTimeout` NỐI CHUỖI, KHÔNG PHẢI `setInterval` ═══
//
// `setInterval` GỘP TICK khi tab bị đẩy xuống nền, nên lúc học sinh quay lại
// tab, trình duyệt bắn ra một CHÙM `router.refresh()` — hành vi đắt nhất có
// thể trên đúng thiết bị mục tiêu (Android tầm trung, mạng chập chờn). Chuỗi
// `setTimeout` chỉ hẹn lượt kế tiếp SAU KHI lượt này xong, nên không có gì để
// gộp. Lập luận này mượn nguyên từ `ExamTimer`.
//
// ═══ VÌ SAO `router.refresh()` VÀ KHÔNG GÌ KHÁC ═══
//
// Nó là cơ chế DUY NHẤT phía client với tới được một Server Component. Một
// `fetch()` phía client đòi một route mới (AC-022 cấm), còn vá state tại chỗ
// tạo ra một NGUỒN SỰ THẬT THỨ HAI cho band — thứ mà cả tính năng này tồn tại
// để tránh.
//
// ═══ HAI TRẦN ĐỘC LẬP, VÀ MỐC NEO CỦA CÁI THỨ HAI ═══
//
// `ESSAY_POLL_MAX_ELAPSED_MS` KHÔNG suy từ mục tiêu độ trễ. Nó bằng
// `ESSAY_PASS_BUDGET_MS` — trần đồng hồ của chính lượt chấm — vì SAU MỐC ĐÓ
// KHÔNG BAND NÀO CÒN CÓ THỂ ĐÁP XUỐNG TỪ PASS ẤY, nên mọi lượt refresh tiếp
// theo là CHẮC CHẮN vô ích. Đó là một mệnh đề KIỂM ĐƯỢC về phía người ghi,
// không phải một ước lượng về độ trễ — và nó là thứ giữ cho trạng thái dừng là
// một NGOẠI LỆ chứ không phải kết cục mặc định.
//
// Một lệch nhỏ được ghi: đồng hồ của poller bắt đầu lúc MOUNT, đồng hồ của pass
// bắt đầu lúc SUBMIT, nên poller dừng muộn hơn vài giây — đúng chiều an toàn.
//
// Bốn hằng này KHÔNG phải hạn chờ đọc-lúc-render và KHÔNG suy ra từ nó
// (AC-061): hạn chờ ấy neo vào trần thời lượng của nền tảng.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Nhịp nhanh cho một phút đầu. */
export const ESSAY_POLL_FAST_INTERVAL_MS = 5_000;
/** 12 × 5 s = 60 s đầu. KHÔNG phải vì 60 s là mục tiêu độ trễ (mục tiêu nay là
 *  ≤ 3 phút, OQ-7) mà vì ở `GROQ_MAX_CONCURRENCY = 2`, những câu ĐẦU TIÊN đáp
 *  xuống sớm — nhịp nhanh phục vụ đúng khoảng đó. */
export const ESSAY_POLL_FAST_TICKS = 12;
export const ESSAY_POLL_SLOW_INTERVAL_MS = 10_000;
/** Trần thứ nhất: đếm SỐ LƯỢT refresh. */
export const ESSAY_POLL_MAX_REFRESHES = 30;
/** Trần thứ hai: đồng hồ treo tường, neo vào `ESSAY_PASS_BUDGET_MS`. Xem đầu file. */
export const ESSAY_POLL_MAX_ELAPSED_MS = 240_000;

/** FE-AC-12 — CHỈ `digest`, không bao giờ `err`.
 *
 *  Cùng quy tắc mà `EssayRegradeControl:96-102` đã dựng: thông điệp lỗi băng
 *  qua biên máy chủ có thể vọng lại chính bài làm của học sinh, và
 *  `Error#message` KHÔNG enumerable nên một lượt rò kiểu đó không lộ ra dưới
 *  `JSON.stringify` — nó chỉ lộ ra ở console thật, tức là muộn.
 *
 *  Và KHÔNG trả về gì để render: một lượt refresh hỏng là chuyện hạ tầng, không
 *  phải thứ học sinh làm được gì với nó. Hiện nó ra chỉ đổi một lỗi vô hình
 *  thành một lỗi đáng sợ. */
function logRefreshThrew(err: unknown) {
  console.error("[EssayGradingPoller] router.refresh() threw", {
    digest: (err as { digest?: string } | null)?.digest,
  });
}

export function EssayGradingPoller({
  pendingCount,
  gradedCount,
}: {
  pendingCount: number;
  gradedCount: number;
}) {
  const t = useT();
  const router = useRouter();
  const [stopped, setStopped] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const refreshes = useRef(0);
  /** `0` = chưa đặt. KHÔNG khởi tạo bằng `Date.now()` ở đây: thân `useRef(...)`
   *  chạy TRONG lượt render, và một hàm không thuần ở đó cho kết quả trôi nổi
   *  mỗi lần component tình cờ render lại (`react-hooks/purity`). Đồng hồ được
   *  đặt ở lượt effect đầu tiên — tức lúc mount, đúng mốc neo đã ghi ở đầu file. */
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBudgets = useCallback(() => {
    refreshes.current = 0;
    startedAt.current = Date.now();
    setStopped(false);
  }, []);

  useEffect(() => {
    if (stopped) return;
    if (startedAt.current === 0) startedAt.current = Date.now();

    function schedule() {
      const interval =
        refreshes.current < ESSAY_POLL_FAST_TICKS
          ? ESSAY_POLL_FAST_INTERVAL_MS
          : ESSAY_POLL_SLOW_INTERVAL_MS;

      timer.current = setTimeout(() => {
        // HAI trần độc lập. Đồng hồ treo tường được kiểm KỂ CẢ khi tab đang ẩn
        // — một tab ẩn không tốn ngân sách refresh, nhưng thời gian vẫn trôi và
        // pass chấm vẫn hết giờ đúng lúc nó hết giờ.
        if (
          refreshes.current >= ESSAY_POLL_MAX_REFRESHES ||
          Date.now() - startedAt.current >= ESSAY_POLL_MAX_ELAPSED_MS
        ) {
          setStopped(true);
          return;
        }

        // Tick lúc tab ẩn: BỎ QUA và KHÔNG tốn ngân sách. Làm mới một trang
        // không ai đang nhìn là trả tiền pin và dữ liệu cho không.
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          schedule();
          return;
        }

        refreshes.current += 1;

        // ═══ FE-AC-12 — MỘT CÚ NÉM KHÔNG ĐƯỢC PHÉP GIẾT CHUỖI POLL ═══
        //
        // `schedule()` nằm NGOÀI `try`, và đó là toàn bộ điểm của khối này:
        // trước đây `router.refresh()` gọi trần, nên một cú ném ĐỒNG BỘ nhảy
        // thẳng qua `schedule()` và poller CHẾT VĨNH VIỄN VÀ IM LẶNG —
        // `stopped` không bao giờ được đặt, nên học sinh mất CẢ trang tự cập
        // nhật LẪN câu `pollStopped` kèm nút làm mới thủ công. Đó là ca duy
        // nhất mà cơ chế dự phòng của chính tính năng cũng bị gỡ mất, tức là
        // ca tệ nhất chứ không phải ca hiếm nhất.
        //
        // Lượt hỏng VẪN TIÊU một suất trong trần 30 — cố ý. Không tiêu thì một
        // `router.refresh()` ném liên tục quay vô hạn, mỗi 5–10 giây, trên
        // đúng thiết bị yếu nhất. Tiêu suất nghĩa là 30 cú ném liên tiếp chạm
        // trần và poller dừng ĐÚNG ĐƯỜNG đã có sẵn: `pollStopped` cộng một nút
        // thủ công. Xuống thang thành thứ học sinh bấm được, không phải thành
        // im lặng.
        try {
          router.refresh();
        } catch (err) {
          logRefreshThrew(err);
        }
        schedule();
      }, interval);
    }

    schedule();
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [router, stopped]);

  // ═══ VÙNG `aria-live` RỖNG Ở LƯỢT RENDER ĐẦU, NHẬN CHỮ SAU (AB-7) ═══
  //
  // Một vùng ĐÃ CÓ SẴN CHỮ lúc nó vào DOM có thể không được đọc lên. Ở lượt
  // mount, học sinh vừa tới trang và đã đọc được mọi thứ trên đó; thứ đáng
  // thông báo là những gì ĐỔI sau đó. Và một lượt refresh KHÔNG giải quyết
  // được gì thì để nguyên chữ cũ — phát lại ở mọi nhịp là đúng khuyết tật
  // AC-023 nhìn từ phía kia (trình đọc màn hình cắt lời ở từng lượt poll).
  //
  // Điều chỉnh state NGAY TRONG LƯỢT RENDER khi prop đổi — đúng pattern React
  // chính thức mà `HistoryRowMenu` đã ghi tên: KHÔNG dùng effect, vì
  // `setState` đồng bộ trong thân effect gây render dây chuyền
  // (`react-hooks/set-state-in-effect`).
  const [seen, setSeen] = useState<{ pending: number; graded: number } | null>(null);
  if (seen === null) {
    // Lượt đầu: chỉ GHI NHỚ, không thông báo gì — vùng ở lại rỗng.
    setSeen({ pending: pendingCount, graded: gradedCount });
  } else if (seen.pending !== pendingCount || seen.graded !== gradedCount) {
    setSeen({ pending: pendingCount, graded: gradedCount });
    setAnnouncement(
      pendingCount === 0
        ? t("result.essay.announceAllDone")
        : t("result.essay.announceProgress", {
            done: String(gradedCount),
            pending: String(pendingCount),
          })
    );
  }

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {stopped && (
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <span>{t("result.essay.pollStopped")}</span>
          {/* Một <button> THẬT, không phải một liên kết giả: nó làm một việc
              trên trang này chứ không điều hướng đi đâu. Nó nạp lại CẢ HAI ngân
              sách, nếu không thì lần bấm thứ hai sẽ dừng lại ngay lập tức. */}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              // `resetBudgets()` chạy TRƯỚC, nên chuỗi poll khởi động lại kể cả
              // khi chính lượt refresh này ném — nút không tự biến mình thành
              // một cú bấm chết. Không `schedule()` ở đây: việc đó thuộc về
              // effect, thứ mà `setStopped(false)` bên trong `resetBudgets()`
              // vừa đánh thức (FE-AC-12).
              resetBudgets();
              try {
                router.refresh();
              } catch (err) {
                logRefreshThrew(err);
              }
            }}
          >
            {t("result.essay.pollRefresh")}
          </Button>
        </div>
      )}
    </div>
  );
}
