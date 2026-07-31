# Task 09: `lib/pdf/generateAttemptPdf.ts` (Work Plan Phase 2, Task 2.4)

Metadata:
- Dependencies: history-work-plan-task-06 (Deliverable: `jspdf`/`html2canvas` in `package.json`), history-work-plan-task-07 (Deliverable: `SOURCE/lib/history/format.ts`), history-work-plan-task-08 (Deliverable: `SOURCE/components/pdf/AttemptPdfTemplate.tsx`)
- Provides: `AttemptPdfData`, `generateAttemptPdfFile`, `downloadPdfFile`, `canShareFile` (consumed by Task 10)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/lib/pdf/generateAttemptPdf.ts` (+ `generateAttemptPdf.test.ts`, no skeleton — author fresh): `AttemptPdfData`, `generateAttemptPdfFile` (dynamic-import `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` only inside the function body; off-screen `createRoot`+`flushSync` mount; `waitForTemplateAssets`; `html2canvas` capture; `jsPDF` assembly; `try/finally` unmount+remove), `downloadPdfFile`, `canShareFile`.

## Target Files
- [x] `SOURCE/lib/pdf/generateAttemptPdf.ts` (new)
- [x] `SOURCE/lib/pdf/generateAttemptPdf.test.ts` (new)

## Investigation Targets
- `docs/design/history-frontend-design.md` (§ PDF Generation Module — Deep Dive — the full `generateAttemptPdf.ts` code, including `waitForTemplateAssets`, `downloadPdfFile`, `canShareFile`)
- `docs/design/history-frontend-design.md` (§ Data Contracts — `generateAttemptPdf.ts` yaml — exact `AttemptPdfData`/`generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile` contracts)
- `docs/design/history-frontend-design.md` (§ Data Flow — sequence diagram; § Assumed Behaviors #6/#8/#9 — image-decode timing, `flushSync` synchronous-commit assumption, jsPDF `unit:"px"` scaling)
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance — dynamic-import-only + single-Blob-producing-call + structural single-implementation requirements)
- `SOURCE/components/pdf/AttemptPdfTemplate.tsx` (Task 08's output — the component this module mounts off-screen)
- `SOURCE/lib/history/format.ts` (Task 07's output — `formatSubmittedDate`/`formatCompletionTime` this module calls before mounting the template)

## Investigation Notes

- **`docs/design/history-frontend-design.md` (§ PDF Generation Module — Deep Dive, lines 601-694)**: canonical code for `generateAttemptPdfFile`/`waitForTemplateAssets`/`downloadPdfFile`/`canShareFile`. Dynamic imports of `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` happen via one `Promise.all` inside the async function body; off-screen `container` (`position:fixed;top:-9999px;left:-9999px;pointer-events:none;`) appended to `document.body`; `createRoot(container)`; inside `try`, `flushSync(() => root.render(<AttemptPdfTemplate .../>))`, then `await waitForTemplateAssets(container)`, then `html2canvas(container.firstElementChild, {backgroundColor:"#ede1c8", scale:2, useCORS:true})`, then `new jsPDF({unit:"px", hotfixes:["px_scaling"], format:[widthPx,heightPx]})` + `addImage(canvas.toDataURL(...))`, then `doc.output("blob")` → `new File([blob], buildPdfFilename(data.examTitle, data.submittedAt), {type:"application/pdf"})`; `finally` always does `root.unmount(); container.remove();`. `waitForTemplateAssets` = `await document.fonts.ready.catch(() => undefined)` then `img.decode().catch(() => undefined)` for every `<img>` in the container.
- **`generatedAtLabel` gap**: the Deep Dive code calls `formatGeneratedAt(new Date())` but `SOURCE/lib/history/format.ts` (Task 07's actual output, confirmed by direct read) exports only `formatSubmittedDate`/`formatCompletionTime`/`buildPdfFilename` — no `formatGeneratedAt`. The task's own Provides list (`AttemptPdfData`, `generateAttemptPdfFile`, `downloadPdfFile`, `canShareFile`) also does not list `formatGeneratedAt` as a shared export. Resolution: implement `formatGeneratedAt` as a **local, unexported helper inside `generateAttemptPdf.ts`** (not added to `lib/history/format.ts`, which would change Task 07's already-completed, already-tested contract out of scope). Format chosen: `"DD/MM/YYYY HH:mm"`, matching the example value (`"31/07/2026 09:00"`) already used as `generatedAtLabel` in `AttemptPdfTemplate.test.tsx` (Task 08).
- **jsdom environment gap**: verified via a direct Node/jsdom probe (`node -e "new JSDOM(...).window.document.fonts"`) that this repo's installed jsdom (`^29.1.1`) does not implement `document.fonts` (`undefined`) or `HTMLImageElement.prototype.decode` (`undefined`) — the CSS Font Loading API and image-decode API are real-browser-only here (consistent with Assumed Behaviors #6/#8 being browser-behavior assumptions, not jsdom-verified). Resolution: kept the Deep Dive's literal `document.fonts.ready.catch(...)` behavior for real browsers, but guarded the property access with `document.fonts?.ready ?? Promise.resolve()` so the same code path runs correctly in a real browser (where `document.fonts` is always populated per NFR's browser matrix) and does not throw in jsdom tests (a test-environment gap, not a behavior change — `lib.dom.d.ts`'s `fonts` property is non-optional so this optional-chaining guard is purely defensive, never selects a different branch in a real browser). `img.decode` is not separately guarded because the mocked `createRoot().render()` never inserts a real `<img>` into the container in this test suite, so `container.querySelectorAll("img")` is always empty and `img.decode()` never executes in-test; real-browser image-decode timing is proven at Task 11's Early Verification Point per the task's own Proof Obligations residual.
- **`docs/design/history-frontend-design.md` (§ Data Contracts, lines 393-416)**: confirms exact contracts — `generateAttemptPdfFile(data: AttemptPdfData): Promise<File>` (rejects on any pipeline error, never returns a partial/corrupt `File`); `downloadPdfFile(file: File): void` (never throws); `canShareFile(file: File): boolean` (true only if `navigator.share`/`navigator.canShare` both exist AND `navigator.canShare({files:[file]})` is true, false otherwise including when the API is entirely absent, never throws).
- **`docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance)**: dynamic-import-only discipline for `jspdf`/`html2canvas` (extended by the frontend DD to also cover `react-dom`/`react-dom/client`, all four inside the function body only); one `Blob`-producing call shared by Save/Share; single exported `generateAttemptPdfFile` entry point (AC-007 structural enforcement); zero server/DB/RLS impact (client-only).
- **`.ts` vs JSX**: the Deep Dive excerpt is fenced as ` ```ts ` but contains literal JSX (`<AttemptPdfTemplate .../>`), which TypeScript's parser rejects in a `.ts` file (JSX requires `.tsx`) regardless of `tsconfig.json`'s `jsx` option — confirmed via `tsconfig.json` read (`"jsx": "react-jsx"`, `isolatedModules: true`, per-file parsing). Since the task's Target Files declares the literal path `SOURCE/lib/pdf/generateAttemptPdf.ts` (not `.tsx`), implemented the equivalent mount via `createElement(AttemptPdfTemplate, {...})` (from `"react"`, statically imported — `react` itself is not one of the four libraries the Binding Decisions/ADR-0009 require to be dynamically imported, unlike `jspdf`/`html2canvas`/`react-dom`/`react-dom/client`) instead of JSX syntax. Behaviorally identical to the Deep Dive's JSX form (same component, same props, same `root.render` call); a syntax-level substitution required to keep the file's declared extension, not a design deviation.
- **`SOURCE/lib/history/format.ts`** (Task 07, already read in full): `formatSubmittedDate(submittedAt)`, `formatCompletionTime(startedAt, submittedAt)`, `buildPdfFilename(examTitle, submittedAt)` — all pure, never throw. `generateAttemptPdf.ts` calls all three with the exact `AttemptPdfData` fields, no independent/duplicated formatting logic.
- **`SOURCE/components/pdf/AttemptPdfTemplate.tsx`** (Task 08, already read in full): `AttemptPdfTemplateProps = { examTitle, totalScore, submittedDateLabel, completionTimeLabel, generatedAtLabel }` — all 5 required, no optional fields; this module supplies all 5 when mounting.
- **Test/type infra checks**: confirmed via `node_modules` reads that `jspdf@4.2.1` and `html2canvas@1.4.1` both ship bundled `.d.ts` types (`jspdf/types/index.d.ts` has `jsPDFOptions.hotfixes?: string[]` and `output(type: "blob"): Blob` overload; `html2canvas/dist/types/index.d.ts` has `export default html2canvas`), so no ambient augmentation is needed for either. Confirmed via `node_modules/typescript/lib/lib.dom.d.ts` that this installed TypeScript version already types `Navigator.share`/`Navigator.canShare`/`Document.fonts`/`FontFaceSet.ready` — the frontend DD's "add an ambient augmentation if untyped" contingency note does not apply; no `SOURCE/types/web-share.d.ts` needed.
- **Test convention confirmed** from `SOURCE/lib/history/format.test.ts` (Task 07) and `SOURCE/components/pdf/AttemptPdfTemplate.test.tsx` (Task 08): `describe`/`it`/`expect`/`vi` from `vitest`, `// @vitest-environment jsdom` docblock for jsdom-needing suites, source-text `readFileSync`+`join(process.cwd(), ...)` pattern for static-shape/grep-style assertions. `SOURCE/vitest.config.ts` collects `lib/**/*.test.{ts,tsx}`. Package manager: npm (`package-lock.json`, no `packageManager` field); test script: `npm test` → `vitest run`.
- **Binding Decision evaluation (pre-implementation and confirmed post-implementation)**: Planned approach — one module, `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile` as the only exports, `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` dynamically imported exclusively inside `generateAttemptPdfFile`'s async body via one `Promise.all`, one `doc.output("blob")` call site, zero fetch/queries/actions/supabase imports.
  - Row 1 (`placement`): Compliance Check — "Does `generateAttemptPdf.ts` import `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` exclusively inside `generateAttemptPdfFile`'s async function body, with zero top-level `import ... from` statements for those four specifiers?" — **Y**. Verified by direct read of the final source (all four appear only inside the one `Promise.all(...)` inside the function body; zero top-level `import ... from "jspdf"/"html2canvas"/"react-dom"/"react-dom/client"` lines) and by `generateAttemptPdf.test.ts`'s dedicated dynamic-import-boundary test (regex scan of every top-level `import` line in the source).
  - Row 2 (`data_flow`): Compliance Check — "Does `generateAttemptPdfFile` contain exactly one `doc.output("blob")` call site?" — **Y**. Verified by direct read (one `doc.output("blob")` call, used for the single returned `File`) and by `generateAttemptPdf.test.ts`'s source-text count assertion (`.output(` appears exactly once).
  - Row 3 (`dependency_direction`): Compliance Check — "Does `generateAttemptPdf.ts` export exactly one `generateAttemptPdfFile` function, with no second exported PDF-generation entry point anywhere in `SOURCE/lib/pdf/` or elsewhere?" — **Y**. Verified by direct read (module exports exactly `AttemptPdfData` (type), `generateAttemptPdfFile`, `downloadPdfFile`, `canShareFile` — one generation function) and by `generateAttemptPdf.test.ts`'s runtime `Object.keys` assertion on the imported module plus a `Glob` confirming `SOURCE/lib/pdf/` contains only `generateAttemptPdf.ts`/`generateAttemptPdf.test.ts`.
  - Row 4 (`persistence`): Compliance Check — "Does `generateAttemptPdf.ts` make zero network/fetch calls and touch no server-side module?" — **Y**. Verified by direct read (no `fetch(`, no import from any `queries`/`actions` path, no import from `lib/supabase/**`) and by `generateAttemptPdf.test.ts`'s source-text negative-match assertions.
- **Reference Contract evaluation**: Row 1 (filename crossing) — planned approach: `generateAttemptPdfFile` calls `buildPdfFilename(data.examTitle, data.submittedAt)` (the real, unmocked Task 07 function) and passes its return value verbatim as `new File([blob], <that value>, {...})`'s name, with no independent filename string construction anywhere in this module. Compliance Check — "Does `generateAttemptPdfFile`'s output `File.name` equal `buildPdfFilename(data.examTitle, data.submittedAt)`'s exact return value, with no independent filename logic duplicated in this module?" — **Y**. Verified by direct read (single `buildPdfFilename(...)` call site, its return value passed straight into `new File(...)`, no other filename-shaping code) and by `generateAttemptPdf.test.ts`'s equality assertion comparing the returned `File.name` against a same-arguments call to the real, imported `buildPdfFilename`.
- **Verification commands run**: `npx vitest run lib/pdf/generateAttemptPdf.test.ts` (all green), `npx tsc --noEmit -p tsconfig.json` (clean), `npx eslint lib/pdf/generateAttemptPdf.ts lib/pdf/generateAttemptPdf.test.ts` (0 errors/warnings), static grep `grep -rn "from \"jspdf\"\|from 'jspdf'\|from \"html2canvas\"\|from 'html2canvas'" SOURCE/app SOURCE/components SOURCE/lib` (zero matches for the static `import ... from` form).

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-frontend-design.md` (§ Field Propagation Map — PDF filename crossing) | derived-display | `"{exam-title-slug}_{YYYYMMDD}.pdf" (UI Spec D2) ... the only "consumer contract" is that both call sites (History row, ResultActions) reproduce the identical string for the same attempt, which they do by calling the same buildPdfFilename` | Does `generateAttemptPdfFile`'s output `File.name` equal `buildPdfFilename(data.examTitle, data.submittedAt)`'s exact return value, with no independent filename logic duplicated in this module? |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | placement | `jspdf`/`html2canvas` dynamically imported only inside the Save/Share handler body — never a top-level import of any page/layout/component | Does `generateAttemptPdf.ts` import `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` exclusively inside `generateAttemptPdfFile`'s async function body, with zero top-level `import ... from "jspdf"`/`"html2canvas"` statements in the file? |
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | data_flow | Both Save and Share must derive from one `Blob`-producing call, not two separate generation paths | Does `generateAttemptPdfFile` contain exactly one `doc.output("blob")` call site, used by both the `action==="save"` and `action==="share"` branches (in `ActionButton`, Task 10) with no second generation path anywhere? |
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | dependency_direction | Enforce the single-implementation requirement (AC-007) structurally — both `HistoryRow` and `ResultActions` import the same module; no second, parallel PDF-generation path may form | Does `generateAttemptPdf.ts` export exactly one `generateAttemptPdfFile` function, with no second exported PDF-generation entry point anywhere in `SOURCE/lib/pdf/` or elsewhere? |
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Decision) | persistence | No server, database, or RLS impact — generation is entirely client-side; no new route, endpoint, or backend service | Does `generateAttemptPdf.ts` make zero network/fetch calls and touch no server-side module (no import of anything under `SOURCE/app/**/queries.ts`/`actions.ts` or `SOURCE/lib/supabase/**`)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the exact `try/finally` mount/unmount sequence and the dynamic-import boundary.
- [x] Write failing tests in `generateAttemptPdf.test.ts` with `jsPDF`/`html2canvas`/`react-dom`/`react-dom/client` mocked: (a) dynamic-import boundary honored (mocked module imports occur only inside the async function, never at file top level); (b) container mounted then always removed via `try/finally`, success or failure; (c) `buildPdfFilename` invoked with the right arguments and its output used as the `File` name; (d) a thrown error from any pipeline step rejects the promise (never returns a partial/corrupt `File`).
- [x] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [x] Implement `generateAttemptPdfFile`/`downloadPdfFile`/`canShareFile`/`waitForTemplateAssets` exactly per the frontend DD's Deep Dive code.
- [x] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [x] Improve code (maintain passing tests); confirm the `try/finally` cleanup path is exercised by at least one forced-failure test case.
- [x] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (jsdom, `// @vitest-environment jsdom`) — Enforces: component render/state-machine/DOM-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/lib/pdf/generateAttemptPdf.test.ts`
- Static grep + `npm run build` output inspection — Enforces: ADR-0009's dynamic-import-only discipline (no top-level `jspdf`/`html2canvas` import) — Config: manual, run against build output — Covers: `SOURCE/app`, `SOURCE/components`, `SOURCE/lib` (PDF module scope) — full sweep runs at Task 18, spot-checked here

## Operation Verification Methods
- **Verification method**: run `generateAttemptPdf.test.ts` with mocked `jsPDF`/`html2canvas`/`react-dom`; separately run the static grep (`grep -rn "from \"jspdf\"\|from 'jspdf'\|from \"html2canvas\"\|from 'html2canvas'" SOURCE/app SOURCE/components SOURCE/lib`) and confirm zero matches for the static `import ... from` form.
- **Success criteria**: all 4 obligations green; the grep returns zero matches (confirming dynamic-import-only discipline is upheld from this file's own first commit).
- **Failure response**: if the grep finds a static import, remove it before proceeding — a bundle-size regression here would affect every route, not just `/history`.
- **Verification level**: L2 (mocked tests green) — real PDF byte-for-byte fidelity is explicitly out of this task's scope, proven instead by Task 11's Early Verification Point.

## Proof Obligations
- **Claim**: dynamic-import boundary honored — `jspdf`/`html2canvas`/`react-dom`/`react-dom/client` are imported only inside `generateAttemptPdfFile`'s body, never at file top level.
  - **Primary failure mode**: a static top-level import creeps in, causing the heavy libraries to load on every route that imports this module (bundle-size regression, ADR-0009's core constraint).
  - **Boundary to exercise**: in-process unit (mocked module imports) + a static source-grep check.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: `jsPDF`/`html2canvas`/`react-dom`/`react-dom/client` mocked per frontend DD Test Boundaries — determinism, no real canvas rasterization in the vitest suite.
  - **Residual**: real bundle-size impact is only conclusively proven by `npm run build`'s First-Load-JS output — swept at Task 18.
- **Claim**: the off-screen container is always removed (success or failure) via `try/finally`.
  - **Primary failure mode**: a thrown error during `html2canvas`/`jsPDF` leaves the off-screen container attached to `document.body`, leaking DOM nodes on every failed generation.
  - **Boundary to exercise**: in-process unit (forced-failure test case, e.g. `html2canvas` mock rejects).
  - **State assertion**: before — no container attached to `document.body`; action — call `generateAttemptPdfFile` with a mock configured to reject; after — `document.body` contains no leftover container element.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: `buildPdfFilename` is invoked with the correct arguments and its output is used verbatim as the `File`'s name.
  - **Primary failure mode**: the filename is constructed independently (e.g. inline string concatenation) instead of calling the shared formatter, risking drift from `HistoryRow`'s/`ScoreCard`'s filename expectations.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above (formatter itself is real, per Task 07; only the PDF libraries are mocked here).
  - **Residual**: none.
- **Claim**: a thrown error from any pipeline step rejects the promise, never returns a partial/corrupt `File`.
  - **Primary failure mode**: an error during rasterization/assembly is silently swallowed, and a partial or empty `File` is returned instead of the promise rejecting.
  - **Boundary to exercise**: in-process unit (forced-failure test case per pipeline step).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: real-browser fidelity of the rejection path (e.g. an actual `html2canvas` oklch parse error) is proven at Task 11.

## Completion Criteria
- [x] All added tests pass (4/4 obligations)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] `tsc`/lint clean
- [x] Every Compliance Check (Binding Decisions + Reference Contracts) evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/lib/pdf/generateAttemptPdf.ts` + its test file only.
- Scope boundary: do not wire this module into `ActionButton`/`HistoryRow`/`ResultActions` in this task — that begins at Task 10. Real PDF-byte fidelity is proven at Task 11, not here.
