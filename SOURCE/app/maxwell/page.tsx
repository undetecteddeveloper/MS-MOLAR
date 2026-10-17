import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { MaxwellBackButton } from "@/features/maxwell/components/MaxwellBackButton";
import { MaxwellStage } from "@/features/maxwell/components/MaxwellStage";
import { MAXWELL_CREDIT } from "@/features/maxwell/credit";
import { t } from "@/lib/copy";

// Trang ẩn Maxwell the Cat (2026-10-12, brief
// docs/plans/20261012-feature-maxwell-easter-egg.md). Nằm NGOÀI mọi route group
// nên không có SiteHeader / BottomNav: nền đen, một nút mũi tên, mô hình, tiêu đề.
//
// Bố cục (2026-10-17): canvas phủ CẢ trang, sàn dưới bục kéo tới mép dưới và tiêu
// đề đè lên sàn — trước đó canvas và chữ là hai vùng ngăn bởi một đường cắt ngang
// trông không ổn. Tên + tác giả mô hình nay in trên mặt cong của bục (trong cảnh
// 3D, features/maxwell/scene); ở đây chỉ còn dòng link nguồn + giấy phép vì CC BY
// 4.0 bắt buộc có link, mà chữ in trong canvas thì không bấm được.
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

// `pointer-events-auto`: lớp chữ của MaxwellStage để cú nhấn xuyên xuống nút đá,
// link phải tự bật lại để bấm được.
const CREDIT_LINK =
  "pointer-events-auto inline-flex min-h-11 items-center rounded-md px-1.5 underline underline-offset-4 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none";

// BẮT BUỘC render động: CSP của site (proxy.ts) chỉ cho script có nonce, mà Next chỉ gắn
// nonce vào script của trang dựng THEO TỪNG REQUEST. Trang này từng là tĩnh (○ ở bảng
// route của build) nên 17/17 thẻ script không có nonce → trình duyệt chặn script inline
// mang dữ liệu RSC → React #412 "Connection closed" → trang không hydrate: cảnh kẹt
// "Đang gọi Maxwell…", nút quay lại chết. Chỉ xảy ra khi TẢI THẲNG trang (F5, mở link);
// mở qua ô tìm đề thì chạy vì lúc đó dữ liệu đi bằng fetch. Dev không bao giờ lộ lỗi
// này (CSP dev cho 'unsafe-inline'). Xem docs "Forcing dynamic rendering" của Next.
export default async function MaxwellPage() {
  await connection();
  return (
    <main className="relative min-h-dvh bg-black text-white">
      {/* Tránh tai thỏ / viền cong; luôn cách mép ít nhất 12px. */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-20">
        <MaxwellBackButton />
      </div>

      <MaxwellStage className="min-h-dvh">
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <h1 className="motion-rainbow-text mx-auto max-w-[22ch] text-3xl leading-tight font-bold text-balance sm:max-w-none sm:text-4xl lg:text-5xl">
            {t("maxwell.title")}
          </h1>

          {/* Tên + tác giả đã ở trên bục; bản chữ cho trình đọc màn hình (canvas không đọc được). */}
          <p className="sr-only">
            {t("maxwell.creditLead")} {MAXWELL_CREDIT.title} {t("maxwell.creditBy")}{" "}
            {MAXWELL_CREDIT.author}
          </p>

          <p
            data-testid="maxwell-credit"
            className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-xs text-white/70 sm:text-sm"
          >
            <a
              href={MAXWELL_CREDIT.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK}
            >
              {t("maxwell.creditSource")}
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
          </p>
        </div>
      </MaxwellStage>
    </main>
  );
}
