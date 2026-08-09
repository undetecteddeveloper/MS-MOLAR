// Structured data (JSON-LD, schema.org) cho trang chủ.
//
// Vì sao có file này: mục tiêu SEO đang theo đuổi là TÌM-THEO-TÊN-THƯƠNG-HIỆU —
// gõ "MS-MOLAR" trên Google phải ra site này — chứ không phải đua từ khoá chung
// (xem SEO-TODO.md). Với bài toán đó, thứ Google thiếu không phải là nhiều
// trang hơn mà là một khẳng định máy-đọc-được rằng "MS-MOLAR" là TÊN của một
// tổ chức/website, kèm các biến thể cách viết mà người dùng thật sẽ gõ. Thẻ
// `<title>`/`og:*` chỉ nói được một chuỗi hiển thị; JSON-LD nói được quan hệ
// (Organization ← publisher ← WebSite) và `alternateName`.
//
// Chỉ trang `/` có khối này, vì chỉ `/` được phép index (app/robots.ts) — mọi
// route khác nằm sau đăng nhập, crawler vào chỉ nhận redirect.
//
// CỐ Ý KHÔNG khai `WebSite.potentialAction` (sitelinks search box): Google đã
// khai tử tính năng đó cuối 2024, và site cũng không có endpoint tìm kiếm công
// khai để trỏ tới — khai một action dẫn tới trang đòi đăng nhập là tự tạo dữ
// liệu sai.

import type { Locale } from "@/lib/i18n/locales";
import { SITE_URL } from "@/lib/siteUrl";

/** Cách viết tên thương hiệu mà người dùng thật sẽ gõ vào ô tìm kiếm. Google
 *  không tự suy ra "MS MOLAR" (cách nhau bằng dấu cách) từ "MS-MOLAR". */
const ALTERNATE_NAMES = ["MS MOLAR", "MSMOLAR", "MS-Molar"];

const DESCRIPTION: Record<Locale, string> = {
  en: "Online exam practice platform for secondary and high school students in Vietnam. Practise real exams, get scored instantly, and track your progress.",
  vi: "Nền tảng luyện đề trực tuyến cho học sinh THCS và THPT tại Việt Nam. Luyện đề thật, chấm điểm tức thì và theo dõi tiến bộ của bạn.",
};

/** BCP-47 cho `inLanguage` — schema.org muốn thẻ ngôn ngữ đầy đủ, không phải
 *  mã 2 chữ cái trần như cookie i18n của dự án. */
const BCP47: Record<Locale, string> = { en: "en-US", vi: "vi-VN" };

/**
 * Đồ thị JSON-LD của trang chủ: một `Organization` và một `WebSite` trỏ về nó.
 *
 * Dùng `@id` tuyệt đối (kèm fragment) thay vì object lồng nhau để hai node
 * tham chiếu chéo được mà không lặp dữ liệu — và để lần sau thêm node mới
 * (`WebPage`, `Course`…) chỉ việc trỏ `@id` chứ không phải chép lại cả khối.
 */
export function buildHomeJsonLd(locale: Locale): Record<string, unknown> {
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "MS-MOLAR",
        alternateName: ALTERNATE_NAMES,
        url: `${SITE_URL}/`,
        // `app/icon.png` — Next phục vụ nó ở `/icon.png`; dùng lại thay vì
        // thêm một file logo thứ hai phải nhớ đồng bộ.
        logo: `${SITE_URL}/icon.png`,
        description: DESCRIPTION[locale],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "MS-MOLAR",
        alternateName: ALTERNATE_NAMES,
        url: `${SITE_URL}/`,
        inLanguage: BCP47[locale],
        publisher: { "@id": organizationId },
      },
    ],
  };
}

/**
 * Chuỗi hoá để nhét vào `<script type="application/ld+json">`.
 *
 * Escape `<` thành `\\u003c` là BẮT BUỘC, không phải phòng xa: trình duyệt kết
 * thúc khối script ở chuỗi `</script>` đầu tiên trong văn bản, bất kể nó nằm
 * trong dấu nháy JSON hay không. Một chuỗi chứa `</script>` (hôm nay là hằng
 * số, ngày mai có thể là tên đề do người dùng nhập) sẽ cắt đôi thẻ và biến
 * phần đuôi thành HTML thật — đúng đường XSS kinh điển của JSON-LD.
 * `\\u003c` là escape hợp lệ trong JSON nên parser vẫn đọc ra ký tự `<`.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
