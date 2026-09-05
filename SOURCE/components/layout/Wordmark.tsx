import Link from "next/link";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

// Wordmark — mốc thương hiệu ở đầu mọi trang: Ô LOGO TRỐNG + chữ "MS-MOLAR".
//
// Ô logo cố ý để trống (engineer 2026-09-04: sẽ thay logo mới sau). Nó giữ
// đúng kích thước 32×32 để khi ảnh về, bố cục header không xê dịch. Khi có
// logo: thay <span> nét đứt bằng <Image priority> 32×32 — nhớ `priority` vì
// dưới 1024px đây là ảnh đầu tiên trong viewport (LCP, perf audit 2026-08-15).
//
// `min-h-11`: sàn 44px cho vùng chạm — chữ 16px chỉ cao ~22px.
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={t("nav.home")}
      className={cn(
        "focus-visible:ring-ring -ml-1 inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-1 focus-visible:ring-3 focus-visible:outline-none",
        className
      )}
    >
      <span
        aria-hidden
        data-slot="logo-slot"
        className="border-border size-8 shrink-0 rounded-lg border-[1.5px] border-dashed"
      />
      <span className="text-foreground text-base font-bold tracking-[0.01em]">MS-MOLAR</span>
    </Link>
  );
}
