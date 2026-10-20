// /pricing/checkout?order=<mã> — màn thanh toán. Cần đăng nhập.
//
// Chốt đăng nhập chạy TRƯỚC mọi lượt đọc. Bốn nguyên nhân — thiếu `?order=`,
// mã không hợp lệ, mã không tồn tại, mã của người khác — ra CÙNG một trạng thái
// rỗng: trả lời khác nhau là xác nhận đơn của người khác có thật. Lượt đọc
// HỎNG thì ném tới error.tsx, không dịch thành "không có đơn".

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LegalLinks } from "@/components/billing/LegalLinks";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { copy, t } from "@/lib/copy";
import { getMyOrder } from "@/features/billing/queries";
import { PaymentConfirm } from "@/features/billing/components/checkout/PaymentConfirm";
import { isPayable, PaymentPanel } from "@/features/billing/components/checkout/PaymentPanel";

export const metadata: Metadata = { title: "Thanh toán" };

type SearchParams = Promise<{ order?: string | string[] }>;

const ORDER_CODE = /^\d+$/;

/** Danh sách chấp nhận, không phải phân tích: chuỗi (không phải mảng), chỉ chữ
 *  số ASCII, số nguyên dương an toàn. Không bao giờ `parseInt` — "123abc" → 123. */
function parseOrderCode(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  if (!ORDER_CODE.test(raw)) return null;
  const orderCode = Number(raw);
  return Number.isSafeInteger(orderCode) && orderCode > 0 ? orderCode : null;
}

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const sp = await searchParams;
  const legalContentReady = "billing.terms.body" in copy && "billing.refund.body" in copy;

  const orderCode = parseOrderCode(sp.order);
  const order = orderCode === null ? null : await getMyOrder(orderCode);

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("billing.checkout.title")} />

      {order === null ? (
        <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {t("billing.checkout.noActiveOrder")}
          </p>
          <Link href="/pricing" className={buttonVariants({ className: "mt-3" })}>
            {t("billing.quota.upgradeLink")}
          </Link>
        </Card>
      ) : (
        <>
          <PaymentPanel order={order} />
          {isPayable(order.status) && (
            <div className="flex flex-col gap-3">
              {/* Liên kết pháp lý đứng TRƯỚC nút xác nhận trong DOM (AC-039). */}
              <LegalLinks />
              <PaymentConfirm
                orderCode={order.orderCode}
                status={order.status}
                legalContentReady={legalContentReady}
              />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
