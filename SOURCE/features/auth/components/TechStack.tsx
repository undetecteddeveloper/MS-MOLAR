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
// Bố cục: lưới 2 cột cho bốn công nghệ vận hành, ô thứ năm (Claude Code) trải
// hết bề rộng — vì nó KHÁC LOẠI: là công cụ xây, không phải thứ website chạy
// trên. Cấu trúc nói điều đó thay cho một nhãn "Xây dựng bằng".

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
      {/* Một cột dưới 640px: ở 360px hai cột chỉ còn ~150px mỗi ô, dòng vai
          trò gãy thành ba dòng và tên "Supabase" tự xuống hàng (đo 2026-09-05). */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {RUNTIME.map((tile) => (
          <TechTile key={tile.name} tile={tile} />
        ))}
        <TechTile tile={BUILT_WITH} className="sm:col-span-2" />
      </ul>
    </section>
  );
}

function TechTile({ tile, className = "" }: { tile: Tile; className?: string }) {
  return (
    <li className={`bg-surface rounded-card flex items-center gap-3 p-3 sm:p-4 ${className}`}>
      {/* Hộp trắng cố định 44px để năm logo có tỉ lệ khác nhau vẫn đứng cùng
          một cỡ; logo 24px bên trong. */}
      <span className="bg-card grid size-11 shrink-0 place-items-center rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh trong public/, không có gì để next/image tối ưu; alt rỗng vì tên thương hiệu đứng ngay cạnh */}
        <img src={tile.logo} alt="" width={24} height={24} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-semibold">{tile.name}</span>
        <span className="text-muted-foreground text-xs leading-snug">{t(tile.roleKey)}</span>
      </span>
    </li>
  );
}
