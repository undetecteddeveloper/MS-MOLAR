# Task 03 (Backend): Math skill DAG content draft + engineer review (A2) (Work Plan Phase 1, Task 3)

Metadata:
- Dependencies: none
- Provides: `docs/plans/analysis/engine1-math-skill-dag-draft.md` (new — reviewed DAG content deliverable, consumed by backend-task-04)
- Size: Small (1 deliverable file, no `SOURCE/**` code)

## Why This Task Has No `SOURCE/**` Target Files

This is a content-authoring/review deliverable, not a code task (per the work plan's own Design-to-Plan Traceability row: "Content-authoring deliverable, not a code task — human-in-the-loop"). It is filed under the backend sequence (`backend-task-03`) because its sole output feeds directly into backend-task-04's typed DAG data and sits inside Phase 1's backend-only dependency chain — not because it touches any `SOURCE/lib`/`SOURCE/supabase` file itself.

## Implementation Content

Draft ~15-25 skill nodes + prerequisite edges covering grades 10 and 12 (the corpus's actual grade distribution) from the Vietnamese MOET curriculum outline, with Vietnamese labels (`labelVi`) for each node.

**Human review gate (not the same as the ⚠ BLOCKING checkpoints on backend-task-01/backend-task-14, but still a hard dependency)**: the engineer must review and approve the draft DAG before backend-task-04 seeds it into typed code (A2 — "review by the engineer is a required step, not a nicety"). An executor agent may produce the draft candidate content, but must not mark this task complete, and must not let backend-task-04 begin, until the human review/approval is recorded.

## Target Files
- [ ] `docs/plans/analysis/engine1-math-skill-dag-draft.md` (new — draft deliverable: node list with `labelVi`, prerequisite edges, grade tags, and a recorded approval status)

## Investigation Targets
- `docs/prd/engine1-adaptive-ai-prd.md` (§ AC-003 node-count range, § AC-004 Vietnamese-labels requirement, § R1/A2)
- `docs/design/engine1-adaptive-ai-backend-design.md` (whatever section describes the expected `SkillNode`/`SkillPrerequisite` shape backend-task-04 will implement, so the draft's fields align with the eventual typed data without rework)
- The corpus's actual `questions` table grade distribution (grades 10 and 12) — inspect via the project's existing seed/corpus data if accessible, to confirm the draft's grade coverage matches reality rather than an assumed distribution

## Implementation Steps

### 1. Draft
- [ ] Read all Investigation Targets.
- [ ] Draft 15-25 skill nodes with Vietnamese labels, grouped by grade (10, 12), each with a stable, human-readable node id.
- [ ] Draft prerequisite edges between nodes, forming a DAG (no cycles by construction — formal validation is backend-task-04's `validateDag()`, not this task's job, but the draft should be authored acyclically in the first place).

### 2. Human Review
- [ ] Engineer reviews the full draft against the Vietnamese MOET curriculum outline for correctness and completeness.
- [ ] Engineer records an explicit approval (or a list of required revisions) in the deliverable file itself.
- [ ] If revisions are required, repeat until approved — do not hand off to backend-task-04 on an unapproved draft.

## Quality Assurance Mechanisms
(None — this task produces no `SOURCE/**` code; ESLint/`tsc`/`next build`/`vitest` do not apply to a content-only deliverable. Formal DAG validity is proven in code by backend-task-04's `validateDag()`, not here.)

## Operation Verification Methods
- **Verification method**: manual read-through by the engineer against the Vietnamese MOET curriculum outline; node count and grade coverage checked by eye against the deliverable.
- **Success criteria**: node count falls in the 15-25 range (AC-003); every node has a Vietnamese label (AC-004); the engineer's explicit approval is recorded in the deliverable file.
- **Failure response**: if the engineer requires revisions, the draft is revised and re-reviewed — this is expected iteration, not a task failure to escalate.
- **Verification level**: L1-equivalent for content (human-judged correctness against the real curriculum), since there is no executable "build" for curriculum content.

## Proof Obligations
- **Claim**: the reviewed DAG content satisfies AC-003 (node count 15-25) and AC-004 (Vietnamese labels) as *content*, prior to any code encoding it.
- **Primary failure mode**: the draft ships with fewer than 15 or more than 25 nodes, or nodes with missing/placeholder (non-Vietnamese or English-only) labels, and is approved without the engineer catching it.
- **Boundary to exercise**: N/A — human review, not a code/test boundary.
- **State assertion**: N/A.
- **Mock boundary rationale**: N/A.
- **Residual**: this task proves the content is reviewed-correct; it does NOT prove the content is cycle-free/dangling-prerequisite-free as formal properties — that proof is backend-task-04's `validateDag()` unit test (AC-001/002), run against the typed encoding of this same content.

## Completion Criteria
- [ ] Draft deliverable exists at `docs/plans/analysis/engine1-math-skill-dag-draft.md` with 15-25 nodes, Vietnamese labels, grade 10/12 coverage, and prerequisite edges
- [ ] Engineer's explicit approval recorded in the deliverable
- [ ] backend-task-04 may now begin

## Notes
- Impact scope: `docs/plans/analysis/` only — no `SOURCE/**` file is touched by this task.
- Scope boundary: do not implement `lib/adaptive/skillTaxonomy.ts` here — that is backend-task-04's responsibility, which reads this deliverable as its source content.
