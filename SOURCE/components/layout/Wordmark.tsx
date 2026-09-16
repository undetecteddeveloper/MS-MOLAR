import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

// Wordmark — mốc thương hiệu ở đầu mọi trang: LOGO + chữ "MS-MOLAR".
//
// Logo là con quạ đội mũ tốt nghiệp ngậm bút chì (product owner gửi
// 2026-09-16, thay ô nét đứt 32×32 đã chừa sẵn từ 2026-09-04). File nguồn
// 2048×2048 được cắt lề trong suốt rồi thu về 128×128 (`public/images/
// ms-molar-logo.png`, 9 KB) — gấp 4 lần cỡ hiển thị nên sắc trên màn 2×/3×,
// mà không chở 260 KB của bản gốc. `priority`: dưới 1024px đây là ảnh đầu tiên
// trong viewport (LCP, perf audit 2026-08-15). `alt=""`: liên kết đã có
// aria-label, trình đọc màn hình không cần đọc tên ảnh lần nữa.
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
      <Image
        src="/images/ms-molar-logo.png"
        alt=""
        width={32}
        height={32}
        priority
        data-slot="logo-slot"
        className="size-8 shrink-0"
      />
      <span className="text-foreground text-base font-bold tracking-[0.01em]">MS-MOLAR</span>
    </Link>
  );
}
