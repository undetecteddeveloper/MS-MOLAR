"use client";

// EntitlementProvider + useEntitlement — UI Spec C-01 / UI-D1.
//
// Hình dạng này CHÉP THẲNG từ I18nProvider/useT (lib/i18n/client.tsx), không
// phải trùng hợp: đó là bài toán y hệt — một giá trị theo request, phạm vi
// người dùng, nhiều component cần, đắt nếu tính lại — và repo đã giải nó một
// lần rồi. Server đọc MỘT lần ở layout, truyền một giá trị thuần xuống provider,
// hook chỉ đọc context.
//
// VÌ SAO KHÔNG PHẢI HOOK TỰ FETCH: repo không có `React.cache()` ở bất kỳ đâu,
// không có memo hoá theo request, và KHÔNG có hook client nào fetch dữ liệu.
// (Cập nhật 2026-09-03: lib/auth/getCurrentUser.ts nay dùng `React.cache()`
// để gộp lượt auth giữa layout và page — vẫn là memo theo request PHÍA SERVER,
// không phải hook client fetch, nên kết luận ở đây không đổi.)
// Hook duy nhất chạm mạng là useTutorAction, và nó gọi Server Action — tức MỘT
// vòng round-trip cho MỖI chỗ gọi. Chép hình dạng đó cho entitlement là đặt một
// round-trip sau mỗi component bị gate, phá thẳng NFR Performance của PRD
// ("không thêm một vòng round-trip cho mỗi lần render").

import { createContext, use } from "react";
import { FREE_FALLBACK, type Entitlement } from "./types";

const EntitlementContext = createContext<Entitlement | null>(null);

export function EntitlementProvider({
  value,
  children,
}: {
  value: Entitlement;
  children: React.ReactNode;
}) {
  // Không useMemo: `value` tới từ Server Component dưới dạng một object đã dựng
  // sẵn cho lượt render này, không phải thứ component client tự tạo lại mỗi lần
  // render. Bọc memo ở đây chỉ thêm nhiễu chứ không giữ ổn định thêm được gì.
  return <EntitlementContext value={value}>{children}</EntitlementContext>;
}

/**
 * `const entitlement = useEntitlement()` trong client component.
 *
 * KHÔNG thực hiện I/O. Thiếu provider thì rơi về `FREE_FALLBACK` — vừa là tiện
 * ích cho unit test (giống hệt lý do của useT), vừa là mặc định fail-closed:
 * một tính năng xây dở tuyệt đối không được cấp Premium nhầm cho ai.
 */
export function useEntitlement(): Entitlement {
  return use(EntitlementContext) ?? FREE_FALLBACK;
}
