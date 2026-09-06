import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";

// TechStack — khối cạnh tiêu đề trang chủ cho KHÁCH chưa đăng nhập: bốn công
// nghệ website đang chạy trên, và công cụ đã xây dựng nó (engineer 2026-09-05,
// thay hình phiếu trả lời vẽ bằng CSS).
//
// Logo là tài sản thương hiệu của bên thứ ba: dùng ĐÚNG file SVG màu chính thức
// (public/logos/, lấy từ bộ svgl — Groq, Gemini, Supabase, Claude, Next.js),
// không vẽ lại, không đổi màu. Đặt ở public/ và nhúng bằng <img> thay vì inline:
// hai trong năm file khai gradient với id trùng nhau (`paint0_linear`), inline
// cùng một trang là gradient của logo này tô lên logo kia.
//
// HAI BỐ CỤC theo bề rộng (engineer 2026-09-05: một cột tuần tự trên điện
// thoại "trông tầm thường"):
//   - Dưới 640px — "trục": bốn ô vận hành xếp 2×2, mỗi ô có hàng đầu (logo +
//     TÊN cạnh nhau) rồi vai trò xuống dòng dưới trải hết bề ngang ô; Claude
//     Code là một đồng xu trắng nằm ĐÚNG GIAO ĐIỂM của bốn ô, khoét vào bốn góc
//     trong. Vị trí nói thay lời: công cụ xây đứng giữa những thứ nó đã ghép
//     lại. Chú thích tên + vai trò đặt ngay dưới lưới.
//   - Từ 640px — lưới 2 cột, nội dung ngang, ô Claude Code trải hết bề rộng
//     (bố cục desktop engineer đã duyệt, giữ nguyên).
// Một markup cho cả hai: ô Claude Code có hai hiện thân, mỗi lúc chỉ MỘT hiện
// (`hidden`/`sm:hidden` — display:none nên trình đọc màn hình cũng chỉ gặp một).

type Tile = { name: string; logo: string; roleKey: MessageKey };

const RUNTIME: Tile[] = [
  { name: "Next.js", logo: "/logos/nextjs.svg", roleKey: "home.tech.nextjs" },
  { name: "Supabase", logo: "/logos/supabase.svg", roleKey: "home.tech.supabase" },
  { name: "Gemini", logo: "/logos/gemini.svg", roleKey: "home.tech.gemini" },
  { name: "Groq", logo: "/logos/groq.svg", roleKey: "home.tech.groq" },
];

const BUILT_WITH: Tile = {
  name: "Claude Code",
  logo: "/logos/claude.svg",
  roleKey: "home.tech.claude",
};

export function TechStack() {
  return (
    <section aria-labelledby="home-tech" className="flex w-full flex-col gap-3">
      <h2 id="home-tech" className="eyebrow">
        {t("home.tech.title")}
      </h2>

      {/* `relative` để đồng xu Claude Code (mobile) neo vào tâm lưới. Khe lưới
          20px + đồng xu 56px → đè 18px lên mỗi ô ở đúng góc trong. Khe 16px đã
          thử: từ khi tên đứng cạnh logo, hộp logo của hai ô hàng dưới chạm sát
          đồng xu (hở 0,3px — đo 2026-09-05).
          `auto-rows-fr`: hai hàng cao bằng nhau dù vai trò của ô này gãy hai
          dòng còn ô kia một dòng — nếu không, đáy hàng trên lệch đỉnh hàng dưới
          và đồng xu không còn nằm đúng giao điểm. */}
      <div className="relative">
        <ul className="grid auto-rows-fr grid-cols-2 gap-5 sm:gap-3">
          {RUNTIME.map((tile) => (
            <TechTile key={tile.name} tile={tile} />
          ))}
          <TechTile tile={BUILT_WITH} className="hidden sm:col-span-2 sm:flex" />
        </ul>

        {/* Đồng xu (chỉ dưới 640px). Trắng trên nền trắng: phần đè lên khe
            lưới tan vào nền, phần đè lên bốn góc ô hiện thành hình tròn khoét —
            không cần viền hay bóng (theme không dùng). */}
        <span
          aria-hidden
          className="bg-card absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full sm:hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh trong public/ */}
          <img src={BUILT_WITH.logo} alt="" width={28} height={28} className="size-7" />
        </span>
      </div>

      {/* Chú thích của đồng xu (chỉ dưới 640px), căn giữa ngay dưới tâm lưới. */}
      <p className="flex flex-col items-center gap-0.5 text-center sm:hidden">
        <span className="text-foreground text-sm font-semibold">{BUILT_WITH.name}</span>
        <span className="text-muted-foreground text-xs leading-snug">{t(BUILT_WITH.roleKey)}</span>
      </p>
    </section>
  );
}

function TechTile({ tile, className = "" }: { tile: Tile; className?: string }) {
  return (
    // Dưới 640px: hàng đầu (logo + tên) rồi vai trò xuống dòng dưới, dùng hết
    // 124px bề ngang ô thay vì chỉ phần còn lại cạnh logo. Từ 640px: một hàng
    // ngang, tên trên vai trò dưới (bố cục desktop đã duyệt).
    <li
      className={`bg-surface rounded-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${className}`}
    >
      <span className="flex items-center gap-2 sm:contents">
        {/* Hộp trắng cố định để năm logo có tỉ lệ khác nhau vẫn đứng cùng một
            cỡ: 36px trên điện thoại (chừa 80px cho tên — "Supabase" rộng 70px,
            tên dài nhất trong bốn ô, đo 2026-09-05), 44px từ 640px. */}
        <span className="bg-card grid size-9 shrink-0 place-items-center rounded-xl sm:size-11">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh trong public/, không có gì để next/image tối ưu; alt rỗng vì tên thương hiệu đứng ngay cạnh */}
          <img src={tile.logo} alt="" width={24} height={24} className="size-6" />
        </span>
        <span className="text-foreground text-sm font-semibold sm:hidden">{tile.name}</span>
      </span>
      <span className="hidden min-w-0 flex-col sm:flex">
        <span className="text-foreground text-sm font-semibold">{tile.name}</span>
        <span className="text-muted-foreground text-xs leading-snug">{t(tile.roleKey)}</span>
      </span>
      {/* `text-balance`: chia đều hai dòng thay vì để dòng cuối trơ một chữ
          ("Giao diện và máy / chủ"). */}
      <span className="text-muted-foreground text-xs leading-snug text-balance sm:hidden">
        {t(tile.roleKey)}
      </span>
    </li>
  );
}
