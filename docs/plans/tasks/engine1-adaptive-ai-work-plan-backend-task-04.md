# Task 04 (Backend): `lib/adaptive/skillTaxonomy.ts` + `lib/adaptive/constants.ts` (Work Plan Phase 1, Task 4)

Metadata:
- Dependencies: backend-task-01 (⚠ dev apply checkpoint passed — this task's data must match the landed schema shape), backend-task-03 (reviewed DAG content)
- Provides: typed DAG data + `validateDag()`, consumed by backend-task-05 (seed) and backend-task-07 (routing algorithm's fixture/real-data shape)
- Size: Medium (3 files: `skillTaxonomy.ts`, `constants.ts`, `skillTaxonomy.test.ts`)

## Implementation Content

Implement the reviewed DAG (backend-task-03's approved content) as typed data + `validateDag()` (0 cycles, 0 dangling prerequisites). Author `SOURCE/lib/adaptive/__tests__/skillTaxonomy.test.ts` **directly from AC-001/002/003/004** — no skeleton was generated for this file, so it must be written with the same rigor as the skeleton-driven files, sourced from the backend DD's Acceptance Criteria section itself.

Also author `lib/adaptive/constants.ts`:
- `MASTERY_CLEARED_THRESHOLD = 0.7` (U5)
- `SKILL_TAG_CONFIDENCE_THRESHOLD = 0.75` (U3)

Both as named constants (not scattered literals) — these are the PRD's own shipped-as-placeholder values, expected to be retuned once real usage data exists (Final-Phase Task 27 records the actual shipped/retuned values).

## Target Files
- [ ] `SOURCE/lib/adaptive/skillTaxonomy.ts` (new — typed DAG data + `validateDag()`)
- [ ] `SOURCE/lib/adaptive/constants.ts` (new — `MASTERY_CLEARED_THRESHOLD`, `SKILL_TAG_CONFIDENCE_THRESHOLD`)
- [ ] `SOURCE/lib/adaptive/__tests__/skillTaxonomy.test.ts` (new — authored directly from AC-001-004, no generated skeleton)

## Investigation Targets
- `docs/plans/analysis/engine1-math-skill-dag-draft.md` (backend-task-03's approved deliverable — the exact content to encode)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/adaptive/skillTaxonomy.ts` — reviewed DAG data + `validateDag()`, AC-001-003; § `lib/adaptive/constants.ts` — `MASTERY_CLEARED_THRESHOLD`/`SKILL_TAG_CONFIDENCE_THRESHOLD`; § Acceptance Criteria AC-001/002/003/004 verbatim, since this test file has no generated skeleton to inherit annotations from)
- `SOURCE/supabase/schema.sql` (§9b — the `skill_nodes`/`skill_prerequisites` shape this typed data must structurally mirror)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact AC-001/002/003/004 text.
- [ ] Write `skillTaxonomy.test.ts` directly against AC-001 (0 cycles), AC-002 (0 dangling prerequisites), AC-003 (node count 15-25), AC-004 (every node has a Vietnamese label) — each as an independent assertion, not a single combined check.
- [ ] Run the new tests and confirm they fail (no implementation exists yet).

### 2. Green Phase
- [ ] Encode backend-task-03's approved DAG content as typed data (nodes + prerequisite edges).
- [ ] Implement `validateDag()` — checks 0 cycles and 0 dangling prerequisites.
- [ ] Implement `constants.ts` with the two named thresholds.
- [ ] Run `npx vitest run lib/adaptive/__tests__/skillTaxonomy.test.ts` — all tests pass.

### 3. Refactor Phase
- [ ] Clean up naming/typing; confirm the exported DAG shape matches what backend-task-05 (seed script) and backend-task-07 (routing algorithm) expect to consume.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Enforces: unit-test correctness — Covered: `lib/adaptive/`
- `check-ai-key-bundle.mjs` — Enforces: no server-only secret reaches the client bundle — Covered: `lib/adaptive/` (directory-level coverage per the work plan's QA Mechanisms table, even though this specific file does not itself call `GEMINI_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`)

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/adaptive/__tests__/skillTaxonomy.test.ts` and inspect pass/fail per AC.
- **Success criteria**: all 4 AC-derived assertions (AC-001 through AC-004) pass against the real encoded DAG data (not a trivial/empty fixture).
- **Failure response**: if `validateDag()` reports a cycle or dangling prerequisite, do not silently drop the offending node/edge — escalate to backend-task-03's reviewed content for correction (the draft itself may need revision, not just the code).
- **Verification level**: L2 (new tests added and passing) as the primary target; L1 not directly applicable here (no end-user feature surface yet) but this exact data is what a real user's dashboard/routing will observe once Phase 2 wires it in.

## Proof Obligations
- **Claim**: AC-001 — the skill DAG contains 0 cycles.
- **Primary failure mode**: `validateDag()`'s cycle check is missing, uses an incorrect traversal (e.g. doesn't handle multi-parent nodes), or the encoded data itself has a cycle the reviewed draft did not intend.
- **Boundary to exercise**: in-process unit (pure function over the real encoded data, not a synthetic fixture).
- **State assertion**: N/A (pure validation, no state change).
- **Mock boundary rationale**: none — no I/O.
- **Residual**: none.
- **Claim**: AC-002 — the skill DAG contains 0 dangling prerequisites (every prerequisite edge points to an existing node).
- **Primary failure mode**: a prerequisite edge references a node id that was renamed/removed during encoding without updating the edge.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: AC-003 — node count falls in the 15-25 range; AC-004 — every node has a Vietnamese label.
- **Primary failure mode**: the encoded data silently drops or duplicates nodes relative to the approved draft, or a node's label is left in English/placeholder text.
- **Boundary to exercise**: in-process unit (assert against the real encoded array's `.length` and every node's `labelVi` field).
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [ ] `skillTaxonomy.ts`/`constants.ts` implemented, encoding backend-task-03's approved content
- [ ] `skillTaxonomy.test.ts` authored directly from AC-001-004 and passing
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode

## Notes
- Impact scope: `SOURCE/lib/adaptive/` only.
- Scope boundary: do not implement `route.ts` (backend-task-07) or `seedSkillTaxonomy.ts` (backend-task-05) here — this task only produces the typed data + validator + thresholds those tasks consume.
