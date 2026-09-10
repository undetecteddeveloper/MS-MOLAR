// /about — trang giới thiệu + liên hệ, CÔNG KHAI (PRD R10/AC-055..AC-061,
// ADR-0017).
//
// Vì sao nằm trong route group (billing) dù chẳng liên quan gì tới thanh toán:
// quyền truy cập do middleware quyết theo TỪNG PATH (PUBLIC_PATHS), KHÔNG theo
// route group — (billing)/layout.tsx đã ghi rõ điều đó và nhóm này vốn đang
// chứa trang công khai khác (/terms) dùng đúng khung LegalDocument dưới đây.
//
// Đường dẫn phải nằm trong PUBLIC_PATHS đúng chuỗi "/about" — cơ chế khớp là
// `pathname === p || pathname.startsWith(`${p}/`)`, nên một trang "/about-us"
// thêm sau này sẽ KHÔNG được mục "/about" phủ. publicPaths.test.ts ghim sẵn
// trường hợp đó.
//
// KHÔNG fetch dữ liệu, KHÔNG kiểm auth (AC-057, AC-058).
//
// Theme "Sân trường" (2026-09-10): tiêu đề hiện rõ qua LegalDocument; khối
// liên hệ là thẻ surface ba dòng nhãn-trên/giá-trị-dưới, email và số điện
// thoại là liên kết xanh gạch chân, vùng chạm 44px.

import type { Metadata } from "next";
import { LegalDocument } from "@/components/billing/LegalDocument";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";

// `alternates.canonical` PHẢI khai lại: root layout đặt mặc định `canonical:
// "/"` cho mọi trang. Để nguyên thì trang này tự khai mình là bản sao trang chủ
// — hỏng im lặng, chỉ lộ ra ở Search Console. Cùng lý do với /terms.
export const metadata: Metadata = {
  title: "Giới thiệu",
  alternates: { canonical: "/about" },
};

// ---------------------------------------------------------------------------
// Thông tin liên hệ THẬT (engineer cung cấp 2026-08-17). Tên riêng, email và
// số điện thoại KHÔNG đưa vào từ điển: nhãn thì là câu chữ, GIÁ TRỊ thì không.
// ---------------------------------------------------------------------------
const CONTACT = {
  ownerName: "Nguyễn Anh Phát",
  email: "smithnguyen247@gmail.com",
  phone: "0912037624",
} as const;

/** Còn đang là dữ liệu giả hay không.
 *
 *  UI Spec UI-D13 hoãn AC-070 (email/điện thoại thành liên kết bấm được) cho
 *  tới khi có thông tin THẬT — nay đã có, nên cờ tắt và ContactRow tự nối
 *  `mailto:`/`tel:` (href viết sẵn, chỉ chờ cờ này). */
const CONTACT_IS_PLACEHOLDER = false;

export default async function AboutPage() {
  return (
    <LegalDocument title={t("about.title")}>
      <p>{t("about.intro")}</p>

      {/* <dl> chứ không phải bảng: đây là các cặp nhãn–giá trị, không phải dữ
          liệu hai chiều. Trình đọc màn hình thông báo đúng quan hệ nhãn/giá trị
          mà không cần thêm ARIA nào. */}
      <Card as="section" className="gap-4">
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
      </Card>

      {/* Chỉ hiện khi CONTACT còn là dữ liệu giả (xem CONTACT_IS_PLACEHOLDER ở
          trên) — một trang liên hệ với số điện thoại giả mà trông như thật
          thì tệ hơn một trang nói thẳng là chưa có. */}
      {CONTACT_IS_PLACEHOLDER && (
        <Card variant="outline" padding="compact" className="border-dashed" role="status">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("about.placeholderNotice")}
          </p>
        </Card>
      )}
    </LegalDocument>
  );
}

/** Một dòng nhãn–giá trị: nhãn nhỏ chữ thường (`.eyebrow`), giá trị 16px. */
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
    <div className="flex flex-col gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="text-foreground">
        {href ? (
          // min-h-11 + inline-flex: sàn 44px cho đích chạm là chiều cao THẬT của
          // vùng bấm, không chỉ chiều cao dòng chữ. Liên kết xanh hành động,
          // gạch chân mảnh — màu không phải kênh duy nhất.
          <a
            href={href}
            className="text-primary decoration-primary/40 hover:decoration-primary focus-visible:ring-ring/40 inline-flex min-h-11 items-center rounded-sm font-medium underline underline-offset-4 focus-visible:ring-3 focus-visible:outline-none"
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
