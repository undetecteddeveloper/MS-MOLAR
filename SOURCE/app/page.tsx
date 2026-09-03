import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AboutPrompt } from "@/features/auth/components/AboutPrompt";
import { HomeSidebar } from "@/features/auth/components/HomeSidebar";
import { HomeStage, type AuthMode } from "@/features/auth/components/HomeStage";
import { BottomNav } from "@/components/layout/BottomNav";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/shared/SkipLink";
import { SupportWidget } from "@/components/support/SupportWidget";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { getLocale } from "@/lib/i18n/server";
import { buildHomeJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";

// Homepage (Layer 1 — Entry). Bố cục theo template Hyperspace (HTML5 UP):
// sidebar nav dọc bên trái + content area bên phải. Theme "Mực & Sơn mài"
// (globals.css): sidebar đen sơn mài #1B1512 · content nền ngà #EDE1C8.
//
// S#17: content area có HAI trạng thái — hero và form auth — swap bằng
// transition ngay trong trang (không tách page /login riêng). URL sync qua
// `?auth=signin|signup` để deep-link và middleware redirect hoạt động;
// logic swap nằm trong HomeStage (client). Toàn bộ nội dung tiếng Anh.
export default async function Home({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  // Fetch user cho ô account đáy sidebar (avatar + tên). Đọc cookie auth mỗi
  // request → `/` là dynamic (ƒ), đánh đổi hợp lý cho cá nhân hoá.
  const [{ auth }, user, locale, requestHeaders] = await Promise.all([
    searchParams,
    getCurrentUserProfile(),
    getLocale(),
    headers(),
  ]);

  const authMode: AuthMode = auth === "signup" ? "signup" : auth === "signin" ? "signin" : null;

  // Đã đăng nhập mà mở form auth → vào thẳng /exams (parity với /login cũ).
  if (user && authMode) redirect("/exams");

  // Nonce CSP của lượt request này, do proxy.ts sinh và middleware đặt lên
  // header REQUEST (`x-nonce`). Bắt buộc phải gắn tay: Next chỉ tự gắn nonce
  // vào script của CHÍNH nó, không đụng tới thẻ <script> ta tự viết — mà
  // `script-src` ở production KHÔNG còn 'unsafe-inline' (lib/security/csp.ts),
  // nên khối JSON-LD thiếu nonce sẽ bị trình duyệt chặn thẳng. Chặn không làm
  // hỏng trang (nó không phải JS chạy được), nó chỉ âm thầm vô hiệu hoá đúng
  // thứ vừa thêm — kiểu hỏng không ai thấy cho tới khi soi Search Console.
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    // h-dvh + overflow-hidden: trang KHÔNG cuộn (S#17 vòng sửa 1) — toàn bộ
    // homepage nằm gọn trong viewport. Content area tự cuộn NỘI BỘ
    // (overflow-y-auto) chỉ khi màn quá thấp, để không bị cắt nội dung.
    <div className="flex h-dvh flex-col overflow-hidden bg-[#1B1512] lg:flex-row">
      {/* Structured data — xem lib/seo/jsonLd.ts cho lý do và phạm vi. Nội dung
          là hằng số do chính repo sinh (không có dữ liệu người dùng), và đã đi
          qua serializeJsonLd() để không thể cắt được thẻ script. */}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHomeJsonLd(locale)) }}
      />
      <SkipLink />

      {/* Dưới 1024px: dùng CÙNG hệ điều hướng với phần còn lại của site
          (SiteHeader mảnh + BottomNav) thay vì sidebar riêng của trang chủ.
          Đo trước thay đổi này ở 360×800: sidebar xếp dọc thành một dải trên
          cùng cao 296px — 37% chiều cao màn hình dành cho điều hướng, đẩy CTA
          chính xuống y=827 nằm ngoài khung cuộn nội bộ cao 504px, tức người
          dùng không thấy nút "Bắt đầu" mà cũng không có dấu hiệu nào bảo rằng
          còn nội dung bên dưới.
          Đây cũng là lần dọn một hệ điều hướng THỨ HAI: trước đây trang chủ và
          các layer khác có hai bộ nav riêng phải "đồng bộ 100%" bằng tay. */}
      <div className="lg:hidden">
        <SiteHeader user={user} />
      </div>
      <HomeSidebar user={user} authOpen={authMode !== null} />

      {/* preload order 1 — content area fade sau sidebar (S#21).
          id + tabIndex={-1} = đích nhảy của SkipLink (WCAG 2.4.1) — homepage
          dùng thẳng <main> làm đích vì nó không có wrapper riêng như các layer.
          pb-bottom-nav: main là khung CUỘN ở đây (không phải body), nên đệm đáy
          phải nằm trên chính nó — đặt ở tổ tiên sẽ không có tác dụng. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="preload-fade pb-bottom-nav relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#EDE1C8] px-6 py-8 sm:px-12 lg:px-16 lg:py-10"
        style={{ "--preload-order": 1 } as React.CSSProperties}
      >
        <HeroLines />
        {/* HomeStage có my-auto → tự căn giữa dọc khi content thấp hơn khung. */}
        <HomeStage auth={authMode} />

        {/* Lối vào /about — mép TRÁI-DƯỚI của content area, ở mọi bề rộng
            (engineer chốt 2026-08-17). Đặt trong <main> chứ không phải trong
            sidebar: sidebar là cột điều hướng và nó biến mất hẳn dưới 1024px,
            nên một liên kết sống ở đó sẽ không tồn tại với người dùng di động —
            đúng nhóm đông nhất của dự án.
            `relative z-10`: HeroLines là SVG absolute nên nếu không nâng khối
            này lên cùng tầng với HomeStage thì nó nằm dưới hoa văn.
            KHÔNG có `mt-*`: `my-auto` của HomeStage đã ăn hết khoảng trống dọc
            và tự đẩy khối này xuống đáy khung cuộn.
            `md:pb-8 lg:pb-10` bù lại đúng phần `py-*` của <main> mà quy tắc
            `.pb-bottom-nav` ép về 0 từ 768px (globals.css) — quy tắc đó viết
            cho khoảng hở dưới thanh điều hướng đáy, và ở dải không có thanh đó
            nó ghi đè luôn cả padding đáy thường. Trước khối này chưa ai thấy:
            HomeStage `my-auto` không bao giờ chạm tới đáy. Đo được 2026-08-17:
            thiếu hai class này thì liên kết dính sát mép dưới màn hình (bottom
            = 900/900). */}
        <div className="relative z-10 md:pb-8 lg:pb-10">
          <AboutPrompt />
        </div>
      </main>

      <BottomNav signedIn={Boolean(user)} />
      <SupportWidget user={user} />
    </div>
  );
}

// Hoa văn đường kẻ hình học mờ trên nền content area (tái hiện texture của
// template). Hairline phẳng (không gradient/bóng), màu đen sơn mài opacity
// thấp — đúng tinh thần "flat + hairline" của globals.css. vector-effect giữ nét
// 1px dù SVG bị kéo giãn không đồng đều (preserveAspectRatio=none).
//
// Trôi chậm (2026-08-09, engineer yêu cầu làm "lưới không gian" sau tiêu đề
// sống động hơn, cả desktop lẫn mobile): mỗi đường tự animate qua
// `.hero-line-drift` (keyframes + reduced-motion guard ở globals.css) —
// THUẦN CSS, không JS, nên chạy y hệt trên Server Component này không cần
// "use client". Biên độ animate tính theo % toạ độ viewBox (0 0 100 100) nên
// tự co giãn theo mọi kích cỡ màn hình, không cần giá trị riêng cho
// desktop/mobile. `--hero-line-duration`/`--hero-line-delay` lệch dần theo
// index (delay ÂM để mỗi đường vào ngay giữa chu kỳ thay vì cùng xuất phát
// từ 0%) — 6 đường trôi lệch pha nhau, không đồng bộ như một khối cứng.
/** Hệ số NHANH LÊN của nhịp trôi (engineer 2026-08-21: "nhanh hơn ~15%").
 *  CHIA cho hệ số này chứ không nhân: "nhanh hơn 15%" nói về TỐC ĐỘ, mà tốc độ
 *  tỉ lệ NGHỊCH với thời lượng — nhân 0.85 sẽ ra nhanh hơn 17.6%, không phải 15%.
 *  Chu kỳ vì thế đi từ 22–37s xuống 19.1–32.2s. */
const DRIFT_SPEEDUP = 1.15;

function HeroLines() {
  const lines = [
    [0, 18, 100, 2],
    [0, 55, 100, 30],
    [20, 0, 80, 100],
    [60, 0, 100, 70],
    [0, 90, 70, 100],
    [0, 100, 100, 45],
  ];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#1B1512"
          strokeOpacity="0.08"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          className="hero-line-drift"
          style={
            {
              "--hero-line-duration": `${((22 + i * 3) / DRIFT_SPEEDUP).toFixed(2)}s`,
              // Trễ ÂM giữ nguyên −4s mỗi đường: việc của nó chỉ là đẩy mỗi
              // đường vào một pha khác nhau, và sáu chu kỳ vốn đã dài ngắn
              // khác nhau nên chúng tự trôi rời nhau — không cần co theo.
              "--hero-line-delay": `${-i * 4}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </svg>
  );
}
