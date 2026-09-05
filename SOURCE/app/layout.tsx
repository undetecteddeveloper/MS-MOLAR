import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RouteLoadingOverlay } from "@/components/layout/RouteLoadingOverlay";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

// Theme "Sân trường" (globals.css, 2026-09-04): MỘT họ chữ duy nhất — Lexend,
// có đủ dấu tiếng Việt, 4 độ đậm. Ba font của theme cũ (Source Serif 4, Be
// Vietnam Pro, Geist Mono) đã gỡ: bớt 8 file font trên Android tầm trung, và
// số trong đồng hồ/điểm dùng `tabular-nums` của chính Lexend thay cho mono.
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const DESCRIPTION =
  "Nền tảng luyện đề trực tuyến cho học sinh THCS và THPT. Làm đề thật có đồng hồ, chấm điểm tức thì và xem mình còn yếu chỗ nào.";

export const metadata: Metadata = {
  // metadataBase biến mọi đường dẫn tương đối bên dưới (og:image, canonical)
  // thành URL tuyệt đối. Thiếu nó thì Next.js cảnh báo lúc build và crawler
  // nhận về path trần — mất hẳn ảnh preview khi chia sẻ link.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MS-MOLAR – Luyện đề trực tuyến",
    // Trang con chỉ cần khai `title: "Lịch sử"` là ra "Lịch sử · MS-MOLAR".
    template: "%s · MS-MOLAR",
  },
  description: DESCRIPTION,
  applicationName: "MS-MOLAR",
  // Ba trang public: `/`, `/terms`, `/about`. Phần còn lại nằm sau đăng nhập
  // nên không có gì để index. Chi tiết per-path ở app/robots.ts và
  // app/sitemap.ts.
  //
  // `canonical: "/"` ở ĐÂY là canonical MẶC ĐỊNH của root layout, không phải
  // lời khẳng định rằng chỉ có một trang public. Trang nào cần canonical riêng
  // thì tự khai `alternates` trong `export const metadata` của chính nó.
  alternates: { canonical: "/" },
  // Verify quyền sở hữu site trong Google Search Console bằng thẻ meta.
  //
  // Đây là bước CHẶN của mọi việc SEO còn lại (SEO-TODO.md § "Việc cần làm"):
  // chưa verify thì không submit được sitemap, không "Request Indexing" được,
  // và phải ngồi chờ Google tình cờ bò vào. Bản thân token là thứ NGƯỜI phải
  // lấy từ tài khoản Search Console, nên chỗ này chỉ dựng sẵn đường dẫn: đặt
  // `GOOGLE_SITE_VERIFICATION` trên Vercel là thẻ tự xuất hiện, không phải sửa
  // code + deploy lại. Không đặt → không render thẻ nào (Next bỏ qua undefined),
  // không phải một thẻ rỗng làm Google báo verify hỏng.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  openGraph: {
    type: "website",
    siteName: "MS-MOLAR",
    title: "MS-MOLAR – Luyện đề trực tuyến",
    description: DESCRIPTION,
    url: "/",
    locale: "vi_VN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MS-MOLAR – luyện đề trực tuyến",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MS-MOLAR – Luyện đề trực tuyến",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

// Màu thanh địa chỉ trên mobile — trắng, khớp navbar.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  // `viewport-fit=cover` — BẮT BUỘC để `env(safe-area-inset-*)` trả giá trị
  // thật. Thiếu nó thì mọi safe-area inset luôn bằng 0 và thanh điều hướng đáy
  // (BottomNav) sẽ nằm lọt dưới thanh Home ảo của iPhone: người dùng thấy nút
  // nhưng bấm không trúng. Đây là kiểu hỏng IM LẶNG — không lỗi, không cảnh
  // báo, chỉ là các ô cuối cùng không phản hồi trên đúng những thiết bị có
  // notch/home indicator.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang` PHẢI khớp ngôn ngữ đang hiển thị (WCAG 3.1.1 Language of Page).
  // Site chỉ còn tiếng Việt từ 2026-09-04 (module i18n hai ngôn ngữ đã gỡ),
  // nên "vi" là hằng số: trình đọc màn hình chọn đúng bộ tổng hợp giọng, và
  // trình dịch tự động của trình duyệt không mời dịch một trang tiếng Việt.
  return (
    <html
      lang="vi"
      className={`${lexend.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Lớp phủ "Loading" lúc chuyển trang nằm ở root layout — layout của
            từng route group sẽ remount theo route, tức là chính lúc cần nó
            nhất thì nó biến mất.

            <Suspense> là bắt buộc vì component đọc `useSearchParams()`: trên
            một route được prerender tĩnh, Next bắt cả cây phải rơi về render
            phía client nếu không có ranh giới này — và đặt ở root layout thì
            "cả cây" nghĩa là toàn bộ trang. Hiện KHÔNG route nào của dự án là
            tĩnh (`next build` in ƒ cho tất cả), nên ranh giới này chưa đổi gì
            hôm nay; nó ở đây để cái ngày ai đó làm một trang tĩnh không kéo
            theo một cú hồi quy hiệu năng không ai nối được về nguyên nhân. */}
        {children}
        <Suspense fallback={null}>
          <RouteLoadingOverlay />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
