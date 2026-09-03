# UGC Exam Upload (AI-assisted) — Task Breakdown (v2.0)

Decomposed from `docs/plans/ugc-exam-upload-work-plan.md` (v2.0). Each file = one single-commit task, executor-ready. Detail lives in the Design Doc v2.0 (`docs/design/ugc-exam-upload-design.md`) + ADR-0001…0004 (revised) + PRD/UI-Spec v2.0.

**Supersedes the v1.1 task set** (paste + deterministic parser + admin moderation). The v1.1 task files were removed. Note: the v1.1 slice implemented the vitest tooling (reused) and `lib/ugc/parseExam.ts` (**now obsolete** — replaced by AI extraction + assembly; Task 2.1 removes it).

Two verification gates: **Gate A** — schema + RLS/Storage suite (R-a…R-o, ADR-0001 kill criterion, blocks all UI); **Gate B** — RichText XSS/regression + QuestionFigure image-origin fixtures (ADR-0002, blocks publish/render).

| # | Task | Phase | Depends on | Status |
|---|------|-------|-----------|--------|
| 0.1 | vitest + jsdom tooling | 0 | — | ✅ DONE (v1.1 slice, reused) |
| 1.1 | [Schema + Storage DDL + apply](task-1.1-schema-storage.md) | 1 (DB) | — | ✅ DONE |
| 1.2 | [RLS + Storage suite (GATE A)](task-1.2-rls-suite.md) | 1 (DB) | 1.1 | ✅ DONE |
| 2.1 | [Types/limits/errorCopy/assembler + fixtures](task-2.1-assemble.md) | 2 | 0.1 | ✅ DONE |
| 2.2 | [AI extractors + image crop (server-only)](task-2.2-extract.md) | 2 | 2.1 | ✅ DONE |
| 3.1 | [Harden RichText + XSS/regression (GATE B)](task-3.1-richtext-sanitize.md) | 3 | 0.1 | ✅ DONE |
| 3.2 | [QuestionFigure + image-origin fixtures (GATE B)](task-3.2-question-figure.md) | 3 | 0.1 | ✅ DONE |
| 4.1 | [features/authoring/actions.ts — 5 server actions](task-4.1-actions.md) | 4 | 1.1, 2.1, 2.2 | ✅ DONE |
| 4.2 | [features/authoring/queries.ts — read queries](task-4.2-queries.md) | 4 | 1.1 | ✅ DONE |
| 4.3 | [app/(authoring)/layout.tsx](task-4.3-layout.md) | 4 | 4.1 | ✅ DONE |
| 5.1 | [features/exams/queries.ts — published + byline + image](task-5.1-catalog-queries.md) | 5 | 1.1 | ✅ DONE |
| 5.2 | [Byline + QuestionFigure + Report channel](task-5.2-byline-image-report.md) | 5 | 5.1, 4.1, 3.2 | ✅ DONE |
| 6.1 | [Navbar/profile — Upload + My exams (no admin)](task-6.1-navbar.md) | 6 | 4.3 | ✅ DONE |
| 6.2 | [S-01 Upload (two files + extract)](task-6.2-upload-screen.md) | 6 | 4.1 | ✅ DONE |
| 6.3 | [S-02 My exams](task-6.3-my-exams.md) | 6 | 4.2 | ✅ DONE |
| 6.4 | [S-03 Review & edit + Publish](task-6.4-review-screen.md) | 6 | 4.1, 4.2, 3.2 | ✅ DONE |
| 7 | [QA — AC sweep, gates re-run, e2e, a11y](task-7-qa.md) | 7 | all | 🟡 PARTIAL (unit/build/bundle green; a11y + publish→attempt→report e2e + AC-027 outstanding) |

**No admin tasks** (review queue / submission review / moderation) — admin was removed in v2.0.

---

# v2.1 Task Set — Multi-Part National Format + Gemini Protocol (2026-07-17)

v2.0 tasks 1.1–7: **ALL DONE** (code-complete, gates green, live-tested 2026-07-17). v2.1 decomposed from the Work Plan §v2.1 Extension (ADR-0005 multi-part model; ADR-0006 Gemini native bbox). New gates: **Gate C** (composite join — zero cross-part overwrites + old-format regression) and **Gate D** (bbox protocol — >0 figures detected on the real 2025 fixture; kill criterion, escalate per ADR-0006 before touching other layers).

| # | Task | Phase | Depends on | Status |
|---|------|-------|-----------|--------|
| A1 | [Schema v2.1 delta + Gate A re-run](task-v21-a1-schema.md) | A (foundation) | — | ✅ DONE (schema applied, Gate A PASS 2026-07-18) |
| A2 | [Types/limits/errorCopy v2.1](task-v21-a2-types.md) | A | — | ✅ DONE |
| A3 | [Assembler composite join (GATE C)](task-v21-a3-assemble.md) | A | A2 | ✅ DONE (Gate C green) |
| B1 | [Native bbox protocol (GATE D)](task-v21-b1-bbox.md) | B (AI protocol) | A2 | ✅ DONE (Gate D green 2026-07-18 — 1/1 figure on real fixture PDF) |
| B2 | [Parts + 4-type extraction](task-v21-b2-extract-parts.md) | B | A2, B1 | ✅ DONE |
| C1 | [actions.ts + fromRows v2.1](task-v21-c1-actions.md) | C (persistence) | A1, A3, B2 | ✅ DONE |
| C2 | [Queries + PublicQuestion confinement](task-v21-c2-queries.md) | C | A1, C1 | ✅ DONE |
| D1 | [S-03 review: part grouping + 2 new editors](task-v21-d1-review.md) | D (UI) | C1, C2 | ✅ DONE |
| D2 | [Player: TF + short-answer inputs](task-v21-d2-player.md) | D | C2 | ✅ DONE |
| D3 | [Result page: non-MCQ treatment](task-v21-d3-result.md) | D | D2 | ✅ DONE |
| E1 | [Real-file e2e + regression sweep](task-v21-e1-qa.md) | E (QA) | all | 🟡 PARTIAL (upload→extract→review→delete e2e passed 2026-07-18; official 2025 file + a11y outstanding) |

Product decision (2026-07-17): `true_false`/`short_answer` are **stored + displayed, not auto-scored** — auto-scoring is a separate future feature. No scoring tasks in this set.
