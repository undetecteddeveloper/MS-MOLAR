// C-12 VietQrCode — mã quét của màn thanh toán (UI Spec § Component:
// `VietQrCode` — C-12; frontend DD § C-12, UI-D14). SERVER COMPONENT, và đó là
// một ràng buộc chứ không phải một sở thích: phép mã hoá chạy trong lượt render
// của máy chủ nên KHÔNG có gì thuộc về nhà cung cấp chạm tới trình duyệt.
//
// KHÔNG `<img src>` TRỎ TỚI NHÀ CUNG CẤP, KHÔNG `fetch` TỚI HOST CỦA HỌ. CSP
// đang thi hành là `img-src 'self' data: blob: <supabaseOrigin>` (csp.ts:56) và
// `connect-src 'self' <supabaseOrigin>` (csp.ts:58), KHÔNG mang origin nào của
// payOS, và hai chỉ thị ấy phát ra VÔ ĐIỀU KIỆN — `isProd` chỉ rẽ nhánh cho
// `script-src` (csp.ts:40-43). Nghĩa là một cái ảnh do nhà cung cấp host sẽ
// hỏng ngay trên máy người viết ra nó, chứ không đợi tới production. SVG nội
// tuyến thì không cần một suất `img-src` nào cả: nó là MARKUP, không phải một
// tài nguyên được tải về. KHÔNG có thay đổi CSP nào đi kèm file này.
//
// VẮNG BỘ MÃ HOÁ LÀ MỘT TRẠNG THÁI ĐƯỢC ĐẶC TẢ, KHÔNG PHẢI MỘT CÚ NGÃ.
// ADR-0018 (BU-2) chưa chốt nên `package.json` chưa có gói mã hoá QR nào, và
// việc lặng lẽ kéo một thư viện nặng về để "cho xong" chính là quyết định mà
// ADR ấy tồn tại để giữ lại cho con người. Hợp đồng của component:
//
//   · không có payload, hoặc không có bộ mã hoá, hoặc mã hoá NÉM
//        ⇒ component render RỖNG, và trang vẫn render bình thường;
//   · C-13 không bao giờ coi việc thiếu mã QR là lỗi và không chặn vì nó;
//   · khối chữ của C-14 không bị ảnh hưởng, nên màn hình vẫn trả tiền được —
//     đó mới ĐÚNG LÀ yêu cầu của AC-028. Bản cài đặt nào biến mã QR thành thứ
//     CHỊU LỰC thì đã trượt AC-028 rồi.
//
// MỐI NỐI ĐỂ SAU NÀY GHÉP VÀO nằm gọn trong `encodeQrMatrix()` bên dưới: ngày
// ADR-0018 chốt, ĐÚNG thân hàm đó đổi (trả về ma trận module vuông của thư viện
// được chọn) và không một dòng nào khác trong file này phải đổi theo.

import { getTranslate } from "@/lib/i18n/server";

/** Ma trận module của một mã QR: vuông, hàng ngoài — cột trong, `true` là
 *  module TỐI. Đây là hình dạng mọi bộ mã hoá đều dựng ra được, nên nó là mối
 *  nối rẻ nhất để đổi thư viện sau này mà không đụng tới phần vẽ. */
export type QrMatrix = readonly (readonly boolean[])[];

/** Vành lặng, tính bằng MODULE. Bốn là mức tối thiểu của đặc tả QR: một mã dán
 *  sát mép màu bị rất nhiều camera điện thoại từ chối đọc. */
const QUIET_ZONE = 4;

/**
 * MỐI NỐI CỦA ADR-0018 (BU-2). Trả `null` nghĩa là "không vẽ gì cả".
 *
 * Hôm nay luôn trả `null` vì repo chưa có bộ mã hoá nào — và đó là trạng thái
 * ĐƯỢC ĐẶC TẢ, không phải một chỗ làm dở. Hệ quả cần nói thẳng để không ai đọc
 * nhầm kết quả test: nhánh `payload === ""` hiện KHÔNG phân biệt được với nhánh
 * "chưa có bộ mã hoá", vì cả hai cùng ra `null`. Nó được giữ lại vì nó là điều
 * kiện chịu lực ngay khi thân hàm này có bộ mã hoá thật.
 */
function encodeQrMatrix(payload: string): QrMatrix | null {
  if (payload === "") return null;
  // ADR-0018 chưa chốt ⇒ chưa có gì để gọi. Dòng này là chỗ DUY NHẤT thay đổi.
  return null;
}

/**
 * Phần VẼ, tách khỏi phần MÃ HOÁ.
 *
 * Xuất ra ngoài có chủ đích: ô "Default" trong bảng State × Display của UI Spec
 * phải có một đích render và một ca kiểm thử, mà mối nối phía trên thì chưa trả
 * về ma trận nào. Tách như vậy cũng đúng ranh giới trách nhiệm — vành lặng, cỡ
 * hộp, bảng màu và nhãn là quyết định của UI Spec, còn thư viện mã hoá là quyết
 * định của ADR-0018.
 *
 * Màu: module lấy `currentColor` từ `text-foreground`, nền là `bg-background`
 * phủ trọn viewBox nên vành lặng cũng chính là nền ấy. TUYỆT ĐỐI không dùng đỏ
 * son cho module — `.claude/MEMORY.md` cấm phủ primary lên khối lớn, và máy
 * quét thì cần tương phản độ sáng lớn nhất có thể.
 */
export function QrSvg({ matrix, label }: { matrix: QrMatrix; label: string }) {
  const size = matrix.length + QUIET_ZONE * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      // `w-full max-w-[16rem] mx-auto`: hộp vuông, không vượt quá bề ngang
      // container ở 360px. `shape-rendering` giữ cạnh module sắc khi phóng to —
      // module bị làm mượt là module máy quét đọc sai.
      className="bg-background text-foreground mx-auto w-full max-w-[16rem]"
      shapeRendering="crispEdges"
    >
      {matrix.map((row, y) =>
        row.map((dark, x) =>
          dark ? (
            // x là CỘT, y là HÀNG. Đảo hai cái này lại cho ra một mã KHÁC hẳn
            // (hoặc không ra mã nào), và một ma trận đối xứng thì không nhìn
            // thấy được lỗi đó — nên fixture trong test cố ý bất đối xứng.
            <rect
              key={`${x}-${y}`}
              x={x + QUIET_ZONE}
              y={y + QUIET_ZONE}
              width={1}
              height={1}
              fill="currentColor"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export async function VietQrCode({ payload }: { payload: string }) {
  let matrix: QrMatrix | null;
  try {
    matrix = encodeQrMatrix(payload);
  } catch (err) {
    // Một lượt mã hoá NÉM không được phép kéo cả màn thanh toán xuống: đây là
    // phần trang trí, còn khối chữ của C-14 mới là đường trả tiền. Chỉ ghi độ
    // dài payload, KHÔNG bao giờ ghi chính payload (§ Security Considerations:
    // không log nội dung đơn).
    console.error("[VietQrCode] QR encoding threw", { payloadLength: payload.length, err });
    matrix = null;
  }

  if (matrix === null) return null;

  return <QrSvg matrix={matrix} label={(await getTranslate())("billing.checkout.qrLabel")} />;
}
