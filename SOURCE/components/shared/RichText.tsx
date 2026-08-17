// RichText — render nội dung markdown + LaTeX (GĐ 3 M3.1 Task 5).
//
// ⚠ CỐ Ý KHÔNG CÓ `"use client"` (TD-021, 2026-08-17) ⚠
//
// Component này thuần render: không hook, không state, không handler, không API
// trình duyệt. Bỏ directive đi biến nó thành component DÙNG CHUNG — server
// component render nó ở SERVER (chỉ ra HTML), client component import nó thì nó
// đi vào bundle như trước. Đó không phải tinh chỉnh nhỏ: cây phụ thuộc của file
// này (react-markdown + remark-gfm + remark-math + rehype-katex +
// rehype-sanitize + katex) là 122.5 KB gzip — CHUNK CLIENT LỚN NHẤT của dự án,
// đo bằng bản build thật, lớn hơn toàn bộ phần JS còn lại của phần lớn route.
//
// Vì thế: THÊM `"use client"` VÀO ĐÂY LÀ ĐẨY 122.5 KB GZIP SANG TRÌNH DUYỆT cho
// MỌI route render nội dung câu hỏi, kể cả route thuần đọc. Cần state/hook thì
// bọc một component client MỎNG ở ngoài rồi truyền chuỗi vào, đừng đổi file này.
//
// Đã ĐO cả 4 tổ hợp trên bản build thật, vì một mình directive này KHÔNG đủ:
// route /result/detail chỉ tụt 181.8K → 60.7K gzip khi file này bỏ "use client"
// VÀ ExplainStepAffordance nạp động; bỏ directive mà vẫn còn một import tĩnh từ
// component client thì route đứng nguyên 181.8K.
//
// Dùng cho nội dung câu hỏi và lựa chọn đáp án (Layer 2), tái dùng được cho layer khác.
//
// HARDENED cho nội dung KHÔNG TIN CẬY (UGC v2.0, ADR-0002 / Task 3.1 — Gate B):
// Pipeline: remark-gfm + remark-math → rehype-katex (KATEX_SAFE_OPTIONS)
//           → rehype-sanitize (SANITIZE_SCHEMA) — sanitize chạy CUỐI để backstop
//           cả output của KaTeX (advisory GHSA-64fm-8hw2-v72w, GHSA-cvr6-37gx-v8wc,
//           CVE-2025-23207).
// BẤT BIẾN (được XSS fixtures canh giữ — xem __tests__/RichText.xss.test.tsx):
//   - KHÔNG BAO GIỜ thêm rehype-raw (raw HTML không được parse).
//   - KHÔNG BAO GIỜ override urlTransform của react-markdown (giữ default an toàn).
//   - KHÔNG BAO GIỜ đặt KaTeX trust: true.
// `inline` = true: bỏ thẻ <p> bao quanh (dùng trong nhãn lựa chọn, không xuống dòng block).

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";

// KaTeX an toàn cho input không tin cậy (Design Doc §KaTeX safe config):
// trust:false chặn \href/\includegraphics/\htmlData; maxExpand chặn DoS \edef/
// macro lồng nhau; maxSize chặn \rule khổng lồ; throwOnError:false để câu lỗi
// LaTeX hiển thị dạng văn bản lỗi thay vì làm vỡ trang.
const KATEX_SAFE_OPTIONS = {
  trust: false,
  throwOnError: false,
  maxExpand: 100,
  maxSize: 50,
  strict: false,
};

// Nhóm thuộc tính trình bày cho phép trên các tag do KaTeX phát ra.
// style là bắt buộc (KaTeX định vị bằng inline style); an toàn vì các tag này
// KHÔNG thể tự tạo từ markdown (không rehype-raw) — chỉ KaTeX sinh ra chúng,
// và sanitize vẫn lọc mọi on*/protocol nguy hiểm.
const KATEX_PRESENTATION = ["className", "style"];

// Tag MathML + SVG mà KaTeX HTML/MathML output cần (Design Doc §allowlist schema).
const KATEX_TAGS = [
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "mspace",
  "mfrac",
  "msup",
  "msub",
  "msubsup",
  "msqrt",
  "mroot",
  "mstyle",
  "mtable",
  "mtr",
  "mtd",
  "mlabeledtr",
  "mover",
  "munder",
  "munderover",
  "menclose",
  "mpadded",
  "mphantom",
  "svg",
  "path",
  "line",
  "g",
];

// Mở rộng defaultSchema (GitHub-style: giữ subset GFM seed đang dùng, chặn
// script/iframe/style/on*/protocol lạ by construction) để cho KaTeX đi qua.
const SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...KATEX_TAGS])],
  attributes: {
    ...defaultSchema.attributes,
    // KaTeX HTML output: span.class + style định vị + aria-hidden trên nhánh HTML.
    span: [...KATEX_PRESENTATION, "ariaHidden"],
    // Nhánh MathML.
    math: [...KATEX_PRESENTATION, "xmlns", "display"],
    annotation: [...KATEX_PRESENTATION, "encoding"],
    semantics: KATEX_PRESENTATION,
    mrow: KATEX_PRESENTATION,
    mi: [...KATEX_PRESENTATION, "mathvariant"],
    mo: [
      ...KATEX_PRESENTATION,
      "stretchy",
      "fence",
      "separator",
      "lspace",
      "rspace",
      "minsize",
      "maxsize",
      "movablelimits",
      "symmetric",
      "accent",
    ],
    mn: KATEX_PRESENTATION,
    ms: KATEX_PRESENTATION,
    mtext: KATEX_PRESENTATION,
    mspace: [...KATEX_PRESENTATION, "width", "height", "depth"],
    mfrac: [...KATEX_PRESENTATION, "linethickness"],
    msup: KATEX_PRESENTATION,
    msub: KATEX_PRESENTATION,
    msubsup: KATEX_PRESENTATION,
    msqrt: KATEX_PRESENTATION,
    mroot: KATEX_PRESENTATION,
    mstyle: [...KATEX_PRESENTATION, "scriptlevel", "displaystyle", "mathcolor", "mathbackground"],
    mtable: [
      ...KATEX_PRESENTATION,
      "rowspacing",
      "columnspacing",
      "columnalign",
      "rowalign",
      "columnlines",
      "rowlines",
      "width",
    ],
    mtr: KATEX_PRESENTATION,
    mtd: [...KATEX_PRESENTATION, "columnalign"],
    mlabeledtr: KATEX_PRESENTATION,
    mover: [...KATEX_PRESENTATION, "accent"],
    munder: [...KATEX_PRESENTATION, "accentunder"],
    munderover: [...KATEX_PRESENTATION, "accent", "accentunder"],
    menclose: [...KATEX_PRESENTATION, "notation"],
    mpadded: [...KATEX_PRESENTATION, "width", "height", "depth", "lspace", "voffset"],
    mphantom: KATEX_PRESENTATION,
    // SVG cho delimiter/sqrt co giãn của KaTeX.
    svg: [...KATEX_PRESENTATION, "xmlns", "width", "height", "viewBox", "preserveAspectRatio"],
    path: [...KATEX_PRESENTATION, "d"],
    line: [...KATEX_PRESENTATION, "x1", "y1", "x2", "y2", "stroke", "strokeWidth"],
    g: KATEX_PRESENTATION,
  },
};

// remark-math CHỈ hiểu $…$ / $$…$$. Nguồn đề (và Gemini, dù prompt yêu cầu $…$)
// thường xuyên trả delimiter LaTeX chuẩn \(…\) và \[…\]. Markdown coi "\(" là
// escape của "(" nên công thức bị hạ xuống văn bản thường, mất hẳn — không lỗi,
// không cảnh báo. Quy đổi TRƯỚC khi vào markdown là chỗ duy nhất sửa được cả
// nội dung ĐÃ lưu trong DB lẫn nội dung upload sau này.
// Chỉ đổi khi có cặp đóng/mở khớp nhau; sanitize vẫn chạy cuối nên không nới
// thêm quyền gì cho nội dung không tin cậy.
export function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body: string) => `$${body}$`);
}

const INLINE_COMPONENTS: Components = {
  // Gỡ <p> để text chảy inline trong nhãn lựa chọn (vẫn giữ math/format con).
  p: ({ children }) => <>{children}</>,
};

interface RichTextProps {
  /** Chuỗi nguồn (markdown + LaTeX). */
  text: string;
  /** Class cho wrapper — typography do parent quyết định (serif/size…). */
  className?: string;
  /** Inline (lựa chọn đáp án) thay vì block (nội dung câu hỏi). */
  inline?: boolean;
}

export function RichText({ text, className, inline = false }: RichTextProps) {
  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[
        [rehypeKatex, KATEX_SAFE_OPTIONS],
        [rehypeSanitize, SANITIZE_SCHEMA],
      ]}
      components={inline ? INLINE_COMPONENTS : undefined}
    >
      {normalizeMathDelimiters(text)}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{markdown}</span>;
  }
  return <div className={className}>{markdown}</div>;
}
