// noStaticRichTextImport.test.ts — permanent source-level guard for the M12
// bundle-budget claim (frontend DD § Risks and Mitigation, verbatim: "`RichText`
// gets statically imported from a `features/solutions` client file, silently
// re-adding ~122 KB gzip with no automated gate to catch it"). Task 48 (P5-T9).
//
// Rule: any file under `features/solutions/` carrying the literal `"use client"`
// directive must never statically `import { RichText } from
// "@/components/shared/RichText"` — only the `dynamic(() => import(...))`
// pattern is allowed (precedent: `features/authoring/components/
// QuestionEditor.tsx:78-85`; followed inside this feature by
// `FormulaPreview.tsx:28-34` and `CommentItem.tsx:53-60`). Server Components
// (e.g. `SolutionNoteBlock.tsx`, `writerQuestionNodes.tsx`,
// `CommentNotificationCard.tsx`) are exempt — they carry no `"use client"`
// directive, so they ship zero client JS regardless of what they import
// (TD-021/ADR-0002).
//
// `SolutionNoteBlock.test.tsx` already carries an equivalent scan (added as a
// companion to that file's render tests). This file is the dedicated,
// TDD-provable guard the task explicitly asks for: it exposes the detection
// logic as a plain function so the Red phase can point it at IN-TEST fixture
// strings (not real files) before the Green phase asserts the real tree is
// clean.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Toàn dòng, không phải substring — vài file server thuần chỉ NHẮC tới cụm
// "use client" trong comment cảnh báo (`CommentNotificationCard.tsx:4`,
// `ReputationBlock.tsx:3`, `SolutionNoteBlock.tsx:8`, `OwnSolutionBlock.tsx:6`,
// `writerQuestionNodes.tsx:4-5`) mà không mang directive thật; một substring
// match sẽ báo động giả trên cả năm file đó.
const USE_CLIENT_RE = /^\s*["']use client["'];?\s*$/m;

// Bắt cú pháp `import … from "@/components/shared/RichText"` (mặc định hoặc
// named). `[^;]*` đã khớp xuống dòng (nó chỉ loại trừ dấu `;`, không cần cờ
// `s`/dotAll — target ES2017 của tsconfig.json không cho cờ đó) và tự chặn ở
// dấu `;` đầu tiên nên không lan sang statement kế tiếp. Cụm `[^(]` sau
// `import\s+` loại trừ `import("…")` dạng gọi hàm — đó là mẫu
// `dynamic()`/`warmRichText()` được phép.
const STATIC_RICHTEXT_IMPORT_RE = /import\s+[^(][^;]*\s+from\s+["'][^"']*\/components\/shared\/RichText["']/;

/** Phần lõi có thể test độc lập trên MỘT chuỗi nguồn — dùng cho cả fixture
 *  in-test (Red phase) lẫn quét cây thật (Green phase). */
export function isOffendingSource(code: string): boolean {
  return USE_CLIENT_RE.test(code) && STATIC_RICHTEXT_IMPORT_RE.test(code);
}

const SOLUTIONS_ROOT = path.join(process.cwd(), "features/solutions");
const CODE_FILE_RE = /\.(?:tsx?|jsx?)$/;
const TEST_FILE_RE = /\.test\.[jt]sx?$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_FILE_RE.test(entry) && !TEST_FILE_RE.test(entry)) out.push(full);
  }
  return out;
}

describe("isOffendingSource — Red phase: phân biệt import tĩnh RichText khỏi mẫu dynamic() được phép", () => {
  it("PHÁT HIỆN một chuỗi fixture in-test (không phải file thật) chứa use client + import tĩnh RichText named", () => {
    const staticNamedImportFixture = [
      '"use client";',
      "",
      'import { RichText } from "@/components/shared/RichText";',
      "",
      'export function Bad() { return RichText; }',
    ].join("\n");

    expect(isOffendingSource(staticNamedImportFixture)).toBe(true);
  });

  it("PHÁT HIỆN import mặc định tĩnh (không chỉ named)", () => {
    const staticDefaultImportFixture = [
      '"use client";',
      "",
      'import RichText from "@/components/shared/RichText";',
    ].join("\n");

    expect(isOffendingSource(staticDefaultImportFixture)).toBe(true);
  });

  it("KHÔNG báo lỗi mẫu dynamic() được phép (giống FormulaPreview.tsx/CommentItem.tsx/QuestionEditor.tsx:78-85)", () => {
    const dynamicImportFixture = [
      '"use client";',
      "",
      'import dynamic from "next/dynamic";',
      "",
      'const LazyRichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), { ssr: false });',
      "",
      'export function warmRichText() {',
      '  void import("@/components/shared/RichText");',
      "}",
    ].join("\n");

    expect(isOffendingSource(dynamicImportFixture)).toBe(false);
  });

  it("KHÔNG báo lỗi Server Component import tĩnh RichText nhưng không mang directive \"use client\" (mẫu SolutionNoteBlock.tsx)", () => {
    const serverComponentFixture = [
      "// server component, không \"use client\" — an toàn để import tĩnh",
      "",
      'import { RichText } from "@/components/shared/RichText";',
      "",
      'export function Ok() { return RichText; }',
    ].join("\n");

    expect(isOffendingSource(serverComponentFixture)).toBe(false);
  });

  it("KHÔNG báo lỗi khi cụm \"use client\" chỉ xuất hiện TRONG COMMENT, không phải directive thật (mẫu CommentNotificationCard.tsx:4)", () => {
    const commentOnlyMentionFixture = [
      "// Server Component THUẦN (không \"use client\", không hook) — chứa RichText",
      "// cho trích nội dung, nên KHÔNG BAO GIỜ được import từ một file \"use client\".",
      "",
      'import { RichText } from "@/components/shared/RichText";',
      "",
      'export function Ok() { return RichText; }',
    ].join("\n");

    expect(isOffendingSource(commentOnlyMentionFixture)).toBe(false);
  });
});

describe("features/solutions/** — Green phase: không tệp \"use client\" nào import RichText tĩnh trên cây thật", () => {
  it("quét toàn bộ cây (trừ __tests__); danh sách vi phạm phải rỗng", () => {
    const offenders = walk(SOLUTIONS_ROOT)
      .filter((full) => isOffendingSource(readFileSync(full, "utf8")))
      .map((full) => path.relative(SOLUTIONS_ROOT, full).split(path.sep).join("/"));

    expect(offenders).toEqual([]);
  });

  it("Refactor phase — allow-list rõ ràng: đúng 3 Server Component hôm nay import RichText tĩnh (SolutionNoteBlock, writerQuestionNodes, CommentNotificationCard), và không tệp nào trong số đó mang \"use client\"", () => {
    const EXPECTED_STATIC_IMPORTERS = new Set([
      "components/SolutionNoteBlock.tsx",
      "components/writerQuestionNodes.tsx",
      "components/CommentNotificationCard.tsx",
    ]);

    const staticImporters = walk(SOLUTIONS_ROOT)
      .filter((full) => STATIC_RICHTEXT_IMPORT_RE.test(readFileSync(full, "utf8")))
      .map((full) => path.relative(SOLUTIONS_ROOT, full).split(path.sep).join("/"));

    expect(new Set(staticImporters)).toEqual(EXPECTED_STATIC_IMPORTERS);

    for (const relPath of staticImporters) {
      const code = readFileSync(path.join(SOLUTIONS_ROOT, relPath), "utf8");
      expect(USE_CLIENT_RE.test(code)).toBe(false);
    }
  });
});
