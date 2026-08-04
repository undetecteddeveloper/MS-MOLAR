import type { Metadata, Viewport } from "next";
import { Geist_Mono, Source_Serif_4, Be_Vietnam_Pro } from "next/font/google";
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
  // Site chỉ có duy nhất `/` là public; phần còn lại nằm sau đăng nhập nên
  // không có gì để index. Chi tiết per-path nằm ở app/robots.ts.
  alternates: { canonical: "/" },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${sourceSerif.variable} ${beVietnamPro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
