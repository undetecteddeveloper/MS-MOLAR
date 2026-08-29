# Task G0.3 — OQ-3 / O-3 / FE-OQ-3: measure the `/history` payload (HUMAN, dev measurement)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase 0, Task G0.3**
Layer: **process gate** (dev measurement; Gate D of the work plan is edited)
Status (2026-08-29): **DONE — GATE D CLOSED. Task B2.2 is unblocked.**

**Measured** read-only on both databases by serialising the exact `listMyHistory()` select shape (including the `exam_attempts!inner(… exams!inner(title, subject))` embed) with `jsonb_build_object` and taking `octet_length`:

| | prod (24.11 questions/exam) | dev (5.58 questions/exam) |
|---|---|---|
| rows available | 9 | 53 |
| **D1** without `per_question, created_at` | 375 B/row → **~183 KB** at 500 | 353 B/row → ~173 KB |
| **D2** with them | 3 401 B/row → **~1 661 KB** at 500 | 918 B/row → ~448 KB |
| increase | **≈ 9.1× (+1.45 MB)** | ≈ 2.6× |

Two limits on that number: the 500-row figure is an **extrapolation** (neither database holds 500 rows), and the bytes are **uncompressed** (an RSC payload ships compressed; the client still parses the full amount).

**D3 — ACCEPT** (engineer, 2026-08-29). 500 is a **ceiling, not a forecast** — prod holds 9 result rows in total, and `LIST_ROW_CEILING`'s own comment puts 500 three orders of magnitude above current data. Reaching it is the documented trigger for **pagination**, not for a bigger number. The escalation cost more than the problem: an RPC is **DDL**, taking hand-applied schema changes from two to three and reopening ADR-0018 Escalation 2. **D4 not applicable** — Escalation 2 stays closed, schema changes stay at two. Re-open if a *realistic* payload passes ~500 KB, and revisit as pagination first.

Metadata:
- Owner: **engineer**.
- Dependencies: none.
- Blocks: **Task B2.2** (hard entry gate — no task touching `listMyHistory()` may be scheduled before the number exists).
- Provides: two byte figures and a written accept/escalate decision in Gate D (D1–D5).
- Size: documentation only (Gate D of the work plan).

## Implementation Content

Complete Gate D items D1–D5:

- **D1** — on dev, measure the `listMyHistory()` payload at `LIST_ROW_CEILING = 500` rows (`SOURCE/lib/supabase/boundedRead.ts:74`) **without** `per_question, created_at` in the select. Record the byte figure.
- **D2** — the same measurement **with** `per_question, created_at` in the select. Record the byte figure.
- **D3** — the engineer records the accept/escalate decision, **with the threshold used**.
- **D4** — if escalating to an RPC: the engineer explicitly records that ADR-0018 **Escalation 2 is being reopened** and that manual schema changes go from two to three. This is not a detail an implementer may decide.
- **D5** — Gate D is closed **before** Task B2.2 starts.

**Escalation condition, stated so it is not mistaken for a fallback.** If the payload is unacceptable, the only alternative is an RPC returning the two booleans pre-derived — and that is **DDL**. It raises hand-applied schema changes from two to three and reopens exactly the budget that ADR-0018 Escalation 2 was resolved (by accepting degraded telemetry resolution) to preserve. It is a **scope escalation requiring an engineer decision**, not a technical fallback an implementer may pick.

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate D items D1–D5 (two byte figures, the threshold, the decision)

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate D — OQ-3 / UI Spec O-3 / FE-OQ-3)
- `SOURCE/app/(HM)/queries.ts` (`listMyHistory()` — the embedded select at `:64-66`, `EmbeddedRow` at `:23-34`, `MyHistoryEntry` at `:8-18`)
- `SOURCE/lib/supabase/boundedRead.ts` (`LIST_ROW_CEILING = 500` at `:74` — the ceiling the measurement must use)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope / D-03 / D-13 — the two required booleans B2.2 will derive)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Open Item O-3 — the UI Spec makes this a hard Work Plan entry gate)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — Escalation 2, the budget the RPC option reopens)

## Investigation Notes
_(Record here: the measurement method used, the two byte figures, the threshold the engineer applied, and the accept/escalate decision with its date.)_

## Implementation Steps
### 1. Measure
- [ ] Read all Investigation Targets; confirm `LIST_ROW_CEILING` is still 500 at `boundedRead.ts:74`
- [ ] On **dev**, run `listMyHistory()` at 500 rows **without** `per_question, created_at`; record the payload size in bytes (D1)
- [ ] Run the same at 500 rows **with** `per_question, created_at`; record the payload size in bytes (D2)

### 2. Decide and record
- [ ] Record the accept/escalate decision **and the threshold used** (D3)
- [ ] If escalating: record explicitly that Escalation 2 is being reopened and that manual schema changes go from two to three (D4)
- [ ] Confirm Gate D is closed before Task B2.2 starts (D5)

## Quality Assurance Mechanisms
None automated — the number does not exist anywhere in the repository and cannot be derived from it. That is why this is a gate with an owner.

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording Gate D still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: two byte figures measured on the **dev** database at `LIST_ROW_CEILING = 500`, one per select shape, plus a written decision naming the threshold applied — all three physically present in Gate D.
- **Success criteria**: D1 and D2 carry real numbers; D3 carries a decision **and** the threshold; D5 confirms the gate closed before B2.2 starts.
- **Failure response**: if the payload is unacceptable, do **not** implement an RPC. Escalate to the engineer with the two figures; the decision to reopen Escalation 2 and raise manual schema changes from two to three is the engineer's and must be recorded in D4 before any DDL is authored.
- **Verification level**: L1 (a real query against the dev database at the real ceiling).

## Proof Obligations
- **Claim**: adding `per_question, created_at` to `listMyHistory()`'s embedded select at 500 rows carries a payload cost the engineer has seen and accepted.
- **Primary failure mode**: Task B2.2 lands the wider select on an assumption, and `/history` becomes slow or times out at the row ceiling for the students with the most attempts — the users hardest to notice from a dev account with three rows.
- **Boundary to exercise**: the real Supabase dev database at `LIST_ROW_CEILING = 500` — a cross-process query, measured on the wire, not estimated from row counts.
- **State assertion**: N/A — the measurement is read-only.
- **Mock boundary rationale**: none. A mocked payload measures the fixture author's imagination.
- **Residual**: proves the cost at 500 rows on dev with dev-shaped data. It does not prove the cost on prod-shaped essays; production currently has **0** submitted essays, so no prod-shaped measurement exists to take.

## Completion Criteria
- [ ] **Implementation Complete** = Gate D closed (D1–D5 all filled)
- [ ] **Quality Complete** = the threshold used is recorded beside the decision, so a later reader can recompute rather than re-guess
- [ ] **Integration Complete** = Task B2.2's select shape matches the recorded decision
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks Task B2.2 and, through it, Tasks B2.3, B2.4 and the whole read path.
- Scope boundary: read-only measurement. No change to `SOURCE/app/(HM)/queries.ts` in this task — that is B2.2.
- OQ-3, UI Spec O-3 and FE-OQ-3 are **one** question with three IDs; closing Gate D closes all three.
