// NAV_ITEMS.guarded — cờ này phải khớp PUBLIC_PATHS, và phải khớp BẰNG MÁY.
//
// `guarded` quyết định có prefetch một đích hay không cho khách chưa đăng nhập
// (đo prod 2026-08-27: mỗi đích guarded bị prefetch nhầm = một 307 + một lượt
// render server đầy đủ của `/?auth=signin`; bốn mục = 13 lượt gọi function bỏ
// đi trên mỗi lần khách mở trang chủ). Cờ đó là một BẢN SAO của tri thức đã
// nằm trong `PUBLIC_PATHS` — và một bản sao được giữ đồng bộ bằng lời hứa là
// thứ chỉ có thể lệch đi theo thời gian, đúng lý do `lib/nav/items.ts` tồn tại
// ngay từ đầu (nó ra đời để gộp hai bản chép của cùng danh sách nav).
//
// Hai chiều hỏng, cả hai đều IM LẶNG nên cả hai đều được ghim:
//   · guarded THIẾU trên một đích sau-đăng-nhập → lãng phí quay lại, không ai
//     thấy vì trang vẫn chạy đúng.
//   · guarded THỪA trên một đích công khai → khách mất prefetch cho một trang
//     họ vào được thật; cũng không ai thấy, chỉ chậm hơn.
//
// @category: core-functionality
// @dependency: none — hai hằng số thuần, không I/O

import { describe, expect, it } from "vitest";
import { GUEST_NAV_ITEMS, NAV_ITEMS, navPrefetch } from "../items";
import { PUBLIC_PATHS } from "@/lib/supabase/middleware";

/** Cùng phép khớp mà proxy dùng: BẰNG, hoặc tiền tố THEO ĐOẠN. */
function isPublic(href: string): boolean {
  const pathname = href.split("?")[0] || "/";
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

describe("NAV_ITEMS.guarded khớp PUBLIC_PATHS", () => {
  it("mọi đích KHÔNG công khai đều được đánh dấu guarded", () => {
    const missing = GUEST_NAV_ITEMS.filter((i) => !isPublic(i.href) && !i.guarded).map(
      (i) => i.href
    );

    expect(missing).toEqual([]);
  });

  it("không đích công khai nào bị đánh dấu guarded", () => {
    const extra = GUEST_NAV_ITEMS.filter((i) => isPublic(i.href) && i.guarded).map((i) => i.href);

    expect(extra).toEqual([]);
  });

  it("bốn đích sau-đăng-nhập được đo 2026-08-27 vẫn là bốn", () => {
    // Ghim SỐ ĐẾM, không chỉ tính chất: thêm một mục nav sau-đăng-nhập là thêm
    // một lượt render bỏ đi cho mỗi khách, nên nó nên là một quyết định có
    // chủ đích chứ không phải một dòng lọt qua review.
    expect(NAV_ITEMS.filter((i) => i.guarded).map((i) => i.href)).toEqual([
      "/exams",
      "/me/dashboard",
      "/history",
      "/upload",
    ]);
  });
});

describe("navPrefetch", () => {
  it("tắt prefetch CHỈ với khách trên đích guarded", () => {
    const guarded = NAV_ITEMS.find((i) => i.href === "/exams")!;

    expect(navPrefetch(guarded, false)).toBe(false);
    expect(navPrefetch(guarded, true)).toBeUndefined();
  });

  it("không đụng tới đích công khai, dù đã đăng nhập hay chưa", () => {
    const home = NAV_ITEMS.find((i) => i.href === "/")!;

    expect(navPrefetch(home, false)).toBeUndefined();
    expect(navPrefetch(home, true)).toBeUndefined();
  });

  it("mục Account của khách (/?auth=signin) vẫn được prefetch", () => {
    // Đây là đích THẬT của khách — chính là trang mà bốn mục kia đang phí công
    // prefetch gián tiếp. Tắt nó đi là tối ưu nhầm hướng.
    const account = GUEST_NAV_ITEMS.find((i) => i.href === "/?auth=signin")!;

    expect(navPrefetch(account, false)).toBeUndefined();
  });
});
