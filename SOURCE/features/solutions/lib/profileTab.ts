// parseProfileTab — MỘT hàm phân tích `?tab=` cho `/profile` (task 44,
// Boundary Context "Consumer parse rule": so khớp CHÍNH XÁC chuỗi "comments"
// hoặc "solutions" (2026-10-03); mọi giá trị khác — kể cả vắng mặt — rơi về
// "account", không bao giờ một trang trắng). Dùng chung bởi `ProfilePage` (server, đọc searchParams
// thật) và test của `ProfileTabs` (client — chip chỉ NHẬN tab đang chọn qua
// prop, không tự phân tích URL) để hai bên không thể lệch luật.
export type ProfileTab = "account" | "solutions" | "comments";

export function parseProfileTab(value: string | undefined): ProfileTab {
  if (value === "comments" || value === "solutions") return value;
  return "account";
}
