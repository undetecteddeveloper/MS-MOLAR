import type { Metadata, Viewport } from "next";
import { Geist_Mono, Source_Serif_4, Be_Vietnam_Pro } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

// Font theo DESIGN.md ("Mực & Sơn mài") — đồng bộ TOÀN site (S#17):
// Source Serif 4 cho display/h1/h2/quote (--font-serif/--font-heading),
// Be Vietnam Pro cho body/label-caps (--font-sans). Geist Mono giữ cho
// --font-mono (timer MM:SS, nhãn chữ cái A/B/C/D). Merriweather + Geist Sans
// đã gỡ khỏi bundle (TTF Merriweather vẫn nằm trong ASSETS/fonts).
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "vietnamese"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const DESCRIPTION =
  "Online exam practice platform for secondary and high school students in Vietnam. Practise real exams, get scored instantly, and track your progress.";

export const metadata: Metadata = {
  // metadataBase biến mọi đường dẫn tương đối bên dưới (og:image, canonical)
  // thành URL tuyệt đối. Thiếu nó thì Next.js cảnh báo lúc build và crawler
  // nhận về path trần — mất hẳn ảnh preview khi chia sẻ link.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MS-MOLAR — Practise exams online",
    // Trang con chỉ cần khai `title: "History"` là ra "History · MS-MOLAR".
    template: "%s · MS-MOLAR",
  },
  description: DESCRIPTION,
  applicationName: "MS-MOLAR",
  // Ba trang public: `/`, `/terms`, `/refund-policy` (hai trang sau do tính
  // năng Subscription thêm — PRD R11). Phần còn lại nằm sau đăng nhập nên không
  // có gì để index. Chi tiết per-path ở app/robots.ts và app/sitemap.ts.
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
    title: "MS-MOLAR — Practise exams online",
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MS-MOLAR — practise exams online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MS-MOLAR — Practise exams online",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

// Màu thanh địa chỉ trên mobile — đen sơn mài, khớp sidebar homepage.
export const viewport: Viewport = {
  themeColor: "#1B1512",
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
  // Trước đây hard-code "en" — khi người dùng chọn tiếng Việt, trình đọc màn
  // hình vẫn phát âm bằng bộ tổng hợp giọng Anh, ra thứ tiếng Việt gần như
  // không nghe hiểu được. Trình dịch tự động của trình duyệt cũng đọc thuộc
  // tính này để quyết định có mời dịch trang hay không.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistMono.variable} ${sourceSerif.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
