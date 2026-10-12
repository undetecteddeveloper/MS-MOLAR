// Khung hình của cảnh Maxwell — hàm THUẦN, không đụng WebGL nên test được.
//
// Điện thoại cầm dọc cho khung canvas hẹp hơn cao (tỉ lệ ~0,9 hoặc thấp hơn), máy
// tính cho khung ngang. Một khoảng cách camera cố định sẽ cắt mô hình ở một
// trong hai: khoảng cách phải tính theo CẠNH HẸP HƠN của góc nhìn.

const DEG = Math.PI / 180;

/**
 * Khoảng cách từ camera tới tâm một khối cầu bán kính `radius` để khối cầu nằm
 * trọn trong khung, theo góc nhìn dọc `fovDeg` (độ) và tỉ lệ khung `aspect`
 * (rộng / cao).
 */
export function fitDistance({
  radius,
  fovDeg,
  aspect,
}: {
  radius: number;
  fovDeg: number;
  aspect: number;
}): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const vertical = fovDeg * DEG;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * safeAspect);
  return radius / Math.sin(Math.min(vertical, horizontal) / 2);
}
