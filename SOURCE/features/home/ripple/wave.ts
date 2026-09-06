// Toán thuần của sóng ô vuông trên nền trang chủ (engineer 2026-09-05). Không
// đụng DOM để test được bằng vitest và để phần vẽ (rippleCanvas.ts) chỉ còn
// việc lặp ô + fillRect.
//
// Mô hình: nền được chia thành lưới ô vuông CELL px cách nhau GAP px, neo vào
// góc (0,0) của khung nhìn. Một cú chạm tại (ox, oy) sinh một vành sóng bán
// kính R(t) lớn dần tới góc xa nhất của khung nhìn; mỗi ô tô đậm theo khoảng
// cách của tâm ô tới vành (chuông Gauss quanh vành) nhân với độ mờ dần theo
// thời gian. Jitter theo ô làm vành lấm tấm như mặt nước thay vì một vòng tròn
// đều tăm tắp.

export const CELL = 32;
export const GAP = 2;
export const PITCH = CELL + GAP;
/** Sóng sống bao lâu. 1100ms ở bản đầu; engineer 2026-09-05 xin dài thêm
 *  ~30% để người dùng kịp ngắm. */
export const DURATION_MS = 1450;
/** Độ rộng vành (sigma của chuông Gauss), px. */
export const BAND = 56;
/** Alpha tối đa của một ô ngay đỉnh sóng. Chữ xanh đen trên xanh lá 28% vẫn
 *  đọc thoải mái (đo 2026-09-05: 0,2 nhìn thấy nhưng nhạt tới mức dễ tưởng
 *  màn hình lỗi); sóng đi qua dưới tiêu đề không được làm mắt phải cố. */
export const PEAK_ALPHA = 0.28;
/** Ngưỡng dưới đó không đáng tốn một fillRect. */
export const MIN_ALPHA = 0.004;
/** Số sóng chạy cùng lúc; chạm dồn dập thì sóng cũ nhất nhường chỗ. Chặn trên
 *  cho chi phí mỗi khung hình khi có người bấm liên hồi. */
export const MAX_RIPPLES = 3;

/** Bán kính vành tại tiến độ p ∈ [0,1]: ease-out bậc hai — bung nhanh rồi chậm
 *  lại như sóng thật mất đà. Bậc ba đã thử: ở 280ms vành đã đi 63% đường và
 *  mắt hầu như không kịp thấy nó rời điểm chạm. */
export function radiusAt(progress: number, maxRadius: number): number {
  const p = clamp01(progress);
  return (1 - (1 - p) ** 2) * maxRadius;
}

/** Độ mờ dần theo thời gian, 1 → 0. */
export function fadeAt(progress: number): number {
  return (1 - clamp01(progress)) ** 1.4;
}

/** Độ đậm của một ô cách tâm `distance` khi vành đang ở `radius`. */
export function crestIntensity(distance: number, radius: number, band = BAND): number {
  const d = (distance - radius) / band;
  return Math.exp(-d * d);
}

/** Khoảng [min, max] bán kính ngoài đó ô chắc chắn dưới MIN_ALPHA (3 sigma),
 *  để vòng lặp vẽ chỉ chạm tới các ô quanh vành thay vì cả khung nhìn. */
export function bandRange(radius: number, band = BAND): [number, number] {
  return [Math.max(0, radius - 3 * band), radius + 3 * band];
}

/** Jitter tất định theo toạ độ ô, trong [0.65, 1]. Hash số nguyên rẻ, không
 *  cần đẹp — chỉ cần hai ô cạnh nhau khác nhau trông thấy. */
export function cellJitter(col: number, row: number): number {
  let h = (col * 374761393 + row * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  const unit = (h >>> 0) / 4294967296;
  return 0.65 + unit * 0.35;
}

/** Alpha cuối cùng của một ô. */
export function cellAlpha(
  distance: number,
  progress: number,
  maxRadius: number,
  jitter: number,
): number {
  return (
    crestIntensity(distance, radiusAt(progress, maxRadius)) * fadeAt(progress) * jitter * PEAK_ALPHA
  );
}

/** Bán kính cần bung để vành chạm tới góc xa nhất của khung nhìn. */
export function maxRadiusFrom(x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x, width - x);
  const dy = Math.max(y, height - y);
  return Math.hypot(dx, dy);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
