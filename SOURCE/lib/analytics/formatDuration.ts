// formatDurationShort — số giây → nhãn ngắn kiểu "1g23p" / "45p" / "0p" cho
// vòng tròn "Thời gian luyện theo môn" (engineer chốt cách viết 2026-09-06).
//
// Khác `formatCompletionTime` (lib/history/format.ts, "17m 54s"): đây là TỔNG
// cộng dồn nhiều lượt, đọc ở mức phút là đủ — giây lẻ trong một chú giải năm
// dòng chỉ thêm chữ số để so. Làm tròn tới phút; một tổng dương dưới 30 giây
// vẫn hiện "1p" chứ không phải "0p", vì "0p" bên cạnh một lát có màu là hai
// thông tin mâu thuẫn nhau.
export function formatDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0p";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}p`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}g${String(rest).padStart(2, "0")}p`;
}
