// @vitest-environment jsdom

// SolutionNoteBlock — Required Test #7 (task 20 file): render RichText THẬT
// (không mock) phía server, và ranh giới B4-kiểu ADR-0002/TD-021/TD-023 —
// không tệp "use client" nào dưới features/solutions/ import RichText tĩnh.
// Cùng lối "phép quét mã nguồn" của geminiChokepoint.test.ts (SOURCE/lib/ugc/
// __tests__/geminiChokepoint.test.ts): bắt cả call site TƯƠNG LAI, không chỉ
// bốn chỗ tồn tại hôm nay.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { SolutionNoteBlock } from "@/features/solutions/components/SolutionNoteBlock";

afterEach(cleanup);

describe("SolutionNoteBlock — RichText render server-direct, không dynamic import (UI-D22, ADR-0002)", () => {
  it("markdown/LaTeX thật được dựng qua RichText — không phải văn bản thô", () => {
    render(<SolutionNoteBlock text={"Vì **đạo hàm** của $x^2$ là $2x$."} titleId="note-title-1" />);

    // Markdown thật: **đậm** ra <strong>, không còn cặp ** thô trên màn.
    expect(screen.getByText("đạo hàm").tagName).toBe("STRONG");
    // KaTeX thật: sinh phần tử .katex, không hiện nguyên văn "$x^2$".
    expect(document.querySelector(".katex")).toBeTruthy();
  });

  it("khối mang aria-labelledby trỏ đúng eyebrow 'Lời giải' (UI Spec § SolutionNoteBlock)", () => {
    render(<SolutionNoteBlock text="Ghi chú." titleId="note-title-2" />);

    const eyebrow = screen.getByText("Lời giải");
    expect(eyebrow.id).toBe("note-title-2");
    expect(eyebrow.closest("section")?.getAttribute("aria-labelledby")).toBe("note-title-2");
  });

  it("nội dung nguy hiểm (script/onerror) không thực thi — RichText tự sanitize, khối này không tự thêm dangerouslySetInnerHTML", () => {
    render(<SolutionNoteBlock text={'<script>window.__xss = true;</script><img src=x onerror="window.__xss2 = true">'} titleId="note-title-3" />);

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[onerror]")).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });
});

const SOLUTIONS_ROOT = path.join(process.cwd(), "features/solutions");
const CODE_FILE = /\.(?:tsx?|jsx?)$/;
const TEST_FILE = /\.test\.[jt]sx?$/;
const USE_CLIENT_RE = /^\s*["']use client["'];?\s*$/m;
const RICHTEXT_IMPORT_RE = /from\s+["'][^"']*\/components\/shared\/RichText["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_FILE.test(entry) && !TEST_FILE.test(entry)) out.push(full);
  }
  return out;
}

describe("Ranh giới server/client của RichText dưới features/solutions/ (ADR-0002, TD-021/TD-023)", () => {
  it("không tệp \"use client\" nào import RichText tĩnh", () => {
    const offenders = walk(SOLUTIONS_ROOT)
      .filter((full) => {
        const code = readFileSync(full, "utf8");
        return USE_CLIENT_RE.test(code) && RICHTEXT_IMPORT_RE.test(code);
      })
      .map((full) => path.relative(SOLUTIONS_ROOT, full).split(path.sep).join("/"));

    expect(offenders).toEqual([]);
  });

  it("SolutionNoteBlock.tsx là nơi import RichText tĩnh, và KHÔNG mang \"use client\"", () => {
    const code = readFileSync(path.join(SOLUTIONS_ROOT, "components/SolutionNoteBlock.tsx"), "utf8");

    expect(USE_CLIENT_RE.test(code)).toBe(false);
    expect(RICHTEXT_IMPORT_RE.test(code)).toBe(true);
  });
});
