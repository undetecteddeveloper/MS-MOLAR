// @vitest-environment jsdom

// generateAttemptPdf — unit tests for the single shared PDF-generation module
// (Work Plan Phase 2 Task 2.4, AC-007). Binding Decisions (ADR-0009 §
// Implementation Guidance, history-work-plan-task-09.md):
//  - placement: jspdf/html2canvas/react-dom/react-dom/client dynamically
//    imported only inside generateAttemptPdfFile's async body.
//  - data_flow: exactly one doc.output("blob") call site, shared by Save/Share.
//  - dependency_direction: exactly one exported PDF-generation entry point.
//  - persistence: zero network/fetch calls, no server-side module touched.
// Reference Contract: File.name equals buildPdfFilename's real (unmocked)
// output — no independent filename logic duplicated in this module.
// Mock boundary: jsPDF/html2canvas/react-dom/react-dom/client are mocked
// (determinism, no real canvas rasterization in this suite, per frontend DD
// Test Boundaries); buildPdfFilename/formatSubmittedDate/formatCompletionTime
// and AttemptPdfTemplate are real (Task 07/08's already-tested contracts).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPdfFilename } from "@/lib/history/format";
import type { AttemptPdfData } from "./generateAttemptPdf";

const SOURCE_PATH = join(process.cwd(), "lib/pdf/generateAttemptPdf.ts");
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf-8");

const {
  jsPDFCtor,
  jsPDFInstance,
  html2canvasMock,
  createRootMock,
  rootInstance,
  flushSyncMock,
} = vi.hoisted(() => {
  const jsPDFInstance = {
    addImage: vi.fn(),
    output: vi.fn(() => new Blob(["pdf-bytes"], { type: "application/pdf" })),
  };
  const jsPDFCtor = vi.fn(function jsPDFMock() {
    return jsPDFInstance;
  });
  const html2canvasMock = vi.fn(async () => ({
    width: 1440,
    height: 800,
    toDataURL: () => "data:image/png;base64,mock",
  }));
  const rootInstance = { render: vi.fn(), unmount: vi.fn() };
  const createRootMock = vi.fn(() => rootInstance);
  const flushSyncMock = vi.fn((cb: () => void) => cb());
  return { jsPDFCtor, jsPDFInstance, html2canvasMock, createRootMock, rootInstance, flushSyncMock };
});

vi.mock("jspdf", () => ({ default: jsPDFCtor }));
vi.mock("html2canvas", () => ({ default: html2canvasMock }));
vi.mock("react-dom/client", () => ({ createRoot: createRootMock }));
vi.mock("react-dom", () => ({ flushSync: flushSyncMock }));

const { generateAttemptPdfFile, downloadPdfFile, canShareFile } = await import(
  "./generateAttemptPdf"
);

const SAMPLE_DATA: AttemptPdfData = {
  subject: "Math",
  examTitle: "Mock Exam #3",
  totalScore: 8.5,
  examineeName: "Nguyen Phat",
  submittedAt: "2026-07-15T09:12:34.000Z",
  correct: 8,
  total: 10,
};

describe("generateAttemptPdf — dynamic-import boundary (Binding Decision: placement)", () => {
  it("never statically imports jspdf/html2canvas/react-dom/react-dom/client at the top level", () => {
    const staticImportLines = SOURCE_TEXT.split("\n").filter((line) =>
      /^\s*import\s+.*\bfrom\s+["'](jspdf|html2canvas|react-dom|react-dom\/client)["']/.test(
        line,
      ),
    );
    expect(staticImportLines).toEqual([]);
  });

  it("dynamically imports all four libraries inside generateAttemptPdfFile's body", () => {
    expect(SOURCE_TEXT).toContain('import("jspdf")');
    expect(SOURCE_TEXT).toContain('import("html2canvas")');
    expect(SOURCE_TEXT).toContain('import("react-dom")');
    expect(SOURCE_TEXT).toContain('import("react-dom/client")');
  });
});

describe("generateAttemptPdf — single Blob-producing call (Binding Decision: data_flow)", () => {
  it("contains exactly one doc.output(\"blob\") call site", () => {
    const outputCalls = SOURCE_TEXT.match(/\.output\(/g) ?? [];
    expect(outputCalls).toHaveLength(1);
    expect(SOURCE_TEXT).toContain('doc.output("blob")');
  });
});

describe("generateAttemptPdf — single implementation (Binding Decision: dependency_direction)", () => {
  it("exports exactly generateAttemptPdfFile/downloadPdfFile/canShareFile at runtime", async () => {
    const mod = await import("./generateAttemptPdf");
    expect(Object.keys(mod).sort()).toEqual(
      ["canShareFile", "downloadPdfFile", "generateAttemptPdfFile"].sort(),
    );
  });

  it("SOURCE/lib/pdf/ contains only this module and its test file", () => {
    const entries = readdirSync(join(process.cwd(), "lib/pdf")).sort();
    expect(entries).toEqual(["generateAttemptPdf.test.ts", "generateAttemptPdf.ts"]);
  });
});

describe("generateAttemptPdf — client-only, zero server touch (Binding Decision: persistence)", () => {
  it("makes no network/fetch calls and imports no server-side module", () => {
    expect(SOURCE_TEXT).not.toMatch(/\bfetch\(/);
    expect(SOURCE_TEXT).not.toMatch(/from\s+["'].*\/queries["']/);
    expect(SOURCE_TEXT).not.toMatch(/from\s+["'].*\/actions["']/);
    expect(SOURCE_TEXT).not.toMatch(/from\s+["'].*lib\/supabase/);
  });
});

describe("generateAttemptPdfFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a File whose name equals buildPdfFilename's real, unmocked output (Reference Contract)", async () => {
    const file = await generateAttemptPdfFile(SAMPLE_DATA);

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("application/pdf");
    expect(file.name).toBe(buildPdfFilename(SAMPLE_DATA.examTitle, SAMPLE_DATA.submittedAt));
  });

  it("derives the filename the same way when submittedAt is null", async () => {
    const data = { ...SAMPLE_DATA, submittedAt: null };
    const file = await generateAttemptPdfFile(data);

    expect(file.name).toBe(buildPdfFilename(data.examTitle, data.submittedAt));
  });

  it("mounts the off-screen container and always removes it on success", async () => {
    const bodyChildCountBefore = document.body.children.length;

    await generateAttemptPdfFile(SAMPLE_DATA);

    expect(document.body.children.length).toBe(bodyChildCountBefore);
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(rootInstance.render).toHaveBeenCalledTimes(1);
    expect(rootInstance.unmount).toHaveBeenCalledTimes(1);
  });

  it("rejects and still removes the off-screen container when html2canvas fails", async () => {
    const bodyChildCountBefore = document.body.children.length;
    html2canvasMock.mockRejectedValueOnce(new Error("oklch parse error"));

    await expect(generateAttemptPdfFile(SAMPLE_DATA)).rejects.toThrow("oklch parse error");

    expect(document.body.children.length).toBe(bodyChildCountBefore);
    expect(rootInstance.unmount).toHaveBeenCalledTimes(1);
  });

  it("rejects and still removes the off-screen container when the jsPDF constructor fails", async () => {
    const bodyChildCountBefore = document.body.children.length;
    jsPDFCtor.mockImplementationOnce(function jsPDFThrowingMock() {
      throw new Error("jsPDF construction failed");
    });

    await expect(generateAttemptPdfFile(SAMPLE_DATA)).rejects.toThrow(
      "jsPDF construction failed",
    );

    expect(document.body.children.length).toBe(bodyChildCountBefore);
    expect(rootInstance.unmount).toHaveBeenCalledTimes(1);
  });

  it("rejects and never returns a partial/corrupt File when doc.output fails", async () => {
    const bodyChildCountBefore = document.body.children.length;
    jsPDFInstance.output.mockImplementationOnce(() => {
      throw new Error("output failed");
    });

    let resolved: File | undefined;
    await expect(
      generateAttemptPdfFile(SAMPLE_DATA).then((file) => {
        resolved = file;
        return file;
      }),
    ).rejects.toThrow("output failed");

    expect(resolved).toBeUndefined();
    expect(document.body.children.length).toBe(bodyChildCountBefore);
  });
});

describe("downloadPdfFile", () => {
  it("triggers a browser download via a transient <a download> + object URL, revoked immediately after", () => {
    const file = new File(["pdf-bytes"], "mock-exam_20260731.pdf", {
      type: "application/pdf",
    });
    const objectUrl = "blob:mock-url";
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue(objectUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const bodyChildCountBefore = document.body.children.length;

    expect(() => downloadPdfFile(file)).not.toThrow();

    expect(createObjectURLSpy).toHaveBeenCalledWith(file);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(objectUrl);
    expect(document.body.children.length).toBe(bodyChildCountBefore);

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

describe("canShareFile", () => {
  const file = new File(["pdf-bytes"], "mock-exam_20260731.pdf", { type: "application/pdf" });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
  });

  it("returns true only when navigator.share/canShare exist and canShare({files}) is true", () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn(() => true),
      configurable: true,
    });

    expect(canShareFile(file)).toBe(true);
  });

  it("returns false, never throws, when the Web Share API is entirely absent", () => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");

    expect(() => canShareFile(file)).not.toThrow();
    expect(canShareFile(file)).toBe(false);
  });

  it("returns false when navigator.canShare({files}) itself returns false", () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn(() => false),
      configurable: true,
    });

    expect(canShareFile(file)).toBe(false);
  });
});
