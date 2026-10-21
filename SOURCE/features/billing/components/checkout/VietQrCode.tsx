// Mã QR của màn thanh toán — SVG nội tuyến, vẽ ở máy chủ (CSP không cho ảnh từ
// host của payOS). Repo CHƯA có thư viện mã hoá QR (ADR-0018 chưa chốt), nên
// `encodeQrMatrix()` luôn trả `null` và component render rỗng. Khối chữ
// chuyển khoản bên cạnh vẫn đủ để trả tiền — QR chỉ là đường tắt.

import { t } from "@/lib/copy";

export type QrMatrix = readonly (readonly boolean[])[];

/** Vành lặng tối thiểu của đặc tả QR, tính bằng module. */
const QUIET_ZONE = 4;

/** Chỗ DUY NHẤT phải đổi khi có thư viện mã hoá. */
function encodeQrMatrix(payload: string): QrMatrix | null {
  if (payload === "") return null;
  return null;
}

export function QrSvg({ matrix, label }: { matrix: QrMatrix; label: string }) {
  const size = matrix.length + QUIET_ZONE * 2;
  return (
    // Nền trắng + module đen cố định, KHÔNG theo theme tối: máy quét cần tương
    // phản sáng lớn nhất.
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-card mx-auto w-full max-w-[14rem] bg-white text-black"
      shapeRendering="crispEdges"
    >
      {matrix.map((row, y) =>
        row.map((dark, x) =>
          dark ? (
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

export function VietQrCode({ payload }: { payload: string }) {
  let matrix: QrMatrix | null;
  try {
    matrix = encodeQrMatrix(payload);
  } catch (err) {
    // Chỉ log độ dài payload, không bao giờ log nội dung đơn.
    console.error("[VietQrCode] QR encoding threw", { payloadLength: payload.length, err });
    matrix = null;
  }
  if (matrix === null) return null;
  return <QrSvg matrix={matrix} label={t("billing.checkout.qrLabel")} />;
}
