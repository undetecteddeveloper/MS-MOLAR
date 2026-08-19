// Supabase middleware helper — refresh session mỗi request và bảo vệ route.
// Được gọi từ proxy.ts (Next.js 16 convention thay middleware.ts).
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 8.1.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "./cookieOptions";

/** Các path không yêu cầu đăng nhập. `/auth/callback` (S#23): điểm về của
 * OAuth + email link — request tới đây CHƯA có cookie session, không whitelist
 * thì bị chặn trước khi route handler kịp đổi code lấy session.
 * (`/reset-password` KHÔNG public — cần recovery session từ email link.)
 *
 * Cách khớp (xem `isPublic` bên dưới) là BẰNG hoặc tiền tố THEO ĐOẠN, không
 * phải tiền tố chuỗi thô: "/terms" phủ cả "/terms/abc" nhưng KHÔNG phủ
 * "/terms-of-service". Mỗi mục thêm vào đây phải nêu lý do ngay tại chỗ
 * (subscription PRD AC-032).
 *
 * Ba mục của tính năng Subscription: hai đường ĐỌC tĩnh (/terms,
 * /refund-policy) và một đường GHI — webhook payOS, đường GHI chưa-đăng-nhập
 * ĐẦU TIÊN của dự án (ADR-0014) — đã về đủ.
 *
 * ⚠ RÀNG BUỘC ĐƯỢC ĐẾM LÀ SỐ MỤC CHO PHÉP GHI, KHÔNG PHẢI TỔNG SỐ MỤC
 * (ADR-0017, sửa cách phát biểu của subscription PRD AC-032).
 *
 * Cách phát biểu cũ — "đúng 6 mục, đúng 1 mục cho phép ghi" — gộp hai rủi ro
 * khác hẳn nhau vào một con số. Nó được viết khi mọi mục đều là đường đọc và
 * webhook là bổ sung duy nhất người ta lường trước. Hệ quả: một trang tĩnh
 * chỉ-đọc như /about làm tổng số chạm 6 TRƯỚC khi webhook về, và lời khẳng
 * định "6 mục, 1 mục ghi" khi đó được thoả mãn bởi đúng sáu mục SAI.
 *
 * Thứ thật sự cần canh là: KHÔNG có đường GHI nào chưa-đăng-nhập lọt vào đây
 * mà không phải một quyết định có chủ đích. Hôm nay con số đó là ĐÚNG 1 —
 * webhook payOS, mục cuối mảng, có ADR-0014 đứng sau. Mục ghi thứ hai cần ADR
 * của riêng nó. Tổng số mục vẫn được ghim bằng phép so khớp mảng nguyên văn
 * trong test, nhưng nó chỉ còn là mô tả — không còn là chỗ dựa của lời khẳng
 * định bảo mật.
 *
 * Đổi lại: thêm một trang công khai chỉ-đọc trở thành thay đổi một dòng bình
 * thường, còn thêm một đường GHI thì vẫn phải dừng người review lại — đúng
 * việc mà cái cổng này sinh ra để làm. */
// Export để test kiểm được bằng máy thay vì bằng mắt.
export const PUBLIC_PATHS = [
  // Trang chủ + form auth. Nếu mục này mất thì chính màn hình đăng nhập cũng
  // nằm sau đăng nhập — vòng redirect vô tận về chính nó. Đường ĐỌC.
  "/",
  // Stub redirect sang `/?auth=signin` (auth về content area của `/` từ S#17).
  // Nó chỉ tồn tại để các link/bookmark `/login` cũ không chết. Đường ĐỌC.
  "/login",
  // Điểm về của mọi flow PKCE `?code=` (S#23). Request tới đây CHƯA có cookie
  // session — không whitelist thì bị chặn TRƯỚC khi route handler kịp đổi code
  // lấy session. Đổi một mã dùng-một-lần mà người gọi phải đã cầm sẵn, không
  // nhận payload tuỳ ý: xếp cùng nhóm ĐỌC, không phải nhóm GHI.
  "/auth/callback",
  // Bán hàng cho học sinh THCS/THPT thì điều khoản phải đọc được TRƯỚC khi có
  // tài khoản, nếu không thì "đồng ý điều khoản" là đồng ý với một trang bị
  // chặn (PRD R11/AC-038).
  "/terms",
  // Cùng lý do. AC-040 buộc trang này nói rõ gói KHÔNG tự động gia hạn — kỳ
  // vọng dễ hiểu sai nhất của mô hình trả trước.
  "/refund-policy",
  // Trang giới thiệu + liên hệ (ADR-0017). Toàn bộ đối tượng của nó là người
  // CHƯA có tài khoản: phụ huynh muốn biết ai vận hành site, học sinh cần số
  // điện thoại vì không đăng nhập được. Đặt nó sau đăng nhập là cấu hình duy
  // nhất khiến nó vô dụng với đúng những người nó phục vụ.
  // Đây là đường ĐỌC: không fetch dữ liệu, không Server Action, không form nào
  // gửi đi. Nếu về sau nó cần một form, đó là một quyết định MỚI theo ràng buộc
  // đã phát biểu lại ở trên, không phải phần mở rộng lặng lẽ của mục này.
  "/about",
  // ⚠ ĐƯỜNG GHI CHƯA-ĐĂNG-NHẬP DUY NHẤT CỦA DỰ ÁN (ADR-0014, PRD R9/AC-032).
  // Con số ADR-0017 canh đi từ 0 lên 1 tại đúng dòng này, và 1 là con số các
  // lần review sau phải giữ — một mục GHI thứ hai cần ADR của riêng nó.
  //
  // Vì sao phải whitelist: matcher của proxy.ts KHÔNG loại trừ `/api`, nên
  // không có dòng này thì POST của payOS ăn một 307 về `/?auth=signin` và mọi
  // đơn chỉ settle được khi người dùng tự bấm "kiểm tra lại" (PRD R10).
  //
  // Vì sao mở một đường GHI cho internet là chấp nhận được: nó KHÔNG cấp gì
  // cả. Route handler chỉ chuyển tiếp `orderCode` cho `settleOrder()`, và
  // `settleOrder()` hỏi lại payOS trước mỗi lượt ghi — thân request là một GỢI
  // Ý, không bao giờ là một chỉ thị (ADR-0014 Decision 1-2). Chữ ký sai dừng
  // trước cả lượt I/O đầu tiên.
  //
  // Phép khớp là BẰNG hoặc tiền tố THEO ĐOẠN, nên mục này KHÔNG mở "/api",
  // không mở "/api/payments", và không mở một route anh em nào khác dưới
  // "/api". Ghim bằng máy ở `lib/supabase/__tests__/publicPaths.test.ts` và
  // `app/api/payments/payos/webhook/__tests__/route.test.ts`.
  "/api/payments/payos/webhook",
];

/** CSP của lượt request này, do proxy.ts sinh (TD-006). */
export interface CspContext {
  nonce: string;
  csp: string;
}

export async function updateSession(request: NextRequest, cspContext?: CspContext) {
  // Header của request được DỰNG LẠI mỗi lần thay vì tính sẵn một lần: callback
  // `setAll` bên dưới ghi cookie session mới bằng `request.cookies.set()`, mà
  // hàm đó mutate chính `request.headers`. Chụp headers một lần từ trước sẽ
  // đông cứng cookie CŨ vào response và làm hỏng vòng refresh token.
  const requestHeaders = () => {
    const headers = new Headers(request.headers);
    if (cspContext) {
      // Next.js đọc ĐÚNG header này của request để rút nonce ra và gắn vào các
      // thẻ script nó render. Thiếu nó = script hydrate không có nonce = trang trắng.
      headers.set("content-security-policy", cspContext.csp);
      // Tiện ích cho code phía server muốn tự render thẻ script/style có nonce.
      headers.set("x-nonce", cspContext.nonce);
    }
    return headers;
  };

  /** Gắn CSP thật lên response — đây mới là bản trình duyệt thực thi. Nó ĐÈ
   *  chính sách nền của next.config.ts (`headers.set`, không phải append). */
  const withCsp = <T extends NextResponse>(response: T): T => {
    if (cspContext) response.headers.set("Content-Security-Policy", cspContext.csp);
    return response;
  };

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders() } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Phải khớp server.ts: middleware là nơi refresh token nên cũng GHI LẠI
      // cookie session. Thiếu ở đây thì mỗi lần refresh sẽ ghi đè bằng cookie
      // KHÔNG httpOnly và âm thầm huỷ tác dụng của server.ts.
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders() } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // QUAN TRỌNG: getUser() phải được gọi để refresh token. Không chèn code giữa
  // createServerClient và getUser() — dễ gây lỗi đăng xuất ngẫu nhiên.
  // Bọc try/catch: nếu backend Supabase không kết nối được (project paused/
  // deleted, mạng), coi như chưa đăng nhập thay vì để mọi request 500.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.warn("[updateSession] Supabase auth không kết nối được:", err);
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Chưa đăng nhập + route cần bảo vệ → về homepage với form auth mở
  // (auth nằm trong content area của `/` từ S#17, không còn page /login riêng).
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?auth=signin";
    return withCsp(NextResponse.redirect(url));
  }

  return withCsp(supabaseResponse);
}
