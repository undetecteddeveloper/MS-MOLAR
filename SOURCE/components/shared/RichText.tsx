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

// `\begin{tabular}` KHÔNG phải môi trường toán: KaTeX không hiểu nó, và bảng
// trong đề thường nằm ngoài `$…$` nên remark-math cũng không chạm tới. Kết quả
// là toàn bộ mã nguồn LaTeX của bảng đổ ra màn hình dưới dạng chữ thô — bug
// prod đề Sinh học 12 câu 38 (bảng kiểu gen/số lượng), khác hẳn `\begin{cases}`
// vốn nằm trong `$…$` và được KaTeX render đúng.
//
// Quy đổi sang bảng GFM tại tầng RENDER chứ không sửa dữ liệu: chữa được cả
// nội dung ĐÃ nằm trong DB lẫn nội dung upload sau này (prompt trích xuất đã
// được dặn dùng bảng markdown, nhưng model vẫn có thể lệch).
const TABULAR_RE = /\\begin\{tabular\}(?:\s*\{[^}]*\})?([\s\S]*?)\\end\{tabular\}/g;

/** Bỏ mọi đường kẻ ngang LaTeX (\hline, booktabs) — GFM tự kẻ bảng. */
const TABLE_RULE_RE = /\\(?:hline|toprule|midrule|bottomrule)\b/g;

function toMarkdownRow(cells: string[]): string {
  // `|` trong ô sẽ cắt nhầm cột của GFM → escape trước khi ghép.
  return `| ${cells.map((c) => c.trim().replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function tabularToMarkdownTable(text: string): string {
  return text.replace(TABULAR_RE, (whole, body: string) => {
    const rows = body
      .replace(TABLE_RULE_RE, "")
      // `\\` kết thúc dòng; `\\[2pt]` là cùng lệnh kèm khoảng cách dòng.
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      // `&` phân cột, trừ `\&` (dấu và theo nghĩa đen).
      .map((row) => row.split(/(?<!\\)&/).map((c) => c.trim()))
      .filter((cells) => cells.some((c) => c.length > 0));

    // Không đọc ra nổi hàng nào thì trả nguyên văn — thà hiện mã nguồn còn hơn
    // nuốt mất nội dung câu hỏi.
    if (rows.length === 0) return whole;

    const columns = Math.max(...rows.map((r) => r.length));
    const pad = (cells: string[]) => [...cells, ...Array(columns - cells.length).fill("")];
    const [header, ...rest] = rows;
    return [
      "",
      toMarkdownRow(pad(header)),
      toMarkdownRow(Array(columns).fill("---")),
      ...rest.map((cells) => toMarkdownRow(pad(cells))),
      "",
    ].join("\n");
  });
}

// Ở ngữ cảnh INLINE (nhãn lựa chọn A–D, ý a–d của câu Đúng/Sai) không tồn tại
// khái niệm "khối": chuỗi là một nhãn, không phải một tài liệu. Nhưng parser
// markdown vẫn chạy đủ ngữ pháp khối, nên một nhãn hợp lệ mà TÌNH CỜ trùng
// marker khối sẽ bị nuốt sạch chữ.
//
// Bug prod 2026-08-17: đề Sinh học 12 có câu cả 4 lựa chọn là "1." "2." "3."
// "4."; đề Vật lí 11 câu 21 có B = "1.". Markdown đọc "1." là marker danh sách
// đánh số → <ol><li></li></ol> RỖNG. Trên màn làm bài lựa chọn hiện ra trống
// trơn, trong khi DB lưu đúng và validate EMPTY_CHOICE vẫn pass (chuỗi có ký
// tự) — không lỗi, không cảnh báo, chỉ mất chữ.
//
// Escape bằng backslash (cú pháp escape chuẩn của markdown) thay vì đổi parser:
// giữ nguyên mọi định dạng INLINE hợp lệ (đậm/nghiêng/`code`/math) mà chỉ vô
// hiệu hoá đúng phần ngữ pháp khối. Chế độ block (thân câu hỏi) KHÔNG áp dụng —
// ở đó danh sách đánh số là nội dung thật của đề.
export function escapeBlockMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        // Danh sách đánh số: "1." / "10)" — cả khi đứng một mình (nhãn lựa chọn).
        .replace(/^(\s*)(\d{1,9})([.)])(?=\s|$)/, "$1$2\\$3")
        // Gạch đầu dòng: "- 5", "* x", "+ 2".
        .replace(/^(\s*)([-*+])(?=\s|$)/, "$1\\$2")
        // Đường kẻ ngang: "---", "***", "___".
        .replace(/^(\s*)([-*_])([-*_]{2,})\s*$/, "$1\\$2$3")
        // Heading ATX: "# 3".
        .replace(/^(\s*)(#{1,6})(?=\s|$)/, "$1\\$2")
        // Blockquote: "> 7".
        .replace(/^(\s*)>/, "$1\\>")
    )
    .join("\n");
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
      {inline
        ? escapeBlockMarkers(normalizeMathDelimiters(text))
        : // tabular TRƯỚC: thân bảng có thể chứa `\\[2pt]` (giãn dòng), đủ
          // giống `\[…\]` để normalizeMathDelimiters cắn nhầm nếu chạy trước.
          normalizeMathDelimiters(tabularToMarkdownTable(text))}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{markdown}</span>;
  }
  return <div className={className}>{markdown}</div>;
}
