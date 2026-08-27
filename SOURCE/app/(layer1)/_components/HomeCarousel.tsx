"use client";

// HomeCarousel — băng chuyền giới thiệu nền tảng ở trang chủ (Layer 1).
//
// Ba mục trong cùng MỘT chuỗi: "Giới thiệu" (chính là nhóm nội dung hero đã có
// từ trước, giữ NGUYÊN VĂN), "Có tích hợp AI" và "Hiệu năng vượt trội". Hai mục
// sau là một tiêu đề ngắn + một dòng mô tả.
//
// Điều hướng: TỰ ĐỘNG sau mỗi 7 giây, cộng vuốt ngang trên cảm ứng (useSwipe —
// dùng lại đúng hook của Exam Player).
//
// KHÔNG còn chrome nhìn thấy được ở đầu băng chuyền (engineer chốt 2026-08-21):
// dòng eyebrow in hoa, vạch đồng 40×2 và cụm nút ‹ › ⏸ đã bỏ khỏi CẢ desktop
// lẫn mobile. Hero mở thẳng bằng tiêu đề; ba mục vẫn luân phiên như cũ.
//
// Bốn ràng buộc quanh việc TỰ CHẠY (nội dung ở đây là văn bản cần ĐỌC, nên tự
// đổi mục giữa lúc đang đọc là cách chắc chắn nhất làm người dùng đọc dở):
//  1. Vẫn PHẢI còn cách tạm dừng. WCAG 2.2.2 (Pause, Stop, Hide) áp cho mọi nội
//     dung tự động chuyển động quá 5 giây và nằm song song với nội dung khác —
//     bỏ nút đi thì tiêu chí gãy, chứ không phải bỏ đi là hết trách nhiệm. Nên
//     nút tạm dừng còn nguyên nhưng ẩn khỏi mắt thường và chỉ hiện khi nhận
//     TIÊU ĐIỂM bàn phím, đúng khuôn SkipLink của repo (`sr-only` +
//     `focus:not-sr-only`). KHÔNG dùng `hidden`/`display:none`: thứ đó cắt luôn
//     khỏi thứ tự Tab, tức xoá cơ chế chứ không phải ẩn nó. Nút `absolute` lúc
//     hiện → hiện ra không đẩy bố cục hero đi đâu.
//  2. Tạm dừng khi con trỏ rê lên HOẶC khi tiêu điểm bàn phím đang ở bên trong
//     — hai tín hiệu "người dùng đang đọc/đang thao tác chỗ này".
//  3. Người dùng tự chuyển mục (vuốt) thì DỪNG HẲN. Họ vừa nói rõ muốn xem mục
//     nào; kéo họ đi tiếp sau 7 giây là bỏ qua điều đó.
//  4. Tôn trọng `prefers-reduced-motion: reduce` — không tự chạy.
//
// Ngữ nghĩa ARIA dùng mẫu CAROUSEL (`aria-roledescription="carousel"` + mỗi mục
// là một "slide"), KHÔNG dùng mẫu tabs: không còn dãy nhãn bấm được thì cũng
// không còn `role="tab"` nào để một `role="tablist"` hợp lệ chứa.
//
// Kỹ thuật hiển thị: cả ba mục cùng mount, xếp CHỒNG trong một ô grid rồi đổi
// opacity/translate — giống hệt cách HomeStage swap hero ↔ auth form. Ô grid vì
// thế cao bằng mục CAO NHẤT, nên đổi mục không làm nhảy bố cục. Mục không hoạt
// động mang `inert` (không tab vào, screen reader bỏ qua).

import Image from "next/image";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSwipe } from "@/hooks/useSwipe";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/** Nhịp tự chuyển mục. 7s — đủ đọc một dòng mô tả ngắn mà không phải chờ lâu. */
const AUTOPLAY_MS = 7000;

// Đọc `prefers-reduced-motion` bằng useSyncExternalStore chứ không phải
// useEffect + setState: cách thứ hai sẽ set state ngay trong thân effect
// (`react-hooks/set-state-in-effect`, đúng lỗi mà TD-010 đã đi dọn một lần), và
// còn gây một lượt render thừa ở trạng thái sai ngay sau khi mount.
// Snapshot phía server trả `false` — server không có khái niệm media query.
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/** Ba mục: Giới thiệu · Có tích hợp AI · Hiệu năng vượt trội. */
const SLIDE_COUNT = 3;

export function HomeCarousel() {
  const t = useT();
  const [active, setActive] = useState(0);
  // `playing` = ý muốn của người dùng (nút phát/tạm dừng + việc họ tự chuyển mục).
  // `suspended` = tạm ngưng theo ngữ cảnh (đang rê chuột / đang có tiêu điểm),
  // KHÔNG ghi đè ý muốn — rời chuột ra thì chạy tiếp, còn đã bấm tạm dừng thì
  // rời chuột vẫn đứng yên. Gộp hai thứ này vào một biến sẽ làm "tạm dừng" bị
  // hồi sinh ngoài ý muốn mỗi lần con trỏ đi ngang.
  const [playing, setPlaying] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const autoplayRunning = playing && !suspended && !reducedMotion;

  useEffect(() => {
    if (!autoplayRunning) return;
    const id = setInterval(() => setActive((i) => (i + 1) % SLIDE_COUNT), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplayRunning]);

  // MỌI đường người dùng tự chuyển mục đều đi qua đây → dừng hẳn tự chạy
  // (ràng buộc 3 ở đầu file). Nút phát/tạm dừng KHÔNG gọi hàm này.
  // Vòng lặp ở hai đầu: vuốt tới đâu cũng còn mục kế, không có đầu chết.
  function step(delta: number) {
    setActive((i) => (i + delta + SLIDE_COUNT) % SLIDE_COUNT);
    setPlaying(false);
  }

  const swipe = useSwipe({
    onSwipeLeft: () => step(1),
    onSwipeRight: () => step(-1),
  });

  return (
    // Rê chuột / có tiêu điểm bên trong → tạm ngưng tự chạy (ràng buộc 2).
    // onFocus/onBlur trên container bắt được cả con bên trong vì hai sự kiện
    // này NỔI BỌT trong React (khác `focus` thuần DOM) — không cần focusin.
    <div
      role="group"
      aria-roledescription={t("home.carouselRole")}
      aria-label={t("home.carouselLabel")}
      className="relative w-full"
      onMouseEnter={() => setSuspended(true)}
      onMouseLeave={() => setSuspended(false)}
      onFocus={() => setSuspended(true)}
      onBlur={() => setSuspended(false)}
    >
      {/* Ổ tạm dừng giữ cho WCAG 2.2.2 — ẩn với chuột, hiện khi Tab tới (ràng
          buộc 1 ở đầu file). Ẩn HẲN khi hệ điều hành đã bật giảm chuyển động:
          ở đó băng chuyền vốn không tự chạy, một nút "tạm dừng" cho thứ đang
          đứng yên chỉ gây rối, và trạng thái đó cũng không có tiêu chí nào cần
          thoả. */}
      {!reducedMotion && (
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? t("home.carouselPause") : t("home.carouselPlay")}
          className="bg-background sr-only rounded-sm border-2 border-[color:var(--ring)] text-[#1B1512] focus:not-sr-only focus:absolute focus:top-0 focus:right-0 focus:z-20 focus:flex focus:size-11 focus:items-center focus:justify-center"
        >
          {playing ? (
            <Pause aria-hidden className="size-4" strokeWidth={2} />
          ) : (
            <Play aria-hidden className="size-4" strokeWidth={2} />
          )}
        </button>
      )}

      {/* ---------- Vùng mục ----------
          `overflow-hidden` là BẮT BUỘC, không phải trang trí: mục không hoạt
          động đứng ở `translate-x-4`, tức lệch 16px sang phải và thò ra ngoài
          mép. Thiếu dòng này thì khối <main> (vốn `overflow-y-auto`, nên trục x
          tự động thành `auto` theo spec) trở thành khung CUỘN NGANG — đo được
          scrollWidth 488 / clientWidth 360 ở viewport 360px, tức người dùng kéo
          ngang được cả trang chủ ra một vùng trống.
          Lỗi này KHÔNG hiện ra khi chỉ đo tràn ở cấp trang: <main> nuốt phần
          tràn vào thanh cuộn của chính nó nên `document.scrollWidth` vẫn sạch.
          Phải đo trên chính phần tử cuộn mới thấy. */}
      <div className="grid w-full overflow-hidden" {...swipe}>
        {Array.from({ length: SLIDE_COUNT }, (_, i) => {
          const isActive = i === active;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription={t("home.slideRole")}
              aria-label={t("home.slidePosition", { current: i + 1, total: SLIDE_COUNT })}
              inert={!isActive || undefined}
              className={`col-start-1 row-start-1 w-full self-center transition-all duration-500 ease-out ${
                isActive
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-4 opacity-0"
              }`}
            >
              {i === 0 ? <IntroBody /> : <FeatureBody slideIndex={i} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mục 1 "Giới thiệu" — nhóm nội dung hero vốn có của trang chủ, giữ nguyên. */
function IntroBody() {
  const t = useT();
  return (
    <>
      {/* h1 + logo ngang hàng: h1 giữ max-w-3xl bên trái, logo đẩy sát mép phải
          (ml-auto). flex-wrap để màn hẹp thì logo xuống dòng thay vì bóp méo.
          Logo ẨN dưới 1024px — ở dải đó SiteHeader đã hiện logo rồi, lặp lại
          lần hai trong hero chỉ ăn mất chiều cao vốn đã chật. */}
      <div className="flex flex-wrap items-center gap-6 lg:gap-8">
        <h1 className="max-w-3xl min-w-0 flex-1 basis-64 font-serif text-xl leading-[1.2] font-semibold tracking-tight text-[#1B1512] sm:text-3xl lg:text-4xl">
          {t("home.headline")}
        </h1>
        <Image
          src="/images/brand_logo.png"
          alt=""
          aria-hidden
          width={220}
          height={200}
          className="ml-auto hidden shrink-0 object-contain lg:block"
          style={{ width: "18.5vw", height: "18.5vh" }}
        />
      </div>

      <p className="mt-5 max-w-xl font-sans text-sm leading-[1.7] text-[#1B1512]/80 sm:text-lg">
        {t("home.bodyPart1")}
        <span className="border-b-2 border-[#B8863B] pb-0.5 font-medium text-[#1B1512]">
          {t("home.continuouslyUpdated")}
        </span>
        {t("home.bodyPart2")}
        <span className="border-b-2 border-[#B8863B] pb-0.5 font-medium text-[#1B1512]">
          {t("home.instantGrading")}
        </span>
        {t("home.bodyPart3")}
      </p>

      <GetStarted />
    </>
  );
}

/** Mục 2 và 3 — một tiêu đề ngắn + MỘT dòng mô tả.
 *
 *  Mục 2 (AI) không dùng chung tiêu đề với mục 3 nữa (engineer chốt
 *  2026-08-21): nó tự xưng "AI-powered" và kèm logo Gemini.
 *
 *  Mục 3 nay là "Best performance" (engineer chốt 2026-08-27) — trước đó nó chỉ
 *  in lại tên website, thứ mà SiteHeader và logo hero đã nói rồi. Dòng mô tả của
 *  nó dẫn SỐ ĐO THẬT trên prod chứ không phải khẩu hiệu; nguồn của từng con số
 *  ghi ngay cạnh chuỗi trong `lib/i18n/dictionaries/en.ts`. Đổi kiến trúc làm
 *  chậm site đi thì câu đó thành nói dối — nên nó được coi là một khẳng định
 *  phải bảo trì, không phải chữ trang trí. */
function FeatureBody({ slideIndex }: { slideIndex: number }) {
  const t = useT();
  const isAi = slideIndex === 1;
  const descriptionKey: MessageKey = isAi
    ? "home.aiDescription"
    : "home.performanceDescription";

  return (
    <>
      {/* h2 chứ không phải h1: mỗi trang chỉ được có một h1, và h1 đó thuộc về
          mục "Giới thiệu". */}
      <h2 className="max-w-3xl font-serif text-2xl leading-[1.15] font-semibold tracking-tight text-[#1B1512] sm:text-4xl lg:text-5xl">
        {t(isAi ? "home.aiHeadline" : "home.performanceHeadline")}
      </h2>

      {/* Dòng ghi công Gemini — ngay dưới tiêu đề "AI-powered", vì nó trả lời
          đúng câu hỏi mà tiêu đề vừa đặt ra: AI nào.
          `mt-4` chứ không `mt-5` như đoạn mô tả: đây là phần PHỤ THUỘC tiêu đề,
          bó sát hơn để mắt đọc nó như một dòng của tiêu đề chứ không phải một
          khối mới. */}
      {isAi && (
        <div className="mt-4 flex items-center gap-2.5">
          <span className="font-sans text-xs text-[#1B1512]/60 sm:text-sm">
            {t("home.poweredBy")}
          </span>
          {/* PNG chứ không phải SVG (engineer đổi 2026-08-21): bản SVG mất màu
              khi render — nó dựng hình bằng filter/clip-path của Illustrator và
              trình duyệt trả về một khối đen đặc, mất cả tia sáng gradient. PNG
              nền trong suốt thì đúng màu ở mọi nơi.
              Tệp đã được CẮT SÁT NÉT và hạ về 640px ngang: bản tải về là
              2000×1314 với ~65% diện tích trong suốt, canh lề kiểu đó thì không
              tài nào đặt cạnh một dòng chữ cho thẳng hàng được.
              KHÔNG `unoptimized`: đây là PNG nên optimizer của Next xử lý bình
              thường (nó chỉ từ chối SVG) — ảnh xuống client thành WebP đúng cỡ.
              `alt="Gemini"`: đây là CHỮ, không phải hoa văn — người dùng trình
              đọc màn hình phải nghe được tên, nếu không dòng này chỉ còn
              "Powered by" cụt. */}
          <Image
            src="/images/gemini-logo.png"
            alt="Gemini"
            width={640}
            height={147}
            className="h-5 w-auto sm:h-6"
          />
        </div>
      )}

      <p className="mt-5 max-w-xl font-sans text-sm leading-[1.7] text-[#1B1512]/80 sm:text-lg">
        {t(descriptionKey)}
      </p>

      <GetStarted />
    </>
  );
}

function GetStarted() {
  const t = useT();
  return (
    <div className="mt-8">
      <Link
        href="/exams"
        // KHÔNG prefetch, không phụ thuộc trạng thái đăng nhập — và hai lý do
        // KHÁC NHAU cho hai nhóm người dùng (đo trên preview 2026-08-27):
        //  · KHÁCH: `/exams` nằm sau đăng nhập, nên prefetch nó = một 307 rồi
        //    trình duyệt đi theo redirect sang `/?auth=signin` = một lượt render
        //    server bỏ đi. Cùng thứ lãng phí mà `navPrefetch` đã chặn cho các
        //    thanh điều hướng; nút này KHÔNG đi qua NAV_ITEMS nên nó phải tự
        //    khai (và test quét nguồn ở lib/nav/__tests__ không với tới đây).
        //  · ĐÃ ĐĂNG NHẬP: `/exams` ĐÃ được ba thanh điều hướng trên cùng trang
        //    prefetch rồi (HomeSidebar/SiteHeader/BottomNav) — lượt ở đây chỉ là
        //    bản trùng.
        // Nút này render 3 lần (mỗi slide carousel một lần), nên khoản tiết
        // kiệm cũng nhân ba.
        prefetch={false}
        className="group inline-flex min-h-11 items-center gap-3 rounded-full border-2 border-[#1B1512] px-8 py-3 font-sans text-xs font-medium tracking-[0.16em] text-[#1B1512] uppercase transition-colors hover:border-[#A62C2B] hover:bg-[#A62C2B] hover:text-[#EDE1C8]"
      >
        {t("home.getStarted")}
        <span aria-hidden className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div>
  );
}
