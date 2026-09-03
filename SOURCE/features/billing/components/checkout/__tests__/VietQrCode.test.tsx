// @vitest-environment jsdom

// C-12 `VietQrCode` — plan Task 4.3.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Component: `VietQrCode` — C-12
// Design:   docs/design/subscription-frontend-design.md § C-12, § code:18
//
// TWO CLAIMS, AND THEY ARE NOT THE SAME CLAIM.
//
//   (1) ABSENT ENCODER IS A SPECIFIED STATE. ADR-0018 (BU-2) is open, so
//       `package.json` carries no encoder. The component must render NOTHING
//       and must not throw — the page around it keeps rendering and the
//       transfer block (C-14) is the operative path. That is AC-028, not a
//       degradation.
//   (2) THE DEFAULT CELL OF THE UI SPEC MATRIX STILL HAS A RENDERED
//       DESTINATION. The matrix-to-SVG renderer is real, shipped and asserted
//       here against a hand-built matrix, so the day `encodeQrMatrix()` starts
//       returning a matrix the quiet zone, the sizing, the palette and the
//       label are already proven.
//
//       STATED LIMITATION, so nobody reads more into this file than it says:
//       production cannot reach `QrSvg` today, because the seam returns null.
//       These cases prove the renderer's shape, NOT that the screen shows a QR.
//
// THE MATRIX FIXTURE IS ASYMMETRIC ON PURPOSE. A symmetric one makes a
// row/column transpose invisible, and a transpose is the likeliest defect in a
// matrix renderer — it scans as a different code, or as none.
//
// No setupFiles ⇒ no jest-dom matchers; raw DOM reads only. The tree goes
// through renderServerTree() into a container detached from `document`, so
// there is nothing to clean up between cases.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import { en } from "@/lib/i18n/dictionaries/en";
import { QrSvg, VietQrCode, type QrMatrix } from "@/features/billing/components/checkout/VietQrCode";

// A VietQR/EMVCo payload prefix — a STRING, never a URL (UI Spec C-12).
const PAYLOAD = "00020101021238QRPAYLOAD5802VN630412AB";

// 5x5, asymmetric under transpose: [0][3] is dark while [3][0] is light.
// Eight dark modules, hand-counted — the expected count is NOT recomputed here
// by the same expression the component uses.
const MATRIX: QrMatrix = [
  [true, false, false, true, false],
  [false, true, false, false, false],
  [true, false, true, false, false],
  [false, false, false, true, false],
  [false, true, false, false, true],
];
const TRUE_MODULES = 8;
const QUIET_ZONE = 4;

describe("C-12 VietQrCode — the absent-encoder state (BU-2 / ADR-0018 open)", () => {
  // ==========================================================================
  // Rejects: an implementation that throws when it finds no encoder (it takes
  // the whole payment screen down); one that falls back to an <img src> at the
  // provider (blocked by `img-src` in EVERY environment, csp.ts:56); one that
  // renders an empty <svg> box that reads as a broken image.
  // ==========================================================================
  it("renders nothing at all for a valid payload while no encoder exists", async () => {
    const { container } = await renderServerTree(await VietQrCode({ payload: PAYLOAD }));

    expect(container.innerHTML).toBe("");
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  // ==========================================================================
  // Rejects: an implementation that encodes whatever it is handed, including
  // the empty string a half-written row could carry.
  // ==========================================================================
  it("renders nothing for an empty payload", async () => {
    const { container } = await renderServerTree(await VietQrCode({ payload: "" }));

    expect(container.innerHTML).toBe("");
  });

  // ==========================================================================
  // The CSP claim, asserted on source text because no runtime today can
  // exercise it. Rejects: any future edit that reaches for a provider-hosted
  // image or a browser fetch to payOS.
  //
  // The anchors are asserted to MATCH FIRST — a path typo, or a comment
  // stripper that ate the whole file, would make every `not.toMatch` below
  // pass against nothing at all.
  // ==========================================================================
  it("names no provider origin, no <img> and no fetch", () => {
    const src = readFileSync(
      join(import.meta.dirname, "..", "VietQrCode.tsx"),
      "utf8"
    );
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");

    expect(code).toContain("export function QrSvg");
    expect(code).toContain("encodeQrMatrix");
    expect(code).not.toMatch(/<img\b/);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code.toLowerCase()).not.toContain("payos");
    expect(code).not.toContain("http");
  });
});

describe("C-12 QrSvg — the Default cell of the UI Spec matrix", () => {
  async function renderSvg(matrix: QrMatrix) {
    const { container } = await renderServerTree(
      <QrSvg matrix={matrix} label={en["billing.checkout.qrLabel"]} />
    );
    const svg = container.querySelector("svg");
    if (svg === null) throw new Error("QrSvg rendered no <svg>");
    return { container, svg };
  }

  // ==========================================================================
  // Rejects: `aria-hidden` (silence about a visible element — AC-043 forbids
  // it); a hard-coded English label; a missing role that leaves the element
  // unannounced.
  // ==========================================================================
  it("announces itself as an image carrying the dictionary label", async () => {
    const { svg } = await renderSvg(MATRIX);

    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe(en["billing.checkout.qrLabel"]);
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
    // Real copy, not a key that leaked through because the entry is absent.
    expect(en["billing.checkout.qrLabel"]).not.toContain("billing.");
  });

  // ==========================================================================
  // THE QUIET ZONE. Rejects: a viewBox equal to the module count (no quiet
  // zone at all); a quiet zone on two sides only; a 1- or 2-module margin.
  //
  // The expected numbers come from the FIXTURE's dimensions plus the specified
  // constant, not from anything the component computed.
  // ==========================================================================
  it("keeps a quiet zone of at least four modules on all four sides", async () => {
    const { svg } = await renderSvg(MATRIX);

    expect(svg.getAttribute("viewBox")).toBe("0 0 13 13"); // 5 modules + 4 + 4

    const rects = [...svg.querySelectorAll("rect")];
    const xs = rects.map((r) => Number(r.getAttribute("x")));
    const ys = rects.map((r) => Number(r.getAttribute("y")));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(QUIET_ZONE);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(QUIET_ZONE);
    expect(Math.max(...xs)).toBeLessThanOrEqual(13 - QUIET_ZONE - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(13 - QUIET_ZONE - 1);
  });

  // ==========================================================================
  // THE TRANSPOSE CASE. Rejects: a renderer that walks the matrix column-major
  // — it places [0][3] at row 3, column 0. Only an asymmetric fixture sees it.
  // ==========================================================================
  it("places every dark module at its own row and column, not transposed", async () => {
    const { svg } = await renderSvg(MATRIX);

    const placed = new Set(
      [...svg.querySelectorAll("rect")].map((r) => `${r.getAttribute("x")},${r.getAttribute("y")}`)
    );

    expect(placed.size).toBe(TRUE_MODULES);
    // x is the COLUMN, y is the ROW, both shifted by the quiet zone.
    expect(placed.has("7,4")).toBe(true); // MATRIX[0][3] — dark
    expect(placed.has("4,7")).toBe(false); // MATRIX[3][0] — light
    expect(placed.has("4,4")).toBe(true); // MATRIX[0][0]
    expect(placed.has("8,8")).toBe(true); // MATRIX[4][4]
    expect(placed.has("5,5")).toBe(true); // MATRIX[1][1]
    expect(placed.has("5,4")).toBe(false); // MATRIX[0][1] — light
  });

  // ==========================================================================
  // Rejects: a renderer that paints the LIGHT modules; one that paints every
  // cell (a solid square); one that silently drops modules.
  // ==========================================================================
  it("paints exactly the dark modules and no others", async () => {
    const { svg } = await renderSvg(MATRIX);
    expect(svg.querySelectorAll("rect")).toHaveLength(TRUE_MODULES);

    const { svg: blank } = await renderSvg([
      [false, false],
      [false, false],
    ]);
    expect(blank.querySelectorAll("rect")).toHaveLength(0);
  });

  // ==========================================================================
  // THE PALETTE AND THE BOX. Rejects: vermilion modules (`.claude/MEMORY.md`
  // forbids the primary over large blocks, and scanners want maximum luminance
  // contrast anyway); a hard-coded hex; a box that overflows at 360px.
  // ==========================================================================
  it("uses --foreground on --background at the specified box size", async () => {
    const { svg } = await renderSvg(MATRIX);

    const classes = (svg.getAttribute("class") ?? "").split(/\s+/);
    for (const required of [
      "w-full",
      "max-w-[16rem]",
      "mx-auto",
      "bg-background",
      "text-foreground",
    ]) {
      expect(classes).toContain(required);
    }
    for (const forbidden of ["bg-primary", "text-primary", "fill-primary", "text-brand"]) {
      expect(classes).not.toContain(forbidden);
    }

    for (const rect of svg.querySelectorAll("rect")) {
      expect(rect.getAttribute("fill")).toBe("currentColor");
    }
    expect(svg.outerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
