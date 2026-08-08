import { redirect } from "next/navigation";
import { HomeSidebar } from "@/app/(layer1)/_components/HomeSidebar";
import { HomeStage, type AuthMode } from "@/app/(layer1)/_components/HomeStage";
import { BottomNav } from "@/components/layout/BottomNav";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/shared/SkipLink";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";

// Homepage (Layer 1 — Entry). Bố cục theo template Hyperspace (HTML5 UP):
// sidebar nav dọc bên trái + content area bên phải. Theme "Mực & Sơn mài"
// (DESIGN.md): sidebar đen sơn mài #1B1512 · content nền ngà #EDE1C8.
//
// S#17: content area có HAI trạng thái — hero và form auth — swap bằng
// transition ngay trong trang (không tách page /login riêng). URL sync qua
// `?auth=signin|signup` để deep-link và middleware redirect hoạt động;
// logic swap nằm trong HomeStage (client). Toàn bộ nội dung tiếng Anh.
export default async function Home({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  // Fetch user cho ô account đáy sidebar (avatar + tên). Đọc cookie auth mỗi
  // request → `/` là dynamic (ƒ), đánh đổi hợp lý cho cá nhân hoá.
  const [{ auth }, user] = await Promise.all([searchParams, getCurrentUserProfile()]);

  const authMode: AuthMode = auth === "signup" ? "signup" : auth === "signin" ? "signin" : null;

  // Đã đăng nhập mà mở form auth → vào thẳng /exams (parity với /login cũ).
  if (user && authMode) redirect("/exams");

  return (
    // h-dvh + overflow-hidden: trang KHÔNG cuộn (S#17 vòng sửa 1) — toàn bộ
    // homepage nằm gọn trong viewport. Content area tự cuộn NỘI BỘ
    // (overflow-y-auto) chỉ khi màn quá thấp, để không bị cắt nội dung.
    <div className="flex h-dvh flex-col overflow-hidden bg-[#1B1512] lg:flex-row">
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
      </main>

      <BottomNav />
    </div>
  );
}

// Hoa văn đường kẻ hình học mờ trên nền content area (tái hiện texture của
// template). Hairline phẳng (không gradient/bóng), màu đen sơn mài opacity
// thấp — đúng tinh thần "flat + hairline" của DESIGN.md. vector-effect giữ nét
// 1px dù SVG bị kéo giãn không đồng đều (preserveAspectRatio=none).
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
        />
      ))}
    </svg>
  );
}
