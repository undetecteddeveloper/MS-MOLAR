// JSON-LD trang chủ.
//
// Điều đáng test ở đây KHÔNG phải "hàm có trả object không" — mà là hai thứ
// hỏng im lặng: (1) URL tương đối/thiếu origin thì Google bỏ qua cả node mà
// không báo gì cho ai, và (2) chuỗi `</script>` lọt vào khối inline sẽ cắt đôi
// thẻ script — lỗi này không thể phát hiện bằng mắt vì trang vẫn render bình
// thường, chỉ có structured data biến mất (hoặc tệ hơn: HTML bị chèn).

import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/siteUrl";
import { buildHomeJsonLd, serializeJsonLd } from "../jsonLd";

type Node = Record<string, unknown>;

const graph = (locale: "en" | "vi") => buildHomeJsonLd(locale)["@graph"] as Node[];
const nodeOfType = (locale: "en" | "vi", type: string) =>
  graph(locale).find((n) => n["@type"] === type) as Node;

describe("buildHomeJsonLd", () => {
  it("mọi url/@id đều tuyệt đối theo SITE_URL — đường dẫn tương đối bị Google bỏ qua trong im lặng", () => {
    for (const node of graph("en")) {
      expect(String(node["@id"]).startsWith(`${SITE_URL}/#`)).toBe(true);
      expect(String(node.url).startsWith(SITE_URL)).toBe(true);
    }
    expect(String(nodeOfType("en", "Organization").logo).startsWith(SITE_URL)).toBe(true);
  });

  it("WebSite trỏ publisher về ĐÚNG @id của Organization — sai id là hai thực thể rời nhau", () => {
    const org = nodeOfType("en", "Organization");
    const site = nodeOfType("en", "WebSite");
    expect(site.publisher).toEqual({ "@id": org["@id"] });
  });

  it("khai các cách viết tên thương hiệu mà người dùng thật sẽ gõ", () => {
    // Mục tiêu duy nhất của khối này là tìm-theo-tên (SEO-TODO.md): thiếu biến
    // thể có dấu cách thì "MS MOLAR" không khớp được với "MS-MOLAR".
    const alt = nodeOfType("vi", "Organization").alternateName as string[];
    expect(alt).toContain("MS MOLAR");
    expect(alt).toContain("MSMOLAR");
  });

  it("mô tả và inLanguage đi theo ngôn ngữ đang render, không hard-code một thứ tiếng", () => {
    expect(nodeOfType("vi", "WebSite").inLanguage).toBe("vi-VN");
    expect(nodeOfType("en", "WebSite").inLanguage).toBe("en-US");
    expect(nodeOfType("vi", "Organization").description).not.toBe(
      nodeOfType("en", "Organization").description,
    );
  });
});

describe("serializeJsonLd", () => {
  it("không để lọt `<` nào — một `</script>` trong dữ liệu là cắt đôi thẻ script", () => {
    const out = serializeJsonLd({ name: "</script><img src=x onerror=alert(1)>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c");
  });

  it("escape vẫn parse ngược ra đúng chuỗi gốc — nếu không thì Google đọc sai tên", () => {
    const value = "a < b </script>";
    expect(JSON.parse(serializeJsonLd({ name: value })).name).toBe(value);
  });

  it("đầu ra của buildHomeJsonLd nhét được vào thẻ inline mà không chứa `<`", () => {
    expect(serializeJsonLd(buildHomeJsonLd("vi"))).not.toContain("<");
  });
});
