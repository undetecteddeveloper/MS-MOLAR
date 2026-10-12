// Chuyển động của Maxwell: xoay quanh trục đứng + nhấp nhô lên xuống. Hàm thuần
// theo thời gian (giây kể từ lúc cảnh bắt đầu) để test được mà không cần WebGL.
//
// Cố ý KHÔNG có nhánh prefers-reduced-motion — cùng tiền lệ khối "TRANG CHỦ SỐNG
// ĐỘNG" trong app/globals.css (yêu cầu rõ của người dùng 2026-09-30): máy tắt
// hiệu ứng hệ điều hành thì trang đứng yên và bị báo là hỏng. Muốn đổi: truyền
// `poseAt(0)` khi `matchMedia("(prefers-reduced-motion: reduce)")` khớp, ở
// createMaxwellScene.ts.

/** Một vòng ≈ 6,9 giây. Nhanh hơn 30% so với bản đầu (0,7 rad/s, ≈ 9 giây/vòng)
 *  theo yêu cầu người dùng 2026-10-12. */
export const SPIN_RAD_PER_SEC = 0.91;
/** Biên độ nhấp nhô, tính theo đơn vị cảnh (mô hình cao ≈ 1,6). */
export const BOB_AMPLITUDE = 0.08;
/** Chu kỳ nhấp nhô ≈ 2,3 giây. Nhanh hơn 30% so với bản đầu (2,1 rad/s, ≈ 3 giây). */
export const BOB_RAD_PER_SEC = 2.73;

const TWO_PI = Math.PI * 2;

export type Pose = { rotationY: number; offsetY: number };

export function poseAt(seconds: number): Pose {
  const t = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return {
    // Giữ trong [0, 2π) để phiên mở cả giờ không tích số thực lớn dần.
    rotationY: (t * SPIN_RAD_PER_SEC) % TWO_PI,
    offsetY: Math.sin(t * BOB_RAD_PER_SEC) * BOB_AMPLITUDE,
  };
}
