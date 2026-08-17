// /about — trang giới thiệu + liên hệ, CÔNG KHAI (PRD R10/AC-055..AC-061,
// ADR-0017).
//
// Vì sao nằm trong route group (billing) dù chẳng liên quan gì tới thanh toán:
// quyền truy cập do middleware quyết theo TỪNG PATH (PUBLIC_PATHS), KHÔNG theo
// route group — (billing)/layout.tsx:5-12 đã ghi rõ điều đó và nhóm này vốn
// đang chứa hai trang công khai khác (/terms, /refund-policy) dùng đúng khung
// LegalDocument dưới đây. Đặt ở đây là dùng lại một tiền lệ đã có, không phải
// dựng nhóm route thứ sáu chỉ để chứa một trang tĩnh.
//
// Đường dẫn phải nằm trong PUBLIC_PATHS đúng chuỗi "/about" — cơ chế khớp là
// `pathname === p || pathname.startsWith(`${p}/`)`, nên một trang "/about-us"
// thêm sau này sẽ KHÔNG được mục "/about" phủ và sẽ âm thầm đá khách chưa đăng
// nhập về `/?auth=signin`. publicPaths.test.ts ghim sẵn trường hợp đó.
//
// KHÔNG fetch dữ liệu, KHÔNG kiểm auth (AC-057, AC-058). `getTranslate()` đọc
// cookie ngôn ngữ nên trang vẫn là dynamic — đánh đổi của cả site, xem
// (billing)/terms/page.tsx:8-11. Đó là "không truy vấn dữ liệu", không phải
// "prerender được".

import type { Metadata } from "next";
import { LegalDocument } from "@/components/billing/LegalDocument";
import { getTranslate } from "@/lib/i18n/server";

// `alternates.canonical` PHẢI khai lại: root layout đặt mặc định `canonical:
// "/"` cho mọi trang. Để nguyên thì trang này tự khai mình là bản sao trang chủ
// — hỏng im lặng, chỉ lộ ra ở Search Console. Cùng lý do với /terms.
export const metadata: Metadata = {
  title: "About Us",
  alternates: { canonical: "/about" },
};

// ---------------------------------------------------------------------------
// TODO: replace with real contact info
//
// Ba giá trị dưới đây là GIẢ ĐỊNH, engineer thay bằng thông tin thật.
//
// Cố ý KHÔNG đưa vào từ điển i18n: tên riêng, email và số điện thoại giống hệt
// nhau ở cả hai ngôn ngữ, mà lib/i18n/__tests__/i18n.test.ts bắt buộc dưới 10%
// số chuỗi trùng khớp từng byte giữa en và vi — nhét chúng vào từ điển là tự
// đẩy tỉ lệ đó lên vì một lý do không có thật. Nhãn thì dịch, GIÁ TRỊ thì không.
// Đặt tập trung ở đây để thay thông tin thật là sửa đúng một chỗ.
// ---------------------------------------------------------------------------
const CONTACT = {
  ownerName: "Nguyễn Văn A", // TODO: replace with real contact info
  email: "lienhe@example.com", // TODO: replace with real contact info
  phone: "+84 000 000 000", // TODO: replace with real contact info
} as const;

/** Còn đang là dữ liệu giả hay không.
 *
 *  UI Spec UI-D13 hoãn AC-070 (email/điện thoại thành liên kết bấm được) cho
 *  tới khi có thông tin THẬT, và lý do là cụ thể chứ không phải thận trọng
 *  chung chung: một số điện thoại bịa mà BẤM ĐƯỢC thì mời người ta gọi đi đâu
 *  đó. Dòng chữ "đây là dữ liệu tạm" ở cuối trang không ngăn được ngón tay.
 *
 *  Nên chỗ nối vẫn viết sẵn ở ContactRow (href), chỉ là không truyền vào khi cờ
 *  này còn bật. Thay thông tin thật = sửa CONTACT ở trên rồi đặt cờ này thành
 *  false; không phải viết lại markup. */
const CONTACT_IS_PLACEHOLDER = true; // TODO: set to false with the real contact info above

export default async function AboutPage() {
  const t = await getTranslate();

  return (
    <LegalDocument eyebrow={t("about.eyebrow")} title={t("about.title")}>
      <p>{t("about.intro")}</p>

      {/* <dl> chứ không phải bảng: đây là các cặp nhãn–giá trị, không phải dữ
          liệu hai chiều. Trình đọc màn hình thông báo đúng quan hệ nhãn/giá trị
          mà không cần thêm ARIA nào. */}
      <dl className="flex flex-col gap-4">
        <ContactRow label={t("about.owner")} value={CONTACT.ownerName} />
        <ContactRow
          label={t("about.email")}
          value={CONTACT.email}
          href={CONTACT_IS_PLACEHOLDER ? undefined : `mailto:${CONTACT.email}`}
        />
        <ContactRow
          label={t("about.phone")}
          value={CONTACT.phone}
          // Bỏ mọi ký tự không phải chữ số (giữ dấu + đầu chuỗi) — `tel:` không
          // chấp nhận khoảng trắng.
          href={
            CONTACT_IS_PLACEHOLDER
              ? undefined
              : `tel:${CONTACT.phone.replace(/(?!^\+)[^\d]/g, "")}`
          }
        />
      </dl>

      {/* Nhắc rõ đây là dữ liệu tạm, hiển thị ngay trên trang chứ không chỉ nằm
          trong comment: một trang liên hệ với số điện thoại giả mà trông như
          thật thì tệ hơn một trang nói thẳng là chưa có. */}
      <p
        role="status"
        className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-3"
      >
        {t("about.placeholderNotice")}
      </p>
    </LegalDocument>
  );
}

/** Một dòng nhãn–giá trị. `.eyebrow` là kiểu nhãn chữ nhỏ in hoa dùng chung
 *  toàn repo (globals.css:270-273), giống MetadataFields dùng cho nhãn form. */
function ContactRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-foreground text-base">
        {href ? (
          // min-h-11: sàn 44px cho đích chạm (Mobile-Layout-Research-MS §4.3).
          // inline-flex items-center để chiều cao đó là chiều cao thật của vùng
          // bấm chứ không chỉ là chiều cao dòng chữ.
          <a
            href={href}
            className="hover:text-brand focus-visible:ring-ring focus-visible:ring-3 inline-flex min-h-11 items-center rounded-[4px] underline underline-offset-4 transition-colors focus-visible:outline-none"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
