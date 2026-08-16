// PUBLIC_PATHS — ràng buộc bảo mật có SỐ ĐẾM, nên nó cần một cổng tự động.
// PRD: subscription-prd.md AC-032, AC-038. UI Spec: Environment Constraints.
//
// Trước tính năng này, danh sách chỉ có 3 mục và tất cả đều là đường ĐỌC hoặc
// đổi mã lấy phiên. Subscription thêm đúng 3 mục: hai đường ĐỌC tĩnh (pha này)
// và một đường GHI — webhook payOS, điểm ghi chưa-đăng-nhập ĐẦU TIÊN của dự án
// (pha backend, ADR-0014). Một mục thứ tư lọt vào đây phải là một quyết định
// mới, không phải hệ quả tình cờ của một PR nào đó.

import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS } from "../middleware";

/** Bản sao ĐÚNG NGUYÊN VĂN vị từ khớp trong middleware.ts (`isPublic`).
 *  Chép chứ không import vì hàm gốc nằm trong `updateSession`, thứ cần cả một
 *  NextRequest và một Supabase client để gọi được. Nếu vị từ gốc đổi mà bản này
 *  không đổi thì các khẳng định dưới đây không còn nói về sự thật nữa — nên
 *  đừng đổi một bên. */
const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

describe("thành phần danh sách", () => {
  it("hiện có đúng 5 mục — 3 mục nền + 2 trang pháp lý của pha UI", () => {
    // Con số 6 của AC-032 chỉ đạt SAU khi pha backend thêm webhook. Ghim 5 ở
    // đây để cả việc thiếu lẫn việc thừa đều bị bắt ngay tại pha đang làm.
    expect(PUBLIC_PATHS).toEqual([
      "/",
      "/login",
      "/auth/callback",
      "/terms",
      "/refund-policy",
    ]);
  });

  it("không mục nào chứa dấu chấm", () => {
    // proxy.ts:46-48 loại MỌI path có dấu chấm khỏi matcher của middleware, nên
    // một mục như vậy sẽ không bao giờ được xét ở đây — và cũng không nhận được
    // CSP có nonce. Hỏng theo kiểu không có triệu chứng.
    for (const p of PUBLIC_PATHS) expect(p).not.toContain(".");
  });

  it("không mục nào có dấu gạch chéo ở cuối (trừ gốc)", () => {
    // Vị từ so `pathname` thô; "/terms/" là một chuỗi khác "/terms" và sẽ khiến
    // mục đó không bao giờ khớp chính trang nó định mở.
    for (const p of PUBLIC_PATHS) {
      if (p !== "/") expect(p.endsWith("/")).toBe(false);
    }
  });
});

describe("ngữ nghĩa khớp — bằng HOẶC tiền tố theo đoạn", () => {
  it("hai trang pháp lý công khai (AC-038)", () => {
    expect(isPublic("/terms")).toBe(true);
    expect(isPublic("/refund-policy")).toBe(true);
  });

  it("tên anh em cùng tiền tố KHÔNG được ăn ké", () => {
    // "/terms" là tiền tố CHUỖI của "/terms-of-service", nhưng vị từ khớp theo
    // ĐOẠN nên nó không phủ. Một trang đặt tên như vậy sẽ âm thầm đá khách
    // chưa đăng nhập về `/?auth=signin` trong khi lập trình viên đang đăng nhập
    // thì thấy trang mở bình thường.
    expect(isPublic("/terms-of-service")).toBe(false);
    expect(isPublic("/refund-policy-old")).toBe(false);
  });

  it("route con của một mục công khai cũng công khai — hệ quả không thể tránh", () => {
    expect(isPublic("/terms/2026")).toBe(true);
  });

  it("`/` chỉ khớp đúng gốc, không khớp mọi thứ", () => {
    expect(isPublic("/")).toBe(true);
    expect(isPublic("/exams")).toBe(false);
  });

  it("trang bảng giá KHÔNG công khai", () => {
    // /pricing cần đăng nhập: AC-032 chỉ cho phép thêm ba mục cho toàn tính
    // năng, và trang này không phải một trong ba.
    expect(isPublic("/pricing")).toBe(false);
  });

  it("các đường riêng tư sẵn có vẫn riêng tư", () => {
    for (const p of ["/me/dashboard", "/history", "/upload", "/admin", "/reset-password"]) {
      expect(isPublic(p)).toBe(false);
    }
  });
});
