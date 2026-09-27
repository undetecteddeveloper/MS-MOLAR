# Task P1-T6 — `lib/exams/browseParams.ts` (`hasBrowseParam`)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T6**
Layer: backend/shared (`SOURCE/lib/exams/`)

Metadata:
- Dependencies: none within Phase 1
- Blocks: P5-T1 (the `/exams` page branch predicate consumes this module directly)
- Size: Small (2 files)
- Verification level: L2

## Implementation Content
Create `SOURCE/lib/exams/browseParams.ts` (`BROWSE_PARAM_KEYS` — the ten AC-008 keys named once — and `hasBrowseParam(sp)`). Create `SOURCE/lib/exams/__tests__/browseParams.test.ts`.

## Target Files
- [x] `SOURCE/lib/exams/browseParams.ts` (new)
- [x] `SOURCE/lib/exams/__tests__/browseParams.test.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Implementation Path Mapping — `lib/exams/browseParams.ts` row)
- `docs/design/exam-shelves-frontend-design.md` (§ Data flow "Branch rule" — `hasBrowseParam(sp)` consumption at the page)
- `docs/prd/exam-shelves-prd.md` (§ AC-008 — the exact 10 listed URL params)
- `SOURCE/app/(exams)/exams/page.tsx` (`:37-123` current `searchParams` handling — the raw `sp` object shape this predicate reads from)

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Ten AC-008 listed URL params → `hasBrowseParam(sp)`. Owner left: browser-supplied URL (address bar, bookmark, shelf's own header/tile links). Owner right (this task): `lib/exams/browseParams.ts`, consumed by `app/(exams)/exams/page.tsx` (P5-T1). Serialized format: URL query string, raw key presence — not parsed value. Consumer parse rule: `key in sp && sp[key] !== undefined` on the raw `searchParams` object. Expected signal: `?sort=garbage`/`?page=abc`/`?dir=asc` all render the flat grid despite normalising to `undefined` downstream.

## Investigation Notes
- **The 10 AC-008 keys** (`docs/prd/exam-shelves-prd.md` AC-008): `q, subject, grade, school, year, semester, sort, level, dir, page`. Cross-checked against the current raw `sp` object shape read in `SOURCE/app/(exams)/exams/page.tsx:23-35` (`SearchParams` type) — same 10 keys, no more, no less.
- **Backend Design Doc** (Implementation Path Mapping row, `docs/design/exam-shelves-backend-design.md:85`): `lib/exams/browseParams.ts` exports `BROWSE_PARAM_KEYS` (the ten AC-008 keys, named once) + `hasBrowseParam(sp)`, "the pure branch predicate so it is testable in the CI lane". Integration point I1 (`:98`): branch predicate tested on **raw key** (`key in sp && sp[key] !== undefined`), never parsed value, because `?sort=garbage`, `?page=abc`, `?dir=asc` all parse to `undefined`/`1` yet must render the flat grid (AC-010).
- **Frontend Design Doc** (§ Data flow "Branch rule", `docs/design/exam-shelves-frontend-design.md:134-140`): the page will do `const showShelves = !hasBrowseParam(sp);` importing from `@/lib/exams/browseParams`. Confirms: `/exams?q=` (present but empty) still stands shelves down — key presence, not truthiness. A repeated key arrives as `string[]` — still `!== undefined`, still counts as present.
- **Consumption site** (`SOURCE/app/(exams)/exams/page.tsx:37-123`): `sp = await searchParams` is a plain object of `string | undefined` values (no arrays in this route's declared type, but the predicate's contract per both Design Docs is general — `key in sp && sp[key] !== undefined` — so it stays correct even if a future caller passes an array-valued object). `hasBrowseParam` takes that raw `sp` object directly, no pre-parsing.
- **Confirmed**: predicate reads raw key presence only, never a normalised/parsed local — matches both Design Docs and the Boundary Context's Consumer Parse Rule verbatim (`key in sp && sp[key] !== undefined`).
- **Sibling module convention** (`SOURCE/lib/exams/attemptSource.ts`, `paginate.ts`): pure function, no I/O, `as const` array + derived union type where applicable, Vietnamese header comment explaining rationale/invariant, test file mirrors with Vietnamese `describe`/`it` names and an explicit invariant-focused header comment. `browseParams.ts` follows the same shape: `BROWSE_PARAM_KEYS` as `as const` array (not a union type export, since the task only asks for the keys + predicate, no per-key type needed).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing cases: `hasBrowseParam` is `true` for `?sort=garbage`, `?page=abc`, `?dir=asc`, and `?q=` (empty); `false` only for a genuinely bare URL (no listed keys present at all)
- [x] Confirm they fail because the module does not yet exist (`Cannot find package '@/lib/exams/browseParams'`)
### 2. Green Phase
- [x] Implement `BROWSE_PARAM_KEYS` (the 10 AC-008 keys, named once) and `hasBrowseParam(sp)` reading raw key presence
- [x] Run tests and confirm all pass (19/19 green)
### 3. Refactor Phase
- [x] Confirm the predicate never reads a normalised/parsed local — only `key in sp && sp[key] !== undefined` (source reviewed; matches Boundary Context verbatim)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `lib/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run lib/exams/__tests__/browseParams.test.ts`, exercising every one of the 10 AC-008 keys individually plus the malformed-value cases.
- **Success criteria**: every one of the 10 keys, present with any value (including malformed/garbage), makes `hasBrowseParam` return `true`; only a URL with none of the 10 keys returns `false`.
- **Failure response**: if a malformed value (e.g. `?sort=garbage`) returns `false`, the predicate is reading a normalised/parsed value instead of raw key presence — fix by switching the check to raw key presence, per the Boundary Context's Consumer Parse Rule.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (F-005, boundary row expected signal): `hasBrowseParam` is `true` for `?sort=garbage`, `?page=abc`, `?dir=asc`, and `false` only for a genuinely bare URL.
  - **Primary failure mode**: the predicate is written against normalised locals instead of raw keys, so a bookmarked/hand-edited URL with a garbage value silently renders shelves instead of the flat grid (the work plan's own named Risk).
  - **Boundary to exercise**: in-process unit test, one case per AC-008 key plus malformed-value variants.
  - **State assertion**: N/A (pure function).
  - **Mock boundary rationale**: none.
  - **Residual**: this proves the predicate itself; that the page (P5-T1) actually consumes it correctly, and that the fixture-e2e lane (P5-T2) proves it table-driven end-to-end, are separate obligations.
- **Claim** (Failure Mode: empty input): `?q=` (present but empty) still counts as a listed param — `hasBrowseParam` returns `true`.
  - **Primary failure mode**: an empty-string value is treated as "absent" by an `sp[key]` truthiness check instead of a presence check, making a cleared search box silently switch back to shelves.
  - **Boundary to exercise**: in-process unit test.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [x] All added tests pass, covering all 10 AC-008 keys plus malformed-value cases
- [x] `hasBrowseParam` confirmed to read raw key presence only
- [x] Gates 1-6 green (`tsc --noEmit`, `eslint --max-warnings 0` on new files, `vitest run` — 1 unrelated pre-existing failure in `lib/security/rateLimit.test.ts`, last touched commit `3f97286`, outside this task's scope; `npm run build` / `check:bundle` not run — no build-affecting change, pure new module addition)

## Notes
- Impact scope: `browseParams.ts` (new), its test file (new).
- Scope boundary: this module has 0 dependency on `lib/adaptive` or any DB access — pure URL-shape predicate only.
