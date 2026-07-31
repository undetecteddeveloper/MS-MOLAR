# Task 06: Add `jspdf`/`html2canvas` Dependencies (Work Plan Phase 2, Task 2.1)

Metadata:
- Dependencies: none
- Provides: `jspdf`, `html2canvas` runtime dependencies (consumed by Task 09)
- Size: Small (1 file)

## Implementation Content

Add `jspdf`, `html2canvas` to `SOURCE/package.json` as runtime dependencies — the ADR-0009-accepted PDF-generation library choice.

## Target Files
- [x] `SOURCE/package.json`

## Investigation Targets
- `SOURCE/package.json` (current dependency list — confirm no existing PDF-generation library, no version conflict with `react`/`react-dom@19.2.4`)
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Decision — the accepted library choice and version constraints; § Implementation Guidance — dynamic-import-only discipline this dependency addition must respect downstream)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | placement | `jspdf`/`html2canvas` dynamically imported only inside the Save/Share handler body — never a top-level import of any page/layout/component | Does `SOURCE/package.json` add `jspdf`/`html2canvas` as ordinary runtime dependencies without introducing any top-level import anywhere in this task's diff (this task touches only `package.json`, no import statements)? |

## Investigation Notes

**Investigation Targets read:**
- `SOURCE/package.json` — confirmed (grep, zero matches) neither `jspdf` nor `html2canvas` appeared anywhere in the file before this change; existing `dependencies` block confirmed `react@19.2.4`, `react-dom@19.2.4`, `next@16.2.7`, and no existing PDF-generation library (`mupdf@^1.28.0` is a server-side WASM PDF parser/rasterizer, unrelated per ADR-0009's own investigation).
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` § Decision / § Implementation Guidance — accepted choice is `jsPDF` + `html2canvas`, both dynamically imported only inside the Save/Share handler body, never a top-level import of any page/layout/component. Neither package declares a peer-dependency on `react`/`react-dom` (`npm view jspdf peerDependencies` / `npm view html2canvas peerDependencies` both empty) — no React-version coupling, consistent with the ADR's stated rationale.

**Versions selected**: `jspdf@^4.2.1`, `html2canvas@^1.4.1` (latest registry versions at install time, per `npm view <pkg> version`). Added to the `dependencies` block (not `devDependencies`) in `SOURCE/package.json`, alphabetically ordered between `clsx` and `katex`.

**`npm install` result**: succeeded — "added 22 packages, removed 11 packages, and audited 894 packages" — no `ERESOLVE` errors, no peer-dependency conflict messages. `npm ls jspdf html2canvas react react-dom` confirms `react@19.2.4`/`react-dom@19.2.4` remain deduped to a single copy throughout the tree (including under `html2canvas@1.4.1` and `jspdf@4.2.1`, the latter's own optional `html2canvas` dependency deduped to the same 1.4.1); no second/conflicting `react`/`react-dom` version was introduced.

**Throwaway dynamic-import verification** (scratch script written to `SOURCE/_scratch-verify-imports.mjs`, run via `node`, then deleted — not committed, confirmed via `git status --short` showing no residual file): `import("jspdf")` and `import("html2canvas")` both resolved without throwing/rejecting, satisfying this task's Operation Verification success criteria ("the throwaway dynamic import resolves both packages successfully").

**Finding for Task 09's awareness (not acted on here — out of this task's scope, no usage code written)**: `html2canvas`'s CJS `module.exports` is the function itself, so `const { default: html2canvas } = await import("html2canvas")` yields the callable constructor directly. `jspdf`'s CJS `module.exports` is instead a plain object carrying a named `jsPDF` property (confirmed via `require('jspdf')` — `typeof` is `"object"`, `typeof require('jspdf').jsPDF` is `"function"`); under Node's ESM/CJS interop, `import("jspdf")` then yields `{ default: <that same object>, jsPDF: <constructor>, ... }` — `mod.default` is **not** directly callable, but the named export `mod.jsPDF` is. The frontend Design Doc's code sample (`history-frontend-design.md:614`) destructures `{ default: jsPDF }` from `import("jspdf")`; Task 09 should verify this resolves to the constructor under the project's actual bundler (Next.js/Turbopack) — if the same shape holds under the bundler as under plain Node, the correct destructure is the named import `{ jsPDF }`, not `{ default: jsPDF }`. Recorded here only as investigation evidence; no import statement was added by this task.

**Binding Decision evaluation** (row: placement — dynamic-import-only discipline):
- Planned approach: this task touches only `SOURCE/package.json`'s `dependencies` block, adding `jspdf`/`html2canvas` as ordinary runtime dependencies; no import statement (static or dynamic) was written anywhere in this task's diff.
- Compliance Check — "Does `SOURCE/package.json` add `jspdf`/`html2canvas` as ordinary runtime dependencies without introducing any top-level import anywhere in this task's diff?": **Y**. Confirmed via `git status --short`/diff review — the only files touched are `SOURCE/package.json` and `SOURCE/package-lock.json` (the latter is `npm install`'s own lockfile update, no source file touched, no import statement anywhere in the diff).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read Investigation Targets; confirm via grep that neither `jspdf` nor `html2canvas` currently appears anywhere in `SOURCE/package.json`.
- [x] N/A — this task adds no testable logic; there is no failing test to write (a pure dependency-manifest change). Proceed directly to Green.

### 2. Green Phase
- [x] Add `jspdf` and `html2canvas` to the `dependencies` block of `SOURCE/package.json`.
- [x] Run `npm install` and confirm it succeeds with no version conflicts.

### 3. Refactor Phase
- [x] N/A.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide

## Operation Verification Methods
- **Verification method**: `npm install` succeeds; confirm importability via a throwaway dynamic `import()` call in a scratch script (not committed).
- **Success criteria**: `npm install` reports no errors/conflicts; the throwaway dynamic import resolves both packages successfully.
- **Failure response**: if a peer-dependency conflict surfaces (e.g., against `react@19.2.4`), escalate before proceeding to Task 09 — do not force-install with `--legacy-peer-deps`/`--force` without recording why.
- **Verification level**: L3 (build/install succeeds without errors).

## Completion Criteria
- [x] Dependencies installed (Implementation)
- [x] `npm install` succeeds, no version conflicts (Quality)
- [x] Confirmed importable via a throwaway dynamic `import()` call (Integration)
- [x] Every Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/package.json` only (dependency addition, no lockfile-format change beyond what `npm install` produces).
- Scope boundary: do not add any import statement in this task — that begins at Task 09.
