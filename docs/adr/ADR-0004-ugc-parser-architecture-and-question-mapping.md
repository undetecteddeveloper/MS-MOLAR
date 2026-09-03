# ADR-0004 UGC AI Extraction Architecture and Question / Answer / Image Mapping

## Status

Proposed — 2026-07-15. **Replaces** the v1.1 decision (deterministic isomorphic plain-text parser). Under the v2.0 redesign the ingestion model changes from *paste plain text → deterministic parse* to *upload two files (image/PDF) → AI extraction → code assembly → mandatory author review*. This ADR owns the extraction/assembly architecture and the question ↔ answer ↔ image mapping; it supersedes the old "shared isomorphic parser" decision and its determinism kill-criterion.

- PRD: `docs/prd/ugc-exam-upload-prd.md` (v2.0) — R3 (two files), R4 (AI extraction, answer-authoritative), R5 (image crop), R6 (assembly), R7 (mandatory review), R11 (safe render).
- Sibling ADRs: ADR-0001 (lifecycle + RLS, admin removed), ADR-0002 (rendered-output boundary, now allowing safe images), ADR-0003 (`author_display_name`).

## Context

The author uploads two files: a **question file** and an **answer file** (each an image or PDF). We must turn these into the website's exam/question schema. Two hard facts constrain the design:

- `questions.correct_answer` is `check (... in ('A','B','C','D'))`, `questions.topic` is `not null`, `questions.subject`/`grade` are `not null` (`schema.sql`). New columns for an image URL, a question type, and an essay model-answer are added by ADR-0001/Design Doc.
- The result page groups by `topic` (`computeScore` buckets by `q.topic`; `TopicBreakdown` renders one row per distinct topic).

Unlike v1.1, ingestion is **not deterministic**: an LLM reading a document can misread text, return slightly different output across runs, and cannot itself cut a bitmap. This forces three departures from the old parser ADR:

1. **No isomorphic client/server parser and no client-side live preview.** AI must be called server-side (the API key must never reach the browser), so the "parse instantly in the browser" UX of v1.1 is gone; extraction is a server round-trip.
2. **No determinism kill-criterion.** The old ADR treated any client/server parse divergence as fatal. AI output is inherently variable; the quality gate must be a human, not a determinism assertion.
3. **The correct answer must not come from the model's reasoning.** For an exam site, a wrong answer key is the worst failure. The author uploads an authoritative answer file; the AI's job on that file is to *read* the mapping, not to *solve* the questions.

## Decision

Use a **server-side, two-call AI extraction** feeding a **pure-code assembly step**, with a **mandatory author review** as the quality gate. Concretely:

- **Question extractor (one multimodal call).** A single AI call reads the question file and returns, per question, a unified object: `{ number, type: 'mcq' | 'essay', stem, choices?: [A,B,C,D], imageBox?: bounding box }`. Producing the question text *and* the location of that question's figure in the **same** call keeps the question ↔ image association correct by construction — no cross-call number matching.
- **Answer extractor (one call, cheaper model).** A separate AI call reads the answer file and returns `{ number → answer }`, where `answer` is an A–D letter (MCQ) or model-answer text (essay). **This is the only source of correct answers; the extractor reads, it does not solve.**
- **Image cropping in code, not AI.** For each `imageBox`, application code crops the figure and uploads it to Storage. **Prefer the PDF-embedded image** (extract directly from the file — pixel-exact) when the source is a PDF; use the AI bounding box only for photos where there is no embedded object. Images are **stem-only, at most one per question**.
- **Assembly in code (authoritative).** Pure code joins the extractor output to the answer output **by question number**, sets each MCQ's `correct_answer` from the answer file, attaches image URLs, defaults `topic = exam.subject`, and validates the whole exam. The **assembled, author-confirmed** result is what is persisted — raw AI output is advisory and never persisted directly.
- **Mandatory author review.** The assembled exam is shown to the author, who corrects any field in place; publication requires an explicit confirmation on a clean, validated exam.

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Two server-side AI calls (question file → structure+image boxes; answer file → answer map) + code assembly (join by number, crop images, validate, `topic=subject`) + mandatory author review before publish. Answers are authoritative from the answer file. |
| **Why now** | R3–R7 are MVP; the extraction/assembly contract is what feeds both the review UI and the DB insert, and the answer-authoritative rule is what protects answer-key correctness. |
| **Why this** | One question-file call keeps question↔image mapping correct by construction; a second cheap call reads the answer map; code assembly is the deterministic gate that AI cannot bypass; human review absorbs AI misreads. Server-only calls protect the API key. |
| **Known unknowns** | Exact prompt/response JSON schema, model IDs, timeouts, ret/rate-limit handling, bounding-box coordinate convention, PDF-embedded-vs-crop heuristic — Design Doc scope. |
| **Quality gate (replaces the old kill-criterion)** | Not determinism. The gate is: (a) code assembly validates structure and rejects anything malformed, and (b) the author must review and confirm. If either is bypassable — e.g. a client can publish without a server-validated, author-confirmed assembly — the model is invalid and must be fixed before launch. |

### Extraction → assembly mapping (principle-level; exact field code in Design Doc)

For an upload that assembles cleanly into N questions:

- **exam row**: metadata from the form (title/subject/grade/duration; optional school/school_year/semester); `author_id = auth.uid()`; `author_display_name` per ADR-0003; `status` per ADR-0001 lifecycle; `question_ids` = generated ids in question order; `created_at` = upload time. The uploaded files are retained (Storage) so the author can re-run extraction; the raw AI output may be retained for debugging but is not the source of truth.
- **each question row**: `id` generated deterministically in order (e.g., `<examId>-q<n>`); `content` = the stem (rendered later per ADR-0002); `question_type` = `mcq` | `essay`; for MCQ: `choices` = jsonb `[{id:'A',text},…,{id:'D',text}]` and `correct_answer` = the letter from the **answer file** (guaranteed A–D, satisfies the CHECK); for essay: the model-answer text stored in the essay-answer column, `correct_answer` left to the Design Doc's essay representation; `image_url` = the Storage URL of the cropped figure, or null; `subject`/`grade` inherited from the exam; **`topic` = exam.subject**.
- **re-extraction lifecycle**: re-uploading files (or re-running extraction) produces a fresh assembly; if it replaces an in-review draft, the exam's question rows are **fully re-derived** (delete-then-insert of `<examId>-q<n>` rows) and `question_ids` rewritten, so no stale rows survive a change in question count. Editing a *published* exam is field-level (per PRD R8), not a re-extraction. Exact mechanics are Design Doc scope.

### Answer authority (why the AI never decides the answer)

The correct answer for every MCQ is taken from the author's answer file via the answer extractor, then set by code during assembly. The question extractor is explicitly instructed **not** to mark a correct answer. This makes a wrong answer key a data-entry problem the author can see and fix on their own file, not an AI reasoning error that silently ships. Answer fidelity is testable: assembly on fixtures with known answer files must reproduce those answers exactly (PRD metric 2).

### Topic default and its result-page consequence

Every UGC question's `topic` is set to the exam's subject at assembly time (carried over from the v1.1 decision). Consequence, previously confirmed by the product owner: on the result page, all questions in a UGC exam share one topic, so `TopicBreakdown` renders a **single bucket** rather than a per-topic breakdown. This is accepted and needs no change to `computeScore`/`TopicBreakdown`. Seeded exams keep their real per-topic values.

### Error model

Both AI steps and the assembly step return a discriminated result: either success or `{ ok:false, errors }`, where each error names the offending `Câu N` (or a whole-file error with `questionNumber: null`) via a stable code + message that the review UI's error panel renders. Minimum error codes: `NO_QUESTIONS_FOUND`, `TOO_MANY_QUESTIONS`, `WRONG_CHOICE_COUNT`, `EMPTY_STEM`, `EMPTY_CHOICE`, `ANSWER_COUNT_MISMATCH` (question/answer numbers don't line up), `ANSWER_MISSING` (a question has no answer), `IMAGE_CROP_FAILED`, `EXTRACTION_FAILED` (AI/API error), `FILE_TOO_LARGE` / `TOO_MANY_PAGES` (pre-processing). The server returns the same shape regardless of the client, so a crafted client posting raw files still receives a structured, question-identifying refusal, and nothing is persisted as publishable.

## Rationale

### Options Considered — question/image extraction

1. **Two independent AIs for the question file: AI-1 extracts text, AI-2 extracts/locates images, then match by question number.** Cons: **rejected** — two independent reads can number the questions differently, so the "image for Câu 5" from AI-2 may not be the "Câu 5" from AI-1. This re-introduces exactly the desync the v1.1 shared-parser fought to avoid, at the most fragile join in the system. It also costs an extra call for no reliability gain.
2. **One multimodal call returns questions *and* per-question image bounding boxes together (Selected).** Pros: the image is bound to its question inside a single object produced by a single read, so the mapping is correct by construction; fewer calls; simpler assembly. Cons: the one call is heavier (must both transcribe and localize) — acceptable, and mitigated by preferring PDF-embedded image extraction when available.
3. **Let the AI return the cropped image bytes directly.** Cons: **rejected** — LLMs return text/coordinates, not reliable bitmap crops; cutting the image is a code responsibility. The AI returns a bounding box; code crops.

### Options Considered — where the correct answer comes from

1. **AI infers the correct answer from the question file (solve the questions).** Cons: **rejected by product owner** — an AI-guessed answer key can be wrong and ship silently; worst-case failure for an exam site.
2. **Author uploads an authoritative answer file; AI only reads the mapping; code sets the answer (Selected).** Pros: correctness is the author's responsibility on their own file; AI's task is easy OCR-like reading, much safer than reasoning; testable against fixtures. Cons: requires two files from the author — accepted (it matches how teachers actually keep answer keys).

### Options Considered — parse placement / determinism

1. **Isomorphic client+server parser with a determinism kill-criterion (the v1.1 decision).** Cons: **rejected for v2.0** — impossible with AI (key must stay server-side; output is non-deterministic). Kept here only as the superseded baseline.
2. **Server-side AI + code assembly + mandatory human review (Selected).** Pros: key stays server-side; code assembly is the deterministic, un-bypassable structural gate; human review is the quality gate for content the AI can misread. Cons: no instant in-browser preview (a UX regression from v1.1) and a per-upload AI cost — both accepted for the redesign.

## Consequences

### Positive

- The question ↔ image mapping is correct by construction (single call), and the answer key can't be an AI hallucination (authoritative answer file).
- Code assembly guarantees only well-formed, validated exams are persisted; the author confirms content the AI can't be trusted to get perfect.
- `questions.topic not null` is satisfied with no author burden; seeded exams are untouched.
- One error model drives the review UI and the server refusal.

### Negative

- No instant client-side preview; extraction is a visible server round-trip with latency and cost (mitigated by progress UI and light rate guards — Design Doc).
- The question extractor is a security- and correctness-relevant component gating DB writes and image crops; it must be covered by fixture tests (structure, answer fidelity, image mapping).
- Essay questions are stored but not graded; their interaction with the MCQ player/scoring is deferred (PRD Undetermined Items).

### Neutral

- Model selection (stronger model for the question file, cheaper for the answer file), input limits, and coordinate conventions are Design Doc scope; this ADR fixes only the outcome contract and placement.
- Extractor output feeds ADR-0002's render path; assembly stores content verbatim and does not sanitize (sanitization is render-time; images are allowlisted to the storage domain).

## Architecture Impact

- **New**: server-side extraction modules (question-file extractor, answer-file extractor) that call the Claude API; an image-crop/storage step; a pure-code assembly module with a typed result/error contract; the upload/review client wiring.
- **Removed vs v1.1**: the isomorphic `parseExam` module, the client-side live preview, and the determinism kill-criterion.
- **Changes**: none to `computeScore`/`TopicBreakdown` (topic default is data). New columns on `questions` (`question_type`, `image_url`, essay answer) and a Storage bucket are owned by ADR-0001/Design Doc.
- **Constraint added**: persisted questions are always the code-assembled, author-confirmed result; raw AI output is never persisted as publishable. On re-extraction the question rows are fully re-derived.

## Implementation Guidance

- Call the AI **only on the server**; never ship the API key to the client (PRD metric 6).
- Give the question extractor and the answer extractor **separate, narrow prompts**; instruct the question extractor explicitly **not** to mark correct answers.
- Return **structured, `Câu N`-identifying** results from every step; never throw for author-input errors (throwing is reserved for programmer/infra errors, which map to `EXTRACTION_FAILED`).
- Prefer extracting the embedded image from a PDF over cropping by AI bounding box; fall back to the bounding box for photos.
- Set `topic = exam.subject` in assembly only; do not surface topic in the author UI.
- Persist only the assembled, validated result; treat the raw AI response as advisory (log for debugging, not as source of truth).
- Test the extraction/assembly contract against fixtures: well-formed exams, malformed structures, answer-count mismatches, and image-bearing questions (PRD metrics 2–4).

## Related Information

- PRD `docs/prd/ugc-exam-upload-prd.md` (R3–R7, R11; Undetermined Items — extraction contract, image strategy, essay handling).
- ADR-0001 (lifecycle + RLS, admin removed; new question columns + Storage), ADR-0002 (render boundary + safe images), ADR-0003 (`author_display_name` on the same insert).
- Code touchpoints: `SOURCE/lib/scoring/computeScore.ts`, `SOURCE/features/exams/components/TopicBreakdown.tsx` (unchanged), `SOURCE/lib/fake-data/exams.ts` (seeded topics), `SOURCE/supabase/schema.sql` (question constraints + new columns).
- `docs/claude-api` reference (via the claude-api skill): multimodal document/image input, structured outputs, server-side calling, model IDs (`claude-opus-4-8` / `claude-sonnet-5` for the question file; `claude-haiku-4-5` for the answer file).
