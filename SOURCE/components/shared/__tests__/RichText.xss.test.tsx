// @vitest-environment jsdom

// Task 3.1 (Gate B) — XSS fixtures (ADR-0002).
//
// Mỗi vector render ở CẢ HAI chỗ nội dung không tin cậy xuất hiện: stem (block)
// và choice (inline). Mỗi case khẳng định 4 điều: không <script>/<iframe>/<style>,
// không thuộc tính on*, không URL javascript:, không data: URL phi-ảnh — và
// render KHÔNG throw (throwOnError:false + sanitize backstop).
//
// Bộ này đồng thời canh giữ các BẤT BIẾN của RichText: không rehype-raw,
// không override urlTransform, không KaTeX trust:true.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "../RichText";

/** Khẳng định DOM sau render không chứa vector thực thi được. */
function assertSafe(container: HTMLElement) {
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("style")).toBeNull();
  expect(container.querySelector("object, embed, form, meta, link")).toBeNull();

  for (const el of Array.from(container.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      // Không handler on* (onerror/onload/onclick/…).
      expect(
        attr.name.toLowerCase().startsWith("on"),
        `thuộc tính ${attr.name} trên <${el.tagName.toLowerCase()}>`
      ).toBe(false);
      // Không javascript: / data: phi-ảnh trong bất kỳ giá trị thuộc tính nào.
      const value = attr.value.replace(/\s+/g, "").toLowerCase();
      expect(value.startsWith("javascript:"), `URL javascript: trong ${attr.name}`).toBe(false);
      if (value.startsWith("data:")) {
        expect(value.startsWith("data:image/"), `data: URL phi-ảnh trong ${attr.name}`).toBe(true);
      }
    }
  }
}

/** Render vector ở cả block (stem) lẫn inline (choice) rồi assert an toàn. */
function renderBoth(vector: string) {
  const block = render(<RichText text={vector} />);
  assertSafe(block.container);
  const inline = render(<RichText text={vector} inline />);
  assertSafe(inline.container);
}

describe("RichText XSS — raw HTML bị vô hiệu (không rehype-raw + sanitize)", () => {
  it("<script> không được render", () => {
    renderBoth('Câu hỏi <script>alert("xss")</script> nguy hiểm');
  });

  it("<img onerror> không được render với handler", () => {
    renderBoth('Xem hình <img src="x" onerror="alert(1)"> minh họa');
  });

  it("<iframe> không được render", () => {
    renderBoth('Nhúng <iframe src="https://evil.example"></iframe> trang');
  });

  it("<style> không được render", () => {
    renderBoth("Chèn <style>body{display:none}</style> css");
  });

  it("<svg onload> không được render với handler", () => {
    renderBoth('Vẽ <svg onload="alert(1)"><circle r="1"/></svg> hình');
  });
});

describe("RichText XSS — URL protocol nguy hiểm trong markdown", () => {
  it("link javascript: bị vô hiệu", () => {
    renderBoth("[bấm vào đây](javascript:alert(1))");
  });

  it("ảnh javascript: bị vô hiệu", () => {
    renderBoth("![hình](javascript:alert(1))");
  });

  it("entity-smuggled protocol (java&#115;cript:) bị vô hiệu", () => {
    renderBoth("[bấm](java&#115;cript:alert(1))");
  });

  it("data: URL phi-ảnh trong link bị vô hiệu", () => {
    renderBoth("[tải](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)");
  });

  it("data: URL phi-ảnh trong ảnh bị vô hiệu", () => {
    renderBoth("![x](data:text/html,<script>alert(1)</script>)");
  });

  it("reference-definition injection bị vô hiệu", () => {
    renderBoth("[x]\n\n[x]: javascript:alert(1)");
  });
});

describe("RichText XSS — KaTeX với trust:false + giới hạn tài nguyên", () => {
  it("\\href{javascript:...} trơ (không sinh <a> javascript:)", () => {
    renderBoth("Công thức $\\href{javascript:alert(1)}{an toàn}$ đây");
  });

  it("\\includegraphics trơ (không sinh <img> ngoài)", () => {
    renderBoth("$\\includegraphics[height=1em]{https://evil.example/x.png}$");
  });

  it("\\htmlData trơ (không sinh thuộc tính data tuỳ ý)", () => {
    renderBoth("$\\htmlData{onerror=alert(1)}{x}$");
  });

  it("\\edef / macro đệ quy bị chặn bởi maxExpand, không throw", () => {
    renderBoth("$\\def\\x{\\x}\\x$");
  });

  it("macro lồng nhau bùng nổ bị chặn bởi maxExpand, không throw", () => {
    renderBoth(
      "$\\def\\a{bb}\\def\\b{\\a\\a}\\def\\c{\\b\\b}\\def\\d{\\c\\c}\\def\\e{\\d\\d}\\def\\f{\\e\\e}\\e\\f$"
    );
  });

  it("\\rule khổng lồ bị chặn bởi maxSize, không throw", () => {
    renderBoth("$\\rule{1em}{100000em}$");
  });

  it("LaTeX lỗi cú pháp render dạng lỗi, không throw", () => {
    renderBoth("$\\frac{1$ và $\\unknowncommand{2}$");
  });
});

// Task 11 (M8, ADR-0002) — ghi chú bài giải cộng đồng (NoteEditor/NoteSheet,
// FormulaPreview) là bề mặt UGC MỚI đi qua ĐÚNG con đường RichText này (S15:
// "cùng chuỗi vào → cùng kết quả" với màn xem). Nhóm fixture này canh giữ đúng
// bốn vector task yêu cầu — không phải sanitize path mới, mà XÁC NHẬN sanitize
// đã có bọc được nội dung ghi chú giống hệt nội dung câu hỏi.
describe("RichText XSS — ghi chú bài giải cộng đồng (task 11, M8/ADR-0002)", () => {
  it("<script> trong ghi chú không được render", () => {
    renderBoth('Giải thích: <script>alert("xss")</script> vì đây là đáp án đúng');
  });

  it("<img onerror> trong ghi chú không được render với handler", () => {
    renderBoth('Xem hình <img src="x" onerror="alert(1)"> minh hoạ cách giải');
  });

  it("link javascript: trong ghi chú bị vô hiệu", () => {
    renderBoth("Xem thêm [tại đây](javascript:alert(1)) để rõ hơn");
  });

  it("HTML thô bên trong khối công thức không được diễn giải", () => {
    renderBoth("Vì $x^2 <script>alert(1)</script> + 1 > 0$ nên bất phương trình đúng");
  });
});
