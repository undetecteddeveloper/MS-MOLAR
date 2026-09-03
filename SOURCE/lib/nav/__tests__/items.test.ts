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

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
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

describe("mọi thanh điều hướng đều đi qua navPrefetch", () => {
  // ĐÂY LÀ MỘT TEST QUÉT MÃ NGUỒN, và nó tồn tại vì một lỗi thật.
  //
  // Bản vá prefetch đầu tiên (2026-08-27) sửa SiteHeader + BottomNav rồi coi
  // như xong — đo lại trên preview thì lãng phí VẪN NGUYÊN, vì trang chủ dùng
  // một nav THỨ BA (`HomeSidebar`) cũng đọc cùng danh sách. Đúng cái bệnh mà
  // `lib/nav/items.ts` ra đời để chữa: danh sách thì gộp được về một chỗ,
  // nhưng CÁCH DÙNG nó thì vẫn nằm rải rác ở từng component.
  //
  // Kiểm bằng render thì phải dựng ba component với ba bộ prop khác nhau và
  // vẫn sót component thứ tư khi ai đó thêm nó. Quét nguồn thì bắt được đúng
  // câu hỏi cần hỏi: "có file nào render NAV_ITEMS mà không hỏi navPrefetch
  // không?"
  // features/ (B2, 2026-09-03): HomeSidebar (nav trang chủ) nay ở
  // features/auth/components/ — thiếu gốc này thì phép quét đếm thiếu một thanh
  // và ca "ít nhất 3 file" bên dưới đỏ đúng như nó được thiết kế để đỏ.
  const roots = ["app", "components", "features"];

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
      return p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
    });
  }

  it("không file nào render danh sách nav mà bỏ qua navPrefetch", () => {
    const offenders: string[] = [];

    for (const root of roots) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        // Chỉ quan tâm file THỰC SỰ import danh sách rồi map ra <Link>.
        const importsList = /import\s*\{[^}]*\b(NAV_ITEMS|GUEST_NAV_ITEMS)\b[^}]*\}\s*from\s*["']@\/lib\/nav\/items["']/.test(
          src
        );
        if (!importsList) continue;
        if (!src.includes("<Link")) continue;
        if (!src.includes("navPrefetch")) offenders.push(file.replace(/\\/g, "/"));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("quét thật sự tìm thấy các nav đang có — nếu 0 file thì phép quét đã hỏng", () => {
    // Không có mục này thì một regex gõ sai sẽ cho ra "0 file vi phạm" và test
    // trên xanh vĩnh viễn trong khi nó không còn kiểm gì cả.
    const navFiles = roots
      .flatMap((r) => walk(r))
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return (
          /import\s*\{[^}]*\b(NAV_ITEMS|GUEST_NAV_ITEMS)\b[^}]*\}\s*from\s*["']@\/lib\/nav\/items["']/.test(
            src
          ) && src.includes("<Link")
        );
      });

    expect(navFiles.length).toBeGreaterThanOrEqual(3);
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
