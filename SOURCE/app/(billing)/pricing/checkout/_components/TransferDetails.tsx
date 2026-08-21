// C-14 TransferDetails — khối CHỮ của màn thanh toán (UI Spec § Component:
// `TransferDetails` — C-14; frontend DD § C-14, FE-AC-14/15/16). Server
// component.
//
// ĐÂY LÀ ĐƯỜNG TRẢ TIỀN, KHÔNG PHẢI CHÚ THÍCH CHO MÃ QR. Mã QR là một tấm ảnh;
// nếu nó là đường DUY NHẤT thì luồng thanh toán không dùng được với trình đọc
// màn hình, và cũng không dùng được với bất kỳ ai có camera không quét nổi. Đó
// là toàn bộ lý do component này tồn tại TÁCH khỏi C-12, và là lý do AC-028 nói
// "văn bản chọn được", không nói "có mã QR".
//
// BỐN CẶP, ĐÚNG THỨ TỰ NÀY (hợp đồng structure-order của UI Spec): số tài khoản
// → chủ tài khoản → số tiền → nội dung chuyển khoản. Viết thành MỘT mảng theo
// đúng thứ tự nguồn chứ không phải bốn khối JSX rời — một mảng thì không có
// cách nào đảo thứ tự mà không thấy.
//
// SỐ TIỀN: `formatVnd()` TRƯỚC, `t()` SAU (UI-D13). `translate.ts:27` thay tham
// số bằng `String()` thô, nên đưa thẳng số 39000 vào sẽ in "39000 VND" ngay
// cạnh một mã QR mà ứng dụng ngân hàng hiện thành 39.000 — người dùng đọc thấy
// hai con số khác nhau trên màn thanh toán thì dừng trả tiền.
//
// CHỌN ĐƯỢC, KHÔNG PHẢI "BẤM ĐỂ CHÉP". Repo này không có tiện ích clipboard nào,
// và thêm một cái vào đây là thêm một KIỂU TƯƠNG TÁC MỚI kèm nghĩa vụ về quyền,
// phản hồi và thông báo, trong khi `select-all` cho sẵn nhấn-giữ-để-chép trên
// di động và nhấp-đúp-để-chọn trên desktop mà không cần bộ máy nào. Tiêu chí
// khai tử nằm ở UI Spec C-14, không nằm ở file này.
//
// THIẾU TRƯỜNG THÌ NÓI RA, KHÔNG BAO GIỜ ĐỂ TRỐNG. Một `<dd>` rỗng đọc ra như
// một trường mà người dùng tưởng mình bỏ sót, còn một dấu gạch ngang đọc ra
// "giá trị là không có gì". Cặp thiếu bị BỎ HẲN và một câu hiện lên bảo người
// dùng dừng lại trước khi chuyển tiền (frontend DD C-14 § Partial).

import { formatVnd } from "@/lib/format/number";
import { getLocale, getTranslate } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

type Pair = {
  labelKey: MessageKey;
  value: string;
  /** Lớp cho phần GIÁ TRỊ. Chủ tài khoản là chữ thường; ba trường kia là thứ
   *  người dùng phải chép sang ứng dụng ngân hàng. */
  valueClassName: string;
};

/** Một trường CHUỖI coi là thiếu khi nó rỗng hoặc chỉ có khoảng trắng: cột
 *  `text not null` của CSDL không chặn chuỗi rỗng, nên "not null" không đồng
 *  nghĩa với "có nội dung". */
function isBlank(value: string): boolean {
  return value.trim() === "";
}

export async function TransferDetails({
  accountNumber,
  accountName,
  amountVnd,
  memo,
}: {
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  memo: string;
}) {
  const t = await getTranslate();
  const locale = await getLocale();

  // Số tiền không hữu hạn là dấu hiệu dòng dữ liệu hỏng, không phải số 0:
  // `formatVnd()` sẽ in "—" cho nó, mà một dấu gạch ngang ở ô SỐ TIỀN là đúng
  // thứ mục Partial cấm.
  const amountKnown = Number.isFinite(amountVnd);

  const pairs: Array<Pair | null> = [
    isBlank(accountNumber)
      ? null
      : {
          labelKey: "billing.checkout.account",
          value: accountNumber,
          // KHÔNG nhóm, KHÔNG chèn khoảng trắng: người dùng dán nguyên chuỗi
          // này vào một ứng dụng ngân hàng từ chối dấu cách.
          valueClassName: "font-mono select-all break-all",
        },
    isBlank(accountName)
      ? null
      : {
          labelKey: "billing.checkout.accountName",
          value: accountName,
          valueClassName: "",
        },
    !amountKnown
      ? null
      : {
          labelKey: "billing.checkout.amountLabel",
          value: t("billing.amount", { amount: formatVnd(amountVnd, locale) }),
          valueClassName: "select-all",
        },
    isBlank(memo)
      ? null
      : {
          labelKey: "billing.checkout.memo",
          value: memo,
          // `break-all` để nội dung chuyển khoản không tràn ngang ở 360px.
          valueClassName: "font-mono select-all break-all",
        },
  ];

  const present = pairs.filter((pair): pair is Pair => pair !== null);
  const anyMissing = present.length !== pairs.length;
  const memoShown = !isBlank(memo);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl className="flex flex-col gap-3">
        {present.map((pair) => (
          <div key={pair.labelKey} className="min-w-0">
            <dt className="text-muted-foreground text-sm">{t(pair.labelKey)}</dt>
            <dd className={`text-foreground mt-1 text-base ${pair.valueClassName}`.trim()}>
              {pair.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Câu này đi kèm ô nội dung chuyển khoản và nói HẬU QUẢ chứ không chỉ
          nhắc nhở: một khoản tiền chuyển thiếu nội dung vẫn tới nơi nhưng không
          khớp được vào đơn nào, và đó là cách người dùng mất tiền ở màn này. */}
      {memoShown && (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("billing.checkout.memoWarning")}
        </p>
      )}

      {anyMissing && (
        <p className="text-destructive text-sm leading-relaxed">
          {t("billing.checkout.fieldMissing")}
        </p>
      )}
    </div>
  );
}
