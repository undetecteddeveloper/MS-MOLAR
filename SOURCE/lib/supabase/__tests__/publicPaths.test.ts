// PUBLIC_PATHS — ràng buộc bảo mật có SỐ ĐẾM, nên nó cần một cổng tự động.
// PRD: subscription-prd.md AC-032, AC-038; profile-and-about-prd.md AC-062..
// AC-066. ADR: ADR-0017.
//
// Trước Subscription, danh sách chỉ có 3 mục và tất cả đều là đường ĐỌC hoặc
// đổi mã lấy phiên. Subscription thêm hai đường ĐỌC tĩnh (/terms,
// /refund-policy) và sẽ thêm một đường GHI — webhook payOS, điểm ghi
// chưa-đăng-nhập ĐẦU TIÊN của dự án (pha backend, ADR-0014, CHƯA về).
//
// ⚠ CON SỐ ĐƯỢC CANH ĐÃ ĐỔI (ADR-0017): là số mục CHO PHÉP GHI, không phải
// tổng số mục.
//
// AC-032 phát biểu "đúng 6 mục, đúng 1 mục cho phép ghi" khi mọi mục đều là
// đường đọc và webhook là bổ sung duy nhất được lường trước. Cách đếm đó gộp
// một trang tĩnh chỉ-đọc với một webhook vào cùng một con số. /about đẩy tổng
// lên 6 TRƯỚC khi webhook về, nên lời khẳng định cũ sẽ được thoả mãn bởi đúng
// sáu mục SAI — một cổng vẫn xanh trong khi thứ nó canh đã đổi nghĩa.
//
// Bất biến thay thế, mạnh hơn: HÔM NAY CÓ ĐÚNG 0 MỤC CHO PHÉP GHI. Webhook
// payOS sẽ là mục ghi đầu tiên và, khi đó, là duy nhất. Tổng số mục vẫn bị
// ghim bằng so khớp mảng nguyên văn ngay dưới đây, nhưng chỉ để phát hiện
// thay đổi ngoài ý muốn — nó không còn mang lời khẳng định bảo mật.
//
// Hệ quả có chủ đích: thêm một trang công khai chỉ-đọc là thay đổi một dòng
// bình thường; thêm một đường GHI thì vẫn phải là một quyết định có chủ đích.

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
  it("hiện có đúng 6 mục — 3 mục nền + 2 trang pháp lý + /about, TẤT CẢ đều chỉ-đọc", () => {
    // Ghim nguyên văn để cả việc thiếu lẫn việc thừa đều bị bắt. Con số 6 ở
    // đây KHÔNG phải con số 6 của AC-032: đó là 6-sau-khi-có-webhook, còn đây
    // là 6-toàn-đường-đọc. Xem khối chú thích đầu file và ADR-0017.
    expect(PUBLIC_PATHS).toEqual([
      "/",
      "/login",
      "/auth/callback",
      "/terms",
      "/refund-policy",
      "/about",
    ]);
  });

  it("KHÔNG mục nào là đường cho phép ghi chưa-đăng-nhập", () => {
    // Đây là bất biến bảo mật thật sự (ADR-0017). Nó không kiểm được bằng cách
    // đọc mảng — một chuỗi không nói lên nó phục vụ GET hay POST — nên danh
    // sách dưới đây là bản kê KHAI BÁO, và việc nó phải khớp toàn bộ mảng
    // buộc người thêm mục mới phải phân loại mục của mình tại đây.
    const READ_ONLY_PATHS = [
      "/", // trang chủ + form auth
      "/login", // redirect stub sang /?auth=signin
      "/auth/callback", // route handler: đổi code lấy phiên, không nhận payload tuỳ ý
      "/terms",
      "/refund-policy",
      "/about",
    ];
    const WRITE_PATHS: string[] = [
      // Webhook payOS về đây khi ADR-0014 được viết. Lúc đó: đúng 1 mục.
    ];

    expect([...READ_ONLY_PATHS, ...WRITE_PATHS].sort()).toEqual([...PUBLIC_PATHS].sort());
    expect(WRITE_PATHS).toHaveLength(0);
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

  it("trang giới thiệu công khai (AC-056)", () => {
    // Toàn bộ đối tượng của /about là khách CHƯA đăng nhập. Mục này hỏng thì
    // trang vẫn chạy hoàn hảo với lập trình viên (đang đăng nhập) và đá về
    // /?auth=signin với đúng những người nó phục vụ.
    expect(isPublic("/about")).toBe(true);
  });

  it("tên anh em cùng tiền tố KHÔNG được ăn ké", () => {
    // "/terms" là tiền tố CHUỖI của "/terms-of-service", nhưng vị từ khớp theo
    // ĐOẠN nên nó không phủ. Một trang đặt tên như vậy sẽ âm thầm đá khách
    // chưa đăng nhập về `/?auth=signin` trong khi lập trình viên đang đăng nhập
    // thì thấy trang mở bình thường.
    expect(isPublic("/terms-of-service")).toBe(false);
    expect(isPublic("/refund-policy-old")).toBe(false);
    // "/about" là tiền tố NGẮN và dễ bị nối thêm — "/about-us" là cái tên
    // người ta hay đặt tiếp theo nhất. Ghim sẵn (AC-063b).
    expect(isPublic("/about-us")).toBe(false);
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
    // "/profile" nằm trong danh sách này chứ không phải chỉ dựa vào việc nó
    // VẮNG MẶT khỏi PUBLIC_PATHS: trang này hiển thị email và ảnh của người
    // dùng, và cách nó được bảo vệ (bằng sự vắng mặt) là cách không để lại dấu
    // vết nào nếu ai đó thêm nhầm nó vào danh sách công khai.
    for (const p of ["/profile", "/me/dashboard", "/history", "/upload", "/admin", "/reset-password"]) {
      expect(isPublic(p)).toBe(false);
    }
  });
});
