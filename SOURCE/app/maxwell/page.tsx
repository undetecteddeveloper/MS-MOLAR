import type { Metadata, Viewport } from "next";
import { MaxwellBackButton } from "@/features/maxwell/components/MaxwellBackButton";
import { MaxwellStage } from "@/features/maxwell/components/MaxwellStage";
import { MAXWELL_CREDIT } from "@/features/maxwell/credit";
import { t } from "@/lib/copy";

// Trang ẩn Maxwell the Cat (2026-10-12, brief
// docs/plans/20261012-feature-maxwell-easter-egg.md). Nằm NGOÀI mọi route group
// nên không có SiteHeader / BottomNav: nền đen, một nút mũi tên, mô hình, tiêu đề.
//
// Không vào robots.txt (file đó công khai — liệt kê ở đó là chỉ đường cho người
// tò mò) và không vào sitemap; `noindex` ở đây là cách duy nhất báo crawler.
export const metadata: Metadata = {
  title: "Maxwell",
  robots: { index: false, follow: false },
  alternates: { canonical: "/maxwell" },
};

// Thanh địa chỉ trên điện thoại cùng màu nền đen của trang; `viewportFit` phải
// khai lại vì `viewport` của trang thay thế khối của root layout.
export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

const CREDIT_LINK =
  "inline-flex min-h-11 items-center rounded-md px-1.5 underline underline-offset-4 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none";

export default function MaxwellPage() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-black text-white">
      {/* Tránh tai thỏ / viền cong; luôn cách mép ít nhất 12px. */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-10">
        <MaxwellBackButton />
      </div>

      <MaxwellStage className="min-h-[44dvh] flex-1" />

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
        <h1 className="motion-rainbow-text mx-auto max-w-[22ch] text-3xl leading-tight font-bold text-balance sm:max-w-none sm:text-4xl lg:text-5xl">
          {t("maxwell.title")}
        </h1>

        {/* Hai nhóm chữ: hẹp thì xếp hai dòng "Mô hình 3D … / của … · CC BY 4.0",
            không bao giờ đứt giữa một nhóm (chữ "của" mồ côi cuối dòng). */}
        <p
          data-testid="maxwell-credit"
          className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-xs text-white/70 sm:text-sm"
        >
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
            <span>{t("maxwell.creditLead")}</span>
            <a
              href={MAXWELL_CREDIT.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK}
            >
              {MAXWELL_CREDIT.title}
            </a>
          </span>
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
            <span>{t("maxwell.creditBy")}</span>
            <a
              href={MAXWELL_CREDIT.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK}
            >
              {MAXWELL_CREDIT.author}
            </a>
            <span aria-hidden>·</span>
            <a
              href={MAXWELL_CREDIT.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK}
            >
              {MAXWELL_CREDIT.licenseName}
            </a>
          </span>
        </p>
      </div>
    </main>
  );
}
